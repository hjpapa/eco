import type { Character, CharacterRole, CharacterStats, Rarity } from "./types";
import type { Company } from "./types";
import { CHARACTERS } from "../data/characters";
import { type RngState, shuffle, nextInt, nextFloat, nextRange, pick } from "./rng";

// Hiring, role bonuses and loyalty/poaching for the talent system.

export const ROLE_LABELS: Record<CharacterRole, string> = {
  ceo: "대표",
  cto: "기술 담당",
  cmo: "광고 담당",
  cfo: "돈 관리 담당",
  coo: "공장 운영 담당",
  chro: "직원 담당",
};

/** Build the initial talent pool (a shuffled subset of the catalog). */
export function buildTalentPool(rng: RngState, size: number): Character[] {
  return shuffle(rng, CHARACTERS)
    .slice(0, Math.min(size, CHARACTERS.length))
    .map((c) => ({ ...c }));
}

export interface RoleBonuses {
  productionEfficiency: number;
  rndPower: number;
  marketingMult: number;
  financeCostMult: number; // <1 reduces interest/marketing waste
  moraleAdd: number;
  reputationAdd: number;
  investReturnAdd: number; // extra fraction on investment gains
  safetyAdd: number;
}

const ZERO_BONUS: RoleBonuses = {
  productionEfficiency: 0,
  rndPower: 0,
  marketingMult: 1,
  financeCostMult: 1,
  moraleAdd: 0,
  reputationAdd: 0,
  investReturnAdd: 0,
  safetyAdd: 0,
};

/** Compute aggregate bonuses from a company's hired+assigned characters. */
export function roleBonuses(company: Company): RoleBonuses {
  const b: RoleBonuses = { ...ZERO_BONUS };
  for (const ch of company.hired) {
    if (!ch.role) continue;
    const s = ch.stats;
    const loyalty = (ch.loyalty ?? 70) / 100;
    const eff = loyalty; // disloyal staff underperform

    switch (ch.role) {
      case "coo":
        b.productionEfficiency += (s.management / 1000) * eff;
        break;
      case "cto":
        b.rndPower += (s.tech / 6) * eff;
        break;
      case "cmo":
        b.marketingMult += (s.marketing / 400) * eff;
        break;
      case "cfo":
        b.financeCostMult -= (s.finance / 1200) * eff;
        b.investReturnAdd += (s.finance / 2500) * eff;
        break;
      case "chro":
        b.moraleAdd += (s.leadership / 20) * eff;
        break;
      case "ceo":
        b.reputationAdd += (s.leadership / 40) * eff;
        b.marketingMult += (s.marketing / 1500) * eff;
        b.productionEfficiency += (s.management / 4000) * eff;
        break;
    }

    // Trait bonuses.
    switch (ch.trait) {
      case "innovator":
        b.rndPower += 4 * eff;
        break;
      case "rainmaker":
        b.marketingMult += 0.08 * eff;
        break;
      case "investor":
        b.investReturnAdd += 0.05 * eff;
        break;
      case "negotiator":
        b.financeCostMult -= 0.04 * eff;
        break;
      case "operator":
        b.productionEfficiency += 0.03 * eff;
        break;
      case "motivator":
        b.moraleAdd += 4 * eff;
        break;
      case "guardian":
        b.safetyAdd += 5 * eff;
        b.reputationAdd += 1 * eff;
        break;
      case "trendspotter":
        b.marketingMult += 0.04 * eff;
        break;
      case "visionary":
        b.reputationAdd += 2 * eff;
        b.rndPower += 2 * eff;
        b.marketingMult += 0.03 * eff;
        break;
      case "eager":
        b.productionEfficiency += 0.01 * eff;
        break;
    }
  }
  b.financeCostMult = Math.max(0.6, b.financeCostMult);
  return b;
}

/** Total per-turn salary for hired staff. */
export function totalSalary(company: Company): number {
  return company.hired.reduce((s, c) => s + c.salary, 0);
}

/**
 * Update loyalty each turn based on whether the company can pay and morale.
 * Returns characters who quit (loyalty hit zero).
 */
export function updateLoyalty(
  company: Company,
  canPay: boolean,
  rng: RngState,
  growthMultiplier = 1,
): Character[] {
  const quit: Character[] = [];
  for (const ch of company.hired) {
    let loyalty = ch.loyalty ?? 70;
    const loyaltyGrowth = (canPay ? 1.5 : -12) + (company.morale - 60) / 20;
    // Loyalty is the existing talent-progression measure. Short campaigns
    // speed up positive development, but unpaid/low-morale losses stay honest.
    loyalty += loyaltyGrowth > 0 ? loyaltyGrowth * growthMultiplier : loyaltyGrowth;
    loyalty = Math.max(0, Math.min(100, loyalty));
    ch.loyalty = loyalty;
    if (loyalty <= 0 && nextFloat(rng) < 0.5) quit.push(ch);
  }
  if (quit.length) {
    company.hired = company.hired.filter((c) => !quit.includes(c));
  }
  return quit;
}

/** Assign the best free role to a freshly hired character. */
export function autoAssignRole(company: Company, ch: Character): void {
  const taken = new Set(company.hired.map((c) => c.role).filter(Boolean));
  if (!taken.has(ch.preferredRole)) {
    ch.role = ch.preferredRole;
    return;
  }
  const order: CharacterRole[] = ["coo", "cto", "cmo", "cfo", "chro", "ceo"];
  ch.role = order.find((r) => !taken.has(r)) ?? ch.preferredRole;
}

/** Refresh the talent pool with a couple of new faces. */
export function refreshTalentPool(
  pool: Character[],
  hiredIds: Set<string>,
  rng: RngState,
): Character[] {
  const available = CHARACTERS.filter(
    (c) => !hiredIds.has(c.id) && !pool.some((p) => p.id === c.id),
  );
  if (!available.length) return pool;
  const additions = shuffle(rng, available).slice(0, nextInt(rng, 1, 2));
  return [...pool, ...additions.map((c) => ({ ...c }))];
}

// --- Procedural talent generation (keeps the market perpetually stocked) ----

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍",
];
const GIVEN = [
  "민준", "서연", "도윤", "지우", "예준", "하은", "주원", "지호", "수아", "건우",
  "유진", "성민", "다은", "재현", "소율", "현우", "지민", "은지", "태양", "보검",
  "세훈", "나래", "찬울", "혜린", "동하", "가람", "리아", "준서", "다올", "한결",
];
const AVATARS = ["🧑‍💼", "👩‍💼", "🧑‍💻", "👨‍🔬", "👩‍🔬", "🧑‍🏫", "🤵", "👷", "🧑‍🚀", "🕵️", "🧮", "📣", "🥽", "🧓", "🤝"];

interface TraitDef { id: string; name: string; desc: string; }
const TRAIT_DEFS: TraitDef[] = [
  { id: "innovator", name: "혁신가", desc: "R&D 효율 상승" },
  { id: "rainmaker", name: "세일즈퀸", desc: "마케팅 수요 증가" },
  { id: "investor", name: "투자귀재", desc: "투자 수익률 보너스" },
  { id: "negotiator", name: "협상가", desc: "재무·계약 비용 절감" },
  { id: "operator", name: "생산달인", desc: "생산 효율 상승" },
  { id: "motivator", name: "사기충전", desc: "직원 사기·충성도 상승" },
  { id: "guardian", name: "안전제일", desc: "안전·평판 리스크 감소" },
  { id: "trendspotter", name: "트렌드세터", desc: "트렌드 이벤트 수혜 강화" },
  { id: "visionary", name: "비전가", desc: "전 분야 소폭 상승 + 평판 가속" },
  { id: "eager", name: "열정러", desc: "성장 잠재력(저렴한 인건비)" },
];

const ROLES: CharacterRole[] = ["ceo", "cto", "cmo", "cfo", "coo", "chro"];
const RARITY_BANDS: Record<Rarity, [number, number]> = {
  common: [40, 72],
  rare: [52, 86],
  epic: [65, 92],
  legendary: [80, 99],
};
const RARITY_MULT: Record<Rarity, number> = { common: 1, rare: 1.25, epic: 1.5, legendary: 1.9 };

/** Primary stats boosted for a role, so generated talents fit their job. */
const ROLE_KEY_STATS: Record<CharacterRole, (keyof CharacterStats)[]> = {
  ceo: ["leadership", "management"],
  cto: ["tech", "creativity"],
  cmo: ["marketing", "creativity"],
  cfo: ["finance", "management"],
  coo: ["management", "tech"],
  chro: ["leadership", "management"],
};

let genCounter = 0;

/** Generate a fresh random talent (infinite supply for the market). */
export function generateCharacter(rng: RngState, forceRarity?: Rarity): Character {
  const roll = nextFloat(rng);
  const rarity: Rarity = forceRarity
    ?? (roll < 0.5 ? "common" : roll < 0.8 ? "rare" : roll < 0.95 ? "epic" : "legendary");
  const [lo, hi] = RARITY_BANDS[rarity];
  const role = pick(rng, ROLES);

  const stat = () => Math.round(nextRange(rng, lo, hi));
  const stats: CharacterStats = {
    management: stat(), tech: stat(), creativity: stat(),
    finance: stat(), leadership: stat(), marketing: stat(),
  };
  for (const key of ROLE_KEY_STATS[role]) {
    stats[key] = Math.min(99, Math.round(stats[key] + nextRange(rng, 6, 14)));
  }

  const trait = pick(rng, TRAIT_DEFS);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const salary = Math.round(((total / 6) * 90 + 2000) * RARITY_MULT[rarity]);
  const name = `${pick(rng, SURNAMES)}${pick(rng, GIVEN)}`;

  return {
    id: `gen-${(genCounter++).toString(36)}-${nextInt(rng, 0, 1_000_000).toString(36)}`,
    name,
    avatar: pick(rng, AVATARS),
    preferredRole: role,
    stats,
    trait: trait.id,
    traitName: trait.name,
    traitDesc: trait.desc,
    rarity,
    salary,
  };
}

/**
 * Keep the talent market stocked at ~target candidates every turn. Prefers
 * unused catalog faces, then falls back to procedural generation (so it never
 * runs dry), and occasionally rotates out one stale unhired candidate.
 */
export function topUpTalentPool(
  pool: Character[],
  hiredIds: Set<string>,
  rng: RngState,
  target = 8,
): Character[] {
  let next = [...pool];

  // Occasionally retire the oldest unhired candidate to keep the board fresh.
  if (next.length >= target && nextFloat(rng) < 0.35) next = next.slice(1);

  const catalogAvailable = shuffle(
    rng,
    CHARACTERS.filter((c) => !hiredIds.has(c.id) && !next.some((p) => p.id === c.id)),
  );
  let ci = 0;
  while (next.length < target) {
    if (ci < catalogAvailable.length && nextFloat(rng) < 0.5) {
      next.push({ ...catalogAvailable[ci++] });
    } else {
      next.push(generateCharacter(rng));
    }
  }
  return next;
}

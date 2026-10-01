import type {
  AssetClass,
  BuildingType,
  Company,
  GameState,
  PlacedBuilding,
} from "./types";
import {
  BUILDINGS,
  buildingConstructionCost,
  buildingCostFor,
  buildingSellRefund,
  evaluateBuildingPlacement,
  executiveSlots,
  isBuildingTypeUnlocked,
} from "./buildings";
import { estimateDemand, productionCapacity } from "./company";
import { getIndustry } from "../data/industries";
import { getCountry } from "../data/countries";
import { autoAssignRole, generateCharacter } from "./characters";
import { adjustRivalry, getRivalry } from "./relations";
import { shockStock } from "./market";
import { nextFloat } from "./rng";
import {
  applyCampaignGrowthMultiplier,
  captureCampaignGrowth,
  isFeatureUnlocked,
} from "./campaign";

// Mutating player/AI actions that happen *between* turns (they don't advance
// the clock). Single-sourced so the AI and the human player obey the same rules.

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Human-readable outcome message (e.g. deal success/failure). */
  message?: string;
  /** Realized profit/loss on a stock sale (current proceeds − cost basis). */
  realized?: number;
  /** Cash refunded when demolishing/selling a building. */
  refund?: number;
}

/** Average purchase price per share for a held stock (0 if none / unknown). */
export function avgCost(company: Company, targetCompanyId: string): number {
  const shares = company.portfolio.stocks[targetCompanyId] ?? 0;
  if (shares <= 0) return 0;
  const basis = company.portfolio.stockCost?.[targetCompanyId] ?? 0;
  return basis / shares;
}

/**
 * Building ids must stay unique inside a saved game. A module-level counter
 * restarts after a page reload, so derive the id from durable game data.
 */
function newBuildingId(state: GameState, company: Company, x: number, y: number): string {
  const taken = new Set(company.buildings.map((b) => b.id));
  const base = `b-${company.id}-${state.turn}-${x}-${y}`;
  let id = base;
  for (let n = 1; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/** The most a sensible plan can make: what fits the factories and what sells. */
function planLimit(state: GameState, company: Company): number {
  const demand = estimateDemand(
    company,
    getIndustry(company.industryId),
    getCountry(company.countryId),
    state.macro,
    state.config,
  );
  return Math.min(productionCapacity(company, state.config), Math.round(demand / 10) * 10);
}

/**
 * New factories add room and new stores add customers. A player whose plan
 * was already matched to the old limit gets a plan matched to the new one, so
 * the building starts paying off right away. A deliberately small plan stays
 * untouched.
 */
function followCampusGrowth(state: GameState, company: Company, limitBefore: number): number | null {
  const target = company.decisions.productionTarget;
  if (target < limitBefore * 0.95) return null;
  const next = planLimit(state, company);
  if (next <= target) return null;
  company.decisions.productionTarget = next;
  return next;
}

export function findCompany(state: GameState, id: string): Company | undefined {
  return state.companies.find((c) => c.id === id);
}

/** First empty grid cell (row-major), or null if the map is full. */
export function emptyCell(
  company: Company,
  mapSize: number,
): { x: number; y: number } | null {
  const occupied = new Set(company.buildings.map((b) => `${b.x},${b.y}`));
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

export function buildBuilding(
  state: GameState,
  company: Company,
  type: BuildingType,
  x: number,
  y: number,
): ActionResult {
  if (!state.config.enabledBuildings.includes(type)) {
    return { ok: false, error: "이 레벨에서는 사용할 수 없는 건물입니다." };
  }
  if (!isBuildingTypeUnlocked(company, type)) {
    return { ok: false, error: "도시가 더 커지면 지을 수 있어요." };
  }
  const max = state.config.mapSize;
  if (x < 0 || y < 0 || x >= max || y >= max) {
    return { ok: false, error: "맵 범위를 벗어났습니다." };
  }
  if (company.buildings.some((b) => b.x === x && b.y === y)) {
    return { ok: false, error: "이미 건물이 있는 칸입니다." };
  }
  const placement = evaluateBuildingPlacement(company, type, x, y, max);
  const cost = buildingConstructionCost(company, type);
  if (company.cash < cost) return { ok: false, error: "현금이 부족합니다." };

  const limitBefore = planLimit(state, company);
  company.cash -= cost;
  const building: PlacedBuilding = {
    id: newBuildingId(state, company, x, y),
    type,
    level: 1,
    x,
    y,
    turnsLeft: state.config.instantBuild ? 0 : BUILDINGS[type].buildTurns,
  };
  company.buildings.push(building);
  const raisedTarget = followCampusGrowth(state, company, limitBefore);
  const comboMessage = placement.combos.length > 0
    ? ` · ${placement.combos.map((combo) => `${combo.emoji} ${combo.name}`).join(", ")} 완성!`
    : "";
  const planMessage = raisedTarget ? ` · 생산 계획도 ${raisedTarget.toLocaleString()}개로 늘렸어요` : "";
  return { ok: true, message: `${BUILDINGS[type].name} 완성!${comboMessage}${planMessage}` };
}

/** Demolish/sell a building, refunding part of its construction cost. */
export function sellBuilding(
  state: GameState,
  company: Company,
  buildingId: string,
): ActionResult {
  const idx = company.buildings.findIndex((b) => b.id === buildingId);
  if (idx < 0) return { ok: false, error: "건물을 찾을 수 없습니다." };
  const refund = buildingSellRefund(company.buildings[idx]);
  company.cash += refund;
  company.buildings.splice(idx, 1);
  return { ok: true, refund };
}

/** Building-specific one-off management actions (cost → stat boost). */
interface CompanyActionDef {
  label: string;
  cost: number;
  cat?: string;
  desc?: string;
  apply: (company: Company) => void;
}
const clamp01 = (v: number) => Math.max(0, Math.min(100, v));
export const COMPANY_ACTIONS: Record<string, CompanyActionDef> = {
  // Legacy actions (kept for backward compat with BuildingInteriorModal)
  inspect: { label: "라인 점검", cost: 40_000, cat: "safety", apply: (c) => { c.safety = clamp01(c.safety + 7); } },
  research: { label: "집중 연구", cost: 60_000, cat: "rnd", apply: (c) => { c.quality = clamp01(c.quality + 5); } },
  promo: { label: "프로모션", cost: 50_000, cat: "marketing", apply: (c) => { c.reputation = clamp01(c.reputation + 5); } },
  training: { label: "직원 교육", cost: 50_000, cat: "welfare", apply: (c) => { c.morale = clamp01(c.morale + 5); c.quality = clamp01(c.quality + 2); } },
  welfare: {
    label: "복지 강화", cost: 40_000, cat: "welfare",
    apply: (c) => {
      c.morale = clamp01(c.morale + 6);
      for (const h of c.hired) h.loyalty = Math.min(100, (h.loyalty ?? 70) + 6);
    },
  },

  // Marketing category
  mkt_basic:     { label: "기본 마케팅",      cost: 30_000,  cat: "marketing", desc: "소규모 마케팅 활동으로 브랜드 인지도가 소폭 상승했습니다.",           apply: (c) => { c.reputation = Math.min(100, c.reputation + 2); } },
  mkt_active:    { label: "적극 마케팅",      cost: 80_000,  cat: "marketing", desc: "적극적인 마케팅 캠페인으로 브랜드 평판이 올랐습니다.",                apply: (c) => { c.reputation = Math.min(100, c.reputation + 5); } },
  mkt_intensive: { label: "집중 캠페인",      cost: 150_000, cat: "marketing", desc: "집중 캠페인 실시로 소비자 인지도가 크게 향상됐습니다.",               apply: (c) => { c.reputation = Math.min(100, c.reputation + 10); } },
  mkt_event:     { label: "특별 이벤트 행사", cost: 50_000,  cat: "marketing", desc: "특별 프로모션 이벤트로 화제를 모았습니다. 고객 반응 긍정적!",        apply: (c) => { c.reputation = Math.min(100, c.reputation + 8); } },

  // R&D category
  rnd_basic:  { label: "기초 연구", cost: 30_000,  cat: "rnd", desc: "기초 연구에 투자해 제품 품질이 개선되었습니다.",              apply: (c) => { c.quality = Math.min(100, c.quality + 3); } },
  rnd_active: { label: "기술 개발", cost: 80_000,  cat: "rnd", desc: "기술 개발 프로젝트로 제품 경쟁력이 향상됐습니다.",           apply: (c) => { c.quality = Math.min(100, c.quality + 7); } },
  rnd_patent: { label: "특허 출원", cost: 100_000, cat: "rnd", desc: "신기술 특허 출원! 기술 혁신 기업으로 주목받고 있습니다.", apply: (c) => { c.quality = Math.min(100, c.quality + 12); } },

  // Welfare category
  wlf_dinner:   { label: "직원 회식",       cost: 20_000, cat: "welfare", desc: "직원 회식으로 팀워크와 직원 사기가 올랐습니다!",               apply: (c) => { c.morale = Math.min(100, c.morale + 8); } },
  wlf_training: { label: "사내 교육",       cost: 40_000, cat: "welfare", desc: "사내 교육 프로그램으로 직원 역량이 향상됐습니다.",             apply: (c) => { c.morale = Math.min(100, c.morale + 5); c.quality = Math.min(100, c.quality + 2); } },
  wlf_workshop: { label: "워크숍/워케이션", cost: 60_000, cat: "welfare", desc: "워크숍을 통해 직원 만족도와 창의성이 높아졌습니다.",           apply: (c) => { c.morale = Math.min(100, c.morale + 12); } },

  // Safety category
  sft_inspect:  { label: "안전 점검",      cost: 15_000, cat: "safety", desc: "안전 점검 완료. 위험 요소를 사전에 제거했습니다.",             apply: (c) => { c.safety = Math.min(100, c.safety + 8); } },
  sft_training: { label: "안전 교육 훈련", cost: 30_000, cat: "safety", desc: "안전 교육 훈련으로 임직원 안전 의식이 제고됐습니다.",         apply: (c) => { c.safety = Math.min(100, c.safety + 15); } },

  // Extra management actions
  csr:         { label: "ESG/CSR 활동", cost: 50_000, cat: "extra", desc: "ESG 경영 실천으로 기업 이미지와 사회적 평판이 상승했습니다.", apply: (c) => { c.reputation = Math.min(100, c.reputation + 10); } },
  consulting:  { label: "외부 컨설팅",  cost: 80_000, cat: "extra", desc: "외부 컨설턴트 자문으로 경영 효율성이 개선됐습니다.",        apply: (c) => { c.quality = Math.min(100, c.quality + 5); c.reputation = Math.min(100, c.reputation + 3); } },
  pr_campaign: { label: "언론 홍보",    cost: 40_000, cat: "extra", desc: "언론 홍보 활동으로 회사의 긍정적 이미지가 확산됐습니다.",   apply: (c) => { c.reputation = Math.min(100, c.reputation + 6); } },
};

/** Player-initiated cooperation with another company (from the visit screen). */
interface DealDef { label: string; cost: number; }
export const DEALS: Record<string, DealDef> = {
  partner: { label: "전략적 제휴", cost: 40_000 },
  license: { label: "기술 제휴", cost: 60_000 },
  comarket: { label: "공동 마케팅", cost: 30_000 },
  scout: { label: "인재 스카우트", cost: 80_000 },
};

export function proposeDeal(
  state: GameState,
  company: Company,
  targetCompanyId: string,
  dealId: string,
): ActionResult {
  if (!isFeatureUnlocked(state, "visitsPartnershipsAdvanced")) {
    return lockedFeature("방문·제휴");
  }
  const def = DEALS[dealId];
  if (!def) return { ok: false, error: "알 수 없는 제안입니다." };
  const target = findCompany(state, targetCompanyId);
  if (!target || target.id === company.id) return { ok: false, error: "대상 회사를 찾을 수 없습니다." };
  if (company.cash < def.cost) return { ok: false, error: "현금이 부족합니다." };

  company.cash -= def.cost;

  // Compute success chance based on rivalry between companies.
  const rivalry = getRivalry(state.relations, company.id, targetCompanyId);
  let successChance = 0.65;
  if (rivalry > 0.6) {
    successChance = Math.max(0.3, 0.65 - rivalry * 0.4);
  } else if (rivalry < 0.2) {
    successChance = Math.min(0.9, 0.65 + 0.2);
  }

  // Roll for success/failure.
  if (nextFloat(state.rng) > successChance) {
    // Deal failed — refund 50% of cost.
    company.cash += Math.round(def.cost * 0.5);
    return { ok: true, message: "협상이 결렬되었습니다. 비용의 50%가 환불됩니다." };
  }

  const growthBefore = captureCampaignGrowth(company);
  const bump = (c: Company, q = 0, r = 0) => {
    c.quality = Math.min(100, c.quality + q);
    c.reputation = Math.min(100, c.reputation + r);
  };
  switch (dealId) {
    case "partner":
      adjustRivalry(state.relations, company.id, targetCompanyId, -0.25);
      shockStock(state.stocks, company.id, 0.02);
      shockStock(state.stocks, targetCompanyId, 0.02);
      bump(company, 0, 3);
      break;
    case "license":
      adjustRivalry(state.relations, company.id, targetCompanyId, -0.1);
      bump(company, 5, 1);
      shockStock(state.stocks, company.id, 0.02);
      break;
    case "comarket":
      adjustRivalry(state.relations, company.id, targetCompanyId, -0.15);
      bump(company, 0, 4);
      shockStock(state.stocks, company.id, 0.02);
      shockStock(state.stocks, targetCompanyId, 0.01);
      break;
    case "scout": {
      const cand = generateCharacter(state.rng, "epic");
      state.talentPool = [cand, ...state.talentPool];
      adjustRivalry(state.relations, company.id, targetCompanyId, 0.2);
      break;
    }
  }
  applyCampaignGrowthMultiplier(state, company, growthBefore);
  return { ok: true, message: "협력이 성사되었습니다!" };
}

function getCatEmoji(cat?: string): string {
  if (cat === "marketing") return "📣";
  if (cat === "rnd") return "🔬";
  if (cat === "welfare") return "😊";
  if (cat === "safety") return "🦺";
  return "📋";
}


export function applyCompanyAction(
  state: GameState,
  company: Company,
  actionId: string,
): ActionResult {
  const def = COMPANY_ACTIONS[actionId];
  if (!def) return { ok: false, error: "알 수 없는 활동입니다." };
  if (def.cat === "rnd" && !isFeatureUnlocked(state, "research")) {
    return lockedFeature("연구");
  }
  if (company.cash < def.cost) return { ok: false, error: "현금이 부족합니다." };
  company.cash -= def.cost;
  const growthBefore = captureCampaignGrowth(company);
  def.apply(company);
  applyCampaignGrowthMultiplier(state, company, growthBefore);

  // Push news item for the action
  if (def.desc) {
    state.news.push({
      id: `action-${state.turn}-${company.id}-${actionId}-${state.news.length}`,
      turn: state.turn,
      layer: "intercompany",
      tone: "positive",
      emoji: getCatEmoji(def.cat),
      title: `${company.name} — ${def.label}`,
      body: def.desc,
      tags: [company.id, company.industryId ?? ""],
    });
  }

  return { ok: true, message: `${def.label} 완료!` };
}

export function upgradeBuilding(
  state: GameState,
  company: Company,
  buildingId: string,
): ActionResult {
  const b = company.buildings.find((x) => x.id === buildingId);
  if (!b) return { ok: false, error: "건물을 찾을 수 없습니다." };
  const def = BUILDINGS[b.type];
  if (b.turnsLeft > 0) return { ok: false, error: "공사가 끝난 뒤 업그레이드할 수 있어요." };
  if (b.level >= def.maxLevel) return { ok: false, error: "이미 최고 레벨입니다." };
  const cost = buildingCostFor(b.type, b.level + 1);
  if (company.cash < cost) return { ok: false, error: "현금이 부족합니다." };
  const limitBefore = planLimit(state, company);
  company.cash -= cost;
  b.level += 1;
  if (!state.config.instantBuild) b.turnsLeft = Math.max(b.turnsLeft, 1);
  const raisedTarget = followCampusGrowth(state, company, limitBefore);
  const planMessage = raisedTarget ? ` · 생산 계획도 ${raisedTarget.toLocaleString()}개로 늘렸어요` : "";
  return { ok: true, message: `${def.name} Lv.${b.level} 업그레이드!${planMessage}` };
}

export function hireCharacter(
  state: GameState,
  company: Company,
  characterId: string,
  overrideSalary?: number,
  loyaltyBonus?: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "talentNewsRanking")) return lockedFeature("인재");
  const idx = state.talentPool.findIndex((c) => c.id === characterId);
  if (idx < 0) return { ok: false, error: "인재를 찾을 수 없습니다." };
  const character = state.talentPool[idx];
  const salary = overrideSalary ?? character.salary;
  const signingBonus = salary; // one-off hiring fee
  const slots = executiveSlots(company, state.config.adjacencyBonus);
  if (company.hired.length >= slots) return { ok: false, error: `임원 자리가 꽉 찼습니다 (최대 ${slots}명).` };
  if (company.cash < signingBonus) return { ok: false, error: "영입 비용이 부족합니다." };

  company.cash -= signingBonus;
  const baseLoyalty = character.rarity === "legendary" ? 60 : 75;
  const hired = { ...character, salary, loyalty: Math.min(100, baseLoyalty + (loyaltyBonus ?? 0)) };
  autoAssignRole(company, hired);
  company.hired.push(hired);
  state.talentPool.splice(idx, 1);
  return { ok: true };
}

/** Dismiss a hired employee. Costs severance and dents morale/reputation. */
export function fireCharacter(
  state: GameState,
  company: Company,
  characterId: string,
): ActionResult {
  if (!isFeatureUnlocked(state, "talentNewsRanking")) return lockedFeature("인재");
  const idx = company.hired.findIndex((c) => c.id === characterId);
  if (idx < 0) return { ok: false, error: "해당 직원을 찾을 수 없습니다." };
  const severance = Math.round(company.hired[idx].salary); // one-off payout
  if (company.cash < severance) return { ok: false, error: "퇴직금을 지급할 현금이 부족합니다." };

  company.cash -= severance;
  company.hired.splice(idx, 1);
  company.morale = Math.max(0, company.morale - 5);
  company.reputation = Math.max(0, company.reputation - 2);
  return { ok: true };
}

/** Recruit a character already employed at a rival company. */
export function poachCharacter(
  state: GameState,
  company: Company,
  targetCompanyId: string,
  characterId: string,
  overrideSalary?: number,
  loyaltyBonus?: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "talentNewsRanking")) return lockedFeature("인재");
  const target = state.companies.find((c) => c.id === targetCompanyId);
  if (!target) return { ok: false, error: "대상 회사를 찾을 수 없습니다." };
  const chIdx = target.hired.findIndex((c) => c.id === characterId);
  if (chIdx < 0) return { ok: false, error: "해당 인재를 찾을 수 없습니다." };
  const slots = executiveSlots(company, state.config.adjacencyBonus);
  if (company.hired.length >= slots) return { ok: false, error: `임원 자리가 꽉 찼습니다 (최대 ${slots}명).` };
  const ch = target.hired[chIdx];
  // Loyal staff demand a larger signing bonus; disloyal ones are easier to flip.
  const poachCost = Math.round(ch.salary * (1.3 + (ch.loyalty ?? 70) / 100));
  if (company.cash < poachCost) return { ok: false, error: "스카우트 비용이 부족합니다." };
  company.cash -= poachCost;
  const newSalary = overrideSalary ?? Math.round(ch.salary * 1.25);
  const newLoyalty = Math.min(100, 55 + (loyaltyBonus ?? 0));
  const poached = { ...ch, salary: newSalary, loyalty: newLoyalty };
  autoAssignRole(company, poached);
  company.hired.push(poached);
  target.hired.splice(chIdx, 1);
  target.morale = Math.max(0, target.morale - 8);
  return { ok: true, message: `${ch.name} 스카우트 성공!` };
}

/** Raise an existing employee's salary to boost loyalty. */
export function raiseSalary(
  state: GameState,
  company: Company,
  characterId: string,
  newSalary: number,
  miniGameBonus: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "talentNewsRanking")) return lockedFeature("인재");
  const ch = company.hired.find((c) => c.id === characterId);
  if (!ch) return { ok: false, error: "인재를 찾을 수 없습니다." };
  if (newSalary <= ch.salary) return { ok: false, error: "현재 연봉보다 높아야 합니다." };
  const ratio = (newSalary - ch.salary) / ch.salary;
  const salaryBonus = Math.round(Math.min(30, ratio * 60));
  const total = salaryBonus + miniGameBonus;
  const growthBefore = captureCampaignGrowth(company);
  ch.salary = newSalary;
  ch.loyalty = Math.min(100, (ch.loyalty ?? 70) + total);
  applyCampaignGrowthMultiplier(state, company, growthBefore);
  const actualGain = Math.round((ch.loyalty ?? 70) - growthBefore.loyaltyById[ch.id]);
  return { ok: true, message: `연봉 인상 완료 · 충성도 +${actualGain}` };
}

export function buyStock(
  state: GameState,
  company: Company,
  targetCompanyId: string,
  shares: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "investment")) return lockedFeature("투자");
  if (shares <= 0) return { ok: false, error: "수량을 확인하세요." };
  if (targetCompanyId === company.id) {
    return { ok: false, error: "자기 회사 주식은 살 수 없습니다." };
  }
  const stock = state.stocks[targetCompanyId];
  if (!stock) return { ok: false, error: "종목을 찾을 수 없습니다." };
  const alreadyHeld = company.portfolio.stocks[targetCompanyId] ?? 0;
  const float = stock.sharesOutstanding - (stock.treasury ?? 0); // tradable free float
  const maxBuyable = float - alreadyHeld;
  if (maxBuyable <= 0) return { ok: false, error: "유통 물량을 모두 보유 중입니다." };
  const actualShares = Math.min(shares, maxBuyable);
  const cost = stock.price * actualShares;
  if (company.cash < cost) return { ok: false, error: "현금이 부족합니다." };
  company.cash -= cost;
  company.portfolio.stocks[targetCompanyId] = alreadyHeld + actualShares;
  // Track cost basis for average-price / realized-P&L display.
  if (!company.portfolio.stockCost) company.portfolio.stockCost = {};
  company.portfolio.stockCost[targetCompanyId] =
    (company.portfolio.stockCost[targetCompanyId] ?? 0) + cost;
  return { ok: true };
}

export function sellStock(
  state: GameState,
  company: Company,
  targetCompanyId: string,
  shares: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "investment")) return lockedFeature("투자");
  const held = company.portfolio.stocks[targetCompanyId] ?? 0;
  if (shares <= 0 || held <= 0) return { ok: false, error: "보유 수량이 부족합니다." };
  const sellShares = Math.min(shares, held); // never sell more than held
  const stock = state.stocks[targetCompanyId];
  if (!stock) return { ok: false, error: "종목을 찾을 수 없습니다." };

  const proceeds = stock.price * sellShares;
  const basis = company.portfolio.stockCost?.[targetCompanyId] ?? 0;
  const costOfSold = held > 0 ? basis * (sellShares / held) : 0;
  const realized = proceeds - costOfSold;

  company.cash += proceeds;
  const remaining = held - sellShares;
  if (remaining > 0) {
    company.portfolio.stocks[targetCompanyId] = remaining;
    if (company.portfolio.stockCost) company.portfolio.stockCost[targetCompanyId] = basis - costOfSold;
  } else {
    delete company.portfolio.stocks[targetCompanyId];
    if (company.portfolio.stockCost) delete company.portfolio.stockCost[targetCompanyId];
  }
  return { ok: true, realized };
}

export function buyAsset(
  state: GameState,
  company: Company,
  assetClass: AssetClass,
  units: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "investment")) return lockedFeature("투자");
  if (units <= 0) return { ok: false, error: "수량을 확인하세요." };
  if (!state.config.enabledAssets.includes(assetClass)) {
    return { ok: false, error: "이 레벨에서는 거래할 수 없는 자산입니다." };
  }
  const asset = state.assets[assetClass];
  const cost = asset.price * units;
  if (company.cash < cost) return { ok: false, error: "현금이 부족합니다." };
  company.cash -= cost;
  company.portfolio.assets[assetClass] =
    (company.portfolio.assets[assetClass] ?? 0) + units;
  return { ok: true };
}

export function sellAsset(
  state: GameState,
  company: Company,
  assetClass: AssetClass,
  units: number,
): ActionResult {
  if (!isFeatureUnlocked(state, "investment")) return lockedFeature("투자");
  const held = company.portfolio.assets[assetClass] ?? 0;
  if (units <= 0 || units > held) return { ok: false, error: "보유 수량이 부족합니다." };
  const asset = state.assets[assetClass];
  company.cash += asset.price * units;
  const remaining = held - units;
  if (remaining > 0) company.portfolio.assets[assetClass] = remaining;
  else delete company.portfolio.assets[assetClass];
  return { ok: true };
}

/** Take on debt to raise cash. */
export function takeLoan(state: GameState, company: Company, amount: number): ActionResult {
  if (!isFeatureUnlocked(state, "visitsPartnershipsAdvanced")) return lockedFeature("회사 돈 관리(재무)");
  if (amount <= 0) return { ok: false, error: "금액을 확인하세요." };
  company.cash += amount;
  company.debt += amount;
  return { ok: true };
}

/** Repay outstanding debt from cash. */
export function repayLoan(state: GameState, company: Company, amount: number): ActionResult {
  if (!isFeatureUnlocked(state, "visitsPartnershipsAdvanced")) return lockedFeature("회사 돈 관리(재무)");
  const pay = Math.min(amount, company.debt, company.cash);
  if (pay <= 0) return { ok: false, error: "상환할 수 없습니다." };
  company.cash -= pay;
  company.debt -= pay;
  return { ok: true };
}

function lockedFeature(label: string): ActionResult {
  return { ok: false, error: `${label} 기능은 아직 배우는 중입니다.` };
}

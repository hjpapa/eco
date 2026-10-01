import type {
  Company,
  EventLayer,
  EventTone,
  GameState,
  NewsItem,
} from "./types";
import { getIndustry } from "../data/industries";
import { getCountry, COUNTRIES } from "../data/countries";
import { shockStock, shockMarket } from "./market";
import { shockAsset } from "./assets";
import { adjustRivalry, adjustTension } from "./relations";
import { generateCharacter } from "./characters";
import {
  applyCampaignGrowthMultiplier,
  captureCampaignGrowth,
  isFeatureUnlocked,
} from "./campaign";
import {
  type RngState,
  nextFloat,
  nextInt,
  nextRange,
  pick,
  weightedPick,
} from "./rng";

// Six-layer event engine. Each turn a few events fire, chosen by state-weighted
// probability. Player decisions shift those weights (e.g. neglecting safety
// raises accident odds; steady R&D raises breakthrough odds), and events are
// modelled on real economic/social phenomena. Tone is balanced over time.

interface EventCtx {
  state: GameState;
  rng: RngState;
}

interface EventResult {
  title: string;
  body: string;
  tags: string[];
  /** Large portrait emoji for a cut-in style popup. */
  portrait?: string;
  /** Pixel-art portrait image path. */
  portraitImg?: string;
}

/** Deterministic portrait image for a visitor (does not use game RNG). */
function visitorImg(kind: string, name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
  const idx = Math.abs(h);
  if (kind === "celebrity") {
    return `/assets/characters/talent_${String((idx % 32) + 1).padStart(2, "0")}.png`;
  }
  return `/assets/characters/famous_${String((idx % 32) + 1).padStart(2, "0")}.png`;
}

interface EventTemplate {
  id: string;
  layer: EventLayer;
  tone: EventTone;
  emoji: string;
  applicable?: (ctx: EventCtx) => boolean;
  weight: (ctx: EventCtx) => number;
  run: (ctx: EventCtx) => EventResult | null;
}

// --- helpers ---------------------------------------------------------------

/** Pick a company weighted by a custom function (>=0). */
function weightedCompany(
  state: GameState,
  rng: RngState,
  weightFn: (c: Company) => number,
): Company | null {
  const items = state.companies
    .map((c) => ({ item: c, weight: Math.max(0, weightFn(c)) }))
    .filter((i) => i.weight > 0);
  if (!items.length) return null;
  return weightedPick(rng, items);
}

/** Shock every company whose industry is sensitive to `tag`. */
function applyThemeShock(state: GameState, tag: string, basePct: number): string[] {
  const affected: string[] = [];
  for (const c of state.companies) {
    const sens = getIndustry(c.industryId).sensitivities[tag];
    if (!sens) continue;
    shockStock(state.stocks, c.id, basePct * sens);
    c.reputation = clamp(c.reputation + (basePct > 0 ? 1 : -1), 0, 100);
    affected.push(c.id);
  }
  // The broader market (external listings) also reacts to themes.
  for (const id of Object.keys(state.stocks)) {
    const stock = state.stocks[id];
    if (!stock.external || !stock.industryId) continue;
    const sens = getIndustry(stock.industryId).sensitivities[tag];
    if (!sens) continue;
    shockStock(state.stocks, id, basePct * sens);
  }
  return affected;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function playerCompany(state: GameState): Company | null {
  return state.companies.find((c) => c.id === state.playerCompanyId) ?? null;
}

const POLITICIAN_NAMES = ["김의장", "박장관", "이시장", "최총리", "정대변인", "강위원"];
const CELEBRITY_NAMES = ["스타 루나", "배우 강하늘", "가수 제이", "인플루언서 미오", "셀럽 빈센트", "아이돌 하루"];
const CEO_NAMES = ["라이벌 회장", "신흥 CEO", "거물 대표", "벤처 창업가", "재계 거물"];

// --- catalog ---------------------------------------------------------------

const TEMPLATES: EventTemplate[] = [
  // ===== MACRO =====
  {
    id: "oil_shock",
    layer: "macro",
    tone: "negative",
    emoji: "🛢️",
    weight: () => 1,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "oil", 0.08);
      shockAsset(state.assets, "oil", 0.18);
      state.macro.inflation += 0.8;
      return {
        title: "국제 유가 급등",
        body: "원유 가격이 치솟으며 물가와 에너지 관련 기업에 충격이 왔습니다.",
        tags: ["oil", ...affected],
      };
    },
  },
  {
    id: "supply_chain",
    layer: "macro",
    tone: "negative",
    emoji: "🚧",
    weight: () => 1,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "supplychain", -0.06);
      for (const c of state.companies) {
        const sens = getIndustry(c.industryId).sensitivities["supplychain"];
        if (sens) c.inventory = Math.max(0, c.inventory * 0.85);
      }
      return {
        title: "글로벌 공급망 위기",
        body: "부품·물류 차질로 제조 기반 기업의 생산과 재고에 차질이 생겼습니다.",
        tags: ["supplychain", ...affected],
      };
    },
  },
  {
    id: "pandemic",
    layer: "macro",
    tone: "negative",
    emoji: "🦠",
    weight: () => 0.5,
    run: ({ state }) => {
      state.macro.sentiment = clamp(state.macro.sentiment - 0.3, -1, 1);
      const bioUp = applyThemeShock(state, "pandemic", 0.1);
      shockMarket(state.stocks, -0.04);
      return {
        title: "감염병 확산",
        body: "소비가 위축되고 시장이 흔들렸습니다. 다만 일부 바이오 기업은 수혜를 봅니다.",
        tags: ["pandemic", ...bioUp],
      };
    },
  },
  {
    id: "consumer_boom",
    layer: "macro",
    tone: "positive",
    emoji: "🛍️",
    weight: ({ state }) => (state.macro.sentiment > 0 ? 1.4 : 0.7),
    run: ({ state }) => {
      const affected = applyThemeShock(state, "consumer", 0.05);
      state.macro.sentiment = clamp(state.macro.sentiment + 0.15, -1, 1);
      return {
        title: "소비 심리 회복",
        body: "지갑이 열리며 소비재·유통 기업의 수요가 늘었습니다.",
        tags: ["consumer", ...affected],
      };
    },
  },

  // ===== GEOPOLITICS =====
  {
    id: "trade_war",
    layer: "geopolitics",
    tone: "negative",
    emoji: "⚔️",
    weight: () => 1,
    run: ({ state, rng }) => {
      const a = pick(rng, COUNTRIES);
      let b = pick(rng, COUNTRIES);
      if (a.id === b.id) b = COUNTRIES[(COUNTRIES.indexOf(a) + 1) % COUNTRIES.length];
      adjustTension(state.relations, a.id, b.id, 0.4);
      const affected: string[] = [];
      for (const c of state.companies) {
        if (c.countryId === a.id || c.countryId === b.id) {
          const sens = getIndustry(c.industryId).sensitivities["trade"] ?? 1;
          shockStock(state.stocks, c.id, -0.05 * sens);
          affected.push(c.id);
        }
      }
      return {
        title: `${a.flag} ${a.name} ↔ ${b.flag} ${b.name} 무역분쟁`,
        body: "관세와 보복 조치로 양국 기반 기업들이 타격을 입었습니다.",
        tags: ["trade", a.id, b.id, ...affected],
      };
    },
  },
  {
    id: "trade_deal",
    layer: "geopolitics",
    tone: "positive",
    emoji: "🤝",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const a = pick(rng, COUNTRIES);
      let b = pick(rng, COUNTRIES);
      if (a.id === b.id) b = COUNTRIES[(COUNTRIES.indexOf(a) + 1) % COUNTRIES.length];
      adjustTension(state.relations, a.id, b.id, -0.4);
      const affected: string[] = [];
      for (const c of state.companies) {
        if (c.countryId === a.id || c.countryId === b.id) {
          shockStock(state.stocks, c.id, 0.04);
          affected.push(c.id);
        }
      }
      return {
        title: `${a.flag} ${a.name} ↔ ${b.flag} ${b.name} 자유무역협정`,
        body: "교역 장벽이 낮아져 양국 기업의 수출 기회가 늘었습니다.",
        tags: ["trade", a.id, b.id, ...affected],
      };
    },
  },

  // ===== INTERCOMPANY =====
  {
    id: "price_war",
    layer: "intercompany",
    tone: "negative",
    emoji: "🥊",
    weight: ({ state }) => (state.companies.length > 2 ? 1.2 : 0),
    run: ({ state, rng }) => {
      const a = pick(rng, state.companies);
      const rivals = state.companies.filter(
        (c) => c.id !== a.id && c.industryId === a.industryId,
      );
      if (!rivals.length) return null;
      const b = pick(rng, rivals);
      adjustRivalry(state.relations, a.id, b.id, 0.3);
      shockStock(state.stocks, a.id, -0.03);
      shockStock(state.stocks, b.id, -0.03);
      a.reputation = clamp(a.reputation - 1, 0, 100);
      return {
        title: "치열한 가격 경쟁",
        body: `${a.name}와(과) ${b.name}이(가) 가격 인하 경쟁에 돌입해 수익성이 압박받습니다.`,
        tags: ["intercompany", a.id, b.id],
      };
    },
  },
  {
    id: "ma_rumor",
    layer: "intercompany",
    tone: "positive",
    emoji: "💼",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => Math.max(0, c.lastProfit));
      if (!target) return null;
      shockStock(state.stocks, target.id, 0.09);
      return {
        title: "인수합병(M&A) 설",
        body: `${target.name}의 인수설이 돌며 주가가 급등했습니다.`,
        tags: ["intercompany", "ma", target.id],
      };
    },
  },
  {
    id: "partnership",
    layer: "intercompany",
    tone: "positive",
    emoji: "🤝",
    weight: () => 1,
    run: ({ state, rng }) => {
      if (state.companies.length < 2) return null;
      const a = pick(rng, state.companies);
      let b = pick(rng, state.companies);
      if (a.id === b.id) return null;
      adjustRivalry(state.relations, a.id, b.id, -0.3);
      shockStock(state.stocks, a.id, 0.04);
      shockStock(state.stocks, b.id, 0.04);
      return {
        title: "전략적 제휴 발표",
        body: `${a.name}와(과) ${b.name}이(가) 협력을 발표했습니다.`,
        tags: ["intercompany", a.id, b.id],
      };
    },
  },
  {
    id: "poaching",
    layer: "intercompany",
    tone: "negative",
    emoji: "🎯",
    weight: ({ state }) =>
      state.companies.some((c) => c.hired.length > 0) ? 0.8 : 0,
    run: ({ state, rng }) => {
      const victims = state.companies.filter((c) => c.hired.length > 0);
      if (!victims.length) return null;
      const victim = pick(rng, victims);
      const star = victim.hired[nextInt(rng, 0, victim.hired.length - 1)];
      star.loyalty = Math.max(0, (star.loyalty ?? 70) - 25);
      return {
        title: "인재 유치전",
        body: `경쟁사가 ${victim.name}의 ${star.name}을(를) 노립니다. 충성도가 흔들립니다.`,
        tags: ["intercompany", "talent", victim.id],
      };
    },
  },

  // ===== INTERNAL (player choices shift these probabilities) =====
  {
    id: "accident",
    layer: "internal",
    tone: "negative",
    emoji: "⚠️",
    weight: ({ state }) =>
      state.companies.reduce((s, c) => s + (100 - c.safety) / 100, 0) * 0.5,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => (100 - c.safety) / 100);
      if (!target) return null;
      shockStock(state.stocks, target.id, -0.08);
      target.reputation = clamp(target.reputation - 8, 0, 100);
      target.safety = clamp(target.safety - 5, 0, 100);
      return {
        title: "안전사고·제품 리콜",
        body: `${target.name}에서 사고가 발생했습니다. 안전 투자를 소홀히 한 대가입니다.`,
        tags: ["internal", "safety", target.id],
      };
    },
  },
  {
    id: "breakthrough",
    layer: "internal",
    tone: "positive",
    emoji: "💡",
    weight: ({ state }) =>
      state.companies.reduce((s, c) => s + c.decisions.rndBudget / 20000, 0) * 0.5,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => c.decisions.rndBudget / 20000);
      if (!target) return null;
      target.quality = clamp(target.quality + 8, 0, 100);
      shockStock(state.stocks, target.id, 0.08);
      return {
        title: "기술 돌파",
        body: `${target.name}의 R&D 투자가 결실을 맺어 신기술을 확보했습니다.`,
        tags: ["internal", "rnd", target.id],
      };
    },
  },
  {
    id: "scandal",
    layer: "internal",
    tone: "negative",
    emoji: "📰",
    weight: ({ state }) =>
      state.companies.reduce((s, c) => s + Math.max(0, (60 - c.morale) / 60), 0) * 0.4,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => Math.max(0.1, (60 - c.morale) / 60));
      if (!target) return null;
      shockStock(state.stocks, target.id, -0.06);
      target.reputation = clamp(target.reputation - 7, 0, 100);
      return {
        title: "경영 스캔들",
        body: `${target.name}을(를) 둘러싼 논란이 불거져 평판이 하락했습니다.`,
        tags: ["internal", target.id],
      };
    },
  },
  {
    id: "strike",
    layer: "internal",
    tone: "negative",
    emoji: "📢",
    weight: ({ state }) =>
      state.companies.reduce((s, c) => s + Math.max(0, (50 - c.morale) / 50), 0) * 0.5,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => Math.max(0.1, (50 - c.morale) / 50));
      if (!target) return null;
      target.inventory = Math.max(0, target.inventory * 0.8);
      target.morale = clamp(target.morale - 5, 0, 100);
      shockStock(state.stocks, target.id, -0.04);
      return {
        title: "노사 갈등·파업",
        body: `${target.name}의 직원 사기가 낮아 파업이 발생, 생산에 차질이 생겼습니다.`,
        tags: ["internal", target.id],
      };
    },
  },
  {
    id: "product_hit",
    layer: "internal",
    tone: "positive",
    emoji: "🎉",
    weight: ({ state }) =>
      state.companies.reduce(
        (s, c) => s + (c.decisions.marketingBudget / 30000) * (c.quality / 100),
        0,
      ) * 0.5,
    run: ({ state, rng }) => {
      const target = weightedCompany(
        state,
        rng,
        (c) => (c.decisions.marketingBudget / 30000) * (c.quality / 100 + 0.1),
      );
      if (!target) return null;
      target.reputation = clamp(target.reputation + 6, 0, 100);
      shockStock(state.stocks, target.id, 0.06);
      return {
        title: "신제품 대히트",
        body: `${target.name}의 신제품이 시장에서 큰 인기를 끌고 있습니다.`,
        tags: ["internal", target.id],
      };
    },
  },
  {
    id: "credit_downgrade",
    layer: "internal",
    tone: "negative",
    emoji: "🔻",
    // Bounded: count distressed companies (the raw debt/cash ratio could explode
    // to hundreds when cash is near zero, which used to drown out every other event).
    weight: ({ state }) =>
      state.companies.filter((c) => c.debt > c.cash * 1.5).length * 0.12,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) =>
        c.debt > c.cash * 1.5 ? Math.min(5, c.debt / (c.cash + 1)) : 0,
      );
      if (!target) return null;
      shockStock(state.stocks, target.id, -0.07);
      return {
        title: "신용등급 강등",
        body: `${target.name}의 과도한 부채로 신용등급이 내려가 조달 비용이 올랐습니다.`,
        tags: ["internal", "debt", target.id],
      };
    },
  },

  // ===== MARKET =====
  {
    id: "market_crash",
    layer: "market",
    tone: "negative",
    emoji: "💥",
    weight: ({ state }) => (state.macro.sentiment < -0.2 ? 1.4 : 0.5),
    run: ({ state }) => {
      shockMarket(state.stocks, -nextCrash(state.rng));
      state.macro.sentiment = clamp(state.macro.sentiment - 0.12, -1, 1);
      shockAsset(state.assets, "gold", 0.06);
      shockAsset(state.assets, "crypto", -0.15);
      return {
        title: "주식시장 폭락 (서킷브레이커)",
        body: "패닉셀이 번지며 증시가 급락했습니다. 안전자산으로 자금이 몰립니다.",
        tags: ["market", "crash"],
      };
    },
  },
  {
    id: "market_rally",
    layer: "market",
    tone: "positive",
    emoji: "📈",
    weight: ({ state }) => (state.macro.sentiment > 0.1 ? 1.4 : 0.6),
    run: ({ state }) => {
      shockMarket(state.stocks, nextRange(state.rng, 0.03, 0.07));
      state.macro.sentiment = clamp(state.macro.sentiment + 0.2, -1, 1);
      return {
        title: "강세장 랠리",
        body: "낙관론이 퍼지며 증시 전반이 상승했습니다.",
        tags: ["market", "rally"],
      };
    },
  },
  {
    id: "earnings_surprise",
    layer: "market",
    tone: "positive",
    emoji: "✨",
    weight: () => 1,
    run: ({ state, rng }) => {
      const target = weightedCompany(state, rng, (c) => Math.max(0.1, c.lastProfit));
      if (!target) return null;
      shockStock(state.stocks, target.id, nextRange(rng, 0.06, 0.12));
      return {
        title: "어닝 서프라이즈",
        body: `${target.name}이(가) 시장 예상을 뛰어넘는 실적을 발표했습니다.`,
        tags: ["market", target.id],
      };
    },
  },
  {
    id: "sector_rotation",
    layer: "market",
    tone: "neutral",
    emoji: "🔄",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const themes = ["ai", "ev", "space", "robot", "crypto", "consumer"];
      const theme = pick(rng, themes);
      const up = nextFloat(rng) > 0.4;
      const affected = applyThemeShock(state, theme, up ? 0.07 : -0.06);
      return {
        title: `테마 순환매: ${themeLabel(theme)} ${up ? "부각" : "조정"}`,
        body: `자금이 ${themeLabel(theme)} 테마로 ${up ? "유입" : "이탈"}되고 있습니다.`,
        tags: ["market", theme, ...affected],
      };
    },
  },
  {
    id: "crypto_swing",
    layer: "market",
    tone: "neutral",
    emoji: "🪙",
    weight: () => 1,
    run: ({ state, rng }) => {
      const up = nextFloat(rng) > 0.5;
      const pct = nextRange(rng, 0.1, 0.3) * (up ? 1 : -1);
      shockAsset(state.assets, "crypto", pct);
      applyThemeShock(state, "crypto", pct * 0.4);
      return {
        title: `암호화폐 ${up ? "급등" : "급락"}`,
        body: `암호화폐 시장이 ${up ? "폭등" : "폭락"}하며 관련 종목이 출렁입니다.`,
        tags: ["market", "crypto"],
      };
    },
  },

  // ===== MODERN THEME (positive innovation booms) =====
  {
    id: "ai_boom",
    layer: "market",
    tone: "positive",
    emoji: "🤖",
    weight: () => 1.1,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "ai", 0.12);
      return {
        title: "AI 혁신 붐",
        body: "인공지능 열풍으로 AI·반도체 기업이 주목받습니다.",
        tags: ["market", "ai", ...affected],
      };
    },
  },
  {
    id: "space_race",
    layer: "geopolitics",
    tone: "positive",
    emoji: "🚀",
    weight: () => 0.8,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "space", 0.1);
      return {
        title: "우주 개발 경쟁 가속",
        body: "각국의 우주 투자 확대로 우주항공 기업이 수혜를 봅니다.",
        tags: ["geopolitics", "space", ...affected],
      };
    },
  },
  {
    id: "ev_shift",
    layer: "macro",
    tone: "positive",
    emoji: "🔋",
    weight: () => 0.9,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "ev", 0.09);
      return {
        title: "전기차 전환 가속",
        body: "친환경 정책과 수요 확대로 전기차·배터리 산업이 성장합니다.",
        tags: ["macro", "ev", ...affected],
      };
    },
  },
  {
    id: "esg_regulation",
    layer: "geopolitics",
    tone: "negative",
    emoji: "🌍",
    weight: () => 0.8,
    run: ({ state }) => {
      const affected = applyThemeShock(state, "climate", -0.05);
      return {
        title: "환경·ESG 규제 강화",
        body: "탄소 규제가 강화되며 일부 산업의 비용 부담이 커집니다.",
        tags: ["geopolitics", "climate", ...affected],
      };
    },
  },

  // ===== MORE INTERCOMPANY (회사 간 교류) =====
  {
    id: "joint_venture",
    layer: "intercompany",
    tone: "positive",
    emoji: "🏗️",
    weight: ({ state }) => (state.companies.length > 2 ? 1 : 0),
    run: ({ state, rng }) => {
      const a = pick(rng, state.companies);
      const others = state.companies.filter((c) => c.id !== a.id);
      if (!others.length) return null;
      const b = pick(rng, others);
      adjustRivalry(state.relations, a.id, b.id, -0.3);
      shockStock(state.stocks, a.id, 0.05);
      shockStock(state.stocks, b.id, 0.05);
      return {
        title: "합작법인(JV) 설립",
        body: `${a.name}와(과) ${b.name}이(가) 공동 출자로 합작법인을 세웁니다.`,
        tags: ["intercompany", a.id, b.id],
      };
    },
  },
  {
    id: "tech_transfer",
    layer: "intercompany",
    tone: "positive",
    emoji: "🔧",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const buyer = weightedCompany(state, rng, (c) => Math.max(0.1, 100 - c.quality));
      if (!buyer) return null;
      buyer.quality = clamp(buyer.quality + 6, 0, 100);
      shockStock(state.stocks, buyer.id, 0.04);
      return {
        title: "기술 이전 계약",
        body: `${buyer.name}이(가) 핵심 기술을 이전받아 품질을 끌어올립니다.`,
        tags: ["intercompany", "tech", buyer.id],
      };
    },
  },
  {
    id: "supply_contract",
    layer: "intercompany",
    tone: "positive",
    emoji: "📑",
    weight: ({ state }) => (state.companies.length > 2 ? 1 : 0),
    run: ({ state, rng }) => {
      const a = pick(rng, state.companies);
      const others = state.companies.filter((c) => c.id !== a.id);
      if (!others.length) return null;
      const b = pick(rng, others);
      shockStock(state.stocks, a.id, 0.03);
      shockStock(state.stocks, b.id, 0.02);
      return {
        title: "장기 공급계약 체결",
        body: `${a.name}이(가) ${b.name}과(와) 안정적인 공급계약을 맺었습니다.`,
        tags: ["intercompany", a.id, b.id],
      };
    },
  },
  {
    id: "patent_dispute",
    layer: "intercompany",
    tone: "negative",
    emoji: "⚖️",
    weight: ({ state }) => (state.companies.length > 2 ? 1 : 0),
    run: ({ state, rng }) => {
      const a = pick(rng, state.companies);
      const rivals = state.companies.filter((c) => c.id !== a.id && c.industryId === a.industryId);
      const b = rivals.length ? pick(rng, rivals) : pick(rng, state.companies.filter((c) => c.id !== a.id));
      if (!b) return null;
      adjustRivalry(state.relations, a.id, b.id, 0.35);
      shockStock(state.stocks, a.id, -0.04);
      shockStock(state.stocks, b.id, -0.04);
      return {
        title: "특허 분쟁 발생",
        body: `${a.name}와(과) ${b.name}이(가) 특허 침해를 두고 법정 다툼에 들어갔습니다.`,
        tags: ["intercompany", "patent", a.id, b.id],
      };
    },
  },

  // ===== VISITOR (외부인 방문) =====
  {
    id: "politician_visit",
    layer: "visitor",
    tone: "positive",
    emoji: "🎩",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const name = pick(rng, POLITICIAN_NAMES);
      const img1 = visitorImg("politician", name);
      p.visitor = { kind: "politician", name, emoji: "🎩", turn: state.turn, portraitImg: img1 };
      p.reputation = clamp(p.reputation + 4, 0, 100);
      state.macro.sentiment = clamp(state.macro.sentiment + 0.05, -1, 1);
      shockStock(state.stocks, p.id, 0.03);
      return {
        title: `${name}, ${p.name} 방문`,
        body: `${name}이(가) 우리 회사를 찾아 격려했습니다. 규제 환경이 우호적으로 바뀌고 평판이 올랐습니다.`,
        portrait: "🎩",
        portraitImg: img1,
        tags: ["visitor", "politician", p.id],
      };
    },
  },
  {
    id: "ceo_visit",
    layer: "visitor",
    tone: "positive",
    emoji: "🤵",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const rivals = state.companies.filter((c) => c.id !== p.id);
      const name = rivals.length ? `${pick(rng, rivals).name} 회장` : pick(rng, CEO_NAMES);
      const img2 = visitorImg("ceo", name);
      p.visitor = { kind: "ceo", name, emoji: "🤵", turn: state.turn, portraitImg: img2 };
      if (rivals.length) adjustRivalry(state.relations, p.id, pick(rng, rivals).id, -0.2);
      p.reputation = clamp(p.reputation + 3, 0, 100);
      shockStock(state.stocks, p.id, 0.04);
      return {
        title: `${name}, 협력 논의차 방문`,
        body: `${name}이(가) ${p.name}을(를) 방문해 협업을 타진했습니다. 시장의 기대가 커집니다.`,
        portrait: "🤵",
        portraitImg: img2,
        tags: ["visitor", "ceo", p.id],
      };
    },
  },
  {
    id: "celebrity_visit",
    layer: "visitor",
    tone: "positive",
    emoji: "🌟",
    weight: () => 1,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const name = pick(rng, CELEBRITY_NAMES);
      const img3 = visitorImg("celebrity", name);
      p.visitor = { kind: "celebrity", name, emoji: "🌟", turn: state.turn, portraitImg: img3 };
      p.reputation = clamp(p.reputation + 6, 0, 100);
      p.morale = clamp(p.morale + 4, 0, 100);
      const sponsorship = Math.round(p.lastRevenue * 0.05);
      p.cash += sponsorship;
      shockStock(state.stocks, p.id, 0.05);
      return {
        title: `유명인 ${name} 방문·홍보`,
        body: `${name}이(가) ${p.name}을(를) 찾아 화제가 됐습니다. 평판과 직원 사기가 오르고 협찬 효과로 매출에 보탬이 됩니다.`,
        portrait: "🌟",
        portraitImg: img3,
        tags: ["visitor", "celebrity", p.id],
      };
    },
  },
  {
    id: "talent_walkin",
    layer: "visitor",
    tone: "positive",
    emoji: "✨",
    weight: () => 1,
    run: ({ state, rng }) => {
      // A standout candidate shows up at the door — added to the market cheap.
      const candidate = generateCharacter(rng, nextFloat(rng) < 0.5 ? "epic" : "legendary");
      candidate.salary = Math.round(candidate.salary * 0.7); // walk-in discount
      state.talentPool = [candidate, ...state.talentPool];
      return {
        title: `인재 ${candidate.name}, 직접 찾아오다`,
        body: `${candidate.traitName} 성향의 ${candidate.name}(이)가 우리 회사에 관심을 보이며 직접 찾아왔습니다. 인재 탭에서 할인된 조건으로 영입할 수 있어요!`,
        portrait: candidate.avatar,
        tags: ["visitor", "talent"],
      };
    },
  },
  {
    id: "investor_visit",
    layer: "visitor",
    tone: "positive",
    emoji: "💰",
    weight: () => 1,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const name = pick(rng, ["큰손 투자자", "벤처캐피탈 대표", "국부펀드 매니저", "엔젤 투자자"]);
      const img4 = visitorImg("investor", name);
      p.visitor = { kind: "investor", name, emoji: "💰", turn: state.turn, portraitImg: img4 };
      const inflow = Math.round(Math.max(50_000, p.cash * 0.08));
      p.cash += inflow;
      shockStock(state.stocks, p.id, 0.05);
      return {
        title: `${name}, ${p.name} 실사 방문`,
        body: `${name}이(가) 우리 회사를 둘러보고 ${formatMoneyShort(inflow)} 규모의 투자를 약속했습니다. 현금과 주가가 올랐습니다.`,
        portrait: "💰",
        portraitImg: img4,
        tags: ["visitor", "investor", p.id],
      };
    },
  },
  {
    id: "rival_benchmark_visit",
    layer: "visitor",
    tone: "neutral",
    emoji: "🕵️",
    weight: ({ state }) => (state.companies.length > 1 ? 0.9 : 0),
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const rivals = state.companies.filter((c) => c.id !== p.id);
      if (!rivals.length) return null;
      const rival = pick(rng, rivals);
      const rivalName = `${rival.name} 시찰단`;
      const img5 = visitorImg("ceo", rivalName);
      p.visitor = { kind: "ceo", name: rivalName, emoji: "🕵️", turn: state.turn, portraitImg: img5 };
      adjustRivalry(state.relations, p.id, rival.id, 0.15);
      p.quality = clamp(p.quality + 2, 0, 100);
      return {
        title: `${rival.name} 벤치마킹단 방문`,
        body: `${rival.name}의 임원진이 ${p.name}을(를) 시찰하며 우리 노하우를 살폈습니다. 자극을 받아 품질 개선에 나섭니다.`,
        portrait: "🕵️",
        portraitImg: img5,
        tags: ["visitor", "rival", p.id, rival.id],
      };
    },
  },
  {
    id: "influencer_livestream",
    layer: "visitor",
    tone: "positive",
    emoji: "📱",
    weight: () => 1,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const name = pick(rng, ["인기 유튜버", "라이브 스트리머", "테크 리뷰어", "먹방 크리에이터"]);
      const img6 = visitorImg("celebrity", name);
      p.visitor = { kind: "celebrity", name, emoji: "📱", turn: state.turn, portraitImg: img6 };
      p.reputation = clamp(p.reputation + 5, 0, 100);
      const buzz = Math.round(p.lastRevenue * 0.04);
      p.cash += buzz;
      shockStock(state.stocks, p.id, 0.04);
      return {
        title: `${name}, ${p.name} 라이브 방송`,
        body: `${name}이(가) 우리 회사에서 생방송을 진행해 화제가 됐습니다. 평판이 오르고 깜짝 매출이 발생했습니다.`,
        portrait: "📱",
        portraitImg: img6,
        tags: ["visitor", "influencer", p.id],
      };
    },
  },
  {
    id: "student_field_trip",
    layer: "visitor",
    tone: "positive",
    emoji: "🎒",
    weight: () => 0.8,
    run: ({ state }) => {
      const p = playerCompany(state);
      if (!p) return null;
      p.visitor = { kind: "celebrity", name: "견학 온 학생들", emoji: "🎒", turn: state.turn };
      p.morale = clamp(p.morale + 5, 0, 100);
      p.reputation = clamp(p.reputation + 3, 0, 100);
      return {
        title: `학생 견학단, ${p.name} 방문`,
        body: `미래의 인재들이 우리 회사를 견학했습니다. 직원들이 자부심을 느끼며 사기가 올랐습니다.`,
        portrait: "🎒",
        tags: ["visitor", "students", p.id],
      };
    },
  },
  {
    id: "scientist_visit",
    layer: "visitor",
    tone: "positive",
    emoji: "🔬",
    weight: () => 0.9,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const name = pick(rng, ["노벨상 수상자", "유명 과학자", "AI 석학", "수석 연구원"]);
      const img7 = visitorImg("ceo", name);
      p.visitor = { kind: "ceo", name, emoji: "🔬", turn: state.turn, portraitImg: img7 };
      p.quality = clamp(p.quality + 6, 0, 100);
      p.reputation = clamp(p.reputation + 3, 0, 100);
      shockStock(state.stocks, p.id, 0.04);
      return {
        title: `${name}, ${p.name} 자문 방문`,
        body: `${name}이(가) 우리 연구진과 협업해 기술 자문을 제공했습니다. 품질과 평판이 올랐습니다.`,
        portrait: "🔬",
        portraitImg: img7,
        tags: ["visitor", "scientist", p.id],
      };
    },
  },
  {
    id: "foreign_delegation",
    layer: "visitor",
    tone: "positive",
    emoji: "🌐",
    weight: () => 0.8,
    run: ({ state, rng }) => {
      const p = playerCompany(state);
      if (!p) return null;
      const country = pick(rng, COUNTRIES);
      const delegName = `${country.flag} ${country.name} 대표단`;
      const img8 = visitorImg("politician", delegName);
      p.visitor = { kind: "politician", name: delegName, emoji: "🌐", turn: state.turn, portraitImg: img8 };
      const order = Math.round(Math.max(40_000, p.lastRevenue * 0.06));
      p.cash += order;
      shockStock(state.stocks, p.id, 0.04);
      return {
        title: `${country.flag} ${country.name} 통상 대표단 방문`,
        body: `${country.name} 대표단이 ${p.name}과(와) 수출 상담을 진행해 해외 주문을 따냈습니다.`,
        portrait: "🌐",
        portraitImg: img8,
        tags: ["visitor", "export", p.id, country.id],
      };
    },
  },
];

function formatMoneyShort(v: number): string {
  if (v >= 100_000_000) return `${Math.round(v / 100_000_000)}억`;
  if (v >= 10_000) return `${Math.round(v / 10_000)}만`;
  return `${v}`;
}

function nextCrash(rng: RngState): number {
  return nextRange(rng, 0.06, 0.14);
}

function themeLabel(theme: string): string {
  const map: Record<string, string> = {
    ai: "AI",
    ev: "전기차",
    space: "우주",
    robot: "로봇",
    crypto: "암호화폐",
    consumer: "소비재",
  };
  return map[theme] ?? theme;
}

let eventCounter = 0;

/**
 * Balance helper: keep positive vs negative events roughly even over time.
 * Counts recent positives/negatives and strongly up/down-weights to correct an
 * imbalance, so players see a fair mix of 호재 and 악재.
 */
function toneBalanceFactor(state: GameState, tone: EventTone): number {
  if (tone === "neutral") return 1;
  // Jokes are not real news, so they never tilt the 호재/악재 balance.
  const recent = state.news.filter((n) => n.layer !== "fun").slice(-10);
  const pos = recent.filter((n) => n.tone === "positive").length;
  const neg = recent.filter((n) => n.tone === "negative").length;
  const diff = tone === "positive" ? pos - neg : neg - pos;
  // If this tone is already ahead, damp it; if behind, boost it.
  if (diff >= 2) return 0.35;
  if (diff === 1) return 0.7;
  if (diff <= -2) return 2.2;
  if (diff === -1) return 1.4;
  return 1;
}

/**
 * Generate this turn's events. Returns the new NewsItems (already pushed onto
 * state.news). Number of events scales with level event intensity.
 */
export function generateEvents(state: GameState): NewsItem[] {
  const ctx: EventCtx = { state, rng: state.rng };
  const intensity = state.config.eventIntensity;
  const enabled = new Set(state.config.enabledEventLayers);
  // Events run before the turn counter increments, so use the projected turn
  // to make the first visitor land exactly on the documented unlock boundary.
  const visitsUnlocked = isFeatureUnlocked(
    { gameLength: state.gameLength, revealMode: state.revealMode, turn: state.turn + 1 },
    "visitsPartnershipsAdvanced",
  );
  if (!visitsUnlocked) enabled.delete("visitor");

  // Fire 1..(3*intensity+1) events per quarter so there's always something going on.
  const maxEvents = nextInt(state.rng, 1, Math.round(3 * intensity) + 1);
  const created: NewsItem[] = [];
  // Don't let the same event template repeat within a single quarter.
  const used = new Set<string>();
  // Cap any single template's weight so no event (e.g. a debt spiral) can ever
  // dominate the draw and crowd out the rest of the catalogue.
  const WEIGHT_CAP = 4;

  for (let i = 0; i < maxEvents; i++) {
    const candidates = TEMPLATES.filter(
      (t) => !used.has(t.id) && enabled.has(t.layer) && (!t.applicable || t.applicable(ctx)),
    ).map((t) => ({
      item: t,
      weight:
        Math.min(WEIGHT_CAP, Math.max(0, t.weight(ctx))) *
        intensity *
        toneBalanceFactor(state, t.tone),
    }));
    const valid = candidates.filter((c) => c.weight > 0);
    if (!valid.length) break;

    const template = weightedPick(state.rng, valid);
    used.add(template.id);
    const growthBefore = new Map(
      state.companies.map((company) => [company.id, captureCampaignGrowth(company)]),
    );
    const result = template.run(ctx);
    for (const company of state.companies) {
      const before = growthBefore.get(company.id);
      if (before) applyCampaignGrowthMultiplier(state, company, before);
    }
    if (!result) continue;

    const news: NewsItem = {
      id: `ev-${state.turn}-${eventCounter++}`,
      turn: state.turn,
      layer: template.layer,
      tone: template.tone,
      title: result.title,
      body: result.body,
      emoji: template.emoji,
      portrait: result.portrait,
      portraitImg: result.portraitImg,
      tags: result.tags,
    };
    state.news.push(news);
    created.push(news);
  }

  if (state.news.length > 120) {
    state.news.splice(0, state.news.length - 120);
  }
  return created;
}

export const LAYER_LABELS: Record<EventLayer, string> = {
  macro: "거시경제",
  monetary: "통화정책",
  geopolitics: "국가/지정학",
  intercompany: "기업 간",
  internal: "회사 내부",
  market: "주식시장",
  visitor: "외부 방문",
  fun: "깜짝 소식",
};

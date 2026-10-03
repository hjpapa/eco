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
        title: "기름값(유가)이 크게 올랐어요",
        body: "석유 값이 치솟아서 물건값이 오르고, 에너지를 많이 쓰는 회사들이 힘들어졌어요.",
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
        title: "부품이 제때 안 와요(공급망 위기)",
        body: "다른 나라에서 오는 부품과 배송이 늦어져서 물건을 만드는 회사들이 곤란해졌어요.",
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
        body: "사람들이 밖에 덜 나가서 물건을 덜 사요. 대신 약을 만드는 바이오 회사는 바빠졌어요.",
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
        title: "사람들이 다시 물건을 사요",
        body: "사람들이 지갑을 열어서 물건을 파는 회사들의 손님이 늘었어요.",
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
        title: `${a.flag} ${a.name} ↔ ${b.flag} ${b.name} 무역 다툼`,
        body: "두 나라가 서로 물건에 세금(관세)을 매겨서 두 나라 회사들이 물건을 팔기 어려워졌어요.",
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
        title: `${a.flag} ${a.name} ↔ ${b.flag} ${b.name} 자유무역 약속(FTA)`,
        body: "두 나라가 물건을 더 쉽게 사고팔기로 약속해서 회사들이 다른 나라에 팔 기회가 늘었어요.",
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
        body: `${a.name}와(과) ${b.name}이(가) 서로 값을 내리며 겨뤄서, 한 개에 남는 돈이 줄었어요.`,
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
        title: "회사를 사들인다는 소문",
        body: `큰 회사가 ${target.name}을(를) 사들일 거라는 소문에 주식 값이 크게 올랐어요.`,
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
        title: "두 회사가 손을 잡았어요",
        body: `${a.name}와(과) ${b.name}이(가) 함께 일하기로 했어요.`,
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
        title: "인재 데려가기 경쟁",
        body: `라이벌 회사가 ${victim.name}의 ${star.name}을(를) 데려가려고 해요. 마음이 흔들리고 있어요.`,
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
        title: "사고가 나서 물건을 다시 거둬들여요(리콜)",
        body: `${target.name}에서 사고가 났어요. 안전을 미리 챙기지 않으면 이런 일이 생겨요.`,
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
        title: "새 기술 개발 성공!",
        body: `${target.name}의 연구가 성공해서 새 기술을 얻었어요.`,
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
        title: "회사에 나쁜 소문이 났어요",
        body: `${target.name}에 대한 나쁜 이야기가 퍼져서 평판이 떨어졌어요.`,
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
        title: "직원들이 일을 멈췄어요(파업)",
        body: `${target.name}의 직원들이 행복하지 않아서 일을 멈췄어요. 물건을 덜 만들게 됐어요.`,
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
        body: `${target.name}의 새 물건이 엄청 인기예요!`,
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
        title: "은행이 믿음 점수를 낮췄어요",
        body: `${target.name}의 빚이 너무 많아서 은행이 믿음 점수(신용등급)를 낮췄어요. 돈을 빌리기가 더 비싸졌어요.`,
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
        title: "주식 값이 와르르 떨어졌어요",
        body: "겁먹은 사람들이 주식을 한꺼번에 팔아서 값이 크게 떨어졌어요. 예금·금처럼 안전한 곳으로 돈이 몰려요.",
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
        title: "주식 값이 쭉쭉 올라요",
        body: "앞으로 경제가 좋아질 거라는 기대에 대부분의 주식 값이 올랐어요.",
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
        title: "깜짝 놀랄 만큼 돈을 벌었어요",
        body: `${target.name}이(가) 모두의 예상보다 훨씬 많이 벌었다고 발표했어요.`,
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
        title: `${themeLabel(theme)} 주식 ${up ? "인기 상승" : "인기 하락"}`,
        body: `사람들이 ${themeLabel(theme)} 회사 주식을 ${up ? "많이 사고 있어요" : "팔고 있어요"}.`,
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
        body: `비트코인 같은 코인 값이 ${up ? "크게 올라서" : "크게 떨어져서"} 관련 회사 주식도 출렁여요.`,
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
        body: "인공지능(AI)이 인기라서 AI·반도체 회사들이 주목받아요.",
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
        title: "우주 개발 경쟁이 뜨거워요",
        body: "여러 나라가 우주에 돈을 많이 써서 우주 회사들이 바빠졌어요.",
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
        title: "전기차가 쑥쑥 늘어요",
        body: "환경을 지키려는 사람들이 늘어 전기차·배터리 회사가 자라고 있어요.",
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
        title: "환경 지키기 규칙이 엄격해졌어요",
        body: "공기를 더럽히는 연기(탄소)를 줄이는 규칙이 생겨 일부 회사는 돈이 더 들어요.",
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
        title: "두 회사가 함께 새 회사를 세워요",
        body: `${a.name}와(과) ${b.name}이(가) 돈을 같이 내서 새 회사를 만들어요.`,
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
        title: "기술을 배워 왔어요",
        body: `${buyer.name}이(가) 중요한 기술을 배워 와서 품질이 좋아져요.`,
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
        title: "오래 거래하기로 약속했어요",
        body: `${a.name}이(가) ${b.name}과(와) 오랫동안 물건을 주고받기로 약속했어요.`,
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
        title: "발명 주인을 두고 다퉈요(특허 다툼)",
        body: `${a.name}와(과) ${b.name}이(가) "그건 우리 발명이야!" 하며 법원에서 다투고 있어요.`,
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
        body: `${name}이(가) 우리 회사를 찾아와 응원했어요. 회사 일이 수월해지고 평판이 올랐어요.`,
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
        title: `${name}, 함께 일하자며 방문`,
        body: `${name}이(가) ${p.name}에 와서 함께 일하자고 했어요. 사람들의 기대가 커졌어요.`,
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
        body: `${name}이(가) ${p.name}에 와서 화제가 됐어요! 평판과 직원 행복이 오르고 물건도 더 팔렸어요.`,
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
        body: `✨ ${candidate.traitName} 능력을 가진 ${candidate.name}(이)가 우리 회사에서 일하고 싶다며 찾아왔어요. 인재 탭에서 싸게 뽑을 수 있어요!`,
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
        title: `${name}, ${p.name}에 투자하러 왔어요`,
        body: `${name}이(가) 우리 회사를 둘러보고 ${formatMoneyShort(inflow)}을 투자하기로 했어요. 쓸 돈과 주식 값이 올랐어요.`,
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
        title: `${rival.name}이(가) 배우러 왔어요`,
        body: `${rival.name} 사람들이 ${p.name}의 비법을 보고 갔어요. 우리도 자극을 받아 품질을 더 높여요.`,
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
        body: `${name}이(가) 우리 회사에서 생방송을 해서 화제가 됐어요. 평판이 오르고 물건도 깜짝 팔렸어요.`,
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
        body: `학생들이 우리 회사를 구경하러 왔어요. 직원들이 뿌듯해서 행복이 올랐어요.`,
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
        title: `${name}, ${p.name}에 도움 주러 왔어요`,
        body: `${name}이(가) 우리 연구원들에게 비법을 알려 줬어요. 품질과 평판이 올랐어요.`,
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
        title: `${country.flag} ${country.name}에서 손님들이 왔어요`,
        body: `${country.name}에서 온 손님들이 우리 물건을 사 가기로 했어요. 다른 나라에 물건을 파는 걸 수출이라고 해요.`,
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
  macro: "나라 경제",
  monetary: "은행·이자",
  geopolitics: "세계 소식",
  intercompany: "회사들 소식",
  internal: "우리 회사",
  market: "주식 시장",
  visitor: "손님 방문",
  fun: "깜짝 소식",
};

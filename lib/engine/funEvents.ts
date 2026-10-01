import type { Company, EventTone, GameState, NewsItem } from "./types";
import { getIndustry } from "../data/industries";
import { getIndustryProducts } from "../data/products";
import { isFeatureUnlocked } from "./campaign";
import { createRng, nextFloat, type RngState } from "./rng";

// Light-hearted "깜짝 소식" that react to what is happening in the student's
// company: a cat that clocks in at the park, a box maze when the warehouse is
// overflowing, a customer polishing their glasses at a sky-high price tag.
// Each one ends with a tiny economics hint and has at most a small effect.
//
// They draw from their own seed (game seed + turn) instead of the main game
// RNG, so adding or editing jokes never changes the market, rivals or events.

interface FunCtx {
  state: GameState;
  company: Company;
  rng: RngState;
}

interface FunTemplate {
  id: string;
  emoji: string;
  tone: EventTone;
  weight?: number;
  when: (ctx: FunCtx) => boolean;
  run: (ctx: FunCtx) => { title: string; body: string };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const has = (c: Company, type: string) => c.buildings.some((b) => b.type === type && b.turnsLeft <= 0);

/** Basic product price compared with its normal price (1 = normal). */
function basicPriceRatio(c: Company): number {
  const def = getIndustryProducts(c.industryId)[0];
  if (!def) return 1;
  const tierRef = getIndustry(c.industryId).basePrice * def.priceRatio;
  const price = c.productPrices?.[0] ?? tierRef;
  return price / Math.max(1, tierRef);
}

const FUN_EVENTS: FunTemplate[] = [
  {
    id: "opening-rice-cake",
    emoji: "🍡",
    tone: "positive",
    weight: 100,
    when: ({ state }) => state.turn === 0,
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 2);
      return {
        title: "개업 떡 돌리기",
        body: `${company.name} 첫 영업 기념으로 이웃에게 떡을 돌렸어요. 떡이 너무 쫀득해서 답례로 귤이 세 박스나 돌아왔어요! (평판 +2)\n💡 좋은 첫인상은 회사의 평판이 돼요.`,
      };
    },
  },
  {
    id: "ribbon-necktie",
    emoji: "✂️",
    tone: "positive",
    weight: 3,
    when: ({ state, company }) => company.buildings.some((b) => b.id.startsWith(`b-${company.id}-${state.turn}-`)),
    run: ({ company }) => {
      company.morale = clamp(company.morale + 1);
      return {
        title: "넥타이 테이프 커팅",
        body: "새 건물 준공식에서 사장님이 리본 대신 자기 넥타이를 싹둑 잘랐어요! 건물은 멀쩡하고 다들 배꼽을 잡았어요. (직원 행복 +1)\n💡 새 건물은 지은 뒤에도 매 턴 유지비가 나가요.",
      };
    },
  },
  {
    id: "cat-manager",
    emoji: "🐱",
    tone: "positive",
    when: ({ company }) => has(company, "park"),
    run: ({ company }) => {
      company.morale = clamp(company.morale + 2);
      return {
        title: "야옹 과장님 출근",
        body: "공원에 사는 고양이가 매일 9시 정각에 회사 앞에 앉아 있어요. 직원들이 '야옹 과장님'이라고 부르기 시작했어요. (직원 행복 +2)\n💡 쉴 곳이 있으면 직원들이 더 즐겁게 일해요.",
      };
    },
  },
  {
    id: "tteokbokki-rush",
    emoji: "🌶️",
    tone: "positive",
    when: ({ company }) => has(company, "cafeteria"),
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 2);
      return {
        title: "구내식당 떡볶이 대란",
        body: "오늘 구내식당 떡볶이가 너무 맛있어서 옆 회사 직원들까지 몰래 줄을 섰어요. (평판 +2)\n💡 좋은 복지는 회사의 평판도 올려 줘요.",
      };
    },
  },
  {
    id: "box-maze",
    emoji: "📦",
    tone: "neutral",
    weight: 2,
    when: ({ company }) => company.inventory > Math.max(300, company.decisions.productionTarget * 0.5),
    run: ({ company }) => ({
      title: "창고 속 상자 미로",
      body: `창고에 안 팔린 상품이 ${Math.round(company.inventory).toLocaleString()}개나 쌓여서 신입 직원이 상자 미로에 갇혔다가 점심시간에 겨우 탈출했어요.\n💡 안 팔린 재고는 돈이 묶여 있는 거예요. 생산 계획을 손님 수에 맞춰 볼까요?`,
    }),
  },
  {
    id: "price-glasses",
    emoji: "👓",
    tone: "neutral",
    weight: 2,
    when: ({ company }) => basicPriceRatio(company) >= 1.25,
    run: () => ({
      title: "안경을 두 번 닦은 손님",
      body: "손님이 우리 상품 가격표를 보고 안경을 두 번이나 닦았어요. \"0이 하나 더 붙은 거 아니죠?\"\n💡 가격이 너무 높으면 사려는 손님이 줄어요.",
    }),
  },
  {
    id: "too-cheap",
    emoji: "😲",
    tone: "neutral",
    weight: 2,
    when: ({ company }) => basicPriceRatio(company) <= 0.75,
    run: () => ({
      title: "\"혹시 공짜인가요?\"",
      body: "가격이 너무 싸서 \"혹시 공짜예요?\"라는 문의 전화가 하루 종일 울렸어요.\n💡 너무 싸게 팔면 많이 팔아도 남는 돈(이익)이 적을 수 있어요.",
    }),
  },
  {
    id: "balloons",
    emoji: "🎈",
    tone: "positive",
    when: ({ company }) => company.profitHistory.slice(-2).length === 2 && company.profitHistory.slice(-2).every((p) => p > 0),
    run: ({ company }) => {
      company.morale = clamp(company.morale + 3);
      company.cash = Math.max(0, company.cash - 5_000);
      return {
        title: "로비에 풍선 1,000개",
        body: "흑자 소식에 신난 사장님이 로비에 풍선 1,000개를 달았어요. 풍선값으로 5,000원이 나갔지만 다들 신났어요! (직원 행복 +3)\n💡 기분 좋은 지출도 비용이에요.",
      };
    },
  },
  {
    id: "upside-down-calculator",
    emoji: "🧮",
    tone: "neutral",
    when: ({ company }) => company.lastProfit < 0,
    run: () => ({
      title: "계산기를 거꾸로 들었나?",
      body: "회계 담당자가 \"계산기를 거꾸로 들었나?\" 하며 세 번이나 다시 계산했어요. 아쉽지만 진짜 적자예요.\n💡 들어온 돈(매출)보다 나간 돈(비용)이 많으면 적자가 나요.",
    }),
  },
  {
    id: "penguin-meeting",
    emoji: "🐧",
    tone: "positive",
    when: ({ state }) => state.macro.phase === "recession" || state.macro.phase === "deflation",
    run: ({ company }) => {
      company.cash += 2_000;
      return {
        title: "펭귄 회의",
        body: "경기가 춥다며 직원들이 펭귄처럼 옹기종기 붙어 앉아 회의를 했어요. 난방비 2,000원을 아꼈대요!\n💡 경기가 나쁠 때는 아껴 쓰는 지혜가 필요해요.",
      };
    },
  },
  {
    id: "fish-bread",
    emoji: "🐟",
    tone: "positive",
    when: ({ state }) => state.macro.phase === "boom",
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 1);
      return {
        title: "붕어빵 가게 2층 증축",
        body: "경기가 좋아 회사 앞 붕어빵 아저씨가 가게를 2층으로 늘렸어요. 2층 메뉴는 '슈크림 붕어빵'이래요!\n💡 경기가 좋으면 사람들이 돈을 더 많이 써요.",
      };
    },
  },
  {
    id: "vending-machine",
    emoji: "🥤",
    tone: "neutral",
    when: ({ state }) => state.macro.phase === "inflation" || state.macro.phase === "stagflation",
    run: ({ company }) => {
      company.morale = clamp(company.morale - 1);
      return {
        title: "자판기의 배신",
        body: "자판기 음료값이 또 100원 올랐어요. 직원들이 동전을 세며 한숨을 쉬어요. (직원 행복 −1)\n💡 물가가 오르면 같은 돈으로 살 수 있는 게 줄어요(인플레이션).",
      };
    },
  },
  {
    id: "dance-battle",
    emoji: "💃",
    tone: "positive",
    when: ({ company }) => company.morale >= 70,
    run: ({ company }) => {
      company.morale = clamp(company.morale + 2);
      return {
        title: "점심시간 댄스 배틀",
        body: "직원들이 점심시간에 즉석 댄스 배틀을 열었어요. 우승은 의외로 회계팀! (직원 행복 +2)\n💡 행복한 직원은 물건을 조금 더 많이 만들어요.",
      };
    },
  },
  {
    id: "yawn-relay",
    emoji: "😴",
    tone: "neutral",
    when: ({ company }) => company.morale <= 42,
    run: () => ({
      title: "하품 릴레이",
      body: "회의 중 하품이 한 명에서 열 명까지 줄줄이 이어졌어요.\n💡 직원 행복이 낮으면 일이 잘 안 돼요. 구내식당이나 공원을 지어 볼까요?",
    }),
  },
  {
    id: "helmet-backwards",
    emoji: "⛑️",
    tone: "neutral",
    when: ({ company }) => company.safety < 45,
    run: () => ({
      title: "거꾸로 쓴 안전모",
      body: "안전모를 거꾸로 쓴 직원이 발견됐어요. 본인은 \"요즘 유행\"이래요.\n💡 안전이 낮으면 사고가 날 수 있어요. 안전 점검을 해 볼까요?",
    }),
  },
  {
    id: "quality-tears",
    emoji: "🥹",
    tone: "positive",
    when: ({ company }) => company.quality >= 70,
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 2);
      return {
        title: "감동의 품질 검사",
        body: "품질 검사원이 너무 완벽한 제품을 보고 감동해서 눈물을 흘렸어요. (평판 +2)\n💡 품질이 높으면 더 좋은 상품을 더 비싸게 팔 수 있어요.",
      };
    },
  },
  {
    id: "rival-photo",
    emoji: "📸",
    tone: "positive",
    when: ({ company }) => company.reputation >= 62,
    run: () => ({
      title: "경쟁사 사장님의 몰래 촬영",
      body: "경쟁사 사장님이 선글라스를 끼고 우리 회사 간판 앞에서 몰래 사진을 찍고 갔어요. 따라 하려는 걸까요?\n💡 잘하는 회사는 경쟁사도 배우려고 해요.",
    }),
  },
  {
    id: "full-safe",
    emoji: "🐷",
    tone: "neutral",
    when: ({ company }) => company.cash >= 2_000_000,
    run: () => ({
      title: "금고 문이 안 닫혀요",
      body: "금고에 돈이 너무 많아 문이 안 닫힌대요. 직원 두 명이 엉덩이로 밀어서 겨우 닫았어요.\n💡 돈을 쌓아만 두기보다 건물이나 투자에 쓰면 더 불어날 수도 있어요.",
    }),
  },
  {
    id: "big-campus-navi",
    emoji: "🗺️",
    tone: "positive",
    when: ({ company }) => company.buildings.length >= 12,
    run: () => ({
      title: "택배 기사님의 새 내비게이션",
      body: "캠퍼스가 너무 넓어져서 택배 기사님이 내비게이션을 새로 샀대요. 그래도 한 번은 길을 잃었대요!\n💡 회사가 커지면 관리할 것도 많아져요.",
    }),
  },
  {
    id: "wish-coins",
    emoji: "🪙",
    tone: "positive",
    when: ({ company }) => has(company, "fountain"),
    run: ({ company }) => {
      company.cash += 3_000;
      return {
        title: "분수 속 소원 동전",
        body: "분수에 던진 소원 동전을 모아 보니 3,000원! 직원 간식비로 썼어요. 소원은… 비밀이래요.",
      };
    },
  },
  {
    id: "statue-scarf",
    emoji: "🧣",
    tone: "positive",
    when: ({ company }) => has(company, "statue"),
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 2);
      return {
        title: "드래곤 동상의 목도리",
        body: "누군가 밤사이 드래곤 동상에 알록달록한 목도리를 둘러 줬어요. 인증샷이 SNS에서 인기예요! (평판 +2)",
      };
    },
  },
  {
    id: "rooster-clock",
    emoji: "🐓",
    tone: "positive",
    when: ({ company }) => has(company, "clocktower"),
    run: ({ company }) => {
      company.morale = clamp(company.morale + 1);
      return {
        title: "꼬끼오 시계탑",
        body: "시계탑이 정각에 '땡' 대신 '꼬끼오~' 소리를 냈어요. 고장인 줄 알았는데 직원 깜짝 이벤트였대요! (직원 행복 +1)",
      };
    },
  },
  {
    id: "ferris-top",
    emoji: "🎡",
    tone: "positive",
    when: ({ company }) => has(company, "ferris"),
    run: ({ company }) => {
      company.reputation = clamp(company.reputation + 2);
      return {
        title: "관람차 꼭대기에서 10분",
        body: "관람차가 꼭대기에서 10분 멈췄는데, 손님들이 \"경치 최고!\"라며 오히려 좋아했어요. (평판 +2)",
      };
    },
  },
  {
    id: "kids-portrait",
    emoji: "🎨",
    tone: "positive",
    when: ({ company }) => has(company, "daycare"),
    run: ({ company }) => {
      company.morale = clamp(company.morale + 2);
      return {
        title: "사장님 초상화 선물",
        body: "어린이집 아이들이 사장님 초상화를 그려 줬어요. 코가 엄청 크게 그려졌지만 로비 한가운데 걸었어요! (직원 행복 +2)",
      };
    },
  },
  {
    id: "dragon-sneeze",
    emoji: "🐉",
    tone: "positive",
    weight: 0.6,
    when: () => true,
    run: ({ company }) => {
      company.morale = clamp(company.morale + 1);
      return {
        title: "드래곤의 재채기",
        body: "산 위의 드래곤이 크게 재채기를 해서 회사 깃발이 반대로 펄럭였어요. 다친 사람은 없고 다들 크게 웃었어요! (직원 행복 +1)",
      };
    },
  },
  {
    id: "stock-watcher",
    emoji: "📈",
    tone: "neutral",
    when: ({ state, company }) =>
      isFeatureUnlocked(state, "investment") && Object.values(company.portfolio.stocks).some((shares) => shares > 0),
    run: () => ({
      title: "주식 창만 보는 직원",
      body: "주식을 산 직원이 5분마다 주가를 확인하다가 커피를 키보드에 쏟았어요.\n💡 주가는 매일 오르내려요. 너무 자주 보기보다 길게 지켜보는 게 좋아요.",
    }),
  },
];

/** How likely a joke is on an ordinary turn. */
const FUN_CHANCE = 0.5;

function funRng(state: GameState): RngState {
  return createRng((state.seed ^ Math.imul(state.turn + 17, 0x9e3779b1)) >>> 0);
}

/**
 * Maybe create one 깜짝 소식 for the student's company this turn. The news item
 * is pushed onto state.news and returned (null when nothing happens).
 */
export function generateFunEvent(state: GameState): NewsItem | null {
  const company = state.companies.find((c) => c.id === state.playerCompanyId);
  if (!company) return null;
  const rng = funRng(state);
  const ctx: FunCtx = { state, company, rng };

  const recent = new Set(
    state.news.filter((n) => n.layer === "fun").slice(-4).map((n) => n.tags[1]),
  );
  const candidates = FUN_EVENTS.filter((t) => !recent.has(t.id) && t.when(ctx));
  if (candidates.length === 0) return null;
  const guaranteed = candidates.some((t) => (t.weight ?? 1) >= 100);
  if (!guaranteed && nextFloat(rng) > FUN_CHANCE) return null;

  const total = candidates.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  let roll = nextFloat(rng) * total;
  let template = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    roll -= candidate.weight ?? 1;
    if (roll <= 0) {
      template = candidate;
      break;
    }
  }

  const { title, body } = template.run(ctx);
  const news: NewsItem = {
    id: `fun-${state.turn}-${template.id}`,
    turn: state.turn,
    layer: "fun",
    tone: template.tone,
    title,
    body,
    emoji: template.emoji,
    tags: [company.id, template.id],
  };
  state.news.push(news);
  return news;
}

/** The most recent joke, so people on the campus can gossip about it. */
export function latestFunEvent(state: GameState): NewsItem | null {
  for (let i = state.news.length - 1; i >= 0; i -= 1) {
    const item = state.news[i];
    if (item.layer === "fun") return state.turn - item.turn <= 2 ? item : null;
  }
  return null;
}

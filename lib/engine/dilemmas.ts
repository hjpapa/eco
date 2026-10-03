import type { Company, GameState } from "./types";
import { isFeatureUnlocked } from "./campaign";
import { createRng, nextFloat } from "./rng";
import type { ActionResult } from "./actions";

// 🤔 사장님의 선택 — every few turns the student faces a small two-way choice.
// Both options are reasonable; each one shows what it costs and what it
// changes, and the result explains the trade-off (기회비용). Choices draw from
// their own seed so they never change the market or rivals.

export interface DilemmaOption {
  emoji: string;
  label: string;
  cost: number;
  /** Short effect line shown on the button, e.g. "😊 행복 +10". */
  effect: string;
  apply: (company: Company) => string;
}

export interface DilemmaDef {
  id: string;
  emoji: string;
  title: string;
  body: string;
  lesson: string;
  when: (state: GameState, company: Company) => boolean;
  options: [DilemmaOption, DilemmaOption];
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const has = (c: Company, type: string) => c.buildings.some((b) => b.type === type && b.turnsLeft <= 0);

function scaleStock(c: Company, keep: number): number {
  const before = c.inventory;
  c.inventory = Math.floor(c.inventory * keep);
  if (c.productInventory) c.productInventory = c.productInventory.map((n) => Math.floor(n * keep));
  return before - c.inventory;
}

export const DILEMMAS: DilemmaDef[] = [
  {
    id: "festival",
    emoji: "🎪",
    title: "직원들이 사내 축제를 열자고 해요!",
    body: "\"다 같이 신나게 놀면 힘이 날 것 같아요!\" 축제에는 돈이 들어요.",
    lesson: "돈을 쓰면 얻는 것이 있고, 아끼면 놓치는 것도 있어요. 이것을 '기회비용'이라고 해요.",
    when: () => true,
    options: [
      { emoji: "🎉", label: "축제 열기", cost: 80_000, effect: "😊 행복 +10 · ⭐ 평판 +2", apply: (c) => { c.morale = clamp(c.morale + 10); c.reputation = clamp(c.reputation + 2); return "축제 대성공! 직원들이 신나게 일해요."; } },
      { emoji: "🙅", label: "다음에 하기", cost: 0, effect: "😐 행복 −3", apply: (c) => { c.morale = clamp(c.morale - 3); return "돈은 아꼈지만 직원들이 조금 아쉬워해요."; } },
    ],
  },
  {
    id: "tv-ad",
    emoji: "📺",
    title: "TV 광고를 하자는 제안이 왔어요",
    body: "\"어린이 프로그램 사이에 우리 회사 광고를 내 보는 건 어때요?\"",
    lesson: "광고는 돈이 들지만, 더 많은 사람이 우리 회사를 알게 해 줘요.",
    when: () => true,
    options: [
      { emoji: "📣", label: "광고하기", cost: 150_000, effect: "⭐ 평판 +8", apply: (c) => { c.reputation = clamp(c.reputation + 8); return "광고 노래가 유행했어요! 평판이 올랐어요."; } },
      { emoji: "💰", label: "돈 아끼기", cost: 0, effect: "변화 없음", apply: () => "광고 대신 돈을 아꼈어요." },
    ],
  },
  {
    id: "leaky-roof",
    emoji: "🌧️",
    title: "폭우로 창고 지붕이 샜어요!",
    body: "빗물이 상자 위로 똑똑 떨어지고 있어요. 지금 고칠까요?",
    lesson: "작은 수리비를 아끼다가 더 큰 손해를 볼 수 있어요.",
    when: (_, c) => has(c, "warehouse") && c.inventory >= 50,
    options: [
      { emoji: "🔨", label: "지붕 고치기", cost: 50_000, effect: "📦 재고 지킴", apply: () => "지붕을 고쳐서 상품이 모두 무사해요." },
      { emoji: "🤷", label: "그냥 두기", cost: 0, effect: "📦 재고 20% 젖음", apply: (c) => `상품 ${scaleStock(c, 0.8).toLocaleString()}개가 젖어서 버려야 했어요.` },
    ],
  },
  {
    id: "chef",
    emoji: "🧑‍🍳",
    title: "유명 셰프가 구내식당에서 일하고 싶대요",
    body: "\"제 떡볶이 맛 보시면 깜짝 놀라실 거예요!\"",
    lesson: "직원 복지에 쓰는 돈은 직원 행복과 생산력으로 돌아와요.",
    when: (_, c) => has(c, "cafeteria"),
    options: [
      { emoji: "🤝", label: "모셔 오기", cost: 60_000, effect: "😊 행복 +8", apply: (c) => { c.morale = clamp(c.morale + 8); return "점심시간마다 직원들이 웃어요!"; } },
      { emoji: "🙇", label: "정중히 거절", cost: 0, effect: "변화 없음", apply: () => "셰프님이 아쉬워하며 돌아갔어요." },
    ],
  },
  {
    id: "bad-review",
    emoji: "⭐",
    title: "손님이 '별로예요' 리뷰를 남겼어요",
    body: "\"배달이 늦었어요. 별 한 개!\" 어떻게 할까요?",
    lesson: "평판은 쌓기는 어렵고 잃기는 쉬워요. 빨리 사과하면 믿음을 되찾을 수 있어요.",
    when: (_, c) => c.reputation < 70,
    options: [
      { emoji: "💌", label: "사과하고 선물 보내기", cost: 30_000, effect: "⭐ 평판 +5", apply: (c) => { c.reputation = clamp(c.reputation + 5); return "손님이 '친절해요!'로 리뷰를 바꿨어요."; } },
      { emoji: "🙈", label: "모른 척하기", cost: 0, effect: "⭐ 평판 −3", apply: (c) => { c.reputation = clamp(c.reputation - 3); return "나쁜 리뷰가 퍼졌어요…"; } },
    ],
  },
  {
    id: "machine-noise",
    emoji: "🔧",
    title: "공장 기계에서 '덜컹덜컹' 소리가 나요",
    body: "아직은 돌아가지만 소리가 점점 커지고 있어요.",
    lesson: "안전에 쓰는 돈은 사고를 막는 '보험' 같은 역할을 해요.",
    when: (_, c) => has(c, "factory"),
    options: [
      { emoji: "🛠️", label: "새 부품으로 고치기", cost: 70_000, effect: "🦺 안전 +8", apply: (c) => { c.safety = clamp(c.safety + 8); return "기계가 다시 조용하고 튼튼해졌어요."; } },
      { emoji: "😬", label: "그냥 쓰기", cost: 0, effect: "🦺 안전 −8", apply: (c) => { c.safety = clamp(c.safety - 8); return "덜컹덜컹… 사고가 나지 않게 조심해요!"; } },
    ],
  },
  {
    id: "town-festival",
    emoji: "🏮",
    title: "동네 축제에서 후원을 부탁해요",
    body: "\"축제 현수막에 회사 이름을 크게 넣어 드릴게요!\"",
    lesson: "지역과 함께하면 회사를 좋아하는 이웃이 늘어요.",
    when: () => true,
    options: [
      { emoji: "🎁", label: "후원하기", cost: 40_000, effect: "⭐ 평판 +4 · 😊 행복 +2", apply: (c) => { c.reputation = clamp(c.reputation + 4); c.morale = clamp(c.morale + 2); return "축제 현수막에 우리 회사 이름이 반짝여요!"; } },
      { emoji: "🙏", label: "이번엔 거절", cost: 0, effect: "변화 없음", apply: () => "다음 축제 때 함께하기로 했어요." },
    ],
  },
  {
    id: "idea-contest",
    emoji: "💡",
    title: "신제품 아이디어 공모전을 열까요?",
    body: "직원들이 기발한 아이디어를 잔뜩 갖고 있대요.",
    lesson: "연구와 아이디어에 쓰는 돈은 더 좋은 상품(품질)으로 돌아와요.",
    when: (state) => isFeatureUnlocked(state, "research"),
    options: [
      { emoji: "🏆", label: "공모전 열기", cost: 50_000, effect: "🔬 품질 +4", apply: (c) => { c.quality = clamp(c.quality + 4); return "날아다니는 우산 아이디어가 1등! 품질이 올랐어요."; } },
      { emoji: "📅", label: "다음에", cost: 0, effect: "변화 없음", apply: () => "아이디어 노트는 잘 보관해 뒀어요." },
    ],
  },
  {
    id: "noise-complaint",
    emoji: "🔊",
    title: "이웃이 공장 소리가 시끄럽대요",
    body: "\"밤에 아기가 잠을 못 자요!\"",
    lesson: "회사는 이웃과 함께 사는 '좋은 이웃'이 되어야 오래 사랑받아요.",
    when: (_, c) => c.buildings.filter((b) => b.type === "factory").length >= 2,
    options: [
      { emoji: "🧱", label: "방음벽 세우기", cost: 60_000, effect: "⭐ 평판 +3", apply: (c) => { c.reputation = clamp(c.reputation + 3); return "조용해졌다며 이웃이 감사 편지를 보냈어요."; } },
      { emoji: "🙉", label: "못 들은 척하기", cost: 0, effect: "⭐ 평판 −4", apply: (c) => { c.reputation = clamp(c.reputation - 4); return "이웃들이 서운해하고 있어요…"; } },
    ],
  },
  {
    id: "clearance",
    emoji: "🏷️",
    title: "창고의 재고를 반값 세일할까요?",
    body: "안 팔린 상품이 창고에 가득해요. 반값이면 금방 팔릴 거래요.",
    lesson: "안 팔리는 재고는 싸게라도 팔아 현금으로 바꾸는 게 나을 때가 있어요.",
    when: (_, c) => c.inventory >= 200,
    options: [
      {
        emoji: "🛒",
        label: "반값 세일하기",
        cost: 0,
        effect: "📦 재고 절반 → 💰 현금",
        apply: (c) => {
          const price = Math.max(1, (c.productPrices?.[0] ?? 50) / 2);
          const sold = scaleStock(c, 0.5);
          const cash = Math.round(sold * price);
          c.cash += cash;
          return `재고 ${sold.toLocaleString()}개를 팔아 ${cash.toLocaleString()}원을 벌었어요!`;
        },
      },
      { emoji: "⏳", label: "제값 받을 때까지 기다리기", cost: 0, effect: "변화 없음", apply: () => "재고는 창고에서 손님을 기다려요." },
    ],
  },
  {
    id: "donation",
    emoji: "🎁",
    title: "어린이 병원에 우리 상품을 기부할까요?",
    body: "병원에 있는 친구들이 우리 상품을 좋아한대요.",
    lesson: "나누는 일도 회사가 사회에서 사랑받는 방법이에요.",
    when: () => true,
    options: [
      { emoji: "💝", label: "기부하기", cost: 30_000, effect: "⭐ 평판 +5 · 😊 행복 +3", apply: (c) => { c.reputation = clamp(c.reputation + 5); c.morale = clamp(c.morale + 3); return "병원 친구들이 고맙다는 그림 편지를 보냈어요!"; } },
      { emoji: "📅", label: "다음에", cost: 0, effect: "변화 없음", apply: () => "다음 기회에 꼭 함께하기로 했어요." },
    ],
  },
];

const BY_ID = new Map(DILEMMAS.map((d) => [d.id, d]));

export function getDilemma(id: string): DilemmaDef | undefined {
  return BY_ID.get(id);
}

/**
 * Expire an unanswered choice after two turns and, when none is pending,
 * sometimes post a new one that fits the company's situation.
 */
export function updateDilemma(state: GameState): DilemmaDef | null {
  const company = state.companies.find((c) => c.id === state.playerCompanyId);
  if (!company || state.status === "ended") return null;
  if (state.dilemma && state.turn - state.dilemma.postedTurn >= 2) state.dilemma = null;
  if (state.dilemma || state.turn < 2) return null;
  const rng = createRng((state.seed ^ Math.imul(state.turn + 59, 0xc2b2ae35) ^ 0xd11e) >>> 0);
  if (nextFloat(rng) > 0.4) return null;
  const recent = new Set(
    state.news.filter((n) => n.layer === "fun").slice(-6).map((n) => n.tags[1]),
  );
  const choices = DILEMMAS.filter((d) => !recent.has(`dilemma-${d.id}`) && d.when(state, company));
  if (!choices.length) return null;
  const pick = choices[Math.floor(nextFloat(rng) * choices.length)] ?? choices[0];
  state.dilemma = { id: pick.id, postedTurn: state.turn };
  return pick;
}

/** Answer the pending choice with option 0 or 1. */
export function resolveDilemma(state: GameState, optionIndex: number): ActionResult {
  const company = state.companies.find((c) => c.id === state.playerCompanyId);
  const def = state.dilemma ? getDilemma(state.dilemma.id) : undefined;
  const option = def?.options[optionIndex];
  if (!company || !def || !option) return { ok: false, error: "고를 수 있는 선택이 없어요." };
  if (company.cash < option.cost) return { ok: false, error: "돈이 부족해요." };
  company.cash -= option.cost;
  const outcome = option.apply(company);
  state.dilemma = null;
  state.news.push({
    id: `dilemma-${state.turn}-${def.id}`,
    turn: state.turn,
    layer: "fun",
    tone: "neutral",
    emoji: def.emoji,
    title: `사장님의 선택: ${option.label}`,
    body: `${outcome}\n💡 ${def.lesson}`,
    tags: [company.id, `dilemma-${def.id}`],
  });
  return { ok: true, message: `${option.emoji} ${outcome}` };
}

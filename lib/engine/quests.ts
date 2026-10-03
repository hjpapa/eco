import type {
  BuildingType,
  Company,
  GameState,
  Quest,
  QuestReward,
  QuestStats,
} from "./types";
import {
  BUILDING_COMBOS,
  BUILDINGS,
  CITY_STAGES,
  cityScore,
  getActiveBuildingCombos,
  isBuildingTypeUnlocked,
} from "./buildings";
import { estimateDemand, productionCapacity } from "./company";
import { getIndustry } from "../data/industries";
import { getCountry } from "../data/countries";
import { getIndustryProducts } from "../data/products";
import { createRng, nextFloat, type RngState } from "./rng";
import type { ActionResult } from "./actions";
import { withJosa } from "../format";

// 📜 의뢰 게시판 — goals with rewards for the student's company.
//  • Orders: a client wants N units within a few turns. Units come from stock
//    left over after normal market sales, so the student must plan production
//    above market demand (and often build a factory first). Late = small
//    reputation penalty.
//  • City requests: build a kind of building, complete a combination,
//    upgrade, or grow the city to the next stage. No penalty for missing one.
// Requests use their own seed (game seed + turn), so they never change the
// market or rivals.

const ORDER_CLIENTS = [
  { name: "꿈나무 초등학교", emoji: "🏫" },
  { name: "드래곤 종합병원", emoji: "🏥" },
  { name: "우주 탐험대", emoji: "🚀" },
  { name: "무지개 서커스단", emoji: "🎪" },
  { name: "산꼭대기 호텔", emoji: "🏰" },
  { name: "판다 동물원", emoji: "🐼" },
  { name: "어린이 게임 대회 본부", emoji: "🎮" },
  { name: "라면 가게 할머니", emoji: "🍜" },
  { name: "외계인 관광단", emoji: "👽" },
  { name: "공룡 박물관", emoji: "🦖" },
];

const CITY_CLIENTS = [
  { name: "시장님", emoji: "🏛️" },
  { name: "동네 할아버지", emoji: "🧓" },
  { name: "어린이 기자단", emoji: "🧒" },
  { name: "다람쥐 환경 지킴이", emoji: "🐿️" },
  { name: "부엉이 교수님", emoji: "🦉" },
];

const BUILD_REASONS: Partial<Record<BuildingType, string>> = {
  park: "직원과 이웃이 쉴 초록 공원이 필요해요.",
  cafeteria: "직원들이 점심을 먹을 곳이 부족하대요.",
  daycare: "아이를 맡길 곳이 있으면 부모님 직원들이 안심해요.",
  store: "우리 상품을 직접 보고 살 매장이 있으면 좋겠어요.",
  warehouse: "상품을 보관할 창고가 꽉 찼대요.",
  factory: "물건이 모자라서 손님들이 기다리고 있어요.",
  office: "회사 일을 정리할 사무실이 더 필요해요.",
  rnd: "더 좋은 상품을 연구할 곳이 필요해요.",
  power: "전기를 아껴 쓸 발전 시설을 원해요.",
  gym: "직원들이 운동할 곳을 바라고 있어요.",
  clinic: "아플 때 바로 갈 수 있는 의무실이 필요해요.",
  lab: "첨단 연구를 할 연구동이 필요해요.",
  dorm: "회사 가까이 살 집이 있으면 좋겠대요.",
  hr: "새 직원을 뽑고 돌봐 줄 인사센터가 필요해요.",
  fountain: "도시에 시원한 분수 광장이 있으면 좋겠어요.",
  statue: "우리 도시를 대표할 상징물이 필요해요.",
  clocktower: "모두가 볼 수 있는 큰 시계가 있으면 좋겠어요.",
  ferris: "관광객을 부를 대관람차를 꿈꾸고 있어요.",
};

function questRng(state: GameState, salt: number): RngState {
  return createRng((state.seed ^ Math.imul(state.turn + 101, 0x85ebca6b) ^ salt) >>> 0);
}

function pickOne<T>(rng: RngState, items: readonly T[]): T {
  return items[Math.floor(nextFloat(rng) * items.length)] ?? items[0];
}

function stats(state: GameState): QuestStats {
  if (!state.quests) state.quests = [];
  if (!state.questStats) state.questStats = { completed: 0, failed: 0, bigOrders: 0 };
  return state.questStats;
}

function playerOf(state: GameState): Company | undefined {
  return state.companies.find((c) => c.id === state.playerCompanyId);
}

/** Open requests on the board (offered, in progress or ready to claim). */
export function openQuests(state: GameState): Quest[] {
  return (state.quests ?? []).filter((q) => q.status === "offered" || q.status === "active" || q.status === "ready");
}

/** The accepted order still waiting for units, if any. */
export function activeOrder(state: GameState): Quest | null {
  return (state.quests ?? []).find((q) => q.kind === "order" && q.status === "active") ?? null;
}

export function orderRemaining(order: Quest | null): number {
  if (!order) return 0;
  return Math.max(0, (order.units ?? 0) - (order.delivered ?? 0));
}

/** How far a city request has come (0..1) and a short label for the card. */
export function questProgress(state: GameState, quest: Quest): { ratio: number; label: string } {
  const company = playerOf(state);
  if (!company) return { ratio: 0, label: "" };
  switch (quest.kind) {
    case "order": {
      const delivered = quest.delivered ?? 0;
      const units = quest.units ?? 1;
      return { ratio: delivered / units, label: `${delivered.toLocaleString()} / ${units.toLocaleString()}개 배달` };
    }
    case "build": {
      const have = company.buildings.filter((b) => b.type === quest.buildingType && b.turnsLeft <= 0).length;
      const need = (quest.baseline ?? 0) + 1;
      return { ratio: Math.min(1, have / need), label: have >= need ? "완성!" : "아직 안 지었어요" };
    }
    case "combo": {
      const done = getActiveBuildingCombos(company.buildings).some((c) => c.id === quest.comboId);
      return { ratio: done ? 1 : 0, label: done ? "조합 완성!" : "두 건물을 붙여 지어요" };
    }
    case "upgrade": {
      const best = company.buildings.reduce((top, b) => Math.max(top, b.level), 0);
      const target = quest.level ?? 2;
      return { ratio: Math.min(1, best / target), label: `가장 높은 레벨 Lv.${best} / Lv.${target}` };
    }
    case "stage": {
      const score = cityScore(company.buildings);
      const target = quest.cityScore ?? 1;
      return { ratio: Math.min(1, score / target), label: `도시 점수 ${score} / ${target}` };
    }
  }
}

function isMet(state: GameState, quest: Quest): boolean {
  if (quest.kind === "order") return (quest.delivered ?? 0) >= (quest.units ?? 0);
  return questProgress(state, quest).ratio >= 1;
}

/** Mark any city request whose goal is already met as ready to claim. */
export function syncQuestProgress(state: GameState): Quest[] {
  const newlyReady: Quest[] = [];
  for (const quest of state.quests ?? []) {
    if (quest.kind !== "order" && quest.status === "active" && isMet(state, quest)) {
      quest.status = "ready";
      newlyReady.push(quest);
    }
  }
  return newlyReady;
}

export interface OrderDelivery {
  title: string;
  units: number;
  revenue: number;
  completed: boolean;
}

/**
 * Pay for the units the company turn set aside for the accepted order (they
 * ship before market sales). Runs inside advanceTurn right after the
 * student's company turn.
 */
export function deliverOrders(state: GameState, company: Company, shipped: number): OrderDelivery | null {
  const order = activeOrder(state);
  if (!order || company.id !== state.playerCompanyId) return null;
  const units = Math.max(0, Math.min(orderRemaining(order), Math.floor(shipped)));
  if (units > 0) {
    const revenue = Math.round(units * (order.unitPrice ?? 0));
    company.cash += revenue;
    company.lastRevenue += revenue;
    company.lastProfit += revenue;
    if (company.profitHistory.length) company.profitHistory[company.profitHistory.length - 1] += revenue;
    order.delivered = (order.delivered ?? 0) + units;
    const completed = order.delivered >= (order.units ?? 0);
    if (completed) order.status = "ready";
    return { title: order.title, units, revenue, completed };
  }
  return { title: order.title, units: 0, revenue: 0, completed: false };
}

function makeOrder(state: GameState, company: Company, rng: RngState): Quest {
  const industry = getIndustry(company.industryId);
  const product = getIndustryProducts(company.industryId)[0];
  const tierRef = industry.basePrice * (product?.priceRatio ?? 1);
  const capacity = productionCapacity(company, state.config);
  const firstOrder = (state.questStats?.completed ?? 0) === 0 && state.turn <= 1;
  const share = firstOrder ? 0.18 : 0.25 + nextFloat(rng) * 0.2;
  const units = Math.max(100, Math.min(1500, Math.round((capacity * share) / 50) * 50));
  const duration = firstOrder ? 3 : nextFloat(rng) < 0.5 ? 2 : 3;
  const premium = 1.05 + nextFloat(rng) * 0.3;
  const unitPrice = Math.round(tierRef * premium);
  const client = pickOne(rng, ORDER_CLIENTS);
  const bonus = Math.max(10_000, Math.round((units * unitPrice * 0.25) / 1000) * 1000);
  return {
    id: `q-${state.turn}-order`,
    kind: "order",
    status: "offered",
    client: client.name,
    clientEmoji: client.emoji,
    title: `${product?.name ?? "우리 상품"} ${units.toLocaleString()}개 주문`,
    detail: `${duration}턴 안에 ${units.toLocaleString()}개를 개당 ${unitPrice.toLocaleString()}원에 사고 싶대요. 만든 상품 중 주문 몫을 먼저 보내고, 남은 것을 손님에게 팔아요.`,
    postedTurn: state.turn,
    deadlineTurn: state.turn + duration,
    units,
    unitPrice,
    delivered: 0,
    reward: { cash: bonus, reputation: 3 },
  };
}

function makeCityRequest(state: GameState, company: Company, rng: RngState): Quest | null {
  const enabled = state.config.enabledBuildings;
  const options: { weight: number; make: () => Quest | null }[] = [];
  const client = pickOne(rng, CITY_CLIENTS);
  const base = (kind: Quest["kind"], title: string, detail: string, duration: number, reward: QuestReward): Quest => ({
    id: `q-${state.turn}-${kind}`,
    kind,
    status: "active",
    client: client.name,
    clientEmoji: client.emoji,
    title,
    detail,
    postedTurn: state.turn,
    deadlineTurn: state.turn + duration,
    reward,
  });

  const missing = enabled.filter(
    (type) => isBuildingTypeUnlocked(company, type) && !company.buildings.some((b) => b.type === type),
  );
  if (missing.length) {
    options.push({
      weight: 3,
      make: () => {
        const type = pickOne(rng, missing);
        const def = BUILDINGS[type];
        return {
          ...base("build", `${def.emoji} ${def.name} 짓기`, BUILD_REASONS[type] ?? `${withJosa(def.name, "이", "가")} 있으면 좋겠대요.`, 3, {
            cash: Math.round((def.cost * 0.45) / 1000) * 1000,
            reputation: def.landmark ? 5 : 3,
          }),
          buildingType: type,
          baseline: 0,
        };
      },
    });
  }

  const active = new Set(getActiveBuildingCombos(company.buildings).map((c) => c.id));
  const comboChoices = BUILDING_COMBOS.filter(
    (combo) => !active.has(combo.id) && combo.pair.every((type) => enabled.includes(type) && isBuildingTypeUnlocked(company, type)),
  );
  if (comboChoices.length) {
    options.push({
      weight: 2,
      make: () => {
        const combo = pickOne(rng, comboChoices);
        const [a, b] = combo.pair;
        return {
          ...base("combo", `${combo.emoji} ${combo.name} 만들기`, `${withJosa(BUILDINGS[a].name, "과", "와")} ${withJosa(BUILDINGS[b].name, "을", "를")} 상하좌우로 붙여 지어 주세요. ${combo.description}`, 3, {
            cash: 60_000,
            morale: 3,
          }),
          comboId: combo.id,
        };
      },
    });
  }

  const bestLevel = company.buildings.reduce((top, b) => Math.max(top, b.level), 0);
  if (bestLevel < 3) {
    options.push({
      weight: 1.5,
      make: () => ({
        ...base("upgrade", `건물 하나를 Lv.${bestLevel + 1}로 키우기`, "빈 땅을 아끼면서 회사를 키우는 방법이에요. 어떤 건물이든 좋아요.", 3, {
          cash: 50_000,
          reputation: 2,
        }),
        level: bestLevel + 1,
      }),
    });
  }

  const score = cityScore(company.buildings);
  const nextStage = CITY_STAGES.find((stage) => stage.min > score);
  if (nextStage && nextStage.min - score <= 8) {
    options.push({
      weight: 1.5,
      make: () => ({
        ...base("stage", `${nextStage.emoji} ${nextStage.label}로 키우기`, `도시 점수를 ${nextStage.min}점까지 올려 주세요. 건물 레벨 1개 = 1점, 조합 1개 = 2점이에요.`, 5, {
          cash: 80_000 + nextStage.min * 3_000,
          reputation: 4,
        }),
        cityScore: nextStage.min,
      }),
    });
  }

  if (!options.length) return null;
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = nextFloat(rng) * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.make();
  }
  return options[options.length - 1].make();
}

export interface QuestUpdate {
  failed: Quest[];
  expired: Quest[];
  posted: Quest[];
  ready: Quest[];
}

/**
 * Housekeeping after the clock moves: late orders fail, unanswered offers and
 * missed city requests expire, finished goals become claimable, and new
 * requests are posted when a slot is free.
 */
export function updateQuests(state: GameState): QuestUpdate {
  const company = playerOf(state);
  const result: QuestUpdate = { failed: [], expired: [], posted: [], ready: [] };
  if (!company || state.status === "ended") return result;
  const record = stats(state);
  const quests = state.quests!;

  for (const quest of quests) {
    if (quest.status === "offered" && state.turn > quest.postedTurn) {
      quest.status = "failed";
      result.expired.push(quest);
    } else if (quest.kind === "order" && quest.status === "active" && state.turn >= quest.deadlineTurn) {
      quest.status = "failed";
      company.reputation = Math.max(0, company.reputation - 3);
      record.failed += 1;
      result.failed.push(quest);
    } else if (quest.kind !== "order" && quest.status === "active") {
      if (isMet(state, quest)) {
        quest.status = "ready";
        result.ready.push(quest);
      } else if (state.turn >= quest.deadlineTurn) {
        quest.status = "failed";
        result.expired.push(quest);
      }
    }
  }
  // Keep only what is still on the board.
  state.quests = quests.filter((q) => q.status === "offered" || q.status === "active" || q.status === "ready");

  const rng = questRng(state, 0x51ed27);
  const hasOrder = state.quests.some((q) => q.kind === "order");
  const hasCity = state.quests.some((q) => q.kind !== "order");
  if (!hasOrder && (state.turn <= 1 || nextFloat(rng) < 0.7)) {
    const order = makeOrder(state, company, rng);
    state.quests.push(order);
    result.posted.push(order);
  }
  if (!hasCity && (state.turn === 0 || nextFloat(rng) < 0.8)) {
    const request = makeCityRequest(state, company, rng);
    if (request) {
      if (request.kind === "build") request.baseline = company.buildings.filter((b) => b.type === request.buildingType).length;
      state.quests.push(request);
      result.posted.push(request);
    }
  }
  return result;
}

/** Accept an offered order. */
export function acceptQuest(state: GameState, questId: string): ActionResult {
  const quest = (state.quests ?? []).find((q) => q.id === questId);
  if (!quest || quest.status !== "offered") return { ok: false, error: "받을 수 있는 의뢰가 아니에요." };
  quest.status = "active";
  return { ok: true, message: `${quest.clientEmoji} ${quest.client}의 주문을 받았어요! 생산 계획을 늘려 보세요.` };
}

/** Turn down an offered order (no penalty). */
export function declineQuest(state: GameState, questId: string): ActionResult {
  const quest = (state.quests ?? []).find((q) => q.id === questId);
  if (!quest || quest.status !== "offered") return { ok: false, error: "거절할 수 있는 의뢰가 아니에요." };
  state.quests = (state.quests ?? []).filter((q) => q.id !== questId);
  return { ok: true, message: "정중히 거절했어요. 다음 의뢰를 기다려 봐요." };
}

/** Collect the reward of a finished request. */
export function claimQuest(state: GameState, questId: string): ActionResult {
  const company = playerOf(state);
  const quest = (state.quests ?? []).find((q) => q.id === questId);
  if (!company || !quest) return { ok: false, error: "의뢰를 찾을 수 없어요." };
  if (quest.status === "active" && quest.kind !== "order" && isMet(state, quest)) quest.status = "ready";
  if (quest.status !== "ready") return { ok: false, error: "아직 끝나지 않은 의뢰예요." };
  const record = stats(state);
  company.cash += quest.reward.cash;
  if (quest.reward.reputation) company.reputation = Math.min(100, company.reputation + quest.reward.reputation);
  if (quest.reward.morale) company.morale = Math.min(100, company.morale + quest.reward.morale);
  record.completed += 1;
  if (quest.kind === "order" && (quest.units ?? 0) >= 500) record.bigOrders += 1;
  quest.status = "done";
  state.quests = (state.quests ?? []).filter((q) => q.id !== questId);
  return { ok: true, message: `🎁 보상 받기 완료! +${quest.reward.cash.toLocaleString()}원` };
}

/**
 * The smallest sensible production plan that also covers the accepted order:
 * expected market demand plus the units still owed, within capacity.
 */
export function planWithOrder(state: GameState, company: Company): { demand: number; order: number; capacity: number; plan: number } {
  const demand = estimateDemand(
    company,
    getIndustry(company.industryId),
    getCountry(company.countryId),
    state.macro,
    state.config,
  );
  const order = company.id === state.playerCompanyId ? orderRemaining(activeOrder(state)) : 0;
  const capacity = productionCapacity(company, state.config);
  const plan = Math.min(capacity, Math.max(0, Math.round((demand + order - company.inventory) / 10) * 10));
  return { demand, order, capacity, plan };
}

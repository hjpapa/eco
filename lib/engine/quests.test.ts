import { describe, expect, it } from "vitest";
import {
  acceptQuest,
  activeOrder,
  advanceTurn,
  checkAchievements,
  claimQuest,
  createGame,
  findBestBuildingCell,
  openQuests,
  resolveDilemma,
  syncQuestProgress,
  updateQuests,
  type GameState,
} from "./index";
import { buildBuilding } from "./actions";

function game(seed = 4242): GameState {
  return createGame({
    level: "elementary",
    seed,
    playerCompanyName: "의뢰 회사",
    industryId: "tech",
    countryId: "kr",
  });
}

const playerOf = (state: GameState) => state.companies.find((c) => c.id === state.playerCompanyId)!;

describe("📜 의뢰 게시판", () => {
  it("starts every game with an order offer and a city request", () => {
    const quests = openQuests(game());
    expect(quests.some((q) => q.kind === "order" && q.status === "offered")).toBe(true);
    expect(quests.some((q) => q.kind !== "order" && q.status === "active")).toBe(true);
  });

  it("delivers leftover stock to an accepted order and pays a bonus when claimed", () => {
    const state = game();
    const player = playerOf(state);
    const order = openQuests(state).find((q) => q.kind === "order")!;
    expect(acceptQuest(state, order.id).ok).toBe(true);
    // Plenty of stock already waiting in the warehouse.
    player.inventory = 50_000;
    player.productInventory = [50_000, 0, 0, 0];

    const summary = advanceTurn(state);
    expect(summary.orderDelivery?.units).toBe(order.units);
    expect(summary.orderDelivery?.revenue).toBeGreaterThan(0);
    const ready = state.quests!.find((q) => q.id === order.id)!;
    expect(ready.status).toBe("ready");

    const cashBefore = player.cash;
    expect(claimQuest(state, order.id).ok).toBe(true);
    expect(player.cash).toBe(cashBefore + order.reward.cash);
    expect(state.questStats?.completed).toBe(1);
  });

  it("lets an unanswered offer expire and fails a late order with a small penalty", () => {
    const state = game();
    const offer = openQuests(state).find((q) => q.kind === "order")!;
    advanceTurn(state);
    expect(state.quests!.some((q) => q.id === offer.id)).toBe(false);

    const order = state.quests!.find((q) => q.kind === "order")!;
    if (order.status === "offered") acceptQuest(state, order.id);
    const player = playerOf(state);
    player.decisions.productionTarget = 0; // nothing left over to deliver
    const rep = player.reputation;
    let failed = false;
    while (state.turn < order.deadlineTurn) failed = (advanceTurn(state).questUpdate?.failed ?? []).some((q) => q.id === order.id) || failed;
    expect(failed).toBe(true);
    expect(player.reputation).toBeLessThan(rep + 5);
  });

  it("finishes a build request the moment the building is built", () => {
    const state = game();
    const player = playerOf(state);
    state.quests = (state.quests ?? []).filter((q) => q.kind === "order");
    state.quests.push({
      id: "test-build",
      kind: "build",
      status: "active",
      client: "시장님",
      clientEmoji: "🏛️",
      title: "공원 짓기",
      detail: "",
      postedTurn: 0,
      deadlineTurn: 3,
      reward: { cash: 20_000 },
      buildingType: "park",
      baseline: 0,
    });
    const cell = findBestBuildingCell(player, "park", state.config.mapSize)!;
    buildBuilding(state, player, "park", cell.x, cell.y);
    expect(syncQuestProgress(state).map((q) => q.id)).toContain("test-build");
    const cash = player.cash;
    expect(claimQuest(state, "test-build").ok).toBe(true);
    expect(player.cash).toBe(cash + 20_000);
  });

  it("never draws from the main game RNG", () => {
    const state = game();
    state.turn = 4;
    state.quests = [];
    const seed = state.rng.seed;
    updateQuests(state);
    expect(state.rng.seed).toBe(seed);
    expect(activeOrder(state)).toBeNull();
  });
});

describe("🤔 사장님의 선택", () => {
  it("charges the chosen option and refuses when the money is short", () => {
    const state = game();
    const player = playerOf(state);
    state.dilemma = { id: "festival", postedTurn: state.turn };
    player.cash = 10_000;
    expect(resolveDilemma(state, 0).ok).toBe(false);
    player.cash = 500_000;
    const morale = player.morale;
    expect(resolveDilemma(state, 0).ok).toBe(true);
    expect(player.cash).toBe(420_000);
    expect(player.morale).toBeGreaterThan(morale);
    expect(state.dilemma).toBeNull();
  });
});

describe("🏅 업적", () => {
  it("awards a badge once and keeps it", () => {
    const state = game();
    const player = playerOf(state);
    const cell = findBestBuildingCell(player, "store", state.config.mapSize)!;
    buildBuilding(state, player, "store", cell.x, cell.y);
    expect(checkAchievements(state).map((a) => a.id)).toContain("first-building");
    expect(checkAchievements(state).map((a) => a.id)).not.toContain("first-building");
    expect(state.achievements?.filter((a) => a.id === "first-building")).toHaveLength(1);
  });
});

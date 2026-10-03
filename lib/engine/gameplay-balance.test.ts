import { describe, expect, it } from "vitest";
import { runAiTurn } from "./ai";
import {
  advanceTurn,
  buildingConstructionCost,
  createGame,
  evaluateBuildingPlacement,
  findBestBuildingCell,
  rankings,
  type GameState,
} from "./index";

function game(seed = 4401): GameState {
  return createGame({
    level: "elementary",
    seed,
    playerCompanyName: "어린이 경제 회사",
    industryId: "tech",
    countryId: "kr",
    revealMode: "all",
    gameLength: 50,
  });
}

describe("strategic campus building", () => {
  it("recommends a cell that creates a useful combination", () => {
    const state = game();
    const player = state.companies.find((company) => company.isPlayer)!;
    const best = findBestBuildingCell(player, "warehouse", state.config.mapSize);

    expect(best).not.toBeNull();
    expect(best?.combos.map((combo) => combo.id)).toContain("make-and-move");
    expect(best?.score).toBeGreaterThan(3);
  });

  it("charges a small repetition premium to reward variety", () => {
    const state = game();
    const player = state.companies.find((company) => company.isPlayer)!;
    const firstStoreCost = buildingConstructionCost(player, "store");
    player.buildings.push({ id: "store-test", type: "store", level: 1, x: 0, y: 0, turnsLeft: 0 });
    const secondStoreCost = buildingConstructionCost(player, "store");

    expect(secondStoreCost).toBeGreaterThan(firstStoreCost);
    expect(secondStoreCost).toBe(Math.round(firstStoreCost * 1.12));
  });

  it("explains every combination created by a placement", () => {
    const state = game();
    const player = state.companies.find((company) => company.isPlayer)!;
    const factory = player.buildings.find((building) => building.type === "factory")!;
    player.buildings.push({ id: "store-test", type: "store", level: 1, x: factory.x, y: factory.y + 2, turnsLeft: 0 });
    const placement = evaluateBuildingPlacement(player, "warehouse", factory.x, factory.y + 1, state.config.mapSize);

    expect(placement.combos.map((combo) => combo.id).sort()).toEqual([
      "make-and-move",
      "quick-store",
    ]);
  });
});

describe("competitive and recoverable management", () => {
  it("makes a rival invest harder when the player pulls far ahead", () => {
    const chasing = game(9876);
    const cruising = structuredClone(chasing);
    const chasingPlayer = chasing.companies.find((company) => company.isPlayer)!;
    const cruisingPlayer = cruising.companies.find((company) => company.isPlayer)!;
    const chasingAi = chasing.companies.find((company) => company.isAI)!;
    const cruisingAi = cruising.companies.find((company) => company.id === chasingAi.id)!;
    chasingPlayer.cash += 50_000_000;
    cruisingPlayer.cash = 0;
    chasingAi.lastRevenue = cruisingAi.lastRevenue = 1_000_000;
    chasingAi.cash = cruisingAi.cash = 2_000_000;

    runAiTurn(chasing, chasingAi);
    runAiTurn(cruising, cruisingAi);

    expect(chasingAi.decisions.marketingBudget).toBeGreaterThan(
      cruisingAi.decisions.marketingBudget,
    );
  });

  it("shows a concrete rescue plan exactly after a struggling turn 10", () => {
    const state = game();
    const player = state.companies.find((company) => company.isPlayer)!;
    state.turn = 9;
    player.cash = 20_000;
    player.debt = 550_000;
    player.inventory = 5_000;
    player.profitHistory = [-80_000, -90_000, -100_000];
    player.productInventory = [5_000, 0, 0, 0];
    player.productPrices[0] = 1;
    player.decisions.productionTarget = 700;

    const summary = advanceTurn(state);

    expect(summary.turn).toBe(10);
    expect(summary.recoveryPlan?.title).toContain("10턴");
    expect(summary.recoveryPlan?.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("can end in an explained failure after repeated disastrous decisions", () => {
    const state = game(555);
    const player = state.companies.find((company) => company.isPlayer)!;
    player.productPrices[0] = 1;
    player.decisions.productionTarget = 700;
    player.decisions.marketingBudget = 300_000;
    player.decisions.rndBudget = 300_000;
    player.decisions.welfareBudget = 200_000;
    player.decisions.safetyBudget = 200_000;

    let turnTenPlan = false;
    while (state.status === "playing") {
      const summary = advanceTurn(state);
      if (summary.turn === 10) turnTenPlan = Boolean(summary.recoveryPlan);
    }

    expect(turnTenPlan).toBe(true);
    expect(state.turn).toBeGreaterThanOrEqual(13);
    expect(state.turn).toBeLessThan(state.maxTurns);
    expect(state.endReason).toBe("insolvent");
    expect(rankings(state)[0].isPlayer).toBe(false);
  });
});

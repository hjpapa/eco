import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  BUILDINGS,
  cashSafetyLine,
  cityScore,
  createGame,
  estimateBuildingImpact,
  estimateDemand,
  estimateUpgradeImpact,
  executiveSlots,
  findBestBuildingCell,
  isBuildingTypeUnlocked,
  migrateGameState,
  netWorth,
  productionCapacity,
  productMix,
  rankings,
  type BuildingType,
  type Company,
  type GameState,
} from "./index";
import { buildBuilding } from "./actions";
import { runAiTurn } from "./ai";
import { getIndustry } from "../data/industries";
import { getCountry } from "../data/countries";
import { getIndustryProducts } from "../data/products";

function game(overrides: Partial<Parameters<typeof createGame>[0]> = {}): GameState {
  return createGame({
    level: "elementary",
    seed: 777,
    playerCompanyName: "건물 교실",
    industryId: "tech",
    countryId: "kr",
    ...overrides,
  });
}

function playerOf(state: GameState): Company {
  return state.companies.find((company) => company.id === state.playerCompanyId)!;
}

function buildAt(state: GameState, company: Company, type: BuildingType) {
  const cell = findBestBuildingCell(company, type, state.config.mapSize)!;
  return buildBuilding(state, company, type, cell.x, cell.y);
}

function demandOf(state: GameState, company: Company): number {
  return estimateDemand(
    company,
    getIndustry(company.industryId),
    getCountry(company.countryId),
    state.macro,
    state.config,
  );
}

describe("campus construction", () => {
  it("opens construction from the very first turn", () => {
    const state = game();
    expect(buildAt(state, playerOf(state), "store").ok).toBe(true);
  });

  it("starts every campus in the middle with a plan the factory can make", () => {
    const state = game({ mapSize: 8 });
    const player = playerOf(state);
    expect(player.buildings.map(({ type, x, y }) => ({ type, x, y }))).toEqual([
      { type: "factory", x: 3, y: 3 },
      { type: "office", x: 4, y: 3 },
    ]);
    expect(player.decisions.productionTarget).toBeLessThanOrEqual(
      productionCapacity(player, state.config),
    );
  });

  it("keeps building ids unique after a save is reloaded", () => {
    const state = game();
    const player = playerOf(state);
    buildAt(state, player, "store");
    const reloaded = migrateGameState(JSON.parse(JSON.stringify(state)))!;
    const reloadedPlayer = playerOf(reloaded);
    buildAt(reloaded, reloadedPlayer, "park");
    buildAt(reloaded, reloadedPlayer, "cafeteria");

    const ids = reloadedPlayer.buildings.map((building) => building.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("repairs duplicate building ids that older builds saved", () => {
    const state = game();
    const player = playerOf(state);
    player.buildings.push(
      { id: "b-0", type: "park", level: 1, x: 0, y: 0, turnsLeft: 0 },
      { id: "b-0", type: "store", level: 1, x: 1, y: 0, turnsLeft: 0 },
    );
    const ids = playerOf(migrateGameState(JSON.parse(JSON.stringify(state)))!).buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("raises a maxed-out production plan when a new factory adds room", () => {
    const state = game();
    const player = playerOf(state);
    const before = player.decisions.productionTarget;
    const result = buildAt(state, player, "factory");

    expect(result.ok).toBe(true);
    expect(player.decisions.productionTarget).toBeGreaterThan(before);
    expect(player.decisions.productionTarget).toBeLessThanOrEqual(productionCapacity(player, state.config));
    expect(result.message).toContain("생산 계획");
  });
});

describe("city growth unlocks", () => {
  it("opens landmarks only after the city grows", () => {
    const state = game();
    const player = playerOf(state);
    player.cash = 10_000_000;
    expect(isBuildingTypeUnlocked(player, "fountain")).toBe(false);
    const cell = findBestBuildingCell(player, "fountain", state.config.mapSize)!;
    expect(buildBuilding(state, player, "fountain", cell.x, cell.y).ok).toBe(false);

    for (const type of ["store", "warehouse", "park"] as BuildingType[]) buildAt(state, player, type);
    expect(cityScore(player.buildings)).toBeGreaterThanOrEqual(BUILDINGS.fountain.unlockCityScore!);
    expect(buildAt(state, player, "fountain").ok).toBe(true);
  });

  it("never lets a rival build something its city has not unlocked", () => {
    const state = game({ revealMode: "all" });
    while (state.turn < 20) advanceTurn(state);
    for (const company of state.companies.filter((c) => c.isAI)) {
      for (const building of company.buildings) {
        expect(BUILDINGS[building.type].landmark).toBeFalsy();
      }
    }
  });
});

describe("what buildings really do", () => {
  it("lets stores and warehouses bring customers without an ad budget", () => {
    const state = game();
    const player = playerOf(state);
    player.decisions.marketingBudget = 0;
    const baseline = demandOf(state, player);
    buildAt(state, player, "store");
    const withStore = demandOf(state, player);
    buildAt(state, player, "warehouse");

    expect(withStore).toBeGreaterThan(baseline);
    expect(demandOf(state, player)).toBeGreaterThan(withStore);
  });

  it("turns happier staff into a little more production", () => {
    const state = game();
    const player = playerOf(state);
    player.morale = 20;
    const gloomy = productionCapacity(player, state.config);
    player.morale = 90;
    expect(productionCapacity(player, state.config)).toBeGreaterThan(gloomy);
  });

  it("adds executive seats for offices and childcare", () => {
    const state = game();
    const player = playerOf(state);
    const before = executiveSlots(player, true);
    player.buildings.push(
      { id: "dc", type: "daycare", level: 2, x: 0, y: 0, turnsLeft: 0 },
      { id: "of", type: "office", level: 3, x: 0, y: 1, turnsLeft: 0 },
    );
    expect(executiveSlots(player, true)).toBeGreaterThan(before);
  });

  it("charges more to make premium products than basic ones", () => {
    const state = game();
    const player = playerOf(state);
    const industry = getIndustry(player.industryId);
    const basic = productMix(player, industry).costFactor;
    player.quality = 80;
    player.productEnabled = getIndustryProducts(player.industryId).map(() => true);
    player.rndUnlockDone = true;
    expect(productMix(player, industry).costFactor).toBeGreaterThan(basic);
  });

  it("does not scare away customers when a fairly priced premium line is added", () => {
    const state = game();
    const player = playerOf(state);
    player.quality = 40;
    const basicOnly = demandOf(state, player);
    const products = getIndustryProducts(player.industryId);
    const industry = getIndustry(player.industryId);
    player.productEnabled = products.map((_, index) => index < 2);
    player.productPrices = products.map((def) => Math.round(industry.basePrice * def.priceRatio));
    expect(demandOf(state, player)).toBeGreaterThanOrEqual(basicOnly * 0.95);
  });
});

describe("build preview", () => {
  it("shows a payback time for a factory that removes a bottleneck", () => {
    const state = game();
    const player = playerOf(state);
    const impact = estimateBuildingImpact(state, player, "factory")!;

    expect(impact.before.limitedBy).toBe("capacity");
    expect(impact.gains.capacity).toBeGreaterThan(0);
    expect(impact.profitDelta).toBeGreaterThan(0);
    expect(impact.paybackTurns).not.toBeNull();
    expect(impact.cashAfter).toBe(player.cash - impact.cost);
  });

  it("explains a park through happiness instead of money", () => {
    const state = game();
    const impact = estimateBuildingImpact(state, playerOf(state), "park")!;
    expect(impact.gains.morale).toBeGreaterThan(0);
    expect(impact.upkeepDelta).toBe(BUILDINGS.park.upkeep);
  });

  it("warns before spending below the cash safety line", () => {
    const state = game();
    const player = playerOf(state);
    player.cash = cashSafetyLine(player) + 50_000;
    expect(estimateBuildingImpact(state, player, "factory")!.belowSafetyLine).toBe(true);
  });

  it("previews an upgrade without changing the campus", () => {
    const state = game();
    const player = playerOf(state);
    const factory = player.buildings.find((b) => b.type === "factory")!;
    const before = JSON.stringify(player);
    const impact = estimateUpgradeImpact(state, player, factory.id)!;
    expect(impact.gains.capacity).toBeGreaterThan(0);
    expect(JSON.stringify(player)).toBe(before);
  });
});

describe("rivals and balance", () => {
  it("lets AI pricing decisions reach the products it sells", () => {
    const state = game();
    const ai = state.companies.find((company) => company.isAI)!;
    const defaults = [...ai.productPrices];
    runAiTurn(state, ai);
    expect(ai.productPrices).not.toEqual(defaults);
  });

  it("does not hand first place to a student who never plays", () => {
    for (const seed of [777, 31]) {
      const state = game({ seed, gameLength: 20 });
      while (state.status === "playing") advanceTurn(state);
      expect(rankings(state)[0].isPlayer).toBe(false);
    }
  });

  it("survives a first-turn building spree without bankruptcy", () => {
    const state = game({ gameLength: 20 });
    const player = playerOf(state);
    for (const type of state.config.enabledBuildings) buildAt(state, player, type);
    while (state.status === "playing") advanceTurn(state);
    expect(state.endReason).toBe("completed");
  });

  it("rewards a student who builds with the preview over one who waits", () => {
    const idle = game({ gameLength: 20 });
    const builder = game({ gameLength: 20 });
    const builderPlayer = playerOf(builder);
    while (builder.status === "playing") {
      for (const type of ["factory", "store", "warehouse"] as BuildingType[]) {
        const impact = estimateBuildingImpact(builder, builderPlayer, type);
        if (impact && !impact.belowSafetyLine && impact.profitDelta > 0) {
          buildBuilding(builder, builderPlayer, type, impact.x, impact.y);
          break;
        }
      }
      advanceTurn(builder);
    }
    while (idle.status === "playing") advanceTurn(idle);

    expect(netWorth(builderPlayer, builder)).toBeGreaterThan(netWorth(playerOf(idle), idle));
  });
});

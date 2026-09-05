import { describe, expect, it } from "vitest";
import { aggregateBuildingCaps } from "./buildings";
import {
  createGame,
  netWorth,
  repayLoan,
  takeLoan,
  type BuildingType,
  type PlacedBuilding,
} from "./index";

function placedBuilding(
  id: string,
  type: BuildingType,
  x: number,
  y: number,
): PlacedBuilding {
  return { id, type, level: 1, x, y, turnsLeft: 0 };
}

describe("economy concepts", () => {
  it("rewards complementary buildings only when they are next to each other", () => {
    const adjacent = [
      placedBuilding("store", "store", 0, 0),
      placedBuilding("office", "office", 1, 0),
    ];
    const separated = [
      placedBuilding("store", "store", 0, 0),
      placedBuilding("office", "office", 3, 3),
    ];

    const adjacentCaps = aggregateBuildingCaps(adjacent, true);
    const separatedCaps = aggregateBuildingCaps(separated, true);

    expect(adjacentCaps.marketingReach).toBeGreaterThan(separatedCaps.marketingReach);
    expect(adjacentCaps.marketingReach - separatedCaps.marketingReach).toBeCloseTo(10, 8);
    expect(adjacentCaps.reputation - separatedCaps.reputation).toBeCloseTo(2, 8);
    expect(aggregateBuildingCaps(adjacent, false)).toEqual(
      aggregateBuildingCaps(separated, false),
    );
  });

  it("does not turn borrowed money into net-worth growth", () => {
    const state = createGame({
      level: "elementary",
      seed: 2026,
      playerCompanyName: "경제 교실",
      industryId: "tech",
      countryId: "kr",
      revealMode: "all",
    });
    const player = state.companies.find(
      (company) => company.id === state.playerCompanyId,
    );
    if (!player) throw new Error("player company was not created");

    const borrowed = 250_000;
    const cashBefore = player.cash;
    const debtBefore = player.debt;
    const netWorthBefore = netWorth(player, state);

    expect(takeLoan(state, player, borrowed)).toMatchObject({ ok: true });
    expect(player.cash).toBe(cashBefore + borrowed);
    expect(player.debt).toBe(debtBefore + borrowed);
    expect(netWorth(player, state)).toBeCloseTo(netWorthBefore, 8);

    expect(repayLoan(state, player, borrowed)).toMatchObject({ ok: true });
    expect(player.cash).toBe(cashBefore);
    expect(player.debt).toBe(debtBefore);
    expect(netWorth(player, state)).toBeCloseTo(netWorthBefore, 8);
  });
});

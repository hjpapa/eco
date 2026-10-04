import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  BUILDINGS,
  buildingConstructionCost,
  cashSafetyLine,
  createGame,
  currentSeason,
  findBestBuildingCell,
  getCampaignOutcome,
  isBuildingTypeUnlocked,
  planWithOrder,
  productionCapacity,
  villageStats,
  VILLAGE_BUILDINGS,
  type BuildingType,
  type GameLength,
  type GameState,
  type Level,
} from "./index";
import { buildBuilding } from "./actions";

describe("전체 난이도·기간 게임 종료 점검", () => {
  for (const level of ["elementary", "middle", "university"] as Level[]) {
    for (const gameLength of [20, 50, 100] as GameLength[]) {
      it(`${level} ${gameLength}턴: 종료까지 수치와 지도 상태가 유효하다`, () => {
        for (const seed of [42, 20261004]) {
          const game = createGame({ level, gameLength, seed, playerCompanyName: "검증회사", industryId: "food", countryId: "kr" });
          while (game.status === "playing") {
            advanceTurn(game);
            expect(game.turn).toBeLessThanOrEqual(gameLength);
            for (const company of game.companies) {
              for (const value of [company.cash, company.inventory, company.quality, company.morale, company.safety, company.reputation]) expect(Number.isFinite(value)).toBe(true);
              const occupied = company.buildings.map(b => `${b.x},${b.y}`);
              expect(new Set(occupied).size).toBe(occupied.length);
              expect(new Set(company.buildings.map(b => b.id)).size).toBe(company.buildings.length);
              for (const building of company.buildings) {
                expect(building.x).toBeGreaterThanOrEqual(0); expect(building.x).toBeLessThan(game.config.mapSize);
                expect(building.y).toBeGreaterThanOrEqual(0); expect(building.y).toBeLessThan(game.config.mapSize);
                expect(building.turnsLeft).toBeGreaterThanOrEqual(0);
              }
            }
          }
          expect(Number.isFinite(getCampaignOutcome(game).finalNetWorth)).toBe(true);
          expect(["completed", "insolvent"]).toContain(game.endReason);
        }
      }, 30_000); // two full 100-turn games take a few seconds on a busy machine
    }
  }
});

/**
 * A careful student: plans production with "딱 맞게", and every other turn
 * builds one thing the village asks for, keeping the emergency fund.
 */
function carefulStudentTurn(state: GameState) {
  const p = state.companies.find((c) => c.id === state.playerCompanyId)!;
  p.decisions.productionTarget = planWithOrder(state, p).plan;
  if (state.turn % 2 !== 0) return;
  const v = villageStats(p.buildings);
  const want: BuildingType[] = [];
  if (v.demand.home >= 67) want.push("house");
  if (v.demand.shop >= 67) want.push("store", "cafeteria");
  if (v.demand.job >= 67) want.push("factory", "office");
  if (v.happiness < 60) want.push("park");
  if (productionCapacity(p, state.config) < planWithOrder(state, p).demand) want.push("factory");
  want.push("house", "flowerbed");
  for (const type of want) {
    const def = BUILDINGS[type];
    if (def.season && def.season !== currentSeason(state.macro)) continue;
    if (!state.config.enabledBuildings.includes(type) || !isBuildingTypeUnlocked(p, type)) continue;
    const cost = buildingConstructionCost(p, type);
    if (p.cash - cost < cashSafetyLine(p) + 50_000) continue;
    const cell = findBestBuildingCell(p, type, state.config.mapSize);
    if (cell && buildBuilding(state, p, type, cell.x, cell.y).ok) break;
  }
}

// Target ranges, measured with this bot on 2026-10-04 (seeds 11/42/777/2026,
// elementary, guided reveal): nobody went bankrupt; residents reached
// 38 (20 turns), 72–80 (50) and 96–104 (100); stars 3 in every run (★4 needs
// eight kinds of building, which this bot never builds — real players do);
// named neighbours 6 / 12 / 12; happiness 87–100. The floors below leave
// room for balance tweaks while catching a village that stops growing.
const VILLAGE_FLOORS: Record<GameLength, { population: number; stars: number; neighbours: number }> = {
  20: { population: 25, stars: 2, neighbours: 3 },
  50: { population: 50, stars: 3, neighbours: 8 },
  100: { population: 70, stars: 3, neighbours: 10 },
};

describe("학생 봇으로 마을 밸런스 점검", () => {
  for (const gameLength of [20, 50, 100] as GameLength[]) {
    it(`${gameLength}턴: 파산 없이 마을이 자라고, 별과 이웃이 목표 범위 안이다`, () => {
      for (const seed of [11, 2026]) {
        const game = createGame({ level: "elementary", gameLength, seed, playerCompanyName: "봇회사", industryId: "food", countryId: "kr" });
        while (game.status === "playing") {
          carefulStudentTurn(game);
          advanceTurn(game);
        }
        const p = game.companies.find((c) => c.id === game.playerCompanyId)!;
        const v = villageStats(p.buildings);
        const floor = VILLAGE_FLOORS[gameLength];
        expect(game.endReason).toBe("completed");
        expect(v.population).toBeGreaterThanOrEqual(floor.population);
        expect(v.population).toBeLessThanOrEqual(v.housing);
        expect(v.stars).toBeGreaterThanOrEqual(floor.stars);
        expect((game.residents ?? []).length).toBeGreaterThanOrEqual(floor.neighbours);
        expect(v.happiness).toBeGreaterThanOrEqual(50);
        expect(v.happiness).toBeLessThanOrEqual(100);
        // Rivals never build homes or decorations.
        for (const rival of game.companies.filter((c) => !c.isPlayer)) {
          expect(rival.buildings.some((b) => VILLAGE_BUILDINGS.includes(b.type))).toBe(false);
        }
      }
    }, 60_000);
  }
});

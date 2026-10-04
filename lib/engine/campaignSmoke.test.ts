import { describe, expect, it } from "vitest";
import { advanceTurn, createGame, getCampaignOutcome, type GameLength, type Level } from "./index";

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

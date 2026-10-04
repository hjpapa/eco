import { describe, expect, it } from "vitest";
import { advanceTurn, createGame } from "./index";
import { buildBuilding, sellBuilding, upgradeBuilding } from "./actions";
import { loadGameFromStorage, saveGameToStorage } from "../gamePersistence";

const setup = () => {
  const game = createGame({ level: "elementary", seed: 9124, playerCompanyName: "지도검증", industryId: "food", countryId: "kr" });
  const company = game.companies.find(c => c.id === game.playerCompanyId)!;
  company.cash = 10_000_000;
  return { game, company };
};
describe("건설부터 저장·업그레이드·철거까지", () => {
  it("지도 좌표·종류·레벨·공사 상태가 저장 후에도 유지된다", () => {
    const { game, company } = setup(); game.config.instantBuild = false;
    const result = buildBuilding(game, company, "store", 0, 0);
    expect(result.ok).toBe(true); expect(result.message).toContain("공사 시작");
    const building = company.buildings.find(b => b.x === 0 && b.y === 0)!;
    expect(building.turnsLeft).toBeGreaterThan(0);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveGameToStorage(storage, game)).toBe(true);
    const restored = loadGameFromStorage(storage)!.game;
    expect(restored.companies.find(c => c.id === game.playerCompanyId)!.buildings.find(b => b.id === building.id)).toEqual(building);
    const turns = building.turnsLeft;
    for (let i = 0; i < turns; i++) advanceTurn(game);
    expect(building.turnsLeft).toBe(0);
    expect(upgradeBuilding(game, company, building.id).ok).toBe(true);
    expect(building.level).toBe(2);
    expect(sellBuilding(game, company, building.id).ok).toBe(true);
    expect(company.buildings.some(b => b.id === building.id)).toBe(false);
  });
  it("중복 건설과 잘못된 좌표에서는 돈이 줄지 않는다", () => {
    const { game, company } = setup();
    const occupied = company.buildings[0]; const cash = company.cash;
    expect(buildBuilding(game, company, "store", occupied.x, occupied.y).ok).toBe(false);
    for (const x of [-1, 0.5, NaN, Infinity, game.config.mapSize]) expect(buildBuilding(game, company, "store", x, 0).ok).toBe(false);
    expect(company.cash).toBe(cash);
  });
});

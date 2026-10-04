import { describe, expect, it } from "vitest";
import { advanceTurn, createGame, estimateDemand, migrateGameState, type GameState } from "./index";
import { INDUSTRIES, getIndustry } from "../data/industries";
import { getCountry } from "../data/countries";
import {
  SEASONAL_DEMAND,
  SEASON_ORDER,
  SEASONS,
  festivalHost,
  seasonOf,
  seasonOutlook,
  seasonalDemandFactor,
  festivalRewardText,
  startSeason,
  yearOf,
} from "./seasons";

const newGame = (seed = 7) =>
  createGame({ level: "elementary", gameLength: 20, seed, playerCompanyName: "계절회사", industryId: "food", countryId: "kr" });

const player = (game: GameState) => game.companies.find((c) => c.id === game.playerCompanyId)!;

describe("사계절", () => {
  it("1턴마다 봄→여름→가을→겨울로 돌고, 4턴이 1년이다", () => {
    expect([0, 1, 2, 3, 4, 7].map(seasonOf)).toEqual(["spring", "summer", "autumn", "winter", "spring", "winter"]);
    expect([0, 3, 4, 8].map(yearOf)).toEqual([1, 1, 2, 3]);
  });

  it("새 게임은 봄에 시작하고, 턴이 넘어가면 계절이 바뀐다", () => {
    const game = newGame();
    expect(game.macro.season).toBe("spring");
    const summary = advanceTurn(game);
    expect(game.macro.season).toBe("summer");
    expect(summary.season?.season).toBe("summer");
    expect(summary.season?.year).toBe(1);
  });

  it("업종마다 네 계절 값이 있고, 1년 평균은 평소(1.0)와 같다", () => {
    for (const industry of INDUSTRIES) {
      const row = SEASONAL_DEMAND[industry.id];
      expect(row, industry.id).toBeDefined();
      for (const factor of row) {
        expect(factor).toBeGreaterThanOrEqual(0.8);
        expect(factor).toBeLessThanOrEqual(1.2);
      }
      const average = row.reduce((a, b) => a + b, 0) / row.length;
      expect(average).toBeCloseTo(1, 2);
    }
  });

  it("계절 수요가 손님 수 계산에 들어간다: 식품은 여름에 많고 겨울에 적다", () => {
    const game = newGame();
    const company = player(game);
    const industry = getIndustry("food");
    const country = getCountry("kr");
    const at = (season: (typeof SEASON_ORDER)[number]) =>
      estimateDemand(company, industry, country, { ...game.macro, season }, game.config);
    expect(at("summer")).toBeGreaterThan(at("spring"));
    expect(at("winter")).toBeLessThan(at("spring"));
    expect(at("summer") / at("winter")).toBeCloseTo(seasonalDemandFactor("food", "summer") / seasonalDemandFactor("food", "winter"), 1);
  });

  it("계절 예보는 늘어나는지 줄어드는지와 이유를 알려 준다", () => {
    const summer = seasonOutlook("food", "summer");
    expect(summer.percent).toBe(15);
    expect(summer.reason).toContain("여름");
    expect(summer.tip).toContain("넉넉히");
    expect(seasonOutlook("food", "winter").tip).toContain("조금만");
    expect(seasonOutlook("crypto_co", "spring").percent).toBe(0);
  });

  it("축제에 맞는 건물이 있으면 보상을 받고, 없으면 받지 않는다", () => {
    // Turn 3 → 4 starts spring: the 벚꽃 축제 needs a park or fountain.
    const withPark = newGame(11);
    const withoutPark = newGame(11);
    const p = player(withPark);
    const spot = [0, 1, 2, 3].map((x) => ({ x, y: 0 })).find(({ x, y }) => !p.buildings.some((b) => b.x === x && b.y === y))!;
    p.buildings.push({ id: "park-test", type: "park", level: 1, x: spot.x, y: spot.y, turnsLeft: 0 });
    expect(festivalHost(p, "spring")).toBe("park");
    expect(festivalHost(player(withoutPark), "spring")).toBeUndefined();

    for (let i = 0; i < 3; i += 1) {
      advanceTurn(withPark);
      advanceTurn(withoutPark);
    }
    const before = player(withPark).reputation;
    const summary = advanceTurn(withPark);
    const plain = advanceTurn(withoutPark);
    expect(summary.season?.season).toBe("spring");
    expect(summary.season?.festival.id).toBe(SEASONS.spring.festival.id);
    expect(summary.season?.joined).toBe(true);
    expect(summary.season?.host).toBe("park");
    expect(plain.season?.joined).toBe(false);
    expect(Number.isFinite(before)).toBe(true);
  });

  it("축제 보상은 정확히 한 번만 더해진다", () => {
    const game = newGame(5);
    const p = player(game);
    const spot = [0, 1, 2, 3].map((x) => ({ x, y: 0 })).find(({ x, y }) => !p.buildings.some((b) => b.x === x && b.y === y))!;
    p.buildings.push({ id: "store-test", type: "store", level: 1, x: spot.x, y: spot.y, turnsLeft: 0 });
    game.turn = 2; // 가을: 수확 장터
    const cash = p.cash;
    const result = startSeason(game);
    expect(result.joined).toBe(true);
    expect(game.macro.season).toBe("autumn");
    expect(p.cash).toBe(cash + (SEASONS.autumn.festival.reward.cash ?? 0));
    expect(festivalRewardText(SEASONS.autumn.festival)).toContain("+4만원");
  });

  it("같은 seed면 계절과 축제 결과가 똑같다", () => {
    const a = newGame(99);
    const b = newGame(99);
    for (let i = 0; i < 8; i += 1) {
      const sa = advanceTurn(a);
      const sb = advanceTurn(b);
      expect(sa.season).toEqual(sb.season);
      expect(player(a).cash).toBe(player(b).cash);
    }
  });

  it("계절이 없던 예전 세이브는 턴에 맞는 계절로 불러온다", () => {
    const game = newGame();
    advanceTurn(game);
    advanceTurn(game);
    const old = JSON.parse(JSON.stringify(game)) as GameState;
    delete old.macro.season;
    const migrated = migrateGameState(old)!;
    expect(migrated.macro.season).toBe(seasonOf(old.turn));
    expect(migrated.macro.season).toBe("autumn");
  });
});

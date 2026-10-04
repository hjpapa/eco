import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  createGame,
  estimateDemand,
  evaluateBuildingPlacement,
  isBuildingTypeUnlocked,
  migrateGameState,
  type BuildingType,
  type GameState,
  type PlacedBuilding,
} from "./index";
import { cityScore } from "./buildings";
import { getIndustry } from "../data/industries";
import { getCountry } from "../data/countries";
import {
  STAR_GOALS,
  demandLevel,
  nextStarGoal,
  placementHappiness,
  plotHappiness,
  villageCustomerBoost,
  villageStats,
} from "./village";

let seq = 0;
const at = (type: BuildingType, x: number, y: number, level = 1, turnsLeft = 0): PlacedBuilding => ({
  id: `t${seq++}`,
  type,
  level,
  x,
  y,
  turnsLeft,
});

const newGame = (seed = 3) =>
  createGame({ level: "elementary", gameLength: 20, seed, playerCompanyName: "마을회사", industryId: "food", countryId: "kr" });
const player = (game: GameState) => game.companies.find((c) => c.id === game.playerCompanyId)!;

describe("마을: 주민·일자리·가게", () => {
  it("집이 없으면 주민이 없고, 일자리가 있으면 '집이 필요해요'가 높다", () => {
    const stats = villageStats([at("factory", 0, 0)]);
    expect(stats.housing).toBe(0);
    expect(stats.population).toBe(0);
    expect(stats.jobs).toBe(10);
    expect(demandLevel(stats.demand.home)).toBe("high");
  });

  it("주택 수와 레벨만큼 잠자리가 생기고, 행복할수록 더 많이 이사 온다", () => {
    const two = villageStats([at("house", 0, 0), at("house", 2, 0)]);
    expect(two.housing).toBe(16);
    expect(two.population).toBeGreaterThanOrEqual(10);
    expect(two.population).toBeLessThanOrEqual(16);
    expect(villageStats([at("house", 0, 0, 3)]).housing).toBe(24);
    // Under construction does not count yet.
    expect(villageStats([at("house", 0, 0, 1, 1)]).housing).toBe(0);
  });

  it("주민이 일자리보다 많으면 '일자리', 가게보다 많으면 '가게'가 필요해진다", () => {
    const crowded = villageStats([at("house", 0, 0, 3), at("house", 2, 0, 3), at("house", 4, 0, 3)]);
    expect(demandLevel(crowded.demand.job)).toBe("high");
    expect(demandLevel(crowded.demand.shop)).toBe("high");
    const served = villageStats([at("house", 0, 0), at("store", 2, 2, 2), at("factory", 4, 4)]);
    expect(served.demand.shop).toBeLessThan(crowded.demand.shop);
    expect(served.demand.job).toBeLessThan(crowded.demand.job);
  });
});

describe("마을: 행복 범위", () => {
  it("공원 가까이는 행복하고, 공장 바로 옆은 시끄럽다", () => {
    const buildings = [at("park", 2, 2), at("factory", 6, 6)];
    expect(plotHappiness(buildings, 3, 3)).toBeGreaterThan(0); // next to the park
    expect(plotHappiness(buildings, 4, 4)).toBeGreaterThan(0); // two plots away, still in range
    expect(plotHappiness(buildings, 5, 5)).toBeLessThan(0); // next to the factory
    expect(plotHappiness(buildings, 0, 6)).toBe(0); // far from both
  });

  it("공원 옆 집이 공장 옆 집보다 마을 행복이 높다", () => {
    const nearPark = villageStats([at("house", 1, 1), at("park", 2, 1), at("factory", 6, 6)]);
    const nearFactory = villageStats([at("house", 5, 6), at("park", 0, 0), at("factory", 6, 6)]);
    expect(nearPark.happiness).toBeGreaterThan(nearFactory.happiness);
    expect(nearPark.neighbourhood).toBeGreaterThan(0);
    expect(nearFactory.neighbourhood).toBeLessThan(0);
  });

  it("추천 칸은 주택을 공원 옆에, 공장을 집에서 먼 곳에 둔다", () => {
    const game = newGame();
    const company = player(game);
    company.buildings = [at("park", 4, 4), at("house", 0, 7)];
    expect(placementHappiness(company.buildings, "house", 4, 5)).toBeGreaterThan(0);
    expect(placementHappiness(company.buildings, "factory", 1, 7)).toBeLessThan(0);
    const nearPark = evaluateBuildingPlacement(company, "house", 4, 5, game.config.mapSize);
    const lonely = evaluateBuildingPlacement(company, "house", 7, 0, game.config.mapSize);
    expect(nearPark.score).toBeGreaterThan(lonely.score);
  });
});

describe("마을 별점", () => {
  it("처음엔 별 1개이고, 주민 10명이면 별 2개", () => {
    expect(villageStats([at("factory", 0, 0)]).stars).toBe(1);
    expect(villageStats([at("factory", 0, 0), at("house", 2, 2), at("house", 4, 4)]).stars).toBe(2);
  });

  it("다음 별까지 무엇이 모자란지 알려 준다", () => {
    const stats = villageStats([at("factory", 0, 0), at("house", 2, 2), at("house", 4, 4)]);
    const next = nextStarGoal(stats)!;
    expect(next.stars).toBe(3);
    expect(next.missing.map((m) => m.emoji)).toContain("👥");
    expect(next.missing.map((m) => m.emoji)).toContain("🧩");
  });

  it("별이 오르면 랜드마크가 열린다: 별 2개면 도시 점수가 낮아도 분수 광장", () => {
    const company = { buildings: [at("factory", 0, 0), at("house", 2, 2), at("house", 4, 4)] };
    expect(cityScore(company.buildings)).toBeLessThan(5);
    expect(isBuildingTypeUnlocked(company, "fountain")).toBe(true);
    expect(isBuildingTypeUnlocked(company, "statue")).toBe(false);
  });

  it("처음 오른 별의 축하금은 한 번만 받는다", () => {
    const game = newGame(21);
    const company = player(game);
    const free = (x: number, y: number) => !company.buildings.some((b) => b.x === x && b.y === y);
    const spots = [] as { x: number; y: number }[];
    for (let y = 0; y < game.config.mapSize && spots.length < 3; y += 1) {
      for (let x = 0; x < game.config.mapSize && spots.length < 3; x += 1) if (free(x, y)) spots.push({ x, y });
    }
    for (const s of spots) company.buildings.push(at("house", s.x, s.y));
    const first = advanceTurn(game);
    expect(first.village?.stars).toBeGreaterThanOrEqual(2);
    expect(first.village?.starRewards.map((g) => g.stars)).toContain(2);
    expect(game.village?.bestStars).toBeGreaterThanOrEqual(2);
    const second = advanceTurn(game);
    expect(second.village?.starRewards ?? []).toHaveLength(0);
  });

  it("별 목표는 차례로 어려워진다", () => {
    for (let i = 1; i < STAR_GOALS.length; i += 1) {
      expect(STAR_GOALS[i].population).toBeGreaterThan(STAR_GOALS[i - 1].population);
      expect(STAR_GOALS[i].reward.cash).toBeGreaterThan(STAR_GOALS[i - 1].reward.cash);
    }
  });
});

describe("마을과 경제", () => {
  it("주민은 동네 손님이 되어 손님 수를 늘린다(최대 +20%)", () => {
    expect(villageCustomerBoost([at("factory", 0, 0)])).toBe(1);
    const boost = villageCustomerBoost([at("house", 0, 0, 3), at("house", 2, 0, 3)]);
    expect(boost).toBeGreaterThan(1.03);
    expect(boost).toBeLessThanOrEqual(1.2);

    const game = newGame();
    const company = player(game);
    const industry = getIndustry("food");
    const country = getCountry("kr");
    const before = estimateDemand(company, industry, country, game.macro, game.config);
    company.buildings.push(at("house", 7, 7, 3), at("house", 7, 5, 3));
    expect(estimateDemand(company, industry, country, game.macro, game.config)).toBeGreaterThan(before);
  });

  it("같은 seed면 마을 결과도 같다", () => {
    const a = newGame(8);
    const b = newGame(8);
    for (let i = 0; i < 6; i += 1) expect(advanceTurn(a).village).toEqual(advanceTurn(b).village);
  });

  it("예전 세이브에서도 주택을 지을 수 있다", () => {
    const game = newGame();
    const old = JSON.parse(JSON.stringify(game)) as GameState;
    old.config.enabledBuildings = old.config.enabledBuildings.filter((t) => t !== "house");
    delete old.village;
    const migrated = migrateGameState(old)!;
    expect(migrated.config.enabledBuildings).toContain("house");
    expect(advanceTurn(migrated).village).toBeTruthy();
  });
});

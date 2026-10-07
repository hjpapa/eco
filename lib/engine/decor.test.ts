import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  BUILDINGS,
  BUILDING_LIST,
  createGame,
  decorOpportunity,
  migrateGameState,
  stickerCatalog,
  syncStickers,
  type BuildingType,
  type GameState,
} from "./index";
import { buildBuilding, moveBuilding, sellBuilding, MOVE_FEE } from "./actions";
import { buildingConstructionCost, cityScore } from "./buildings";
import { plotHappiness, villageStats } from "./village";
import { startSeason } from "./seasons";

const newGame = (seed = 9) =>
  createGame({ level: "elementary", gameLength: 50, seed, playerCompanyName: "꾸미기회사", industryId: "food", countryId: "kr", revealMode: "all" });
const player = (game: GameState) => game.companies.find((c) => c.id === game.playerCompanyId)!;

function freePlots(game: GameState, count: number) {
  const company = player(game);
  const spots: { x: number; y: number }[] = [];
  for (let y = game.config.mapSize - 1; y >= 0 && spots.length < count; y -= 1) {
    for (let x = game.config.mapSize - 1; x >= 0 && spots.length < count; x -= 1) {
      if (!company.buildings.some((b) => b.x === x && b.y === y)) spots.push({ x, y });
    }
  }
  return spots;
}

const DECOR = BUILDING_LIST.filter((def) => def.decor);

describe("꾸미기 소품", () => {
  it("소품 10개 이상, 모두 싸고 유지비가 없고 레벨이 1이다", () => {
    expect(DECOR.length).toBeGreaterThanOrEqual(10);
    for (const def of DECOR) {
      expect(def.upkeep).toBe(0);
      expect(def.maxLevel).toBe(1);
      expect(def.cost).toBeLessThanOrEqual(50_000);
    }
  });

  it("계절마다 그 계절에만 파는 소품이 하나씩 있다", () => {
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(DECOR.filter((def) => def.season === season)).toHaveLength(1);
    }
  });

  it("눈사람은 겨울에만 만들 수 있다", () => {
    const game = newGame();
    const company = player(game);
    const [spot] = freePlots(game, 1);
    game.macro.season = "spring";
    const spring = buildBuilding(game, company, "snowman", spot.x, spot.y);
    expect(spring.ok).toBe(false);
    expect(spring.ok ? "" : spring.error).toContain("겨울");
    game.macro.season = "winter";
    expect(buildBuilding(game, company, "snowman", spot.x, spot.y).ok).toBe(true);
  });

  it("같은 소품을 여러 개 놓아도 값이 그대로다", () => {
    const game = newGame();
    const company = player(game);
    const price = buildingConstructionCost(company, "bench");
    for (const spot of freePlots(game, 3)) expect(buildBuilding(game, company, "bench", spot.x, spot.y).ok).toBe(true);
    expect(buildingConstructionCost(company, "bench")).toBe(price);
  });

  it("소품은 도시 점수·건물 종류에 들어가지 않지만 옆집을 행복하게 한다", () => {
    const game = newGame();
    const company = player(game);
    const [a, b] = freePlots(game, 2);
    const score = cityScore(company.buildings);
    const variety = villageStats(company.buildings).variety;
    company.buildings.push({ id: "fb", type: "flowerbed", level: 1, x: a.x, y: a.y, turnsLeft: 0 });
    expect(cityScore(company.buildings)).toBe(score);
    expect(villageStats(company.buildings).variety).toBe(variety);
    expect(plotHappiness(company.buildings, b.x, b.y)).toBeGreaterThan(plotHappiness(company.buildings.filter((x) => x.id !== "fb"), b.x, b.y));
  });

  it("꾸미기에 쓴 돈과 예금했을 때의 이자를 비교한다(기회비용)", () => {
    const game = newGame();
    const company = player(game);
    const [spot] = freePlots(game, 1);
    buildBuilding(game, company, "bigtree", spot.x, spot.y);
    expect(decorOpportunity(game).spent).toBe(BUILDINGS.bigtree.cost);
    for (let i = 0; i < 4; i += 1) advanceTurn(game);
    const later = decorOpportunity(game);
    expect(later.interest).toBeGreaterThanOrEqual(0);
    if (game.macro.interestRate > 0) expect(later.interest).toBeGreaterThan(0);
  });

  it("의뢰판은 소품을 지어 달라고 하지 않는다", () => {
    const game = newGame(4);
    for (let i = 0; i < 12; i += 1) {
      advanceTurn(game);
      for (const q of game.quests ?? []) {
        if (q.buildingType && !q.residentId) expect(BUILDINGS[q.buildingType as BuildingType].decor).toBeFalsy();
      }
    }
  });
});

describe("마을 열리는 때", () => {
  it("차례로 열기 게임에서는 마을(주택·소품)이 정해진 턴에 열린다", () => {
    const game = createGame({ level: "elementary", gameLength: 50, seed: 3, playerCompanyName: "차례회사", industryId: "food", countryId: "kr", revealMode: "guided" });
    const company = player(game);
    const [spot] = freePlots(game, 1);
    const early = buildBuilding(game, company, "house", spot.x, spot.y);
    expect(early.ok).toBe(false);
    expect(early.ok ? "" : early.error).toContain("2턴");
    game.turn = 2;
    expect(buildBuilding(game, company, "house", spot.x, spot.y).ok).toBe(true);
  });
});

describe("옮기기", () => {
  it("소품은 무료로, 건물은 이사 비용을 내고 빈 땅으로 옮긴다", () => {
    const game = newGame();
    const company = player(game);
    const [a, b, c] = freePlots(game, 3);
    buildBuilding(game, company, "bench", a.x, a.y);
    const bench = company.buildings.find((x) => x.type === "bench")!;
    const cash = company.cash;
    expect(moveBuilding(game, company, bench.id, b.x, b.y).ok).toBe(true);
    expect([bench.x, bench.y]).toEqual([b.x, b.y]);
    expect(company.cash).toBe(cash);

    const factory = company.buildings.find((x) => x.type === "factory")!;
    expect(moveBuilding(game, company, factory.id, c.x, c.y).ok).toBe(true);
    expect(company.cash).toBe(cash - MOVE_FEE);
    expect([factory.x, factory.y]).toEqual([c.x, c.y]);
  });

  it("다른 건물이 있는 칸이나 지도 밖으로는 옮길 수 없다", () => {
    const game = newGame();
    const company = player(game);
    const [first, second] = company.buildings;
    expect(moveBuilding(game, company, first.id, second.x, second.y).ok).toBe(false);
    expect(moveBuilding(game, company, first.id, -1, 0).ok).toBe(false);
  });
});

describe("도감 스티커", () => {
  it("새 게임은 처음 건물 스티커를 조용히 갖고 시작한다", () => {
    const game = newGame();
    expect(game.stickers?.length).toBeGreaterThan(0);
    expect(syncStickers(game)).toHaveLength(0);
  });

  it("새 건물·소품을 처음 지으면 스티커가 한 번만 생긴다", () => {
    const game = newGame();
    const company = player(game);
    const [a, b] = freePlots(game, 2);
    buildBuilding(game, company, "flowerbed", a.x, a.y);
    const first = syncStickers(game);
    expect(first.map((s) => s.key)).toEqual(["building:flowerbed"]);
    expect(first[0].kind).toBe("decor");
    buildBuilding(game, company, "flowerbed", b.x, b.y);
    expect(syncStickers(game)).toHaveLength(0);
  });

  it("축제에 참여하면 축제 스티커가 생긴다", () => {
    const game = newGame();
    const company = player(game);
    const [a] = freePlots(game, 1);
    company.buildings.push({ id: "pk", type: "park", level: 1, x: a.x, y: a.y, turnsLeft: 0 });
    syncStickers(game);
    game.turn = 4;
    const festival = startSeason(game);
    expect(festival.joined).toBe(true);
    expect(syncStickers(game, [`festival:${festival.festival.id}`]).map((s) => s.kind)).toEqual(["festival"]);
  });

  it("도감에는 이웃·건물·꾸미기·축제가 모두 있다", () => {
    const kinds = new Set(stickerCatalog(newGame()).map((s) => s.kind));
    expect([...kinds].sort()).toEqual(["building", "decor", "festival", "resident"]);
  });

  it("도감이 없던 예전 세이브는 지금 가진 것으로 조용히 시작한다", () => {
    const game = newGame();
    const old = JSON.parse(JSON.stringify(game)) as GameState;
    delete old.stickers;
    old.config.enabledBuildings = old.config.enabledBuildings.filter((t) => !BUILDINGS[t].decor);
    const migrated = migrateGameState(old)!;
    expect(migrated.config.enabledBuildings).toContain("snowman");
    expect(advanceTurn(migrated).stickers ?? []).toHaveLength(0);
    expect(migrated.stickers?.length).toBeGreaterThan(0);
  });
});

describe("잔디와 나무 꾸미기", () => {
  const landscape = ["grass", "clover", "pinetree", "birchtree"] as const;
  it.each(landscape)("%s: 배치·중복 방지·무료 이동·치우기와 환불", (type) => {
    const game = newGame();
    const company = player(game);
    const [a, b] = freePlots(game, 2);
    const cash = company.cash;
    const score = cityScore(company.buildings);
    const variety = villageStats(company.buildings).variety;
    expect(buildBuilding(game, company, type, a.x, a.y).ok).toBe(true);
    const placed = company.buildings.find((item) => item.type === type)!;
    expect(placed.turnsLeft).toBe(0);
    expect(company.cash).toBe(cash - BUILDINGS[type].cost);
    expect(buildBuilding(game, company, type, a.x, a.y).ok).toBe(false);
    expect(company.cash).toBe(cash - BUILDINGS[type].cost);
    expect(cityScore(company.buildings)).toBe(score);
    expect(villageStats(company.buildings).variety).toBe(variety);
    expect(plotHappiness(company.buildings, b.x, b.y)).toBeGreaterThan(
      plotHappiness(company.buildings.filter((item) => item.id !== placed.id), b.x, b.y));
    expect(moveBuilding(game, company, placed.id, b.x, b.y).ok).toBe(true);
    expect(company.cash).toBe(cash - BUILDINGS[type].cost);
    expect(sellBuilding(game, company, placed.id).ok).toBe(true);
    expect(company.cash).toBe(cash - BUILDINGS[type].cost / 2);
    expect(company.buildings.some((item) => item.id === placed.id)).toBe(false);
  });

  it("예전 저장에 새 소품이 열리고 기존 도시·돈은 유지된다", () => {
    const old = JSON.parse(JSON.stringify(newGame())) as GameState;
    old.config.enabledBuildings = old.config.enabledBuildings.filter(
      (type) => !landscape.some((item) => item === type));
    const before = JSON.stringify(player(old));
    const migrated = migrateGameState(JSON.parse(JSON.stringify(old)))!;
    for (const type of landscape) expect(migrated.config.enabledBuildings).toContain(type);
    expect(JSON.stringify(player(migrated))).toBe(before);
    expect(migrateGameState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });

  it("새 소품이 있는 저장을 다시 불러와도 같은 seed의 턴 결과가 같다", () => {
    const game = newGame(41);
    const plots = freePlots(game, 4);
    landscape.forEach((type, i) => expect(buildBuilding(game, player(game), type, plots[i].x, plots[i].y).ok).toBe(true));
    const loaded = migrateGameState(JSON.parse(JSON.stringify(game)))!;
    expect(player(loaded).buildings).toEqual(player(game).buildings);
    expect(advanceTurn(loaded)).toEqual(advanceTurn(game));
    expect(loaded.companies).toEqual(game.companies);
    expect(loaded.macro).toEqual(game.macro);
    expect(loaded.rng).toEqual(game.rng);
    expect(loaded.decorLog).toEqual(game.decorLog);
  });
});

import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  claimQuest,
  createGame,
  migrateGameState,
  type BuildingType,
  type GameState,
  type PlacedBuilding,
} from "./index";
import { RESIDENTS, RESIDENT_MAP } from "../data/residents";
import {
  BEST_FRIEND_GIFT,
  MAX_HEARTS,
  livingResidents,
  residentLine,
  residentSlots,
  updateResidents,
} from "./residents";
import { villageStats } from "./village";

let seq = 0;
const at = (type: BuildingType, x: number, y: number, level = 1): PlacedBuilding => ({ id: `r${seq++}`, type, level, x, y, turnsLeft: 0 });

const newGame = (seed = 5) =>
  createGame({ level: "elementary", gameLength: 50, seed, playerCompanyName: "이웃회사", industryId: "food", countryId: "kr", revealMode: "all" });
const player = (game: GameState) => game.companies.find((c) => c.id === game.playerCompanyId)!;

/** Free plots on the player's map, in reading order. */
function freePlots(game: GameState, count: number) {
  const company = player(game);
  const spots: { x: number; y: number }[] = [];
  for (let y = 0; y < game.config.mapSize && spots.length < count; y += 1) {
    for (let x = 0; x < game.config.mapSize && spots.length < count; x += 1) {
      if (!company.buildings.some((b) => b.x === x && b.y === y)) spots.push({ x, y });
    }
  }
  return spots;
}

/** A cosy village: houses, a park and a shop, far from the starter factory. */
function cosyVillage(game: GameState, houses: number) {
  const spots = freePlots(game, houses + 2).reverse();
  const company = player(game);
  company.buildings.push(at("park", spots[0].x, spots[0].y));
  company.buildings.push(at("store", spots[1].x, spots[1].y));
  for (const s of spots.slice(2)) company.buildings.push(at("house", s.x, s.y));
}

describe("이웃 주민 데이터", () => {
  it("주민 12명, 성격 4종, 저마다 좋아하는 건물과 말버릇이 있다", () => {
    expect(RESIDENTS).toHaveLength(12);
    expect(new Set(RESIDENTS.map((r) => r.personality)).size).toBe(4);
    for (const r of RESIDENTS) {
      expect(r.favorites.length).toBeGreaterThan(0);
      expect(r.catchphrase.length).toBeGreaterThan(0);
      expect(r.lines.length).toBeGreaterThan(0);
    }
  });

  it("주민 6명마다 이름 있는 이웃 한 명이 살 수 있다", () => {
    expect(residentSlots(0)).toBe(0);
    expect(residentSlots(5)).toBe(0);
    expect(residentSlots(6)).toBe(1);
    expect(residentSlots(1000)).toBe(12);
  });
});

describe("이사 오기와 떠나기", () => {
  it("행복한 마을에 빈자리가 있으면 한 턴에 한 명씩 이사 온다", () => {
    const game = newGame();
    cosyVillage(game, 3);
    expect(villageStats(player(game).buildings).happiness).toBeGreaterThanOrEqual(50);
    const first = advanceTurn(game);
    expect(first.residents?.movedIn).toHaveLength(1);
    const second = advanceTurn(game);
    expect(second.residents?.movedIn.length).toBeLessThanOrEqual(1);
    expect(livingResidents(game).length).toBeGreaterThanOrEqual(1);
  });

  it("집이 없으면 아무도 이사 오지 않는다", () => {
    const game = newGame();
    const summary = advanceTurn(game);
    expect(summary.residents?.movedIn).toHaveLength(0);
    expect(game.residents ?? []).toHaveLength(0);
  });

  it("마을이 쓸쓸하면 먼저 고민하고(경고), 다음 턴에도 그대로면 떠난다", () => {
    const game = newGame();
    cosyVillage(game, 2);
    advanceTurn(game);
    const who = game.residents![0].id;
    // The houses are sold: too many neighbours for the room left.
    player(game).buildings = player(game).buildings.filter((b) => b.type !== "house");
    game.turn += 1;
    const warn = updateResidents(game);
    expect(warn.worried).toEqual([who]);
    expect(residentLine(game, who)).toContain("고민");
    game.turn += 1;
    const gone = updateResidents(game);
    expect(gone.left).toEqual([who]);
    expect(game.residents!.some((r) => r.id === who)).toBe(false);
  });

  it("고민하던 이웃도 마을이 다시 좋아지면 안심하고 남는다", () => {
    const game = newGame();
    cosyVillage(game, 2);
    advanceTurn(game);
    const who = game.residents![0].id;
    const saved = player(game).buildings.slice();
    player(game).buildings = saved.filter((b) => b.type !== "house");
    game.turn += 1;
    expect(updateResidents(game).worried).toEqual([who]);
    player(game).buildings = saved;
    game.turn += 1;
    const back = updateResidents(game);
    expect(back.relieved).toEqual([who]);
    expect(back.left).toHaveLength(0);
  });
});

describe("하트와 소원", () => {
  it("좋아하는 건물이 새로 생기면 하트가 1개 늘고, 5개가 되면 선물을 한 번 준다", () => {
    const game = newGame();
    cosyVillage(game, 2);
    advanceTurn(game);
    const resident = game.residents![0];
    const def = RESIDENT_MAP[resident.id];
    const spot = freePlots(game, 1)[0];
    player(game).buildings.push(at(def.favorites[0], spot.x, spot.y));
    game.turn += 1;
    const update = updateResidents(game);
    expect(update.hearts).toContain(resident.id);
    expect(game.residents!.find((r) => r.id === resident.id)!.hearts).toBe(2);

    game.residents!.find((r) => r.id === resident.id)!.hearts = MAX_HEARTS;
    const cash = player(game).cash;
    game.turn += 1;
    expect(updateResidents(game).gifts).toContain(resident.id);
    expect(player(game).cash).toBe(cash + BEST_FRIEND_GIFT.cash);
    game.turn += 1;
    expect(updateResidents(game).gifts).toHaveLength(0);
  });

  it("소원은 그 이웃 말투로 의뢰판에 올라오고, 들어주면 하트가 늘어난다", () => {
    const game = newGame(12);
    cosyVillage(game, 3);
    let wish = null as ReturnType<typeof updateResidents>["wish"];
    for (let i = 0; i < 12 && !wish; i += 1) wish = advanceTurn(game).residents?.wish ?? null;
    expect(wish).toBeTruthy();
    const def = RESIDENT_MAP[wish!.residentId!];
    expect(wish!.client).toBe(def.name);
    expect(wish!.detail).toContain(def.catchphrase);
    // City requests keep their own slot next to a wish.
    expect((game.quests ?? []).filter((q) => q.residentId).length).toBe(1);

    const before = game.residents!.find((r) => r.id === def.id)!.hearts;
    const spot = freePlots(game, 1)[0];
    player(game).buildings.push(at(wish!.buildingType!, spot.x, spot.y));
    const result = claimQuest(game, wish!.id);
    expect(result.ok).toBe(true);
    expect(result.ok && result.message).toContain(def.name);
    expect(game.residents!.find((r) => r.id === def.id)!.hearts).toBe(Math.min(MAX_HEARTS, before + 1));
    // The same building does not give a second heart next turn.
    game.turn += 1;
    expect(updateResidents(game).hearts).not.toContain(def.id);
  });

  it("같은 seed면 이웃도 똑같이 이사 온다", () => {
    const a = newGame(31);
    const b = newGame(31);
    cosyVillage(a, 4);
    cosyVillage(b, 4);
    for (let i = 0; i < 6; i += 1) expect(advanceTurn(a).residents).toEqual(advanceTurn(b).residents);
  });

  it("이웃이 없던 예전 세이브도 그대로 이어진다", () => {
    const game = newGame();
    cosyVillage(game, 2);
    const old = JSON.parse(JSON.stringify(game)) as GameState;
    delete old.residents;
    const migrated = migrateGameState(old)!;
    expect(advanceTurn(migrated).residents?.movedIn.length).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "./engine";
import { makeCityAlbum, readCityAlbum } from "./cityAlbum";
import { getEndingId } from "./endings";
import { HALL_KEY, readHall, saveHall } from "./hallOfFame";

const game = () => createGame({ level: "elementary", seed: 1234, playerCompanyName: "초록회사", industryId: "tech", countryId: "kr" });
function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
}
describe("모험 기록", () => {
  it("진행 중인 게임을 기록하지 않고, 완료 기록은 재방문해도 중복되지 않는다", () => {
    const g = game(); const storage = memory();
    expect(saveHall(storage, g)).toBe(false);
    g.status = "ended";
    expect(saveHall(storage, g)).toBe(true);
    expect(saveHall(storage, g)).toBe(true);
    expect(readHall(storage)).toHaveLength(1);
  });
  it("손상된 기록과 저장 차단을 안전하게 처리한다", () => {
    const storage = memory();
    storage.setItem(HALL_KEY, '{'); expect(readHall(storage)).toEqual([]);
    storage.setItem(HALL_KEY, '[null,{}, {"ending":"toString"}]'); expect(readHall(storage)).toEqual([]);
    const g = game(); g.status = "ended";
    expect(saveHall(null, g)).toBe(false);
    expect(saveHall({ getItem: () => null, setItem: () => { throw Error("full"); } }, g)).toBe(false);
  });
  it("마을 별점과 주민·이웃 수도 함께 기록한다", () => {
    const storage = memory(); const g = game(); g.status = "ended";
    saveHall(storage, g);
    const [record] = readHall(storage);
    expect(record.stars).toBeGreaterThanOrEqual(1);
    expect(record.residents).toBeGreaterThanOrEqual(0);
    expect(record.neighbours).toBe(0);
  });
  it("최근 30번만 보관한다", () => {
    const storage = memory(); const g = game(); g.status = "ended";
    for (let i = 0; i < 35; i++) { g.createdAt = i; g.updatedAt = i; saveHall(storage, g); }
    expect(readHall(storage)).toHaveLength(30);
    expect(readHall(storage)[0].date).toBe(34);
  });
});
describe("결과에 맞는 엔딩", () => {
  it("파산이면 재산 순위보다 재도전 엔딩을 우선한다", () => {
    const g = game(); g.endReason = "insolvent";
    g.companies.find(c => c.id === g.playerCompanyId)!.cash = 1e12;
    expect(getEndingId(g)).toBe("comeback");
  });
  it("1등은 챔피언, 균형 있는 회사는 행복한 도시가 된다", () => {
    const g = game(); const c = g.companies.find(c => c.id === g.playerCompanyId)!;
    c.cash = 1e12; expect(getEndingId(g)).toBe("champion");
    c.cash = 0;
    g.companies.filter(c => c.id !== g.playerCompanyId).forEach(c => { c.cash = 1e12; });
    c.quality = c.reputation = c.morale = c.safety = 60;
    expect(getEndingId(g)).toBe("harmony");
    c.quality = 59;
    g.initialPlayerNetWorth = 1; expect(getEndingId(g)).toBe("growth");
    g.initialPlayerNetWorth = 1e15; g.initialPlayerRank = 100; expect(getEndingId(g)).toBe("climber");
    g.initialPlayerRank = 1; expect(getEndingId(g)).toBe("explorer");
  });
});

describe("엔딩 도시 앨범", () => {
  it("최종 배치·레벨·공사·주민·행복을 독립적으로 보관한다", () => {
    const g = game(); g.status = "ended";
    const company = g.companies.find((c) => c.id === g.playerCompanyId)!;
    company.buildings.push({ id: "home", type: "house", x: 0, y: 0, level: 1, turnsLeft: 0 });
    company.buildings.push({ id: "tree", type: "pinetree", x: 1, y: 0, level: 1, turnsLeft: 0 });
    company.buildings[0].turnsLeft = 2;
    const storage = memory();
    expect(saveHall(storage, g)).toBe(true);
    const album = readHall(storage)[0].album!;
    expect(album.residents).toBeGreaterThan(0);
    expect(album.happiness).toBeGreaterThanOrEqual(0);
    expect(album.buildings[0].building).toBe(true);
    expect(album.buildings.find((b) => b.type === "pinetree")).toMatchObject({ x: 1, y: 0 });
    const snapshot = JSON.stringify(album);
    company.buildings.length = 0;
    expect(JSON.stringify(readHall(storage)[0].album)).toBe(snapshot);
    expect(album.highlights.length).toBeLessThanOrEqual(3);
  });

  it("예전 기록과 손상된 앨범도 모험 기록은 유지한다", () => {
    const g = game(); g.status = "ended"; const storage = memory();
    saveHall(storage, g);
    const record = readHall(storage)[0];
    delete record.album;
    storage.setItem(HALL_KEY, JSON.stringify([record]));
    expect(readHall(storage)[0].album).toBeUndefined();
    expect(readHall(storage)[0].name).toBe(record.name);
    storage.setItem(HALL_KEY, JSON.stringify([{ ...record, album: { version: 1, mapSize: 99999 } }]));
    expect(readHall(storage)).toHaveLength(1);
    expect(readHall(storage)[0].album).toBeUndefined();
  });

  it("알 수 없는 건물·지도 밖 위치·겹친 칸은 표시하지 않는다", () => {
    const album = makeCityAlbum(game())!;
    expect(readCityAlbum(album)).toEqual(album);
    expect(readCityAlbum({ ...album, buildings: [{ ...album.buildings[0], type: "toString" }] })).toBeUndefined();
    expect(readCityAlbum({ ...album, buildings: [{ ...album.buildings[0], x: -1 }] })).toBeUndefined();
    expect(readCityAlbum({ ...album, buildings: [album.buildings[0], album.buildings[0]] })).toBeUndefined();
    expect(readCityAlbum({ ...album, happiness: null })).toBeUndefined();
  });

  it("빈 도시와 저장 후 재방문도 안전하며 동일 모험은 하나만 남긴다", () => {
    const g = game(); g.status = "ended";
    g.companies.find((c) => c.id === g.playerCompanyId)!.buildings = [];
    const storage = memory();
    saveHall(storage, g); saveHall(storage, JSON.parse(JSON.stringify(g)));
    expect(readHall(storage)).toHaveLength(1);
    expect(readHall(storage)[0].album!.buildings).toEqual([]);
    expect(readCityAlbum(readHall(storage)[0].album)).toBeDefined();
  });
});

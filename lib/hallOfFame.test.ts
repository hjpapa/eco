import { describe, expect, it } from "vitest";
import { createGame } from "./engine";
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

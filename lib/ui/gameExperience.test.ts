import { describe, expect, it } from "vitest";
import { advanceTurn, createGame } from "../engine";
import {
  compareTurnRankings,
  captureTurnSnapshot,
  evaluateMission,
  evaluateSnapshotMissions,
  getAvailableTurnMissionIds,
  getDragonStage,
  getEconomyWeather,
  getJourneyMilestones,
  getRivalChase,
  getTurnHighlights,
  getTurnMissions,
} from "./gameExperience";

function makeGame(maxTurns: 20 | 50 | 100 = 20) {
  return createGame({
    level: "elementary",
    seed: 731,
    playerCompanyName: "테스트 회사",
    industryId: "electronics",
    countryId: "kr",
    gameLength: maxTurns,
  });
}

describe("game experience presentation", () => {
  it("builds a guided mountain journey from the campaign unlock table", () => {
    const game = makeGame(20);
    const milestones = getJourneyMilestones(game);

    expect(milestones.map((item) => item.turn)).toEqual([0, 2, 4, 7, 10, 20]);
    expect(milestones[0].current).toBe(true);

    const standard = makeGame(50);
    expect(getJourneyMilestones(standard).map((item) => item.turn)).toEqual([0, 5, 10, 18, 25, 50]);

    const long = makeGame(100);
    expect(getJourneyMilestones(long).map((item) => item.turn)).toEqual([0, 10, 20, 35, 50, 100]);
  });

  it("keeps an interesting trail after experienced players open every feature", () => {
    const game = makeGame(50);
    game.revealMode = "all";

    expect(getJourneyMilestones(game).map((item) => item.turn)).toEqual([0, 13, 25, 38, 50]);
  });

  it("progresses dragon titles without adding save fields", () => {
    const game = makeGame(20);
    expect(getDragonStage(game).label).toBe("견습 상인");

    game.turn = 14;
    expect(getDragonStage(game).label).toBe("산악 CEO");
  });

  it("offers only missions that match currently unlocked features", () => {
    const game = makeGame(20);
    game.turn = 1;
    expect(getAvailableTurnMissionIds(game)).toEqual([
      "profit",
      "inventory",
      "cash-reserve",
      "workplace",
    ]);

    game.turn = 2;
    expect(getAvailableTurnMissionIds(game)).toContain("building-combo");
    expect(getAvailableTurnMissionIds(game)).toContain("quality");
    expect(getAvailableTurnMissionIds(game)).not.toContain("first-investment");
    expect(getAvailableTurnMissionIds(game)).not.toContain("healthy-debt");

    game.turn = 4;
    expect(getAvailableTurnMissionIds(game)).toContain("first-investment");
    expect(getAvailableTurnMissionIds(game)).not.toContain("healthy-debt");

    game.turn = 10;
    expect(getAvailableTurnMissionIds(game)).toContain("healthy-debt");
  });

  it("selects two deterministic, distinct missions without consuming game state", () => {
    const game = makeGame(20);
    game.turn = 7;
    const stateBefore = JSON.stringify(game);
    const first = getTurnMissions(game).map((mission) => mission.id);
    const second = getTurnMissions(game).map((mission) => mission.id);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
    expect(JSON.stringify(game)).toBe(stateBefore);
  });

  it("captures detached ranking values before the mutable engine advances", () => {
    const game = makeGame(20);
    const snapshot = captureTurnSnapshot(game);
    const serialized = JSON.stringify(snapshot);
    advanceTurn(game);

    expect(snapshot.turn).toBe(0);
    expect(snapshot.rank).toBeGreaterThan(0);
    expect(snapshot.ranking).toHaveLength(game.companies.length);
    expect(snapshot.ranking.find((entry) => entry.isPlayer)?.rank).toBe(snapshot.rank);
    expect(snapshot.missionIds).toEqual(["first-sale", "cash-reserve"]);
    expect(snapshot.inventory).toBe(0);
    expect(JSON.stringify(snapshot)).toBe(serialized);
  });

  it("explains a completed turn and evaluates its original missions", () => {
    const game = makeGame(20);
    const snapshot = captureTurnSnapshot(game);
    const summary = advanceTurn(game);
    const highlights = getTurnHighlights(game, summary, snapshot);

    expect(highlights.length).toBeGreaterThan(0);
    expect(evaluateSnapshotMissions(game, snapshot).find((mission) => mission.id === "first-sale")?.done).toBe(true);
  });

  it("keeps a mission's original target when advancing crosses a target threshold", () => {
    const game = makeGame(20);
    game.turn = 4;
    const snapshot = { ...captureTurnSnapshot(game), missionIds: ["quality" as const] };
    const player = game.companies.find((company) => company.isPlayer)!;
    player.quality = 40;
    game.turn = 5;

    expect(evaluateMission(game, "quality").title).toContain("45점");
    const original = evaluateSnapshotMissions(game, snapshot)[0];
    expect(original.title).toContain("35점");
    expect(original.done).toBe(true);
  });

  it("keeps the offered inventory goal after the player changes production", () => {
    const game = makeGame(20);
    game.turn = 1;
    const player = game.companies.find((company) => company.isPlayer)!;
    player.decisions.productionTarget = 100;
    const snapshot = { ...captureTurnSnapshot(game), missionIds: ["inventory" as const] };

    player.decisions.productionTarget = 1_000;
    game.turn = 2;
    expect(evaluateMission(game, "inventory").progress).toContain("400개 이하");
    expect(evaluateSnapshotMissions(game, snapshot)[0].progress).toContain("40개 이하");
  });

  it("reports the exact companies overtaken without retaining mutable companies", () => {
    const game = makeGame(20);
    game.revealMode = "all";
    const player = game.companies.find((company) => company.isPlayer)!;
    const rivals = game.companies.filter((company) => company.isAI).slice(0, 2);
    for (const company of game.companies) company.cash = 10_000;
    player.cash = 1_000_000;
    rivals[0].cash = 3_000_000;
    rivals[1].cash = 2_000_000;
    const snapshot = captureTurnSnapshot(game);

    player.cash = 5_000_000;
    const movement = compareTurnRankings(snapshot, game);

    expect(movement.visible).toBe(true);
    expect(movement.rankGain).toBe(2);
    expect(new Set(movement.overtaken.map((entry) => entry.name))).toEqual(
      new Set(rivals.map((company) => company.name)),
    );
    expect(movement.passedBy).toEqual([]);
  });

  it("reports who passed the player and hides ranking details before unlock", () => {
    const game = makeGame(20);
    game.revealMode = "all";
    const player = game.companies.find((company) => company.isPlayer)!;
    const rivals = game.companies.filter((company) => company.isAI).slice(0, 2);
    for (const company of game.companies) company.cash = 10_000;
    player.cash = 5_000_000;
    rivals[0].cash = 3_000_000;
    rivals[1].cash = 2_000_000;
    const snapshot = captureTurnSnapshot(game);

    player.cash = 1_000_000;
    const movement = compareTurnRankings(snapshot, game);
    expect(movement.rankGain).toBe(-2);
    expect(new Set(movement.passedBy.map((entry) => entry.name))).toEqual(
      new Set(rivals.map((company) => company.name)),
    );

    game.revealMode = "guided";
    game.turn = 1;
    const lockedSnapshot = captureTurnSnapshot(game);
    player.cash = 9_000_000;
    expect(compareTurnRankings(lockedSnapshot, game)).toMatchObject({
      visible: false,
      overtaken: [],
      passedBy: [],
    });
    expect(getRivalChase(game)).toBeNull();
  });

  it("finds the nearest visible rival for chase and defense meters", () => {
    const game = makeGame(20);
    game.revealMode = "all";
    const player = game.companies.find((company) => company.isPlayer)!;
    for (const company of game.companies) company.cash = 10_000;
    const leader = game.companies.find((company) => company.isAI)!;
    leader.cash = 2_000_000;
    player.cash = 1_000_000;

    const chase = getRivalChase(game);
    expect(chase).toMatchObject({ mode: "chasing", rival: { name: leader.name } });
    expect(chase?.closenessPercent).toBeGreaterThanOrEqual(0);
    expect(chase?.closenessPercent).toBeLessThanOrEqual(100);

    player.cash = 3_000_000;
    expect(getRivalChase(game)?.mode).toBe("defending");
  });

  it("gives child-friendly weather guidance for every economy phase", () => {
    const phases = ["boom", "normal", "recession", "inflation", "deflation", "stagflation"] as const;
    for (const phase of phases) {
      const weather = getEconomyWeather(phase);
      expect(weather.name.length).toBeGreaterThan(0);
      expect(weather.advice.endsWith("요.")).toBe(true);
    }
  });
});

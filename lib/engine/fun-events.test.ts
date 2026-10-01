import { describe, expect, it } from "vitest";
import { advanceTurn, createGame, generateFunEvent, isFeatureUnlocked, type GameState } from "./index";

function game(seed = 2026): GameState {
  return createGame({
    level: "elementary",
    seed,
    playerCompanyName: "웃음 회사",
    industryId: "tech",
    countryId: "kr",
  });
}

describe("깜짝 소식 (fun events)", () => {
  it("opens the very first turn with a joke the student can see", () => {
    const state = game();
    const summary = advanceTurn(state);
    expect(summary.events.some((event) => event.layer === "fun" && event.tags.includes("opening-rice-cake"))).toBe(true);
  });

  it("keeps showing jokes while real news is still locked", () => {
    const state = game();
    let jokes = 0;
    for (let i = 0; i < 8; i += 1) {
      const summary = advanceTurn(state);
      expect(isFeatureUnlocked(state, "talentNewsRanking")).toBe(false);
      jokes += summary.events.filter((event) => event.layer === "fun").length;
      expect(summary.events.every((event) => event.layer === "fun")).toBe(true);
    }
    expect(jokes).toBeGreaterThan(1);
  });

  it("never draws from the main game RNG", () => {
    const state = game();
    state.turn = 3;
    const before = state.rng.seed;
    generateFunEvent(state);
    expect(state.rng.seed).toBe(before);
  });

  it("reacts to the company's situation", () => {
    const seen = new Set<string>();
    for (let turn = 1; turn <= 40; turn += 1) {
      const state = game(turn * 31);
      const player = state.companies.find((company) => company.isPlayer)!;
      player.inventory = 5_000;
      player.buildings = player.buildings.filter((b) => b.type !== "cafeteria");
      state.turn = turn;
      const joke = generateFunEvent(state);
      if (joke) seen.add(joke.tags[1]);
    }
    expect(seen.has("box-maze")).toBe(true);
    expect(seen.has("tteokbokki-rush")).toBe(false);
  });
});

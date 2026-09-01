import { describe, expect, it } from "vitest";
import { createGame, getLevelConfig } from "./index";

const ELEMENTARY_GAME_CASES = [
  {
    label: "직접 만든 회사와 seed 1",
    seed: 1,
    industryId: "tech",
    countryId: "kr",
  },
  {
    label: "삼송전자 기반 회사와 seed 42",
    seed: 42,
    basedOn: "samsong",
    industryId: "ai",
    countryId: "kr",
  },
  {
    label: "페어 기반 회사와 seed 9999",
    seed: 9_999,
    basedOn: "pear",
    industryId: "ai",
    countryId: "us",
  },
] as const;

describe("elementary profile", () => {
  it("keeps the requested economic systems available to elementary players", () => {
    const config = getLevelConfig("elementary");

    expect(config.startingCash).toBe(1_000_000);
    expect(config.adjacencyBonus).toBe(true);
    expect(config.enabledAssets).toEqual(
      expect.arrayContaining(["deposit", "bond", "gold", "fx"]),
    );
    expect(config.enabledEventLayers).toContain("monetary");
    expect(config.showAdvancedMetrics).toBe(true);
  });

  it.each(ELEMENTARY_GAME_CASES)(
    "$label starts with exactly 1,000,000 KRW in the default guided campaign",
    ({ label: _label, ...fixture }) => {
      const state = createGame({
        level: "elementary",
        playerCompanyName: "꿈나무 회사",
        ...fixture,
      });
      const player = state.companies.find(
        (company) => company.id === state.playerCompanyId,
      );

      expect(player).toBeDefined();
      expect(player?.cash).toBe(1_000_000);
      expect(state.gameLength).toBe(50);
      expect(state.maxTurns).toBe(50);
      expect(state.revealMode).toBe("guided");
    },
  );
});

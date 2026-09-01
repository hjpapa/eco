import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_FEATURES,
  FEATURE_UNLOCK_TURNS,
  advanceTurn,
  createGame,
  getCampaignOutcome,
  getCampaignGrowthMultiplier,
  getFeatureUnlockTurn,
  isFeatureUnlocked,
  migrateGameState,
  type CampaignFeature,
  type Character,
  type GameLength,
  type GameState,
} from "./index";
import { runCompanyTurn } from "./company";
import { runAiTurn } from "./ai";
import { generateEvents } from "./events";
import { generateAdvice } from "../advisor";
import { createRng } from "./rng";
import {
  buildBuilding,
  applyCompanyAction,
  buyStock,
  hireCharacter,
  proposeDeal,
  raiseSalary,
} from "./actions";

const LENGTHS = [20, 50, 100] as const satisfies readonly GameLength[];

function game(overrides: Partial<Parameters<typeof createGame>[0]> = {}): GameState {
  return createGame({
    level: "elementary",
    seed: 1234,
    playerCompanyName: "초록회사",
    industryId: "tech",
    countryId: "kr",
    ...overrides,
  });
}

describe("campaign defaults and feature reveals", () => {
  it("starts new games as 50-turn guided campaigns", () => {
    const state = game();
    expect(state.gameLength).toBe(50);
    expect(state.maxTurns).toBe(50);
    expect(state.revealMode).toBe("guided");
  });

  it("keeps higher difficulty defaults as 100-turn fully-open campaigns", () => {
    for (const level of ["middle", "university"] as const) {
      const state = game({ level });
      expect(state.gameLength).toBe(100);
      expect(state.maxTurns).toBe(100);
      expect(state.revealMode).toBe("all");
    }
  });

  it("uses the exact fixed unlock schedule at each boundary", () => {
    const expected: Record<CampaignFeature, Record<GameLength, number>> = {
      company: { 20: 0, 50: 0, 100: 0 },
      buildingsResearch: { 20: 2, 50: 5, 100: 10 },
      investment: { 20: 4, 50: 10, 100: 20 },
      talentNewsRanking: { 20: 7, 50: 18, 100: 35 },
      visitsPartnershipsAdvanced: { 20: 10, 50: 25, 100: 50 },
    };
    expect(FEATURE_UNLOCK_TURNS).toEqual(expected);

    for (const gameLength of LENGTHS) {
      for (const feature of CAMPAIGN_FEATURES) {
        const unlockTurn = getFeatureUnlockTurn(gameLength, feature);
        const progress = { gameLength, revealMode: "guided" as const, turn: unlockTurn };
        expect(isFeatureUnlocked(progress, feature)).toBe(true);
        if (unlockTurn > 0) {
          expect(isFeatureUnlocked({ ...progress, turn: unlockTurn - 1 }, feature)).toBe(false);
        }
      }
    }
  });

  it("opens every feature immediately in all mode", () => {
    const state = game({ gameLength: 100, revealMode: "all" });
    for (const feature of CAMPAIGN_FEATURES) {
      expect(isFeatureUnlocked(state, feature)).toBe(true);
    }
  });

  it("enforces guided reveals in engine actions as well as navigation", () => {
    const state = game({ gameLength: 20, revealMode: "guided" });
    const company = state.companies[0];
    company.cash = 10_000_000;

    expect(buildBuilding(state, company, "store", 2, 0).ok).toBe(false);
    state.turn = 2;
    expect(buildBuilding(state, company, "store", 2, 0).ok).toBe(true);

    state.turn = 3;
    expect(buyStock(state, company, state.companies[1].id, 1).ok).toBe(false);
    state.turn = 4;
    expect(buyStock(state, company, state.companies[1].id, 1).ok).toBe(true);

    state.turn = 6;
    expect(hireCharacter(state, company, state.talentPool[0].id).ok).toBe(false);
    company.hired = [strongLeader()];
    expect(raiseSalary(state, company, company.hired[0].id, 10_000, 0).ok).toBe(false);
    state.turn = 7;
    expect(hireCharacter(state, company, state.talentPool[0].id).ok).toBe(true);
    expect(raiseSalary(state, company, company.hired[0].id, 10_000, 0).ok).toBe(true);

    state.turn = 9;
    expect(proposeDeal(state, company, state.companies[1].id, "partner").ok).toBe(false);
    state.turn = 10;
    expect(proposeDeal(state, company, state.companies[1].id, "partner").ok).toBe(true);
  });

  it("keeps visitor events out of the engine until the exact reveal boundary", () => {
    const state = game({ gameLength: 20, revealMode: "guided" });
    state.config = { ...state.config, enabledEventLayers: ["visitor"] };
    state.turn = 8;
    const talentCount = state.talentPool.length;

    expect(generateEvents(state)).toEqual([]);
    expect(state.talentPool).toHaveLength(talentCount);
    expect(state.companies.every((company) => company.visitor == null)).toBe(true);

    state.turn = 9;
    expect(generateEvents(state).length).toBeGreaterThan(0);
  });

  it("does not let AI research before the player research controls unlock", () => {
    const state = game({ gameLength: 20, revealMode: "guided" });
    const ai = state.companies.find((company) => company.isAI)!;
    runAiTurn(state, ai);
    expect(ai.decisions.rndBudget).toBe(0);

    state.turn = 2;
    runAiTurn(state, ai);
    expect(ai.decisions.rndBudget).toBeGreaterThan(0);
  });

  it("keeps secretary advice within the features learned so far", () => {
    const state = game({ gameLength: 20, revealMode: "guided" });
    const earlyAdvice = Array.from({ length: 20 }, () => generateAdvice(state))
      .flat()
      .map((item) => item.text)
      .join(" ");

    expect(earlyAdvice).not.toMatch(/현재 \d+위|1위|R&D|연구동|건물을|인재 시장|투자 탭|기준금리|인플레이션|불황기|강세장/);

    state.turn = 4;
    const player = state.companies.find((company) => company.isPlayer)!;
    player.cash = 10_000;
    player.profitHistory = [20_000, 30_000];
    const middleAdvice = Array.from({ length: 20 }, () => generateAdvice(state))
      .flat()
      .map((item) => item.text)
      .join(" ");
    expect(middleAdvice).not.toMatch(/대출|인재|현재 \d+위|1위|기준금리|인플레이션|불황기|강세장/);
  });
});

describe("campaign lifecycle", () => {
  for (const gameLength of LENGTHS) {
    it(`ends a ${gameLength}-turn campaign exactly at its limit`, () => {
      const state = game({ gameLength });
      for (let turn = 0; turn < gameLength - 1; turn += 1) advanceTurn(state);
      expect(state.turn).toBe(gameLength - 1);
      expect(state.status).toBe("playing");

      advanceTurn(state);
      expect(state.turn).toBe(gameLength);
      expect(state.status).toBe("ended");

      advanceTurn(state);
      expect(state.turn).toBe(gameLength);
    });
  }
});

describe("short-campaign growth", () => {
  it("uses 2.0, 1.4 and 1.0 growth multipliers", () => {
    expect(getCampaignGrowthMultiplier(20)).toBe(2);
    expect(getCampaignGrowthMultiplier(50)).toBe(1.4);
    expect(getCampaignGrowthMultiplier(100)).toBe(1);
  });

  it("scales only positive quality, reputation and talent development", () => {
    const state = game({ gameLength: 100 });
    const source = state.companies[0];
    source.cash = 10_000_000;
    source.decisions.rndBudget = 300_000;
    source.hired = [strongLeader()];

    const normal = structuredClone(source);
    const fast = structuredClone(source);
    const fastAi = structuredClone(source);
    fastAi.isPlayer = false;
    fastAi.isAI = true;

    const normalResult = runCompanyTurn(
      normal,
      structuredClone(state.macro),
      state.config,
      createRng(99),
      undefined,
      1,
    );
    const fastResult = runCompanyTurn(
      fast,
      structuredClone(state.macro),
      state.config,
      createRng(99),
      undefined,
      2,
    );
    runCompanyTurn(
      fastAi,
      structuredClone(state.macro),
      state.config,
      createRng(99),
      undefined,
      2,
    );

    expect(fast.quality - source.quality).toBeCloseTo((normal.quality - source.quality) * 2, 8);
    expect(fast.reputation - source.reputation).toBeCloseTo(
      (normal.reputation - source.reputation) * 2,
      8,
    );
    expect((fast.hired[0].loyalty ?? 0) - (source.hired[0].loyalty ?? 0)).toBeCloseTo(
      ((normal.hired[0].loyalty ?? 0) - (source.hired[0].loyalty ?? 0)) * 2,
      8,
    );

    // Cash, revenue, production, morale and safety are deliberately unscaled.
    expect(fast.cash).toBeCloseTo(normal.cash, 8);
    expect(fastResult).toEqual(normalResult);
    expect(fast.morale).toBeCloseTo(normal.morale, 8);
    expect(fast.safety).toBeCloseTo(normal.safety, 8);

    // Company resolution applies the same rules regardless of player/AI flag.
    expect(fastAi.quality).toBeCloseTo(fast.quality, 8);
    expect(fastAi.reputation).toBeCloseTo(fast.reputation, 8);
    expect(fastAi.hired[0].loyalty ?? 0).toBeCloseTo(fast.hired[0].loyalty ?? 0, 8);
  });

  it("uses the same action growth rule for player and AI companies", () => {
    const state = game({ gameLength: 20, revealMode: "all" });
    const player = state.companies.find((company) => company.isPlayer)!;
    const ai = state.companies.find((company) => company.isAI)!;
    player.cash = ai.cash = 1_000_000;
    player.quality = ai.quality = 40;

    expect(applyCompanyAction(state, player, "rnd_basic").ok).toBe(true);
    expect(applyCompanyAction(state, ai, "rnd_basic").ok).toBe(true);
    expect(player.quality).toBe(46);
    expect(ai.quality).toBe(46);
  });
});

describe("save migration and outcomes", () => {
  it("migrates an existing save to 100 turns with every feature open", () => {
    const current = game({ gameLength: 50, revealMode: "guided" });
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    legacy.version = 1;
    legacy.maxTurns = 50;
    delete legacy.gameLength;
    delete legacy.revealMode;
    delete legacy.initialPlayerRank;
    delete legacy.initialPlayerNetWorth;

    const migrated = migrateGameState(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated?.gameLength).toBe(100);
    expect(migrated?.maxTurns).toBe(100);
    expect(migrated?.revealMode).toBe("all");
    expect(migrated?.initialPlayerRank).toBeGreaterThan(0);
    expect(migrated?.initialPlayerNetWorth).toBeGreaterThan(0);
    for (const feature of CAMPAIGN_FEATURES) {
      expect(isFeatureUnlocked(migrated!, feature)).toBe(true);
    }
  });

  it("preserves campaign settings on current saves", () => {
    const current = game({ gameLength: 20, revealMode: "guided" });
    current.turn = 7;
    const migrated = migrateGameState(structuredClone(current));
    expect(migrated?.gameLength).toBe(20);
    expect(migrated?.maxTurns).toBe(20);
    expect(migrated?.revealMode).toBe("guided");
    expect(migrated?.turn).toBe(7);
  });

  it("keeps first place as the top reward and reports complementary badges", () => {
    const state = game({ gameLength: 20 });
    const company = state.companies.find((item) => item.id === state.playerCompanyId)!;
    state.initialPlayerRank = state.companies.length;
    state.initialPlayerNetWorth = 1;
    company.cash = 1_000_000_000_000;
    company.quality = 80;
    company.reputation = 80;
    company.morale = 80;
    company.safety = 80;

    const outcome = getCampaignOutcome(state);
    expect(outcome.finalRank).toBe(1);
    expect(outcome.rewardTier).toBe("gold");
    expect(outcome.isChampion).toBe(true);
    expect(outcome.rankGain).toBeGreaterThan(0);
    expect(outcome.netWorthGrowth).toBeGreaterThan(0);
    expect(outcome.badges.every((badge) => badge.earned)).toBe(true);
  });
});

function strongLeader(): Character {
  return {
    id: "test-leader",
    name: "테스트 리더",
    avatar: "🧑‍💼",
    preferredRole: "ceo",
    role: "ceo",
    stats: {
      management: 100,
      tech: 100,
      creativity: 100,
      finance: 100,
      leadership: 100,
      marketing: 100,
    },
    trait: "eager",
    traitName: "열정러",
    traitDesc: "테스트",
    rarity: "common",
    salary: 0,
    loyalty: 50,
  };
}

import { netWorth, playerRank } from "./ranking";
import { getLevelConfig } from "./levels";
import { mergeAssetCatalogMetadata } from "./assets";
import type {
  CampaignFeature,
  Company,
  GameLength,
  GameState,
  RevealMode,
} from "./types";

export const GAME_VERSION = 3;
export const DEFAULT_GAME_LENGTH: GameLength = 50;
export const DEFAULT_REVEAL_MODE: RevealMode = "guided";

export const GAME_LENGTHS = [20, 50, 100] as const satisfies readonly GameLength[];

export const CAMPAIGN_FEATURES = [
  "company",
  "buildingsResearch",
  "investment",
  "talentNewsRanking",
  "visitsPartnershipsAdvanced",
] as const satisfies readonly CampaignFeature[];

/** Fixed reveal schedule from the elementary guided-mode design. */
export const FEATURE_UNLOCK_TURNS: Record<CampaignFeature, Record<GameLength, number>> = {
  company: { 20: 0, 50: 0, 100: 0 },
  buildingsResearch: { 20: 2, 50: 5, 100: 10 },
  investment: { 20: 4, 50: 10, 100: 20 },
  talentNewsRanking: { 20: 7, 50: 18, 100: 35 },
  visitsPartnershipsAdvanced: { 20: 10, 50: 25, 100: 50 },
};

export const CAMPAIGN_GROWTH_MULTIPLIERS: Record<GameLength, number> = {
  20: 2,
  50: 1.4,
  100: 1,
};

export function isGameLength(value: unknown): value is GameLength {
  return value === 20 || value === 50 || value === 100;
}

export function isRevealMode(value: unknown): value is RevealMode {
  return value === "guided" || value === "all";
}

export function getFeatureUnlockTurn(
  gameLength: GameLength,
  feature: CampaignFeature,
): number {
  return FEATURE_UNLOCK_TURNS[feature][gameLength];
}

export function isFeatureUnlocked(
  game: Pick<GameState, "gameLength" | "revealMode" | "turn">,
  feature: CampaignFeature,
): boolean {
  return (
    game.revealMode === "all" ||
    game.turn >= getFeatureUnlockTurn(game.gameLength, feature)
  );
}

export function getUnlockedFeatures(
  game: Pick<GameState, "gameLength" | "revealMode" | "turn">,
): CampaignFeature[] {
  return CAMPAIGN_FEATURES.filter((feature) => isFeatureUnlocked(game, feature));
}

export function getCampaignGrowthMultiplier(
  game: Pick<GameState, "gameLength"> | GameLength,
): number {
  const gameLength = typeof game === "number" ? game : game.gameLength;
  return CAMPAIGN_GROWTH_MULTIPLIERS[gameLength];
}

export interface CampaignGrowthSnapshot {
  quality: number;
  reputation: number;
  loyaltyById: Record<string, number>;
}

/** Capture only the three positive-growth dimensions affected by campaign speed. */
export function captureCampaignGrowth(company: Company): CampaignGrowthSnapshot {
  return {
    quality: company.quality,
    reputation: company.reputation,
    loyaltyById: Object.fromEntries(
      company.hired.map((character) => [character.id, character.loyalty ?? 70]),
    ),
  };
}

/**
 * Scale positive growth created by a single action/event. Losses and every
 * other company statistic remain untouched. Taking a snapshot around each
 * mutation avoids double-scaling the normal per-turn growth path.
 */
export function applyCampaignGrowthMultiplier(
  game: Pick<GameState, "gameLength">,
  company: Company,
  before: CampaignGrowthSnapshot,
): void {
  const multiplier = getCampaignGrowthMultiplier(game);
  if (multiplier === 1) return;
  company.quality = scaledPositiveResult(before.quality, company.quality, multiplier);
  company.reputation = scaledPositiveResult(before.reputation, company.reputation, multiplier);
  for (const character of company.hired) {
    const prior = before.loyaltyById[character.id];
    if (prior == null) continue;
    character.loyalty = scaledPositiveResult(prior, character.loyalty ?? 70, multiplier);
  }
}

function scaledPositiveResult(before: number, after: number, multiplier: number): number {
  if (after <= before) return after;
  return Math.min(100, before + (after - before) * multiplier);
}

export type CampaignBadgeId =
  | "champion"
  | "rankClimber"
  | "wealthBuilder"
  | "balancedCompany";

export interface CampaignBadge {
  id: CampaignBadgeId;
  label: string;
  emoji: string;
  description: string;
  earned: boolean;
}

export interface CampaignOutcome {
  finalRank: number;
  initialRank: number;
  rankGain: number;
  finalNetWorth: number;
  initialNetWorth: number;
  netWorthGrowth: number;
  netWorthGrowthRate: number;
  isChampion: boolean;
  rewardTier: "gold" | "silver" | "bronze" | "participant";
  badges: CampaignBadge[];
}

/**
 * Summarise several kinds of progress, while keeping first place as the
 * strongest result. This helper is pure, so both the end screen and tests can
 * use the exact same badge rules.
 */
export function getCampaignOutcome(state: GameState): CampaignOutcome {
  const company = state.companies.find((item) => item.id === state.playerCompanyId);
  if (!company) throw new Error("플레이어 회사를 찾을 수 없습니다.");

  const finalRank = playerRank(state);
  const finalNetWorth = netWorth(company, state);
  const initialRank = Math.max(1, state.initialPlayerRank || finalRank);
  const initialNetWorth = state.initialPlayerNetWorth || finalNetWorth;
  const rankGain = Math.max(0, initialRank - finalRank);
  const netWorthGrowth = finalNetWorth - initialNetWorth;
  const netWorthGrowthRate = initialNetWorth > 0 ? netWorthGrowth / initialNetWorth : 0;
  const isChampion = finalRank === 1;
  const isBalanced = [
    company.quality,
    company.reputation,
    company.morale,
    company.safety,
  ].every((score) => score >= 60);

  const badges: CampaignBadge[] = [
    {
      id: "champion",
      label: "최고의 회사",
      emoji: "🏆",
      description: "최종 순위 1위를 달성했어요.",
      earned: isChampion,
    },
    {
      id: "rankClimber",
      label: "순위 상승",
      emoji: "🪜",
      description: "시작할 때보다 순위가 올랐어요.",
      earned: rankGain > 0,
    },
    {
      id: "wealthBuilder",
      label: "튼튼한 성장",
      emoji: "🌱",
      description: "내 총재산(순자산)이 시작할 때보다 늘었어요.",
      earned: netWorthGrowth > 0,
    },
    {
      id: "balancedCompany",
      label: "균형 잡힌 회사",
      emoji: "⚖️",
      description: "품질·평판·직원 만족·안전을 모두 60 이상으로 키웠어요.",
      earned: isBalanced,
    },
  ];

  const rewardTier = isChampion
    ? "gold"
    : finalRank <= 3
      ? "silver"
      : badges.some((badge) => badge.earned)
        ? "bronze"
        : "participant";

  return {
    finalRank,
    initialRank,
    rankGain,
    finalNetWorth,
    initialNetWorth,
    netWorthGrowth,
    netWorthGrowthRate,
    isChampion,
    rewardTier,
    badges,
  };
}

/**
 * Upgrade a persisted game without allowing old menus to become locked.
 * Version-1 saves predate campaigns, so they deliberately become 100-turn
 * expert campaigns (`all`) as specified in the migration policy.
 */
export function migrateGameState(value: unknown): GameState | null {
  if (!isGameStateLike(value)) return null;

  const raw = value as GameState & Partial<Pick<GameState,
    "gameLength" | "revealMode" | "initialPlayerRank" | "initialPlayerNetWorth"
  >>;
  const legacyCampaign = !isGameLength(raw.gameLength);
  const gameLength: GameLength = legacyCampaign ? 100 : raw.gameLength;
  const revealMode: RevealMode = legacyCampaign
    ? "all"
    : isRevealMode(raw.revealMode)
      ? raw.revealMode
      : "all";
  const refreshElementary = needsElementaryV3Refresh(raw);
  const config = refreshElementary ? refreshedElementaryConfig(raw) : raw.config;
  const assets = refreshElementary
    ? mergeAssetCatalogMetadata(raw.assets)
    : raw.assets;

  const migrated: GameState = {
    ...raw,
    version: GAME_VERSION,
    config,
    assets,
    gameLength,
    revealMode,
    maxTurns: legacyCampaign ? 100 : raw.maxTurns,
    initialPlayerRank: raw.initialPlayerRank ?? safePlayerRank(raw),
    initialPlayerNetWorth: raw.initialPlayerNetWorth ?? initialNetWorth(raw),
  };

  if (migrated.turn >= migrated.maxTurns) migrated.status = "ended";
  return migrated;
}

/**
 * Version 3 expands the elementary curriculum. Existing elementary games keep
 * their live company balances, turn and chosen map size while receiving the
 * current feature catalog and difficulty settings.
 */
function refreshedElementaryConfig(state: GameState): GameState["config"] {
  const current = getLevelConfig("elementary");
  return {
    ...current,
    mapSize:
      typeof state.config.mapSize === "number"
        ? state.config.mapSize
        : current.mapSize,
  };
}

function needsElementaryV3Refresh(state: GameState): boolean {
  return (
    state.level === "elementary" &&
    (typeof state.version !== "number" || state.version < GAME_VERSION)
  );
}

function isGameStateLike(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  return (
    typeof state.turn === "number" &&
    typeof state.maxTurns === "number" &&
    typeof state.playerCompanyId === "string" &&
    Array.isArray(state.companies) &&
    !!state.config &&
    !!state.stocks &&
    !!state.assets
  );
}

function safePlayerRank(state: GameState): number {
  try {
    return playerRank(state) || 1;
  } catch {
    return 1;
  }
}

function initialNetWorth(state: GameState): number {
  const company = state.companies.find((item) => item.id === state.playerCompanyId);
  if (!company) return 0;
  const recorded = company.netWorthHistory?.[0];
  if (typeof recorded === "number") return recorded;
  try {
    return netWorth(company, state);
  } catch {
    return company.cash ?? 0;
  }
}

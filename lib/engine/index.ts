import type {
  Company,
  GameLength,
  GameState,
  Level,
  PlacedBuilding,
  RevealMode,
} from "./types";
import { createRng, nextRange, type RngState } from "./rng";
import { getLevelConfig } from "./levels";
import { getIndustry, INDUSTRIES } from "../data/industries";
import { getCountry } from "../data/countries";
import { COMPANY_PRESETS, PRESET_MAP, type CompanyPreset } from "../data/companyPresets";
import { createMacro } from "./economy";
import { createStocks, createExternalStocks } from "./market";
import { createAssets } from "./assets";
import { buildTalentPool } from "./characters";
import { createRelations } from "./relations";
import { defaultDecisions, productionCapacity } from "./company";
import { shuffle } from "./rng";
import { netWorth, playerRank, recordNetWorth } from "./ranking";
import { getIndustryProducts } from "../data/products";
import {
  DEFAULT_GAME_LENGTH,
  DEFAULT_REVEAL_MODE,
  GAME_VERSION,
  isGameLength,
} from "./campaign";

export { GAME_VERSION } from "./campaign";
export const DEFAULT_MAX_TURNS = DEFAULT_GAME_LENGTH;

export interface NewGameOptions {
  level: Level;
  seed?: number;
  playerCompanyName: string;
  industryId: string;
  countryId: string;
  logoColor?: string;
  basedOn?: string; // preset id
  gameLength?: GameLength;
  revealMode?: RevealMode;
  /** @deprecated Prefer gameLength. Kept for compatible custom/test games. */
  maxTurns?: number;
  mapSize?: number; // override level default (5=small, 8=medium, 12=large)
}

let companyCounter = 0;

/** Pick `count` presets with at most one per industry (guaranteed diversity). */
function selectDiversePresets(
  rng: RngState,
  presets: CompanyPreset[],
  excludeId: string | undefined,
  count: number,
): CompanyPreset[] {
  const pool = presets.filter((p) => p.id !== excludeId);
  const byIndustry = new Map<string, CompanyPreset[]>();
  for (const p of pool) {
    if (!byIndustry.has(p.industryId)) byIndustry.set(p.industryId, []);
    byIndustry.get(p.industryId)!.push(p);
  }
  const industries = shuffle(rng, [...byIndustry.keys()]);
  // Shuffle each industry bucket up front so picks are random but stable.
  const buckets = new Map([...byIndustry].map(([k, v]) => [k, shuffle(rng, v)]));
  const used = new Set<string>();
  const picked: CompanyPreset[] = [];

  // Pass 1: one company per industry for variety.
  for (const ind of industries) {
    if (picked.length >= count) break;
    const p = buckets.get(ind)![0];
    picked.push(p);
    used.add(p.id);
  }
  // Pass 2: fill the rest from all remaining presets (multiple per industry OK).
  if (picked.length < count) {
    const rest = shuffle(rng, pool.filter((p) => !used.has(p.id)));
    for (const p of rest) {
      if (picked.length >= count) break;
      picked.push(p);
      used.add(p.id);
    }
  }
  return picked;
}

/**
 * Starter buildings sit in the middle of the campus so the first view shows
 * them up close and every direction stays open for the city to grow.
 */
function starterBuildings(mapSize: number): PlacedBuilding[] {
  const mk = (type: PlacedBuilding["type"], x: number, y: number): PlacedBuilding => ({
    id: `start-${companyCounter}-${type}`,
    type,
    level: 1,
    x,
    y,
    turnsLeft: 0, // starter buildings are operational immediately
  });
  const center = Math.max(0, Math.floor((mapSize - 1) / 2));
  return [mk("factory", center, center), mk("office", center + 1, center)];
}

function makeCompany(opts: {
  name: string;
  industryId: string;
  countryId: string;
  logoColor: string;
  isPlayer: boolean;
  cash: number;
  scale: number;
  mapSize: number;
  basedOn?: string;
}): Company {
  const id = `co-${companyCounter++}`;
  const industry = getIndustry(opts.industryId);
  return {
    id,
    name: opts.name,
    logoColor: opts.logoColor,
    industryId: opts.industryId,
    countryId: opts.countryId,
    isPlayer: opts.isPlayer,
    isAI: !opts.isPlayer,
    basedOn: opts.basedOn,

    cash: Math.round(opts.cash),
    debt: 0,
    inventory: 0,
    employees: 10,
    reputation: Math.min(70, 45 + opts.scale * 8),
    morale: 60,
    quality: Math.min(60, 15 + opts.scale * 8),
    safety: 60,

    decisions: defaultDecisions(industry),
    buildings: starterBuildings(opts.mapSize),
    hired: [],

    lastRevenue: 0,
    lastProfit: 0,
    profitHistory: [],
    netWorthHistory: [],

    portfolio: { stocks: {}, assets: {} },

    productPrices: getIndustryProducts(opts.industryId).map((p, i) =>
      i < 3 ? Math.round(industry.basePrice * p.priceRatio) : 0
    ),
    productEnabled: getIndustryProducts(opts.industryId).map((_, i) => i === 0),
    productInventory: getIndustryProducts(opts.industryId).map(() => 0),
    rndUnlockDone: false,
  };
}

export function createGame(opts: NewGameOptions): GameState {
  companyCounter = 0;
  const baseConfig = getLevelConfig(opts.level);
  const config = opts.mapSize
    ? { ...baseConfig, mapSize: opts.mapSize }
    : baseConfig;
  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000) + 1;
  const rng = createRng(seed);
  // Guided 50-turn onboarding is the elementary default. Existing higher
  // difficulty modes keep their original long, fully-open campaign unless a
  // player explicitly chooses otherwise in setup.
  const levelDefaultLength: GameLength = opts.level === "elementary" ? DEFAULT_GAME_LENGTH : 100;
  const gameLength =
    opts.gameLength ??
    (isGameLength(opts.maxTurns) ? opts.maxTurns : levelDefaultLength);

  const playerColor = opts.logoColor ?? "#6366f1";
  const playerScale = opts.basedOn ? PRESET_MAP[opts.basedOn]?.scale ?? 1 : 1;

  const player = makeCompany({
    name: opts.playerCompanyName || "내 회사",
    industryId: opts.industryId,
    countryId: opts.countryId,
    logoColor: playerColor,
    isPlayer: true,
    // Every player starts with the configured amount. Preset scale still
    // shapes the company's initial capabilities, but never its cash balance.
    cash: config.startingCash,
    scale: playerScale,
    mapSize: config.mapSize,
    basedOn: opts.basedOn,
  });

  // Build AI competitors ensuring one company per industry (diverse competition).
  const aiPresets = selectDiversePresets(rng, COMPANY_PRESETS, opts.basedOn, config.aiCount);

  const aiCompanies: Company[] = aiPresets.map((p) =>
    makeCompany({
      name: p.name,
      industryId: p.industryId,
      countryId: p.countryId,
      logoColor: p.logoColor,
      isPlayer: false,
      cash: config.startingCash * p.scale * nextRange(rng, 0.85, 1.15),
      scale: p.scale,
      mapSize: config.mapSize,
      basedOn: p.id,
    }),
  );

  // Fall back to random industries if there aren't enough presets.
  while (aiCompanies.length < config.aiCount) {
    const ind = INDUSTRIES[aiCompanies.length % INDUSTRIES.length];
    aiCompanies.push(
      makeCompany({
        name: `${ind.name} 컴퍼니 ${aiCompanies.length + 1}`,
        industryId: ind.id,
        countryId: "us",
        logoColor: "#888888",
        isPlayer: false,
        cash: config.startingCash * nextRange(rng, 0.85, 1.15),
        scale: 1,
        mapSize: config.mapSize,
      }),
    );
  }

  const companies = [player, ...aiCompanies];
  // Start with a plan the starter factory can actually make.
  for (const company of companies) {
    company.decisions.productionTarget = Math.min(
      company.decisions.productionTarget,
      productionCapacity(company, config),
    );
  }

  const state: GameState = {
    version: GAME_VERSION,
    seed,
    rng,
    level: opts.level,
    config,
    turn: 0,
    maxTurns: opts.maxTurns ?? gameLength,
    gameLength,
    revealMode: opts.revealMode ?? (opts.level === "elementary" ? DEFAULT_REVEAL_MODE : "all"),
    initialPlayerRank: 0,
    initialPlayerNetWorth: 0,
    status: "playing",
    macro: createMacro(getCountry(opts.countryId), rng),
    companies,
    playerCompanyId: player.id,
    stocks: { ...createStocks(companies), ...createExternalStocks(companies, rng) },
    assets: createAssets(),
    talentPool: buildTalentPool(rng, 8),
    relations: createRelations(companies),
    news: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  recordNetWorth(state);
  state.initialPlayerRank = playerRank(state);
  state.initialPlayerNetWorth = netWorth(player, state);
  return state;
}

// Re-exports for convenient importing from the UI layer.
export * from "./types";
export * from "./campaign";
export * from "./health";
export { advanceTurn } from "./tick";
export { rankings, netWorth, portfolioValue, playerRank } from "./ranking";
export {
  fundamentalValue,
  stockMetrics,
  classifyStockKind,
  STOCK_KIND_LABELS,
  TREASURY_RATIO,
  type StockMetrics,
} from "./market";
export { LEVEL_CONFIGS, getLevelConfig } from "./levels";
export { PHASE_LABELS, PHASE_EMOJI } from "./economy";
export { LAYER_LABELS } from "./events";
export {
  ADJACENCY_PAIRS,
  BASE_EXECUTIVE_SLOTS,
  BUILDING_COMBOS,
  BUILDINGS,
  BUILDING_LIST,
  buildingConstructionCost,
  buildingCostFor,
  buildingSellRefund,
  executiveSlots,
  type BuildingComboDef,
  countAdjacencyPairs,
  evaluateBuildingPlacement,
  findBestBuildingCell,
  getActiveBuildingCombos,
  totalUpkeep,
} from "./buildings";
export { ROLE_LABELS, roleBonuses } from "./characters";
export {
  productionCapacity,
  factoryCapacity,
  estimateDemand,
  marketAttractiveness,
  defaultDecisions,
  campusDemandBoost,
  moraleProductivity,
  productMix,
  projectCompanyTurn,
  type ProductMix,
  type TurnProjection,
} from "./company";
export * from "./planning";
export * from "./actions";

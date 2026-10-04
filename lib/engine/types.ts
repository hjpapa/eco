// Central type contract for the Dragon Mountain City simulation engine.
// Pure data only — no React, no DB.

import type { RngState } from "./rng";

export type Level = "elementary" | "middle" | "university";

/** Supported campaign lengths, expressed in game quarters. */
export type GameLength = 20 | 50 | 100;

/** Guided campaigns reveal systems gradually; all keeps every menu available. */
export type RevealMode = "guided" | "all";

export type GameEndReason = "completed" | "insolvent";

/** Coarse feature groups used by navigation and the guided reveal schedule. */
export type CampaignFeature =
  | "company"
  | "research"
  | "investment"
  | "talentNewsRanking"
  | "visitsPartnershipsAdvanced";

// ---------------------------------------------------------------------------
// Macro economy
// ---------------------------------------------------------------------------

export type EconomyPhase =
  | "boom"
  | "normal"
  | "recession"
  | "inflation"
  | "deflation"
  | "stagflation";

/** One turn is one season (3 months); four turns make a year. */
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface MacroState {
  phase: EconomyPhase;
  gdpGrowth: number; // %
  inflation: number; // %
  interestRate: number; // central-bank policy rate, %
  sentiment: number; // market mood, -1..1
  phaseTurnsLeft: number; // turns until the current phase may shift
  /** Season of the turn being played. Missing on older saves (= from the turn). */
  season?: Season;
}

// ---------------------------------------------------------------------------
// Static catalog definitions (industries / countries / buildings / characters)
// ---------------------------------------------------------------------------

export interface IndustryDef {
  id: string;
  name: string;
  emoji: string;
  startCapital: number;
  unitCost: number; // base production cost per unit
  basePrice: number; // base selling price per unit
  baseDemand: number; // units demanded at base price
  demandElasticity: number; // how strongly price affects demand
  volatility: number; // stock-price volatility multiplier
  rndDependence: number; // 0..1, how much R&D matters
  trend: number; // baseline drift bias
  /** Event tag -> impact multiplier for this industry. */
  sensitivities: Record<string, number>;
  modern?: boolean; // cutting-edge theme industry (AI/space/robot...)
}

export interface CountryDef {
  id: string;
  name: string;
  flag: string;
  currency: string;
  centralBank: string;
  baseGrowth: number;
  baseInflation: number;
  baseRate: number;
  taxRate: number; // 0..1
  laborCost: number; // multiplier around 1.0
  marketSize: number; // demand multiplier around 1.0
  regulation: number; // 0..1
}

export type BuildingType =
  | "factory"
  | "rnd"
  | "office"
  | "warehouse"
  | "store"
  | "power"
  | "hr"
  | "park"
  | "cafeteria"
  | "dorm"
  | "gym"
  | "daycare"
  | "clinic"
  | "lab"
  | "fountain"
  | "statue"
  | "clocktower"
  | "ferris"
  /** A home for village residents (the village layer, see village.ts). */
  | "house"
  // Decorations (꾸미기): cheap, no upkeep, only cheer up nearby homes.
  | "flowerbed"
  | "bench"
  | "streetlamp"
  | "bigtree"
  | "pond"
  | "carousel"
  | "noticeboard"
  | "balloon"
  | "cherrytree"
  | "parasol"
  | "pumpkin"
  | "snowman";

export interface CompanyCapabilities {
  productionCapacity: number;
  productionEfficiency: number; // 0..1 cost reduction
  rndPower: number;
  marketingReach: number;
  logistics: number;
  hiringCap: number;
  morale: number;
  reputation: number;
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  emoji: string;
  cost: number;
  buildTurns: number;
  upkeep: number;
  maxLevel: number;
  /** Capability contribution per building level. */
  effects: Partial<CompanyCapabilities>;
  description: string;
  /** City score needed before this building can be built (0 = from the start). */
  unlockCityScore?: number;
  /** Alternatively, a village star rating that also opens it (see village.ts). */
  unlockStars?: number;
  /** A decoration: no upkeep, no level-ups, not counted in the city score. */
  decor?: boolean;
  /** Only sold in this season (it stays once placed). */
  season?: Season;
  /** Decorative city landmark rather than a working company building. */
  landmark?: boolean;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number; // 1..maxLevel
  x: number;
  y: number;
  turnsLeft: number; // construction turns remaining; 0 = operational
}

export type CharacterRole = "ceo" | "cto" | "cmo" | "cfo" | "coo" | "chro";

export interface CharacterStats {
  management: number;
  tech: number;
  creativity: number;
  finance: number;
  leadership: number;
  marketing: number;
}

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Character {
  id: string;
  name: string;
  avatar: string; // emoji
  preferredRole: CharacterRole;
  stats: CharacterStats;
  trait: string; // trait id
  traitName: string;
  traitDesc: string;
  rarity: Rarity;
  salary: number; // per turn
  role?: CharacterRole; // assigned role once hired
  loyalty?: number; // 0..100 once hired
}

// ---------------------------------------------------------------------------
// Markets: stocks + other asset classes
// ---------------------------------------------------------------------------

export interface Stock {
  companyId: string;
  price: number;
  history: number[];
  sharesOutstanding: number;
  /** Treasury shares held by the company itself (reduces free float). */
  treasury?: number;
  /** Listings for companies not actively played (presets + extra fictional). */
  external?: boolean;
  name?: string;
  logoColor?: string;
  industryId?: string;
  countryId?: string;
  /** Slowly drifting fundamental baseline used to mean-revert external prices. */
  anchor?: number;
  /** Synthetic baseline return-on-equity for external listings (for PER/PBR/ROE). */
  roeBase?: number;
  /**
   * Investment archetype. Growth stocks swing hard with the economy and rates;
   * dividend stocks are defensive and steady; balanced sit between. Drives how
   * the price reacts to macro conditions and news (see market.tickStocks).
   */
  kind?: StockKind;
  /** Per-turn baseline price support from dividends (0 for growth). */
  dividendYield?: number;
}

export type StockKind = "growth" | "dividend" | "balanced";

export type AssetClass =
  | "bond"
  | "realestate"
  | "gold"
  | "oil"
  | "crypto"
  | "etf"
  | "fx"
  | "deposit";

export interface AssetMarketItem {
  id: AssetClass;
  name: string;
  emoji: string;
  price: number;
  history: number[];
  risk: number; // relative volatility
  desc: string;
}

export interface Portfolio {
  stocks: Record<string, number>; // companyId -> shares held
  /** companyId -> total acquisition cost (cost basis) for average-price display. */
  stockCost?: Record<string, number>;
  assets: Partial<Record<AssetClass, number>>; // assetClass -> units held
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export interface CompanyDecisions {
  price: number; // selling price per unit
  productionTarget: number; // units to attempt to produce
  marketingBudget: number;
  rndBudget: number;
  welfareBudget: number; // raises employee morale
  safetyBudget: number; // raises workplace safety
}

export interface Company {
  id: string;
  name: string;
  logoColor: string;
  industryId: string;
  countryId: string;
  isPlayer: boolean;
  isAI: boolean;
  basedOn?: string; // preset id, if modelled on a real company

  cash: number;
  debt: number;
  inventory: number;
  employees: number;
  reputation: number; // 0..100
  morale: number; // 0..100
  quality: number; // product quality / tech level, grows with R&D
  safety: number; // 0..100, affects accident/recall risk

  decisions: CompanyDecisions;
  buildings: PlacedBuilding[];
  hired: Character[];

  lastRevenue: number;
  lastProfit: number;
  profitHistory: number[];
  netWorthHistory: number[];

  portfolio: Portfolio;

  /** Per-product prices. Index matches getIndustryProducts(industryId). */
  productPrices: number[];
  /** Which products the player has chosen to actively sell (index matches productPrices). */
  productEnabled: boolean[];
  /** Per-product unsold inventory (index matches productPrices). */
  productInventory: number[];
  /** True once R&D quality threshold (≥75) has been reached to unlock 4th product. */
  rndUnlockDone: boolean;

  /** A notable visitor currently at the campus (cleared each turn). */
  visitor?: VisitorInfo;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventLayer =
  | "macro"
  | "monetary"
  | "geopolitics"
  | "intercompany"
  | "internal"
  | "market"
  | "visitor"
  /** Light-hearted 깜짝 소식 about the student's own company. */
  | "fun";

export type EventTone = "positive" | "negative" | "neutral";

export interface NewsItem {
  id: string;
  turn: number;
  layer: EventLayer;
  tone: EventTone;
  title: string;
  body: string;
  emoji: string;
  /** Large portrait emoji for cut-in style popups (visitors / talent). */
  portrait?: string;
  /** Pixel-art portrait image path (visitor events). */
  portraitImg?: string;
  /** Companies/assets/industries referenced, for UI highlighting. */
  tags: string[];
}

/** A notable outsider visiting a company's campus this quarter. */
export interface VisitorInfo {
  kind: "politician" | "ceo" | "celebrity" | "investor";
  name: string;
  emoji: string;
  turn: number;
  /** Pixel-art portrait image path for 2D UI overlays. */
  portraitImg?: string;
}

// ---------------------------------------------------------------------------
// Relations (between companies and countries)
// ---------------------------------------------------------------------------

export interface RelationState {
  /** "a|b" company-pair key -> rivalry score (-1 ally .. +1 rival). */
  companyRivalry: Record<string, number>;
  /** "a|b" country-pair key -> tension score (-1 allied .. +1 hostile). */
  countryTension: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Level configuration (difficulty presets)
// ---------------------------------------------------------------------------

export interface LevelConfig {
  level: Level;
  label: string;
  description: string;
  mapSize: number; // grid is mapSize x mapSize
  instantBuild: boolean;
  adjacencyBonus: boolean;
  startingCash: number;
  volatility: number; // global multiplier on price moves
  eventIntensity: number; // multiplier on event frequency/strength
  enabledAssets: AssetClass[];
  enabledBuildings: BuildingType[];
  enabledEventLayers: EventLayer[];
  showAdvancedMetrics: boolean; // financials, debt, FX...
  characterDepth: "simple" | "roles" | "full";
  aiCount: number;
}

// ---------------------------------------------------------------------------
// Top-level game state
// ---------------------------------------------------------------------------

export interface GameState {
  version: number;
  seed: number;
  rng: RngState;
  level: Level;
  config: LevelConfig;
  turn: number;
  maxTurns: number;
  gameLength: GameLength;
  revealMode: RevealMode;
  /** Baseline values captured before the first turn for end-of-game progress. */
  initialPlayerRank: number;
  initialPlayerNetWorth: number;
  status: "playing" | "ended";
  /** Why the run ended. Missing on older saves means normal completion. */
  endReason?: GameEndReason;

  macro: MacroState;

  companies: Company[];
  playerCompanyId: string;
  stocks: Record<string, Stock>;
  assets: Record<AssetClass, AssetMarketItem>;
  talentPool: Character[];

  relations: RelationState;
  news: NewsItem[];

  /** Student-only request board (orders and city requests). Missing on old saves. */
  quests?: Quest[];
  /** A pending "사장님의 선택" card, if any. */
  dilemma?: PendingDilemma | null;
  /** Achievements the student has earned, in order. */
  achievements?: EarnedAchievement[];
  questStats?: QuestStats;
  /** Village record: the best star rating reached (its prizes are paid once). */
  village?: { bestStars: number };
  /** Named neighbours living in the village (see residents.ts). */
  residents?: ResidentState[];
  /** Sticker book: "resident:toto", "building:park", "festival:blossom"… */
  stickers?: string[];
  /** Money spent on decorations, for the 기회비용 comparison. */
  decorLog?: { turn: number; cost: number }[];

  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Request board, choices and achievements (student company only)
// ---------------------------------------------------------------------------

/** order: deliver units; build/combo/upgrade/stage: grow the city. */
export type QuestKind = "order" | "build" | "combo" | "upgrade" | "stage";
/** offered → (accept) active → ready → (claim) done; or failed/expired. */
export type QuestStatus = "offered" | "active" | "ready" | "done" | "failed";

export interface QuestReward {
  cash: number;
  reputation?: number;
  morale?: number;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  status: QuestStatus;
  client: string;
  clientEmoji: string;
  title: string;
  detail: string;
  postedTurn: number;
  /** Must be finished before the clock reaches this turn. */
  deadlineTurn: number;
  reward: QuestReward;
  // order
  units?: number;
  unitPrice?: number;
  delivered?: number;
  // build / combo / upgrade / stage
  buildingType?: BuildingType;
  baseline?: number;
  comboId?: string;
  level?: number;
  cityScore?: number;
  /** A village neighbour's wish (a build request in their own words). */
  residentId?: string;
}

/** A named village neighbour (definitions live in lib/data/residents.ts). */
export interface ResidentState {
  id: string;
  /** 0..5; five hearts = best friend. */
  hearts: number;
  movedIn: number;
  /** Favourite buildings counted last turn, to notice a new one. */
  favoriteCount: number;
  /** Turn the neighbour started worrying about moving away. */
  worriedTurn?: number;
  /** Best-friend gift already given. */
  gift?: boolean;
}

export interface PendingDilemma {
  id: string;
  postedTurn: number;
}

export interface EarnedAchievement {
  id: string;
  turn: number;
}

export interface QuestStats {
  completed: number;
  failed: number;
  bigOrders: number;
}

export interface RankingEntry {
  companyId: string;
  name: string;
  logoColor: string;
  isPlayer: boolean;
  netWorth: number;
  cash: number;
  portfolioValue: number;
  companyValue: number;
}

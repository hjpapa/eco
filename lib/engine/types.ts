// Central type contract for the Dragon Mountain City simulation engine.
// Pure data only — no React, no DB. The same types are used by single-player
// (browser) and multiplayer (server-authoritative) code.

import type { RngState } from "./rng";

export type Level = "elementary" | "middle" | "university";

/** Supported campaign lengths, expressed in game quarters. */
export type GameLength = 20 | 50 | 100;

/** Guided campaigns reveal systems gradually; all keeps every menu available. */
export type RevealMode = "guided" | "all";

/** Coarse feature groups used by navigation and the guided reveal schedule. */
export type CampaignFeature =
  | "company"
  | "buildingsResearch"
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

export interface MacroState {
  phase: EconomyPhase;
  gdpGrowth: number; // %
  inflation: number; // %
  interestRate: number; // central-bank policy rate, %
  sentiment: number; // market mood, -1..1
  phaseTurnsLeft: number; // turns until the current phase may shift
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
  | "lab";

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
  | "visitor";

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

  macro: MacroState;

  companies: Company[];
  playerCompanyId: string;
  stocks: Record<string, Stock>;
  assets: Record<AssetClass, AssetMarketItem>;
  talentPool: Character[];

  relations: RelationState;
  news: NewsItem[];

  createdAt: number;
  updatedAt: number;
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

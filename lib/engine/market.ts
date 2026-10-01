import type { Company, IndustryDef, LevelConfig, MacroState, Stock, StockKind } from "./types";
import { BUILDINGS } from "./buildings";
import { getIndustry } from "../data/industries";
import { COMPANY_PRESETS, EXTRA_LISTINGS, type CompanyPreset } from "../data/companyPresets";
import { type RngState, nextGaussian, nextRange } from "./rng";

// Stock market: each company is investable. Prices track a fundamental value
// (derived from profit, cash, quality, reputation, assets) with sentiment and
// a noisy random walk on top. Events apply discrete shocks via `shockStock`.

const SHARES = 1_000; // shares outstanding per company (kept uniform)

/** Every company holds the same fraction of its own shares as treasury stock,
 * so only the remaining "free float" is buyable on the market (no 100% takeover). */
export const TREASURY_RATIO = 0.3;
const TREASURY = Math.round(SHARES * TREASURY_RATIO);

/** Per-share metrics for the trading UI. Works for both real (Company-backed)
 * and synthetic external listings. */
export interface StockMetrics {
  per: number | null;
  pbr: number | null;
  roe: number | null;
}

export function stockMetrics(stock: Stock, company?: Company): StockMetrics {
  const cap = stock.price * stock.sharesOutstanding;
  if (company) {
    const book = fundamentalValue(company); // book value / equity proxy
    const annual = company.lastProfit * 4; // annualised net profit
    return {
      per: annual > 0 ? cap / annual : null,
      pbr: book > 0 ? cap / book : null,
      roe: book > 0 ? (annual / book) * 100 : null,
    };
  }
  // External listing (no Company): synthesise book from the anchor and earnings
  // from a stable baseline ROE so the ratios stay plausible.
  const book = (stock.anchor ?? stock.price) * stock.sharesOutstanding;
  const r = stock.roeBase ?? 0.1;
  const annual = book * r;
  return {
    per: annual > 0 ? cap / annual : null,
    pbr: book > 0 ? cap / book : null,
    roe: r * 100,
  };
}

/** Book/enterprise value of a company, independent of its share price. */
export function fundamentalValue(company: Company): number {
  // Buildings are company property worth what they cost to build, so turning
  // cash into a building is a fair trade; profit decides whether it was wise.
  const buildingsValue = company.buildings
    .filter((b) => b.turnsLeft <= 0)
    .reduce((s, b) => s + BUILDINGS[b.type].cost * b.level, 0);

  const recent = company.profitHistory.slice(-4);
  const avgProfit = recent.length
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : company.lastProfit;

  // Cash raised by a new loan is matched by the same liability. Using the
  // same weight keeps borrowing from creating or destroying value instantly;
  // later interest payments still reduce cash and company value normally.
  const value =
    company.cash * 0.4 -
    company.debt * 0.4 +
    avgProfit * 9 +
    company.quality * 4_000 +
    company.reputation * 2_500 +
    buildingsValue +
    company.employees * 1_500;

  return Math.max(50_000, value);
}

export function createStocks(companies: Company[]): Record<string, Stock> {
  const out: Record<string, Stock> = {};
  for (const c of companies) {
    const price = round2(fundamentalValue(c) / SHARES);
    const kind = classifyStockKind(getIndustry(c.industryId));
    out[c.id] = {
      companyId: c.id,
      price: Math.max(5, price),
      history: [Math.max(5, price)],
      sharesOutstanding: SHARES,
      treasury: TREASURY,
      kind,
      dividendYield: defaultYield(kind),
    };
  }
  return out;
}

const EXT_BASE_VALUE = 700_000; // synthetic enterprise value base for listings

/**
 * Build the broader market: every company preset that is NOT an active in-game
 * competitor, plus extra fictional listings. These are fully investable but
 * have no Company object, so prices follow a synthetic anchor + random walk.
 */
export function createExternalStocks(
  companies: Company[],
  rng: RngState,
): Record<string, Stock> {
  const taken = new Set(companies.map((c) => c.basedOn).filter(Boolean) as string[]);
  const listings: CompanyPreset[] = [
    ...COMPANY_PRESETS.filter((p) => !taken.has(p.id)),
    ...EXTRA_LISTINGS,
  ];
  const out: Record<string, Stock> = {};
  for (const p of listings) {
    const industry = getIndustry(p.industryId);
    const ev =
      EXT_BASE_VALUE *
      p.scale *
      (1 + industry.trend * 6) *
      nextRange(rng, 0.7, 1.4);
    const fair = ev / SHARES;
    const price = Math.max(5, round2(fair));
    // Archetype from industry, with occasional variety so each industry has a
    // mix of growth/dividend/balanced names rather than all behaving alike.
    let kind = classifyStockKind(industry);
    const roll = nextRange(rng, 0, 1);
    if (kind === "balanced") kind = roll < 0.3 ? "dividend" : roll > 0.8 ? "growth" : "balanced";
    else if (roll < 0.15) kind = "balanced";
    out[p.id] = {
      companyId: p.id,
      price,
      history: [price],
      sharesOutstanding: SHARES,
      treasury: TREASURY,
      external: true,
      name: p.name,
      logoColor: p.logoColor,
      industryId: p.industryId,
      countryId: p.countryId,
      anchor: fair,
      roeBase: nextRange(rng, 0.05, 0.2),
      kind,
      dividendYield: defaultYield(kind),
    };
  }
  return out;
}

// ── Stock archetypes (growth / dividend / balanced) ─────────────────────────
//
// A stock's price reaction is shaped by its archetype so the market behaves like
// a real one: growth names rip in booms and crater when rates rise; dividend
// names are calm and defensive; balanced sit in between. This — together with
// per-company news shocks and a momentum bounce — means falling stocks recover
// rather than only ever falling.

/** Short Korean labels for the trading UI. */
export const STOCK_KIND_LABELS: Record<StockKind, string> = {
  growth: "성장주",
  dividend: "배당주",
  balanced: "혼합형",
};

/** Interest rate (%) above which valuations start to be pressured. */
const NEUTRAL_RATE = 2.5;

interface KindParams {
  beta: number; // sensitivity to sentiment & GDP growth
  rateSens: number; // how much rising rates hurt valuation
  trendMult: number; // multiplier on the industry's secular trend
  volMult: number; // relative random-walk volatility
}

const KIND_PARAMS: Record<StockKind, KindParams> = {
  growth: { beta: 1.45, rateSens: 1.7, trendMult: 1.5, volMult: 1.35 },
  balanced: { beta: 1.0, rateSens: 1.0, trendMult: 1.0, volMult: 1.0 },
  dividend: { beta: 0.55, rateSens: 0.55, trendMult: 0.7, volMult: 0.6 },
};

/** Classify a stock from its industry: high growth/R&D → growth; slow & calm → dividend. */
export function classifyStockKind(industry: IndustryDef): StockKind {
  const growthScore = industry.trend * 30 + industry.rndDependence;
  if (growthScore > 1.0) return "growth";
  if (industry.trend <= 0.006 && industry.volatility <= 0.9) return "dividend";
  return "balanced";
}

function defaultYield(kind: StockKind): number {
  if (kind === "dividend") return 0.012;
  if (kind === "balanced") return 0.005;
  return 0; // growth reinvests everything
}

/** Ensure a stock has an archetype assigned (lazily, so old saves upgrade too). */
function ensureKind(stock: Stock, industry: IndustryDef | null): KindParams {
  if (!stock.kind) {
    stock.kind = industry ? classifyStockKind(industry) : "balanced";
    stock.dividendYield = defaultYield(stock.kind);
  }
  return KIND_PARAMS[stock.kind];
}

/** Macro-driven part of a stock's per-turn return, scaled by archetype. */
function macroReturn(macro: MacroState, p: KindParams): number {
  return (
    macro.sentiment * 0.03 * p.beta +
    (macro.gdpGrowth / 100) * 0.15 * p.beta -
    ((macro.interestRate - NEUTRAL_RATE) / 100) * p.rateSens
  );
}

/**
 * Mean-reversion on momentum: a stock that just dropped sharply gets an oversold
 * bounce, an overbought spike cools off. This is what stops a falling stock from
 * only ever falling — there is always some pull back toward equilibrium.
 */
function momentumBounce(history: number[]): number {
  if (history.length < 4) return 0;
  const now = history[history.length - 1];
  const past = history[history.length - 4];
  if (past <= 0) return 0;
  const ret = (now - past) / past; // 3-bar return
  if (ret < -0.12) return Math.min(0.05, (-ret - 0.12) * 0.4); // bounce
  if (ret > 0.2) return Math.max(-0.04, -(ret - 0.2) * 0.3); // cool off
  return 0;
}

/** Advance all stock prices one turn toward fundamentals plus market noise. */
export function tickStocks(
  stocks: Record<string, Stock>,
  companies: Company[],
  macro: MacroState,
  config: LevelConfig,
  rng: RngState,
): void {
  const byId = new Map(companies.map((c) => [c.id, c]));
  for (const id of Object.keys(stocks)) {
    const stock = stocks[id];
    const company = byId.get(id);
    if (!company) {
      // External listing (no Company): synthetic anchor + random walk.
      if (stock.external) tickExternalStock(stock, macro, config, rng);
      continue;
    }

    const industry = getIndustry(company.industryId);
    const p = ensureKind(stock, industry);

    const fair = fundamentalValue(company) / stock.sharesOutstanding;
    const gap = (fair - stock.price) / stock.price;

    // Extra penalty when the company is losing money: earnings matter for price.
    const earningsPenalty = company.lastProfit < 0 ? -0.018 : company.lastProfit === 0 ? -0.007 : 0;

    const drift =
      gap * 0.32 + // stronger mean-reversion: bad fundamentals hurt faster
      macroReturn(macro, p) + // sentiment / growth / rates (macro), by archetype
      industry.trend * p.trendMult + // secular industry growth
      (stock.dividendYield ?? 0) + // steady dividend support
      momentumBounce(stock.history) + // oversold bounce / overbought cool-off
      earningsPenalty; // explicit drag when not earning
    // Noise kept below typical event shocks (3–9%) so news clearly leads the
    // move instead of being drowned out by random walk; scaled by archetype.
    const noise = nextGaussian(rng, 0, 0.022 * p.volMult * industry.volatility * config.volatility);

    stock.price = Math.max(1, stock.price * (1 + drift + noise));
    stock.history.push(round2(stock.price));
    if (stock.history.length > 60) stock.history.shift();
  }
}

/** Advance one external (no-Company) listing toward its drifting anchor. */
function tickExternalStock(
  stock: Stock,
  macro: MacroState,
  config: LevelConfig,
  rng: RngState,
): void {
  const industry = stock.industryId ? getIndustry(stock.industryId) : null;
  const p = ensureKind(stock, industry);
  const trend = industry?.trend ?? 0.01;
  const vol = industry?.volatility ?? 1;

  // Anchor (fundamental baseline) drifts slowly with the industry trend.
  const anchor = (stock.anchor ?? stock.price) * (1 + trend + nextGaussian(rng, 0, 0.01));
  stock.anchor = anchor;

  const gap = (anchor - stock.price) / stock.price;
  const drift =
    gap * 0.2 +
    macroReturn(macro, p) +
    trend * p.trendMult +
    (stock.dividendYield ?? 0) +
    momentumBounce(stock.history);
  const noise = nextGaussian(rng, 0, 0.025 * p.volMult * vol * config.volatility);

  stock.price = Math.max(1, stock.price * (1 + drift + noise));
  stock.history.push(round2(stock.price));
  if (stock.history.length > 60) stock.history.shift();
}

/** Apply a discrete shock (from an event) to a single stock. */
export function shockStock(
  stocks: Record<string, Stock>,
  companyId: string,
  pct: number,
): void {
  const s = stocks[companyId];
  if (!s) return;
  s.price = Math.max(1, s.price * (1 + pct));
  // Events fire after tickStocks pushed this turn's bar, so sync the latest
  // history point with the shocked price. Otherwise the news move only shows
  // up next turn, blended with fresh noise/mean-reversion — making prices look
  // like they react randomly rather than to the news.
  if (s.history.length) s.history[s.history.length - 1] = round2(s.price);
}

/** Apply a market-wide shock to every stock (e.g. crash / rally). */
export function shockMarket(stocks: Record<string, Stock>, pct: number): void {
  for (const id of Object.keys(stocks)) shockStock(stocks, id, pct);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

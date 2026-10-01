import type { BuildingType, Character, Company, GameState, IndustryDef } from "./types";
import { getIndustry } from "../data/industries";
import { getIndustryProducts } from "../data/products";
import { getCountry } from "../data/countries";
import { estimateDemand, productionCapacity, productMix } from "./company";
import {
  buildBuilding,
  buyAsset,
  buyStock,
  hireCharacter,
  poachCharacter,
  raiseSalary,
  sellStock,
  upgradeBuilding,
} from "./actions";
import { fundamentalValue } from "./market";
import { netWorth } from "./ranking";
import { type RngState, nextFloat, nextRange, pick, shuffle } from "./rng";
import { isFeatureUnlocked } from "./campaign";
import {
  buildingConstructionCost,
  findBestBuildingCell,
} from "./buildings";
import { estimateBuildingImpact } from "./planning";

// Heuristic AI that runs each turn for non-player companies: it tunes its
// operating decisions, expands its campus, hires talent and invests — so the
// player always has live competitors on the leaderboard (single and multi).

export function runAiTurn(state: GameState, company: Company): void {
  const rng = state.rng;
  const industry = getIndustry(company.industryId);
  // Stable personalities plus a modest catch-up response create recognisable
  // rivals without secretly handing them free money. Better decisions, not
  // stat boosts, let a few challengers lead while laggards close the gap.
  const strength = competitiveStrength(state, company);
  const aggression = clamp(strength + (nextFloat(rng) - 0.5) * 0.12, 0.64, 1.35);
  // A rival already well ahead of the student holds its position
  // instead of pulling further away: first place stays reachable.
  const comfortablyAhead = isComfortablyAhead(state, company);

  // --- Operating decisions ---
  const capacity = productionCapacity(company, state.config);
  // Price near the market, undercutting only slightly to win share and charging a
  // quality premium when earned. Demand is now competitive (a share of the
  // market), so steady, sustainable pricing beats a fixed list price over time.
  const moodAdj = 1 + state.macro.sentiment * 0.05;
  const qualityPremium = Math.max(0, (company.quality - 35) / 400);
  const undercut = 0.96 + (1.1 - aggression) * 0.025;
  company.decisions.price = Math.max(
    industry.unitCost * 1.25,
    industry.basePrice * (undercut + qualityPremium) * moodAdj,
  );
  // The engine sells per-product price tags, so the plan above must reach
  // them. AIs offer every tier their quality allows, priced a little under
  // the quality ceiling — the same tools a player has in the sales panel.
  setAiProductPrices(company, industry, (undercut + qualityPremium) * moodAdj);
  company.decisions.price = productMix(company, industry).effectivePrice;
  // Produce to expected demand (not blindly to capacity): overstocking unsold
  // goods is the classic way to bleed cash, so a smart AI builds just above what
  // it can sell, capped by capacity. Existing inventory offsets what to make.
  const country = getCountry(company.countryId);
  const expectedDemand = estimateDemand(company, industry, country, state.macro, state.config);
  const targetStock = expectedDemand * (1.01 + aggression * 0.04);
  company.decisions.productionTarget = Math.round(
    Math.max(0, Math.min(capacity, targetStock - company.inventory)),
  );

  // Reinvest into the things that drive share (quality, marketing, morale).
  // Floors keep early-game AIs competitive; the revenue share scales them up.
  // Kept sustainable so the wider field stays roughly break-even, not bankrupt.
  const desiredBudget = Math.max(10_000, company.lastRevenue * (0.11 + aggression * 0.05));
  const opBudget = Math.min(desiredBudget, Math.max(6_000, company.cash * 0.1));
  company.decisions.marketingBudget = Math.round(opBudget * 0.36);
  company.decisions.rndBudget = isFeatureUnlocked(state, "research")
    ? Math.round(opBudget * 0.36 * (0.7 + industry.rndDependence * 0.5))
    : 0;
  company.decisions.welfareBudget = Math.round(opBudget * 0.18);
  company.decisions.safetyBudget = Math.round(opBudget * 0.1);

  // --- Expansion: build through the game, more when flush with cash. ---
  // Rivals grow at roughly the pace a thoughtful student can match.
  const expansionChance = clamp(0.12 + aggression * 0.16, 0.14, 0.36);
  const campusPace = 4 + Math.floor(state.turn * 0.36);
  if (
    !comfortablyAhead &&
    company.buildings.length < campusPace &&
    company.cash > 430_000 &&
    company.debt < company.cash * 1.25 &&
    nextFloat(rng) < expansionChance
  ) {
    expand(state, company);
  }

  // --- Hiring: keep a solid bench of strong talent ---
  if (company.cash > 350_000 && company.debt < company.cash && company.hired.length < 5 && nextFloat(rng) < aggression * 0.48) {
    const affordable = state.talentPool
      .filter((c) => c.salary < Math.max(18_000, company.lastRevenue * 0.25))
      .sort((a, b) => statSum(b) - statSum(a));
    if (affordable.length) hireCharacter(state, company, affordable[0].id);
  }

  // --- Poaching: flip low-loyalty rivals to grow the bench ---
  if (company.cash > 600_000 && company.hired.length < 5 && nextFloat(rng) < 0.2) {
    const rivals = shuffle(rng, state.companies.filter((c) => c.id !== company.id && c.isAI));
    for (const rival of rivals) {
      const weak = rival.hired
        .filter((c) => (c.loyalty ?? 70) < 50)
        .sort((a, b) => statSum(b) - statSum(a));
      if (!weak.length) continue;
      const t = weak[0];
      const cost = Math.round(t.salary * (1.3 + (t.loyalty ?? 70) / 100));
      if (company.cash > cost) { poachCharacter(state, company, rival.id, t.id); break; }
    }
  }
  // Raise salaries before disloyal staff quit.
  for (const ch of company.hired) {
    if ((ch.loyalty ?? 70) < 45 && company.cash > ch.salary * 3 && nextFloat(rng) < 0.4) {
      raiseSalary(state, company, ch.id, Math.round(ch.salary * 1.15), 0);
    }
  }

  // --- Investing: deploy genuinely spare cash; take profits sometimes ---
  if (company.cash > 550_000 && nextFloat(rng) < (comfortablyAhead ? 0.15 : 0.45)) {
    investSpareCash(state, company, aggression, rng);
  }
}

function isComfortablyAhead(state: GameState, company: Company): boolean {
  const player = state.companies.find((candidate) => candidate.id === state.playerCompanyId);
  if (!player) return false;
  return netWorth(company, state) > Math.max(2_000_000, netWorth(player, state) * 1.4);
}

/** Build the most useful available building, or upgrade if the map is full. */
function expand(state: GameState, company: Company): void {
  const want = chooseBuilding(company, state);
  const cell = want ? findBestBuildingCell(company, want, state.config.mapSize) : null;
  if (cell && want) {
    buildBuilding(state, company, want, cell.x, cell.y);
  } else {
    const b = company.buildings.find((b) => b.turnsLeft <= 0);
    if (b) upgradeBuilding(state, company, b.id);
  }
}

function setAiProductPrices(company: Company, industry: IndustryDef, priceLevel: number): void {
  const products = getIndustryProducts(company.industryId);
  const prices = products.map((_, index) => company.productPrices?.[index] ?? 0);
  const enabled = products.map((_, index) => company.productEnabled?.[index] ?? index === 0);
  products.forEach((def, index) => {
    const tierRef = industry.basePrice * def.priceRatio;
    const ceiling = tierRef * (1 + company.quality / 100);
    const available =
      company.quality >= def.qualityRequired && (!def.isRndUnlock || !!company.rndUnlockDone);
    enabled[index] = index === 0 || available;
    prices[index] = Math.round(clamp(tierRef * (0.95 + priceLevel * 0.2), tierRef * 0.8, ceiling * 0.97));
  });
  company.productPrices = prices;
  company.productEnabled = enabled;
}

function statSum(c: Character): number {
  return Object.values(c.stats).reduce((a, b) => a + b, 0);
}

function chooseBuilding(company: Company, state: GameState): BuildingType | null {
  const enabled = state.config.enabledBuildings;
  const capacity = productionCapacity(company, state.config);
  // Prioritise capacity if production is bottlenecked, then diversify into
  // welfare/research/marketing buildings to grow quality and morale.
  const order: BuildingType[] =
    capacity < company.decisions.productionTarget * 1.1
      ? ["factory", "warehouse", "store", "rnd", "lab", "office", "hr", "power", "cafeteria", "gym", "park"]
      : ["store", "rnd", "lab", "office", "factory", "warehouse", "hr", "cafeteria", "gym", "dorm", "power", "park"];
  const reserve = Math.max(180_000, company.lastRevenue * 0.45);
  const affordable = order.filter(
    (type) => enabled.includes(type) && company.cash - buildingConstructionCost(company, type) >= reserve,
  );
  if (!affordable.length) return null;

  // Like a careful student using the build preview, prefer what pays for
  // itself; keep one research lab so quality can still grow.
  const earning = affordable
    .map((type) => ({ type, gain: estimateBuildingImpact(state, company, type)?.profitDelta ?? 0 }))
    .filter((item) => item.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const hasLab = company.buildings.some((b) => b.type === "rnd" || b.type === "lab");
  if (!hasLab && affordable.includes("rnd") && isFeatureUnlocked(state, "research") && nextFloat(state.rng) < 0.4) {
    return "rnd";
  }
  if (earning.length && nextFloat(state.rng) < 0.35) return earning[0].type;

  // Prefer a strategically useful combination over blindly repeating the
  // first item in the priority list. The original order is still the tie-break.
  return affordable
    .map((type, index) => ({
      type,
      score: (findBestBuildingCell(company, type, state.config.mapSize)?.score ?? -1) * 2 - index,
    }))
    .sort((a, b) => b.score - a.score)[0]?.type ?? null;
}

function competitiveStrength(state: GameState, company: Company): number {
  const player = state.companies.find((candidate) => candidate.id === state.playerCompanyId);
  const stable = stableCompanyNumber(`${state.seed}:${company.basedOn ?? company.id}`);
  const personality = ((stable % 101) / 100 - 0.5) * 0.2;
  const challenger = stable % 5 === 0 ? 0.1 : 0;
  if (!player) return 0.95 + personality + challenger;

  const playerWorth = netWorth(player, state);
  const ownWorth = netWorth(company, state);
  const relativeGap = clamp(
    (playerWorth - ownWorth) / Math.max(250_000, Math.abs(playerWorth)),
    -3,
    1,
  );
  const catchUp = Math.max(0, relativeGap) * 0.28;
  // A rival far ahead eases off instead of snowballing out of a student's
  // reach, so first place stays a real (but hard-earned) goal.
  const leaderDrag = Math.min(0.32, Math.max(0, -relativeGap - 0.25) * 0.16);
  const lateGamePressure = (state.turn / Math.max(1, state.maxTurns)) * 0.08;
  return clamp(0.94 + personality + challenger + catchUp + lateGamePressure - leaderDrag, 0.66, 1.32);
}

function stableCompanyNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function investSpareCash(
  state: GameState,
  company: Company,
  aggression: number,
  rng: RngState,
): void {
  const spare = company.cash - 500_000;
  if (spare < 50_000) return;

  // Risk appetite from aggression: aggressive AIs buy stocks/crypto, cautious
  // AIs prefer ETFs/bonds/gold.
  const budget = spare * (0.2 + aggression * 0.3);

  if (aggression > 0.6 && nextFloat(rng) < 0.6) {
    // Buy an undervalued competitor's stock.
    const targets = state.companies.filter((c) => c.id !== company.id);
    if (targets.length) {
      const t = targets.sort(
        (a, b) =>
          fundamentalValue(b) / state.stocks[b.id].price -
          fundamentalValue(a) / state.stocks[a.id].price,
      )[0];
      const shares = Math.floor((budget * 0.5) / state.stocks[t.id].price);
      if (shares > 0) buyStock(state, company, t.id, shares);
    }
  } else {
    const safe = state.config.enabledAssets.filter((a) =>
      ["etf", "bond", "gold", "deposit"].includes(a),
    );
    if (safe.length) {
      const cls = pick(rng, safe);
      const units = Math.floor((budget * 0.5) / state.assets[cls].price);
      if (units > 0) buyAsset(state, company, cls, units);
    }
  }

  // Occasionally take profits on a stock holding.
  if (nextFloat(rng) < 0.2) {
    const holdings = Object.entries(company.portfolio.stocks);
    if (holdings.length) {
      const [id, sh] = holdings[Math.floor(nextRange(rng, 0, holdings.length))];
      sellStock(state, company, id, Math.ceil(sh / 2));
    }
  }
}

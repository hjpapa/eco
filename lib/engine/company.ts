import type {
  Company,
  CompanyDecisions,
  CountryDef,
  IndustryDef,
  LevelConfig,
  MacroState,
} from "./types";
import { aggregateBuildingCaps, totalUpkeep, tickConstruction } from "./buildings";
import { roleBonuses, totalSalary, updateLoyalty } from "./characters";
import { demandMultiplier } from "./economy";
import { getCountry } from "../data/countries";
import { getIndustry } from "../data/industries";
import { getIndustryProducts } from "../data/products";
import type { RngState } from "./rng";

// Per-company turn resolution: produce, sell, and book profit; then update
// quality/reputation/morale/safety. Buildings and hired talent feed in as
// capability and role bonuses.

const BASE_CAPACITY = 100;

export interface CompanyTurnResult {
  revenue: number;
  unitsSold: number;
  unitsProduced: number;
  profit: number;
  quitCount: number;
}

export function defaultDecisions(industry: IndustryDef): CompanyDecisions {
  return {
    price: industry.basePrice,
    productionTarget: industry.baseDemand,
    marketingBudget: 0,
    rndBudget: 0,
    welfareBudget: 0,
    safetyBudget: 0,
  };
}

/** Operational production capacity from buildings + base (no employee bonus). */
export function productionCapacity(company: Company, config: LevelConfig): number {
  const caps = aggregateBuildingCaps(company.buildings, config.adjacencyBonus);
  return BASE_CAPACITY + caps.productionCapacity;
}

/** Factory-only capacity for UI slider cap (each level-1 factory = 600 units). */
export function factoryCapacity(company: Company, config: LevelConfig): number {
  const caps = aggregateBuildingCaps(company.buildings, config.adjacencyBonus);
  return Math.max(BASE_CAPACITY, caps.productionCapacity);
}

/**
 * How strongly a company pulls customers, from its own decisions and stats
 * (price, marketing, quality, reputation). This is the company-specific part of
 * demand, normalised around ~1, so it can be compared across industries to model
 * competition for a shared pool of customers.
 */
export function marketAttractiveness(
  company: Company,
  industry: IndustryDef,
  config: LevelConfig,
): number {
  const caps = aggregateBuildingCaps(company.buildings, config.adjacencyBonus);
  const bonuses = roleBonuses(company);
  const price = Math.max(1, company.decisions.price);

  const priceRatio = industry.basePrice / price;
  // Above 2× base price, an additional quadratic penalty kicks in.
  const premiumPenalty =
    price > industry.basePrice * 2
      ? Math.pow((industry.basePrice * 2) / price, 2)
      : 1;
  const priceFactor = Math.pow(priceRatio, industry.demandElasticity) * premiumPenalty;

  const marketingFactor =
    1 +
    Math.min(
      0.9,
      Math.sqrt(Math.max(0, company.decisions.marketingBudget) / 5000) *
        0.05 *
        (1 + caps.marketingReach / 50),
    ) *
      bonuses.marketingMult;

  const qualityFactor = 1 + company.quality / 200;
  const reputationFactor = 0.7 + (company.reputation / 100) * 0.6;

  return Math.max(0.01, priceFactor * marketingFactor * qualityFactor * reputationFactor);
}

/**
 * Estimate market demand at the company's current decisions.
 *
 * `marketPressure` is the average attractiveness of all competitors this turn.
 * When provided, demand is scaled by the company's share of that pull, so a
 * static strategy steadily loses customers as rivals keep improving.
 */
export function estimateDemand(
  company: Company,
  industry: IndustryDef,
  country: CountryDef,
  macro: MacroState,
  config: LevelConfig,
  marketPressure?: number,
): number {
  const ownPull = marketAttractiveness(company, industry, config);

  const shareFactor =
    marketPressure && marketPressure > 0
      ? clamp(Math.pow(ownPull / marketPressure, 0.5), 0.72, 1.7)
      : 1;

  const demand =
    industry.baseDemand *
    country.marketSize *
    demandMultiplier(macro) *
    ownPull *
    shareFactor;

  return Math.max(0, Math.round(demand));
}

export function runCompanyTurn(
  company: Company,
  macro: MacroState,
  config: LevelConfig,
  rng: RngState,
  marketPressure?: number,
  growthMultiplier = 1,
): CompanyTurnResult {
  const industry = getIndustry(company.industryId);
  const country = getCountry(company.countryId);

  // Advance any in-progress construction first.
  tickConstruction(company);

  const caps = aggregateBuildingCaps(company.buildings, config.adjacencyBonus);
  const bonuses = roleBonuses(company);
  const d = company.decisions;

  // --- Production ---
  const capacity = BASE_CAPACITY + caps.productionCapacity;
  const efficiency = Math.min(0.6, caps.productionEfficiency + bonuses.productionEfficiency);
  const unitCost = industry.unitCost * country.laborCost * (1 - efficiency);

  const wantToProduce = Math.max(0, Math.min(d.productionTarget, capacity));
  const workingCapital = Math.max(company.cash * 0.7, company.lastRevenue * 0.6, 60_000);
  const affordableUnits = unitCost > 0 ? Math.floor(Math.max(0, workingCapital) / unitCost) : wantToProduce;
  const produced = Math.max(0, Math.min(wantToProduce, affordableUnits));
  const productionCost = produced * unitCost;

  // Check if R&D quality threshold was crossed → unlock 4th product
  const productDefs = getIndustryProducts(company.industryId);
  if (!company.rndUnlockDone && company.quality >= 75 && productDefs[3]) {
    company.rndUnlockDone = true;
  }

  // --- Per-product price & share computation (BEFORE demand calc) ---
  // This ensures demand uses the correct effective price rather than the
  // legacy global decisions.price slider.
  const productPrices = company.productPrices ?? productDefs.map((p) => Math.round(industry.basePrice * p.priceRatio));
  const productEnabled = company.productEnabled ?? productDefs.map((_, i) => i === 0);
  const productInventory = company.productInventory ?? productDefs.map(() => 0);

  const perShare: number[] = [];
  const perFinalPrice: number[] = [];
  let totalShare = 0;
  let weightedPrice = 0;

  for (let i = 0; i < productDefs.length; i++) {
    const def = productDefs[i];
    const pPriceRaw = productPrices[i] ?? 0;
    const enabled = productEnabled[i] ?? false;
    const meetsQuality = company.quality >= def.qualityRequired;
    const isRndOk = i < 3 || (company.rndUnlockDone ?? false);

    if (!enabled || !meetsQuality || !isRndOk || pPriceRaw <= 0) {
      perShare.push(0);
      perFinalPrice.push(0);
      continue;
    }

    // Quality-based price ceiling: higher quality unlocks higher pricing power.
    const tierRef = industry.basePrice * def.priceRatio;
    const maxAllowedPrice = tierRef * (1 + company.quality / 100);
    const pPrice = Math.min(pPriceRaw, maxAllowedPrice);

    // Quality scale: selling premium tier with just-enough quality reduces appeal.
    const qualityScale = def.qualityRequired > 0
      ? clamp(company.quality / Math.max(1, def.qualityRequired), 0.5, 1.2)
      : 1;

    // Price penalty: starts at tierRef (not 1.5×). Stronger exponent punishes overpricing.
    const pricePenalty = pPrice > tierRef
      ? Math.pow(tierRef / pPrice, industry.demandElasticity + 1.2)
      : pPrice < tierRef * 0.5
        ? 0.85
        : 1;

    const share = def.demandShare * qualityScale * pricePenalty;
    perShare.push(share);
    perFinalPrice.push(pPrice);
    totalShare += share;
    weightedPrice += share * pPrice;
  }

  const effectivePrice = totalShare > 0 ? weightedPrice / totalShare : d.price;

  // Update decisions.price so estimateDemand uses the correct blended price.
  company.decisions.price = effectivePrice;

  // --- Demand (now uses correct effective price via marketAttractiveness) ---
  const demand = estimateDemand(company, industry, country, macro, config, marketPressure);

  // --- Per-product inventory and sales ---
  let revenue = 0;
  let unitsSold = 0;

  for (let i = 0; i < productDefs.length; i++) {
    const shareI = totalShare > 0 ? perShare[i] / totalShare : 0;
    const productProduced = Math.round(produced * shareI);
    const productDemand = Math.round(demand * shareI);

    productInventory[i] = (productInventory[i] ?? 0) + productProduced;
    const sold = Math.min(productInventory[i], productDemand);
    productInventory[i] -= sold;

    revenue += sold * (perFinalPrice[i] ?? 0);
    unitsSold += sold;
  }

  company.productInventory = productInventory;
  // Keep legacy inventory in sync for UI components that still read it.
  company.inventory = productInventory.reduce((a, b) => a + b, 0);

  // --- Costs & profit ---
  const upkeep = totalUpkeep(company.buildings);
  const salaries = totalSalary(company);
  const interest = (company.debt * (macro.interestRate / 100)) / 4 * bonuses.financeCostMult;
  const fixedCosts = upkeep + salaries + interest;
  const welfareBudget = Math.max(0, d.welfareBudget ?? 0);
  const safetyBudget = Math.max(0, d.safetyBudget ?? 0);
  const grossProfit =
    revenue - productionCost - d.marketingBudget - d.rndBudget - welfareBudget - safetyBudget - fixedCosts;
  const tax = grossProfit > 0 ? grossProfit * country.taxRate : 0;
  const profit = grossProfit - tax;

  company.cash += profit;
  company.lastRevenue = revenue;
  company.lastProfit = profit;
  company.profitHistory.push(Math.round(profit));
  if (company.profitHistory.length > 40) company.profitHistory.shift();

  // --- Stat updates ---
  const rndPower = caps.rndPower + bonuses.rndPower + Math.sqrt(Math.max(0, d.rndBudget) / 3000);
  const qualityGain = rndPower * 0.15 * (0.5 + industry.rndDependence) - 0.5;
  company.quality = clamp(company.quality + scalePositive(qualityGain, growthMultiplier), 0, 100);

  // Morale decays toward 40 without investment; welfare + buildings lift it.
  // Losses push the target down 8 extra points so bad quarters feel painful.
  const moraleBase = 40 + caps.morale + bonuses.moraleAdd + Math.min(25, welfareBudget / 4000);
  const moraleTarget = profit > 0 ? moraleBase : moraleBase - 8;
  company.morale = clamp(company.morale + (moraleTarget - company.morale) * 0.25 - 0.8, 0, 100);

  // Reputation has a natural decay of ~0.5/quarter. Profitable quarters add ~0.6;
  // loss quarters subtract ~0.5. Buildings and bonuses partially offset the decay.
  const repDrift = (profit > 0 ? 0.6 : -0.5) + bonuses.reputationAdd + caps.reputation * 0.1 - 0.5;
  company.reputation = clamp(company.reputation + scalePositive(repDrift, growthMultiplier), 0, 100);

  // Safety decays ~0.6/quarter; safety budget and morale fight the decay.
  const safetyBase = 35 + company.morale * 0.15 + bonuses.safetyAdd +
    Math.min(20, d.rndBudget / 4000) + Math.min(25, safetyBudget / 3500);
  company.safety = clamp(company.safety + (safetyBase - company.safety) * 0.2 - 0.6, 0, 100);

  // --- Talent loyalty / quitting ---
  const canPay = company.cash > salaries;
  const quit = updateLoyalty(company, canPay, rng, growthMultiplier);

  // Auto-borrow a little if cash goes negative (with a small debt penalty).
  if (company.cash < 0) {
    const shortfall = -company.cash;
    company.debt += shortfall * 1.03;
    company.cash = 0;
  }

  return {
    revenue,
    unitsSold,
    unitsProduced: produced,
    profit,
    quitCount: quit.length,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Accelerate gains in short campaigns without softening losses. */
function scalePositive(delta: number, multiplier: number): number {
  return delta > 0 ? delta * multiplier : delta;
}

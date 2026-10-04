import type {
  BuildingType,
  Company,
  CompanyCapabilities,
  GameState,
  PlacedBuilding,
} from "./types";
import {
  aggregateBuildingCaps,
  buildingConstructionCost,
  buildingCostFor,
  BUILDINGS,
  evaluateBuildingPlacement,
  executiveSlots,
  findBestBuildingCell,
  totalUpkeep,
  type BuildingComboDef,
} from "./buildings";
import { totalSalary } from "./characters";
import { projectCompanyTurn, type TurnProjection } from "./company";
import { villageStats } from "./village";

// Read-only planning helpers for the construction screen. They answer the
// questions a young CEO asks before spending money: "What will this building
// do for my company, and when will it earn its cost back?"

export interface BuildingImpact {
  type: BuildingType;
  /** Grid cell the estimate was made for. */
  x: number;
  y: number;
  /** One-off price paid now. */
  cost: number;
  cashAfter: number;
  /** Cash level below which the company is one bad turn from trouble. */
  safetyLine: number;
  belowSafetyLine: boolean;
  before: TurnProjection;
  after: TurnProjection;
  /** Change in one ordinary turn's profit (after tax). */
  profitDelta: number;
  revenueDelta: number;
  upkeepDelta: number;
  /** Turns of extra profit needed to earn the cost back, or null if it never pays back in money. */
  paybackTurns: number | null;
  /** Non-money gains, so welfare buildings still show what they do. */
  gains: {
    capacity: number;
    customersPercent: number;
    morale: number;
    reputation: number;
    research: number;
    executiveSlots: number;
  };
  /** What the building does for the village (residents, happiness, stars). */
  village: {
    population: number;
    happiness: number;
    starsBefore: number;
    starsAfter: number;
  };
  combos: BuildingComboDef[];
}

/** Keep about three turns of fixed costs, and never less than 150,000 won. */
export function cashSafetyLine(company: Company, buildings: PlacedBuilding[] = company.buildings): number {
  const fixed = totalUpkeep(buildings) + totalSalary(company);
  return Math.max(150_000, Math.round(fixed * 3));
}

/** Estimate a new building at a cell (or the best cell when none is given). */
export function estimateBuildingImpact(
  game: GameState,
  company: Company,
  type: BuildingType,
  cell?: { x: number; y: number },
): BuildingImpact | null {
  const target = cell ?? findBestBuildingCell(company, type, game.config.mapSize);
  if (!target) return null;
  const placement = evaluateBuildingPlacement(company, type, target.x, target.y, game.config.mapSize);
  if (!placement.isValid) return null;

  const added: PlacedBuilding = {
    id: "__planned__",
    type,
    level: 1,
    x: target.x,
    y: target.y,
    turnsLeft: 0,
  };
  return compareCampus(
    game,
    company,
    type,
    target,
    [...company.buildings, added],
    buildingConstructionCost(company, type),
    placement.combos,
  );
}

/** Estimate raising an existing building by one level. */
export function estimateUpgradeImpact(
  game: GameState,
  company: Company,
  buildingId: string,
): BuildingImpact | null {
  const building = company.buildings.find((b) => b.id === buildingId);
  if (!building || building.level >= BUILDINGS[building.type].maxLevel) return null;
  const upgraded = company.buildings.map((b) =>
    b.id === buildingId ? { ...b, level: b.level + 1, turnsLeft: 0 } : b,
  );
  return compareCampus(
    game,
    company,
    building.type,
    building,
    upgraded,
    buildingCostFor(building.type, building.level + 1),
    [],
  );
}

function compareCampus(
  game: GameState,
  company: Company,
  type: BuildingType,
  cell: { x: number; y: number },
  nextBuildings: PlacedBuilding[],
  cost: number,
  combos: BuildingComboDef[],
): BuildingImpact {
  const { config, macro } = game;
  const capsBefore = aggregateBuildingCaps(company.buildings, config.adjacencyBonus);
  const capsAfter = aggregateBuildingCaps(nextBuildings, config.adjacencyBonus);
  const delta = (key: keyof CompanyCapabilities) => capsAfter[key] - capsBefore[key];

  // Morale settles towards its building-driven target over a few turns, so
  // compare steady states rather than this turn's exact value.
  const before = projectCompanyTurn(company, macro, config, company.buildings);
  const after = projectCompanyTurn(company, macro, config, nextBuildings, company.morale + delta("morale"));

  const profitDelta = after.profit - before.profit;
  const cashAfter = company.cash - cost;
  const safetyLine = cashSafetyLine(company, nextBuildings);
  const demandBefore = Math.max(1, before.demand);
  const villageBefore = villageStats(company.buildings);
  const villageAfter = villageStats(nextBuildings);

  return {
    type,
    x: cell.x,
    y: cell.y,
    cost,
    cashAfter,
    safetyLine,
    belowSafetyLine: cashAfter < safetyLine,
    before,
    after,
    profitDelta,
    revenueDelta: after.revenue - before.revenue,
    upkeepDelta: after.upkeep - before.upkeep,
    paybackTurns: profitDelta > 500 ? Math.max(1, Math.ceil(cost / profitDelta)) : null,
    gains: {
      capacity: after.capacity - before.capacity,
      customersPercent: Math.round(((after.demand - before.demand) / demandBefore) * 100),
      morale: Math.round(delta("morale")),
      reputation: Math.round(delta("reputation")),
      research: Math.round(delta("rndPower")),
      executiveSlots:
        executiveSlots({ buildings: nextBuildings }, config.adjacencyBonus) -
        executiveSlots(company, config.adjacencyBonus),
    },
    village: {
      population: villageAfter.population - villageBefore.population,
      happiness: villageAfter.happiness - villageBefore.happiness,
      starsBefore: villageBefore.stars,
      starsAfter: villageAfter.stars,
    },
    combos,
  };
}

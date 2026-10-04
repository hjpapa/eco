import type { BuildingType, GameState, PlacedBuilding } from "./types";

// A light SimCity layer over the company campus. Homes bring residents,
// workplaces bring jobs, shops serve residents, and parks or noisy factories
// change how happy the plots around them are. Everything is computed from the
// buildings alone (pure and deterministic), so previews, the map overlay and
// the turn engine always agree.
//
// Only types are imported here: buildings.ts uses these helpers for unlocks
// and placement scores, so this module must not depend on it at load time.

export interface VillageRole {
  /** People who can live here, per level. */
  residents?: number;
  /** Jobs, per level. */
  jobs?: number;
  /** Residents a shop can serve, per level. */
  shops?: number;
  /** Happiness given to plots within `radius` (negative = noise). */
  happy?: number;
  /** Square radius in plots (1 = the 8 plots around it). */
  radius?: number;
}

export const VILLAGE_ROLES: Record<BuildingType, VillageRole> = {
  house: { residents: 8 },
  dorm: { residents: 12 },
  factory: { jobs: 10, happy: -4, radius: 1 },
  warehouse: { jobs: 5, happy: -2, radius: 1 },
  power: { jobs: 3, happy: -5, radius: 1 },
  store: { jobs: 5, shops: 25, happy: 2, radius: 1 },
  cafeteria: { jobs: 4, shops: 15, happy: 2, radius: 1 },
  office: { jobs: 8 },
  rnd: { jobs: 6 },
  lab: { jobs: 6 },
  hr: { jobs: 3, happy: 1, radius: 1 },
  park: { happy: 6, radius: 2 },
  gym: { jobs: 2, happy: 3, radius: 1 },
  daycare: { jobs: 4, happy: 4, radius: 1 },
  clinic: { jobs: 4, happy: 4, radius: 2 },
  fountain: { happy: 5, radius: 2 },
  statue: { happy: 3, radius: 2 },
  clocktower: { jobs: 1, happy: 2, radius: 2 },
  ferris: { jobs: 6, shops: 20, happy: 5, radius: 3 },
};

export type DemandLevel = "high" | "some" | "enough";

export interface VillageDemand {
  /** 0..100: how much each kind of building is wanted. */
  home: number;
  shop: number;
  job: number;
}

export interface VillageStats {
  /** Beds in operational homes. */
  housing: number;
  population: number;
  jobs: number;
  /** Residents the shops can serve. */
  shopCapacity: number;
  /** 0..100 */
  happiness: number;
  /** Average plot happiness around homes (from parks, noise…). */
  neighbourhood: number;
  /** Distinct operational building kinds. */
  variety: number;
  demand: VillageDemand;
  stars: number;
  /** Why happiness is what it is, for the village panel. */
  factors: { emoji: string; label: string; value: number }[];
}

const operational = (buildings: PlacedBuilding[]) => buildings.filter((b) => b.turnsLeft <= 0);
const levelBoost = (level: number) => 1 + 0.5 * (level - 1);

/** Happiness a single plot gets from the buildings around it. */
export function plotHappiness(buildings: PlacedBuilding[], x: number, y: number): number {
  let total = 0;
  for (const b of buildings) {
    if (b.turnsLeft > 0 || (b.x === x && b.y === y)) continue;
    const role = VILLAGE_ROLES[b.type];
    if (!role?.happy || !role.radius) continue;
    if (Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) > role.radius) continue;
    total += role.happy * levelBoost(b.level);
  }
  return Math.round(total * 10) / 10;
}

const isHome = (b: PlacedBuilding) => (VILLAGE_ROLES[b.type]?.residents ?? 0) > 0;

/** 0.6 of the beds are taken in a gloomy village, all of them in a happy one. */
export function occupancy(happiness: number): number {
  return 0.6 + 0.4 * Math.max(0, Math.min(100, happiness)) / 100;
}

export function villageStats(buildings: PlacedBuilding[]): VillageStats {
  const live = operational(buildings);
  let housing = 0;
  let jobs = 0;
  let shopCapacity = 0;
  for (const b of live) {
    const role = VILLAGE_ROLES[b.type] ?? {};
    housing += (role.residents ?? 0) * b.level;
    jobs += (role.jobs ?? 0) * b.level;
    shopCapacity += (role.shops ?? 0) * b.level;
  }
  const homes = live.filter(isHome);
  const neighbourhood = homes.length
    ? homes.reduce((sum, h) => sum + plotHappiness(live, h.x, h.y), 0) / homes.length
    : 0;
  const variety = new Set(live.map((b) => b.type)).size;

  // Happiness and population depend on each other (a crowded village with no
  // jobs is gloomy, and gloomy villages fill fewer beds), so settle them in
  // two short passes. A small village gets by with a few jobs and shops in
  // the next town (SLACK), so a first house is always good news.
  const SLACK = 10;
  const happinessFor = (people: number) => {
    const factors: VillageStats["factors"] = [{ emoji: "🏡", label: "기본", value: 55 }];
    if (homes.length) factors.push({ emoji: "🌳", label: "이웃 환경(공원·소음)", value: Math.round(neighbourhood * 2.5) });
    const jobless = people > jobs + SLACK ? Math.min(15, ((people - jobs - SLACK) / Math.max(1, people)) * 30) : 0;
    factors.push(jobless > 0
      ? { emoji: "🏭", label: "일자리가 모자라요", value: -Math.round(jobless) }
      : { emoji: "🏭", label: "일자리가 넉넉해요", value: people > 0 ? 5 : 0 });
    const unserved = people > shopCapacity + SLACK ? Math.min(10, ((people - shopCapacity - SLACK) / Math.max(1, people)) * 20) : 0;
    factors.push(unserved > 0
      ? { emoji: "🛍️", label: "가게가 모자라요", value: -Math.round(unserved) }
      : { emoji: "🛍️", label: "가게가 가까워요", value: people > 0 ? 5 : 0 });
    const amenities = new Set(live.filter((b) => (VILLAGE_ROLES[b.type]?.happy ?? 0) > 0).map((b) => b.type)).size;
    factors.push({ emoji: "🎡", label: "즐길 거리", value: Math.min(6, Math.round(amenities * 1.5)) });
    const value = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.value, 0))));
    return { value, factors };
  };
  const first = happinessFor(Math.round(housing * 0.8));
  const population = Math.round(housing * occupancy(first.value));
  const { value: happiness, factors } = happinessFor(population);

  const demand: VillageDemand = {
    home: housing === 0
      ? (jobs > 0 ? 90 : 60)
      : clamp(30 + (jobs / Math.max(1, population) - 1) * 50 + (happiness >= 60 ? 15 : 0), 0, 100),
    shop: population === 0 ? 0 : clamp((population / Math.max(SLACK, shopCapacity)) * 60, 0, 100),
    job: population === 0 ? 0 : clamp(30 + (population / Math.max(1, jobs) - 1) * 60, 0, 100),
  };

  const partial = { population, happiness, variety };
  return {
    housing,
    population,
    jobs,
    shopCapacity,
    happiness,
    neighbourhood: Math.round(neighbourhood * 10) / 10,
    variety,
    demand: { home: Math.round(demand.home), shop: Math.round(demand.shop), job: Math.round(demand.job) },
    stars: starsFor(partial),
    factors,
  };
}

export function demandLevel(value: number): DemandLevel {
  return value >= 67 ? "high" : value >= 34 ? "some" : "enough";
}

/** What each star asks for. Star 1 is free: every town starts somewhere. */
export interface StarGoal {
  stars: number;
  population: number;
  happiness: number;
  variety: number;
  /** One-off prize the first time the village reaches this star. */
  reward: { cash: number; reputation: number };
}

export const STAR_GOALS: readonly StarGoal[] = [
  { stars: 2, population: 10, happiness: 0, variety: 0, reward: { cash: 50_000, reputation: 1 } },
  { stars: 3, population: 30, happiness: 55, variety: 5, reward: { cash: 100_000, reputation: 2 } },
  { stars: 4, population: 60, happiness: 65, variety: 8, reward: { cash: 150_000, reputation: 3 } },
  { stars: 5, population: 100, happiness: 75, variety: 11, reward: { cash: 200_000, reputation: 4 } },
];

function starsFor(v: { population: number; happiness: number; variety: number }): number {
  let stars = 1;
  for (const goal of STAR_GOALS) {
    if (v.population >= goal.population && v.happiness >= goal.happiness && v.variety >= goal.variety) stars = goal.stars;
    else break;
  }
  return stars;
}

export function villageStars(buildings: PlacedBuilding[]): number {
  return villageStats(buildings).stars;
}

/** The next star and what is still missing for it. */
export function nextStarGoal(stats: VillageStats): (StarGoal & { missing: { emoji: string; text: string }[] }) | null {
  const goal = STAR_GOALS.find((g) => g.stars === stats.stars + 1);
  if (!goal) return null;
  const missing: { emoji: string; text: string }[] = [];
  if (stats.population < goal.population) missing.push({ emoji: "👥", text: `주민 ${goal.population}명 (지금 ${stats.population}명)` });
  if (stats.happiness < goal.happiness) missing.push({ emoji: "😊", text: `마을 행복 ${goal.happiness}점 (지금 ${stats.happiness}점)` });
  if (stats.variety < goal.variety) missing.push({ emoji: "🧩", text: `건물 종류 ${goal.variety}가지 (지금 ${stats.variety}가지)` });
  return { ...goal, missing };
}

/**
 * Residents shop at the company next door: each one adds a little demand,
 * up to +20% for a big, busy village.
 */
export function villageCustomerBoost(buildings: PlacedBuilding[]): number {
  const { population } = villageStats(buildings);
  return 1 + Math.min(0.2, population * 0.0015);
}

/**
 * How much a building would change the happiness of nearby homes if built at
 * (x, y): positive for parks next to houses, negative for factories next to
 * them, and a house itself scores the plot it would stand on.
 */
export function placementHappiness(buildings: PlacedBuilding[], type: BuildingType, x: number, y: number): number {
  const role = VILLAGE_ROLES[type] ?? {};
  let score = 0;
  if ((role.residents ?? 0) > 0) score += plotHappiness(buildings, x, y);
  if (role.happy && role.radius) {
    for (const b of operational(buildings)) {
      if (!isHome(b)) continue;
      if (Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= role.radius) score += role.happy;
    }
  }
  return score;
}

export interface VillageChange {
  populationBefore: number;
  population: number;
  happiness: number;
  starsBefore: number;
  stars: number;
  /** Stars reached for the first time this turn, with the prize paid. */
  starRewards: StarGoal[];
}

/** Starting village record: the stars a campus already has are not prizes. */
export function ensureVillage(state: GameState): NonNullable<GameState["village"]> {
  if (!state.village) {
    const player = state.companies.find((c) => c.id === state.playerCompanyId);
    state.village = { bestStars: player ? villageStars(player.buildings) : 1 };
  }
  return state.village;
}

/**
 * After a turn: pay the one-off prize for every star reached for the first
 * time. Returns the change for the results screen.
 */
export function settleVillage(state: GameState, populationBefore: number, starsBefore: number): VillageChange | null {
  const player = state.companies.find((c) => c.id === state.playerCompanyId);
  if (!player) return null;
  const record = ensureVillage(state);
  const stats = villageStats(player.buildings);
  const starRewards = STAR_GOALS.filter((goal) => goal.stars > record.bestStars && goal.stars <= stats.stars);
  for (const goal of starRewards) {
    player.cash += goal.reward.cash;
    player.reputation = Math.min(100, player.reputation + goal.reward.reputation);
  }
  record.bestStars = Math.max(record.bestStars, stats.stars);
  return {
    populationBefore,
    population: stats.population,
    happiness: stats.happiness,
    starsBefore,
    stars: stats.stars,
    starRewards,
  };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

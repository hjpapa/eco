import type {
  BuildingDef,
  BuildingType,
  Company,
  CompanyCapabilities,
  PlacedBuilding,
} from "./types";

// Building catalog. Each building contributes capability points per level.
// `company.ts` aggregates the capabilities of all operational buildings every
// turn to derive production capacity, costs, R&D power, etc.

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  factory: {
    type: "factory",
    name: "공장",
    emoji: "🏭",
    cost: 250_000,
    buildTurns: 1,
    upkeep: 15_000,
    maxLevel: 3,
    effects: { productionCapacity: 600, productionEfficiency: 0.05 },
    description: "생산량과 생산 효율을 높입니다.",
  },
  rnd: {
    type: "rnd",
    name: "R&D 연구소",
    emoji: "🔬",
    cost: 300_000,
    buildTurns: 2,
    upkeep: 20_000,
    maxLevel: 3,
    effects: { rndPower: 12 },
    description: "신제품·품질 연구 속도를 높입니다.",
  },
  office: {
    type: "office",
    name: "본사·오피스",
    emoji: "🏢",
    cost: 200_000,
    buildTurns: 1,
    upkeep: 12_000,
    maxLevel: 3,
    effects: { productionEfficiency: 0.04, morale: 4, hiringCap: 2 },
    description: "관리 효율과 운영 규모를 키웁니다.",
  },
  warehouse: {
    type: "warehouse",
    name: "물류창고",
    emoji: "📦",
    cost: 160_000,
    buildTurns: 1,
    upkeep: 8_000,
    maxLevel: 3,
    effects: { logistics: 15, productionEfficiency: 0.03 },
    description: "재고·배송 효율을 높입니다.",
  },
  store: {
    type: "store",
    name: "매장·마케팅센터",
    emoji: "🏬",
    cost: 180_000,
    buildTurns: 1,
    upkeep: 10_000,
    maxLevel: 3,
    effects: { marketingReach: 18 },
    description: "판매 도달과 수요를 늘립니다.",
  },
  power: {
    type: "power",
    name: "발전·인프라",
    emoji: "⚡",
    cost: 220_000,
    buildTurns: 2,
    upkeep: 6_000,
    maxLevel: 2,
    effects: { productionEfficiency: 0.06 },
    description: "운영비를 낮추고 확장 한도를 늘립니다.",
  },
  hr: {
    type: "hr",
    name: "인사센터",
    emoji: "👥",
    cost: 140_000,
    buildTurns: 1,
    upkeep: 7_000,
    maxLevel: 2,
    effects: { hiringCap: 4, morale: 6 },
    description: "고용 한도와 직원 사기를 높입니다.",
  },
  park: {
    type: "park",
    name: "공원·녹지",
    emoji: "🌳",
    cost: 60_000,
    buildTurns: 1,
    upkeep: 2_000,
    maxLevel: 2,
    effects: { morale: 5, reputation: 3 },
    description: "사기와 평판을 소폭 높이고 도시를 아름답게 합니다.",
  },
  cafeteria: {
    type: "cafeteria",
    name: "구내식당",
    emoji: "🍽️",
    cost: 120_000,
    buildTurns: 1,
    upkeep: 6_000,
    maxLevel: 3,
    effects: { morale: 8 },
    description: "맛있는 식사로 직원 사기를 크게 높입니다.",
  },
  dorm: {
    type: "dorm",
    name: "사택·기숙사",
    emoji: "🏠",
    cost: 180_000,
    buildTurns: 1,
    upkeep: 9_000,
    maxLevel: 3,
    effects: { morale: 6, hiringCap: 3 },
    description: "주거 복지로 사기와 고용 한도를 높입니다.",
  },
  gym: {
    type: "gym",
    name: "사내 헬스장",
    emoji: "🏋️",
    cost: 130_000,
    buildTurns: 1,
    upkeep: 5_000,
    maxLevel: 2,
    effects: { morale: 6, productionEfficiency: 0.02 },
    description: "건강 복지로 사기를 높이고 업무 효율을 살짝 올립니다.",
  },
  daycare: {
    type: "daycare",
    name: "어린이집",
    emoji: "🧸",
    cost: 150_000,
    buildTurns: 1,
    upkeep: 7_000,
    maxLevel: 2,
    effects: { morale: 7, hiringCap: 2, reputation: 3 },
    description: "보육 복지로 사기·고용·평판을 높입니다. 캠퍼스에 아이들이 늘어요.",
  },
  clinic: {
    type: "clinic",
    name: "의무실·클리닉",
    emoji: "🏥",
    cost: 140_000,
    buildTurns: 1,
    upkeep: 6_000,
    maxLevel: 2,
    effects: { morale: 4, reputation: 3 },
    description: "건강 관리로 사기와 평판을 높입니다.",
  },
  lab: {
    type: "lab",
    name: "연구동·데이터센터",
    emoji: "🧪",
    cost: 280_000,
    buildTurns: 2,
    upkeep: 18_000,
    maxLevel: 3,
    effects: { rndPower: 14, productionEfficiency: 0.02 },
    description: "추가 연구 역량으로 R&D를 가속합니다.",
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDINGS);

/**
 * Building pairs that help each other when placed directly side-by-side.
 * This public catalog lets the engine, learning content and map UI describe
 * the exact same adjacency rules without duplicating them.
 */
export const ADJACENCY_PAIRS = [
  ["factory", "warehouse"],
  ["factory", "power"],
  ["warehouse", "store"],
  ["store", "office"],
  ["office", "rnd"],
] as const satisfies readonly (readonly [BuildingType, BuildingType])[];

const ADJACENCY_PAIR_KEYS = new Set<string>(
  ADJACENCY_PAIRS.map(([a, b]) => adjacencyPairKey(a, b)),
);

/** Cost to construct or upgrade a building to the next level. */
export function buildingCostFor(type: BuildingType, targetLevel: number): number {
  const def = BUILDINGS[type];
  // Each level costs progressively more.
  return Math.round(def.cost * (1 + (targetLevel - 1) * 0.6));
}

const EMPTY_CAPS: CompanyCapabilities = {
  productionCapacity: 0,
  productionEfficiency: 0,
  rndPower: 0,
  marketingReach: 0,
  logistics: 0,
  hiringCap: 0,
  morale: 0,
  reputation: 0,
};

/**
 * Aggregate capabilities from all operational buildings.
 * `adjacencyBonus` grants a small boost when complementary buildings are placed
 * next to each other (e.g. factory + warehouse).
 */
export function aggregateBuildingCaps(
  buildings: PlacedBuilding[],
  adjacencyBonus: boolean,
): CompanyCapabilities {
  const caps: CompanyCapabilities = { ...EMPTY_CAPS };
  const operational = buildings.filter((b) => b.turnsLeft <= 0);

  for (const b of operational) {
    const def = BUILDINGS[b.type];
    for (const key of Object.keys(def.effects) as (keyof CompanyCapabilities)[]) {
      caps[key] += (def.effects[key] ?? 0) * b.level;
    }
  }

  if (adjacencyBonus) {
    const pairCount = countAdjacencyPairs(operational);
    caps.productionEfficiency += pairCount * 0.05;
    caps.logistics *= 1 + pairCount * 0.1;
  }

  return caps;
}

/** Count each operational, complementary orthogonal-neighbour pair once. */
export function countAdjacencyPairs(buildings: PlacedBuilding[]): number {
  const operational = buildings.filter((building) => building.turnsLeft <= 0);
  const grid = new Map<string, PlacedBuilding>();
  for (const building of operational) grid.set(`${building.x},${building.y}`, building);

  let pairs = 0;
  for (const building of operational) {
    // Only inspect right and down. Every physical neighbour pair is therefore
    // considered exactly once, including rules whose definition is asymmetric
    // in display order (for example factory + power).
    const neighbours = [
      grid.get(`${building.x + 1},${building.y}`),
      grid.get(`${building.x},${building.y + 1}`),
    ];
    for (const neighbour of neighbours) {
      if (
        neighbour &&
        ADJACENCY_PAIR_KEYS.has(adjacencyPairKey(building.type, neighbour.type))
      ) {
        pairs += 1;
      }
    }
  }
  return pairs;
}

function adjacencyPairKey(a: BuildingType, b: BuildingType): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Total per-turn upkeep cost for a company's buildings. */
export function totalUpkeep(buildings: PlacedBuilding[]): number {
  return buildings
    .filter((b) => b.turnsLeft <= 0)
    .reduce((sum, b) => sum + BUILDINGS[b.type].upkeep * b.level, 0);
}

/** Advance construction timers by one turn. Returns ids that just completed. */
export function tickConstruction(company: Company): string[] {
  const completed: string[] = [];
  for (const b of company.buildings) {
    if (b.turnsLeft > 0) {
      b.turnsLeft -= 1;
      if (b.turnsLeft <= 0) completed.push(b.id);
    }
  }
  return completed;
}

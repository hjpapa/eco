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
    cost: 180_000,
    buildTurns: 1,
    upkeep: 7_000,
    maxLevel: 3,
    effects: { productionCapacity: 600, productionEfficiency: 0.05 },
    description: "물건을 더 많이 만들 수 있어요. 생산 한도가 늘고 생산비도 조금 줄어요.",
  },
  rnd: {
    type: "rnd",
    name: "R&D 연구소",
    emoji: "🔬",
    cost: 200_000,
    buildTurns: 2,
    upkeep: 9_000,
    maxLevel: 3,
    effects: { rndPower: 12 },
    description: "연구로 품질이 올라가요. 품질이 높으면 더 좋은 상품을 더 비싸게 팔 수 있어요.",
  },
  office: {
    type: "office",
    name: "본사·오피스",
    emoji: "🏢",
    cost: 150_000,
    buildTurns: 1,
    upkeep: 5_000,
    maxLevel: 3,
    effects: { productionEfficiency: 0.04, morale: 4, hiringCap: 2 },
    description: "회사 일이 척척 돌아가요. 생산비가 줄고 직원 행복과 임원 자리가 늘어요.",
  },
  warehouse: {
    type: "warehouse",
    name: "물류창고",
    emoji: "📦",
    cost: 110_000,
    buildTurns: 1,
    upkeep: 4_000,
    maxLevel: 3,
    effects: { logistics: 15, productionEfficiency: 0.03 },
    description: "배송이 빨라져 손님이 조금 늘고, 생산비도 조금 줄어요.",
  },
  store: {
    type: "store",
    name: "매장·마케팅센터",
    emoji: "🏬",
    cost: 120_000,
    buildTurns: 1,
    upkeep: 5_000,
    maxLevel: 3,
    effects: { marketingReach: 18 },
    description: "우리 상품을 보러 오는 손님이 늘어요. 광고 예산의 효과도 커져요.",
  },
  power: {
    type: "power",
    name: "발전·인프라",
    emoji: "⚡",
    cost: 150_000,
    buildTurns: 2,
    upkeep: 3_000,
    maxLevel: 2,
    effects: { productionEfficiency: 0.06 },
    description: "전기를 아껴 생산비를 줄여요.",
  },
  hr: {
    type: "hr",
    name: "인사센터",
    emoji: "👥",
    cost: 100_000,
    buildTurns: 1,
    upkeep: 4_000,
    maxLevel: 2,
    effects: { hiringCap: 4, morale: 6 },
    description: "임원 자리와 직원 행복을 늘려요.",
  },
  park: {
    type: "park",
    name: "공원·녹지",
    emoji: "🌳",
    cost: 40_000,
    buildTurns: 1,
    upkeep: 1_000,
    maxLevel: 2,
    effects: { morale: 5, reputation: 3 },
    description: "값싸게 지을 수 있는 쉼터예요. 직원 행복과 회사 평판이 조금 올라요.",
  },
  cafeteria: {
    type: "cafeteria",
    name: "구내식당",
    emoji: "🍽️",
    cost: 80_000,
    buildTurns: 1,
    upkeep: 3_000,
    maxLevel: 3,
    effects: { morale: 8 },
    description: "맛있는 밥으로 직원 행복이 크게 올라요. 행복한 직원은 더 많이 만들어요.",
  },
  dorm: {
    type: "dorm",
    name: "사택·기숙사",
    emoji: "🏠",
    cost: 120_000,
    buildTurns: 1,
    upkeep: 4_000,
    maxLevel: 3,
    effects: { morale: 6, hiringCap: 3 },
    description: "가까운 집이 생겨 직원 행복과 임원 자리가 늘어요.",
  },
  gym: {
    type: "gym",
    name: "사내 헬스장",
    emoji: "🏋️",
    cost: 90_000,
    buildTurns: 1,
    upkeep: 3_000,
    maxLevel: 2,
    effects: { morale: 6, productionEfficiency: 0.02 },
    description: "건강한 직원이 힘을 내요. 직원 행복과 효율이 올라요.",
  },
  daycare: {
    type: "daycare",
    name: "어린이집",
    emoji: "🧸",
    cost: 100_000,
    buildTurns: 1,
    upkeep: 3_000,
    maxLevel: 2,
    effects: { morale: 7, hiringCap: 2, reputation: 3 },
    description: "아이를 맡길 곳이 생겨 직원 행복·평판·임원 자리가 늘어요. 캠퍼스에 아이들이 놀러 와요.",
  },
  clinic: {
    type: "clinic",
    name: "의무실·클리닉",
    emoji: "🏥",
    cost: 100_000,
    buildTurns: 1,
    upkeep: 3_000,
    maxLevel: 2,
    effects: { morale: 4, reputation: 3 },
    description: "아플 때 바로 돌봐 줘서 직원 행복과 평판이 올라요.",
  },
  lab: {
    type: "lab",
    name: "연구동·데이터센터",
    emoji: "🧪",
    cost: 190_000,
    buildTurns: 2,
    upkeep: 8_000,
    maxLevel: 3,
    effects: { rndPower: 14, productionEfficiency: 0.02 },
    description: "연구 속도가 더 빨라져요. R&D 연구소 옆에 두면 더 좋아요.",
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDINGS);

/**
 * Building pairs that help each other when placed directly side-by-side.
 * This public catalog lets the engine, learning content and map UI describe
 * the exact same adjacency rules without duplicating them.
 */
export interface BuildingComboDef {
  id: string;
  name: string;
  emoji: string;
  pair: readonly [BuildingType, BuildingType];
  description: string;
  effects: Partial<CompanyCapabilities>;
}

/** Each side-by-side combination has its own strategic purpose. */
export const BUILDING_COMBOS: readonly BuildingComboDef[] = [
  { id: "make-and-move", name: "생산·배송 팀", emoji: "🚚", pair: ["factory", "warehouse"], description: "만든 물건을 빠르게 보냅니다.", effects: { productionEfficiency: 0.04, logistics: 10 } },
  { id: "smart-energy", name: "절약 생산 팀", emoji: "⚡", pair: ["factory", "power"], description: "에너지를 아껴 생산비를 줄입니다.", effects: { productionEfficiency: 0.06 } },
  { id: "quick-store", name: "빠른 판매 팀", emoji: "📦", pair: ["warehouse", "store"], description: "재고를 매장으로 빠르게 옮깁니다.", effects: { logistics: 12, marketingReach: 4 } },
  { id: "brand-center", name: "브랜드 팀", emoji: "📣", pair: ["store", "office"], description: "고객의 목소리를 회사에 전달합니다.", effects: { marketingReach: 10, reputation: 2 } },
  { id: "idea-lab", name: "아이디어 팀", emoji: "💡", pair: ["office", "rnd"], description: "좋은 아이디어를 제품으로 발전시킵니다.", effects: { rndPower: 7, productionEfficiency: 0.02 } },
  { id: "happy-lunch", name: "즐거운 점심 팀", emoji: "🍱", pair: ["office", "cafeteria"], description: "직원들이 편하게 쉬고 힘을 냅니다.", effects: { morale: 7, productionEfficiency: 0.01 } },
  { id: "family-campus", name: "가족 친화 팀", emoji: "🧸", pair: ["daycare", "cafeteria"], description: "일과 돌봄을 함께 돕습니다.", effects: { morale: 9, hiringCap: 2, reputation: 2 } },
  { id: "green-break", name: "초록 휴식 팀", emoji: "🌿", pair: ["park", "cafeteria"], description: "휴식 공간이 직원과 이웃을 웃게 합니다.", effects: { morale: 6, reputation: 3 } },
  { id: "deep-research", name: "첨단 연구 팀", emoji: "🧪", pair: ["rnd", "lab"], description: "두 연구 시설이 어려운 문제를 함께 풉니다.", effects: { rndPower: 10 } },
  { id: "healthy-work", name: "건강한 일터 팀", emoji: "💪", pair: ["clinic", "gym"], description: "건강을 챙겨 꾸준히 일할 수 있습니다.", effects: { morale: 8, productionEfficiency: 0.02 } },
];

/** Backward-compatible pair list used by learning content. */
export const ADJACENCY_PAIRS = BUILDING_COMBOS.map((combo) => combo.pair);

const ADJACENCY_PAIR_KEYS = new Set<string>(
  BUILDING_COMBOS.map(({ pair: [a, b] }) => adjacencyPairKey(a, b)),
);

const COMBO_BY_PAIR = new Map(
  BUILDING_COMBOS.map((combo) => [adjacencyPairKey(combo.pair[0], combo.pair[1]), combo]),
);

/** Cost to construct or upgrade a building to the next level. */
export function buildingCostFor(type: BuildingType, targetLevel: number): number {
  const def = BUILDINGS[type];
  // Each level costs a little more — about the price of building another
  // copy, so upgrading (and saving land) is a fair choice.
  return Math.round(def.cost * (1 + (targetLevel - 1) * 0.25));
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
    for (const combo of getActiveBuildingCombos(operational)) {
      for (const key of Object.keys(combo.effects) as (keyof CompanyCapabilities)[]) {
        caps[key] += combo.effects[key] ?? 0;
      }
    }
  }

  return caps;
}

/** Count each operational, complementary orthogonal-neighbour pair once. */
export function countAdjacencyPairs(buildings: PlacedBuilding[]): number {
  return getActiveBuildingCombos(buildings).length;
}

/** Return one entry for every operational physical combination. */
export function getActiveBuildingCombos(buildings: PlacedBuilding[]): BuildingComboDef[] {
  const operational = buildings.filter((building) => building.turnsLeft <= 0);
  const grid = new Map<string, PlacedBuilding>();
  for (const building of operational) grid.set(`${building.x},${building.y}`, building);

  const combos: BuildingComboDef[] = [];
  for (const building of operational) {
    // Only inspect right and down. Every physical neighbour pair is therefore
    // considered exactly once, including rules whose definition is asymmetric
    // in display order (for example factory + power).
    const neighbours = [
      grid.get(`${building.x + 1},${building.y}`),
      grid.get(`${building.x},${building.y + 1}`),
    ];
    for (const neighbour of neighbours) {
      if (!neighbour) continue;
      const key = adjacencyPairKey(building.type, neighbour.type);
      const combo = COMBO_BY_PAIR.get(key);
      if (combo && ADJACENCY_PAIR_KEYS.has(key)) combos.push(combo);
    }
  }
  return combos;
}

/** Half of everything spent on a building's levels comes back when it is sold. */
export function buildingSellRefund(building: PlacedBuilding): number {
  let spent = 0;
  for (let level = 1; level <= building.level; level += 1) spent += buildingCostFor(building.type, level);
  return Math.round(spent * 0.5);
}

export const BASE_EXECUTIVE_SLOTS = 6;
export const MAX_EXECUTIVE_SLOTS = 9;

/** Offices, housing and childcare make room for more executives. */
export function executiveSlots(company: Pick<Company, "buildings">, adjacencyBonus: boolean): number {
  const caps = aggregateBuildingCaps(company.buildings, adjacencyBonus);
  return Math.min(MAX_EXECUTIVE_SLOTS, BASE_EXECUTIVE_SLOTS + Math.floor(caps.hiringCap / 4));
}

/** Repeating one building is allowed, but a varied campus is the better buy. */
export function buildingConstructionCost(company: Company, type: BuildingType): number {
  const sameTypeCount = company.buildings.filter((building) => building.type === type).length;
  return Math.round(buildingCostFor(type, 1) * (1 + sameTypeCount * 0.12));
}

export interface BuildingPlacement {
  x: number;
  y: number;
  score: number;
  combos: BuildingComboDef[];
  isValid: boolean;
}

/** Explain the combinations a new building would make in one grid cell. */
export function evaluateBuildingPlacement(
  company: Company,
  type: BuildingType,
  x: number,
  y: number,
  mapSize: number,
): BuildingPlacement {
  const inBounds = x >= 0 && y >= 0 && x < mapSize && y < mapSize;
  const occupied = company.buildings.some((building) => building.x === x && building.y === y);
  if (!inBounds || occupied) return { x, y, score: -1, combos: [], isValid: false };

  const neighbours = company.buildings.filter(
    (building) => Math.abs(building.x - x) + Math.abs(building.y - y) === 1,
  );
  const combos = neighbours
    .map((building) => COMBO_BY_PAIR.get(adjacencyPairKey(type, building.type)))
    .filter((combo): combo is BuildingComboDef => Boolean(combo));
  const newVariety = company.buildings.some((building) => building.type === type) ? 0 : 3;
  // Among otherwise equal cells, grow the city outward from its centre
  // instead of scattering buildings into far corners.
  const touching = neighbours.length > 0 ? 1 : 0;
  const center = (mapSize - 1) / 2;
  const closeness = 1 - (Math.abs(x - center) + Math.abs(y - center)) / Math.max(1, mapSize);
  return { x, y, score: combos.length * 10 + newVariety + touching + closeness * 0.5, combos, isValid: true };
}

/** Best empty cell, with stable tie-breaking for both players and AI. */
export function findBestBuildingCell(
  company: Company,
  type: BuildingType,
  mapSize: number,
): BuildingPlacement | null {
  let best: BuildingPlacement | null = null;
  for (let y = 0; y < mapSize; y += 1) {
    for (let x = 0; x < mapSize; x += 1) {
      const candidate = evaluateBuildingPlacement(company, type, x, y, mapSize);
      if (!candidate.isValid) continue;
      if (!best || candidate.score > best.score) best = candidate;
    }
  }
  return best;
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

import {
  BUILDING_COMBOS,
  BUILDINGS,
  campusDemandBoost,
  getActiveBuildingCombos,
  type BuildingComboDef,
  type BuildingType,
  type Company,
  type GameState,
} from "../engine";

// Presentation helpers for the construction screen. They only read game
// state, so they never change saves or the simulation.

export type BuildingRole = "money" | "smart" | "happy";

export const BUILDING_ROLE_LABELS: Record<BuildingRole, { emoji: string; label: string; hint: string }> = {
  money: { emoji: "💰", label: "돈 버는 건물", hint: "생산·손님을 늘려 매출을 키워요" },
  smart: { emoji: "💡", label: "똑똑한 건물", hint: "품질·효율을 높여 회사를 튼튼하게" },
  happy: { emoji: "😊", label: "행복한 건물", hint: "직원 행복·평판을 높여요" },
};

const ROLE: Record<BuildingType, BuildingRole> = {
  factory: "money",
  store: "money",
  warehouse: "money",
  power: "money",
  office: "smart",
  rnd: "smart",
  lab: "smart",
  hr: "happy",
  park: "happy",
  cafeteria: "happy",
  dorm: "happy",
  gym: "happy",
  daycare: "happy",
  clinic: "happy",
};

const TAGLINE: Record<BuildingType, string> = {
  factory: "물건을 더 많이 만들어요",
  store: "손님이 더 많이 와요",
  warehouse: "배송이 빨라져요",
  power: "전기를 아껴요",
  office: "회사 일이 척척",
  rnd: "품질을 높여요",
  lab: "연구가 빨라져요",
  hr: "임원 자리가 늘어요",
  park: "싸고 예쁜 쉼터",
  cafeteria: "직원이 행복해요",
  dorm: "가까운 직원 집",
  gym: "튼튼한 직원",
  daycare: "가족 친화 회사",
  clinic: "아프면 바로 치료",
};

export function buildingRole(type: BuildingType): BuildingRole {
  return ROLE[type];
}

export function buildingTagline(type: BuildingType): string {
  return TAGLINE[type];
}

/** Short, child-friendly effect chips for one level of a building. */
export function buildingEffectChips(type: BuildingType, levels = 1): string[] {
  const effects = BUILDINGS[type].effects;
  const chips: string[] = [];
  if (effects.productionCapacity) chips.push(`🏭 생산 +${effects.productionCapacity * levels}개`);
  const customers = (reach: number, logistics: number) =>
    Math.round((campusDemandBoost({ marketingReach: reach, logistics }) - 1) * 100);
  if (effects.marketingReach) chips.push(`🛍️ 손님 +${customers(effects.marketingReach * levels, 0)}%`);
  if (effects.logistics) chips.push(`🚚 손님 +${customers(0, effects.logistics * levels)}%`);
  if (effects.rndPower) chips.push(`🔬 연구력 +${effects.rndPower * levels}`);
  if (effects.productionEfficiency) chips.push(`💸 생산비 −${Math.round(effects.productionEfficiency * levels * 100)}%`);
  if (effects.morale) chips.push(`😊 행복 +${effects.morale * levels}`);
  if (effects.reputation) chips.push(`⭐ 평판 +${effects.reputation * levels}`);
  if (effects.hiringCap) chips.push("👔 임원 자리↑");
  return chips;
}

export interface CityStage {
  id: string;
  emoji: string;
  label: string;
  /** Minimum city score for this stage. */
  min: number;
}

export const CITY_STAGES: readonly CityStage[] = [
  { id: "village", emoji: "🏡", label: "작은 마을", min: 0 },
  { id: "town", emoji: "🏘️", label: "마을", min: 5 },
  { id: "small-city", emoji: "🏙️", label: "소도시", min: 10 },
  { id: "city", emoji: "🌆", label: "도시", min: 18 },
  { id: "metropolis", emoji: "🌃", label: "대도시", min: 28 },
  { id: "dragon-city", emoji: "🐉", label: "드래곤 시티", min: 40 },
];

export interface CityProgress {
  score: number;
  stage: CityStage;
  next: CityStage | null;
  /** 0..1 progress from this stage to the next one. */
  progress: number;
  pointsToNext: number;
}

/** City score: every building level is a point, every combination two more. */
export function cityScore(company: Pick<Company, "buildings">): number {
  const operational = company.buildings.filter((building) => building.turnsLeft <= 0);
  const levels = operational.reduce((sum, building) => sum + building.level, 0);
  return levels + getActiveBuildingCombos(company.buildings).length * 2;
}

export function getCityProgress(company: Pick<Company, "buildings">): CityProgress {
  const score = cityScore(company);
  let index = 0;
  for (let i = 0; i < CITY_STAGES.length; i += 1) if (score >= CITY_STAGES[i].min) index = i;
  const stage = CITY_STAGES[index];
  const next = CITY_STAGES[index + 1] ?? null;
  return {
    score,
    stage,
    next,
    progress: next ? (score - stage.min) / (next.min - stage.min) : 1,
    pointsToNext: next ? next.min - score : 0,
  };
}

export interface BuildingCollectionEntry {
  type: BuildingType;
  count: number;
  topLevel: number;
}

export interface ComboCollectionEntry {
  combo: BuildingComboDef;
  found: boolean;
}

/** Which building types and combinations the student has discovered so far. */
export function getCityCollection(game: GameState, company: Company): {
  buildings: BuildingCollectionEntry[];
  combos: ComboCollectionEntry[];
} {
  const enabled = game.config.enabledBuildings;
  const active = new Set(getActiveBuildingCombos(company.buildings).map((combo) => combo.id));
  return {
    buildings: enabled.map((type) => {
      const owned = company.buildings.filter((building) => building.type === type);
      return {
        type,
        count: owned.length,
        topLevel: owned.reduce((top, building) => Math.max(top, building.level), 0),
      };
    }),
    combos: BUILDING_COMBOS.filter((combo) => combo.pair.every((type) => enabled.includes(type))).map((combo) => ({
      combo,
      found: active.has(combo.id),
    })),
  };
}

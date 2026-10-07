import {
  BUILDING_COMBOS,
  BUILDINGS,
  CITY_STAGES,
  type CityStage,
  campusDemandBoost,
  cityScore as engineCityScore,
  getActiveBuildingCombos,
  VILLAGE_ROLES,
  type BuildingComboDef,
  type BuildingType,
  type Company,
  type GameState,
} from "../engine";

// Presentation helpers for the construction screen. They only read game
// state, so they never change saves or the simulation.

export type BuildingRole = "money" | "smart" | "happy" | "home" | "decor" | "landmark";

export const BUILDING_ROLE_LABELS: Record<BuildingRole, { emoji: string; label: string; hint: string }> = {
  money: { emoji: "💰", label: "돈 버는 건물", hint: "생산·손님을 늘려 매출을 키워요" },
  smart: { emoji: "💡", label: "똑똑한 건물", hint: "품질·효율을 높여 회사를 튼튼하게" },
  happy: { emoji: "😊", label: "행복한 건물", hint: "직원 행복·평판을 높여요" },
  home: { emoji: "🏡", label: "마을 건물", hint: "주민이 이사 와서 살아요" },
  decor: { emoji: "🌼", label: "꾸미기", hint: "값싸고 유지비 없는 소품" },
  landmark: { emoji: "🏛️", label: "랜드마크", hint: "도시가 커지면 열리는 명소" },
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
  dorm: "home",
  house: "home",
  grass: "decor",
  clover: "decor",
  pinetree: "decor",
  birchtree: "decor",
  flowerbed: "decor",
  bench: "decor",
  streetlamp: "decor",
  bigtree: "decor",
  noticeboard: "decor",
  pond: "decor",
  carousel: "decor",
  balloon: "decor",
  cherrytree: "decor",
  parasol: "decor",
  pumpkin: "decor",
  snowman: "decor",
  gym: "happy",
  daycare: "happy",
  clinic: "happy",
  fountain: "landmark",
  statue: "landmark",
  clocktower: "landmark",
  ferris: "landmark",
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
  dorm: "주민 12명이 사는 집",
  house: "주민 8명이 사는 집",
  grass: "폭신한 초록 바닥",
  clover: "작은 클로버 바닥",
  pinetree: "사계절 초록 나무",
  birchtree: "하얀 줄기, 연두 그늘",
  flowerbed: "알록달록 꽃밭",
  bench: "쉬어 가는 벤치",
  streetlamp: "밤길을 밝혀요",
  bigtree: "시원한 그늘",
  noticeboard: "마을 소식판",
  pond: "물고기 연못",
  carousel: "빙글빙글 놀이",
  balloon: "축제 분위기",
  cherrytree: "봄 한정 꽃나무",
  parasol: "여름 한정 그늘",
  pumpkin: "가을 한정 장식",
  snowman: "겨울 한정 친구",
  gym: "튼튼한 직원",
  daycare: "가족 친화 회사",
  clinic: "아프면 바로 치료",
  fountain: "물소리 시원한 광장",
  statue: "우리 도시의 상징",
  clocktower: "모두 정시 출근",
  ferris: "관광객이 몰려와요",
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
  const village = VILLAGE_ROLES[type] ?? {};
  const chips: string[] = [];
  if (village.residents) chips.push(`👥 주민 +${village.residents * levels}명`);
  if (effects.productionCapacity) chips.push(`🏭 생산 +${effects.productionCapacity * levels}개`);
  const customers = (reach: number, logistics: number) =>
    Math.round((campusDemandBoost({ marketingReach: reach, logistics }) - 1) * 100);
  if (effects.marketingReach) chips.push(`🛍️ 손님 +${customers(effects.marketingReach * levels, 0)}%`);
  if (effects.logistics) chips.push(`🚚 손님 +${customers(0, effects.logistics * levels)}%`);
  if (effects.rndPower) chips.push(`🔬 연구력 +${effects.rndPower * levels}`);
  if (effects.productionEfficiency) chips.push(`💸 생산비 −${Math.round(effects.productionEfficiency * levels * 100)}%`);
  if (effects.morale) chips.push(`😊 직원 행복 +${effects.morale * levels}`);
  if (effects.reputation) chips.push(`⭐ 평판 +${effects.reputation * levels}`);
  if ((village.happy ?? 0) > 0) chips.push("🌳 이웃 집 행복↑");
  if (effects.hiringCap) chips.push("👔 임원 자리↑");
  return chips;
}

export type { CityStage } from "../engine";
export { CITY_STAGES } from "../engine";

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
  return engineCityScore(company.buildings);
}

/** The city stage at which a building kind opens (null when open from the start). */
export function unlockStageFor(type: BuildingType): CityStage | null {
  const needed = BUILDINGS[type].unlockCityScore ?? 0;
  if (needed <= 0) return null;
  return [...CITY_STAGES].reverse().find((stage) => stage.min <= needed) ?? null;
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

/**
 * Short "what I did this turn" labels for every working building, shown as
 * floating pop-ups on the campus after a turn. Factories split this turn's
 * production by their share of capacity; other buildings show their effect.
 */
export function buildingWorkReport(
  company: Pick<Company, "buildings">,
  unitsProduced: number,
): Record<string, string> {
  const live = company.buildings.filter((b) => b.turnsLeft <= 0);
  const factoryCap = live
    .filter((b) => b.type === "factory")
    .reduce((sum, b) => sum + (BUILDINGS.factory.effects.productionCapacity ?? 0) * b.level, 0);
  const labels: Record<string, string> = {};
  for (const b of live) {
    const fx = BUILDINGS[b.type].effects;
    if (b.type === "factory" && factoryCap > 0) {
      const share = ((fx.productionCapacity ?? 0) * b.level) / factoryCap;
      labels[b.id] = `📦 +${Math.round(unitsProduced * share).toLocaleString()}개 생산`;
    } else if (fx.marketingReach) {
      labels[b.id] = `🛍️ 손님 +${Math.round((campusDemandBoost({ marketingReach: fx.marketingReach * b.level, logistics: 0 }) - 1) * 100)}%`;
    } else if (fx.logistics) {
      labels[b.id] = `🚚 배송 +${Math.round((campusDemandBoost({ marketingReach: 0, logistics: fx.logistics * b.level }) - 1) * 100)}%`;
    } else if (fx.rndPower) {
      labels[b.id] = `🔬 연구 +${fx.rndPower * b.level}`;
    } else if (fx.productionEfficiency && !fx.morale) {
      labels[b.id] = `💸 생산비 −${Math.round(fx.productionEfficiency * b.level * 100)}%`;
    } else if (fx.morale) {
      labels[b.id] = `😊 행복 +${fx.morale * b.level}`;
    } else if (fx.reputation) {
      labels[b.id] = `⭐ 평판 +${fx.reputation * b.level}`;
    }
  }
  return labels;
}

export type DecorCategory = "all" | "ground" | "plants" | "props";
export const DECOR_CATEGORIES: { id: DecorCategory; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "ground", label: "🌱 바닥" },
  { id: "plants", label: "🌳 식물" },
  { id: "props", label: "🪑 소품" },
];

export function decorCategory(type: BuildingType): Exclude<DecorCategory, "all"> | null {
  if (!BUILDINGS[type].decor) return null;
  if (type === "grass" || type === "clover") return "ground";
  if (["flowerbed", "bigtree", "pinetree", "birchtree", "cherrytree"].includes(type)) return "plants";
  return "props";
}

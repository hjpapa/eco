import type { AssetClass, BuildingType, EventLayer, Level, LevelConfig } from "./types";

// Difficulty presets. A single engine is parameterised by these configs so the
// same simulation can serve elementary, middle/high and university players.

const ALL_ASSETS: AssetClass[] = [
  "deposit",
  "bond",
  "etf",
  "realestate",
  "gold",
  "oil",
  "fx",
  "crypto",
];

const ALL_BUILDINGS: BuildingType[] = [
  "factory",
  "rnd",
  "office",
  "warehouse",
  "store",
  "power",
  "hr",
  "park",
  "cafeteria",
  "dorm",
  "gym",
  "daycare",
  "clinic",
  "lab",
  "fountain",
  "statue",
  "clocktower",
  "ferris",
  "house",
];

const ALL_LAYERS: EventLayer[] = [
  "macro",
  "monetary",
  "geopolitics",
  "intercompany",
  "internal",
  "market",
  "visitor",
];

export const LEVEL_CONFIGS: Record<Level, LevelConfig> = {
  elementary: {
    level: "elementary",
    label: "초등학생",
    description: "쉬운 용어로 회사를 키우며 금리·물가·환율과 재무를 배워요.",
    mapSize: 7,
    instantBuild: true,
    adjacencyBonus: true,
    startingCash: 1_000_000,
    volatility: 0.5,
    eventIntensity: 0.6,
    enabledAssets: ["deposit", "bond", "etf", "gold", "fx"],
    // Every building kind is available; newer kinds open as the city grows
    // (see BuildingDef.unlockCityScore) so the first choices stay simple.
    enabledBuildings: [
      "factory",
      "warehouse",
      "store",
      "office",
      "rnd",
      "park",
      "cafeteria",
      "daycare",
      "power",
      "gym",
      "fountain",
      "clinic",
      "lab",
      "statue",
      "dorm",
      "hr",
      "clocktower",
      "ferris",
      "house",
    ],
    enabledEventLayers: ["macro", "monetary", "market", "internal", "visitor"],
    showAdvancedMetrics: true,
    characterDepth: "simple",
    aiCount: 20,
  },
  middle: {
    level: "middle",
    label: "중·고등학생",
    description: "금리·인플레이션·R&D까지. 경영과 투자 전략을 본격적으로 배워요.",
    mapSize: 8,
    instantBuild: false,
    adjacencyBonus: true,
    startingCash: 600_000,
    volatility: 1.0,
    eventIntensity: 1.0,
    enabledAssets: ["deposit", "bond", "etf", "realestate", "gold", "oil"],
    enabledBuildings: ["factory", "rnd", "office", "warehouse", "store", "hr", "park", "cafeteria", "dorm", "gym", "daycare", "clinic", "lab", "fountain", "statue", "clocktower", "ferris", "house"],
    enabledEventLayers: ["macro", "monetary", "geopolitics", "intercompany", "internal", "market", "visitor"],
    showAdvancedMetrics: true,
    characterDepth: "roles",
    aiCount: 24,
  },
  university: {
    level: "university",
    label: "대학생·성인",
    description: "재무·부채·환율·암호화폐까지 본격 시뮬레이션. 복합 이벤트가 연쇄적으로 발생합니다.",
    mapSize: 10,
    instantBuild: false,
    adjacencyBonus: true,
    startingCash: 500_000,
    volatility: 1.5,
    eventIntensity: 1.4,
    enabledAssets: ALL_ASSETS,
    enabledBuildings: ALL_BUILDINGS,
    enabledEventLayers: ALL_LAYERS,
    showAdvancedMetrics: true,
    characterDepth: "full",
    aiCount: 28,
  },
};

export function getLevelConfig(level: Level): LevelConfig {
  return LEVEL_CONFIGS[level];
}

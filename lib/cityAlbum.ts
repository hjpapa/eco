import { BUILDINGS, getCampaignOutcome, villageStats, type BuildingType, type GameState } from "./engine";

export interface CityAlbum {
  version: 1;
  mapSize: number;
  buildings: { type: BuildingType; x: number; y: number; level: number; building: boolean }[];
  residents: number;
  happiness: number;
  stars: number;
  achievements: number;
  highlights: string[];
}

export function makeCityAlbum(game: GameState): CityAlbum | undefined {
  const company = game.companies.find((c) => c.id === game.playerCompanyId);
  if (!company) return undefined;
  const village = villageStats(company.buildings);
  return {
    version: 1, mapSize: game.config.mapSize,
    buildings: company.buildings.map((b) => ({ type: b.type, x: b.x, y: b.y, level: b.level, building: b.turnsLeft > 0 })),
    residents: village.population, happiness: Math.round(village.happiness), stars: village.stars,
    achievements: game.achievements?.length ?? 0,
    highlights: getCampaignOutcome(game).badges.filter((b) => b.earned).slice(0, 3).map((b) => `${b.emoji} ${b.label}`),
  };
}

/** A broken optional album must never hide an older, valid adventure record. */
export function readCityAlbum(value: unknown): CityAlbum | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as CityAlbum;
  if (a.version !== 1 || !Number.isInteger(a.mapSize) || a.mapSize < 1 || a.mapSize > 32
    || !Array.isArray(a.buildings) || a.buildings.length > a.mapSize * a.mapSize
    || !Number.isInteger(a.residents) || a.residents < 0
    || !Number.isFinite(a.happiness) || a.happiness < 0 || a.happiness > 100
    || !Number.isInteger(a.stars) || a.stars < 1 || a.stars > 5
    || !Number.isInteger(a.achievements) || a.achievements < 0
    || !Array.isArray(a.highlights) || a.highlights.length > 3
    || a.highlights.some((text) => typeof text !== "string" || text.length > 120)) return undefined;
  const cells = new Set<string>();
  for (const b of a.buildings) {
    if (!b || !Object.hasOwn(BUILDINGS, b.type) || !Number.isInteger(b.x) || !Number.isInteger(b.y)
      || b.x < 0 || b.y < 0 || b.x >= a.mapSize || b.y >= a.mapSize
      || !Number.isInteger(b.level) || b.level < 1 || b.level > BUILDINGS[b.type].maxLevel
      || typeof b.building !== "boolean" || cells.has(`${b.x},${b.y}`)) return undefined;
    cells.add(`${b.x},${b.y}`);
  }
  return a;
}

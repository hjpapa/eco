import { getCampaignOutcome, villageStats, type GameState } from "./engine";
import { ENDINGS, getEndingId, type EndingId } from "./endings";
import type { KeyValueStorage } from "./storage";

export const HALL_KEY = "dragon-city-hall-v1";
export interface HallRecord {
  id: string; name: string; ending: EndingId; rank: number; wealth: number;
  turns: number; length: number; level: string; date: number;
  /** Village at the end (missing on records from before the village). */
  stars?: number; residents?: number; neighbours?: number;
}
export function readHall(storage: KeyValueStorage | null): HallRecord[] {
  try {
    const data: unknown = JSON.parse(storage?.getItem(HALL_KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((r): r is HallRecord => !!r && typeof r.id === "string" && typeof r.name === "string"
      && Object.hasOwn(ENDINGS, r.ending) && [r.rank, r.wealth, r.turns, r.length, r.date].every(Number.isFinite)
      && r.rank > 0 && r.turns >= 0 && r.length > 0 && typeof r.level === "string").slice(0, 30);
  } catch { return []; }
}
export function saveHall(storage: KeyValueStorage | null, game: GameState): boolean {
  if (!storage || game.status !== "ended") return false;
  const outcome = getCampaignOutcome(game);
  const record: HallRecord = {
    id: `${game.createdAt}:${game.seed}:${game.playerCompanyId}`,
    name: game.companies.find((c) => c.id === game.playerCompanyId)?.name ?? "우리 회사",
    ending: getEndingId(game), rank: outcome.finalRank, wealth: outcome.finalNetWorth,
    turns: game.turn, length: game.maxTurns, level: game.level, date: game.updatedAt,
  };
  const player = game.companies.find((c) => c.id === game.playerCompanyId);
  if (player) {
    const village = villageStats(player.buildings);
    record.stars = village.stars;
    record.residents = village.population;
    record.neighbours = (game.residents ?? []).length;
  }
  try {
    const records = readHall(storage).filter((r) => r.id !== record.id);
    storage.setItem(HALL_KEY, JSON.stringify([record, ...records].sort((a, b) => b.date - a.date).slice(0, 30)));
    return true;
  } catch { return false; }
}

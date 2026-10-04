import type { GameState } from "./types";
import { BUILDING_LIST } from "./buildings";
import { SEASONS, SEASON_ORDER } from "./seasons";
import { PERSONALITIES, RESIDENTS } from "../data/residents";

// 📖 도감: a sticker book. Every neighbour who moves in, every kind of
// building or decoration built for the first time and every festival the city
// joins leaves a sticker that stays even if the building is sold or the
// neighbour moves away. Achievements are shown in the book too, from their
// own record.

export type StickerKind = "resident" | "building" | "decor" | "festival";

export interface StickerDef {
  key: string;
  kind: StickerKind;
  emoji: string;
  name: string;
  /** How to get it, shown on the empty slot. */
  hint: string;
}

export const STICKER_KINDS: { kind: StickerKind; emoji: string; label: string }[] = [
  { kind: "resident", emoji: "🐾", label: "이웃" },
  { kind: "building", emoji: "🏢", label: "건물" },
  { kind: "decor", emoji: "🌼", label: "꾸미기" },
  { kind: "festival", emoji: "🎉", label: "축제" },
];

/** Every sticker this game can give, in book order. */
export function stickerCatalog(state: GameState): StickerDef[] {
  const enabled = new Set(state.config.enabledBuildings);
  const buildings = BUILDING_LIST.filter((def) => enabled.has(def.type));
  return [
    ...RESIDENTS.map((r) => ({
      key: `resident:${r.id}`,
      kind: "resident" as const,
      emoji: r.emoji,
      name: r.name,
      hint: `${PERSONALITIES[r.personality].label} 이웃 · ${PERSONALITIES[r.personality].likes}을 좋아해요`,
    })),
    ...buildings.filter((def) => !def.decor).map((def) => ({
      key: `building:${def.type}`,
      kind: "building" as const,
      emoji: def.emoji,
      name: def.name,
      hint: "처음 지으면 받아요",
    })),
    ...buildings.filter((def) => def.decor).map((def) => ({
      key: `building:${def.type}`,
      kind: "decor" as const,
      emoji: def.emoji,
      name: def.name,
      hint: def.season ? `${SEASONS[def.season].emoji} ${SEASONS[def.season].name}에만 살 수 있어요` : "꾸미기에서 놓아 보세요",
    })),
    ...SEASON_ORDER.map((season) => SEASONS[season].festival).map((festival) => ({
      key: `festival:${festival.id}`,
      kind: "festival" as const,
      emoji: festival.emoji,
      name: festival.name,
      hint: festival.missing,
    })),
  ];
}

/** Stickers the city has earned right now (finished buildings and current neighbours). */
export function ownedStickerKeys(state: GameState): string[] {
  const player = state.companies.find((c) => c.id === state.playerCompanyId);
  const keys = new Set<string>();
  for (const b of player?.buildings ?? []) if (b.turnsLeft <= 0) keys.add(`building:${b.type}`);
  for (const r of state.residents ?? []) keys.add(`resident:${r.id}`);
  return [...keys];
}

/**
 * Add newly earned stickers to the book and return them (for a "✨ 새 스티커"
 * toast). A save from before the book starts with what it already has, quietly.
 */
export function syncStickers(state: GameState, extra: string[] = []): StickerDef[] {
  if (!state.stickers) {
    state.stickers = [...new Set([...ownedStickerKeys(state), ...extra])];
    return [];
  }
  const have = new Set(state.stickers);
  const fresh: string[] = [];
  for (const key of [...ownedStickerKeys(state), ...extra]) {
    if (have.has(key)) continue;
    have.add(key);
    fresh.push(key);
  }
  state.stickers.push(...fresh);
  const catalog = new Map(stickerCatalog(state).map((sticker) => [sticker.key, sticker]));
  return fresh.map((key) => catalog.get(key)).filter((sticker): sticker is StickerDef => !!sticker);
}

/** Money spent on decorations, and what it would have earned in a deposit instead (기회비용). */
export function decorOpportunity(state: GameState): { spent: number; interest: number } {
  const log = state.decorLog ?? [];
  const perTurn = Math.max(0, state.macro.interestRate) / 100 / 4;
  let spent = 0;
  let interest = 0;
  for (const item of log) {
    spent += item.cost;
    interest += item.cost * (Math.pow(1 + perTurn, Math.max(0, state.turn - item.turn)) - 1);
  }
  return { spent, interest: Math.round(interest) };
}

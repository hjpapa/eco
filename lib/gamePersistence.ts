import { migrateGameState } from "./engine/campaign";
import type { GameState } from "./engine/types";
import {
  readStoredValue,
  removeStorageKeys,
  writeMigratedStorageValue,
  type KeyValueStorage,
} from "./storage";

export const GAME_SAVE_KEY = "dragon-mountain-city-save-single";
export const LEGACY_GAME_SAVE_KEYS = ["uc-save-single"] as const;

export interface LoadedGameSave {
  game: GameState;
  legacyCampaign: boolean;
}

export function saveGameToStorage(
  storage: KeyValueStorage,
  game: GameState,
): boolean {
  return writeMigratedStorageValue(
    storage,
    GAME_SAVE_KEY,
    LEGACY_GAME_SAVE_KEYS,
    JSON.stringify(game),
  );
}

export function loadGameFromStorage(
  storage: KeyValueStorage,
): LoadedGameSave | null {
  const stored = readStoredValue(
    storage,
    GAME_SAVE_KEY,
    LEGACY_GAME_SAVE_KEYS,
  );
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored.value) as unknown;
    const legacyCampaign =
      !!parsed && typeof parsed === "object" && !("gameLength" in parsed);
    const game = migrateGameState(parsed);
    if (!game) return null;

    // Only remove the former key after a valid save has been parsed and the
    // new branded key has been written successfully.
    saveGameToStorage(storage, game);
    return { game, legacyCampaign };
  } catch {
    return null;
  }
}

export function hasGameSave(storage: KeyValueStorage): boolean {
  return readStoredValue(
    storage,
    GAME_SAVE_KEY,
    LEGACY_GAME_SAVE_KEYS,
  ) !== null;
}

export function clearGameSaves(storage: KeyValueStorage): void {
  removeStorageKeys(storage, [GAME_SAVE_KEY, ...LEGACY_GAME_SAVE_KEYS]);
}

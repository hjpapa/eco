import { describe, expect, it } from "vitest";
import { createGame } from "./engine";
import {
  GAME_SAVE_KEY,
  LEGACY_GAME_SAVE_KEYS,
  clearGameSaves,
  hasGameSave,
  loadGameFromStorage,
} from "./gamePersistence";
import type { KeyValueStorage } from "./storage";

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function savedGame() {
  return createGame({
    level: "elementary",
    seed: 20260901,
    playerCompanyName: "드래곤 상점",
    industryId: "food",
    countryId: "KR",
    gameLength: 50,
    revealMode: "guided",
  });
}

describe("game save brand migration", () => {
  it("loads the former key and moves a valid game to the new key", () => {
    const storage = new MemoryStorage();
    const legacyKey = LEGACY_GAME_SAVE_KEYS[0];
    const game = savedGame();
    game.turn = 7;
    storage.setItem(legacyKey, JSON.stringify(game));

    const loaded = loadGameFromStorage(storage);

    expect(loaded?.game.turn).toBe(7);
    expect(storage.getItem(GAME_SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("does not replace a valid current save with the former key", () => {
    const storage = new MemoryStorage();
    const current = savedGame();
    const legacy = savedGame();
    current.turn = 9;
    legacy.turn = 2;
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(current));
    storage.setItem(LEGACY_GAME_SAVE_KEYS[0], JSON.stringify(legacy));

    expect(loadGameFromStorage(storage)?.game.turn).toBe(9);
    expect(storage.getItem(LEGACY_GAME_SAVE_KEYS[0])).toBeNull();
  });

  it("keeps an invalid former save available for recovery", () => {
    const storage = new MemoryStorage();
    const legacyKey = LEGACY_GAME_SAVE_KEYS[0];
    storage.setItem(legacyKey, "not-json");

    expect(loadGameFromStorage(storage)).toBeNull();
    expect(storage.getItem(legacyKey)).toBe("not-json");
  });

  it("finds and clears either save namespace", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_GAME_SAVE_KEYS[0], JSON.stringify(savedGame()));

    expect(hasGameSave(storage)).toBe(true);
    clearGameSaves(storage);
    expect(hasGameSave(storage)).toBe(false);
  });
});

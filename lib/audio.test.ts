import { describe, expect, it } from "vitest";
import {
  AUDIO_MUTE_KEY,
  LEGACY_AUDIO_MUTE_KEYS,
  readMutePreference,
} from "./audio";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("audio preference brand migration", () => {
  it("preserves mute preference while replacing the former key", () => {
    const storage = new MemoryStorage();
    const legacyKey = LEGACY_AUDIO_MUTE_KEYS[0];
    storage.setItem(legacyKey, "1");

    expect(readMutePreference(storage)).toBe(true);
    expect(storage.getItem(AUDIO_MUTE_KEY)).toBe("1");
    expect(storage.getItem(legacyKey)).toBeNull();
  });
});

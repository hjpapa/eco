import { describe, expect, it } from "vitest";
import {
  getBrowserStorage,
  readStoredValue,
  removeStorageKeys,
  writeMigratedStorageValue,
  type KeyValueStorage,
} from "./storage";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  getItem(key: string) {
    if (this.failReads) throw new Error("storage unavailable");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("brand storage migration", () => {
  it("returns null when a browser blocks localStorage access", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    try {
      expect(getBrowserStorage()).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("prefers the Dragon Mountain City key when both keys exist", () => {
    const storage = new MemoryStorage();
    storage.values.set("dragon-mountain-city-save", "new");
    storage.values.set("uc-save", "legacy");

    expect(
      readStoredValue(storage, "dragon-mountain-city-save", ["uc-save"]),
    ).toEqual({ key: "dragon-mountain-city-save", value: "new" });
  });

  it("copies a legacy value before deleting the old key", () => {
    const storage = new MemoryStorage();
    storage.values.set("uc-save", "legacy");

    expect(
      writeMigratedStorageValue(
        storage,
        "dragon-mountain-city-save",
        ["uc-save"],
        "legacy",
      ),
    ).toBe(true);
    expect(storage.getItem("dragon-mountain-city-save")).toBe("legacy");
    expect(storage.getItem("uc-save")).toBeNull();
  });

  it("keeps the legacy value if writing the new key fails", () => {
    const storage = new MemoryStorage();
    storage.values.set("uc-save", "legacy");
    storage.failWrites = true;

    expect(
      writeMigratedStorageValue(
        storage,
        "dragon-mountain-city-save",
        ["uc-save"],
        "legacy",
      ),
    ).toBe(false);
    expect(storage.getItem("uc-save")).toBe("legacy");
  });

  it("treats blocked reads as unavailable storage", () => {
    const storage = new MemoryStorage();
    storage.failReads = true;

    expect(
      readStoredValue(storage, "dragon-mountain-city-save", ["uc-save"]),
    ).toBeNull();
  });

  it("clears current and legacy keys together", () => {
    const storage = new MemoryStorage();
    storage.values.set("dragon-mountain-city-save", "new");
    storage.values.set("uc-save", "legacy");

    removeStorageKeys(storage, ["dragon-mountain-city-save", "uc-save"]);

    expect(storage.values.size).toBe(0);
  });
});

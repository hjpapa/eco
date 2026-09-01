export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface StoredValue {
  key: string;
  value: string;
}

/** Access can throw in privacy-restricted or sandboxed browser contexts. */
export function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the current brand key first, then fall back to legacy keys. */
export function readStoredValue(
  storage: KeyValueStorage,
  currentKey: string,
  legacyKeys: readonly string[],
): StoredValue | null {
  try {
    const current = storage.getItem(currentKey);
    if (current !== null) return { key: currentKey, value: current };

    for (const key of legacyKeys) {
      const value = storage.getItem(key);
      if (value !== null) return { key, value };
    }
  } catch {
    return null;
  }
  return null;
}

/** Write the new key before removing old keys so migration cannot lose data. */
export function writeMigratedStorageValue(
  storage: KeyValueStorage,
  currentKey: string,
  legacyKeys: readonly string[],
  value: string,
): boolean {
  try {
    storage.setItem(currentKey, value);
    for (const key of legacyKeys) storage.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageKeys(
  storage: KeyValueStorage,
  keys: readonly string[],
): void {
  for (const key of keys) {
    try {
      storage.removeItem?.(key);
    } catch {
      // Keep clearing any remaining keys when one removal is blocked.
    }
  }
}

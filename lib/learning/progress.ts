import type { LearningCourseId } from "./catalog";
import {
  readStoredValue,
  removeStorageKeys,
  writeMigratedStorageValue,
  type KeyValueStorage,
} from "../storage";

export const LEARNING_PROGRESS_VERSION = 1 as const;
export const LEARNING_PROGRESS_KEY = `dragon-mountain-city-learning-progress-v${LEARNING_PROGRESS_VERSION}`;
export const LEGACY_LEARNING_PROGRESS_KEYS = [
  `uc-learning-progress-v${LEARNING_PROGRESS_VERSION}`,
] as const;
export const LEARNING_INTRO_VERSION = 1 as const;
export const LEARNING_INTRO_KEY = `dragon-mountain-city-learning-intro-v${LEARNING_INTRO_VERSION}`;
export const LEGACY_LEARNING_INTRO_KEYS = [
  `uc-learning-intro-v${LEARNING_INTRO_VERSION}`,
] as const;

export interface LearningProgress {
  version: typeof LEARNING_PROGRESS_VERSION;
  completedCourseIds: LearningCourseId[];
  updatedAt: string | null;
}

export type LearningStorage = KeyValueStorage;

interface LearningIntroState {
  version: typeof LEARNING_INTRO_VERSION;
  seenGameIds: string[];
}

const COURSE_IDS = new Set<LearningCourseId>([
  "basics",
  "growth",
  "investing",
  "talent",
  "world",
  "glossary",
]);

export function emptyLearningProgress(): LearningProgress {
  return {
    version: LEARNING_PROGRESS_VERSION,
    completedCourseIds: [],
    updatedAt: null,
  };
}

function browserStorage(): LearningStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLearningProgress(
  storage: LearningStorage | null = browserStorage(),
): LearningProgress {
  if (!storage) return emptyLearningProgress();

  try {
    const stored = readStoredValue(
      storage,
      LEARNING_PROGRESS_KEY,
      LEGACY_LEARNING_PROGRESS_KEYS,
    );
    if (!stored) return emptyLearningProgress();
    const parsed = JSON.parse(stored.value) as Partial<LearningProgress>;
    if (parsed.version !== LEARNING_PROGRESS_VERSION || !Array.isArray(parsed.completedCourseIds)) {
      return emptyLearningProgress();
    }
    const progress: LearningProgress = {
      version: LEARNING_PROGRESS_VERSION,
      completedCourseIds: Array.from(
        new Set(parsed.completedCourseIds.filter((id): id is LearningCourseId => COURSE_IDS.has(id as LearningCourseId))),
      ),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
    writeMigratedStorageValue(
      storage,
      LEARNING_PROGRESS_KEY,
      LEGACY_LEARNING_PROGRESS_KEYS,
      JSON.stringify(progress),
    );
    return progress;
  } catch {
    return emptyLearningProgress();
  }
}

export function completeLearningCourse(
  courseId: LearningCourseId,
  storage: LearningStorage | null = browserStorage(),
  now = new Date(),
): LearningProgress {
  const current = readLearningProgress(storage);
  const next: LearningProgress = {
    version: LEARNING_PROGRESS_VERSION,
    completedCourseIds: current.completedCourseIds.includes(courseId)
      ? current.completedCourseIds
      : [...current.completedCourseIds, courseId],
    updatedAt: now.toISOString(),
  };
  if (storage) {
    writeMigratedStorageValue(
      storage,
      LEARNING_PROGRESS_KEY,
      LEGACY_LEARNING_PROGRESS_KEYS,
      JSON.stringify(next),
    );
  }
  return next;
}

export function clearLearningProgress(storage: LearningStorage | null = browserStorage()): void {
  if (!storage) return;
  removeStorageKeys(storage, [
    LEARNING_PROGRESS_KEY,
    ...LEGACY_LEARNING_PROGRESS_KEYS,
  ]);
}

function readLearningIntroState(storage: LearningStorage | null): LearningIntroState {
  if (!storage) return { version: LEARNING_INTRO_VERSION, seenGameIds: [] };
  try {
    const stored = readStoredValue(
      storage,
      LEARNING_INTRO_KEY,
      LEGACY_LEARNING_INTRO_KEYS,
    );
    const parsed = JSON.parse(stored?.value ?? "null") as Partial<LearningIntroState> | null;
    if (parsed?.version !== LEARNING_INTRO_VERSION || !Array.isArray(parsed.seenGameIds)) {
      return { version: LEARNING_INTRO_VERSION, seenGameIds: [] };
    }
    const state: LearningIntroState = {
      version: LEARNING_INTRO_VERSION,
      seenGameIds: parsed.seenGameIds.filter((id): id is string => typeof id === "string"),
    };
    if (stored) {
      writeMigratedStorageValue(
        storage,
        LEARNING_INTRO_KEY,
        LEGACY_LEARNING_INTRO_KEYS,
        JSON.stringify(state),
      );
    }
    return state;
  } catch {
    return { version: LEARNING_INTRO_VERSION, seenGameIds: [] };
  }
}

/** Intro history is metadata, deliberately separate from the real game save. */
export function hasSeenLearningIntro(
  gameId: string | number,
  storage: LearningStorage | null = browserStorage(),
): boolean {
  return readLearningIntroState(storage).seenGameIds.includes(String(gameId));
}

export function markLearningIntroSeen(
  gameId: string | number,
  storage: LearningStorage | null = browserStorage(),
): void {
  if (!storage) return;
  const current = readLearningIntroState(storage);
  const id = String(gameId);
  if (current.seenGameIds.includes(id)) return;
  // A small bounded history is enough to recognise current/recent saves without
  // allowing onboarding metadata to grow forever.
  const next: LearningIntroState = {
    version: LEARNING_INTRO_VERSION,
    seenGameIds: [...current.seenGameIds, id].slice(-20),
  };
  writeMigratedStorageValue(
    storage,
    LEARNING_INTRO_KEY,
    LEGACY_LEARNING_INTRO_KEYS,
    JSON.stringify(next),
  );
}

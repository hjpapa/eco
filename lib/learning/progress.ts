import type { LearningCourseId } from "./catalog";

export const LEARNING_PROGRESS_VERSION = 1 as const;
export const LEARNING_PROGRESS_KEY = `uc-learning-progress-v${LEARNING_PROGRESS_VERSION}`;
export const LEARNING_INTRO_VERSION = 1 as const;
export const LEARNING_INTRO_KEY = `uc-learning-intro-v${LEARNING_INTRO_VERSION}`;

export interface LearningProgress {
  version: typeof LEARNING_PROGRESS_VERSION;
  completedCourseIds: LearningCourseId[];
  updatedAt: string | null;
}

export interface LearningStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

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
    const raw = storage.getItem(LEARNING_PROGRESS_KEY);
    if (!raw) return emptyLearningProgress();
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (parsed.version !== LEARNING_PROGRESS_VERSION || !Array.isArray(parsed.completedCourseIds)) {
      return emptyLearningProgress();
    }
    return {
      version: LEARNING_PROGRESS_VERSION,
      completedCourseIds: Array.from(
        new Set(parsed.completedCourseIds.filter((id): id is LearningCourseId => COURSE_IDS.has(id as LearningCourseId))),
      ),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
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
  try {
    storage?.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // Completion still succeeds in memory when storage is unavailable or full.
  }
  return next;
}

export function clearLearningProgress(storage: LearningStorage | null = browserStorage()): void {
  try {
    storage?.removeItem?.(LEARNING_PROGRESS_KEY);
  } catch {
    // A blocked storage area should not break the learning UI.
  }
}

function readLearningIntroState(storage: LearningStorage | null): LearningIntroState {
  if (!storage) return { version: LEARNING_INTRO_VERSION, seenGameIds: [] };
  try {
    const parsed = JSON.parse(storage.getItem(LEARNING_INTRO_KEY) ?? "null") as Partial<LearningIntroState> | null;
    if (parsed?.version !== LEARNING_INTRO_VERSION || !Array.isArray(parsed.seenGameIds)) {
      return { version: LEARNING_INTRO_VERSION, seenGameIds: [] };
    }
    return {
      version: LEARNING_INTRO_VERSION,
      seenGameIds: parsed.seenGameIds.filter((id): id is string => typeof id === "string"),
    };
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
  try {
    storage.setItem(LEARNING_INTRO_KEY, JSON.stringify(next));
  } catch {
    // The game remains playable when storage is blocked or full.
  }
}

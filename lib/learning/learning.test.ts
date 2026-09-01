import { describe, expect, it } from "vitest";
import {
  LEARNING_CATALOG,
  LEARNING_INTRO_KEY,
  LEARNING_PROGRESS_KEY,
  advancePracticeTurn,
  completeLearningCourse,
  createPracticeState,
  hasSeenLearningIntro,
  markLearningIntroSeen,
  readLearningProgress,
  updatePracticeDecision,
  type LearningStorage,
} from "./index";

class MemoryStorage implements LearningStorage {
  private values = new Map<string, string>();

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

describe("learning catalog", () => {
  it("contains the six requested learning areas", () => {
    expect(LEARNING_CATALOG.courses.map((course) => course.id)).toEqual([
      "basics",
      "growth",
      "investing",
      "talent",
      "world",
      "glossary",
    ]);
  });
});

describe("isolated fixed-seed practice", () => {
  it("produces the same result after every retry", () => {
    const first = advancePracticeTurn(
      updatePracticeDecision(createPracticeState(), { price: 9, production: 10 }),
    );
    const retried = advancePracticeTurn(
      updatePracticeDecision(createPracticeState(), { price: 9, production: 10 }),
    );
    expect(first).toEqual(retried);
  });

  it("does not read or alter the real game save", () => {
    const storage = new MemoryStorage();
    const saveKey = "uc-save-single";
    const originalSave = '{"turn":17,"company":{"cash":12345}}';
    storage.setItem(saveKey, originalSave);

    let practice = createPracticeState();
    practice = advancePracticeTurn(practice);
    practice = advancePracticeTurn(practice);
    completeLearningCourse("basics", storage, new Date("2026-09-01T00:00:00.000Z"));

    expect(practice.turnsPlayed).toBe(2);
    expect(storage.getItem(saveKey)).toBe(originalSave);
    expect(storage.getItem(LEARNING_PROGRESS_KEY)).not.toBeNull();
  });

  it("records the first-entry choice without changing the game save string", () => {
    const storage = new MemoryStorage();
    const saveKey = "uc-save-single";
    const originalSave = '{"turn":0,"createdAt":1234,"company":{"cash":500000}}';
    storage.setItem(saveKey, originalSave);

    expect(hasSeenLearningIntro(1234, storage)).toBe(false);
    markLearningIntroSeen(1234, storage);

    expect(hasSeenLearningIntro(1234, storage)).toBe(true);
    expect(storage.getItem(saveKey)).toBe(originalSave);
    expect(storage.getItem(LEARNING_INTRO_KEY)).not.toBeNull();
  });
});

describe("versioned learning completion", () => {
  it("does not write progress merely by reading/opening a course", () => {
    const storage = new MemoryStorage();
    expect(readLearningProgress(storage).completedCourseIds).toEqual([]);
    expect(storage.getItem(LEARNING_PROGRESS_KEY)).toBeNull();
  });

  it("writes only after an explicit completion action", () => {
    const storage = new MemoryStorage();
    const progress = completeLearningCourse(
      "investing",
      storage,
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(progress.completedCourseIds).toEqual(["investing"]);
    expect(readLearningProgress(storage)).toEqual(progress);
  });

  it("ignores incompatible old progress payloads", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEARNING_PROGRESS_KEY,
      JSON.stringify({ version: 0, completedCourseIds: ["basics"] }),
    );
    expect(readLearningProgress(storage).completedCourseIds).toEqual([]);
  });
});

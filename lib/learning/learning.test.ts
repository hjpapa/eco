import { describe, expect, it } from "vitest";
import {
  LEARNING_CATALOG,
  LEARNING_INTRO_KEY,
  LEARNING_PROGRESS_KEY,
  LEGACY_LEARNING_INTRO_KEYS,
  LEGACY_LEARNING_PROGRESS_KEYS,
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

  it("provides real, easy explanations for the elementary economy terms", () => {
    const glossary = new Map(
      LEARNING_CATALOG.glossary.flatMap((group) =>
        group.entries.map((entry) => [entry.term, entry.definition] as const),
      ),
    );
    const requiredTerms = [
      "인접 보너스",
      "예금",
      "채권",
      "금",
      "기준금리",
      "인플레이션",
      "환율",
      "부채",
      "이자",
      "대출",
      "현금",
      "매출",
      "이익",
      "순자산",
      "기업가치",
      "투자자산",
      "PER",
      "PBR",
      "ROE",
    ];

    for (const term of requiredTerms) {
      expect(glossary.get(term), `${term} 설명`).toBeTruthy();
      expect(glossary.get(term), `${term} 설명`).not.toBe("설명이 준비 중이에요.");
    }

    expect(glossary.get("인접 보너스")).toMatch(/옆|붙|가까/);
    expect(glossary.get("기준금리")).toMatch(/이자|빌리|빚/);
    expect(glossary.get("인플레이션")).toMatch(/물가/);
    expect(glossary.get("환율")).toMatch(/다른 나라 돈|외국 돈|바꾸/);
    expect(glossary.get("부채")).toMatch(/빚|갚/);
    expect(glossary.get("이자")).toMatch(/빌린 돈|대출|빚/);
  });

  it("teaches the enabled concepts in course content, not only in the glossary", () => {
    const courseBody = LEARNING_CATALOG.courses
      .flatMap((course) =>
        course.sections.flatMap((section) => [
          section.title,
          section.body,
          section.tip ?? "",
        ]),
      )
      .join(" ");
    const conceptsThatNeedTeaching = [
      "인접 보너스",
      "예금",
      "채권",
      "기준금리",
      "인플레이션",
      "환율",
      "부채",
      "이자",
      "대출",
      "현금",
      "매출",
      "이익",
      "순자산",
      "기업가치",
      "투자자산",
      "PER",
      "PBR",
      "ROE",
    ];

    for (const concept of conceptsThatNeedTeaching) {
      expect(courseBody, `${concept} 과정 본문`).toContain(concept);
    }
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
    const saveKey = "dragon-mountain-city-save-single";
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
    const saveKey = "dragon-mountain-city-save-single";
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
  it("moves valid learning progress from the former brand key", () => {
    const storage = new MemoryStorage();
    const legacyKey = LEGACY_LEARNING_PROGRESS_KEYS[0];
    storage.setItem(
      legacyKey,
      JSON.stringify({
        version: 1,
        completedCourseIds: ["basics"],
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    expect(readLearningProgress(storage).completedCourseIds).toEqual(["basics"]);
    expect(storage.getItem(LEARNING_PROGRESS_KEY)).not.toBeNull();
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("moves the former intro history without showing onboarding again", () => {
    const storage = new MemoryStorage();
    const legacyKey = LEGACY_LEARNING_INTRO_KEYS[0];
    storage.setItem(
      legacyKey,
      JSON.stringify({ version: 1, seenGameIds: ["saved-game"] }),
    );

    expect(hasSeenLearningIntro("saved-game", storage)).toBe(true);
    expect(storage.getItem(LEARNING_INTRO_KEY)).not.toBeNull();
    expect(storage.getItem(legacyKey)).toBeNull();
  });

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

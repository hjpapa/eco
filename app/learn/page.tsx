"use client";

import Link from "next/link";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  LEARNING_CATALOG,
  advancePracticeTurn,
  completeLearningCourse,
  createPracticeState,
  emptyLearningProgress,
  estimatePracticeDemand,
  isPracticeReadyToComplete,
  readLearningProgress,
  updatePracticeDecision,
  type LearningCourseId,
  type PracticeState,
} from "@/lib/learning";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LearnPage() {
  const [selectedId, setSelectedId] = useState<LearningCourseId>("basics");
  const [progress, setProgress] = useState(emptyLearningProgress);
  const [confirmed, setConfirmed] = useState<Partial<Record<LearningCourseId, boolean>>>({});
  const [practice, setPractice] = useState(createPracticeState);
  const [returnPath, setReturnPath] = useState("/");
  const practiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProgress(readLearningProgress());
    const params = new URLSearchParams(window.location.search);
    setReturnPath(safeReturnPath(params.get("return")));
    if (params.get("practice") === "basics") {
      setSelectedId("basics");
      window.requestAnimationFrame(() => practiceRef.current?.focus());
    }
  }, []);

  const selectedCourse = useMemo(
    () => LEARNING_CATALOG.courses.find((course) => course.id === selectedId) ?? LEARNING_CATALOG.courses[0],
    [selectedId],
  );
  const completed = progress.completedCourseIds.includes(selectedCourse.id);
  const mayComplete = selectedCourse.id === "basics"
    ? isPracticeReadyToComplete(practice)
    : Boolean(confirmed[selectedCourse.id]);

  const markComplete = () => {
    if (!mayComplete || completed) return;
    setProgress(completeLearningCourse(selectedCourse.id));
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-indigo-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2">
          <Link
            href={returnPath}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            ← 돌아가기
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-slate-900">📘 배우기</h1>
            <p className="hidden text-xs text-slate-500 sm:block">게임을 바꾸지 않는 안전한 연습장</p>
          </div>
          <div className="ml-auto rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
            {progress.completedCourseIds.length}/{LEARNING_CATALOG.courses.length} 완료
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="배우기 과정" className="card h-fit p-3 lg:sticky lg:top-20">
          <h2 className="px-2 pb-2 text-sm font-black text-slate-700">과정 선택</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {LEARNING_CATALOG.courses.map((course) => {
              const active = selectedId === course.id;
              const done = progress.completedCourseIds.includes(course.id);
              return (
                <button
                  key={course.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSelectedId(course.id)}
                  className={`min-h-16 rounded-xl p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                    active
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 hover:bg-brand-50"
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span aria-hidden>{course.icon}</span>
                    {course.shortTitle}
                    {done && <span className="ml-auto" aria-label="완료됨">✓</span>}
                  </span>
                  <span className={`mt-1 block text-xs ${active ? "text-indigo-100" : "text-slate-500"}`}>
                    {course.duration}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <article className="min-w-0 space-y-4">
          <section className="card overflow-hidden">
            <div className="bg-gradient-to-r from-brand-700 to-indigo-500 p-5 text-white sm:p-7">
              <div className="flex items-start gap-3">
                <span className="text-4xl" aria-hidden>{selectedCourse.icon}</span>
                <div>
                  <div className="text-xs font-bold text-indigo-100">{selectedCourse.duration}</div>
                  <h2 className="mt-1 text-2xl font-black">{selectedCourse.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-indigo-50">
                    {selectedCourse.summary}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-4">
                {selectedCourse.sections.map((section) => (
                  <section key={section.title} className="rounded-xl bg-slate-50 p-4">
                    <h3 className="font-black text-slate-800">{section.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
                    {section.tip && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-relaxed text-amber-900">
                        💡 {section.tip}
                      </p>
                    )}
                  </section>
                ))}
              </div>

              <aside className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                <h3 className="text-sm font-black text-brand-900">이번 과정에서 배워요</h3>
                <ul className="mt-3 space-y-2">
                  {selectedCourse.goals.map((goal) => (
                    <li key={goal} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span className="text-brand-600" aria-hidden>✓</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </section>

          {selectedCourse.practice === "basic-company" && (
            <PracticeLab ref={practiceRef} state={practice} onChange={setPractice} />
          )}

          {selectedCourse.id === "glossary" && <GlossaryBrowser />}

          <section className="card p-5" aria-labelledby="lesson-finish-title">
            <h3 id="lesson-finish-title" className="font-black text-slate-800">과정 마치기</h3>
            {selectedCourse.id !== "basics" && !completed && (
              <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(confirmed[selectedCourse.id])}
                  onChange={(event) => setConfirmed((current) => ({
                    ...current,
                    [selectedCourse.id]: event.target.checked,
                  }))}
                  className="h-5 w-5 accent-brand-600"
                />
                내용을 확인했고, 게임에서 직접 시도해 볼게요.
              </label>
            )}
            {selectedCourse.id === "basics" && !mayComplete && !completed && (
              <p className="mt-2 text-sm text-slate-600">
                연습장에서 2분기를 진행하고 한 번 이상 이익을 내면 완료 버튼이 열려요.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={markComplete}
                disabled={!mayComplete || completed}
                className="btn-primary min-h-11 disabled:bg-slate-300"
              >
                {completed ? "✓ 완료한 과정" : "학습 완료로 표시"}
              </button>
              {completed && (
                <Link href={returnPath} className="btn-ghost min-h-11">
                  게임으로 돌아가기 →
                </Link>
              )}
              {returnPath.startsWith("/play") && (
                <Link href="/play?guide=1" className="btn-ghost min-h-11">
                  ✨ 게임 화면 안내 다시 보기
                </Link>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              과정을 열어 보기만 해서는 완료되지 않아요. 위 버튼을 직접 눌러야 이 기기에 완료 이력이 저장돼요.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}

interface PracticeLabProps {
  state: PracticeState;
  onChange(state: PracticeState): void;
}

const PracticeLab = forwardRef<HTMLDivElement, PracticeLabProps>(function PracticeLab(
  { state, onChange },
  ref,
) {
  const finished = state.turn > state.maxTurns;
  const expectedDemand = estimatePracticeDemand(state);
  const ready = isPracticeReadyToComplete(state);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className="card scroll-mt-24 p-5 outline-none ring-brand-300 focus:ring-2 sm:p-7"
      aria-labelledby="practice-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
            실제 게임과 분리된 연습장
          </div>
          <h3 id="practice-title" className="mt-2 text-xl font-black text-slate-900">2분 기초 연습</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            매번 같은 상황에서 시작해요. 여기서 바꾼 값은 실제 회사와 저장 게임에 영향을 주지 않아요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(createPracticeState())}
          className="btn-ghost min-h-11"
        >
          ↻ 처음부터 다시
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <PracticeStat label="연습 분기" value={`${Math.min(state.turn, state.maxTurns)}/${state.maxTurns}`} />
        <PracticeStat label="연습 현금" value={`${state.cash.toLocaleString()}만 원`} />
        <PracticeStat label="예상 수요" value={finished ? "연습 종료" : `약 ${expectedDemand}개`} />
        <PracticeStat label="남은 재고" value={`${state.inventory}개`} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <PracticeControl
          id="practice-price"
          label="판매 가격"
          help="높이면 한 개당 더 남지만 손님이 줄 수 있어요."
          value={state.price}
          min={6}
          max={16}
          unit="만 원"
          disabled={finished}
          onChange={(price) => onChange(updatePracticeDecision(state, { price }))}
        />
        <PracticeControl
          id="practice-production"
          label="생산량"
          help="예상 수요보다 너무 많이 만들면 재고가 남아요."
          value={state.production}
          min={0}
          max={16}
          unit="개"
          disabled={finished}
          onChange={(production) => onChange(updatePracticeDecision(state, { production }))}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={finished}
          onClick={() => onChange(advancePracticeTurn(state))}
          className="btn-primary min-h-12 px-6 text-base"
        >
          다음 연습 분기 ▶
        </button>
        <span className="text-sm text-slate-500">생산비는 개당 5만 원, 기본 비용은 12만 원이에요.</span>
      </div>

      <div aria-live="polite" className="mt-5">
        {state.lastResult ? (
          <div className={`rounded-xl border p-4 ${
            state.lastResult.profit >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}>
            <h4 className="font-black text-slate-800">방금 분기 결과</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <ResultCell label="손님 수(수요)" value={`${state.lastResult.demand}명`} />
              <ResultCell label="판매량" value={`${state.lastResult.sold}개`} />
              <ResultCell label="매출" value={`${state.lastResult.revenue}만 원`} />
              <ResultCell
                label="남은 돈(이익)"
                value={`${state.lastResult.profit >= 0 ? "+" : ""}${state.lastResult.profit}만 원`}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {state.lastResult.inventory > 4
                ? "재고가 조금 많아요. 다음에는 생산량을 줄이거나 가격을 살짝 낮춰 보세요."
                : state.lastResult.sold < state.lastResult.demand
                  ? "사려는 손님보다 물건이 적었어요. 다음에는 생산량을 조금 늘려 보세요."
                  : state.lastResult.profit >= 0
                    ? "수요와 생산이 잘 맞았어요. 가격을 바꾸며 결과가 어떻게 달라지는지 살펴보세요."
                    : "판매는 됐지만 비용이 더 컸어요. 가격과 생산량을 함께 조정해 보세요."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            가격과 생산량을 정한 뒤 다음 연습 분기를 눌러 결과를 확인하세요.
          </div>
        )}
      </div>

      {ready && (
        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-800">
          🎉 기초 연습 목표를 달성했어요. 아래에서 ‘학습 완료로 표시’를 직접 눌러 마무리하세요.
        </div>
      )}
    </section>
  );
});

function PracticeControl({
  id,
  label,
  help,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled: boolean;
  onChange(value: number): void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-black text-slate-800">{label}</label>
        <output htmlFor={id} className="text-lg font-black text-brand-700">{value}{unit}</output>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{help}</p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="btn-ghost h-11 w-11 shrink-0 p-0 text-xl"
        >
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-brand-600"
        />
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="btn-ghost h-11 w-11 shrink-0 p-0 text-xl"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PracticeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 font-black text-slate-800">{value}</div>
    </div>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-black text-slate-800">{value}</div>
    </div>
  );
}

function GlossaryBrowser() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const groups = LEARNING_CATALOG.glossary
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        !normalized
        || entry.term.toLowerCase().includes(normalized)
        || entry.definition.toLowerCase().includes(normalized)),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <section className="card p-5 sm:p-7" aria-labelledby="glossary-title">
      <h3 id="glossary-title" className="text-xl font-black text-slate-900">쉬운 경제 용어 찾기</h3>
      <label htmlFor="glossary-search" className="mt-4 block text-sm font-bold text-slate-700">
        궁금한 말 검색
      </label>
      <input
        id="glossary-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="예: 순자산, 이익, 주식"
        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <section key={group.title}>
            <h4 className="font-black text-slate-700">{group.icon} {group.title}</h4>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.entries.map((entry) => (
                <div key={entry.term} className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-black text-brand-700">{entry.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">찾는 말이 없어요. 다른 낱말로 검색해 보세요.</p>
        )}
      </div>
    </section>
  );
}

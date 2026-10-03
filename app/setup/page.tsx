"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@/lib/data/industries";
import { COUNTRIES } from "@/lib/data/countries";
import { COMPANY_PRESETS } from "@/lib/data/companyPresets";
import { STORY } from "@/lib/data/story";
import type { GameLength, RevealMode } from "@/lib/engine";
import { useGameStore } from "@/store/gameStore";
import { playSfx } from "@/lib/audio";

const COLORS = ["#6366f1", "#ef4444", "#16a34a", "#f59e0b", "#0ea5e9", "#db2777", "#7c3aed", "#0d9488"];
const CAMPUS_SIZE_MAP = { small: 5, medium: 8, large: 12 } as const;

// Two short steps: pick a company, then pick how long to play and go.
const WIZARD_STEPS = [
  { id: "company", label: "회사 정하기" },
  { id: "start", label: "출발 준비" },
] as const;
type WizardStep = typeof WIZARD_STEPS[number]["id"];

const LENGTH_OPTIONS = [
  { value: 20 as const, emoji: "⚡", label: "짧게 20턴", desc: "수업 1~2시간에 딱!", note: "회사가 빨리 자라요" },
  { value: 50 as const, emoji: "🎯", label: "보통 50턴", desc: "처음이라면 추천", note: "천천히 여러 기능을 써 봐요" },
  { value: 100 as const, emoji: "🌳", label: "길게 100턴", desc: "여러 날 이어서", note: "느긋하게 크게 키워요" },
];

function SetupInner() {
  const router = useRouter();
  // New games always use the elementary profile. Legacy levels remain in the
  // engine so old saves can still be opened without changing their rules.
  const level = "elementary" as const;
  const newGame = useGameStore((s) => s.newGame);

  const scenes = STORY[level];
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<"story" | "wizard">("story");
  const [wizardStep, setWizardStep] = useState<WizardStep>("company");

  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const [name, setName] = useState("");
  const [industryId, setIndustryId] = useState(INDUSTRIES[0].id);
  const [countryId, setCountryId] = useState(COUNTRIES[0].id);
  const [color, setColor] = useState(COLORS[0]);
  const [basedOn, setBasedOn] = useState<string | undefined>(undefined);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [campusSize, setCampusSize] = useState<"small" | "medium" | "large">("medium");
  const [gameLength, setGameLength] = useState<GameLength>(50);
  const [revealMode, setRevealMode] = useState<RevealMode>("guided");

  const filteredPresets = useMemo(
    () => COMPANY_PRESETS.filter((p) => filterCountry === "all" || p.countryId === filterCountry),
    [filterCountry],
  );

  const selectPreset = (id: string) => {
    const p = COMPANY_PRESETS.find((x) => x.id === id)!;
    setBasedOn(id);
    setIndustryId(p.industryId);
    setCountryId(p.countryId);
    setColor(p.logoColor);
    setName(p.name);
    playSfx("click");
  };

  const start = () => {
    playSfx("turn");
    newGame({
      level,
      playerCompanyName: name || (basedOn ? COMPANY_PRESETS.find((p) => p.id === basedOn)!.name : "내 회사"),
      industryId,
      countryId,
      logoColor: color,
      basedOn: tab === "preset" ? basedOn : undefined,
      mapSize: CAMPUS_SIZE_MAP[campusSize],
      gameLength,
      revealMode,
    });
    router.push("/play");
  };

  const wizardIdx = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);
  const needsPreset = tab === "preset" && !basedOn;

  // --- Story phase ---
  if (phase === "story") {
    const scene = scenes[sceneIdx];
    return (
      <Shell>
        <div className="card mx-auto max-w-xl animate-popin p-8 text-center">
          <div className="text-7xl">{scene.emoji}</div>
          <h2 className="mt-4 text-2xl font-black text-slate-800">{scene.title}</h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">{scene.body}</p>
          <div className="mt-6 flex justify-center gap-2">
            {scenes.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${i === sceneIdx ? "bg-brand-600" : "bg-slate-300"}`}
              />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="btn-ghost min-h-14 text-base" onClick={() => setPhase("wizard")}>
              건너뛰기
            </button>
            <button
              className="btn-primary min-h-14 text-base"
              onClick={() => {
                playSfx("click");
                if (sceneIdx < scenes.length - 1) setSceneIdx(sceneIdx + 1);
                else setPhase("wizard");
              }}
            >
              {sceneIdx < scenes.length - 1 ? "다음 ▶" : "회사 만들기 ▶"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // --- Wizard phase ---
  const selectedIndustry = INDUSTRIES.find((i) => i.id === industryId);
  const selectedCountry = COUNTRIES.find((c) => c.id === countryId);
  const selectedPreset = COMPANY_PRESETS.find((p) => p.id === basedOn);
  const companyName = name || (selectedPreset?.name ?? "내 회사");

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-5 pb-28">
        <h2 className="text-center text-3xl font-black text-white">회사를 만들어요</h2>

        {/* Step progress */}
        <ol className="mx-auto flex max-w-md items-center gap-2" aria-label="진행 단계">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i < wizardIdx && setWizardStep(s.id)}
                disabled={i > wizardIdx}
                aria-current={i === wizardIdx ? "step" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-black transition ${
                  i === wizardIdx
                    ? "bg-brand-600 text-white shadow"
                    : i < wizardIdx
                      ? "bg-brand-300/30 text-brand-100"
                      : "bg-slate-800 text-slate-500"
                }`}
              >
                <span>{i < wizardIdx ? "✓" : i + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>

        {/* ── Step 1: company ─────────────────────────────────────────── */}
        {wizardStep === "company" && (
          <div className="space-y-4 animate-popin">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard
                active={tab === "preset"}
                emoji="🌍"
                title="유명한 회사 따라 하기"
                text="실제 회사를 닮은 회사로 시작해요."
                onClick={() => { setTab("preset"); playSfx("click"); }}
              />
              <ChoiceCard
                active={tab === "custom"}
                emoji="✨"
                title="내가 새로 만들기"
                text="무엇을 팔지, 어느 나라인지 직접 골라요."
                onClick={() => { setTab("custom"); setBasedOn(undefined); playSfx("click"); }}
              />
            </div>

            <div className="card p-4">
              <label htmlFor="company-name" className="text-base font-black text-slate-700">회사 이름 <span className="text-sm font-bold text-slate-400">(안 적어도 괜찮아요)</span></label>
              <input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder={tab === "preset" && basedOn ? selectedPreset?.name : "예) 드래곤 상점"}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-lg text-slate-800 outline-none focus:border-brand-500"
              />
            </div>

            {tab === "preset" ? (
              <div className="card p-4">
                <div className="mb-1 text-base font-black text-slate-700">따라 할 회사를 골라요</div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <FilterChip active={filterCountry === "all"} onClick={() => setFilterCountry("all")}>전체</FilterChip>
                  {COUNTRIES.map((c) => (
                    <FilterChip key={c.id} active={filterCountry === c.id} onClick={() => setFilterCountry(c.id)}>
                      {c.flag} {c.name}
                    </FilterChip>
                  ))}
                </div>
                <div className="grid max-h-[46vh] gap-2 overflow-y-auto scroll-thin sm:grid-cols-2">
                  {filteredPresets.map((p) => {
                    const ind = INDUSTRIES.find((i) => i.id === p.industryId)!;
                    const ctry = COUNTRIES.find((c) => c.id === p.countryId)!;
                    const active = basedOn === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectPreset(p.id)}
                        className={`flex min-h-16 items-center gap-3 rounded-xl p-3 text-left ring-2 transition ${
                          active ? "bg-brand-50 ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
                          style={{ background: p.logoColor + "22", color: p.logoColor }}
                        >
                          {ind.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="font-black text-slate-800">{p.name} {active && "✓"}</div>
                          <div className="text-sm text-slate-500">{ctry.flag} {ind.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="card p-4">
                  <div className="mb-2 text-base font-black text-slate-700">무엇을 파는 회사인가요?</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        aria-pressed={industryId === ind.id}
                        onClick={() => { setIndustryId(ind.id); setBasedOn(undefined); playSfx("click"); }}
                        className={`min-h-14 rounded-xl px-3 py-2 text-left text-base ring-2 transition ${
                          industryId === ind.id ? "bg-brand-50 ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        <span className="text-xl">{ind.emoji}</span>{" "}
                        <span className="font-bold text-slate-700">{ind.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="mb-2 text-base font-black text-slate-700">어느 나라 회사인가요?</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={countryId === c.id}
                        onClick={() => { setCountryId(c.id); setBasedOn(undefined); playSfx("click"); }}
                        className={`min-h-14 rounded-xl px-3 py-2 text-left text-base ring-2 transition ${
                          countryId === c.id ? "bg-brand-50 ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        {c.flag} <span className="font-bold text-slate-700">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="mb-2 text-base font-black text-slate-700">회사 색깔</div>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`회사 색깔 ${c}`}
                        aria-pressed={color === c}
                        onClick={() => setColor(c)}
                        className={`h-12 w-12 rounded-full ring-4 ${color === c ? "ring-slate-800" : "ring-transparent"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: length + start ──────────────────────────────────── */}
        {wizardStep === "start" && (
          <div className="animate-popin space-y-4">
            <div>
              <h3 className="text-center text-xl font-black text-white">얼마나 오래 할까요?</h3>
              <p className="mt-1 text-center text-base text-slate-300">
                1턴은 회사의 3개월이에요. 버튼 한 번에 3개월이 지나가요.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setGameLength(option.value); playSfx("click"); }}
                  className={`rounded-2xl p-5 text-left ring-2 transition ${
                    gameLength === option.value
                      ? "bg-brand-600/25 ring-brand-400"
                      : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
                  }`}
                  aria-pressed={gameLength === option.value}
                >
                  <div className="text-4xl">{option.emoji}</div>
                  <div className="mt-2 text-lg font-black text-white">{option.label} {gameLength === option.value && "✓"}</div>
                  <div className="mt-1 text-sm font-bold text-brand-200">{option.desc}</div>
                  <div className="mt-1 text-sm text-slate-300">{option.note}</div>
                </button>
              ))}
            </div>

            <div className="card p-5">
              <h3 className="text-center text-lg font-black text-slate-800">🚀 이렇게 시작해요</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <SummaryChip emoji="🏢" label="회사" value={companyName} />
                <SummaryChip emoji={selectedIndustry?.emoji ?? "🏭"} label="파는 것" value={selectedIndustry?.name ?? "-"} />
                <SummaryChip emoji={selectedCountry?.flag ?? "🌍"} label="나라" value={selectedCountry?.name ?? "-"} />
                <SummaryChip emoji="💰" label="시작 돈" value="100만 원" />
              </div>
              <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-brand-800">
                💡 처음엔 <b>건물 짓기</b>와 <b>만들고 팔기</b>부터! 투자와 인재 뽑기는 게임을 하다 보면 열려요.
              </p>
            </div>

            <details className="group rounded-2xl bg-slate-800/60 p-4 text-slate-200 ring-1 ring-slate-700">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-bold">
                👩‍🏫 선생님 설정 (바꾸지 않아도 돼요)
                <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-3 space-y-4">
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-300">땅 크기</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["small", "medium", "large"] as const).map((sz) => {
                      const info = {
                        small: { label: "작게 5×5", emoji: "🏘️" },
                        medium: { label: "보통 8×8", emoji: "🏙️" },
                        large: { label: "크게 12×12", emoji: "🌆" },
                      }[sz];
                      return (
                        <button
                          key={sz}
                          type="button"
                          aria-pressed={campusSize === sz}
                          onClick={() => { setCampusSize(sz); playSfx("click"); }}
                          className={`min-h-12 rounded-xl px-2 text-sm font-bold ring-2 transition ${
                            campusSize === sz ? "bg-brand-600/30 ring-brand-400 text-white" : "bg-slate-900/60 ring-slate-700 text-slate-300"
                          }`}
                        >
                          {info.emoji} {info.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-300">기능 열기</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "guided" as const, label: "🪜 차례로 열기 (추천)" },
                      { value: "all" as const, label: "🔓 처음부터 모두 열기" },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={revealMode === option.value}
                        onClick={() => setRevealMode(option.value)}
                        className={`min-h-12 rounded-xl px-2 text-sm font-bold ring-2 transition ${
                          revealMode === option.value ? "bg-brand-600/30 ring-brand-400 text-white" : "bg-slate-900/60 ring-slate-700 text-slate-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Navigation: pinned to the bottom so it's always under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            className="btn-ghost min-h-14 px-6 text-base"
            onClick={() => (wizardIdx === 0 ? setPhase("story") : setWizardStep(WIZARD_STEPS[wizardIdx - 1].id))}
          >
            ◀ 이전
          </button>
          {needsPreset && wizardStep === "company" && (
            <span className="hidden text-sm font-bold text-amber-200 sm:block">회사를 하나 골라 주세요 👆</span>
          )}
          {wizardStep !== "start" ? (
            <button
              className="btn-primary min-h-14 px-10 text-lg"
              onClick={() => { playSfx("click"); setWizardStep("start"); }}
              disabled={needsPreset}
            >
              다음 ▶
            </button>
          ) : (
            <button className="btn-primary min-h-14 px-10 text-lg" onClick={start}>
              게임 시작 🚀
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function ChoiceCard({ active, emoji, title, text, onClick }: { active: boolean; emoji: string; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl p-5 text-left ring-2 transition ${
        active ? "bg-brand-600/25 ring-brand-400" : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
      }`}
    >
      <div className="text-4xl">{emoji}</div>
      <div className="mt-2 text-lg font-black text-white">{title} {active && "✓"}</div>
      <div className="mt-1 text-sm text-slate-300">{text}</div>
    </button>
  );
}

function SummaryChip({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <div className="text-2xl" aria-hidden>{emoji}</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{label}</div>
      <div className="truncate text-sm font-black text-slate-800" title={value}>{value}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-4 py-10">
      <Link
        href={`/learn?return=${encodeURIComponent("/setup")}`}
        className="fixed right-4 top-4 z-30 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-bold text-brand-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50"
      >
        📘 배우기
      </Link>
      {children}
    </main>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`pill min-h-10 px-3 text-sm ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

export default function SetupPage() {
  return <SetupInner />;
}

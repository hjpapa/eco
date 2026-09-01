"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { INDUSTRIES } from "@/lib/data/industries";
import { COUNTRIES } from "@/lib/data/countries";
import { COMPANY_PRESETS } from "@/lib/data/companyPresets";
import { STORY } from "@/lib/data/story";
import { LEVEL_CONFIGS } from "@/lib/engine";
import type { GameLength, Level, RevealMode } from "@/lib/engine";
import { useGameStore } from "@/store/gameStore";
import { playSfx } from "@/lib/audio";
import { formatMoney } from "@/lib/format";
import { getIndustry } from "@/lib/data/industries";

const COLORS = ["#6366f1", "#ef4444", "#16a34a", "#f59e0b", "#0ea5e9", "#db2777", "#7c3aed", "#0d9488"];
const CAMPUS_SIZE_MAP = { small: 5, medium: 8, large: 12 } as const;

// Wizard steps
const WIZARD_STEPS = [
  { id: "type",   label: "유형 선택" },
  { id: "detail", label: "회사 설정" },
  { id: "campus", label: "캠퍼스" },
  { id: "campaign", label: "게임 방식" },
  { id: "start",  label: "시작" },
] as const;
type WizardStep = typeof WIZARD_STEPS[number]["id"];

function SetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const level = (params.get("level") as Level) || "middle";
  const newGame = useGameStore((s) => s.newGame);

  const scenes = STORY[level];
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<"story" | "wizard">("story");
  const [wizardStep, setWizardStep] = useState<WizardStep>("type");

  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const [name, setName] = useState("");
  const [industryId, setIndustryId] = useState(INDUSTRIES[0].id);
  const [countryId, setCountryId] = useState(COUNTRIES[0].id);
  const [color, setColor] = useState(COLORS[0]);
  const [basedOn, setBasedOn] = useState<string | undefined>(undefined);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [campusSize, setCampusSize] = useState<"small" | "medium" | "large">("medium");
  const [gameLength, setGameLength] = useState<GameLength>(level === "elementary" ? 50 : 100);
  const [revealMode, setRevealMode] = useState<RevealMode>(level === "elementary" ? "guided" : "all");

  const filteredPresets = useMemo(
    () => COMPANY_PRESETS.filter((p) => filterCountry === "all" || p.countryId === filterCountry),
    [filterCountry],
  );

  const rankPreview = useMemo(
    () => [...COMPANY_PRESETS].sort((a, b) => b.scale - a.scale).slice(0, 5),
    [],
  );

  const selectPreset = (id: string) => {
    const p = COMPANY_PRESETS.find((x) => x.id === id)!;
    setBasedOn(id);
    setIndustryId(p.industryId);
    setCountryId(p.countryId);
    setColor(p.logoColor);
    if (!name) setName(p.name);
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

  const goWizard = (step: WizardStep) => setWizardStep(step);
  const wizardIdx = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);

  const goNext = () => {
    const next = WIZARD_STEPS[wizardIdx + 1];
    if (next) goWizard(next.id);
    else start();
  };
  const goPrev = () => {
    const prev = WIZARD_STEPS[wizardIdx - 1];
    if (prev) goWizard(prev.id);
    else setPhase("story");
  };

  // --- Story phase ---
  if (phase === "story") {
    const scene = scenes[sceneIdx];
    return (
      <Shell returnPath={`/setup?level=${level}`}>
        <div className="card mx-auto max-w-xl animate-popin p-8 text-center">
          <div className="text-6xl">{scene.emoji}</div>
          <h2 className="mt-4 text-2xl font-black text-slate-800">{scene.title}</h2>
          <p className="mt-3 text-slate-600">{scene.body}</p>
          <div className="mt-6 flex justify-center gap-2">
            {scenes.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === sceneIdx ? "bg-brand-600" : "bg-slate-300"}`}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-ghost" onClick={() => setPhase("wizard")}>
              건너뛰기
            </button>
            <button
              className="btn-primary"
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
  const levelCfg = LEVEL_CONFIGS[level];
  const levelEmoji: Record<Level, string> = { elementary: "🧒", middle: "🧑‍🎓", university: "🎓" };
  const selectedIndustry = INDUSTRIES.find((i) => i.id === industryId);
  const selectedCountry = COUNTRIES.find((c) => c.id === countryId);
  const selectedPreset = COMPANY_PRESETS.find((p) => p.id === basedOn);

  return (
    <Shell returnPath={`/setup?level=${level}`}>
      <div className="mx-auto max-w-2xl space-y-5">
        <h2 className="text-center text-2xl font-black text-white">회사를 만들어요</h2>

        {/* Step progress indicator */}
        <div className="flex items-center gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <button
                onClick={() => i < wizardIdx && goWizard(s.id)}
                disabled={i > wizardIdx}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                  i === wizardIdx
                    ? "bg-brand-600 text-white shadow"
                    : i < wizardIdx
                      ? "bg-brand-300 text-white cursor-pointer hover:bg-brand-400"
                      : "bg-slate-700 text-slate-500"
                }`}
              >
                {i < wizardIdx ? "✓" : i + 1}
              </button>
              <span className={`ml-1.5 text-xs font-semibold ${i === wizardIdx ? "text-white" : "text-slate-500"}`}>
                {s.label}
              </span>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`mx-2 flex-1 h-px ${i < wizardIdx ? "bg-brand-400" : "bg-slate-700"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Level info bar */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-2.5 ring-1 ring-slate-700/50">
          <span className="text-xl">{levelEmoji[level]}</span>
          <div className="flex-1 text-sm font-bold text-white">{levelCfg.label} 난이도</div>
          <div className="flex gap-3 text-xs text-slate-400">
            <span>시작금 <b className="text-slate-200">{formatMoney(levelCfg.startingCash)}</b></span>
            <span>경쟁사 <b className="text-slate-200">{levelCfg.aiCount}개</b></span>
          </div>
        </div>

        {/* ── Step 1: type selection ─────────────────────────────────── */}
        {wizardStep === "type" && (
          <div className="space-y-4 animate-popin">
            <p className="text-center text-slate-300">어떤 방식으로 회사를 시작할까요?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => { setTab("preset"); playSfx("click"); }}
                className={`rounded-2xl p-5 text-left ring-2 transition ${
                  tab === "preset" ? "bg-brand-600/20 ring-brand-400" : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
                }`}
              >
                <div className="text-3xl">🌍</div>
                <div className="mt-2 text-lg font-bold text-white">실존 기업 모티브</div>
                <div className="mt-1 text-sm text-slate-300">실제 기업을 모델로 시작. 업종·국가가 자동 설정됩니다.</div>
                {tab === "preset" && <div className="mt-2 rounded-full bg-brand-400/20 px-2 py-0.5 text-xs font-bold text-brand-300 inline-block">선택됨 ✓</div>}
              </button>
              <button
                onClick={() => { setTab("custom"); setBasedOn(undefined); playSfx("click"); }}
                className={`rounded-2xl p-5 text-left ring-2 transition ${
                  tab === "custom" ? "bg-brand-600/20 ring-brand-400" : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
                }`}
              >
                <div className="text-3xl">✨</div>
                <div className="mt-2 text-lg font-bold text-white">새 회사 직접 만들기</div>
                <div className="mt-1 text-sm text-slate-300">업종·국가·색상을 자유롭게 선택하세요.</div>
                {tab === "custom" && <div className="mt-2 rounded-full bg-brand-400/20 px-2 py-0.5 text-xs font-bold text-brand-300 inline-block">선택됨 ✓</div>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: company details ───────────────────────────────── */}
        {wizardStep === "detail" && (
          <div className="space-y-4 animate-popin">
            {/* Company name */}
            <div className="card p-4">
              <label className="text-sm font-semibold text-slate-600">회사 이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === "preset" && basedOn ? COMPANY_PRESETS.find(p => p.id === basedOn)!.name : "예) 유니콘 컴퍼니"}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-brand-500"
              />
            </div>

            {tab === "preset" ? (
              <div className="card p-4">
                <div className="mb-3 flex flex-wrap gap-1">
                  <FilterChip active={filterCountry === "all"} onClick={() => setFilterCountry("all")}>전체</FilterChip>
                  {COUNTRIES.map((c) => (
                    <FilterChip key={c.id} active={filterCountry === c.id} onClick={() => setFilterCountry(c.id)}>
                      {c.flag} {c.name}
                    </FilterChip>
                  ))}
                </div>
                <div className="grid max-h-[42vh] gap-2 overflow-y-auto scroll-thin sm:grid-cols-2">
                  {filteredPresets.map((p) => {
                    const ind = INDUSTRIES.find((i) => i.id === p.industryId)!;
                    const ctry = COUNTRIES.find((c) => c.id === p.countryId)!;
                    const active = basedOn === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => selectPreset(p.id)}
                        className={`flex items-center gap-3 rounded-xl p-3 text-left ring-2 transition ${
                          active ? "ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                          style={{ background: p.logoColor + "22", color: p.logoColor }}
                        >
                          {ind.emoji}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-500">{ctry.flag} {ind.name} · {p.blurb}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="card p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-600">업종 선택</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        onClick={() => { setIndustryId(ind.id); setBasedOn(undefined); playSfx("click"); }}
                        className={`rounded-xl px-3 py-2 text-left text-sm ring-2 transition ${
                          industryId === ind.id ? "ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        <span className="text-lg">{ind.emoji}</span>{" "}
                        <span className="font-semibold text-slate-700">{ind.name}</span>
                        {ind.modern && <span className="ml-1 text-xs text-pink-500">NEW</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-600">국가</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setCountryId(c.id); setBasedOn(undefined); playSfx("click"); }}
                        className={`rounded-xl px-3 py-2 text-left text-sm ring-2 transition ${
                          countryId === c.id ? "ring-brand-500" : "ring-slate-200 hover:ring-slate-300"
                        }`}
                      >
                        {c.flag} <span className="font-semibold text-slate-700">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-600">로고 색상</div>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`h-9 w-9 rounded-full ring-2 ${color === c ? "ring-slate-800" : "ring-transparent"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: campus size ───────────────────────────────────── */}
        {wizardStep === "campus" && (
          <div className="animate-popin space-y-4">
            <p className="text-center text-slate-300">캠퍼스 크기를 선택하세요. 건물을 배치할 수 있는 그리드 크기가 달라집니다.</p>
            <div className="grid grid-cols-3 gap-4">
              {(["small", "medium", "large"] as const).map((sz) => {
                const info = {
                  small:  { label: "작게",   grid: "5×5",   desc: "빠른 집중 플레이", emoji: "🏘️" },
                  medium: { label: "중간",   grid: "8×8",   desc: "균형 있는 캠퍼스", emoji: "🏙️" },
                  large:  { label: "크게",   grid: "12×12", desc: "넓고 자유로운 확장", emoji: "🌆" },
                }[sz];
                return (
                  <button
                    key={sz}
                    onClick={() => { setCampusSize(sz); playSfx("click"); }}
                    className={`rounded-2xl p-5 text-center ring-2 transition ${
                      campusSize === sz ? "bg-brand-600/20 ring-brand-400" : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
                    }`}
                  >
                    <div className="text-3xl">{info.emoji}</div>
                    <div className="mt-2 font-bold text-white">{info.label}</div>
                    <div className="mt-0.5 font-mono text-sm text-brand-300">{info.grid}</div>
                    <div className="mt-1 text-xs text-slate-400">{info.desc}</div>
                    {campusSize === sz && <div className="mt-2 text-xs font-bold text-brand-300">선택됨 ✓</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: summary & start ───────────────────────────────── */}
        {wizardStep === "campaign" && (
          <div className="animate-popin space-y-4">
            <div>
              <h3 className="text-center text-lg font-black text-white">얼마나 길게 경영할까요?</h3>
              <p className="mt-1 text-center text-sm text-slate-300">
                {level === "elementary"
                  ? "처음이라면 기본 50분기를 추천해요. 짧은 게임일수록 품질·평판·인재가 더 빠르게 성장합니다."
                  : "기존 난이도는 장기 100분기와 전체 기능 공개가 기본이며, 원하면 더 짧게 바꿀 수 있어요."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { value: 20 as const, emoji: "⚡", label: "빠른 20분기", desc: "한 수업 안에 빠르게", badge: "품질·평판·인재 2.0배" },
                { value: 50 as const, emoji: "🎯", label: "기본 50분기", desc: "처음 플레이 추천", badge: "품질·평판·인재 1.4배" },
                { value: 100 as const, emoji: "🌳", label: "장기 100분기", desc: "천천히 깊이 있게", badge: "기본 성장" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setGameLength(option.value); playSfx("click"); }}
                  className={`rounded-2xl p-4 text-left ring-2 transition ${
                    gameLength === option.value
                      ? "bg-brand-600/20 ring-brand-400"
                      : "bg-slate-800/60 ring-slate-700 hover:ring-slate-500"
                  }`}
                  aria-pressed={gameLength === option.value}
                >
                  <div className="text-3xl">{option.emoji}</div>
                  <div className="mt-2 font-bold text-white">{option.label}</div>
                  <div className="mt-1 text-xs text-slate-300">{option.desc}</div>
                  <span className="mt-3 inline-block rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-brand-200">
                    {option.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-800/70 p-4 ring-1 ring-slate-700">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white">기능을 여는 방법</div>
                  <p className="mt-1 text-sm text-slate-300">
                    단계별 배우기에서는 회사 운영부터 시작해 투자와 인재 기능이 차례로 열려요.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={revealMode === "all"}
                  onClick={() => setRevealMode((mode) => mode === "guided" ? "all" : "guided")}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    revealMode === "all" ? "bg-brand-500" : "bg-slate-600"
                  }`}
                  title="전체 기능 바로 열기"
                >
                  <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    revealMode === "all" ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRevealMode((mode) => mode === "guided" ? "all" : "guided")}
                className="mt-3 text-left text-sm font-semibold text-brand-200 hover:text-white"
              >
                {revealMode === "all" ? "✅ 전체 기능 바로 열기 (숙련자용)" : "🪜 단계별로 하나씩 열기 (추천)"}
              </button>
            </div>
          </div>
        )}

        {wizardStep === "start" && (
          <div className="animate-popin space-y-4">
            <div className="card p-5">
              <h3 className="mb-4 text-center text-lg font-black text-slate-800">🚀 준비 완료!</h3>
              <div className="space-y-3">
                <SummaryRow label="회사 이름" value={name || (selectedPreset?.name ?? "내 회사")} />
                {selectedIndustry && <SummaryRow label="업종" value={`${selectedIndustry.emoji} ${selectedIndustry.name}`} />}
                {selectedCountry && <SummaryRow label="국가" value={`${selectedCountry.flag} ${selectedCountry.name}`} />}
                <SummaryRow label="캠퍼스 크기" value={`${CAMPUS_SIZE_MAP[campusSize]}×${CAMPUS_SIZE_MAP[campusSize]} (${campusSize === "small" ? "작게" : campusSize === "medium" ? "중간" : "크게"})`} />
                <SummaryRow label="게임 길이" value={`${gameLength}분기${gameLength === 50 ? " (추천)" : ""}`} />
                <SummaryRow label="기능 공개" value={revealMode === "guided" ? "단계별로 하나씩" : "처음부터 모두"} />
                <SummaryRow label="시작 자금" value={formatMoney(levelCfg.startingCash)} />
                <SummaryRow label="난이도" value={`${levelEmoji[level]} ${levelCfg.label}`} />
              </div>
              <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
                💡 <b>팁:</b> {revealMode === "guided"
                  ? "처음에는 가격과 생산량을 맞추는 데 집중하세요. 건물과 연구는 알맞은 분기에 차례로 열립니다!"
                  : "기본 상품부터 판매하고 R&D에 투자해 품질을 높이면 더 비싼 상품을 판매할 수 있습니다!"}
              </div>
            </div>

            {/* Competitor preview */}
            <div className="overflow-hidden rounded-2xl bg-slate-800/60 ring-1 ring-slate-700/50">
              <div className="px-4 py-3 text-sm font-bold text-white">예상 경쟁사 순위</div>
              <div className="flex items-end gap-2 px-4 pb-3">
                {rankPreview.map((p, i) => {
                  const ind = getIndustry(p.industryId);
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                  return (
                    <div key={p.id} className="flex flex-1 flex-col items-center gap-1 py-1">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: p.logoColor + "22" }}>
                        {ind.emoji}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 text-center leading-tight truncate w-full">{p.name}</span>
                      <span className="text-xs">{medal}</span>
                    </div>
                  );
                })}
                <div className="flex flex-col items-center gap-1 py-1 opacity-60">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: color + "44" }}>
                    {selectedIndustry?.emoji ?? "🏢"}
                  </span>
                  <span className="text-[9px] text-slate-400">내 회사</span>
                  <span className="text-xs text-slate-400">?위</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2">
          <button className="btn-ghost" onClick={goPrev}>
            ◀ 이전
          </button>
          {wizardStep !== "start" ? (
            <button
              className="btn-primary px-8"
              onClick={goNext}
              disabled={wizardStep === "detail" && tab === "preset" && !basedOn}
            >
              다음 ▶
            </button>
          ) : (
            <button className="btn-primary px-8" onClick={start}>
              게임 시작 🚀
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function Shell({ children, returnPath = "/setup" }: { children: React.ReactNode; returnPath?: string }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-4 py-10">
      <Link
        href={`/learn?return=${encodeURIComponent(returnPath)}`}
        className="fixed right-4 top-4 z-30 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50"
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
      onClick={onClick}
      className={`pill ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<Shell><div className="text-center text-white">불러오는 중…</div></Shell>}>
      <SetupInner />
    </Suspense>
  );
}

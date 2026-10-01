"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { executiveSlots, getCampaignGrowthMultiplier, ROLE_LABELS } from "@/lib/engine";
import type { Character, Company, GameState } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { TALENT_IMGS, idToIndex, BUILDING_IMG } from "@/lib/assetMap";
import { CampusStrip } from "./CampusStrip";

function Avatar({ characterId, emoji }: { characterId: string; emoji: string }) {
  const img = TALENT_IMGS[idToIndex(characterId, TALENT_IMGS.length)];
  if (img) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
        <img src={img} alt="" className="h-full w-full object-contain object-bottom" />
      </span>
    );
  }
  return <span className="text-3xl">{emoji}</span>;
}

const RARITY: Record<string, { label: string; cls: string }> = {
  common:    { label: "일반", cls: "bg-slate-100 text-slate-600" },
  rare:      { label: "레어", cls: "bg-sky-100 text-sky-700" },
  epic:      { label: "에픽", cls: "bg-violet-100 text-violet-700" },
  legendary: { label: "전설", cls: "bg-amber-100 text-amber-700" },
};

const STAT_LABEL: Record<string, string> = {
  management: "경영", tech: "기술", creativity: "창의",
  finance: "재무", leadership: "리더십", marketing: "마케팅",
};

function topStats(ch: Character): [string, number][] {
  return Object.entries(ch.stats).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

// ── Reflex mini-game ────────────────────────────────────────────────────────
function ReflexBar({ onScore }: { onScore: (n: number) => void }) {
  const [pos, setPos] = useState(10);
  const [locked, setLocked] = useState(false);
  const posRef = useRef(10);
  const dirRef = useRef(1);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      posRef.current += dirRef.current * 3;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current = 1; }
      setPos(posRef.current);
    }, 40);
    return () => clearInterval(id);
  }, [locked]);

  const lock = () => {
    if (locked) return;
    setLocked(true);
    const dist = Math.abs(posRef.current - 50);
    const score = dist <= 7 ? 15 : dist <= 17 ? 10 : dist <= 28 ? 5 : 2;
    scoreRef.current = score;
    onScore(score);
  };

  const inGreen  = pos >= 43 && pos <= 57;
  const inYellow = !inGreen && pos >= 35 && pos <= 65;

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-slate-500">초록 구간을 맞출수록 충성도 보너스가 올라가요!</p>
      <div className="relative h-6 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="absolute inset-y-0 left-[35%] w-[30%] bg-yellow-200" />
        <div className="absolute inset-y-0 left-[43%] w-[14%] bg-green-300" />
        <div
          className="absolute inset-y-0 w-1.5 rounded-full bg-slate-900"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <button
        onClick={lock}
        disabled={locked}
        className={`w-full rounded-xl py-2 text-sm font-bold transition ${
          locked
            ? "bg-slate-100 text-slate-400"
            : inGreen
              ? "animate-pulse bg-green-500 text-white"
              : inYellow
                ? "bg-yellow-400 text-white"
                : "bg-slate-700 text-white"
        }`}
      >
        {locked ? `완료! +${scoreRef.current} 보너스` : inGreen ? "🎯 지금 클릭!" : "클릭!"}
      </button>
    </div>
  );
}

// ── Salary negotiation modal ────────────────────────────────────────────────
function SalaryModal({
  ch,
  growthMultiplier,
  onClose,
  onConfirm,
}: {
  ch: Character;
  growthMultiplier: number;
  onClose: () => void;
  onConfirm: (newSalary: number, bonus: number) => void;
}) {
  const [pct, setPct] = useState(110); // new salary = salary * pct/100
  const [bonus, setBonus] = useState<number | null>(null);

  const newSalary = Math.round(ch.salary * pct / 100);
  const ratio = (newSalary - ch.salary) / ch.salary;
  const baseLoyalty = ch.loyalty ?? 70;
  const unscaledGain = Math.round(Math.min(30, ratio * 60)) + (bonus ?? 0);
  const unscaledLoyalty = Math.min(100, baseLoyalty + unscaledGain);
  const scaledLoyalty = Math.min(100, baseLoyalty + (unscaledLoyalty - baseLoyalty) * growthMultiplier);
  const loyaltyGain = Math.round(scaledLoyalty - baseLoyalty);
  const newLoyalty = Math.round(scaledLoyalty);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">연봉 협상</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-xs">✕</button>
        </div>

        {/* Employee */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar characterId={ch.id} emoji={ch.avatar} />
          <div>
            <div className="font-bold text-slate-800">{ch.name}</div>
            <div className="text-xs text-slate-500">
              현재 연봉 {formatMoney(ch.salary)} · 충성도 {Math.round(ch.loyalty ?? 70)}
            </div>
          </div>
        </div>

        {/* Slider */}
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-600">인상률</span>
            <span className="font-bold text-brand-600">+{pct - 100}% → {formatMoney(newSalary)}</span>
          </div>
          <input
            type="range" min={110} max={200} step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-center text-xs text-slate-500">
            예상 충성도 +{loyaltyGain} → {newLoyalty}
          </div>
        </div>

        {/* Mini-game */}
        {bonus === null ? (
          <ReflexBar onScore={setBonus} />
        ) : (
          <div className="rounded-xl bg-green-50 p-3 text-center text-sm text-green-700">
            미니게임 보너스: +{bonus} 충성도 추가
          </div>
        )}

        <button
          className="btn-primary w-full"
          disabled={bonus === null}
          onClick={() => { if (bonus !== null) onConfirm(newSalary, bonus); }}
        >
          협상 확정
        </button>
      </div>
    </div>
  );
}

// ── Poach confirmation modal ────────────────────────────────────────────────
function PoachModal({
  ch,
  targetCompanyName,
  cost,
  canAfford,
  onClose,
  onConfirm,
}: {
  ch: Character;
  targetCompanyName: string;
  cost: number;
  canAfford: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">인재 스카우트</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-xs">✕</button>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar characterId={ch.id} emoji={ch.avatar} />
          <div>
            <div className="font-bold text-slate-800">{ch.name}</div>
            <div className="text-xs text-slate-500">
              {targetCompanyName} 소속 · {ROLE_LABELS[ch.role ?? ch.preferredRole]}
            </div>
            <div className="text-xs text-slate-500">
              충성도 {Math.round(ch.loyalty ?? 70)} · 현 연봉 {formatMoney(ch.salary)}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
          <div>스카우트 비용: <b>{formatMoney(cost)}</b></div>
          <div className="text-xs text-amber-600">연봉 25% 인상 조건 · 초기 충성도 55로 시작</div>
          {!canAfford && <div className="text-xs font-bold text-bear">현금이 부족합니다.</div>}
        </div>

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
          <button
            className="btn-primary flex-1"
            disabled={!canAfford}
            onClick={onConfirm}
          >
            스카우트 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Legendary negotiation (multi-step) ─────────────────────────────────────
const LEGENDARY_DEMANDS = [
  "평판이 충분해야 합니다 (60점 이상)",
  "계약금은 최소 3개월치 연봉이 필요합니다",
  "저는 최고의 역할(임원직)을 보장받아야 합니다",
];

type LegNegStep = "check" | "negotiate" | "minigame" | "confirm";

function LegendaryNegotiationModal({
  ch,
  company,
  fromRival,
  rivalCompanyName,
  onClose,
  onConfirm,
}: {
  ch: Character;
  company: Company;
  fromRival?: boolean;
  rivalCompanyName?: string;
  onClose: () => void;
  onConfirm: (salary: number, loyaltyBonus: number) => void;
}) {
  const [step, setStep] = useState<LegNegStep>("check");
  const [salaryPct, setSalaryPct] = useState(200);
  const [reflexBonus, setReflexBonus] = useState<number | null>(null);
  const [round, setRound] = useState(1); // negotiation rounds 1-3

  const MIN_PCT = fromRival ? 170 : 180;
  const MAX_PCT = 350;

  const reputation = Math.round(company.reputation);
  const minCash = ch.salary * 3;
  const reputationOk = reputation >= 60;
  const cashOk = company.cash >= minCash;
  const noLegendaryHired = !company.hired.some((h) => h.rarity === "legendary");

  const canProceed = reputationOk && cashOk;
  const finalSalary = Math.round(ch.salary * salaryPct / 100);
  const loyaltyGain = Math.round(Math.min(40, (salaryPct - MIN_PCT) * 0.3)) + (reflexBonus ?? 0);
  const newLoyalty = Math.min(100, 55 + loyaltyGain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-400 p-4 text-white">
          <span className="text-3xl">{ch.avatar}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black">{ch.name}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">⭐ 전설</span>
            </div>
            <div className="text-xs opacity-90">{ROLE_LABELS[ch.preferredRole]} · {ch.traitName}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full bg-white/20 p-1 text-white hover:bg-white/30">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-0">
          {(["check", "negotiate", "minigame", "confirm"] as LegNegStep[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 py-1 text-center text-[10px] font-bold ${
                step === s ? "bg-amber-100 text-amber-700" :
                ["check","negotiate","minigame","confirm"].indexOf(step) > i ? "bg-amber-50 text-amber-400" :
                "bg-slate-50 text-slate-400"
              }`}
            >
              {["조건 확인", "협상", "미니게임", "최종 계약"][i]}
            </div>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {/* Step 1: Requirements check */}
          {step === "check" && (
            <>
              <div className="text-sm font-bold text-slate-700">전설 인재의 요구 조건</div>
              <div className="space-y-2">
                {[
                  { label: `평판 60점 이상 (현재 ${reputation}점)`, ok: reputationOk },
                  { label: `계약금 ${formatMoney(minCash)} 이상 (보유 ${formatMoney(Math.round(company.cash))})`, ok: cashOk },
                  { label: "임원직(역할) 자리 필요", ok: noLegendaryHired || true },
                ].map(({ label, ok }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-lg p-2 text-xs ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    <span>{ok ? "✓" : "✗"}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <b>💡 전설 인재</b>란? 특수 능력과 높은 스탯을 갖춘 핵심 인재입니다. 영입 과정이 복잡하지만 그만큼 강력합니다.
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={onClose}>돌아가기</button>
                <button className="btn-primary flex-1" disabled={!canProceed} onClick={() => setStep("negotiate")}>
                  협상 시작 ▶
                </button>
              </div>
            </>
          )}

          {/* Step 2: Negotiation */}
          {step === "negotiate" && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-700">협상 라운드 {round}/3</div>
                <div className="text-xs text-slate-400">현재 연봉 {formatMoney(ch.salary)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 italic">
                "{round === 1 ? "제 능력에 걸맞은 대우가 필요합니다." : round === 2 ? "조금 더 좋은 조건을 제시해 주신다면..." : "이 정도라면 함께 일해볼 만 하겠군요."}"
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">제안 연봉</span>
                  <span className="font-bold text-amber-700">+{salaryPct - 100}% → {formatMoney(finalSalary)}</span>
                </div>
                <input
                  type="range" min={MIN_PCT} max={MAX_PCT} step={10}
                  value={salaryPct}
                  onChange={(e) => setSalaryPct(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>최소 {MIN_PCT}%</span>
                  <span>최대 {MAX_PCT}%</span>
                </div>
              </div>
              {salaryPct < 200 && (
                <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-600">
                  ⚠ 제안이 너무 낮습니다. {ch.name}이(가) 거절할 가능성이 높아요.
                </div>
              )}
              <div className="flex gap-2">
                {round < 3 ? (
                  <>
                    <button className="btn-ghost flex-1" onClick={() => { setSalaryPct(Math.min(salaryPct + 20, MAX_PCT)); setRound(r => Math.min(r + 1, 3)); }}>
                      조금 더 올리기 (+20%)
                    </button>
                    <button
                      className="btn-primary flex-1 !bg-amber-500"
                      disabled={salaryPct < 180}
                      onClick={() => setRound(r => { if (r >= 3) { setStep("minigame"); return r; } return r + 1; })}
                    >
                      {round < 3 ? `다음 라운드 (${round + 1}/3) ▶` : "미니게임 ▶"}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary w-full !bg-amber-500"
                    disabled={salaryPct < 180}
                    onClick={() => setStep("minigame")}
                  >
                    협상 완료 → 미니게임 ▶
                  </button>
                )}
              </div>
            </>
          )}

          {/* Step 3: Reflex mini-game */}
          {step === "minigame" && (
            <>
              <div className="text-sm font-bold text-slate-700">마지막 관문: 협상 타이밍</div>
              <p className="text-xs text-slate-500">정확한 타이밍에 클릭해 {ch.name}의 충성도 보너스를 높이세요!</p>
              {reflexBonus === null ? (
                <ReflexBar onScore={(n) => setReflexBonus(n)} />
              ) : (
                <div className="rounded-xl bg-amber-50 p-4 text-center">
                  <div className="text-2xl font-black text-amber-600">+{reflexBonus}</div>
                  <div className="text-xs text-amber-700">충성도 보너스 획득!</div>
                </div>
              )}
              {reflexBonus !== null && (
                <button className="btn-primary w-full !bg-amber-500" onClick={() => setStep("confirm")}>
                  최종 계약 확인 ▶
                </button>
              )}
            </>
          )}

          {/* Step 4: Final confirm */}
          {step === "confirm" && (
            <>
              <div className="text-sm font-bold text-slate-700">계약서 확인</div>
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">직위</span>
                  <span className="font-bold">{ROLE_LABELS[ch.preferredRole]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">연봉</span>
                  <span className="font-bold text-amber-700">{formatMoney(finalSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">초기 충성도</span>
                  <span className="font-bold text-green-700">{newLoyalty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">특성</span>
                  <span className="font-bold text-purple-700">{ch.traitName}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 leading-relaxed">{ch.traitDesc}</div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
                <button
                  className="btn-primary flex-1 !bg-amber-500"
                  disabled={company.cash < finalSalary}
                  onClick={() => onConfirm(finalSalary, reflexBonus ?? 0)}
                >
                  ⭐ 계약 체결
                </button>
              </div>
              {company.cash < finalSalary && (
                <div className="text-xs text-red-500">현금이 부족합니다 (필요: {formatMoney(finalSalary)})</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function TalentMarket({ game, company }: { game: GameState; company: Company }) {
  const hire           = useGameStore((s) => s.hire);
  const fire           = useGameStore((s) => s.fire);
  const poach          = useGameStore((s) => s.poach);
  const negotiateSalary = useGameStore((s) => s.negotiateSalary);

  const [salaryTarget, setSalaryTarget]           = useState<Character | null>(null);
  const [poachTarget, setPoachTarget]             = useState<{ ch: Character; companyId: string } | null>(null);
  const [legendaryTarget, setLegendaryTarget]     = useState<Character | null>(null);
  const [legendaryPoachTarget, setLegendaryPoachTarget] = useState<{ ch: Character; companyId: string } | null>(null);
  const [rivalTab, setRivalTab]                   = useState<string | null>(null);

  const rivals = game.companies.filter((c) => !c.isPlayer && c.hired.length > 0);
  const selectedRival = rivals.find((r) => r.id === rivalTab) ?? rivals[0] ?? null;
  const slots = executiveSlots(company, game.config.adjacencyBonus);

  return (
    <div className="space-y-4">
      {/* ── Hired team ── */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          {BUILDING_IMG.hr && <img src={BUILDING_IMG.hr} alt="" className="h-7 w-7 object-contain" />}
          우리 회사 임원진
          <span className="ml-auto text-xs font-bold text-slate-500" title="본사·어린이집 같은 건물을 지으면 임원 자리가 늘어요">
            {company.hired.length} / {slots}자리
          </span>
        </h3>
        {company.hired.length === 0 ? (
          <div className="relative overflow-hidden rounded-xl bg-slate-50 py-7 text-center">
            <CampusStrip buildings={company.buildings} className="absolute inset-x-0 bottom-0 h-14" opacity={0.18} />
            <p className="relative text-sm text-slate-400">아직 영입한 인재가 없습니다. 인재시장에서 영입하세요!</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {company.hired.map((ch) => {
              const loyalty = Math.round(ch.loyalty ?? 70);
              const loyaltyColor = loyalty >= 70 ? "text-green-600" : loyalty >= 45 ? "text-yellow-600" : "text-bear";
              return (
                <div key={ch.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                  <Avatar characterId={ch.id} emoji={ch.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <b className="truncate text-slate-800">{ch.name}</b>
                      <span className="pill bg-brand-100 text-brand-700">
                        {ch.role ? ROLE_LABELS[ch.role] : "미배치"}
                      </span>
                    </div>
                    <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">
                      ✨ 대표 효과: {ch.traitName} — {ch.traitDesc}
                    </div>
                    <details className="group mt-2">
                      <summary className="cursor-pointer list-none text-xs font-bold text-slate-500">
                        연봉·충성도·능력 자세히
                        <span className="ml-1 inline-block transition group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="mt-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                        <div className="flex flex-wrap gap-1 text-xs">
                          <span className={`pill bg-slate-100 ${loyaltyColor}`}>충성도 {loyalty}</span>
                          <span className="pill bg-slate-100 text-slate-600">연봉 {formatMoney(ch.salary)}</span>
                          {topStats(ch).map(([key, value]) => (
                            <span key={key} className="pill bg-slate-100 text-slate-600">{STAT_LABEL[key]} {value}</span>
                          ))}
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs"
                            onClick={() => setSalaryTarget(ch)}
                          >
                            연봉 협상
                          </button>
                          <button
                            className="btn-ghost shrink-0 !px-2 !py-1 text-xs !text-bear"
                            onClick={() => {
                              if (window.confirm(`${ch.name}을(를) 해고할까요?\n퇴직금 ${formatMoney(ch.salary)} 지출 · 사기·평판 소폭 하락`))
                                fire(ch.id);
                            }}
                          >
                            해고
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Competitor scout ── */}
      {rivals.length > 0 && (
        <details className="card group p-4">
          <summary className="cursor-pointer list-none text-base font-bold text-slate-800">
            더 많은 인재 활동: 경쟁사 스카우트
            <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-3">
          {/* Company tabs */}
          <div className="mb-3 flex flex-wrap gap-1">
            {rivals.map((r) => (
              <button
                key={r.id}
                onClick={() => setRivalTab(r.id)}
                className={`pill transition ${
                  (rivalTab ?? rivals[0]?.id) === r.id
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ background: r.logoColor }}
                />
                {r.name}
              </button>
            ))}
          </div>

          {selectedRival && (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedRival.hired.map((ch) => {
                const loyalty = Math.round(ch.loyalty ?? 70);
                const cost = Math.round(ch.salary * (1.3 + loyalty / 100));
                const canAfford = company.cash >= cost;
                const loyaltyBadge = loyalty < 45
                  ? <span className="pill bg-red-100 text-red-700">이탈 위험</span>
                  : loyalty < 65
                    ? <span className="pill bg-yellow-100 text-yellow-700">보통</span>
                    : <span className="pill bg-green-100 text-green-700">충성</span>;
                return (
                  <div key={ch.id} className="rounded-xl p-3 ring-1 ring-slate-200">
                    <div className="flex items-center gap-3">
                      <Avatar characterId={ch.id} emoji={ch.avatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <b className="truncate text-slate-800">{ch.name}</b>
                          {loyaltyBadge}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ROLE_LABELS[ch.role ?? ch.preferredRole]} · 충성도 {loyalty}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">스카우트 {formatMoney(cost)}</span>
                      <button
                        className={`!px-3 !py-1.5 text-xs ${ch.rarity === "legendary" ? "!bg-amber-500" : ""} btn-primary`}
                        disabled={!canAfford || company.hired.length >= slots}
                        onClick={() => {
                          if (ch.rarity === "legendary") {
                            setLegendaryPoachTarget({ ch, companyId: selectedRival.id });
                          } else {
                            setPoachTarget({ ch, companyId: selectedRival.id });
                          }
                        }}
                      >
                        {ch.rarity === "legendary" ? "⭐ 협상 스카우트" : "스카우트"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </details>
      )}

      {/* ── Talent pool ── */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          {BUILDING_IMG.store && <img src={BUILDING_IMG.store} alt="" className="h-7 w-7 object-contain" />}
          인재시장
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {game.talentPool.map((ch) => (
            <TalentCard
              key={ch.id}
              ch={ch}
              affordable={company.cash >= ch.salary}
              detailed={game.config.characterDepth !== "simple"}
              onHire={() => {
                if (ch.rarity === "legendary") setLegendaryTarget(ch);
                else hire(ch.id);
              }}
            />
          ))}
        </div>
        {game.talentPool.length === 0 && (
          <div className="relative overflow-hidden rounded-xl bg-slate-50 py-7 text-center">
            <CampusStrip className="absolute inset-x-0 bottom-0 h-14" opacity={0.15} />
            <p className="relative text-sm text-slate-400">지금은 영입 가능한 인재가 없습니다.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {salaryTarget && (
        <SalaryModal
          ch={salaryTarget}
          growthMultiplier={getCampaignGrowthMultiplier(game)}
          onClose={() => setSalaryTarget(null)}
          onConfirm={(newSalary, bonus) => {
            negotiateSalary(salaryTarget.id, newSalary, bonus);
            setSalaryTarget(null);
          }}
        />
      )}
      {poachTarget && (
        <PoachModal
          ch={poachTarget.ch}
          targetCompanyName={game.companies.find((c) => c.id === poachTarget.companyId)?.name ?? ""}
          cost={Math.round(poachTarget.ch.salary * (1.3 + (poachTarget.ch.loyalty ?? 70) / 100))}
          canAfford={company.cash >= Math.round(poachTarget.ch.salary * (1.3 + (poachTarget.ch.loyalty ?? 70) / 100))}
          onClose={() => setPoachTarget(null)}
          onConfirm={() => {
            poach(poachTarget.companyId, poachTarget.ch.id);
            setPoachTarget(null);
          }}
        />
      )}
      {/* Legendary talent: multi-step negotiation (from talent pool) */}
      {legendaryTarget && (
        <LegendaryNegotiationModal
          ch={legendaryTarget}
          company={company}
          onClose={() => setLegendaryTarget(null)}
          onConfirm={(salary, loyaltyBonus) => {
            // Hire at negotiated salary via the regular hire action (salary is overridden in store)
            hire(legendaryTarget.id, salary, loyaltyBonus);
            setLegendaryTarget(null);
          }}
        />
      )}
      {/* Legendary talent: multi-step negotiation (from rival poach) */}
      {legendaryPoachTarget && (
        <LegendaryNegotiationModal
          ch={legendaryPoachTarget.ch}
          company={company}
          fromRival
          rivalCompanyName={game.companies.find((c) => c.id === legendaryPoachTarget.companyId)?.name ?? ""}
          onClose={() => setLegendaryPoachTarget(null)}
          onConfirm={(salary, loyaltyBonus) => {
            poach(legendaryPoachTarget.companyId, legendaryPoachTarget.ch.id, salary, loyaltyBonus);
            setLegendaryPoachTarget(null);
          }}
        />
      )}
    </div>
  );
}

function TalentCard({
  ch, affordable, detailed, onHire,
}: {
  ch: Character; affordable: boolean; detailed: boolean; onHire: () => void;
}) {
  const r = RARITY[ch.rarity];
  const top = topStats(ch);
  return (
    <div className="rounded-xl p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <Avatar characterId={ch.id} emoji={ch.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <b className="truncate text-slate-800">{ch.name}</b>
            <span className={`pill ${r.cls}`}>{r.label}</span>
          </div>
          <div className="text-xs text-slate-500">{ROLE_LABELS[ch.preferredRole]}</div>
        </div>
      </div>
      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">
        ✨ 대표 효과: {ch.traitName} — {ch.traitDesc}
      </div>
      {detailed && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-xs font-bold text-slate-500">
            세부 능력치 보기 <span className="inline-block transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {top.map(([k, v]) => (
              <span key={k} className="pill bg-slate-100 text-slate-600">
                {STAT_LABEL[k]} {v}
              </span>
            ))}
          </div>
        </details>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">영입비 {formatMoney(ch.salary)}</span>
        <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!affordable} onClick={onHire}>
          영입
        </button>
      </div>
    </div>
  );
}

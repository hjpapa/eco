"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
  common:    { label: "보통", cls: "bg-slate-100 text-slate-600" },
  rare:      { label: "레어", cls: "bg-sky-100 text-sky-700" },
  epic:      { label: "에픽", cls: "bg-violet-100 text-violet-700" },
  legendary: { label: "전설", cls: "bg-amber-100 text-amber-700" },
};

const STAT_LABEL: Record<string, string> = {
  management: "운영", tech: "기술", creativity: "창의",
  finance: "돈 관리", leadership: "이끌기", marketing: "광고",
};

function topStats(ch: Character): [string, number][] {
  return Object.entries(ch.stats).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

// ── Shared modal frame ──────────────────────────────────────────────────────
function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Portal to <body> so the dialog sits above the sticky HUD.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md space-y-4 p-5"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="btn-ghost !min-h-11 !min-w-11 !px-2" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function PersonRow({ ch, detail }: { ch: Character; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
      <Avatar characterId={ch.id} emoji={ch.avatar} />
      <div className="min-w-0">
        <div className="font-black text-slate-800">{ch.name}</div>
        <div className="text-sm text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

// ── Pay raise: three simple choices ─────────────────────────────────────────
// A small fixed thank-you bonus replaces the old timing mini-game.
const RAISE_BONUS = 5;

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
  const baseLoyalty = ch.loyalty ?? 70;
  const preview = (pct: number) => {
    const ratio = pct / 100;
    const unscaledGain = Math.round(Math.min(30, ratio * 60)) + RAISE_BONUS;
    const unscaled = Math.min(100, baseLoyalty + unscaledGain);
    return Math.round(Math.min(100, baseLoyalty + (unscaled - baseLoyalty) * growthMultiplier) - baseLoyalty);
  };
  return (
    <ModalFrame title="💝 급여 올려 주기" onClose={onClose}>
      <PersonRow ch={ch} detail={`지금 급여 ${formatMoney(ch.salary)}원 · 💗 충성도 ${Math.round(baseLoyalty)}`} />
      <p className="text-sm text-slate-600">급여를 올려 주면 회사를 더 좋아해서(충성도↑) 오래 함께 일해요.</p>
      <div className="grid gap-2">
        {[10, 20, 30].map((pct) => {
          const newSalary = Math.round(ch.salary * (1 + pct / 100));
          return (
            <button
              key={pct}
              type="button"
              className="btn-ghost !justify-between !px-4 text-base"
              onClick={() => onConfirm(newSalary, RAISE_BONUS)}
            >
              <span className="font-black">+{pct}% → {formatMoney(newSalary)}원</span>
              <span className="text-sm font-bold text-emerald-700">💗 +{preview(pct)}</span>
            </button>
          );
        })}
      </div>
    </ModalFrame>
  );
}

// ── Scout from a rival ──────────────────────────────────────────────────────
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
    <ModalFrame title="🤝 인재 스카우트" onClose={onClose}>
      <PersonRow ch={ch} detail={`${targetCompanyName} · ${ROLE_LABELS[ch.role ?? ch.preferredRole]}`} />
      <div className="space-y-1 rounded-xl bg-amber-50 p-3 text-base text-amber-900">
        <div>데려오는 돈: <b>{formatMoney(cost)}원</b></div>
        <div className="text-sm text-amber-700">급여를 25% 올려 주는 조건이에요. 새 회사라 처음 충성도는 조금 낮아요.</div>
        {!canAfford && <div className="text-sm font-bold text-bear">돈이 모자라요.</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={onClose}>그만두기</button>
        <button className="btn-primary" disabled={!canAfford} onClick={onConfirm}>
          데려오기
        </button>
      </div>
    </ModalFrame>
  );
}

// ── Legendary talent: one screen, fixed offer ───────────────────────────────
function LegendaryNegotiationModal({
  ch,
  company,
  fromRival,
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
  const reputation = Math.round(company.reputation);
  const minCash = ch.salary * 3;
  const offer = Math.round(ch.salary * (fromRival ? 2.0 : 2.2));
  const reputationOk = reputation >= 60;
  const cashOk = company.cash >= Math.max(minCash, offer);
  const ready = reputationOk && cashOk;

  return (
    <ModalFrame title="⭐ 전설 인재 모셔오기" onClose={onClose}>
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 p-3 text-amber-950">
        <span className="text-4xl">{ch.avatar}</span>
        <div className="min-w-0">
          <div className="text-lg font-black">{ch.name}</div>
          <div className="text-sm font-bold">{ROLE_LABELS[ch.preferredRole]} · ✨ {ch.traitName}</div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{ch.traitDesc}</p>
      <div className="space-y-2">
        {[
          { label: `⭐ 평판 60점 이상 (지금 ${reputation}점)`, ok: reputationOk },
          { label: `💰 돈 ${formatMoney(Math.max(minCash, offer))}원 이상 (지금 ${formatMoney(Math.round(company.cash))}원)`, ok: cashOk },
        ].map(({ label, ok }) => (
          <div key={label} className={`flex items-center gap-2 rounded-lg p-2.5 text-sm font-bold ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            <span>{ok ? "✅" : "❌"}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-base">
        제안 급여: <b className="text-amber-700">{formatMoney(offer)}원</b>
        <span className="block text-sm text-slate-500">전설 인재는 보통 인재보다 급여가 2배 넘게 필요해요.</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={onClose}>다음에</button>
        <button className="btn-primary !bg-amber-500" disabled={!ready} onClick={() => onConfirm(offer, RAISE_BONUS)}>
          ⭐ 계약하기
        </button>
      </div>
      {!ready && <p className="text-center text-sm text-slate-500">❌ 조건을 채우면 계약할 수 있어요.</p>}
    </ModalFrame>
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
  const [fireTarget, setFireTarget]               = useState<Character | null>(null);

  const rivals = game.companies.filter((c) => !c.isPlayer && c.hired.length > 0);
  const selectedRival = rivals.find((r) => r.id === rivalTab) ?? rivals[0] ?? null;
  const slots = executiveSlots(company, game.config.adjacencyBonus);

  return (
    <div className="space-y-4">
      {/* ── Hired team ── */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          {BUILDING_IMG.hr && <img src={BUILDING_IMG.hr} alt="" className="h-7 w-7 object-contain" />}
          우리 회사 인재
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-600">
            {company.hired.length} / {slots}자리
          </span>
        </h3>
        <p className="-mt-1 mb-3 text-sm text-slate-500">본사·인사센터·어린이집 같은 건물을 지으면 자리가 늘어요.</p>
        {company.hired.length === 0 ? (
          <div className="relative overflow-hidden rounded-xl bg-slate-50 py-7 text-center">
            <CampusStrip buildings={company.buildings} className="absolute inset-x-0 bottom-0 h-14" opacity={0.18} />
            <p className="relative text-base text-slate-500">아직 뽑은 인재가 없어요. 아래 인재 시장에서 뽑아 보세요!</p>
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
                        {ch.role ? ROLE_LABELS[ch.role] : "역할 없음"}
                      </span>
                    </div>
                    <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-semibold text-amber-700">
                      ✨ {ch.traitName} — {ch.traitDesc}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-xs">
                      <span className={`pill bg-white ${loyaltyColor}`}>💗 충성도 {loyalty}</span>
                      <span className="pill bg-white text-slate-600">💰 급여 {formatMoney(ch.salary)}원</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button className="btn-ghost !px-2 text-sm" onClick={() => setSalaryTarget(ch)}>
                        💝 급여 올리기
                      </button>
                      <button className="btn-ghost !px-2 text-sm !text-bear" onClick={() => setFireTarget(ch)}>
                        👋 내보내기
                      </button>
                    </div>
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
            🤝 라이벌 회사 인재 데려오기(스카우트)
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
                  ? <span className="pill bg-red-100 text-red-700">떠날 수도</span>
                  : loyalty < 65
                    ? <span className="pill bg-yellow-100 text-yellow-700">보통</span>
                    : <span className="pill bg-green-100 text-green-700">회사 사랑</span>;
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
                          {ROLE_LABELS[ch.role ?? ch.preferredRole]} · 💗 충성도 {loyalty}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-500">데려오는 돈 {formatMoney(cost)}원</span>
                      <button
                        className={`!px-3 text-sm ${ch.rarity === "legendary" ? "!bg-amber-500" : ""} btn-primary`}
                        disabled={!canAfford || company.hired.length >= slots}
                        onClick={() => {
                          if (ch.rarity === "legendary") {
                            setLegendaryPoachTarget({ ch, companyId: selectedRival.id });
                          } else {
                            setPoachTarget({ ch, companyId: selectedRival.id });
                          }
                        }}
                      >
                        {ch.rarity === "legendary" ? "⭐ 모셔오기" : "데려오기"}
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
          인재 시장
        </h3>
        <p className="-mt-1 mb-3 text-sm text-slate-500">인재를 뽑으면 회사에 특별한 능력(✨)이 생겨요. 뽑을 때 급여만큼 돈이 들어요.</p>
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
            <p className="relative text-base text-slate-500">지금은 뽑을 수 있는 인재가 없어요. 다음 턴에 다시 와 보세요.</p>
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
      {fireTarget && (
        <ModalFrame title="👋 인재 내보내기" onClose={() => setFireTarget(null)}>
          <PersonRow ch={fireTarget} detail={ROLE_LABELS[fireTarget.role ?? fireTarget.preferredRole]} />
          <p className="rounded-xl bg-rose-50 p-3 text-base text-rose-900">
            정말 내보낼까요? 그동안 고마웠다는 돈(퇴직금) <b>{formatMoney(fireTarget.salary)}원</b>을 줘야 하고, 직원 행복과 평판이 조금 떨어져요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setFireTarget(null)}>그만두기</button>
            <button
              className="btn-bear"
              onClick={() => {
                fire(fireTarget.id);
                setFireTarget(null);
              }}
            >
              내보내기
            </button>
          </div>
        </ModalFrame>
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
      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-semibold text-amber-700">
        ✨ {ch.traitName} — {ch.traitDesc}
      </div>
      {detailed && (
        <details className="group mt-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-bold text-slate-500">
            능력 점수 보기 <span className="ml-1 inline-block transition group-open:rotate-180">⌄</span>
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
        <span className="text-sm text-slate-500">💰 {formatMoney(ch.salary)}원</span>
        <button className="btn-primary !px-4 text-sm" disabled={!affordable} onClick={onHire}>
          {ch.rarity === "legendary" ? "⭐ 모셔오기" : "뽑기"}
        </button>
      </div>
    </div>
  );
}

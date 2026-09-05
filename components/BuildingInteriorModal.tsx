"use client";

import { useGameStore } from "@/store/gameStore";
import {
  BUILDINGS,
  buildingCostFor,
  productionCapacity,
  type BuildingType,
  type Company,
  type GameState,
  type PlacedBuilding,
} from "@/lib/engine";
import { formatMoney, formatNum } from "@/lib/format";
import { BUILDING_IMG } from "@/lib/assetMap";

/* A simple 2D interior illustration per building type. */
function Interior({ type }: { type: BuildingType }) {
  const wall = "#e2e8f0";
  const floor = "#cbd5e1";
  return (
    <svg viewBox="0 0 200 90" className="w-full rounded-xl" style={{ background: "#f1f5f9" }}>
      <rect x="0" y="0" width="200" height="64" fill={wall} />
      <rect x="0" y="64" width="200" height="26" fill={floor} />
      {type === "factory" && (
        <>
          <rect x="20" y="34" width="46" height="30" fill="#94a3b8" />
          <rect x="76" y="28" width="46" height="36" fill="#64748b" />
          <rect x="132" y="38" width="40" height="26" fill="#94a3b8" />
          <circle cx="43" cy="20" r="6" fill="#fbbf24" />
          <rect x="150" y="20" width="8" height="18" fill="#475569" />
        </>
      )}
      {(type === "rnd" || type === "lab") && (
        <>
          <rect x="24" y="40" width="40" height="24" fill="#a78bfa" />
          <circle cx="100" cy="40" r="16" fill="#c4b5fd" />
          <rect x="140" y="34" width="36" height="30" fill="#8b5cf6" />
          <circle cx="44" cy="30" r="4" fill="#34d399" />
          <circle cx="160" cy="26" r="4" fill="#f87171" />
        </>
      )}
      {type === "store" && (
        <>
          <rect x="16" y="20" width="168" height="14" fill="#ef4444" />
          <rect x="24" y="40" width="32" height="24" fill="#60a5fa" />
          <rect x="84" y="40" width="32" height="24" fill="#fbbf24" />
          <rect x="144" y="40" width="32" height="24" fill="#34d399" />
        </>
      )}
      {(type === "office" || type === "hr") && (
        <>
          {[20, 70, 120].map((x) => (
            <g key={x}>
              <rect x={x} y="46" width="40" height="6" fill="#94a3b8" />
              <rect x={x + 14} y="36" width="12" height="12" fill="#bfdbfe" />
            </g>
          ))}
          <circle cx="170" cy="30" r="8" fill="#34d399" />
        </>
      )}
      {(type === "cafeteria") && (
        <>
          {[30, 90, 150].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="58" rx="22" ry="6" fill="#fb923c" />
              <rect x={x - 2} y="40" width="4" height="18" fill="#92400e" />
            </g>
          ))}
        </>
      )}
      {(type === "gym") && (
        <>
          <rect x="30" y="40" width="10" height="24" fill="#0f766e" />
          <rect x="60" y="34" width="10" height="30" fill="#0f766e" />
          <g fill="#334155"><circle cx="120" cy="50" r="8" /><rect x="120" y="48" width="40" height="4" /><circle cx="160" cy="50" r="8" /></g>
        </>
      )}
      {(type === "dorm" || type === "daycare" || type === "clinic" || type === "park") && (
        <>
          <rect x="24" y="40" width="44" height="24" fill="#f9a8d4" />
          <rect x="84" y="40" width="44" height="24" fill="#fcd34d" />
          <rect x="144" y="40" width="32" height="24" fill="#86efac" />
          <circle cx="170" cy="28" r="6" fill="#ef4444" />
        </>
      )}
    </svg>
  );
}

const ACTION_BY_TYPE: Partial<Record<BuildingType, { id: string; label: string; desc: string }>> = {
  factory: { id: "inspect", label: "라인 점검", desc: "안전을 높여 사고를 예방합니다" },
  warehouse: { id: "inspect", label: "안전 점검", desc: "안전을 높입니다" },
  power: { id: "inspect", label: "설비 점검", desc: "안전을 높입니다" },
  rnd: { id: "research", label: "집중 연구", desc: "품질·기술을 높입니다" },
  lab: { id: "research", label: "집중 연구", desc: "품질·기술을 높입니다" },
  store: { id: "promo", label: "프로모션", desc: "평판과 수요를 높입니다" },
  office: { id: "training", label: "직원 교육", desc: "사기와 품질을 높입니다" },
  hr: { id: "training", label: "직원 교육", desc: "사기와 품질을 높입니다" },
  cafeteria: { id: "welfare", label: "복지 강화", desc: "사기·충성도를 높입니다" },
  gym: { id: "welfare", label: "복지 강화", desc: "사기·충성도를 높입니다" },
  dorm: { id: "welfare", label: "복지 강화", desc: "사기·충성도를 높입니다" },
  daycare: { id: "welfare", label: "복지 강화", desc: "사기·충성도를 높입니다" },
  clinic: { id: "welfare", label: "복지 강화", desc: "사기·충성도를 높입니다" },
  park: { id: "welfare", label: "환경 미화", desc: "사기를 높입니다" },
};

const COST_BY_ACTION: Record<string, number> = {
  inspect: 40_000, research: 60_000, promo: 50_000, training: 50_000, welfare: 40_000,
};

export function BuildingInteriorModal({
  game, company, building, onClose,
}: {
  game: GameState; company: Company; building: PlacedBuilding; onClose: () => void;
}) {
  const upgrade = useGameStore((s) => s.upgrade);
  const demolish = useGameStore((s) => s.demolish);
  const companyAction = useGameStore((s) => s.companyAction);
  const setDecisions = useGameStore((s) => s.setDecisions);

  const def = BUILDINGS[building.type];
  const d = company.decisions;
  const capacity = productionCapacity(company, game.config);
  const action = ACTION_BY_TYPE[building.type];
  const underConstruction = building.turnsLeft > 0;

  const showProduction = building.type === "factory" || building.type === "warehouse";
  const showRnd = building.type === "rnd" || building.type === "lab";
  const showMarketing = building.type === "store";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md animate-popin rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            <span className="mr-1 text-2xl">{def.emoji}</span>{def.name} <span className="text-sm text-slate-500">Lv{building.level}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {BUILDING_IMG[building.type] ? (
          <div className="flex items-center justify-center rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 py-2">
            <img src={BUILDING_IMG[building.type]} alt={def.name} className="h-32 object-contain" />
          </div>
        ) : (
          <Interior type={building.type} />
        )}
        <p className="mt-2 text-xs text-slate-500">{def.description}</p>

        {underConstruction ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-700">
            🏗️ 공사 중입니다 · {building.turnsLeft}턴(분기) 남음
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {showProduction && (
              <SliderRow
                label="생산 목표" value={d.productionTarget} min={0} max={Math.max(capacity, d.productionTarget)}
                step={10} fmt={(v) => `${formatNum(v)}개`} onChange={(v) => setDecisions({ productionTarget: v })}
              />
            )}
            {showRnd && (
              <SliderRow
                label="R&D 예산" value={d.rndBudget} min={0} max={200000}
                step={5000} fmt={formatMoney} onChange={(v) => setDecisions({ rndBudget: v })}
              />
            )}
            {showMarketing && (
              <SliderRow
                label="마케팅 예산" value={d.marketingBudget} min={0} max={200000}
                step={5000} fmt={formatMoney} onChange={(v) => setDecisions({ marketingBudget: v })}
              />
            )}

            {action && (
              <button
                className="w-full rounded-xl bg-brand-50 px-3 py-2.5 text-left ring-1 ring-brand-200 hover:ring-brand-400 disabled:opacity-50"
                disabled={company.cash < COST_BY_ACTION[action.id]}
                onClick={() => companyAction(action.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-700">⚡ {action.label}</span>
                  <span className="text-xs text-slate-500">{formatMoney(COST_BY_ACTION[action.id])}</span>
                </div>
                <div className="text-xs text-slate-500">{action.desc}</div>
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {building.level < def.maxLevel ? (
            <button className="btn-primary" onClick={() => upgrade(building.id)}>
              업그레이드 · {formatMoney(buildingCostFor(building.type, building.level + 1))}
            </button>
          ) : (
            <span className="flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">최고 레벨</span>
          )}
          <button
            className="btn-bear"
            onClick={() => {
              if (window.confirm(`${def.name}을(를) 매각할까요? 건설비의 50%가 환급됩니다.`)) {
                demolish(building.id);
                onClose();
              }
            }}
          >
            매각
          </button>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, fmt, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-brand-700">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

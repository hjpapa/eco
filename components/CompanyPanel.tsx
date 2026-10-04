"use client";

import { useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import {
  estimateDemand,
  isFeatureUnlocked,
  planWithOrder,
  productionCapacity,
  roleBonuses,
  currentSeason,
  seasonOutlook,
  SEASONS,
  type Company,
  type GameState,
} from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getCountry } from "@/lib/data/countries";
import { getIndustryProducts } from "@/lib/data/products";
import { formatMoney, formatNum } from "@/lib/format";
import { Bar } from "./Sparkline";
import { Term } from "./Term";
import { MGMT_ICONS } from "@/lib/assetMap";
import { OrderPlanner } from "./QuestBoard";
import { PriceLab } from "./PriceLab";

export type PanelTask = "production" | "sales" | "research" | "staff" | "finance";

const won = (value: number) => `${formatMoney(Math.round(value))}원`;

// One-tap activities. Each tab shows a few clearly different choices instead
// of many near-duplicates (the engine still accepts the older ids).
const ACTIVITIES: Record<"sales" | "research" | "staff", { title: string; icon?: string; actions: { id: string; label: string; cost: number; effect: string }[] }[]> = {
  sales: [
    {
      title: "광고하기",
      icon: MGMT_ICONS.marketing,
      actions: [
        { id: "mkt_basic", label: "📄 전단지 돌리기", cost: 30_000, effect: "⭐ 평판 +2" },
        { id: "mkt_event", label: "🎉 특별 이벤트", cost: 50_000, effect: "⭐ 평판 +8" },
        { id: "mkt_intensive", label: "📺 큰 광고", cost: 150_000, effect: "⭐ 평판 +10" },
      ],
    },
  ],
  research: [
    {
      title: "연구하기",
      icon: MGMT_ICONS.rnd,
      actions: [
        { id: "rnd_basic", label: "🧪 기초 연구", cost: 30_000, effect: "🔬 품질 +3" },
        { id: "rnd_active", label: "⚙️ 기술 개발", cost: 80_000, effect: "🔬 품질 +7" },
        { id: "rnd_patent", label: "📜 특허 내기", cost: 100_000, effect: "🔬 품질 +12" },
      ],
    },
  ],
  staff: [
    {
      title: "직원 챙기기",
      icon: MGMT_ICONS.welfare,
      actions: [
        { id: "wlf_dinner", label: "🍕 회식", cost: 20_000, effect: "😊 행복 +8" },
        { id: "wlf_training", label: "📚 직원 교육", cost: 40_000, effect: "😊 행복 +5 · 🔬 품질 +2" },
        { id: "wlf_workshop", label: "🏕️ 워크숍", cost: 60_000, effect: "😊 행복 +12" },
      ],
    },
    {
      title: "안전 지키기",
      icon: MGMT_ICONS.safety,
      actions: [
        { id: "sft_inspect", label: "🔍 안전 점검", cost: 15_000, effect: "🦺 안전 +8" },
        { id: "sft_training", label: "⛑️ 안전 교육", cost: 30_000, effect: "🦺 안전 +15" },
      ],
    },
    {
      title: "이웃 돕기",
      actions: [
        { id: "csr", label: "💚 나눔 활동", cost: 50_000, effect: "⭐ 평판 +10" },
      ],
    },
  ],
};

const BUDGET_STEPS = [
  { value: 0, label: "안 함" },
  { value: 20_000, label: "조금" },
  { value: 50_000, label: "보통" },
  { value: 100_000, label: "많이" },
];

export function CompanyPanel({ game, company, task }: { game: GameState; company: Company; task: PanelTask }) {
  const setDecisions = useGameStore((s) => s.setDecisions);
  const companyAction = useGameStore((s) => s.companyAction);
  const actionUntil = useRef(0);
  const once = (action: () => void) => {
    if (Date.now() < actionUntil.current) return;
    actionUntil.current = Date.now() + 500;
    action();
  };
  const researchUnlocked = isFeatureUnlocked(game, "research");

  const activities = task === "sales" || task === "research" || task === "staff" ? ACTIVITIES[task] : [];

  return (
    <div className="space-y-3">
      {task === "production" && <ProductionControls game={game} company={company} />}
      {task === "sales" && <SalesControls game={game} company={company} />}

      {task === "sales" && (
        <BudgetPicker
          title="📣 매 턴 광고비"
          hint="광고를 하면 손님이 조금 더 늘어요. 다음 턴부터 매 턴 이만큼 써요."
          value={company.decisions.marketingBudget}
          onChange={(v) => setDecisions({ marketingBudget: v })}
        />
      )}
      {task === "research" && (
        <>
          <ScoreBar emoji="🔬" label={<Term term="품질">품질</Term>} value={company.quality} color="#6366f1" hint="품질이 높을수록 더 비싸게, 더 좋은 물건을 팔 수 있어요." />
          {researchUnlocked && (
            <BudgetPicker
              title="🔬 매 턴 연구비"
              hint="꾸준히 연구하면 품질이 조금씩 올라요. 다음 턴부터 매 턴 이만큼 써요."
              value={company.decisions.rndBudget}
              onChange={(v) => setDecisions({ rndBudget: v })}
            />
          )}
        </>
      )}
      {task === "staff" && (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <ScoreBar emoji="😊" label={<Term term="사기">직원 행복</Term>} value={company.morale} color="#16a34a" hint={company.morale < 45 ? "행복이 낮으면 일을 덜 하고 회사를 떠날 수 있어요!" : undefined} />
          <ScoreBar emoji="🦺" label={<Term term="안전" />} value={company.safety} color="#f59e0b" hint={company.safety < 40 ? "안전이 낮으면 사고가 날 수 있어요!" : undefined} />
          <ScoreBar emoji="⭐" label={<Term term="평판" />} value={company.reputation} color="#0ea5e9" />
        </div>
      )}

      {activities.map((section) => (
        <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-base font-black text-slate-800">
            {section.icon && <img src={section.icon} alt="" className="h-6 w-6 object-contain" />}
            {section.title}
            <span className="ml-auto text-xs font-bold text-slate-400">누르면 바로 해요</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {section.actions.map((action) => {
              const canAfford = company.cash >= action.cost;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={!canAfford}
                  onClick={() => once(() => companyAction(action.id))}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    canAfford
                      ? "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="text-base font-black leading-tight">{action.label}</div>
                  <div className="mt-0.5 text-sm font-bold text-slate-700">{action.effect}</div>
                  <div className={`mt-0.5 text-sm ${canAfford ? "text-brand-600" : "text-slate-400"}`}>
                    {canAfford ? `💸 ${won(action.cost)}` : `💸 ${won(action.cost)} · 돈이 모자라요`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {task === "finance" && <FinanceControls game={game} company={company} />}
    </div>
  );
}

/** 🏭 만들기: how many to make next turn, with big tap targets. */
function ProductionControls({ game, company }: { game: GameState; company: Company }) {
  const setDecisions = useGameStore((s) => s.setDecisions);
  const capacity = productionCapacity(company, game.config);
  const demand = estimateDemand(company, getIndustry(company.industryId), getCountry(company.countryId), game.macro, game.config);
  const target = company.decisions.productionTarget;
  const suggestion = planWithOrder(game, company);
  const set = (value: number) => setDecisions({ productionTarget: Math.max(0, Math.min(capacity, Math.round(value))) });
  const season = SEASONS[currentSeason(game.macro)];
  const outlook = seasonOutlook(company.industryId, season.id);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatTile emoji="🏭" label="최대 만들 수 있는 양" value={`${formatNum(capacity)}개`} />
        <StatTile emoji="🛍️" label={<Term term="수요">사려는 손님</Term>} value={`약 ${formatNum(demand)}명`} />
        <StatTile emoji="📦" label={<Term term="재고">창고 재고</Term>} value={`${formatNum(company.inventory)}개`} />
      </div>

      <p className={`season-chip season-chip--${season.id} rounded-xl px-3 py-2 text-sm leading-snug`}>
        <b>
          {season.emoji} 지금은 {season.name}
          {outlook.notable && ` · 손님 ${outlook.percent > 0 ? "+" : ""}${outlook.percent}%`}
        </b>{" "}
        {outlook.reason} <span className="whitespace-nowrap">(<Term term="계절 수요">계절 수요</Term>)</span>
      </p>

      <OrderPlanner game={game} company={company} />

      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-3">
        <h3 className="text-base font-black text-emerald-950">다음 턴에 몇 개 만들까요?</h3>
        {capacity <= 0 ? (
          <p className="mt-2 rounded-xl bg-white p-3 text-base text-slate-700">🏗️ 먼저 공장을 지어야 물건을 만들 수 있어요.</p>
        ) : (
          <>
            <Stepper
              value={target}
              unit="개"
              steps={[100, 10]}
              onChange={set}
              min={0}
              max={capacity}
              label="만들 개수"
            />
            <input
              type="range"
              aria-label="만들 개수 슬라이더"
              min={0}
              max={capacity}
              step={10}
              value={Math.min(target, capacity)}
              onChange={(e) => set(Number(e.target.value))}
              className="big-range mt-1 w-full accent-emerald-600"
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button type="button" className="btn-primary !px-2 text-sm" onClick={() => set(suggestion.plan)}>
                🎯 딱 맞게<br />({formatNum(suggestion.plan)}개)
              </button>
              <button type="button" className="btn-ghost !px-2 text-sm" onClick={() => set(capacity)}>
                🏭 최대로<br />({formatNum(capacity)}개)
              </button>
              <button type="button" className="btn-ghost !px-2 text-sm" onClick={() => set(0)}>
                ⏸️ 쉬기<br />(0개)
              </button>
            </div>
            <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${target > suggestion.plan + 50 ? "bg-amber-100 text-amber-900" : "bg-white text-slate-600"}`}>
              {target > suggestion.plan + 50
                ? "⚠️ 손님보다 많이 만들면 팔리지 않고 창고에 남아요(재고)."
                : "🎯 ‘딱 맞게’는 손님 수에서 창고 재고를 빼고, 받은 주문까지 더한 개수예요."}
            </p>
          </>
        )}
        <p className="mt-1 text-xs font-bold text-slate-500">⏭️ 다음 턴을 누르면 만들어져요.</p>
      </section>
    </div>
  );
}

/** 🏬 팔기: which products to sell and at what price. */
function SalesControls({ game, company }: { game: GameState; company: Company }) {
  const setProductPrice = useGameStore((s) => s.setProductPrice);
  const toggleProduct = useGameStore((s) => s.toggleProduct);
  const industry = getIndustry(company.industryId);
  const productDefs = getIndustryProducts(company.industryId);
  const productPrices = company.productPrices ?? productDefs.map((p) => Math.round(industry.basePrice * p.priceRatio));
  const productEnabled = company.productEnabled ?? productDefs.map((_, i) => i === 0);
  const productInventory = company.productInventory ?? productDefs.map(() => 0);
  const rndUnlockDone = company.rndUnlockDone ?? false;
  const firstActive = productEnabled.findIndex(Boolean);
  const [active, setActive] = useState(firstActive >= 0 ? firstActive : 0);

  const def = productDefs[active];
  if (!def) return null;
  const tierRef = industry.basePrice * def.priceRatio;
  const maxPrice = Math.round(tierRef * (1 + company.quality / 100));
  const price = productPrices[active] ?? Math.round(tierRef);
  const unlocked = def.isRndUnlock ? rndUnlockDone : true;
  const meetsQuality = company.quality >= def.qualityRequired;
  const canEnable = unlocked && meetsQuality;
  const isOn = productEnabled[active] && canEnable;
  const step = Math.max(1, Math.round(tierRef * 0.05));
  const priceTag = price > tierRef * 1.3 ? { text: "비싼 편", cls: "bg-orange-100 text-orange-700" }
    : price < tierRef * 0.7 ? { text: "싼 편", cls: "bg-sky-100 text-sky-700" }
    : { text: "보통 값", cls: "bg-emerald-100 text-emerald-700" };

  return (
    <div className="space-y-3">
      <section>
        <h3 className="mb-2 text-base font-black text-slate-800">📦 우리 물건</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {productDefs.map((p, i) => {
            const pUnlocked = p.isRndUnlock ? rndUnlockDone : true;
            const pCan = pUnlocked && company.quality >= p.qualityRequired;
            const pOn = productEnabled[i] && pCan;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active === i}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-2 transition ${
                  active === i ? "bg-brand-50 ring-brand-500" : pCan ? "bg-white ring-slate-200" : "bg-slate-50 ring-slate-100 opacity-60"
                }`}
              >
                <span className="text-2xl" aria-hidden>{pCan ? p.emoji : "🔒"}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-800">{p.name}</span>
                  <span className={`block text-xs font-bold ${pOn ? "text-emerald-600" : "text-slate-400"}`}>
                    {!pCan ? (!pUnlocked ? "연구로 열기" : `품질 ${p.qualityRequired} 필요`) : pOn ? "● 파는 중" : "○ 쉬는 중"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl" aria-hidden>{def.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-slate-900">{def.name}</div>
            <div className="text-sm text-slate-500">창고에 {formatNum(productInventory[active] ?? 0)}개</div>
          </div>
          <button
            type="button"
            disabled={!canEnable}
            onClick={() => toggleProduct(active)}
            className={isOn ? "btn-bull !px-3 text-sm" : "btn-ghost !px-3 text-sm"}
          >
            {isOn ? "✅ 파는 중" : "▶️ 팔기 시작"}
          </button>
        </div>

        {!canEnable ? (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-base text-amber-800">
            {!unlocked
              ? "🔒 연구로 품질 75점을 넘기면 만들 수 있어요."
              : `🔒 품질 ${def.qualityRequired}점이 필요해요 (지금 ${Math.round(company.quality)}점). 연구로 품질을 올려 봐요!`}
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-base font-black text-slate-700">한 개 가격</span>
              <span className={`rounded-full px-2.5 py-1 text-sm font-black ${priceTag.cls}`}>{priceTag.text}</span>
            </div>
            <Stepper
              value={price}
              unit="원"
              steps={[step]}
              onChange={(v) => setProductPrice(active, Math.max(1, Math.min(maxPrice, Math.round(v))))}
              min={1}
              max={maxPrice}
              label={`${def.name} 가격`}
              disabled={!isOn}
            />
            <p className="mt-1 text-sm text-slate-600">
              ⭐ 품질이 오르면 더 비싸게 팔 수 있어요. 지금은 <b>{formatMoney(maxPrice)}원</b>까지!
            </p>
            {isOn && <PriceLab game={game} company={company} productIndex={active} />}
          </>
        )}
      </section>
    </div>
  );
}

/** 💰 돈 관리: income, costs, and borrowing with preset amounts. */
function FinanceControls({ game, company }: { game: GameState; company: Company }) {
  const loan = useGameStore((s) => s.loan);
  const lock = useRef(0);
  const once = (action: () => void) => {
    if (Date.now() < lock.current) return;
    lock.current = Date.now() + 500;
    action();
  };
  // Per-turn interest ≈ debt × (annual rate / 4). (engine: company.ts)
  const quarterlyRate = game.macro.interestRate / 100 / 4 * roleBonuses(company).financeCostMult;
  const interest = (amount: number) => Math.round(amount * quarterlyRate);
  const lastCost = Math.max(0, company.lastRevenue - company.lastProfit);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatTile emoji="💰" label={<Term term="매출">들어온 돈</Term>} value={won(company.lastRevenue)} />
        <StatTile emoji="🧾" label={<Term term="비용">쓴 돈</Term>} value={won(lastCost)} />
        <StatTile
          emoji={company.lastProfit >= 0 ? "🪙" : "📉"}
          label={<Term term="이익">남은 돈</Term>}
          value={`${company.lastProfit >= 0 ? "+" : "−"}${won(Math.abs(company.lastProfit))}`}
          tone={company.lastProfit >= 0 ? "good" : "bad"}
        />
      </div>

      <section className="rounded-2xl border-2 border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-black text-slate-800">💳 <Term term="부채">빌린 돈(빚)</Term></span>
          <span className="text-lg font-black text-slate-900">{won(company.debt)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          매 턴 <Term term="이자">이자</Term> 약 <b className="text-bear">{won(interest(company.debt))}</b>을 내요 (은행 <Term term="금리">금리</Term> 1년에 {game.macro.interestRate.toFixed(1)}%).
        </p>

        <h4 className="mt-3 text-sm font-black text-slate-700">돈 빌리기</h4>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {[100_000, 300_000, 500_000].map((amount) => (
            <button key={amount} type="button" className="btn-ghost flex-col !px-1 text-sm" onClick={() => once(() => loan(amount, "borrow"))}>
              <span className="font-black">+{won(amount)}</span>
              <span className="text-xs text-slate-500">이자 +{won(interest(amount))}/턴</span>
            </button>
          ))}
        </div>

        <h4 className="mt-3 text-sm font-black text-slate-700">빚 갚기</h4>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {[100_000, 300_000].map((amount) => (
            <button
              key={amount}
              type="button"
              className="btn-ghost !px-1 text-sm"
              disabled={company.debt <= 0 || company.cash < Math.min(amount, company.debt)}
              onClick={() => once(() => loan(Math.min(amount, company.debt), "repay"))}
            >
              −{won(amount)}
            </button>
          ))}
          <button
            type="button"
            className="btn-bull !px-1 text-sm"
            disabled={company.debt <= 0 || company.cash <= 0}
            onClick={() => once(() => loan(Math.min(company.debt, company.cash), "repay"))}
          >
            모두 갚기
          </button>
        </div>
        <p className="mt-2 rounded-xl bg-blue-50 p-2.5 text-sm text-blue-900">
          💡 빌린 돈은 언젠가 꼭 갚아야 하고, 갚을 때까지 매 턴 이자를 내요.
        </p>
      </section>
    </div>
  );
}

function BudgetPicker({ title, hint, value, onChange }: { title: string; hint: string; value: number; onChange: (v: number) => void }) {
  const known = BUDGET_STEPS.some((s) => s.value === value);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label={title}>
        {BUDGET_STEPS.map((step) => (
          <button
            key={step.value}
            type="button"
            aria-pressed={value === step.value}
            onClick={() => onChange(step.value)}
            className={`flex flex-col items-center rounded-xl px-1 py-1.5 text-sm font-black ring-2 transition ${
              value === step.value ? "bg-brand-600 text-white ring-brand-600" : "bg-slate-50 text-slate-700 ring-slate-200"
            }`}
          >
            {step.label}
            <span className={`text-xs font-bold ${value === step.value ? "text-white/80" : "text-slate-500"}`}>{step.value ? formatMoney(step.value) : "0원"}</span>
          </button>
        ))}
      </div>
      {!known && <p className="mt-1 text-xs text-slate-500">지금: {won(value)}</p>}
      <p className="mt-1.5 text-sm text-slate-600">{hint}</p>
    </section>
  );
}

/** Big − / + buttons around a number. No keyboard needed on a tablet. */
function Stepper({
  value,
  unit,
  steps,
  onChange,
  min,
  max,
  label,
  disabled = false,
}: {
  value: number;
  unit: string;
  steps: number[];
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
  disabled?: boolean;
}) {
  const down = [...steps];
  const up = [...steps].reverse();
  return (
    <div className="mt-2 flex items-center gap-1.5" role="group" aria-label={label}>
      {down.map((step) => (
        <button
          key={`down-${step}`}
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="btn-ghost !min-h-12 min-w-12 shrink-0 !px-2.5 text-lg font-black"
          aria-label={`${label} ${step} 줄이기`}
        >
          −{steps.length > 1 ? step : ""}
        </button>
      ))}
      <output className="min-w-0 flex-1 rounded-xl bg-white py-2 text-center text-2xl font-black text-slate-900 ring-1 ring-slate-200" aria-live="polite">
        {formatNum(value)}<span className="ml-0.5 text-base">{unit}</span>
      </output>
      {up.map((step) => (
        <button
          key={`up-${step}`}
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="btn-ghost !min-h-12 min-w-12 shrink-0 !px-2.5 text-lg font-black"
          aria-label={`${label} ${step} 늘리기`}
        >
          +{steps.length > 1 ? step : ""}
        </button>
      ))}
    </div>
  );
}

function StatTile({ emoji, label, value, tone }: { emoji: string; label: React.ReactNode; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-slate-50 px-1.5 py-2 ring-1 ring-slate-200">
      <div className="text-xl" aria-hidden>{emoji}</div>
      <div className="text-xs font-bold leading-tight text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-black ${tone === "good" ? "text-bull" : tone === "bad" ? "text-bear" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function ScoreBar({ emoji, label, value, color, hint }: { emoji: string; label: React.ReactNode; value: number; color: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{emoji} {label}</span>
        <span className="font-black text-slate-900">{Math.round(value)}점</span>
      </div>
      <Bar value={value} color={color} />
      {hint && <div className="mt-0.5 text-sm font-bold text-amber-700">{hint}</div>}
    </div>
  );
}

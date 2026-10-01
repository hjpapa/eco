"use client";

import { useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import {
  estimateDemand,
  productionCapacity,
  isFeatureUnlocked,
  roleBonuses,
  type Company,
  type GameState,
} from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getCountry } from "@/lib/data/countries";
import { getIndustryProducts } from "@/lib/data/products";
import { formatMoney, formatNum } from "@/lib/format";
import { Bar } from "./Sparkline";
import { Term } from "./Term";
import { MGMT_ICONS, BUILDING_IMG } from "@/lib/assetMap";
import { CompanyTicker } from "./CompanyTicker";

// Management action definitions for button-based UI
const ACTION_SECTIONS = [
  {
    key: "marketing",
    label: "마케팅",
    icon: MGMT_ICONS.marketing,
    actions: [
      { id: "promo", label: "프로모션", cost: 50_000 },
      { id: "mkt_basic",     label: "기본 마케팅",     cost: 30_000 },
      { id: "mkt_active",    label: "적극 마케팅",     cost: 80_000 },
      { id: "mkt_intensive", label: "집중 캠페인",     cost: 150_000 },
      { id: "mkt_event",     label: "특별 이벤트",     cost: 50_000 },
    ],
  },
  {
    key: "rnd",
    label: "연구개발",
    icon: MGMT_ICONS.rnd,
    actions: [
      { id: "research", label: "집중 연구", cost: 60_000 },
      { id: "rnd_basic",  label: "기초 연구", cost: 30_000 },
      { id: "rnd_active", label: "기술 개발", cost: 80_000 },
      { id: "rnd_patent", label: "특허 출원", cost: 100_000 },
    ],
  },
  {
    key: "welfare",
    label: "직원 복지",
    icon: MGMT_ICONS.welfare,
    actions: [
      { id: "training", label: "직원 교육", cost: 50_000 },
      { id: "welfare", label: "복지 강화", cost: 40_000 },
      { id: "wlf_dinner",   label: "직원 회식", cost: 20_000 },
      { id: "wlf_training", label: "사내 교육", cost: 40_000 },
      { id: "wlf_workshop", label: "워크숍",    cost: 60_000 },
    ],
  },
  {
    key: "safety",
    label: "안전 관리",
    icon: MGMT_ICONS.safety,
    actions: [
      { id: "inspect", label: "라인 점검", cost: 40_000 },
      { id: "sft_inspect",  label: "안전 점검", cost: 15_000 },
      { id: "sft_training", label: "안전 교육", cost: 30_000 },
    ],
  },
  {
    key: "extra",
    label: "기타 경영",
    icon: undefined as string | undefined,
    actions: [
      { id: "csr",         label: "ESG활동",    cost: 50_000 },
      { id: "consulting",  label: "외부컨설팅", cost: 80_000 },
      { id: "pr_campaign", label: "언론홍보",   cost: 40_000 },
    ],
  },
] as const;

export function CompanyPanel({ game, company, task }: { game: GameState; company: Company; task?: "production" | "sales" | "research" | "staff" | "finance" }) {
  const setDecisions = useGameStore((s) => s.setDecisions);
  const companyAction = useGameStore((s) => s.companyAction);
  const loan = useGameStore((s) => s.loan);
  const setProductPrice = useGameStore((s) => s.setProductPrice);
  const toggleProduct = useGameStore((s) => s.toggleProduct);
  const [loanAmt, setLoanAmt] = useState(0);
  const actionUntil = useRef(0);
  const once = (action: () => void) => {
    if (Date.now() < actionUntil.current) return;
    actionUntil.current = Date.now() + 500;
    action();
  };

  // Per-quarter interest ≈ debt × (annual rate / 4). (engine: company.ts)
  const quarterlyRate = game.macro.interestRate / 100 / 4 * roleBonuses(company).financeCostMult;
  const currentInterest = Math.round(company.debt * quarterlyRate);
  const loanInterest = Math.round(loanAmt * quarterlyRate);
  const lastCost = Math.max(0, company.lastRevenue - company.lastProfit);

  const industry = getIndustry(company.industryId);
  const country = getCountry(company.countryId);
  const facCap = productionCapacity(company, game.config);
  const demand = estimateDemand(company, industry, country, game.macro, game.config);
  const d = company.decisions;
  const researchUnlocked = isFeatureUnlocked(game, "research");
  const advancedInfoUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");

  const productDefs = getIndustryProducts(company.industryId);
  const productPrices = company.productPrices ?? productDefs.map((p) => Math.round(industry.basePrice * p.priceRatio));
  const productEnabled = company.productEnabled ?? productDefs.map((_, i) => i === 0);
  const productInventory = company.productInventory ?? productDefs.map(() => 0);
  const rndUnlockDone = company.rndUnlockDone ?? false;

  // Active product tab index (defaults to first enabled product)
  const firstActive = productEnabled.findIndex(Boolean);
  const [activeProduct, setActiveProduct] = useState(firstActive >= 0 ? firstActive : 0);

  const activeIdx = activeProduct;
  const activeDef = productDefs[activeIdx];
  const activeTierRef = activeDef ? industry.basePrice * activeDef.priceRatio : industry.basePrice;
  const activeMaxPrice = activeDef ? Math.round(activeTierRef * (1 + company.quality / 100)) : Math.round(industry.basePrice * 2);
  const activePrice = productPrices[activeIdx] ?? Math.round(activeTierRef);
  const activeInventory = productInventory[activeIdx] ?? 0;
  const recommendation = (() => {
    if (facCap <= 0) {
      return "먼저 캠퍼스에서 공장을 지어 생산할 수 있게 해 보세요.";
    }
    if (company.inventory > demand) return "재고가 예상 수요보다 많아요. 생산 목표를 낮추거나 판매 가격을 조금 내려 보세요.";
    if (activePrice > activeTierRef * 1.3) return "현재 상품 가격이 높은 편이에요. 가격을 낮추면 더 많이 팔릴 수 있어요.";
    if (company.lastProfit < 0) return "지난 턴(분기)에 손해가 났어요. 생산 목표를 예상 수요와 비슷하게 맞춰 보세요.";
    if (company.quality < 45 && researchUnlocked) return "기초 연구로 품질을 높이면 더 좋은 상품과 높은 가격을 사용할 수 있어요.";
    return `예상 수요 ${formatNum(demand)}개에 맞춰 생산 목표를 조절해 보세요.`;
  })();

  return (
    <div className="space-y-4">
      {/* ── Ticker ─────────────────────────────────────────────────────── */}
      {!task && <div className="overflow-hidden rounded-2xl shadow-sm">
        <CompanyTicker game={game} company={company} />
      </div>}

      <div hidden={!!task} className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 ring-1 ring-amber-200">
        <div className="text-xs font-black uppercase tracking-wide text-amber-700">💡 이번 턴(분기) 추천 행동</div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{recommendation}</p>
      </div>

      {/* ── 상품 라인업 탭 (최상단) ────────────────────────────────────── */}
      <div hidden={!!task && task !== "sales"} className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            📦 상품 라인업
          </h3>
          <span className="text-xs text-slate-400">R&D 투자로 가격 한도 ↑</span>
        </div>

        {/* Product tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {productDefs.map((def, i) => {
            const isRndProduct = def.isRndUnlock;
            const isUnlocked = isRndProduct ? rndUnlockDone : true;
            const meetsQuality = company.quality >= def.qualityRequired;
            const canEnable = isUnlocked && meetsQuality;
            const isOn = productEnabled[i] && canEnable;
            return (
              <button
                key={def.id}
                onClick={() => setActiveProduct(i)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-center transition-all ${
                  activeProduct === i
                    ? "bg-brand-600 text-white shadow"
                    : isOn
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : canEnable
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-slate-50 text-slate-400 opacity-50"
                }`}
              >
                <span className="text-lg leading-none">{def.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight">{def.name}</span>
                {!canEnable && (
                  <span className="text-[9px] leading-tight opacity-70">
                    {!isUnlocked ? "🔒" : `품질${def.qualityRequired}`}
                  </span>
                )}
                {isOn && activeProduct !== i && (
                  <span className="h-1 w-1 rounded-full bg-brand-500" />
                )}
                {isRndProduct && isUnlocked && (
                  <span className="rounded bg-purple-100 px-1 text-[8px] font-bold text-purple-600">R&D</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active product detail */}
        {activeDef && (() => {
          const isRndProduct = activeDef.isRndUnlock;
          const isUnlocked = isRndProduct ? rndUnlockDone : true;
          const meetsQuality = company.quality >= activeDef.qualityRequired;
          const canEnable = isUnlocked && meetsQuality;
          const isOn = productEnabled[activeIdx] && canEnable;
          const defaultPrice = Math.round(activeTierRef);
          const priceSignal = activePrice > activeTierRef * 1.3
            ? "high"
            : activePrice > activeMaxPrice
              ? "cap"
              : activePrice < activeTierRef * 0.6
                ? "low"
                : "ok";

          return (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeDef.emoji}</span>
                  <div>
                    <div className="font-bold text-slate-800">{activeDef.name}</div>
                    <div className="text-xs text-slate-500">
                      수요 비중 {Math.round(activeDef.demandShare * 100)}% · 기준가 {formatMoney(activeTierRef)}
                    </div>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  aria-label={`${activeDef.name} 판매 ${isOn ? "중지" : "시작"}`}
                  disabled={!canEnable}
                  onClick={() => toggleProduct(activeIdx)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ${
                    isOn ? "bg-brand-500" : "bg-slate-300"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {!canEnable ? (
                <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                  {!isUnlocked
                    ? "🔒 R&D 품질 75점 달성 시 해제됩니다"
                    : `품질 ${activeDef.qualityRequired}점 필요 (현재 ${Math.round(company.quality)}점)`}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Price input with cap indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0 w-10">판매가</span>
                    <input
                      aria-label={`${activeDef.name} 판매 가격`}
                      type="number"
                      value={activePrice}
                      min={1}
                      max={activeMaxPrice}
                      step={Math.max(1, Math.round(defaultPrice * 0.05))}
                      disabled={!isOn}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(activeMaxPrice, Number(e.target.value)));
                        setProductPrice(activeIdx, v);
                      }}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-right text-sm font-bold text-slate-800 outline-none focus:border-brand-500 disabled:opacity-50 bg-white"
                    />
                    <span className="text-xs text-slate-400 shrink-0">원</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      priceSignal === "cap"  ? "bg-red-100 text-red-700" :
                      priceSignal === "high" ? "bg-orange-100 text-orange-600" :
                      priceSignal === "low"  ? "bg-blue-100 text-blue-600" :
                                               "bg-green-100 text-green-700"
                    }`}>
                      {priceSignal === "cap"  ? "🔒 한도" :
                       priceSignal === "high" ? "↑ 고가" :
                       priceSignal === "low"  ? "↓ 저가" : "✓ 적정"}
                    </span>
                  </div>
                  {/* Max price bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-10">한도</span>
                    <div className="relative flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-400 transition-all"
                        style={{ width: `${Math.min(100, (activePrice / activeMaxPrice) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{formatMoney(activeMaxPrice)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    최대 가격 = 기준가 × (1 + 품질/100). 지금 품질 {Math.round(company.quality)} → 최대 {formatMoney(activeMaxPrice)}
                  </div>

                  {/* Inventory */}
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-3 py-1.5">
                    <span className="text-xs text-slate-500">현재 재고</span>
                    <span className={`text-sm font-bold ${activeInventory > 200 ? "text-amber-600" : "text-slate-800"}`}>
                      {formatNum(activeInventory)}개
                      {activeInventory > 200 && <span className="ml-1 text-xs text-amber-500">⚠ 과잉</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 경영 결정 ──────────────────────────────────────────────────── */}
      <div hidden={task === "finance"} className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
          {BUILDING_IMG.office && <img src={BUILDING_IMG.office} alt="" className="h-7 w-7 object-contain" />}
          경영 결정
        </h3>

        {(!task || task === "production") && <Slider
          icon={MGMT_ICONS.production}
          label="생산 목표 (수량)"
          value={d.productionTarget}
          min={0}
          max={facCap}
          step={10}
          format={(v) => `${formatNum(v)}개`}
          onChange={(v) => setDecisions({ productionTarget: Math.min(v, facCap) })}
          hint={facCap > 0 ? `현재 생산 한도 ${formatNum(facCap)}개${d.productionTarget > facCap ? " · 목표가 한도보다 높아도 한도까지만 생산해요" : " (공장 건설로 늘리기)"}` : undefined}
        />}
        {task === "sales" && <Slider label="다음 턴 마케팅 예산" value={d.marketingBudget} min={0} max={200000} step={5000} format={formatMoney} onChange={(v) => setDecisions({ marketingBudget: v })} />}
        {task === "research" && researchUnlocked && <Slider label="다음 턴 연구 예산" value={d.rndBudget} min={0} max={200000} step={5000} format={formatMoney} onChange={(v) => setDecisions({ rndBudget: v })} />}

        {/* Management action buttons */}
        <details open={!!task && task !== "production"} className="group mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-700">
            {task === "production" ? "생산 수치 자세히 보기" : "경영 활동 선택"}
            <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-4 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">마케팅·연구·직원·안전</div>
          {ACTION_SECTIONS.filter((section) => (researchUnlocked || section.key !== "rnd") && (!task || (task === "sales" ? section.key === "marketing" : task === "research" ? section.key === "rnd" : task === "staff" ? ["welfare", "safety", "extra"].includes(section.key) : false))).map((section) => (
            <div key={section.key}>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                {section.icon && <img src={section.icon} alt="" className="h-4 w-4 object-contain" />}
                {section.label}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {section.actions.map((action) => {
                  const canAfford = company.cash >= action.cost;
                  return (
                    <button
                      key={action.id}
                      disabled={!canAfford}
                      onClick={() => once(() => companyAction(action.id))}
                      className={`rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
                        canAfford
                          ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="font-semibold leading-tight">{action.label}</div>
                      <div className={`mt-0.5 text-xs ${canAfford ? "text-brand-500" : "text-slate-400"}`}>
                        즉시 실행 · {formatMoney(action.cost)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <Info label="공장 생산 한도" value={`${formatNum(facCap)}개`} />
            <Info label="예상 총 수요" value={`${formatNum(demand)}개`} hint={demand < d.productionTarget ? "수요<생산: 재고 위험" : "수요 충분"} />
            <Info label="총 재고" value={`${formatNum(company.inventory)}개`} />
            <Info label="지난 턴(분기) 이익" value={formatMoney(company.lastProfit)} tone={company.lastProfit >= 0 ? "good" : "bad"} />
          </div>
        </details>
      </div>

      {/* Company stats */}
      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-slate-800">
          {BUILDING_IMG.rnd && <img src={BUILDING_IMG.rnd} alt="" className="h-7 w-7 object-contain" />}
          회사 상태 자세히 보기
          <span className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4">
          <StatBar label={<Term term="품질">품질 / 기술</Term>} value={company.quality} color="#6366f1" />
          <StatBar label={<Term term="평판" />} value={company.reputation} color="#0ea5e9" />
          <StatBar label={<Term term="사기">직원 사기</Term>} value={company.morale} color="#16a34a" />
          <StatBar label={<Term term="안전" />} value={company.safety} color="#f59e0b" hint={company.safety < 40 ? "낮음! 사고 위험" : undefined} />
        </div>
      </details>

      {/* Finance */}
      {game.config.showAdvancedMetrics && advancedInfoUnlocked && (!task || task === "finance") && (
        <details open={task === "finance"} className="card group p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-slate-800">
            {BUILDING_IMG.office && <img src={BUILDING_IMG.office} alt="" className="h-7 w-7 object-contain" />}
            우리 회사 돈 살펴보기(재무)
            <span className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-4 space-y-4">
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm leading-relaxed text-blue-800">
            <Term term="재무">재무</Term>는 회사에 들어온 돈, 쓴 돈, 남은 돈과 빚을 함께 살펴보는 일이에요.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500"><Term term="매출">들어온 돈(매출)</Term></div>
              <div className="mt-1 font-bold text-slate-800">{formatMoney(company.lastRevenue)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500"><Term term="비용">쓴 돈(비용)</Term></div>
              <div className="mt-1 font-bold text-slate-800">{formatMoney(lastCost)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500"><Term term="이익">남은 돈(이익)</Term></div>
              <div className={`mt-1 font-bold ${company.lastProfit >= 0 ? "text-bull" : "text-bear"}`}>{formatMoney(company.lastProfit)}</div>
            </div>
          </div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-500"><Term term="부채">빌린 돈(부채)</Term></span>
            <span className="font-bold text-slate-800">{formatMoney(company.debt)}</span>
          </div>
          <div className="mb-3 flex justify-between text-xs">
            <span className="text-slate-400"><Term term="이자">이번 턴(분기)에 내는 이자</Term> (연 {game.macro.interestRate.toFixed(2)}%)</span>
            <span className="font-semibold text-bear">≈ {formatMoney(currentInterest)}/턴(분기)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label="빌리거나 갚을 금액"
              value={loanAmt}
              step={50000}
              onChange={(e) => setLoanAmt(Math.max(0, Number(e.target.value)))}
              className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            />
            <button className="btn-ghost" disabled={!Number.isFinite(loanAmt) || loanAmt <= 0} onClick={() => once(() => loan(loanAmt, "borrow"))}>
              돈 빌리기(대출)
            </button>
            <button className="btn-ghost" disabled={!Number.isFinite(loanAmt) || loanAmt <= 0 || loanAmt > company.cash || loanAmt > company.debt} onClick={() => once(() => loan(loanAmt, "repay"))}>
              갚기(상환)
            </button>
          </div>
          {loanAmt > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              {formatMoney(loanAmt)}을 빌리면 턴(분기) 이자가 약 <b className="text-bear">{formatMoney(loanInterest)}</b>씩
              늘어요. 빌린 원금도 나중에 갚아야 해요.
            </div>
          )}
          </div>
        </details>
      )}
    </div>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  icon?: string;
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const sliderMax = Math.max(max, value);
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-slate-600">
          {icon && <img src={icon} alt="" className="h-5 w-5 object-contain" />}
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            aria-label={typeof label === "string" ? label : "경영 수량"}
            value={Math.round(value)}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right font-bold text-brand-700 outline-none focus:border-brand-500"
          />
          <span className="text-xs text-slate-400">{format(value)}</span>
        </div>
      </div>
      <input
        type="range"
        aria-label={typeof label === "string" ? `${label} 슬라이더` : "경영 수량 슬라이더"}
        min={min}
        max={sliderMax}
        step={step}
        value={Math.min(value, sliderMax)}
        onChange={(e) => onChange(Math.min(Number(e.target.value), max))}
        className="w-full accent-brand-600"
      />
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function Info({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-bold ${tone === "good" ? "text-bull" : tone === "bad" ? "text-bear" : "text-slate-800"}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-amber-600">{hint}</div>}
    </div>
  );
}

function StatBar({ label, value, color, hint }: { label: React.ReactNode; value: number; color: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{Math.round(value)}</span>
      </div>
      <Bar value={value} color={color} />
      {hint && <div className="mt-0.5 text-xs text-amber-600">{hint}</div>}
    </div>
  );
}

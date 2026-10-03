"use client";

import {
  projectCompanyTurn,
  type Company,
  type GameState,
} from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getIndustryProducts } from "@/lib/data/products";
import { formatMoney } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";

// 🧪 가격 실험실: try several price tags and see the expected profit of an
// ordinary turn for each (production matched to customers). The best one
// wears a crown; tapping a bar sets that price. It turns the abstract
// "price vs. how many sell" lesson into a small game.

export function PriceLab({ game, company, productIndex }: { game: GameState; company: Company; productIndex: number }) {
  const setProductPrice = useGameStore((s) => s.setProductPrice);
  const def = getIndustryProducts(company.industryId)[productIndex];
  if (!def) return null;
  const enabled = company.productEnabled?.[productIndex] ?? productIndex === 0;
  if (!enabled) return null;

  const tierRef = getIndustry(company.industryId).basePrice * def.priceRatio;
  const cap = Math.floor(tierRef * (1 + company.quality / 100));
  const current = company.productPrices?.[productIndex] ?? Math.round(tierRef);
  const candidates = Array.from(
    new Set([0.6, 0.8, 1, 1.1, 1.2, 1.35].map((m) => Math.min(cap, Math.round(tierRef * m))).concat([cap, current])),
  ).sort((a, b) => a - b);

  const trials = candidates.map((price) => {
    const prices = [...(company.productPrices ?? [])];
    prices[productIndex] = price;
    const projection = projectCompanyTurn({ ...company, productPrices: prices }, game.macro, game.config);
    return { price, profit: projection.profit, units: projection.units, limited: projection.limitedBy };
  });
  const best = trials.reduce((a, b) => (b.profit > a.profit ? b : a));
  const maxAbs = Math.max(1, ...trials.map((t) => Math.abs(t.profit)));
  const now = trials.find((t) => t.price === current) ?? trials[0];

  return (
    <section className="mt-3 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200" aria-labelledby={`price-lab-${productIndex}`}>
      <h4 id={`price-lab-${productIndex}`} className="text-sm font-black text-violet-950">
        🧪 가격 실험실
      </h4>
      <p className="mt-0.5 text-sm leading-relaxed text-violet-900">
        너무 싸면 많이 팔아도 남는 돈이 적고, 너무 비싸면 손님이 줄어요. 👑 이익이 가장 큰 가격을 찾아봐요!
        <b className="block">막대를 누르면 그 가격으로 바뀌어요.</b>
      </p>
      <div className="mt-2 flex h-36 items-end gap-1.5" role="group" aria-label="가격별 예상 이익">
        {trials.map((trial) => {
          const height = Math.max(6, (Math.abs(trial.profit) / maxAbs) * 100);
          const isBest = trial.price === best.price;
          const isNow = trial.price === current;
          return (
            <button
              key={trial.price}
              type="button"
              onClick={() => setProductPrice(productIndex, trial.price)}
              aria-pressed={isNow}
              aria-label={`${trial.price}원일 때 예상 이익 ${Math.round(trial.profit).toLocaleString()}원`}
              className="!min-h-0 group flex h-full flex-1 flex-col items-center justify-end"
            >
              <span className="mb-0.5 text-xs font-bold text-slate-600">{isBest ? "👑" : ""}{formatMoney(Math.round(trial.profit))}</span>
              <span
                className={`w-full rounded-t-md transition-all ${trial.profit >= 0 ? (isBest ? "bg-amber-400" : "bg-violet-400") : "bg-rose-400"} ${isNow ? "ring-2 ring-slate-900" : "group-hover:opacity-80"}`}
                style={{ height: `${height * 0.62}%` }}
              />
              <span className={`mt-1 text-sm font-black ${isNow ? "text-slate-900" : "text-slate-500"}`}>{trial.price}원</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-sm leading-relaxed text-slate-700">
        지금 {current}원이면 다음 턴 이익 약 <b>{formatMoney(Math.round(now.profit))}원</b>
        {best.price !== current
          ? ` · ${best.price}원으로 바꾸면 약 ${formatMoney(Math.round(best.profit))}원이 예상돼요.`
          : " · 지금 가격이 가장 좋아요! 👍"}
        {now.limited === "capacity" && " (지금은 손님이 많아 공장이 만드는 만큼 다 팔려요)"}
      </p>
    </section>
  );
}

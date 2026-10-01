"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Company, GameState } from "@/lib/engine";
import { formatMoney, formatNum } from "@/lib/format";

// Kid-friendly investment charts: turn labels on the x-axis, the highest and
// lowest points marked, a dashed line for "the price I paid", a plain-language
// summary under every chart, and a "what if I had bought earlier?" calculator.

const UP = "#22c55e";
const DOWN = "#ef4444";

export interface TrendSummary {
  changePct: number;
  emoji: string;
  label: string;
}

/** Turn number for each history point (the last point is the current turn). */
function turnLabels(history: number[], currentTurn: number): number[] {
  return history.map((_, i) => currentTurn - (history.length - 1 - i));
}

export function trendOf(history: number[], span = 10): TrendSummary {
  const recent = history.slice(-(span + 1));
  const first = recent[0] ?? 0;
  const last = recent[recent.length - 1] ?? first;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  if (changePct >= 15) return { changePct, emoji: "🚀", label: "쑥쑥 올라요" };
  if (changePct >= 3) return { changePct, emoji: "📈", label: "조금씩 올라요" };
  if (changePct > -3) return { changePct, emoji: "😐", label: "거의 그대로" };
  if (changePct > -15) return { changePct, emoji: "📉", label: "조금씩 내려요" };
  return { changePct, emoji: "🥶", label: "많이 내렸어요" };
}

/** Tiny area chart for list cards. */
export function MiniTrend({ history, span = 10 }: { history: number[]; span?: number }) {
  const data = history.slice(-(span + 1));
  if (data.length < 2) return <div className="h-9 text-[10px] text-slate-600">아직 기록이 없어요</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => [i * step, h - 3 - ((v - min) / range) * (h - 6)] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const color = up ? UP : DOWN;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity={0.15} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const RANGES = [
  { span: 10, label: "최근 10턴" },
  { span: 30, label: "30턴" },
  { span: 999, label: "전체" },
] as const;

/** The big chart in the trade window. */
export function KidPriceChart({
  history,
  currentTurn,
  avgCost,
  unit = "주",
}: {
  history: number[];
  currentTurn: number;
  avgCost?: number;
  unit?: string;
}) {
  const [span, setSpan] = useState<number>(10);
  const [whatIfQty, setWhatIfQty] = useState(10);
  const turns = turnLabels(history, currentTurn);
  const start = Math.max(0, history.length - 1 - span);
  const series = history.slice(start).map((v, i) => ({ turn: turns[start + i], price: Math.round(v * 100) / 100 }));

  if (series.length < 2) {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-white/[0.04] p-4 text-center text-xs text-slate-400">
        📊 아직 가격 기록이 짧아요. 다음 턴(분기)부터 그래프가 그려져요!
      </div>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const high = series.reduce((a, b) => (b.price > a.price ? b : a));
  const low = series.reduce((a, b) => (b.price < a.price ? b : a));
  const changePct = ((last.price - first.price) / first.price) * 100;
  const up = changePct >= 0;
  const color = up ? UP : DOWN;
  const periodLabel = span >= 999 ? "처음부터 지금까지" : `최근 ${series.length - 1}턴 동안`;
  const whatIf = Math.round((last.price - first.price) * whatIfQty);

  return (
    <div className="px-4 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="그래프 기간">
          {RANGES.map((range) => (
            <button
              key={range.span}
              type="button"
              aria-pressed={span === range.span}
              onClick={() => setSpan(range.span)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${span === range.span ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500">가로: 턴(분기) · 세로: 가격</span>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="kidChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="turn"
              tickFormatter={(t: number) => `${t}턴`}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              minTickGap={18}
            />
            <YAxis
              domain={["auto", "auto"]}
              width={44}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatNum(v)}
            />
            {avgCost != null && avgCost > 0 && (
              <ReferenceLine
                y={avgCost}
                stroke="#facc15"
                strokeDasharray="5 4"
                label={{ value: "내가 산 평균 가격", position: "insideTopLeft", fill: "#facc15", fontSize: 10 }}
              />
            )}
            <ReferenceDot x={high.turn} y={high.price} r={4} fill="#22c55e" stroke="#ffffff" label={{ value: "최고", position: "top", fill: "#86efac", fontSize: 10 }} />
            <ReferenceDot x={low.turn} y={low.price} r={4} fill="#ef4444" stroke="#ffffff" label={{ value: "최저", position: "bottom", fill: "#fca5a5", fontSize: 10 }} />
            <Tooltip
              formatter={(v: number) => [`${formatNum(v)}원`, "가격"]}
              labelFormatter={(t: number) => `${t}턴(분기)`}
              contentStyle={{ fontSize: 11, borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2.4} fill="url(#kidChartFill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs leading-relaxed text-slate-200">
        {up ? "📈" : "📉"} {periodLabel} 가격이 <b className={up ? "text-emerald-400" : "text-red-400"}>
          {up ? "+" : ""}{changePct.toFixed(1)}%
        </b> {up ? "올랐어요" : "내렸어요"}. 가장 비쌀 때 {formatNum(high.price)}원({high.turn}턴), 가장 쌀 때 {formatNum(low.price)}원({low.turn}턴).
        <span className="mt-1 block text-[11px] text-slate-400">
          그래프 선이 오른쪽으로 갈수록 올라가면 가격이 오른 거예요. 오르내림이 클수록 위험도 커요.
        </span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-xs text-violet-100 ring-1 ring-violet-500/20">
        <span>🤔 만약 {first.turn}턴에</span>
        <select
          value={whatIfQty}
          onChange={(e) => setWhatIfQty(Number(e.target.value))}
          className="rounded-md bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-white ring-1 ring-violet-400/40"
          aria-label="만약에 샀을 수량"
        >
          {[1, 10, 100].map((q) => (
            <option key={q} value={q}>{q}{unit}</option>
          ))}
        </select>
        <span>
          샀다면 지금{" "}
          <b className={whatIf >= 0 ? "text-emerald-300" : "text-red-300"}>
            {whatIf >= 0 ? "+" : "−"}{formatMoney(Math.abs(whatIf))}원
          </b>{" "}
          {whatIf >= 0 ? "이득" : "손해"}이에요.
        </span>
      </div>
    </div>
  );
}

/** Market-wide index ("드래곤 종합지수") plus this turn's biggest movers. */
export function MarketOverview({
  game,
  listings,
  onPick,
}: {
  game: GameState;
  listings: { id: string; name: string; history: number[] }[];
  onPick: (id: string) => void;
}) {
  const length = Math.min(...listings.map((l) => l.history.length));
  if (!Number.isFinite(length) || length < 2) return null;
  const turns = turnLabels(Array.from({ length }), game.turn);
  const index = Array.from({ length }, (_, i) => {
    let sum = 0;
    for (const listing of listings) {
      const h = listing.history.slice(-length);
      sum += h[i] / Math.max(0.01, h[0]);
    }
    return { turn: turns[i], value: Math.round((sum / listings.length) * 1000) / 10 };
  }).slice(-31);
  const first = index[0].value;
  const last = index[index.length - 1].value;
  const up = last >= first;
  const movers = listings
    .map((l) => {
      const prev = l.history[l.history.length - 2] ?? l.history[l.history.length - 1];
      const now = l.history[l.history.length - 1];
      return { id: l.id, name: l.name, change: prev > 0 ? ((now - prev) / prev) * 100 : 0 };
    })
    .sort((a, b) => b.change - a.change);
  const gainers = movers.slice(0, 3);
  const losers = movers.slice(-3).reverse();
  const mood = last - first >= 3 ? { emoji: "🐂", text: "시장이 힘차요(상승장)" } : last - first <= -3 ? { emoji: "🐻", text: "시장이 움츠렸어요(하락장)" } : { emoji: "🐢", text: "시장이 잔잔해요" };

  return (
    <section className="border-b border-slate-800/60 bg-slate-950/40 px-4 py-3" aria-labelledby="market-overview-title">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 id="market-overview-title" className="text-sm font-black text-slate-100">
            🐉 드래곤 종합지수 <span className={up ? "text-emerald-400" : "text-red-400"}>{last.toFixed(1)}</span>
          </h3>
          <p className="text-[11px] text-slate-500">모든 회사 주가의 평균 변화예요. 100보다 크면 처음보다 올랐다는 뜻!</p>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-200">
          {mood.emoji} {mood.text}
        </span>
      </div>
      <div className="mt-2 h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={index} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? UP : DOWN} stopOpacity={0.3} />
                <stop offset="100%" stopColor={up ? UP : DOWN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="turn" tickFormatter={(t: number) => `${t}턴`} tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 3" />
            <Tooltip
              formatter={(v: number) => [v.toFixed(1), "지수"]}
              labelFormatter={(t: number) => `${t}턴(분기)`}
              contentStyle={{ fontSize: 11, borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
            />
            <Area type="monotone" dataKey="value" stroke={up ? UP : DOWN} strokeWidth={2} fill="url(#indexFill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <MoverList title="🚀 이번 턴 많이 오른 주식" items={gainers} onPick={onPick} />
        <MoverList title="🥶 이번 턴 많이 내린 주식" items={losers} onPick={onPick} />
      </div>
    </section>
  );
}

function MoverList({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { id: string; name: string; change: number }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-xl bg-white/[0.035] p-2 ring-1 ring-white/[0.06]">
      <div className="mb-1 text-[11px] font-bold text-slate-400">{title}</div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.id)}
          className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/5"
        >
          <span className="truncate text-slate-200">{item.name}</span>
          <span className={`shrink-0 font-mono font-bold ${item.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {item.change >= 0 ? "▲" : "▼"}{Math.abs(item.change).toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  );
}

const SLICE_COLORS = ["#60a5fa", "#f472b6", "#facc15", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#f87171"];

/** "내 투자 바구니": how the student's investments are spread out. */
export function PortfolioBasket({
  slices,
  cash,
}: {
  slices: { name: string; value: number }[];
  cash: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((sum, s) => sum + s.value, 0);
  const data = rest > 0 ? [...top, { name: "기타", value: rest }] : top;
  const biggestShare = sorted[0].value / total;
  const spread = slices.length >= 4 && biggestShare < 0.5 ? 3 : slices.length >= 2 && biggestShare < 0.75 ? 2 : 1;
  const investedShare = total / Math.max(1, total + cash);

  return (
    <section className="border-b border-slate-800/60 px-4 py-3" aria-labelledby="basket-title">
      <h3 id="basket-title" className="text-sm font-black text-slate-100">🧺 내 투자 바구니</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={52} paddingAngle={2} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="#0f172a" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-xs">
          {data.map((slice, i) => (
            <div key={slice.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
              <span className="truncate text-slate-300">{slice.name}</span>
              <span className="ml-auto font-mono text-slate-400">{Math.round((slice.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] leading-relaxed text-slate-300">
        분산 점수 <b className="text-amber-300">{"⭐".repeat(spread)}{"☆".repeat(3 - spread)}</b>
        {spread === 3
          ? " — 여러 바구니에 잘 나눠 담았어요! 하나가 떨어져도 덜 흔들려요."
          : spread === 2
            ? " — 조금 나눠 담았어요. 종류를 더 섞으면 더 안전해요."
            : " — 한 바구니에 달걀을 다 담았어요 🥚 한 종목이 떨어지면 크게 흔들려요."}
        <span className="mt-0.5 block text-slate-500">
          가진 돈 중 투자한 돈: {Math.round(investedShare * 100)}% · 현금으로 남은 돈: {formatMoney(cash)}원
        </span>
      </p>
    </section>
  );
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/store/gameStore";
import { avgCost, isFeatureUnlocked, portfolioValue } from "@/lib/engine";
import type { AssetClass, Company, GameState, StockKind } from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { formatMoney, formatNum, changePct } from "@/lib/format";
import { KidPriceChart, MarketOverview, MiniTrend, PortfolioBasket, trendOf } from "./StockCharts";
import { ASSET_ICONS } from "@/lib/assetMap";
import { PRESET_MAP } from "@/lib/data/companyPresets";
import { CompanyMark } from "./CompanyMark";
import { WORK_LESSONS } from "@/lib/learning/catalog";

// ── Types ──────────────────────────────────────────────────────────────────────

type Selection =
  | { kind: "stock"; id: string }
  | { kind: "asset"; id: AssetClass }
  | null;

interface Listing {
  id: string;
  name: string;
  logoColor: string;
  industryId: string;
  external: boolean;
  kind?: StockKind;
  price: number;
  prevPrice: number;
  change: number;
  cap: number;
  history: number[];
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function InvestmentDesk() {
  const storeGame = useGameStore((s) => s.game);
  const tradeStock = useGameStore((s) => s.tradeStock);
  const tradeAsset = useGameStore((s) => s.tradeAsset);

  const [tab, setTab] = useState<"stocks" | "assets">("stocks");
  const [sel, setSel] = useState<Selection>(null);
  const [qty, setQty] = useState(10);

  if (!storeGame) return null;
  const game = storeGame;
  const company = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const newsUnlocked = isFeatureUnlocked(game, "talentNewsRanking");

  const companyById = new Map(game.companies.map((c) => [c.id, c]));
  const pv = portfolioValue(company, game);

  const allListings: Listing[] = Object.values(game.stocks)
    .filter((s) => s.companyId !== company.id)
    .map((s) => {
      const c = companyById.get(s.companyId);
      const cap = s.price * s.sharesOutstanding;
      const prev = s.history[s.history.length - 2] ?? s.price;
      return {
        id: s.companyId,
        name: c?.name ?? s.name ?? s.companyId,
        logoColor: c?.logoColor ?? s.logoColor ?? "#64748b",
        industryId: c?.industryId ?? s.industryId ?? "tech",
        external: !c,
        kind: s.kind,
        price: s.price,
        prevPrice: prev,
        change: changePct(s.price, prev),
        cap,
        history: s.history,
      };
    });

  return (
    <div
      className="overflow-hidden rounded-2xl text-white shadow-2xl"
      style={{ background: "#080e1a", border: "1px solid rgba(148,163,184,0.08)" }}
    >
      {/* ── Header: how much money is where ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: "#060b14" }}>
        <h2 className="text-lg font-black text-white">📈 남는 돈 불리기</h2>
        <div className="flex gap-2 text-sm">
          <span className="rounded-xl bg-white/5 px-3 py-1.5">
            <span className="block text-xs text-slate-400">💰 쓸 수 있는 돈</span>
            <b className="text-slate-100">{formatMoney(company.cash)}원</b>
          </span>
          <span className="rounded-xl bg-white/5 px-3 py-1.5">
            <span className="block text-xs text-slate-400">🧺 투자한 돈의 지금 값</span>
            <b className={pv > 0 ? "text-emerald-400" : "text-slate-400"}>{formatMoney(pv)}원</b>
          </span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3" style={{ background: "#060b14" }} role="tablist">
        {(["stocks", "assets"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setSel(null); }}
            className={`min-h-12 rounded-xl px-4 text-base font-black transition-all ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "stocks" ? "📈 회사 주식" : "🏦 예금·금·달러"}
          </button>
        ))}
      </div>
      {tab === "assets" && (
        <div className="bg-blue-950 px-4 py-3 text-sm leading-relaxed text-blue-100">
          <b>📘 {WORK_LESSONS.fx.term}</b> — {WORK_LESSONS.fx.text} {WORK_LESSONS.fx.impact}
        </div>
      )}

      {tab === "stocks" ? (
        <div>
          {/* ── Portfolio ── */}
          <PortfolioBar game={game} company={company} companyById={companyById} onPick={(id) => setSel({ kind: "stock", id })} />
          <PortfolioBasket
            cash={company.cash}
            slices={[
              ...Object.entries(company.portfolio.stocks)
                .filter(([, shares]) => shares > 0)
                .map(([id, shares]) => ({
                  name: companyById.get(id)?.name ?? game.stocks[id]?.name ?? id,
                  value: (game.stocks[id]?.price ?? 0) * shares,
                })),
              ...Object.entries(company.portfolio.assets)
                .filter(([, units]) => (units ?? 0) > 0)
                .map(([id, units]) => ({
                  name: game.assets[id as AssetClass]?.name ?? id,
                  value: (game.assets[id as AssetClass]?.price ?? 0) * (units ?? 0),
                })),
            ]}
          />
          <MarketOverview game={game} listings={allListings} onPick={(id) => setSel({ kind: "stock", id })} />

          <div className="border-b border-slate-800/60 bg-slate-950/40 px-4 py-3">
            <div className="text-base font-black text-slate-100">어떤 회사 주식을 살까요?</div>
            <div className="text-sm text-slate-400">카드를 누르면 값이 어떻게 변했는지 그래프로 보고 사고팔 수 있어요.</div>
          </div>
          <SimpleRiskCards
            listings={allListings}
            holdings={company.portfolio.stocks}
            onPick={(id) => setSel({ kind: "stock", id })}
          />
        </div>
      ) : (
        /* ── Asset list ── */
        <div className="divide-y divide-slate-800/40">
          <div className="bg-blue-950/30 px-4 py-3 text-sm leading-relaxed text-blue-200">
            🌍 이자(금리)가 오르면 예금·채권, 물건값(물가)이 오르면 금, 다른 나라 돈값(환율)이 오르면 달러가 좋아질 수 있어요.
          </div>
          {game.config.enabledAssets.map((id) => {
            const a = game.assets[id];
            const prev = a.history[a.history.length - 2] ?? a.price;
            const ch = changePct(a.price, prev);
            const held = company.portfolio.assets[id] ?? 0;
            const up = ch >= 0;
            return (
              <button
                key={id}
                onClick={() => setSel({ kind: "asset", id })}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  {ASSET_ICONS[id]
                    ? <img src={ASSET_ICONS[id]} alt={a.name} className="h-7 w-7 object-contain" />
                    : <span className="text-xl">{a.emoji}</span>
                  }
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-200">{a.name}</div>
                  <div className="text-sm text-slate-400">
                    {held > 0 ? `${formatNum(held)}개 가지고 있어요` : a.desc}
                  </div>
                </div>
                <div className="w-24 shrink-0">
                  <MiniTrend history={a.history} />
                  <div className="text-center text-xs text-slate-400">{trendOf(a.history).emoji} {trendOf(a.history).label}</div>
                </div>
                <div className="w-28 shrink-0 text-right">
                  <div className="font-mono font-bold text-slate-100">{formatNum(Math.round(a.price))}</div>
                  <div className={`font-mono text-xs font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                    {up ? "▲" : "▼"}&thinsp;{Math.abs(ch).toFixed(2)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Trade modal ── */}
      {sel && (
        <TradeModal
          game={game}
          company={company}
          sel={sel}
          qty={qty}
          setQty={setQty}
          showNews={newsUnlocked}
          onClose={() => setSel(null)}
          onTrade={(side) => {
            const ok = sel.kind === "stock"
              ? tradeStock(sel.id, qty, side)
              : tradeAsset(sel.id, qty, side);
            if (ok) setSel(null); // close only on success
          }}
        />
      )}
    </div>
  );
}

// ── Ticker Bar ─────────────────────────────────────────────────────────────────

function SimpleRiskCards({
  listings,
  holdings,
  onPick,
}: {
  listings: Listing[];
  holdings: Record<string, number>;
  onPick: (id: string) => void;
}) {
  const cards = [...listings].sort((a, b) => b.cap - a.cap);
  return (
    <div className="p-3">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">🛡️ 안정적<br /><span className="text-xs text-emerald-500/90">값이 조금씩 변해요</span></div>
        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300">⚖️ 보통<br /><span className="text-xs text-amber-500/90">벌 수도 잃을 수도 중간</span></div>
        <div className="rounded-lg bg-rose-500/10 p-2 text-rose-300">🎢 도전적<br /><span className="text-xs text-rose-500/90">크게 오르내려요</span></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
        {cards.map((listing) => {
          const held = holdings[listing.id] ?? 0;
          const risk = listing.kind === "dividend"
            ? { label: "안정적", emoji: "🛡️", cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" }
            : listing.kind === "growth" || Math.abs(listing.change) >= 4
              ? { label: "도전적", emoji: "🎢", cls: "bg-rose-500/10 text-rose-300 ring-rose-500/20" }
              : { label: "보통", emoji: "⚖️", cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20" };
          const industry = getIndustry(listing.industryId);
          const trend = trendOf(listing.history);
          return (
            <button
              key={listing.id}
              type="button"
              onClick={() => onPick(listing.id)}
              className="rounded-xl bg-white/[0.035] p-3 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:ring-blue-500/40"
            >
              <div className="flex items-start gap-3">
                <CompanyMark
                  color={listing.logoColor}
                  mark={PRESET_MAP[listing.id]?.mark ?? industry.emoji}
                  name={listing.name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-100">{listing.name}</div>
                  <div className="text-xs text-slate-400">{industry.name}{held > 0 ? ` · ${formatNum(held)}주 가지고 있어요` : ""}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ring-1 ${risk.cls}`}>
                  {risk.emoji} {risk.label}
                </span>
              </div>
              <div className="mt-2">
                <MiniTrend history={listing.history} />
                <div className="mt-0.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{trend.emoji} 최근 10턴 {trend.label}</span>
                  <span className={`font-bold ${trend.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {trend.changePct >= 0 ? "+" : ""}{trend.changePct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-xs text-slate-500">주식 1주 값</div>
                  <div className="font-mono text-base font-black text-white">{formatNum(Math.round(listing.price))}</div>
                </div>
                <div className={`text-sm font-bold ${listing.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  <span className="mr-1 text-xs font-normal text-slate-500">이번 턴</span>
                  {listing.change >= 0 ? "▲" : "▼"} {Math.abs(listing.change).toFixed(1)}%
                </div>
              </div>
              <div className="mt-2 text-right text-sm font-black text-blue-400">사고팔기 →</div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        🛡️⚖️🎢 표시는 최근 값 변화를 보고 붙인 쉬운 안내예요. 앞으로도 꼭 그렇다는 뜻은 아니에요.
      </p>
    </div>
  );
}

// ── Portfolio Bar ──────────────────────────────────────────────────────────────

function PortfolioBar({
  game,
  company,
  companyById,
  onPick,
}: {
  game: GameState;
  company: Company;
  companyById: Map<string, Company>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const holdings = Object.entries(company.portfolio.stocks)
    .filter(([, sh]) => sh > 0)
    .map(([id, shares]) => {
      const stock = game.stocks[id];
      const c = companyById.get(id);
      const price = stock?.price ?? 0;
      const avg = avgCost(company, id);
      const value = price * shares;
      const pl = (price - avg) * shares;
      const plPct = avg > 0 ? ((price - avg) / avg) * 100 : 0;
      return {
        id,
        name: c?.name ?? stock?.name ?? id,
        logoColor: c?.logoColor ?? stock?.logoColor ?? "#64748b",
        industryId: c?.industryId ?? stock?.industryId ?? "tech",
        shares, price, avg, value, pl, plPct,
      };
    })
    .sort((a, b) => b.value - a.value);

  if (holdings.length === 0) {
    return (
      <div
        className="px-4 py-3 text-sm text-slate-400"
        style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
      >
        🧺 아직 산 주식이 없어요. 아래에서 마음에 드는 회사를 골라 보세요.
      </div>
    );
  }

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalPl = holdings.reduce((s, h) => s + h.pl, 0);
  const totalCost = totalValue - totalPl;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  return (
    <div style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
      {/* Summary header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-sm font-black text-slate-300">내가 산 주식</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs text-slate-500"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {holdings.length}개 회사
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="font-semibold text-slate-300">{formatMoney(totalValue)}</span>
          <span className={`font-bold ${totalPl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPl >= 0 ? "+" : ""}{formatMoney(Math.round(totalPl))}
            <span className="ml-1 font-semibold opacity-80">
              ({totalPl >= 0 ? "+" : ""}{totalPlPct.toFixed(2)}%)
            </span>
          </span>
          <span className="text-slate-700 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-800/30">
          {holdings.map((h) => {
            const ind = getIndustry(h.industryId);
            const up = h.pl >= 0;
            return (
              <button
                key={h.id}
                onClick={() => onPick(h.id)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
                style={{ background: "rgba(255,255,255,0.015)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                  style={{ background: h.logoColor + "28" }}
                >
                  {ind.emoji}
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-semibold text-slate-300">{h.name}</div>
                  <div className="font-mono text-slate-600">
                    {formatNum(h.shares)}주 · 산 값 {formatNum(Math.round(h.avg))}
                    <span className="mx-1 text-slate-800">→</span>
                    {formatNum(Math.round(h.price))}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono font-semibold text-slate-300">{formatMoney(h.value)}</div>
                  <div className={`font-mono font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>
                    {up ? "+" : ""}{formatMoney(Math.round(h.pl))}
                    <span className="ml-1 opacity-70">({h.plPct >= 0 ? "+" : ""}{h.plPct.toFixed(1)}%)</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Trade Modal ────────────────────────────────────────────────────────────────

function TradeModal({
  game,
  company,
  sel,
  qty,
  setQty,
  showNews,
  onClose,
  onTrade,
}: {
  game: GameState;
  company: Company;
  sel: NonNullable<Selection>;
  qty: number;
  setQty: (n: number) => void;
  showNews: boolean;
  onClose: () => void;
  onTrade: (side: "buy" | "sell") => void;
}) {
  const isStock = sel.kind === "stock";
  const stock = isStock ? game.stocks[sel.id] : null;
  const stockCompany = isStock ? game.companies.find((c) => c.id === sel.id) : undefined;
  const asset = !isStock ? game.assets[sel.id as AssetClass] : null;

  const price = isStock ? stock!.price : asset!.price;
  const name = isStock ? stockCompany?.name ?? stock!.name ?? sel.id : asset!.name;
  const color = isStock ? stockCompany?.logoColor ?? stock!.logoColor ?? "#3b82f6" : "#f59e0b";
  const history = isStock ? stock!.history : asset!.history;
  const held = isStock
    ? (company.portfolio.stocks[sel.id] ?? 0)
    : (company.portfolio.assets[sel.id as AssetClass] ?? 0);
  const stockAvg = isStock ? avgCost(company, sel.id) : 0;

  const prevPrice = history[history.length - 2] ?? price;
  const change = changePct(price, prevPrice);
  const up = change >= 0;
  const priceChange = price - prevPrice;


  const indEmoji = isStock
    ? getIndustry(stockCompany?.industryId ?? "tech").emoji
    : asset!.emoji;
  const assetIconSrc = !isStock && asset ? ASSET_ICONS[asset.id] : null;

  const orderQty = isStock ? qty : qty;
  const orderValue = Math.round(price * orderQty);
  const sellQty = Math.min(orderQty, held);

  // P&L on held position
  const heldPl = isStock && held > 0 ? (price - stockAvg) * held : 0;
  const heldPlPct = stockAvg > 0 ? ((price - stockAvg) / stockAvg) * 100 : 0;

  // Portal to <body> so the sheet sits above the sticky HUD.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-md animate-popin overflow-y-auto overflow-x-hidden rounded-t-2xl scroll-thin sm:rounded-2xl"
        style={{ background: "#080e1a", boxShadow: "0 0 0 1px rgba(148,163,184,0.1), 0 25px 60px -10px rgba(0,0,0,0.9)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: "#0a1121", borderBottom: "1px solid rgba(148,163,184,0.07)" }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: color + "22" }}
          >
            {assetIconSrc
              ? <img src={assetIconSrc} alt={name} className="h-6 w-6 object-contain" />
              : indEmoji
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white">{name}</div>
            <div className="text-xs text-slate-600">
              {isStock ? (stockCompany ? "라이벌 회사 주식" : "다른 회사 주식") : "예금·금·달러"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* ── Price hero ── */}
        <div className="px-4 pt-4">
          <div className="font-mono text-[2.6rem] font-black leading-none text-white">
            {formatNum(Math.round(price))}
          </div>
          <div className={`mt-1.5 flex items-center gap-2 text-sm font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
            <span>{up ? "▲" : "▼"} {formatNum(Math.abs(Math.round(priceChange)))}</span>
            <span className="text-slate-700">|</span>
            <span>{up ? "+" : ""}{change.toFixed(2)}%</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-500 text-xs font-normal">지난 턴보다</span>
          </div>
        </div>

        {/* ── Chart ── */}
        <KidPriceChart
          history={history}
          currentTurn={game.turn}
          avgCost={isStock && held > 0 ? stockAvg : undefined}
          unit={isStock ? "주" : "개"}
        />

        {/* ── Related news ── */}
        {isStock && showNews && (() => {
          const relatedNews = game.news
            .filter((n) => n.tags.some((t) => t === sel.id || t === (stockCompany?.industryId ?? "")) || n.layer === "monetary")
            .slice(-6)
            .reverse()
            .slice(0, 4);
          if (relatedNews.length === 0) return null;
          return (
            <div style={{ borderTop: "1px solid rgba(148,163,184,0.07)", borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
              <div className="px-3 pt-2 pb-1 text-sm font-bold text-slate-400">📰 값이 바뀐 이유 (뉴스)</div>
              <div className="max-h-28 overflow-y-auto">
                {relatedNews.map((n) => (
                  <div key={n.id} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="shrink-0 text-sm">{n.emoji}</span>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${n.tone === "positive" ? "text-emerald-400" : n.tone === "negative" ? "text-red-400" : "text-slate-400"}`}>
                        {n.title}
                      </div>
                      <div className="text-xs text-slate-600 leading-snug">{n.body}</div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-600">{n.turn}턴</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Holdings row ── */}
        {held > 0 && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(148,163,184,0.05)" }}
          >
            <span>
              <span className="text-slate-500">가진 개수 </span>
              <span className="font-bold text-white">{formatNum(held)}{isStock ? "주" : ""}</span>
            </span>
            {isStock && (
              <>
                <span>
                  <span className="text-slate-500">산 값(평균) </span>
                  <span className="font-bold text-white">{formatNum(Math.round(stockAvg))}</span>
                </span>
                <span>
                  <span className="text-slate-500">지금 팔면 </span>
                  <span className={`font-bold ${heldPl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {heldPl >= 0 ? "+" : ""}{formatMoney(Math.round(heldPl))}
                    <span className="ml-1 opacity-80">({heldPlPct >= 0 ? "+" : ""}{heldPlPct.toFixed(1)}%)</span>
                  </span>
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Order panel ── */}
        <div className="px-4 py-4">
          {/* Quick qty presets */}
          <div className="mb-3 flex gap-1.5">
            {[1, 10, 100].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className="min-h-11 flex-1 rounded-lg py-2 text-sm font-bold text-slate-300 transition hover:text-white"
                style={{ background: "rgba(255,255,255,0.04)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                {n}{isStock ? "주" : ""}
              </button>
            ))}
            {held > 0 && (
              <button
                onClick={() => setQty(held)}
                className="min-h-11 flex-1 rounded-lg py-2 text-sm font-bold text-yellow-500 transition"
                style={{ background: "rgba(255,255,255,0.04)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                모두
              </button>
            )}
          </div>

          {/* Qty stepper */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-slate-300 transition hover:text-white"
              style={{ background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              −
            </button>
            <output
              aria-live="polite"
              className="flex-1 rounded-xl py-2.5 text-center text-2xl font-black text-white"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {formatNum(qty)}{isStock ? "주" : "개"}
            </output>
            <button
              onClick={() => setQty(qty + 1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-slate-300 transition hover:text-white"
              style={{ background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              +
            </button>
          </div>

          {/* Order summary */}
          <div
            className="mt-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex justify-between">
              <span className="text-slate-400">몇 {isStock ? "주" : "개"}</span>
              <span className="font-mono font-semibold text-slate-300">
                {formatNum(qty)}{isStock ? "주" : ""}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-slate-400">필요한 돈</span>
              <span className="font-mono font-bold text-white">{formatMoney(orderValue)}</span>
            </div>
          </div>
        </div>

        {/* ── Buy / Sell buttons ── */}
        <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(148,163,184,0.08)" }}>
          <button
            onClick={() => onTrade("sell")}
            disabled={held <= 0}
            className="flex flex-col items-center justify-center py-4 font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed"
            style={{ background: held > 0 ? "#dc2626" : "#1e293b", color: held > 0 ? "white" : "#334155" }}
            onMouseEnter={(e) => { if (held > 0) e.currentTarget.style.background = "#ef4444"; }}
            onMouseLeave={(e) => { if (held > 0) e.currentTarget.style.background = "#dc2626"; }}
          >
            <span className="text-lg">💸 팔기</span>
            <span className="text-sm font-normal opacity-80">
              {held > 0
                ? `${formatNum(sellQty)}${isStock ? "주" : "개"} · ${formatMoney(Math.round(price * sellQty))}원 받기`
                : "가진 게 없어요"}
            </span>
          </button>
          <button
            onClick={() => onTrade("buy")}
            className="flex flex-col items-center justify-center py-4 font-black text-white transition active:scale-[0.98]"
            style={{ background: "#1d4ed8" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1d4ed8")}
          >
            <span className="text-lg">🛒 사기</span>
            <span className="text-sm font-normal opacity-80">{formatMoney(orderValue)}원 내기</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

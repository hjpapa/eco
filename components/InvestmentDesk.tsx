"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { avgCost, getFeatureUnlockTurn, isFeatureUnlocked, portfolioValue, stockMetrics, STOCK_KIND_LABELS } from "@/lib/engine";
import type { AssetClass, Company, GameState, StockKind } from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { formatMoney, formatNum, changePct } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { PriceChart } from "./PriceChart";
import { ASSET_ICONS } from "@/lib/assetMap";
import { PRESET_MAP } from "@/lib/data/companyPresets";
import { CompanyMark } from "./CompanyMark";

// ── Types ──────────────────────────────────────────────────────────────────────

type Selection =
  | { kind: "stock"; id: string }
  | { kind: "asset"; id: AssetClass }
  | null;

type SortKey = "cap" | "price" | "change" | "per" | "pbr" | "roe" | "name";

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
  per: number | null;
  pbr: number | null;
  roe: number | null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function InvestmentDesk() {
  const storeGame = useGameStore((s) => s.game);
  const tradeStock = useGameStore((s) => s.tradeStock);
  const tradeAsset = useGameStore((s) => s.tradeAsset);

  const [tab, setTab] = useState<"stocks" | "assets">("stocks");
  const [sel, setSel] = useState<Selection>(null);
  const [qty, setQty] = useState(10);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "held" | "rivals">("all");
  const [sortBy, setSortBy] = useState<SortKey>("cap");
  const [sortAsc, setSortAsc] = useState(false);
  const [view, setView] = useState<"simple" | "expert">("simple");

  if (!storeGame) return null;
  const game = storeGame;
  const company = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const advancedInfoUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");
  const newsUnlocked = isFeatureUnlocked(game, "talentNewsRanking");

  const companyById = new Map(game.companies.map((c) => [c.id, c]));
  const pv = portfolioValue(company, game);

  const allListings: Listing[] = Object.values(game.stocks)
    .filter((s) => s.companyId !== company.id)
    .map((s) => {
      const c = companyById.get(s.companyId);
      const cap = s.price * s.sharesOutstanding;
      const m = stockMetrics(s, c);
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
        per: m.per,
        pbr: m.pbr,
        roe: m.roe,
      };
    });

  const q = query.trim().toLowerCase();
  const listings = allListings
    .filter((l) => {
      if (scope === "rivals" && l.external) return false;
      if (scope === "held" && (company.portfolio.stocks[l.id] ?? 0) <= 0) return false;
      if (q && !l.name.toLowerCase().includes(q) && !getIndustry(l.industryId).name.toLowerCase().includes(q))
        return false;
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case "price": diff = b.price - a.price; break;
        case "change": diff = b.change - a.change; break;
        case "name": diff = a.name.localeCompare(b.name, "ko"); break;
        case "per": diff = (a.per ?? Infinity) - (b.per ?? Infinity); break;
        case "pbr": diff = (a.pbr ?? Infinity) - (b.pbr ?? Infinity); break;
        case "roe": diff = (b.roe ?? -Infinity) - (a.roe ?? -Infinity); break;
        default: diff = b.cap - a.cap;
      }
      return sortAsc ? -diff : diff;
    });

  function toggleSort(k: SortKey) {
    if (sortBy === k) setSortAsc(!sortAsc);
    else { setSortBy(k); setSortAsc(false); }
  }

  // Top 14 by cap for ticker
  const tickerItems = [...allListings].sort((a, b) => b.cap - a.cap).slice(0, 14);

  return (
    <div
      className="overflow-hidden rounded-2xl text-white shadow-2xl"
      style={{ background: "#080e1a", border: "1px solid rgba(148,163,184,0.08)" }}
    >
      {/* ── Status bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: "#060b14", borderBottom: "1px solid rgba(148,163,184,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-xs tracking-[0.2em] text-slate-500">DRAGON MOUNTAIN MARKET</span>
        </div>
        <div className="flex items-center gap-5 font-mono text-xs">
          <span>
            <span className="text-slate-600">현금 </span>
            <span className="font-bold text-slate-200">{formatMoney(company.cash)}</span>
          </span>
          <span>
            <span className="text-slate-600">투자자산 </span>
            <span className={`font-bold ${pv > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {formatMoney(pv)}
            </span>
          </span>
        </div>
      </div>

      {/* ── Live ticker ── */}
      <TickerBar items={tickerItems} />

      {/* ── Tab bar ── */}
      <div
        className="flex gap-px px-3 pt-2"
        style={{ background: "#0a1121", borderBottom: "1px solid rgba(148,163,184,0.06)" }}
      >
        {(["stocks", "assets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSel(null); }}
            className={`rounded-t-lg px-4 py-2 text-xs font-bold transition-all ${
              tab === t
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {t === "stocks" ? "📈 주식 시장" : "💰 대체 자산"}
          </button>
        ))}
      </div>

      {tab === "stocks" ? (
        <div>
          {/* ── Portfolio ── */}
          <PortfolioBar game={game} company={company} companyById={companyById} onPick={(id) => setSel({ kind: "stock", id })} />

          <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/40 px-3 py-3">
            <div>
              <div className="text-sm font-bold text-slate-200">주식 고르기</div>
              <div className="text-xs text-slate-500">위험도를 먼저 보고 천천히 선택해 보세요.</div>
            </div>
            <div className="flex rounded-lg bg-slate-900 p-1 ring-1 ring-slate-800" role="group" aria-label="투자 화면 방식">
              <button
                type="button"
                onClick={() => setView("simple")}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${view === "simple" ? "bg-blue-600 text-white" : "text-slate-500"}`}
              >
                쉬운 보기
              </button>
              <button
                type="button"
                onClick={() => advancedInfoUnlocked && setView("expert")}
                disabled={!advancedInfoUnlocked}
                title={!advancedInfoUnlocked ? `${getFeatureUnlockTurn(game.gameLength, "visitsPartnershipsAdvanced")}분기에 열려요` : undefined}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${view === "expert" ? "bg-blue-600 text-white" : advancedInfoUnlocked ? "text-slate-500" : "cursor-not-allowed text-slate-700"}`}
              >
                {advancedInfoUnlocked ? "전문가 보기" : "🔒 전문가 보기"}
              </button>
            </div>
          </div>

          {view === "simple" ? (
            <SimpleRiskCards
              listings={allListings}
              holdings={company.portfolio.stocks}
              onPick={(id) => setSel({ kind: "stock", id })}
            />
          ) : (
            <>

          {/* ── Filter row ── */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ background: "#0a1121", borderBottom: "1px solid rgba(148,163,184,0.06)" }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔎 종목 · 업종 검색"
              className="min-w-0 flex-1 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
            {(["all", "rivals", "held"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`shrink-0 rounded px-2.5 py-1.5 text-xs font-semibold transition ${
                  scope === s
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {s === "all" ? "전체" : s === "rivals" ? "경쟁사" : "보유"}
              </button>
            ))}
          </div>

          {/* ── Stock table ── */}
          <div className="max-h-[54vh] overflow-y-auto scroll-thin">
            <table className="w-full text-xs">
              <thead
                className="sticky top-0 z-10"
                style={{ background: "#0a1121" }}
              >
                <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
                  <th className="py-2 pl-4 text-left font-medium text-slate-600">종목</th>
                  <SortTh label="현재가" k="price" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label="등락률" k="change" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label="시가총액" k="cap" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label="PER" k="per" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label="PBR" k="pbr" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label="ROE" k="roe" sort={sortBy} asc={sortAsc} onSort={toggleSort} />
                  <th className="py-2 pr-4 text-right font-medium text-slate-600">차트</th>
                </tr>
              </thead>
              <tbody>
                {listings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-700">
                      종목이 없습니다
                    </td>
                  </tr>
                )}
                {listings.map((l, idx) => {
                  const stock = game.stocks[l.id];
                  const held = company.portfolio.stocks[l.id] ?? 0;
                  const ind = getIndustry(l.industryId);
                  const up = l.change >= 0;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSel({ kind: "stock", id: l.id })}
                      className="cursor-pointer transition-colors"
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                        borderBottom: "1px solid rgba(148,163,184,0.04)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)")}
                    >
                      {/* 종목명 */}
                      <td className="py-2.5 pl-4">
                        <div className="flex items-center gap-2">
                          <CompanyMark
                            color={l.logoColor}
                            mark={PRESET_MAP[l.id]?.mark ?? ind.emoji}
                            name={l.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-200">{l.name}</div>
                            <div className="flex items-center gap-1 text-xs">
                              {!l.external && (
                                <span className="text-blue-500">경쟁</span>
                              )}
                              {l.kind && (
                                <span
                                  className={
                                    l.kind === "growth"
                                      ? "text-fuchsia-400"
                                      : l.kind === "dividend"
                                      ? "text-emerald-400"
                                      : "text-slate-500"
                                  }
                                >
                                  {STOCK_KIND_LABELS[l.kind]}
                                </span>
                              )}
                              {held > 0 && (
                                <span className="text-yellow-500">{formatNum(held)}주</span>
                              )}
                              {!held && l.external && (
                                <span className="text-slate-700">{ind.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* 현재가 */}
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-100">
                        {formatNum(Math.round(l.price))}
                      </td>
                      {/* 등락률 */}
                      <td className={`py-2.5 pr-3 text-right font-mono font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>
                        {up ? "▲" : "▼"}&thinsp;{Math.abs(l.change).toFixed(2)}%
                      </td>
                      {/* 시가총액 */}
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-600">
                        {formatMoney(l.cap)}
                      </td>
                      {/* PER */}
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-600">
                        {l.per != null ? l.per.toFixed(1) : "—"}
                      </td>
                      {/* PBR */}
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-600">
                        {l.pbr != null ? l.pbr.toFixed(2) : "—"}
                      </td>
                      {/* ROE */}
                      <td className={`py-2.5 pr-3 text-right font-mono ${l.roe != null && l.roe >= 10 ? "text-emerald-400" : "text-slate-600"}`}>
                        {l.roe != null ? l.roe.toFixed(1) + "%" : "—"}
                      </td>
                      {/* 차트 */}
                      <td className="py-2.5 pr-4">
                        <Sparkline data={stock?.history.slice(-20) ?? []} width={60} height={22} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            </>
          )}
        </div>
      ) : (
        /* ── Asset list ── */
        <div className="divide-y divide-slate-800/40">
          <div className="bg-blue-950/30 px-4 py-3 text-xs leading-relaxed text-blue-200">
            🌍 경제 지표와 연결해 보세요: 금리는 예금·채권, 물가(인플레이션)는 금,
            다른 나라 돈값(환율)은 달러 환율에 영향을 줄 수 있어요.
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
                  <div className="text-xs text-slate-600">
                    {held > 0 ? `보유 ${formatNum(held)}` : a.desc}
                  </div>
                </div>
                <Sparkline data={a.history.slice(-20)} width={60} height={22} />
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
          showMetrics={view === "expert" && advancedInfoUnlocked}
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
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">🛡️ 안정적<br /><span className="text-emerald-500/80">변화가 비교적 작아요</span></div>
        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300">⚖️ 보통<br /><span className="text-amber-500/80">수익과 위험이 중간</span></div>
        <div className="rounded-lg bg-rose-500/10 p-2 text-rose-300">🎢 도전적<br /><span className="text-rose-500/80">크게 오르내릴 수 있어요</span></div>
      </div>
      <div className="grid max-h-[54vh] gap-2 overflow-y-auto pr-1 scroll-thin sm:grid-cols-2">
        {cards.map((listing) => {
          const held = holdings[listing.id] ?? 0;
          const risk = listing.kind === "dividend"
            ? { label: "안정적", emoji: "🛡️", cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" }
            : listing.kind === "growth" || Math.abs(listing.change) >= 4
              ? { label: "도전적", emoji: "🎢", cls: "bg-rose-500/10 text-rose-300 ring-rose-500/20" }
              : { label: "보통", emoji: "⚖️", cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20" };
          const industry = getIndustry(listing.industryId);
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
                  <div className="text-xs text-slate-600">{industry.name}{held > 0 ? ` · ${formatNum(held)}주 보유` : ""}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${risk.cls}`}>
                  {risk.emoji} {risk.label}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-slate-600">한 주 가격</div>
                  <div className="font-mono text-base font-black text-white">{formatNum(Math.round(listing.price))}</div>
                </div>
                <div className={`text-sm font-bold ${listing.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {listing.change >= 0 ? "▲" : "▼"} {Math.abs(listing.change).toFixed(1)}%
                </div>
              </div>
              <div className="mt-2 text-right text-xs font-bold text-blue-400">사고팔기 →</div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-600">
        위험도는 최근 가격 변화와 종목 특징을 바탕으로 한 쉬운 안내이며, 결과를 보장하지 않아요.
      </p>
    </div>
  );
}

function TickerBar({ items }: { items: Listing[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items]; // seamless loop
  return (
    <div
      className="overflow-hidden py-1.5"
      style={{ background: "#060b14", borderBottom: "1px solid rgba(148,163,184,0.06)" }}
    >
      <div className="flex animate-ticker gap-8 whitespace-nowrap" style={{ width: "max-content" }}>
        {doubled.map((l, i) => {
          const up = l.change >= 0;
          return (
            <span key={i} className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-slate-600">{l.name}</span>
              <span className="text-slate-300">{formatNum(Math.round(l.price))}</span>
              <span className={up ? "text-emerald-400" : "text-red-400"}>
                {up ? "▲" : "▼"}{Math.abs(l.change).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
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
        className="px-4 py-3 text-xs text-slate-700"
        style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
      >
        보유 주식 없음 · 아래 종목에서 매수해 보세요
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
          <span className="font-semibold text-slate-400">내 보유 주식</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs text-slate-500"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {holdings.length}종목
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
                    {formatNum(h.shares)}주 · 평단 {formatNum(Math.round(h.avg))}
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

// ── Sort Header ────────────────────────────────────────────────────────────────

function SortTh({
  label, k, sort, asc, onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = sort === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={`cursor-pointer select-none py-2 pr-3 text-right text-xs font-medium transition-colors ${
        active ? "text-blue-400" : "text-slate-600 hover:text-slate-400"
      }`}
    >
      {label}
      {active && <span className="ml-0.5 text-[9px]">{asc ? "▲" : "▼"}</span>}
    </th>
  );
}

// ── Trade Modal ────────────────────────────────────────────────────────────────

function TradeModal({
  game,
  company,
  sel,
  qty,
  setQty,
  showMetrics,
  showNews,
  onClose,
  onTrade,
}: {
  game: GameState;
  company: Company;
  sel: NonNullable<Selection>;
  qty: number;
  setQty: (n: number) => void;
  showMetrics: boolean;
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

  const cap = isStock && stock ? stock.price * stock.sharesOutstanding : 0;
  const metrics = isStock && stock ? stockMetrics(stock, stockCompany) : null;
  const per = metrics?.per ?? null;
  const float = isStock && stock ? stock.sharesOutstanding - (stock.treasury ?? 0) : 0;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-popin overflow-hidden rounded-t-2xl sm:rounded-2xl"
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
              {isStock ? (stockCompany ? "경쟁사 상장주" : "외부 상장주") : "대체 자산"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-400"
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
            <span className="text-slate-500 text-xs font-normal">전일 대비</span>
          </div>
        </div>

        {/* ── Chart ── */}
        <PriceChart
          data={history.slice(-60)}
          color={up ? "#22c55e" : "#ef4444"}
          dark
          className="mt-3 h-28"
        />

        {/* ── Metrics ── */}
        {isStock && showMetrics && (
          <div
            style={{ borderTop: "1px solid rgba(148,163,184,0.07)", borderBottom: "1px solid rgba(148,163,184,0.07)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="grid grid-cols-4 divide-x text-center">
              <div className="px-2 py-2.5">
                <div className="text-xs text-slate-600">시가총액</div>
                <div className="font-mono text-xs font-semibold text-slate-300">{formatMoney(cap)}</div>
              </div>
              <div className="px-2 py-2.5">
                <div className="text-xs text-slate-600">PER</div>
                <div className="font-mono text-xs font-semibold text-slate-300">{per != null ? per.toFixed(1) + "배" : "—"}</div>
              </div>
              <div className="px-2 py-2.5">
                <div className="text-xs text-slate-600">PBR</div>
                <div className="font-mono text-xs font-semibold text-slate-300">{metrics?.pbr != null ? metrics.pbr.toFixed(2) + "배" : "—"}</div>
              </div>
              <div className="px-2 py-2.5">
                <div className="text-xs text-slate-600">ROE</div>
                <div className={`font-mono text-xs font-semibold ${metrics?.roe != null && metrics.roe >= 10 ? "text-emerald-400" : "text-slate-300"}`}>{metrics?.roe != null ? metrics.roe.toFixed(1) + "%" : "—"}</div>
              </div>
            </div>
            <div className="px-3 pb-2 text-center font-mono text-xs text-slate-600">
              유통주식 {formatNum(float)} / {formatNum(stock?.sharesOutstanding ?? 0)}주
              <span className="ml-1 text-slate-700">(자사주 {formatNum((stock?.treasury ?? 0))})</span>
            </div>
          </div>
        )}

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
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">관련 뉴스 · 주가 변동 이유</div>
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
                    <span className="shrink-0 text-[9px] text-slate-800">Q{n.turn}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Holdings row ── */}
        {held > 0 && (
          <div
            className="flex items-center gap-4 px-4 py-2.5 font-mono text-xs"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(148,163,184,0.05)" }}
          >
            <span>
              <span className="text-slate-600">보유 </span>
              <span className="font-bold text-white">{formatNum(held)}{isStock ? "주" : ""}</span>
            </span>
            {isStock && (
              <>
                <span>
                  <span className="text-slate-600">평단 </span>
                  <span className="font-bold text-white">{formatNum(Math.round(stockAvg))}</span>
                </span>
                <span>
                  <span className="text-slate-600">평가손익 </span>
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
                className="flex-1 rounded-lg py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
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
                className="flex-1 rounded-lg py-2 text-xs font-semibold text-yellow-500 transition"
                style={{ background: "rgba(255,255,255,0.04)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                전량
              </button>
            )}
          </div>

          {/* Qty stepper */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-slate-400 transition hover:text-slate-200"
              style={{ background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              −
            </button>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="flex-1 rounded-xl py-2.5 text-center font-mono text-2xl font-black text-white outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
            <button
              onClick={() => setQty(qty + 1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-slate-400 transition hover:text-slate-200"
              style={{ background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              +
            </button>
          </div>

          {/* Order summary */}
          <div
            className="mt-3 rounded-xl px-4 py-3 text-xs"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex justify-between">
              <span className="text-slate-600">주문 수량</span>
              <span className="font-mono font-semibold text-slate-300">
                {formatNum(qty)}{isStock ? "주" : ""}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-slate-600">예상 금액</span>
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
            <span className="text-lg tracking-widest">매 도</span>
            <span className="text-xs font-normal opacity-80">
              {held > 0
                ? `${formatNum(sellQty)}주 · ${formatMoney(Math.round(price * sellQty))}`
                : "보유 없음"}
            </span>
          </button>
          <button
            onClick={() => onTrade("buy")}
            className="flex flex-col items-center justify-center py-4 font-black text-white transition active:scale-[0.98]"
            style={{ background: "#1d4ed8" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1d4ed8")}
          >
            <span className="text-lg tracking-widest">매 수</span>
            <span className="text-xs font-normal opacity-80">{formatMoney(orderValue)} 필요</span>
          </button>
        </div>
      </div>
    </div>
  );
}

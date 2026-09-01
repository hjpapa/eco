"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import {
  getFeatureUnlockTurn,
  getCampaignOutcome,
  isFeatureUnlocked,
  netWorth,
  playerRank,
  rankings,
  LAYER_LABELS,
} from "@/lib/engine";
import type { GameState, NewsItem } from "@/lib/engine";
import type { TurnSummary } from "@/lib/engine/tick";
import { formatMoney } from "@/lib/format";
import { initAudio, isMuted, setMuted, startBgm, stopBgm } from "@/lib/audio";

import { Dashboard } from "@/components/Dashboard";
import { CompanyCity } from "@/components/CompanyCity";
import { CompanyPanel } from "@/components/CompanyPanel";
import { InvestmentDesk } from "@/components/InvestmentDesk";
import { TalentMarket } from "@/components/TalentMarket";
import { NewsFeed } from "@/components/NewsFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { EconomyIndicators } from "@/components/EconomyIndicators";
import { Secretary } from "@/components/Secretary";
import { CompanyStatusCard } from "@/components/CompanyStatusCard";
import { WorldMap } from "@/components/WorldMap";
import { CampusStrip } from "@/components/CampusStrip";
import { Tutorial } from "@/components/Tutorial";
import { RESULT_ICONS, BANNER_IMGS } from "@/lib/assetMap";
import { hasSeenLearningIntro } from "@/lib/learning";

type Tab = "home" | "company" | "invest" | "talent" | "more";
type MorePage = "news" | "rank" | "visit";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "home", label: "홈", emoji: "🏠" },
  { id: "company", label: "회사", emoji: "🏙️" },
  { id: "invest", label: "투자", emoji: "📈" },
  { id: "talent", label: "인재", emoji: "👔" },
  { id: "more", label: "더보기", emoji: "•••" },
];

export default function PlayPage() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const next = useGameStore((s) => s.next);
  const toast = useGameStore((s) => s.toast);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const loadSave = useGameStore((s) => s.loadSave);
  const acknowledgeLearningIntro = useGameStore((s) => s.acknowledgeLearningIntro);

  const [tab, setTab] = useState<Tab>("home");
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [eventPopup, setEventPopup] = useState<NewsItem[] | null>(null);
  const [resultsPopup, setResultsPopup] = useState<{ summary: TurnSummary; prevNw: number } | null>(null);
  const [showLearningChoice, setShowLearningChoice] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const lockUntil = useRef(0);

  // Advance one quarter. Guards against (a) rapid double-clicks force-skipping
  // multiple turns and (b) skipping past an unacknowledged event popup.
  const handleNext = () => {
    if (eventPopup || resultsPopup || showLearningChoice) return; // must acknowledge popups first
    const now = Date.now();
    if (now < lockUntil.current) return; // debounce accidental multi-advance
    lockUntil.current = now + 400;
    // Record net worth before advancing so we can show the delta.
    const prevGame = useGameStore.getState().game;
    const prevPlayer = prevGame?.companies.find((c) => c.id === prevGame.playerCompanyId);
    const prevNw = prevPlayer && prevGame ? netWorth(prevPlayer, prevGame) : 0;
    next();
    const summary = useGameStore.getState().lastSummary;
    if (summary?.playerResult) setResultsPopup({ summary, prevNw });
    else {
      const events = summary?.events ?? [];
      if (events.length > 0) setEventPopup(events);
    }
  };

  const handleResultsDismiss = () => {
    const events = resultsPopup?.summary.events ?? [];
    setResultsPopup(null);
    if (events.length > 0) setEventPopup(events);
  };

  // Hydrate from save if the store is empty (e.g. page refresh).
  useEffect(() => {
    initAudio();
    setMutedState(isMuted());
    if (!useGameStore.getState().game) {
      if (!loadSave()) {
        router.replace("/");
        return;
      }
    }
    setReady(true);
    // Offer the choice once for every newly-created game. A legacy tutorial or
    // a course completed in another game must not silently skip this game's
    // first-entry choice.
    const activeGame = useGameStore.getState().game;
    if (activeGame && !hasSeenLearningIntro(activeGame.createdAt)) setShowLearningChoice(true);
    if (new URLSearchParams(window.location.search).get("guide") === "1") setShowSpotlight(true);
  }, [loadSave, router]);

  // BGM follows market mood.
  useEffect(() => {
    if (!game || muted) {
      stopBgm();
      return;
    }
    const mood = game.macro.sentiment > 0.25 ? "bright" : game.macro.sentiment < -0.25 ? "tense" : "neutral";
    startBgm(mood);
    return () => stopBgm();
  }, [game?.macro.phase, muted, game]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 2200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!ready || !game) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">불러오는 중…</div>;
  }

  const player = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const nw = netWorth(player, game);
  const rank = playerRank(game);
  const ended = game.status === "ended";
  const buildingsUnlocked = isFeatureUnlocked(game, "buildingsResearch");
  const investmentUnlocked = isFeatureUnlocked(game, "investment");
  const talentUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const visitUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
  };

  const goVisit = (companyId: string) => {
    setVisitId(companyId);
    setMorePage("visit");
    setTab("more");
  };

  const chooseLearningStart = (choice: "practice" | "play") => {
    acknowledgeLearningIntro();
    setShowLearningChoice(false);
    if (choice === "practice") router.push("/learn?practice=basics&return=/play");
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Author bar */}
      <div className="w-full bg-slate-800 py-1 text-center text-xs text-slate-400">
        드래곤 마운틴 시티 · 제작 <span className="font-semibold text-slate-200">hjpapa</span>
      </div>
      {/* Top bar */}
      <header className="sticky top-0 z-30 overflow-hidden bg-white/90 shadow-sm backdrop-blur">
        <CampusStrip buildings={player.buildings} className="absolute inset-x-0 bottom-0 h-12" opacity={0.07} />
        <div className="relative mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg" style={{ background: player.logoColor }} />
            <div className="leading-tight">
              <div className="text-sm font-black text-slate-800">{player.name}</div>
              <div className="text-xs text-slate-500">
                {game.turn}/{game.maxTurns}분기 · {talentUnlocked ? `${rank}위` : "순위 잠김"}
              </div>
            </div>
          </div>
          <div className="ml-auto hidden text-right sm:block">
            <div className="text-xs text-slate-500">내 총재산(순자산)</div>
            <div className="text-sm font-black text-slate-800">{formatMoney(nw)}</div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-xs text-slate-500">현금</div>
            <div className="text-sm font-bold text-bull">{formatMoney(player.cash)}</div>
          </div>
          <Link
            href="/learn?return=/play"
            className="btn-ghost whitespace-nowrap !px-2.5 !py-2 text-xs sm:text-sm"
          >
            📘 배우기
          </Link>
          <button onClick={toggleMute} className="hidden btn-ghost !px-2.5 !py-2 sm:block" title="소리">
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            id="btn-next-turn"
            onClick={handleNext}
            disabled={ended || !!eventPopup || !!resultsPopup || showLearningChoice}
            className="btn-primary whitespace-nowrap !px-3"
          >
            {ended ? "게임 종료" : <><span className="hidden sm:inline">다음 분기 </span>▶</>}
          </button>
        </div>

        {/* Tabs */}
        <nav className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 pb-2" aria-label="게임 메뉴">
          {TABS.map((t) => {
            const locked = (t.id === "invest" && !investmentUnlocked) || (t.id === "talent" && !talentUnlocked);
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                onClick={() => {
                  if (locked) return;
                  setTab(t.id);
                  if (t.id !== "more") setMorePage(null);
                }}
                disabled={locked}
                className={`rounded-lg px-1 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                  tab === t.id
                    ? "bg-brand-600 text-white"
                    : locked
                      ? "cursor-not-allowed text-slate-300"
                      : "text-slate-600 hover:bg-slate-100"
                }`}
                title={locked ? `${getFeatureUnlockTurn(game.gameLength, t.id === "invest" ? "investment" : "talentNewsRanking")}분기에 열려요` : undefined}
              >
                <span aria-hidden>{locked ? "🔒" : t.emoji}</span>{" "}{t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Body */}
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {tab === "home" && <Dashboard game={game} />}
          {tab === "company" && (
            <div className="space-y-4">
              <CompanyPanel game={game} company={player} />
              {buildingsUnlocked ? (
                <details className="card group p-4">
                  <summary className="cursor-pointer list-none text-base font-bold text-slate-800">
                    <span className="inline-flex items-center gap-2">🏙️ 더 많은 활동: 건물과 연구</span>
                    <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="mt-3">
                    <CompanyCity game={game} company={player} />
                  </div>
                </details>
              ) : (
                <FeatureLockCard
                  emoji="🏗️"
                  title="건물과 연구는 곧 열려요"
                  turn={getFeatureUnlockTurn(game.gameLength, "buildingsResearch")}
                />
              )}
            </div>
          )}
          {tab === "invest" && <InvestmentDesk />}
          {tab === "talent" && <TalentMarket game={game} company={player} />}
          {tab === "more" && (
            <MoreHub
              game={game}
              page={morePage}
              onPage={setMorePage}
              onVisit={goVisit}
              visitId={visitId}
              talentUnlocked={talentUnlocked}
              visitUnlocked={visitUnlocked}
            />
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <EconomyIndicators game={game} />
          <details className="card group p-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-700">
              📋 회사 요약 더보기
              <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4 space-y-4">
              <Secretary game={game} />
              <CompanyStatusCard game={game} company={player} />
            </div>
          </details>
        </aside>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-popin">
          <div
            className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg ${
              toast.tone === "good" ? "bg-bull" : toast.tone === "bad" ? "bg-bear" : "bg-slate-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* Quarterly results popup */}
      {resultsPopup && (
        <ResultsPopup
          game={game}
          summary={resultsPopup.summary}
          prevNw={resultsPopup.prevNw}
          onClose={handleResultsDismiss}
        />
      )}

      {/* Event popup */}
      {eventPopup && (
        <EventPopup events={eventPopup} onClose={() => setEventPopup(null)} />
      )}

      {/* Game over overlay */}
      {ended && <GameOver game={game} onRestart={() => router.push("/")} />}

      {showLearningChoice && (
        <LearningChoice onChoose={chooseLearningStart} />
      )}

      {showSpotlight && !showLearningChoice && (
        <Tutorial onClose={() => setShowSpotlight(false)} />
      )}
    </div>
  );
}

function FeatureLockCard({ emoji, title, turn }: { emoji: string; title: string; turn: number }) {
  return (
    <div className="card p-5 text-center ring-1 ring-amber-200">
      <div className="text-3xl" aria-hidden>{emoji}</div>
      <div className="mt-2 font-bold text-slate-800">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{turn}분기에 자동으로 열립니다. 지금은 기본 운영에 집중해 보세요.</p>
    </div>
  );
}

function MoreHub({
  game,
  page,
  onPage,
  onVisit,
  visitId,
  talentUnlocked,
  visitUnlocked,
}: {
  game: GameState;
  page: MorePage | null;
  onPage: (page: MorePage | null) => void;
  onVisit: (companyId: string) => void;
  visitId: string | null;
  talentUnlocked: boolean;
  visitUnlocked: boolean;
}) {
  if (page) {
    return (
      <div className="space-y-3">
        <button className="btn-ghost" onClick={() => onPage(null)}>
          ← 더보기 메뉴
        </button>
        {page === "news" && talentUnlocked && <NewsFeed game={game} />}
        {page === "rank" && talentUnlocked && <Leaderboard game={game} onVisit={onVisit} canVisit={visitUnlocked} />}
        {page === "visit" && visitUnlocked && <WorldMap game={game} initialCompanyId={visitId} />}
      </div>
    );
  }

  const items: Array<{
    id: MorePage;
    emoji: string;
    label: string;
    desc: string;
    unlocked: boolean;
    unlockTurn: number;
  }> = [
    {
      id: "news",
      emoji: "📰",
      label: "뉴스",
      desc: "시장과 회사에 생긴 일을 쉬운 말로 확인해요.",
      unlocked: talentUnlocked,
      unlockTurn: getFeatureUnlockTurn(game.gameLength, "talentNewsRanking"),
    },
    {
      id: "rank",
      emoji: "🏆",
      label: "순위",
      desc: "상위 5개 회사와 내 위치를 비교해요.",
      unlocked: talentUnlocked,
      unlockTurn: getFeatureUnlockTurn(game.gameLength, "talentNewsRanking"),
    },
    {
      id: "visit",
      emoji: "🌍",
      label: "방문·제휴",
      desc: "다른 회사를 살펴보고 함께할 기회를 찾아요.",
      unlocked: visitUnlocked,
      unlockTurn: getFeatureUnlockTurn(game.gameLength, "visitsPartnershipsAdvanced"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-xl font-black text-slate-800">더보기</h2>
        <p className="mt-1 text-sm text-slate-500">뉴스, 순위, 다른 회사 방문을 여기서 열 수 있어요.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.unlocked}
            onClick={() => onPage(item.id)}
            className={`card p-5 text-left transition ${
              item.unlocked
                ? "hover:-translate-y-0.5 hover:ring-2 hover:ring-brand-300"
                : "cursor-not-allowed opacity-65"
            }`}
          >
            <div className="text-3xl" aria-hidden>{item.unlocked ? item.emoji : "🔒"}</div>
            <div className="mt-2 font-black text-slate-800">{item.label}</div>
            <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            <div className={`mt-3 text-xs font-bold ${item.unlocked ? "text-brand-600" : "text-amber-600"}`}>
              {item.unlocked ? "열기 →" : `${item.unlockTurn}분기에 열려요`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LearningChoice({ onChoose }: { onChoose: (choice: "practice" | "play") => void }) {
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="learning-choice-title" onKeyDown={trapFocus}>
      <div className="card w-full max-w-md animate-popin p-6 text-center">
        <div className="text-5xl" aria-hidden>🎓</div>
        <h2 id="learning-choice-title" className="mt-3 text-xl font-black text-slate-800">처음 오셨나요?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          실제 게임과 저장에 영향을 주지 않는 연습장에서 가격과 생산을 2분 동안 익힐 수 있어요.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button autoFocus className="btn-primary" onClick={() => onChoose("practice")}>
            📘 2분 기초 연습
          </button>
          <button className="btn-ghost" onClick={() => onChoose("play")}>
            바로 시작 ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsPopup({
  game,
  summary,
  prevNw,
  onClose,
}: {
  game: ReturnType<typeof useGameStore.getState>["game"] & object;
  summary: TurnSummary;
  prevNw: number;
  onClose: () => void;
}) {
  if (!game) return null;
  const r = summary.playerResult!;
  const player = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const nw = netWorth(player, game);
  const nwDelta = nw - prevNw;
  const rank = playerRank(game);
  const rankingUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const stock = game.stocks[player.id];
  const stockChange = stock
    ? ((stock.price - (stock.history[stock.history.length - 2] ?? stock.price)) /
        (stock.history[stock.history.length - 2] ?? stock.price)) *
      100
    : 0;

  const rows: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[] = [
    { label: "매출", value: formatMoney(r.revenue), tone: r.revenue > 0 ? "good" : "neutral" },
    { label: "판매량", value: `${r.unitsSold.toLocaleString()}개`, tone: "neutral" },
    {
      label: "영업 이익",
      value: `${r.profit >= 0 ? "+" : ""}${formatMoney(r.profit)}`,
      tone: r.profit >= 0 ? "good" : "bad",
    },
    {
      label: "순자산 변동",
      value: `${nwDelta >= 0 ? "+" : ""}${formatMoney(Math.round(nwDelta))}`,
      tone: nwDelta >= 0 ? "good" : "bad",
    },
    { label: "현재 순자산", value: formatMoney(Math.round(nw)), tone: "neutral" },
    {
      label: "현재 순위",
      value: rankingUnlocked ? `${rank}위 / ${game.companies.length}` : "🔒 아직 비공개",
      tone: rankingUnlocked && rank <= 3 ? "good" : "neutral",
    },
    {
      label: "자사 주가",
      value: stock ? `${stock.price.toFixed(0)} (${stockChange >= 0 ? "+" : ""}${stockChange.toFixed(1)}%)` : "—",
      tone: stockChange >= 0 ? "good" : "bad",
    },
  ];
  if (r.quitCount > 0) {
    rows.push({ label: "퇴사 직원", value: `${r.quitCount}명`, tone: "bad" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-sm animate-popin overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with banner */}
        <div className="relative overflow-hidden">
          <img src={BANNER_IMGS.report} alt="" className="w-full object-cover" style={{ maxHeight: 110 }} />
          <div className="absolute inset-0 flex items-end bg-black/30 px-5 pb-3">
            <div className="text-white drop-shadow">
              <div className="text-xs opacity-80">{game.turn}분기 실적 보고</div>
              <div className="text-base font-black">{player.name}</div>
            </div>
            <div className={`ml-auto text-sm font-bold drop-shadow ${r.profit >= 0 ? "text-emerald-200" : "text-red-200"}`}>
              {r.profit >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(r.profit))}
            </div>
          </div>
        </div>

        {/* Results grid */}
        <div className="divide-y divide-slate-100 px-5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span
                className={`text-sm font-bold ${
                  row.tone === "good"
                    ? "text-emerald-600"
                    : row.tone === "bad"
                    ? "text-red-500"
                    : "text-slate-800"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 pt-2">
          <button
            className="btn-primary w-full"
            onClick={onClose}
          >
            확인 {summary.events.length > 0 ? `(뉴스 ${summary.events.length}건 ▶)` : "▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TONE_STYLE: Record<NewsItem["tone"], { ring: string; chip: string; label: string }> = {
  positive: { ring: "ring-bull/40", chip: "bg-bull/10 text-bull", label: "호재" },
  negative: { ring: "ring-bear/40", chip: "bg-bear/10 text-bear", label: "악재" },
  neutral: { ring: "ring-slate-200", chip: "bg-slate-100 text-slate-500", label: "중립" },
};

function EventPopup({ events, onClose }: { events: NewsItem[]; onClose: () => void }) {
  const tone: "positive" | "negative" | "neutral" = events.some((e) => e.tone === "positive")
    ? "positive"
    : events.some((e) => e.tone === "negative")
    ? "negative"
    : "neutral";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md animate-popin overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner header */}
        <div className="relative overflow-hidden">
          <img src={BANNER_IMGS[tone]} alt="" className="w-full object-cover" style={{ maxHeight: 100 }} />
          <div className="absolute inset-0 flex items-end bg-black/25 px-4 pb-2.5">
            <h2 className="text-base font-black text-white drop-shadow">
              이번 분기 속보 {events.length > 1 ? `(${events.length})` : ""}
            </h2>
          </div>
        </div>
        <div className="p-5">
        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto scroll-thin">
          {events.map((ev) => {
            const tone = TONE_STYLE[ev.tone];
            return (
              <div key={ev.id} className={`rounded-xl bg-white p-3 ring-1 ${tone.ring}`}>
                <div className="flex items-start gap-2.5">
                  {ev.portrait ? (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-4xl shadow-inner">
                      {ev.portrait}
                    </span>
                  ) : (
                    <span className="text-2xl leading-none">{ev.emoji}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      <span className={`pill text-xs ${tone.chip}`}>{tone.label}</span>
                      <span className="pill bg-slate-100 text-xs text-slate-500">
                        {LAYER_LABELS[ev.layer]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-slate-600">{ev.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-primary mt-4 w-full" onClick={onClose}>
          확인하고 계속 ▶
        </button>
        </div>
      </div>
    </div>
  );
}

function GameOver({ game, onRestart }: { game: ReturnType<typeof useGameStore.getState>["game"] & object; onRestart: () => void }) {
  if (!game) return null;
  const board = rankings(game);
  const outcome = getCampaignOutcome(game);
  const rank = outcome.finalRank;
  const won = outcome.isChampion;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[92vh] w-full max-w-lg animate-popin overflow-y-auto p-6 text-center">
        <Image
          src={won ? RESULT_ICONS.win : RESULT_ICONS.end}
          alt={won ? "우승을 축하하는 드래곤" : "게임 결과를 안내하는 드래곤"}
          width={144}
          height={144}
          className="mx-auto h-36 w-36 object-contain"
        />
        <h2 className="mt-3 text-2xl font-black text-slate-800">
          {won ? "축하합니다! 1위 달성!" : "게임 종료"}
        </h2>
        <p className="mt-1 text-slate-500">{game.maxTurns}분기 경영 결과, {rank}위로 마쳤어요.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          {outcome.badges.map((badge) => {
            const progress = badge.id === "rankClimber"
              ? `${outcome.initialRank}위 → ${outcome.finalRank}위`
              : badge.id === "wealthBuilder"
                ? `${outcome.netWorthGrowth >= 0 ? "+" : ""}${formatMoney(outcome.netWorthGrowth)}`
                : badge.description;
            return (
              <div
                key={badge.id}
                className={`rounded-xl p-3 ring-1 ${
                  badge.earned ? "bg-amber-50 ring-amber-200" : "bg-slate-50 opacity-55 ring-slate-200"
                }`}
              >
                <div className="text-lg" aria-hidden>{badge.earned ? badge.emoji : "🔒"}</div>
                <div className="text-xs font-black text-slate-800">{badge.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{progress}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 text-left">
          {board.slice(0, 5).map((e, i) => (
            <div
              key={e.companyId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                e.isPlayer ? "bg-brand-50 font-bold" : "bg-slate-50"
              }`}
            >
              <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}`} {e.name}</span>
              <span className="text-slate-700">{formatMoney(e.netWorth)}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-5 w-full" onClick={onRestart}>
          새 게임 하기
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import {
  getFeatureUnlockTurn,
  getCampaignOutcome,
  isFeatureUnlocked,
  netWorth,
  playerRank,
  productionCapacity,
  rankings,
  LAYER_LABELS,
} from "@/lib/engine";
import type { GameState, NewsItem } from "@/lib/engine";
import type { TurnSummary } from "@/lib/engine/tick";
import { formatMoney, withJosa } from "@/lib/format";
import { initAudio, isMuted, setMuted, startBgm, stopBgm } from "@/lib/audio";
import {
  captureTurnSnapshot,
  compareTurnRankings,
  evaluateSnapshotMissions,
  getEconomyWeather,
  getTurnHighlights,
  type MissionDestination,
  type TurnPresentationSnapshot,
} from "@/lib/ui/gameExperience";

import { CompanyCity } from "@/components/CompanyCity";
import { CompanyWorkspace } from "@/components/CompanyWorkspace";
import { InvestmentDesk } from "@/components/InvestmentDesk";
import { TalentMarket } from "@/components/TalentMarket";
import { NewsFeed } from "@/components/NewsFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { EconomyIndicators } from "@/components/EconomyIndicators";
import { Secretary } from "@/components/Secretary";
import { CompanyStatusCard } from "@/components/CompanyStatusCard";
import { WorldMap } from "@/components/WorldMap";
import { Tutorial } from "@/components/Tutorial";
import { GameHud } from "@/components/GameHud";
import { RESULT_ICONS, BANNER_IMGS } from "@/lib/assetMap";
import { hasSeenLearningIntro } from "@/lib/learning";

type Tab = "home" | "company" | "invest" | "talent" | "more";
type MorePage = "news" | "rank" | "visit";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "company", label: "우리 회사", emoji: "🏙️" },
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

  const [tab, setTab] = useState<Tab>("company");
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [eventPopup, setEventPopup] = useState<NewsItem[] | null>(null);
  const [resultsPopup, setResultsPopup] = useState<{ summary: TurnSummary; snapshot: TurnPresentationSnapshot } | null>(null);
  const [showLearningChoice, setShowLearningChoice] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  // Bumped once the turn popups close, so the campus can show what each
  // building did this turn.
  const [workReportKey, setWorkReportKey] = useState(0);
  const lockUntil = useRef(0);
  // Campus size when the current turn began, so the result can show what the
  // buildings placed during this turn changed.
  const turnStartCampus = useRef<{ buildingCount: number; capacity: number } | null>(null);
  const nextTurnButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Advance one turn (quarter). Guards against rapid double-clicks force-skipping
  // multiple turns and (b) skipping past an unacknowledged event popup.
  const handleNext = () => {
    if (eventPopup || resultsPopup || showLearningChoice) return; // must acknowledge popups first
    const now = Date.now();
    if (now < lockUntil.current) return; // debounce accidental multi-advance
    lockUntil.current = now + 400;
    const prevGame = useGameStore.getState().game;
    if (!prevGame) return;
    // The engine mutates the current game object. Capture primitive presentation
    // values before advancing so rank, inventory and missions remain truthful.
    const captured = captureTurnSnapshot(prevGame);
    const snapshot = { ...captured, ...(turnStartCampus.current ?? {}) };
    next();
    const afterGame = useGameStore.getState().game;
    if (afterGame) turnStartCampus.current = campusSize(afterGame);
    const summary = useGameStore.getState().lastSummary;
    if (summary?.playerResult) setResultsPopup({ summary, snapshot });
    else {
      const events = summary?.events ?? [];
      if (events.length > 0) setEventPopup(events);
    }
  };

  const handleResultsDismiss = () => {
    const events = resultsPopup?.summary.events ?? [];
    setResultsPopup(null);
    if (events.length > 0) setEventPopup(events);
    else {
      setWorkReportKey(Date.now());
      requestAnimationFrame(() => nextTurnButtonRef.current?.focus({ preventScroll: true }));
    }
  };

  const handleEventsDismiss = () => {
    setEventPopup(null);
    setWorkReportKey(Date.now());
    requestAnimationFrame(() => nextTurnButtonRef.current?.focus({ preventScroll: true }));
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
    const loadedGame = useGameStore.getState().game;
    if (loadedGame) turnStartCampus.current = campusSize(loadedGame);
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

  // Publish the sticky header height (--hud-h) so the company panel can stick
  // right below it on tablets.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--hud-h", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, [ready]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 3200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!ready || !game) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">불러오는 중…</div>;
  }

  const player = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const nw = netWorth(player, game);
  const rank = playerRank(game);
  const ended = game.status === "ended";
  const buildingsUnlocked = isFeatureUnlocked(game, "research");
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

  const navigateFromMission = (destination: MissionDestination) => {
    setTab(destination);
    if (destination !== "more") setMorePage(null);
  };

  const chooseLearningStart = (choice: "practice" | "play") => {
    acknowledgeLearningIntro();
    setShowLearningChoice(false);
    if (choice === "practice") router.push("/learn?practice=basics&return=/play");
  };

  return (
    <div className={`game-shell game-shell--${game.macro.phase} min-h-screen pb-4`}>
      <div className={`economic-ambience economic-ambience--${getEconomyWeather(game.macro.phase).scene}`} aria-hidden>
        <span className="economic-orb" />
        <span className="economic-cloud economic-cloud--one" />
        <span className="economic-cloud economic-cloud--two" />
      </div>
      {/* Top bar */}
      <header ref={headerRef} className="sticky top-0 z-30 overflow-hidden border-b border-white/60 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
        <GameHud
          game={game}
          player={player}
          netWorthValue={nw}
          rank={rank}
          rankingUnlocked={talentUnlocked}
          muted={muted}
          nextDisabled={ended || !!eventPopup || !!resultsPopup || showLearningChoice}
          nextButtonRef={nextTurnButtonRef}
          onToggleMute={toggleMute}
          onNext={handleNext}
        />

        {/* Tabs */}
        <nav className="mx-auto grid max-w-7xl grid-cols-4 gap-1.5 px-2 pb-2" aria-label="게임 메뉴">
          {TABS.map((t) => {
            const locked = (t.id === "invest" && !investmentUnlocked) || (t.id === "talent" && !talentUnlocked);
            const unlockTurn = getFeatureUnlockTurn(game.gameLength, t.id === "invest" ? "investment" : "talentNewsRanking");
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                onClick={() => {
                  if (locked) {
                    useGameStore.setState({ toast: { text: `🔒 ${t.label}은 ${unlockTurn}턴에 열려요! 조금만 기다려요.`, tone: "info" } });
                    return;
                  }
                  setTab(t.id);
                  if (t.id !== "more") setMorePage(null);
                }}
                aria-disabled={locked}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-3 sm:text-base ${
                  tab === t.id
                    ? "bg-brand-600 text-white shadow"
                    : locked
                      ? "bg-slate-50 text-slate-400"
                      : "bg-slate-100/80 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span aria-hidden>{locked ? "🔒" : t.emoji}</span>
                <span>{t.label}</span>
                {locked && <span className="hidden rounded-full bg-white px-1.5 text-xs font-bold text-slate-400 sm:inline">{unlockTurn}턴</span>}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Body */}
      <main className={`relative z-10 mx-auto grid gap-4 px-3 py-4 sm:px-4 ${tab === "company" || tab === "home" ? "max-w-[1600px]" : "max-w-6xl xl:grid-cols-[1fr_320px]"}`}>
        <div className="min-w-0">
          {(tab === "home" || tab === "company") && <CompanyWorkspace game={game} company={player} onNavigate={navigateFromMission} workReportKey={workReportKey} />}
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
        {tab !== "home" && tab !== "company" && <aside className="side-sticky space-y-4">
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
        </aside>}
      </main>

      {/* Credit: at the bottom so the sticky HUD starts at the very top on tablets. */}
      <footer className="relative z-10 pb-2 text-center text-xs text-slate-400">
        드래곤 마운틴 시티 · 제작 <span className="font-semibold text-slate-600">hjpapa</span>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-popin">
          <div
            className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg ${
              toast.tone === "good" ? "bg-bull" : toast.tone === "bad" ? "bg-bear" : "bg-slate-700"
            }`}
            role="status"
            aria-live="polite"
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
          snapshot={resultsPopup.snapshot}
          onClose={handleResultsDismiss}
        />
      )}

      {/* Event popup */}
      {eventPopup && (
        <EventPopup events={eventPopup} onClose={handleEventsDismiss} />
      )}

      {/* Game over overlay */}
      {ended && !resultsPopup && !eventPopup && <GameOver game={game} onRestart={() => router.push("/")} />}

      {showLearningChoice && (
        <LearningChoice onChoose={chooseLearningStart} />
      )}

      {showSpotlight && !showLearningChoice && (
        <Tutorial onClose={() => setShowSpotlight(false)} />
      )}
    </div>
  );
}

function campusSize(game: GameState) {
  const player = game.companies.find((c) => c.id === game.playerCompanyId)!;
  return { buildingCount: player.buildings.length, capacity: productionCapacity(player, game.config) };
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
      desc: "1~5등 회사와 우리 회사를 비교해요.",
      unlocked: talentUnlocked,
      unlockTurn: getFeatureUnlockTurn(game.gameLength, "talentNewsRanking"),
    },
    {
      id: "visit",
      emoji: "🌍",
      label: "다른 회사 구경",
      desc: "다른 회사를 둘러보고 함께 일할 기회를 찾아요.",
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
              {item.unlocked ? "열기 →" : `${item.unlockTurn}턴에 열려요`}
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
  snapshot,
  onClose,
}: {
  game: ReturnType<typeof useGameStore.getState>["game"] & object;
  summary: TurnSummary;
  snapshot: TurnPresentationSnapshot;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  if (!game) return null;
  const r = summary.playerResult!;
  const player = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const nw = netWorth(player, game);
  const nwDelta = nw - snapshot.netWorth;
  const cashDelta = player.cash - snapshot.cash;
  const rank = playerRank(game);
  const rankingUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const highlights = getTurnHighlights(game, summary, snapshot);
  const missionResults = evaluateSnapshotMissions(game, snapshot);
  const completedMissions = missionResults.filter((mission) => mission.done).length;
  const rankingChange = compareTurnRankings(snapshot, game);
  const stock = game.stocks[player.id];
  const stockChange = stock
    ? ((stock.price - (stock.history[stock.history.length - 2] ?? stock.price)) /
        (stock.history[stock.history.length - 2] ?? stock.price)) *
      100
    : 0;

  const rows: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[] = [
    { label: "번 돈(매출)", value: formatMoney(r.revenue), tone: r.revenue > 0 ? "good" : "neutral" },
    { label: "판 개수", value: `${r.unitsSold.toLocaleString()}개`, tone: "neutral" },
    {
      label: "남은 돈(이익)",
      value: `${r.profit >= 0 ? "+" : ""}${formatMoney(r.profit)}`,
      tone: r.profit >= 0 ? "good" : "bad",
    },
    {
      label: "회사 전체 재산 변화",
      value: `${nwDelta >= 0 ? "+" : ""}${formatMoney(Math.round(nwDelta))}`,
      tone: nwDelta >= 0 ? "good" : "bad",
    },
    {
      label: "쓸 수 있는 돈 변화",
      value: `${cashDelta >= 0 ? "+" : ""}${formatMoney(Math.round(cashDelta))}`,
      tone: cashDelta >= 0 ? "good" : "bad",
    },
    { label: "창고에 남은 물건(재고)", value: `${Math.round(player.inventory).toLocaleString()}개`, tone: player.inventory <= snapshot.inventory ? "good" : "neutral" },
    { label: "회사 전체 재산(순자산)", value: formatMoney(Math.round(nw)), tone: "neutral" },
    {
      label: "지금 순위",
      value: rankingUnlocked ? `${rank}위 / ${game.companies.length}` : "🔒 아직 비공개",
      tone: rankingUnlocked && rank <= 3 ? "good" : "neutral",
    },
    {
      label: "우리 회사 주식 값",
      value: stock ? `${stock.price.toFixed(0)} (${stockChange >= 0 ? "+" : ""}${stockChange.toFixed(1)}%)` : "—",
      tone: stockChange >= 0 ? "good" : "bad",
    },
  ];
  if (r.quitCount > 0) {
    rows.push({ label: "회사를 떠난 직원", value: `${r.quitCount}명`, tone: "bad" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="card max-h-[94vh] w-full max-w-lg animate-popin overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="turn-result-title"
      >
        <section className={`result-story result-story--${r.profit >= 0 ? "win" : "challenge"} relative overflow-hidden px-5 pb-5 pt-4 text-white`}>
          <span className="result-spark result-spark--one" aria-hidden>✦</span>
          <span className="result-spark result-spark--two" aria-hidden>●</span>
          <span className="result-spark result-spark--three" aria-hidden>✦</span>
          <div className="relative z-10 flex items-center gap-3">
            <div className="result-dragon relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/30">
              <Image src={RESULT_ICONS.end} alt="결과를 설명하는 드래곤" fill sizes="80px" className="object-contain object-top" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white/75">{game.turn}턴 모험 결과</div>
              <h2 id="turn-result-title" className="mt-0.5 text-xl font-black">
                {r.profit > 0 ? "회사가 이익을 남겼어요!" : r.profit === 0 ? "딱 맞게 운영했어요" : "새 전략을 찾을 단서예요"}
              </h2>
              <div className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-black ${r.profit >= 0 ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>
                {r.profit >= 0 ? "+" : "−"}{formatMoney(Math.abs(r.profit))}
              </div>
            </div>
          </div>
        </section>

        <div className="p-5">
          <section aria-labelledby="turn-flow-title">
            <h3 id="turn-flow-title" className="text-base font-black text-slate-800">물건과 돈은 이렇게 움직였어요</h3>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              <ResultStep emoji="🏭" label="만든 개수" value={`${r.unitsProduced.toLocaleString()}개`} />
              <ResultStep emoji="🛍️" label="판 개수" value={`${r.unitsSold.toLocaleString()}개`} />
              <ResultStep emoji="💰" label="번 돈(매출)" value={formatMoney(r.revenue)} />
              <ResultStep emoji={r.profit >= 0 ? "🪙" : "🧾"} label="남은 돈(이익)" value={`${r.profit >= 0 ? "+" : "−"}${formatMoney(Math.abs(r.profit))}`} tone={r.profit >= 0 ? "good" : "bad"} />
            </div>
            <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm leading-relaxed text-blue-950">
              {snapshot.productionTarget.toLocaleString()}개 만들기로 했고, {r.unitsSold.toLocaleString()}개가 팔렸어요.
              {" "}창고에는 {Math.round(player.inventory).toLocaleString()}개가 남았어요.
              {!!snapshot.productPrices?.length && <> 판 가격: {snapshot.productPrices.map((price) => `${formatMoney(price)}원`).join(" / ")}</>}
            </p>
          </section>

          {rankingUnlocked && !snapshot.rankingUnlocked && (
            <div className="rank-movement mt-4 flex items-center gap-3 rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200" role="status">
              <span className="text-3xl" aria-hidden>🏆</span>
              <div>
                <div className="font-black text-slate-900">회사 순위가 열렸어요!</div>
                <div className="text-xs text-slate-600">현재 <b>{rank}위</b>예요. 이제 앞뒤 라이벌과 실시간으로 겨뤄 보세요.</div>
              </div>
            </div>
          )}

          {rankingChange.visible && rankingChange.rankGain !== 0 && (
            <div className={`rank-movement mt-4 flex items-center gap-3 rounded-2xl p-3 ring-1 ${rankingChange.rankGain > 0 ? "bg-violet-50 ring-violet-200" : "bg-amber-50 ring-amber-200"}`} role="status">
              <span className="text-3xl" aria-hidden>{rankingChange.rankGain > 0 ? "⚔️" : "🔥"}</span>
              <div>
                <div className="font-black text-slate-900">{rankingChange.rankGain > 0 ? "라이벌 추월!" : "라이벌의 역습!"}</div>
                <div className="text-xs text-slate-600">
                  {rankingChange.beforeRank}위 → <b>{rankingChange.afterRank}위</b>
                  {rankingChange.rankGain > 0 && rankingChange.overtaken.length > 0 ? ` · ${withJosa(rankingChange.overtaken.map((item) => item.name).join("·"), "을", "를")} 앞질렀어요.` : null}
                  {rankingChange.rankGain < 0 && rankingChange.passedBy.length > 0 ? ` · ${withJosa(rankingChange.passedBy.map((item) => item.name).join("·"), "이", "가")} 앞서갔어요.` : null}
                </div>
              </div>
            </div>
          )}

          <section className="mt-4" aria-labelledby="result-reason-title">
            <h3 id="result-reason-title" className="text-base font-black text-slate-800">왜 이런 결과가 나왔을까요?</h3>
            <div className="mt-2 space-y-2">
              {highlights.map((highlight) => (
                <div key={highlight.title} className={`result-clue result-clue--${highlight.tone} flex gap-2.5 rounded-xl p-3`}>
                  <span className="text-xl" aria-hidden>{highlight.emoji}</span>
                  <div>
                    <div className="text-sm font-black text-slate-800">{highlight.title}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{highlight.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <QuestNews summary={summary} />

          <section className="mt-4 rounded-2xl bg-slate-900 p-3 text-white" aria-labelledby="mission-result-title">
            <div className="flex items-center justify-between gap-2">
              <h3 id="mission-result-title" className="text-sm font-black">🎯 이번 턴 도전</h3>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold">별 {completedMissions}/{missionResults.length}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {missionResults.map((mission) => (
                <div key={mission.id} className={`mission-stamp flex items-center gap-2 rounded-xl px-3 py-2 ${mission.done ? "mission-stamp--done" : "bg-white/10"}`}>
                  <span className="text-xl" aria-hidden>{mission.done ? "⭐" : mission.emoji}</span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black">{mission.title}</div>
                    <div className="text-xs text-white/65">{mission.done ? "도전 성공!" : "다음에 다시 도전"}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <details className="group mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <summary className="cursor-pointer list-none text-xs font-black text-slate-700">
              📊 숫자로 자세히 보기
              <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-2 divide-y divide-slate-200">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className={`text-xs font-bold ${row.tone === "good" ? "text-emerald-700" : row.tone === "bad" ? "text-red-600" : "text-slate-800"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </details>

          {summary.recoveryPlan && (
          <section className={`mt-4 rounded-xl p-4 ring-1 ${summary.recoveryPlan.level === "danger" ? "bg-red-50 ring-red-200" : "bg-amber-50 ring-amber-200"}`} aria-labelledby="recovery-plan-title">
            <h3 id="recovery-plan-title" className="font-black text-slate-800">🛟 {summary.recoveryPlan.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{summary.recoveryPlan.summary}</p>
            <ol className="mt-3 space-y-2 text-left">
              {summary.recoveryPlan.steps.map((step, index) => (
                <li key={step.title} className="rounded-lg bg-white/90 p-2.5 text-xs ring-1 ring-black/5">
                  <div className="font-black text-slate-800">{index + 1}. {step.emoji} {step.title}</div>
                  <div className="mt-0.5 leading-relaxed text-slate-600">{step.detail}</div>
                </li>
              ))}
            </ol>
          </section>
          )}

          <button
            className="btn-primary mt-4 min-h-14 w-full text-lg"
            onClick={onClose}
          >
            {summary.events.length > 0 ? `뉴스 ${summary.events.length}개 보기 ▶` : "확인했어요 ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 📜 의뢰 소식: deliveries, finished or missed requests, new cards and badges. */
function QuestNews({ summary }: { summary: TurnSummary }) {
  const lines: { emoji: string; text: string; tone: "good" | "warn" | "info" }[] = [];
  const delivery = summary.orderDelivery;
  if (delivery && delivery.units > 0) {
    lines.push({
      emoji: "📦",
      text: `주문 배달 ${delivery.units.toLocaleString()}개 → +${formatMoney(delivery.revenue)}원${delivery.completed ? " · 🎉 주문 완료! 게시판에서 보너스를 받아요" : ""}`,
      tone: "good",
    });
  } else if (delivery) {
    lines.push({ emoji: "📦", text: "이번 턴엔 주문에 보낼 상품이 없었어요. 생산 계획을 확인해 보세요.", tone: "warn" });
  }
  for (const quest of summary.questUpdate?.failed ?? []) {
    lines.push({ emoji: "😢", text: `${quest.client}의 '${quest.title}' 기한을 놓쳤어요 (평판 −3)`, tone: "warn" });
  }
  for (const quest of summary.questUpdate?.ready ?? []) {
    lines.push({ emoji: "🎉", text: `'${quest.title}' 완성! 게시판에서 보상을 받아요`, tone: "good" });
  }
  const posted = summary.questUpdate?.posted.length ?? 0;
  if (posted > 0) lines.push({ emoji: "📬", text: `새 의뢰 ${posted}개가 게시판에 도착했어요`, tone: "info" });
  if (summary.newDilemma) lines.push({ emoji: "🤔", text: "'사장님의 선택' 카드가 도착했어요", tone: "info" });
  for (const badge of summary.achievements ?? []) {
    lines.push({ emoji: "🏅", text: `업적 달성! ${badge.emoji} ${badge.title}`, tone: "good" });
  }
  if (lines.length === 0) return null;
  return (
    <section className="mt-4 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-labelledby="quest-news-title">
      <h3 id="quest-news-title" className="text-sm font-black text-slate-800">📜 의뢰·업적 소식</h3>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line, i) => (
          <li
            key={i}
            className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-xs ${line.tone === "good" ? "bg-emerald-100/70 text-emerald-950" : line.tone === "warn" ? "bg-rose-100/70 text-rose-950" : "bg-white text-slate-700"}`}
          >
            <span aria-hidden>{line.emoji}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultStep({
  emoji,
  label,
  value,
  tone = "neutral",
}: {
  emoji: string;
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className={`result-step result-step--${tone} relative rounded-xl px-1 py-2.5 ring-1 ring-slate-200`}>
      <div className="result-step-icon text-2xl" aria-hidden>{emoji}</div>
      <div className="mt-1 text-xs font-bold leading-tight text-slate-500">{label}</div>
      <div className="truncate text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}

const TONE_STYLE: Record<NewsItem["tone"], { ring: string; chip: string; label: string }> = {
  positive: { ring: "ring-bull/40", chip: "bg-bull/10 text-bull", label: "😀 좋은 소식" },
  negative: { ring: "ring-bear/40", chip: "bg-bear/10 text-bear", label: "😟 나쁜 소식" },
  neutral: { ring: "ring-slate-200", chip: "bg-slate-100 text-slate-500", label: "📢 알림" },
};

function EventPopup({ events, onClose }: { events: NewsItem[]; onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const tone: "positive" | "negative" | "neutral" = events.some((e) => e.tone === "positive")
    ? "positive"
    : events.some((e) => e.tone === "negative")
    ? "negative"
    : "neutral";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div
        className="card w-full max-w-md animate-popin overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-popup-title"
      >
        {/* Banner header */}
        <div className="relative overflow-hidden">
          <img src={BANNER_IMGS[tone]} alt="" className="w-full object-cover" style={{ maxHeight: 100 }} />
          <div className="absolute inset-0 flex items-end bg-black/25 px-4 pb-2.5">
            <h2 id="event-popup-title" className="text-base font-black text-white drop-shadow">
              {events.every((ev) => ev.layer === "fun")
                ? "😂 이번 턴 깜짝 소식"
                : `이번 턴 뉴스 ${events.length > 1 ? `(${events.length})` : ""}`}
            </h2>
          </div>
        </div>
        <div className="p-5">
        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto scroll-thin">
          {events.map((ev) => {
            const tone = TONE_STYLE[ev.tone];
            const fun = ev.layer === "fun";
            return (
              <div key={ev.id} className={`rounded-xl p-3 ring-1 ${fun ? "fun-news bg-amber-50 ring-amber-300" : `bg-white ${tone.ring}`}`}>
                <div className="flex items-start gap-2.5">
                  {ev.portrait ? (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-4xl shadow-inner">
                      {ev.portrait}
                    </span>
                  ) : (
                    <span className={`leading-none ${fun ? "fun-news-emoji text-4xl" : "text-2xl"}`}>{ev.emoji}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      {!fun && <span className={`pill text-xs ${tone.chip}`}>{tone.label}</span>}
                      <span className={`pill text-xs ${fun ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500"}`}>
                        {LAYER_LABELS[ev.layer]}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-base leading-snug text-slate-600">{ev.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-primary mt-4 min-h-14 w-full text-lg" onClick={onClose}>
          확인했어요 ▶
        </button>
        </div>
      </div>
    </div>
  );
}

function GameOver({ game, onRestart }: { game: ReturnType<typeof useGameStore.getState>["game"] & object; onRestart: () => void }) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  if (!game) return null;
  const board = rankings(game);
  const outcome = getCampaignOutcome(game);
  const rank = outcome.finalRank;
  const won = outcome.isChampion;
  const failed = game.endReason === "insolvent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} className="card max-h-[92vh] w-full max-w-lg animate-popin overflow-y-auto p-6 text-center outline-none" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="game-over-title">
        <Image
          src={won && !failed ? RESULT_ICONS.win : RESULT_ICONS.end}
          alt={won && !failed ? "우승을 축하하는 드래곤" : "게임 결과를 안내하는 드래곤"}
          width={144}
          height={144}
          className="mx-auto h-36 w-36 object-contain"
        />
        <h2 id="game-over-title" className="mt-3 text-2xl font-black text-slate-800">
          {failed ? "회사가 문을 닫았어요" : won ? "축하해요! 1등이에요!" : "게임 끝!"}
        </h2>
        <p className="mt-1 text-slate-500">
          {failed
            ? `${game.turn}턴에 쓸 돈이 바닥나고 빚과 손해가 계속됐어요. 실패도 중요한 경제 공부예요.`
            : `${game.maxTurns}턴 동안 회사를 키워 ${rank}위로 마쳤어요.`}
        </p>
        {failed && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200">
            <b>다음엔 이렇게 해 봐요</b>
            <p className="mt-1">손님 수보다 조금 적게 만들고 → 만드는 데 드는 돈(원가)보다 비싸게 팔고 → 새 건물과 투자는 잠시 쉬며 돈을 모아요.</p>
          </div>
        )}
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
                <div className="mt-0.5 text-xs text-slate-500">{progress}</div>
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
          {failed ? "다시 경영해 보기" : "새 게임 하기"}
        </button>
      </div>
    </div>
  );
}

function useDialogFocus<T extends HTMLElement>() {
  const dialogRef = useRef<T>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, []);
  return dialogRef;
}

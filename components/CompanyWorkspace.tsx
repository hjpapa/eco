"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BUILDINGS,
  BUILDING_LIST,
  estimateBuildingImpact,
  evaluateBuildingPlacement,
  findBestBuildingCell,
  getActiveBuildingCombos,
  isFeatureUnlocked,
  isBuildingTypeUnlocked,
  getFeatureUnlockTurn,
  openQuests,
  questProgress,
  currentSeason,
  plotHappiness,
  villageStats,
  VILLAGE_ROLES,
  moveCost,
  type GameState,
  type Company,
  type BuildingType,
} from "@/lib/engine";
import { formatMoney, formatNum, withJosa } from "@/lib/format";
import {
  COMPANY_TASKS,
  taskForMission,
  type CompanyTask,
} from "@/lib/ui/companyWorkspace";
import { buildingWorkReport, getCityProgress } from "@/lib/ui/cityBuilder";
import { WORK_LESSONS } from "@/lib/learning/catalog";
import { useGameStore } from "@/store/gameStore";
import { MapViewport } from "./MapViewport";
import { readableMapSize } from "@/lib/ui/mapGestures";
import { CompanyCity } from "./CompanyCity";
import { SEASON_THEMES } from "./seasonTheme";
import { VillagePanel } from "./VillagePanel";
import { happyTintCss } from "@/lib/ui/villageMap";
import { CompanyPanel } from "./CompanyPanel";
import { BuildingIcon, ConstructionPanel } from "./ConstructionPanel";
import { AchievementShelf, QuestBoard } from "./QuestBoard";
import { Dashboard } from "./Dashboard";
import { EconomyIndicators } from "./EconomyIndicators";
import { RivalChase } from "./RivalChase";
import { TurnMissionCard } from "./TurnMissionCard";
import type { MissionDestination } from "@/lib/ui/gameExperience";

class MapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Celebration = { key: number; emoji: string; title: string; detail?: string; big?: boolean };

export function CompanyWorkspace({
  game,
  company,
  onNavigate,
  workReportKey = 0,
}: {
  game: GameState;
  company: Company;
  onNavigate: (destination: MissionDestination) => void;
  /** Changes after each turn's popups close; triggers the building pop-ups. */
  workReportKey?: number;
}) {
  const lastSummary = useGameStore((s) => s.lastSummary);
  const workReport = workReportKey
    ? { key: workReportKey, labels: buildingWorkReport(company, lastSummary?.playerResult?.unitsProduced ?? 0) }
    : undefined;
  const [task, setTask] = useState<CompanyTask>("construction");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPendingState] = useState<BuildingType | null>(null);
  const [confirmCell, setConfirmCell] = useState<{ x: number; y: number } | null>(null);
  const [flat, setFlat] = useState(false);
  const [camera, setCamera] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [report, setReport] = useState(false);
  const [happyMap, setHappyMap] = useState(false);
  /** A building being moved to another plot (🚚 옮기기). */
  const [moving, setMoving] = useState<string | null>(null);
  /** Opens the build palette on a category, e.g. 🌼 꾸미기 from the village. */
  const [paletteFilter, setPaletteFilter] = useState<{ filter: "decor" | "home"; key: number } | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const actionLock = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const panelContent = useRef<HTMLDivElement>(null);
  const mapSection = useRef<HTMLElement>(null);
  const build = useGameStore((s) => s.build);
  const move = useGameStore((s) => s.move);
  const researchUnlocked = isFeatureUnlocked(game, "research");
  const villageUnlocked = isFeatureUnlocked(game, "village");
  const advanced =
    game.config.showAdvancedMetrics &&
    isFeatureUnlocked(game, "visitsPartnershipsAdvanced");
  const selected = company.buildings.find((b) => b.id === selectedId);
  const combos = getActiveBuildingCombos(company.buildings);
  const city = getCityProgress(company);
  const village = villageStats(company.buildings);

  const movingBuilding = moving ? company.buildings.find((b) => b.id === moving) : undefined;
  const setPending = (type: BuildingType | null) => {
    setPendingState(type);
    setConfirmCell(null);
    setMoving(null);
    if (!type) return;
    setSelectedId(null);
    // On tablets the cards sit below the map: bring the map back into view.
    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() =>
        mapSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };

  // Celebrate new buildings, upgrades, combinations and city growth. The
  // signature covers in-place engine mutations (the company object is reused).
  const signature = company.buildings.map((b) => `${b.id}:${b.level}:${b.turnsLeft > 0 ? "building" : "ready"}`).join("|");
  const comboIds = combos.map((c) => c.id);
  const previous = useRef({ signature, comboIds, stage: city.stage.id, count: company.buildings.length, score: city.score, stars: village.stars });
  useEffect(() => {
    const before = previous.current;
    previous.current = { signature, comboIds, stage: city.stage.id, count: company.buildings.length, score: city.score, stars: village.stars };
    if (before.signature === signature) return;
    const newCombos = combos.filter((c) => !before.comboIds.includes(c.id));
    const grew = city.stage.id !== before.stage && city.score > before.score;
    let next: Omit<Celebration, "key"> | null = null;
    if (village.stars > before.stars) {
      const opened = BUILDING_LIST.filter((def) => def.unlockStars != null && def.unlockStars > before.stars && def.unlockStars <= village.stars && game.config.enabledBuildings.includes(def.type));
      next = {
        emoji: "⭐",
        title: `마을 별 ${village.stars}개!`,
        detail: opened.length
          ? `새 건물이 열렸어요: ${opened.map((def) => `${def.emoji} ${def.name}`).join(" · ")}`
          : "더 살기 좋은 마을이 됐어요",
        big: true,
      };
    } else if (grew) {
      const opened = BUILDING_LIST.filter((def) => {
        const need = def.unlockCityScore ?? 0;
        return need > before.score && need <= city.score && game.config.enabledBuildings.includes(def.type);
      });
      next = {
        emoji: city.stage.emoji,
        title: `${city.stage.label}로 성장했어요!`,
        detail: opened.length
          ? `새 건물이 열렸어요: ${opened.map((def) => `${def.emoji} ${def.name}`).join(" · ")}`
          : "도시가 한 단계 커졌어요",
        big: true,
      };
    } else if (newCombos.length > 0) {
      next = { emoji: newCombos[0].emoji, title: `${newCombos[0].name} 완성!`, detail: newCombos[0].description };
    } else if (company.buildings.length > before.count) {
      const newest = company.buildings[company.buildings.length - 1];
      next = { emoji: BUILDINGS[newest.type].emoji, title: `${BUILDINGS[newest.type].name} ${newest.turnsLeft > 0 ? "공사 시작!" : "완성!"}` };
    } else if (company.buildings.length === before.count) {
      next = { emoji: "⬆️", title: "도시 건물이 새로워졌어요!", detail: "완성된 건물과 새 레벨을 지도에서 확인해요" };
    }
    if (!next) return;
    setCelebration({ ...next, key: Date.now() });
    const timer = window.setTimeout(() => setCelebration(null), next.big ? 3400 : 1800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    try {
      if (!document.createElement("canvas").getContext("webgl2")) setFlat(true);
    } catch {
      setFlat(true);
    }
    return () => media.removeEventListener("change", update);
  }, []);

  const locked = (id: CompanyTask) =>
    (id === "research" && !researchUnlocked) || (id === "finance" && !advanced) || (id === "village" && !villageUnlocked);
  const lockTurn = (id: CompanyTask) =>
    getFeatureUnlockTurn(game.gameLength, id === "research" ? "research" : id === "village" ? "village" : "visitsPartnershipsAdvanced");
  const choose = (id: CompanyTask, buildingId: string | null = null) => {
    setTask(id);
    setSelectedId(buildingId);
    setPendingState(null);
    setConfirmCell(null);
    setMoving(null);
    window.requestAnimationFrame(() => {
      panel.current?.focus({ preventScroll: true });
      if (panelContent.current) panelContent.current.scrollTop = 0;
      if (window.innerWidth < 1024)
        panel.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const once = (action: () => void) => {
    if (Date.now() < actionLock.current) return;
    actionLock.current = Date.now() + 500;
    action();
  };

  const recommendation = pending
    ? findBestBuildingCell(company, pending, game.config.mapSize)
    : null;
  const previewCell = confirmCell ?? recommendation;
  const preview = pending && previewCell
    ? estimateBuildingImpact(game, company, pending, previewCell)
    : null;

  /**
   * Tapping a plot first marks it (📍) and shows what it would do; tapping the
   * same plot again (or "여기에 짓기") builds. A slip of the finger on a small
   * 3D plot never spends money. Buttons build directly, unless the build would
   * drain the emergency fund: then they ask once too.
   */
  const tryBuild = (x: number, y: number, direct = false) => {
    if (!pending) return;
    const impact = estimateBuildingImpact(game, company, pending, { x, y });
    if (!impact) return;
    const picked = confirmCell?.x === x && confirmCell?.y === y;
    if (!picked && !(direct && !impact.belowSafetyLine)) {
      setConfirmCell({ x, y });
      return;
    }
    once(() => {
      build(pending, x, y);
      setPending(null);
    });
  };

  /** 🚚 Start moving a building: the map shows empty plots to pick from. */
  const startMove = (buildingId: string) => {
    setPendingState(null);
    setConfirmCell(null);
    setMoving(buildingId);
    setSelectedId(buildingId);
    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() =>
        mapSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };
  const cancelMove = () => {
    setMoving(null);
    setConfirmCell(null);
  };
  /** Same two-tap safety as building: mark the plot, then tap again to move. */
  const tryMove = (x: number, y: number, direct = false) => {
    if (!movingBuilding) return;
    const picked = confirmCell?.x === x && confirmCell?.y === y;
    if (!picked && !direct) {
      setConfirmCell({ x, y });
      return;
    }
    once(() => {
      move(movingBuilding.id, x, y);
      cancelMove();
    });
  };

  const onCell = (x: number, y: number) => {
    const b = company.buildings.find((b) => b.x === x && b.y === y);
    if (movingBuilding) {
      if (!b) tryMove(x, y);
      return;
    }
    if (b) {
      if (pending) return; // keep placing; tapping a building does nothing
      choose("construction", b.id);
      return;
    }
    if (task === "construction" && pending) tryBuild(x, y);
    else choose("construction");
  };

  const labels: Record<string, string> = {};
  for (const type of ["factory", "warehouse", "hr"] as const) {
    const b = company.buildings.find(
      (b) =>
        b.type === type ||
        (type === "hr" && ["cafeteria", "daycare", "office"].includes(b.type)),
    );
    if (b)
      labels[b.id] =
        type === "factory"
          ? `🏭 ${formatNum(company.decisions.productionTarget)}개 만들기`
          : type === "warehouse"
            ? `📦 창고 ${formatNum(company.inventory)}개`
            : `😊 행복 ${Math.round(company.morale)}점`;
  }

  const flatMap = (
    <MapViewport readableSize={readableMapSize(game.config.mapSize)} className="workspace-map-h flat-map-h" style={{ background: SEASON_THEMES[currentSeason(game.macro)].sky }}>
      <div
        aria-label="2D 회사 지도"
        className="grid h-full w-full shrink-0 gap-1 p-2"
        style={{
          minWidth: readableMapSize(game.config.mapSize),
          minHeight: readableMapSize(game.config.mapSize),
          gridTemplateColumns: `repeat(${game.config.mapSize}, minmax(80px, 1fr))`,
          gridTemplateRows: `repeat(${game.config.mapSize}, minmax(80px, 1fr))`,
        }}
      >
        {Array.from({ length: game.config.mapSize ** 2 }, (_, i) => {
          const x = i % game.config.mapSize,
            y = Math.floor(i / game.config.mapSize);
          const b = company.buildings.find((b) => b.x === x && b.y === y);
          const placement = !b && pending
            ? evaluateBuildingPlacement(company, pending, x, y, game.config.mapSize)
            : null;
          const isRecommended = !!pending && recommendation?.x === x && recommendation?.y === y;
          const tint = (happyMap && !pending) || (!!pending && !b && (VILLAGE_ROLES[pending]?.residents ?? 0) > 0)
            ? happyTintCss(plotHappiness(company.buildings, x, y))
            : null;
          const isConfirm = confirmCell?.x === x && confirmCell?.y === y;
          const tone = b
            ? `border-emerald-300 bg-white ${b.id === selectedId ? "ring-2 ring-indigo-500" : ""}`
            : isConfirm
              ? "border-amber-500 bg-amber-200 ring-2 ring-amber-500"
              : isRecommended
                ? "border-emerald-500 bg-emerald-300 ring-2 ring-emerald-500"
                : placement?.combos.length
                  ? "border-amber-300 bg-amber-100"
                  : pending || movingBuilding
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-emerald-200 bg-emerald-50/70";
          return (
            <button
              key={i}
              className={`relative flex min-h-20 min-w-20 flex-col items-center justify-center overflow-hidden rounded-lg border p-0.5 text-[13px] leading-tight ${tone}`}
              onClick={() => onCell(x, y)}
              style={tint ? { backgroundImage: `linear-gradient(${tint}, ${tint})` } : undefined}
              aria-label={`${x + 1}열 ${y + 1}줄 ${b ? `${BUILDINGS[b.type].name} 레벨 ${b.level}${b.turnsLeft > 0 ? ` 공사 중 ${b.turnsLeft}턴 남음` : ""}` : placement?.combos.length ? "빈 땅, 조합 보너스 칸" : "빈 땅"}`}
            >
              {b ? (
                <>
                  {b.turnsLeft > 0 ? <span className="text-xl" aria-hidden>🏗️</span> :
                    <BuildingIcon type={b.type} size={b.level > 1 ? "h-[45%] w-9 max-w-full" : "h-[40%] w-7 max-w-full"} />}
                  <span className="max-w-full shrink-0 truncate text-[13px] font-bold leading-4 text-slate-700">{BUILDINGS[b.type].name}</span>
                  <span className={`shrink-0 text-[13px] leading-4 ${b.turnsLeft > 0 ? "text-amber-800" : "font-bold text-indigo-700"}`}>{b.turnsLeft > 0 ? `공사 ${b.turnsLeft}턴` : `레벨 ${b.level}`}</span>
                </>
              ) : (
                <span className="text-lg text-emerald-700/70" aria-hidden>
                  {isRecommended ? "⭐" : placement?.combos.length ? "✨" : "＋"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </MapViewport>
  );

  const lesson = WORK_LESSONS[task];
  const taskInfo = COMPANY_TASKS.find((t) => t.id === task);
  const tasks = COMPANY_TASKS.filter((t) => t.id !== "finance" || game.config.showAdvancedMetrics);
  // Things on the quest board that want a tap: new offers, finished work, a choice.
  const questAlerts =
    openQuests(game).filter((q) => q.status === "offered" || q.status === "ready" || (q.kind !== "order" && questProgress(game, q).ratio >= 1)).length +
    (game.dilemma ? 1 : 0);

  return (
    <div className="company-workspace flex flex-col gap-4" onKeyDown={(event) => {
      if (event.key === "Escape" && pending) { setPending(null); event.stopPropagation(); }
      if (event.key === "Escape" && moving) { cancelMove(); event.stopPropagation(); }
    }}>
      <h1 className="sr-only">우리 회사 도시 만들기 — 건물을 지어 도시를 키우고, 만들기·팔기 계획을 세워요.</h1>
      {report ? (
        <div className="mx-auto max-w-4xl space-y-4">
          <button className="btn-ghost min-h-12 text-base" onClick={() => setReport(false)}>
            ← 회사 지도로 돌아가기
          </button>
          <Dashboard
            game={game}
            onNavigate={(d) => {
              setReport(false);
              onNavigate(d);
            }}
          />
          <EconomyIndicators game={game} />
        </div>
      ) : (
        <>
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(380px,420px)] xl:grid-cols-[minmax(0,1fr)_460px]">
            <section ref={mapSection} className={`min-w-0 scroll-mt-36 space-y-2.5 rounded-3xl border border-emerald-200 bg-white/90 p-2.5 shadow-sm ${pending || movingBuilding ? "map-placing" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => choose("village")}
                    className="flex min-h-11 items-center gap-1.5 rounded-full bg-violet-100 px-3 text-sm font-black text-violet-800 ring-1 ring-violet-200"
                    aria-label={`우리 도시 ${city.stage.label}, 마을 별 ${village.stars}개, 주민 ${village.population}명. 마을 보기`}
                  >
                    <span aria-hidden>{city.stage.emoji}</span>
                    {city.stage.label}
                    {villageUnlocked && <span className="text-amber-500" aria-hidden>★{village.stars}</span>}
                    {villageUnlocked && <span className="font-bold text-violet-700" aria-hidden>👥{village.population}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const shelf = document.getElementById("achievement-shelf") as HTMLDetailsElement | null;
                      if (shelf) {
                        shelf.open = true;
                        shelf.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                    className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800 ring-1 ring-amber-200"
                    aria-label={`업적 ${(game.achievements ?? []).length}개 보기`}
                  >
                    🏅 {(game.achievements ?? []).length}
                  </button>

                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn-ghost !px-3" onClick={() => setReport(true)} aria-label="회사 성적표 보기">
                    📊 <span className="hidden sm:inline lg:hidden xl:inline">회사 성적표</span>
                  </button>
                  <button
                    className="btn-ghost !px-3"
                    aria-pressed={flat}
                    onClick={() => setFlat(!flat)}
                  >
                    {flat ? "입체 지도" : "평면 지도"}
                  </button>
                  {!flat && (
                    <button
                      className="btn-ghost !px-3"
                      aria-pressed={camera}
                      onClick={() => setCamera(!camera)}
                    >
                      {camera ? "↩️ 처음 시점" : "🔍 돌려 보기"}
                    </button>
                  )}
                </div>
              </div>
              {/* While placing, the help sits above the map (the map shrinks to make
                  room on tablets) so it never hides a plot. */}
              {movingBuilding && (
                <MoveBar
                  type={movingBuilding.type}
                  fee={moveCost(movingBuilding.type)}
                  confirm={confirmCell}
                  onConfirm={() => confirmCell && tryMove(confirmCell.x, confirmCell.y, true)}
                  onRepick={() => setConfirmCell(null)}
                  onCancel={cancelMove}
                />
              )}
              {pending && (
                <PlacementBar
                  pending={pending}
                  previewProfit={preview?.profitDelta ?? null}
                  previewPayback={preview?.paybackTurns ?? null}
                  comboCount={preview?.combos.length ?? 0}
                  residents={preview?.village.population ?? 0}
                  confirm={confirmCell && preview ? { cashAfter: preview.cashAfter, safetyLine: preview.safetyLine, below: preview.belowSafetyLine, x: confirmCell.x, y: confirmCell.y } : null}
                  canRecommend={!!recommendation}
                  onRecommend={() => recommendation && tryBuild(recommendation.x, recommendation.y, true)}
                  onConfirm={() => confirmCell && tryBuild(confirmCell.x, confirmCell.y, true)}
                  onRepick={() => setConfirmCell(null)}
                  onCancel={() => setPending(null)}
                />
              )}
              <div className="relative">
                {flat ? (
                  flatMap
                ) : (
                  <MapBoundary fallback={flatMap}>
                    <CompanyCity
                      // Leaving free-camera mode snaps the view back to the start.
                      key={camera ? "free-camera" : "fixed-camera"}
                      game={game}
                      company={company}
                      onWorkspaceCell={onCell}
                      pendingType={pending ?? movingBuilding?.type ?? null}
                      recommend={!movingBuilding}
                      inspectedId={selectedId}
                      confirmCell={confirmCell}
                      cameraEnabled={camera}
                      reducedMotion={reduced}
                      happyMap={happyMap}
                      buildingLabels={labels}
                      workReport={workReport}
                    />
                  </MapBoundary>
                )}
                {!pending && !movingBuilding && villageUnlocked && (
                  <button
                    type="button"
                    onClick={() => setHappyMap((v) => !v)}
                    aria-pressed={happyMap}
                    className={`absolute right-2 top-2 z-10 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-black shadow-md ring-1 ${happyMap ? "bg-emerald-600 text-white ring-emerald-700" : "bg-white/90 text-emerald-800 ring-emerald-200 backdrop-blur"}`}
                    aria-label={happyMap ? "행복 지도 끄기" : "행복 지도 보기: 살기 좋은 땅은 초록, 시끄러운 땅은 빨강"}
                  >
                    😊 행복 지도{happyMap ? " ✓" : ""}
                  </button>
                )}
                {!pending && !movingBuilding && happyMap && (
                  <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-xl bg-white/90 px-2.5 py-1.5 text-[13px] font-bold text-slate-700 shadow backdrop-blur">
                    <span className="text-emerald-600">■</span> 살기 좋은 땅 · <span className="text-rose-500">■</span> 시끄러운 땅
                  </div>
                )}
                {!pending && !movingBuilding && (
                  <div role="status" className="mt-2 text-sm">
                    <span className="inline-block rounded-2xl bg-white/85 px-3 py-1 text-sm font-bold text-emerald-800 shadow-sm backdrop-blur">
                      {task === "construction" ? "👉 지을 건물을 고르거나, 건물을 눌러 키워요" : "👉 건물을 누르면 키우기·옮기기·팔기를 할 수 있어요"}
                    </span>
                  </div>
                )}
                {celebration && (
                  <div
                    key={celebration.key}
                    className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center"
                    aria-hidden
                  >
                    <div className={`build-celebration ${celebration.big ? "build-celebration--big ring-violet-300" : "ring-amber-300"} max-w-md rounded-2xl bg-slate-950/90 px-5 py-3 text-center text-white shadow-2xl ring-2`}>
                      <div className={celebration.big ? "text-5xl" : "text-4xl"}>{celebration.emoji}</div>
                      <div className="mt-1 text-lg font-black">{celebration.title}</div>
                      {celebration.detail && <div className="text-sm text-slate-200">{celebration.detail}</div>}
                    </div>
                  </div>
                )}
              </div>
              {!pending && !movingBuilding && (
                <details className="rounded-xl bg-slate-50 p-2">
                  <summary className="flex min-h-11 cursor-pointer items-center px-2 text-sm font-bold">🏘️ 건물 목록에서 고르기 ({company.buildings.length}개)</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {company.buildings.map((building) => (
                      <button key={building.id} type="button" className="btn-ghost min-h-14 min-w-0 !justify-start text-left" onClick={() => choose("construction", building.id)}>
                        <BuildingIcon type={building.type} size="h-8 w-8" />
                        <span className="min-w-0 break-words text-[13px]">{BUILDINGS[building.type].name} · 레벨 {building.level}<br />{building.x + 1}열 {building.y + 1}줄{building.turnsLeft > 0 ? ` · 공사 ${building.turnsLeft}턴` : ""}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <section
              ref={panel}
              tabIndex={-1}
              aria-label="선택한 경영 업무"
              className="workspace-panel min-w-0 scroll-mt-36 rounded-3xl border border-slate-200 bg-white outline-none"
            >
              <nav
                className={`workspace-tasks grid grid-cols-4 gap-1.5 rounded-t-3xl border-b border-slate-100 bg-white p-2.5 ${tasks.length > 7 ? "sm:grid-cols-8" : "sm:grid-cols-7"} lg:grid-cols-4`}
                aria-label="회사 업무"
              >
                {tasks.map((t) => {
                  const isLocked = locked(t.id);
                  const badge = t.id === "quests" && questAlerts > 0 ? questAlerts : 0;
                  return (
                    <button
                      key={t.id}
                      aria-pressed={task === t.id}
                      className={`relative flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl px-1 py-1.5 text-sm font-black leading-tight ${
                        task === t.id
                          ? "bg-emerald-700 text-white shadow"
                          : isLocked
                            ? "bg-slate-50 text-slate-400"
                            : t.id === "construction"
                              ? "bg-amber-100 text-amber-900 ring-2 ring-amber-300"
                              : "bg-slate-100 text-slate-700"
                      }`}
                      onClick={() => choose(t.id)}
                    >
                      <span className="text-xl leading-none" aria-hidden>
                        {isLocked ? "🔒" : t.icon}
                      </span>
                      <span className="mt-0.5">{t.label}</span>
                      {badge > 0 && (
                        <span className="quest-badge absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[13px] font-black text-white ring-2 ring-white">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div ref={panelContent} className="space-y-3 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-black">
                    {taskInfo?.icon} {taskInfo?.label}
                  </h2>
                  {selected && task !== "construction" && (
                    <span className="text-sm font-bold text-slate-500">
                      {BUILDINGS[selected.type].emoji} {BUILDINGS[selected.type].name} Lv.{selected.level}
                    </span>
                  )}
                </div>
                {locked(task) ? (
                  <p className="rounded-xl bg-amber-50 p-4 text-base">
                    🔒 {lockTurn(task)}턴에 열려요. 지금은 건물을 짓고 만들기·팔기를 해 보세요.
                  </p>
                ) : task === "quests" ? (
                  <QuestBoard
                    game={game}
                    company={company}
                    layout="stack"
                    onGoProduction={() => choose("production")}
                    onGoBuild={(type) => {
                      choose("construction");
                      if (type && isBuildingTypeUnlocked(company, type)) setPending(type);
                    }}
                  />
                ) : task === "village" ? (
                  <VillagePanel
                    game={game}
                    company={company}
                    happyMap={happyMap}
                    onToggleHappyMap={() => setHappyMap((v) => !v)}
                    onBuild={(type) => {
                      choose("construction");
                      setPending(type);
                    }}
                    onDecorate={() => {
                      choose("construction");
                      setPaletteFilter({ filter: "decor", key: Date.now() });
                    }}
                  />
                ) : task === "construction" ? (
                  <ConstructionPanel
                    game={game}
                    company={company}
                    pending={pending}
                    onPick={setPending}
                    selected={selected}
                    onCloseSelected={() => setSelectedId(null)}
                    preview={preview}
                    needsConfirm={!!confirmCell && !!preview?.belowSafetyLine}
                    picked={!!confirmCell}
                    onBuildPreview={() => preview && tryBuild(preview.x, preview.y, true)}
                    onMove={startMove}
                    key={paletteFilter?.key ?? 0}
                    initialFilter={paletteFilter?.filter}
                  />
                ) : (
                  <>
                    <CompanyPanel
                      key={task}
                      game={game}
                      company={company}
                      task={task}
                    />
                    {selected && (
                      <button
                        className="btn-ghost w-full"
                        onClick={() => choose("construction", selected.id)}
                      >
                        ⬆️ 이 건물 키우기·관리
                      </button>
                    )}
                  </>
                )}
                {!locked(task) && (
                  <details className="group rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-black">
                      📘 경제 한마디: {lesson.term}
                      <span className="text-amber-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <p className="mt-1 leading-relaxed">{lesson.text}</p>
                    <p className="mt-1 leading-relaxed text-amber-800">💡 {lesson.impact}</p>
                    <Link
                      className="mt-1 inline-flex min-h-11 items-center font-bold underline"
                      href="/learn?return=/play"
                    >
                      배우기에서 더 알아보기
                    </Link>
                  </details>
                )}
              </div>
            </section>
          </div>
          <TurnMissionCard
            game={game}
            compact
            onCompanyTask={(id) => choose(taskForMission(id))}
            onNavigate={(d) => {
              if (d === "company" || d === "home") choose("construction");
              else onNavigate(d);
            }}
          />
          <AchievementShelf game={game} />
          {isFeatureUnlocked(game, "talentNewsRanking") && (
            <RivalChase game={game} />
          )}
        </>
      )}
    </div>
  );
}

/** 🚚 Moving a building: pick an empty plot, then confirm. */
function MoveBar({
  type,
  fee,
  confirm,
  onConfirm,
  onRepick,
  onCancel,
}: {
  type: BuildingType;
  fee: number;
  confirm: { x: number; y: number } | null;
  onConfirm: () => void;
  onRepick: () => void;
  onCancel: () => void;
}) {
  const def = BUILDINGS[type];
  const feeText = fee > 0 ? `이사 비용 ${formatMoney(fee)}원` : "옮기기 무료";
  if (confirm) {
    return (
      <div role="status" className="rounded-2xl bg-sky-50 p-2.5 text-base text-sky-950 ring-2 ring-sky-300">
        <p className="font-black">
          📍 {confirm.x + 1}열 {confirm.y + 1}줄로 {def.emoji} {withJosa(def.name, "을", "를")} 옮길까요?
        </p>
        <p className="text-sm">{feeText} · 옮기면 옆 건물 조합과 이웃 행복이 달라질 수 있어요</p>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" className="btn-primary text-base" onClick={onConfirm}>
            ✅ 여기로 옮기기
          </button>
          <button type="button" className="btn-ghost text-base" onClick={onRepick}>
            다른 칸
          </button>
          <button type="button" className="btn-ghost min-w-11 text-base" onClick={onCancel} aria-label="옮기기 취소">
            ✕
          </button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl bg-sky-50 p-2.5 text-base text-sky-950 ring-2 ring-sky-300">
      <p className="font-black">🚚 {def.emoji} {def.name}: 옮길 빈 땅을 눌러요</p>
      <p className="text-sm">{feeText} · 한 번 누르면 고르고, 한 번 더 누르면 옮겨요</p>
      <button type="button" className="btn-ghost mt-1.5 w-full text-base" onClick={onCancel}>
        옮기기 취소
      </button>
    </div>
  );
}

function PlacementBar({
  pending,
  previewProfit,
  previewPayback,
  comboCount,
  residents = 0,
  confirm,
  canRecommend,
  onRecommend,
  onConfirm,
  onRepick,
  onCancel,
}: {
  pending: BuildingType | null;
  previewProfit: number | null;
  previewPayback: number | null;
  comboCount: number;
  /** Residents the building would bring to the village. */
  residents?: number;
  confirm: { cashAfter: number; safetyLine: number; below: boolean; x: number; y: number } | null;
  canRecommend: boolean;
  onRecommend: () => void;
  onConfirm: () => void;
  onRepick: () => void;
  onCancel: () => void;
}) {
  if (!pending) return null;
  const def = BUILDINGS[pending];
  if (confirm) {
    const tone = confirm.below ? "bg-amber-100/95 text-amber-950 ring-amber-300" : "bg-emerald-50/95 text-emerald-950 ring-emerald-300";
    return (
      <div role="status" className={`rounded-2xl p-2.5 text-base ring-2 ${tone}`}>
        <p className="font-black">
          📍 {confirm.x + 1}열 {confirm.y + 1}줄에 {def.emoji} {withJosa(def.name, "을", "를")} 지을까요?
        </p>
        <p className="text-sm">
          {previewProfit != null && `이익 ${previewProfit >= 0 ? "+" : "−"}${formatMoney(Math.abs(Math.round(previewProfit)))}원/턴 · `}
          지으면 남는 돈 {formatMoney(confirm.cashAfter)}원
          {residents > 0 && ` · 👥 주민 +${residents}명`}
          {comboCount > 0 && ` · ✨ 조합 ${comboCount}개`}
        </p>
        {confirm.below && (
          <p className="text-sm font-bold">⚠️ 비상금 {formatMoney(confirm.safetyLine)}원보다 적어져요. 갑자기 손해가 나면 위험해요.</p>
        )}
        <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" className={confirm.below ? "btn-bull !bg-amber-500 text-base" : "btn-primary text-base"} onClick={onConfirm}>
            {confirm.below ? "⚠️ 그래도 짓기" : "✅ 여기에 짓기"}
          </button>
          <button type="button" className="btn-ghost text-base" onClick={onRepick}>
            다른 칸
          </button>
          <button type="button" className="btn-ghost min-w-11 text-base" onClick={onCancel} aria-label="건설 취소">
            ✕
          </button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl bg-emerald-50 p-2.5 text-base text-emerald-950 ring-2 ring-emerald-300">
      <p className="font-black">
        📍 {def.emoji} {def.name}: 지을 빈 땅을 눌러 골라요
      </p>
      <p className="text-sm text-emerald-900">
        {(VILLAGE_ROLES[pending]?.residents ?? 0) > 0
          ? "🟩 초록 땅 = 살기 좋은 곳 · 🟥 빨강 = 시끄러운 곳 · ⭐ 추천"
          : "⭐ 초록 칸 = 추천 · ✨ 금색 칸 = 조합 보너스"}
        {" "}· 한 번 누르면 미리 보고, 한 번 더 누르면 지어요
        {previewProfit != null &&
          ` · 이익 ${previewProfit >= 0 ? "+" : "−"}${formatMoney(Math.abs(Math.round(previewProfit)))}원/턴`}
        {previewPayback != null && ` · 본전까지 약 ${previewPayback}턴`}
        {comboCount > 0 && ` · 조합 ${comboCount}개`}
      </p>
      <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className="btn-primary text-base" disabled={!canRecommend} onClick={onRecommend}>
          ⭐ 추천 칸에 짓기
        </button>
        <button type="button" className="btn-ghost text-base" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

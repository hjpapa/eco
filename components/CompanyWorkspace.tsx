"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BUILDINGS,
  estimateBuildingImpact,
  evaluateBuildingPlacement,
  findBestBuildingCell,
  getActiveBuildingCombos,
  estimateDemand,
  productionCapacity,
  isFeatureUnlocked,
  getFeatureUnlockTurn,
  type GameState,
  type Company,
  type BuildingType,
} from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getCountry } from "@/lib/data/countries";
import { formatMoney, formatNum } from "@/lib/format";
import {
  COMPANY_TASKS,
  taskForBuilding,
  taskForMission,
  type CompanyTask,
} from "@/lib/ui/companyWorkspace";
import { getCityProgress } from "@/lib/ui/cityBuilder";
import { WORK_LESSONS } from "@/lib/learning/catalog";
import { useGameStore } from "@/store/gameStore";
import { CompanyCity } from "./CompanyCity";
import { CompanyPanel } from "./CompanyPanel";
import { BuildingIcon, ConstructionPanel } from "./ConstructionPanel";
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
}: {
  game: GameState;
  company: Company;
  onNavigate: (destination: MissionDestination) => void;
}) {
  const [task, setTask] = useState<CompanyTask>("construction");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPendingState] = useState<BuildingType | null>(null);
  const [confirmCell, setConfirmCell] = useState<{ x: number; y: number } | null>(null);
  const [flat, setFlat] = useState(false);
  const [camera, setCamera] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [report, setReport] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const actionLock = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const mapSection = useRef<HTMLElement>(null);
  const build = useGameStore((s) => s.build);
  const researchUnlocked = isFeatureUnlocked(game, "research");
  const advanced =
    game.config.showAdvancedMetrics &&
    isFeatureUnlocked(game, "visitsPartnershipsAdvanced");
  const selected = company.buildings.find((b) => b.id === selectedId);
  const capacity = productionCapacity(company, game.config);
  const demand = estimateDemand(
    company,
    getIndustry(company.industryId),
    getCountry(company.countryId),
    game.macro,
    game.config,
  );
  const combos = getActiveBuildingCombos(company.buildings);
  const city = getCityProgress(company);

  const setPending = (type: BuildingType | null) => {
    setPendingState(type);
    setConfirmCell(null);
    if (!type) return;
    setSelectedId(null);
    // On tablets the cards sit below the map: bring the map back into view.
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() =>
        mapSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };

  // Celebrate new buildings, upgrades, combinations and city growth. The
  // signature covers in-place engine mutations (the company object is reused).
  const signature = company.buildings.map((b) => `${b.id}:${b.level}`).join("|");
  const comboIds = combos.map((c) => c.id);
  const previous = useRef({ signature, comboIds, stage: city.stage.id, count: company.buildings.length });
  useEffect(() => {
    const before = previous.current;
    previous.current = { signature, comboIds, stage: city.stage.id, count: company.buildings.length };
    if (before.signature === signature) return;
    const newCombos = combos.filter((c) => !before.comboIds.includes(c.id));
    const grew = city.stage.id !== before.stage && city.score > 0;
    let next: Omit<Celebration, "key"> | null = null;
    if (grew) {
      next = { emoji: city.stage.emoji, title: `${city.stage.label}로 성장했어요!`, detail: "도시가 한 단계 커졌어요", big: true };
    } else if (newCombos.length > 0) {
      next = { emoji: newCombos[0].emoji, title: `${newCombos[0].name} 완성!`, detail: newCombos[0].description };
    } else if (company.buildings.length > before.count) {
      const newest = company.buildings[company.buildings.length - 1];
      next = { emoji: BUILDINGS[newest.type].emoji, title: `${BUILDINGS[newest.type].name} 완성!` };
    } else if (company.buildings.length === before.count) {
      next = { emoji: "⬆️", title: "업그레이드 완료!", detail: "건물이 더 커지고 튼튼해졌어요" };
    }
    if (!next) return;
    setCelebration({ ...next, key: Date.now() });
    const timer = window.setTimeout(() => setCelebration(null), next.big ? 2600 : 1800);
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

  const locked = (id: CompanyTask) => id === "research" && !researchUnlocked;
  const choose = (id: CompanyTask, buildingId: string | null = null) => {
    setTask(id);
    setSelectedId(buildingId);
    setPendingState(null);
    setConfirmCell(null);
    window.requestAnimationFrame(() => {
      panel.current?.focus({ preventScroll: true });
      if (window.innerWidth < 1280)
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

  /** Build right away, unless it would drain the emergency fund: then ask once. */
  const tryBuild = (x: number, y: number) => {
    if (!pending) return;
    const impact = estimateBuildingImpact(game, company, pending, { x, y });
    if (!impact) return;
    const confirmed = confirmCell?.x === x && confirmCell?.y === y;
    if (impact.belowSafetyLine && !confirmed) {
      setConfirmCell({ x, y });
      return;
    }
    once(() => {
      build(pending, x, y);
      setPending(null);
    });
  };

  const onCell = (x: number, y: number) => {
    const b = company.buildings.find((b) => b.x === x && b.y === y);
    if (b) {
      if (pending) return; // keep placing; tapping a building does nothing
      if (task === "construction") {
        setSelectedId(b.id === selectedId ? null : b.id);
        window.requestAnimationFrame(() => {
          if (window.innerWidth < 1280) panel.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      } else choose(taskForBuilding(b.type), b.id);
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
          ? `🏭 계획 ${formatNum(company.decisions.productionTarget)}개`
          : type === "warehouse"
            ? `📦 재고 ${formatNum(company.inventory)}개`
            : `😊 행복 ${Math.round(company.morale)}점`;
  }

  const flatMap = (
    <div
      className="overflow-auto rounded-2xl bg-emerald-100 p-3"
      aria-label="2D 회사 지도"
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${game.config.mapSize}, minmax(44px, 1fr))`,
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
          const isConfirm = confirmCell?.x === x && confirmCell?.y === y;
          const tone = b
            ? `border-emerald-300 bg-white ${b.id === selectedId ? "ring-2 ring-indigo-500" : ""}`
            : isConfirm
              ? "border-amber-500 bg-amber-200 ring-2 ring-amber-500"
              : isRecommended
                ? "border-emerald-500 bg-emerald-300 ring-2 ring-emerald-500"
                : placement?.combos.length
                  ? "border-amber-300 bg-amber-100"
                  : pending
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-emerald-200 bg-emerald-50/70";
          return (
            <button
              key={i}
              className={`relative flex min-h-16 flex-col items-center justify-center rounded-lg border p-1 text-[11px] leading-tight ${tone}`}
              onClick={() => onCell(x, y)}
              aria-label={`${x + 1}열 ${y + 1}줄 ${b ? `${BUILDINGS[b.type].name} 레벨 ${b.level}` : placement?.combos.length ? "빈 땅, 조합 보너스 칸" : "빈 땅"}`}
            >
              {b ? (
                <>
                  <BuildingIcon type={b.type} size="h-8 w-8" />
                  <span className="font-bold text-slate-700">{BUILDINGS[b.type].name.split("·")[0]}</span>
                  {b.level > 1 && <span className="absolute right-0.5 top-0.5 text-[10px] text-amber-500">{"★".repeat(b.level)}</span>}
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
    </div>
  );

  const lesson = WORK_LESSONS[task];
  const taskInfo = COMPANY_TASKS.find((t) => t.id === task);

  return (
    <div className="company-workspace space-y-4" onKeyDown={(event) => {
      if (event.key === "Escape" && pending) { setPending(null); event.stopPropagation(); }
    }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-700">
            DRAGON MOUNTAIN CITY
          </p>
          <h1 className="text-2xl font-black text-slate-900">
            우리 회사 도시 만들기
          </h1>
          <p className="text-sm text-slate-600">
            건물을 지어 도시를 키우고, 생산·판매 계획을 세워요.
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={() => setReport(!report)}
          aria-expanded={report}
        >
          {report ? "회사로 돌아가기" : "📊 회사 요약·보고서"}
        </button>
      </div>
      {report ? (
        <div className="mx-auto max-w-4xl">
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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
            <section ref={mapSection} className="min-w-0 scroll-mt-40 space-y-3 rounded-3xl border border-emerald-200 bg-white/90 p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate font-black text-emerald-950">
                    🏙️ {company.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => choose("construction")}
                    className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800 ring-1 ring-violet-200"
                    title="도시 점수: 건물 레벨 1점, 조합 2점"
                  >
                    <span aria-hidden>{city.stage.emoji}</span>
                    {city.stage.label}
                    {city.next && (
                      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white sm:block" aria-hidden>
                        <span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.round(city.progress * 100)}%` }} />
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost"
                    aria-pressed={flat}
                    onClick={() => setFlat(!flat)}
                  >
                    {flat ? "3D 보기" : "2D 보기"}
                  </button>
                  {!flat && (
                    <button
                      className="btn-ghost"
                      aria-pressed={camera}
                      onClick={() => setCamera(!camera)}
                    >
                      {camera ? "시점 고정" : "회전·확대"}
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                {flat ? (
                  flatMap
                ) : (
                  <MapBoundary fallback={flatMap}>
                    <CompanyCity
                      game={game}
                      company={company}
                      onWorkspaceCell={onCell}
                      pendingType={pending}
                      inspectedId={selectedId}
                      confirmCell={confirmCell}
                      cameraEnabled={camera}
                      reducedMotion={reduced}
                      buildingLabels={labels}
                    />
                  </MapBoundary>
                )}
                {celebration && (
                  <div
                    key={celebration.key}
                    className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center"
                    aria-hidden
                  >
                    <div className={`build-celebration rounded-2xl bg-slate-950/90 px-5 py-3 text-center text-white shadow-2xl ring-2 ${celebration.big ? "ring-violet-300" : "ring-amber-300"}`}>
                      <div className={celebration.big ? "text-5xl" : "text-4xl"}>{celebration.emoji}</div>
                      <div className="mt-1 text-lg font-black">{celebration.title}</div>
                      {celebration.detail && <div className="text-xs text-slate-200">{celebration.detail}</div>}
                    </div>
                  </div>
                )}
              </div>
              <PlacementBar
                pending={pending}
                previewProfit={preview?.profitDelta ?? null}
                previewPayback={preview?.paybackTurns ?? null}
                comboCount={preview?.combos.length ?? 0}
                confirm={confirmCell && preview ? { cashAfter: preview.cashAfter, safetyLine: preview.safetyLine } : null}
                canRecommend={!!recommendation}
                onRecommend={() => recommendation && tryBuild(recommendation.x, recommendation.y)}
                onConfirm={() => confirmCell && tryBuild(confirmCell.x, confirmCell.y)}
                onCancel={() => setPending(null)}
                idleText={task === "construction" ? "지을 건물을 고르세요. 지도의 건물을 누르면 업그레이드할 수 있어요." : "건물을 누르면 관련 업무가 열려요."}
              />
              <nav
                className="grid grid-cols-3 gap-2 sm:grid-cols-6"
                aria-label="회사 업무"
              >
                {COMPANY_TASKS.map((t) => (
                  <button
                    key={t.id}
                    aria-pressed={task === t.id}
                    className={`min-h-16 rounded-2xl px-2 py-3 text-sm font-bold ${
                      task === t.id
                        ? "bg-emerald-700 text-white shadow"
                        : t.id === "construction"
                          ? "bg-amber-100 text-amber-900 ring-2 ring-amber-300"
                          : "bg-slate-100 text-slate-700"
                    }`}
                    onClick={() => choose(t.id)}
                  >
                    <span className="block text-xl">
                      {locked(t.id) ? "🔒" : t.icon}
                    </span>
                    {t.label}
                  </button>
                ))}
              </nav>
              <details className="rounded-xl bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-bold">
                  건물 목록으로 선택하기 ({company.buildings.length}개)
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {company.buildings.map((b) => (
                    <button
                      className="btn-ghost"
                      key={b.id}
                      onClick={() => choose("construction", b.id)}
                    >
                      {BUILDINGS[b.type].emoji} {BUILDINGS[b.type].name} Lv.{b.level} (
                      {b.x + 1}, {b.y + 1})
                    </button>
                  ))}
                </div>
              </details>
            </section>
            <section
              ref={panel}
              tabIndex={-1}
              aria-label="선택한 경영 업무"
              className="min-w-0 scroll-mt-40 space-y-3 rounded-3xl border border-slate-200 bg-white p-4 outline-none xl:sticky xl:top-36 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto"
            >
              <div className="flex justify-between gap-2">
                <h2 className="text-xl font-black">
                  {taskInfo?.icon} {taskInfo?.label}
                </h2>
                {selected && task !== "construction" && (
                  <span className="text-xs text-slate-500">
                    {BUILDINGS[selected.type].name} Lv.{selected.level}
                  </span>
                )}
              </div>
              {task !== "construction" && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <b>현재 상황</b>
                  <p className="mt-1">
                    {task === "production"
                      ? `생산 한도 ${formatNum(capacity)}개 · 이전 가격 기준 예상 수요 ${formatNum(demand)}개 · 재고 ${formatNum(company.inventory)}개`
                      : task === "finance"
                        ? `현금 ${formatMoney(company.cash)} · 지난 이익 ${formatMoney(company.lastProfit)}`
                        : task === "research"
                          ? `품질 ${Math.round(company.quality)}점`
                          : task === "staff"
                            ? `직원 행복 ${Math.round(company.morale)}점 · 안전 ${Math.round(company.safety)}점`
                            : `지난 매출 ${formatMoney(company.lastRevenue)}`}
                  </p>
                </div>
              )}
              {locked(task) ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  🔒{" "}
                  {getFeatureUnlockTurn(game.gameLength, "research")}
                  턴(분기)에 열려요. 지금은 건물을 짓고 생산과 판매를 해 보세요.
                </p>
              ) : task === "construction" ? (
                <ConstructionPanel
                  game={game}
                  company={company}
                  pending={pending}
                  onPick={setPending}
                  selected={selected}
                  onCloseSelected={() => setSelectedId(null)}
                  preview={preview}
                  needsConfirm={!!confirmCell}
                  onBuildPreview={() => preview && tryBuild(preview.x, preview.y)}
                />
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-500">
                    내 선택 · 가격·생산·예산은 다음 턴 적용, 활동 버튼은 즉시
                    실행
                  </p>
                  {task === "finance" && !advanced ? (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm">
                      {!game.config.showAdvancedMetrics ? "이 저장 게임의 설정에서는 상세 재무·대출을 사용하지 않아요." : <>상세 재무·대출은{" "}
                      {getFeatureUnlockTurn(
                        game.gameLength,
                        "visitsPartnershipsAdvanced",
                      )}
                      턴(분기)에 열려요.</>}
                    </p>
                  ) : (
                    <CompanyPanel
                      key={task}
                      game={game}
                      company={company}
                      task={task}
                    />
                  )}
                  {selected && (
                    <button
                      className="btn-ghost w-full"
                      onClick={() => choose("construction", selected.id)}
                    >
                      이 건물 업그레이드·관리
                    </button>
                  )}
                  {selected?.type === "warehouse" && (
                    <button
                      className="btn-ghost w-full"
                      onClick={() => choose("sales")}
                    >
                      재고를 팔기 위해 판매 계획 열기
                    </button>
                  )}
                </>
              )}
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
                <b>예상 영향</b>
                <p className="mt-1">
                  {task === "production" &&
                  company.decisions.productionTarget > demand
                    ? "예상 수요보다 생산 목표가 높아요. 재고가 남을 수 있어요. "
                    : ""}
                  {lesson.impact}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                <b>📘 {lesson.term}</b>
                <p className="mt-1">{lesson.text}</p>
                <Link
                  className="mt-2 inline-flex min-h-11 items-center font-bold underline"
                  href="/learn?return=/play"
                >
                  배우기에서 더 알아보기
                </Link>
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
          {isFeatureUnlocked(game, "talentNewsRanking") && (
            <RivalChase game={game} />
          )}
        </>
      )}
    </div>
  );
}

function PlacementBar({
  pending,
  previewProfit,
  previewPayback,
  comboCount,
  confirm,
  canRecommend,
  onRecommend,
  onConfirm,
  onCancel,
  idleText,
}: {
  pending: BuildingType | null;
  previewProfit: number | null;
  previewPayback: number | null;
  comboCount: number;
  confirm: { cashAfter: number; safetyLine: number } | null;
  canRecommend: boolean;
  onRecommend: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  idleText: string;
}) {
  if (!pending) {
    return (
      <div role="status" className="min-h-6 px-2 text-sm font-bold text-emerald-800">
        {idleText}
      </div>
    );
  }
  const def = BUILDINGS[pending];
  if (confirm) {
    return (
      <div role="status" className="rounded-2xl bg-amber-100 p-3 text-sm text-amber-950 ring-2 ring-amber-300">
        <p className="font-black">⚠️ 지으면 남는 돈 {formatMoney(confirm.cashAfter)}원</p>
        <p className="text-xs">
          비상금 선 {formatMoney(confirm.safetyLine)}원보다 적어져요. 갑자기 손해가 나면 회사가 위험할 수 있어요.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="btn-bull !bg-amber-500" onClick={onConfirm}>
            그래도 짓기
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            그만두기
          </button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950 ring-2 ring-emerald-300">
      <p className="font-black">
        📍 {def.emoji} {def.name}: 지도에서 빈 땅을 눌러 지어요
      </p>
      <p className="text-xs text-emerald-900">
        ⭐ 초록 칸 = 추천 · ✨ 금색 칸 = 조합 보너스
        {previewProfit != null &&
          ` · 추천 칸 이익 ${previewProfit >= 0 ? "+" : "−"}${formatMoney(Math.abs(Math.round(previewProfit)))}원/턴`}
        {previewPayback != null && ` · 본전 약 ${previewPayback}턴`}
        {comboCount > 0 && ` · 조합 ${comboCount}개`}
      </p>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className="btn-primary" disabled={!canRecommend} onClick={onRecommend}>
          ⭐ 추천 칸에 짓기
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

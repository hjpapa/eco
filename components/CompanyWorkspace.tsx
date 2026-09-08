"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BUILDINGS,
  BUILDING_LIST,
  buildingConstructionCost,
  buildingCostFor,
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
  type CompanyTask,
} from "@/lib/ui/companyWorkspace";
import { WORK_LESSONS } from "@/lib/learning/catalog";
import { useGameStore } from "@/store/gameStore";
import { CompanyCity } from "./CompanyCity";
import { CompanyPanel } from "./CompanyPanel";
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

export function CompanyWorkspace({
  game,
  company,
  onNavigate,
}: {
  game: GameState;
  company: Company;
  onNavigate: (destination: MissionDestination) => void;
}) {
  const [task, setTask] = useState<CompanyTask>("production");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<BuildingType | null>(null);
  const [flat, setFlat] = useState(false);
  const [camera, setCamera] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [report, setReport] = useState(false);
  const [comboNotice, setComboNotice] = useState("");
  const actionLock = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const build = useGameStore((s) => s.build);
  const upgrade = useGameStore((s) => s.upgrade);
  const demolish = useGameStore((s) => s.demolish);
  const unlocked = isFeatureUnlocked(game, "buildingsResearch");
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
  const comboKey = combos
    .map((c) => c.id)
    .sort()
    .join(",");
  const previousCombo = useRef(comboKey);
  useEffect(() => {
    if (
      comboKey !== previousCombo.current &&
      comboKey.length > previousCombo.current.length
    )
      setComboNotice("✨ 새 인접 조합 완성! 서로 돕는 건물이 연결됐어요.");
    previousCombo.current = comboKey;
    const timer = window.setTimeout(() => setComboNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [comboKey]);
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
    (id === "research" || id === "construction") && !unlocked;
  const choose = (id: CompanyTask, buildingId: string | null = null) => {
    setTask(id);
    setSelectedId(buildingId);
    setPending(null);
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
  const onCell = (x: number, y: number) => {
    const b = company.buildings.find((b) => b.x === x && b.y === y);
    if (b) {
      choose(
        task === "construction" ? "construction" : taskForBuilding(b.type),
        b.id,
      );
      return;
    }
    if (task === "construction" && pending && unlocked) {
      once(() => {
        build(pending, x, y);
        setPending(null);
      });
    } else choose("construction");
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
            : `👥 사기 ${Math.round(company.morale)}점`;
  }
  const flatMap = (
    <div
      className="overflow-auto rounded-2xl bg-emerald-100 p-4"
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
          return (
            <button
              key={i}
              className={`min-h-14 rounded-lg border p-1 text-xs ${b ? "border-emerald-300 bg-white" : "border-emerald-200 bg-emerald-50"} ${b?.id === selectedId ? "ring-2 ring-indigo-500" : ""}`}
              onClick={() => onCell(x, y)}
              aria-label={`${x + 1}행 ${y + 1}열 ${b ? BUILDINGS[b.type].name : "빈 땅"}`}
            >
              <span className="block text-xl">
                {b ? BUILDINGS[b.type].emoji : "＋"}
              </span>
              {b ? BUILDINGS[b.type].name : "빈 땅"}
              {b && labels[b.id] && (
                <span className="block">{labels[b.id]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
  const recommendation = pending
    ? findBestBuildingCell(company, pending, game.config.mapSize)
    : null;
  const lesson = WORK_LESSONS[task];

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
            우리 회사에서 시작하는 하루
          </h1>
          <p className="text-sm text-slate-600">
            건물이나 업무를 눌러 이번 턴의 계획을 세워요.
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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(340px,3fr)]">
            <section className="min-w-0 space-y-3 rounded-3xl border border-emerald-200 bg-white/90 p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                <h2 className="font-black text-emerald-950">
                  🏙️ {company.name}
                </h2>
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
                    cameraEnabled={camera}
                    reducedMotion={reduced}
                    buildingLabels={labels}
                  />
                </MapBoundary>
              )}
              <div
                role="status"
                className="min-h-6 px-2 text-sm font-bold text-emerald-800"
              >
                {comboNotice ||
                  (pending
                    ? `${BUILDINGS[pending].name}: 빈 땅을 눌러 건설하세요.`
                    : "건물을 누르면 관련 업무가 열려요.")}
              </div>
              <nav
                className="grid grid-cols-3 gap-2 sm:grid-cols-6"
                aria-label="회사 업무"
              >
                {COMPANY_TASKS.map((t) => (
                  <button
                    key={t.id}
                    aria-pressed={task === t.id}
                    className={`min-h-16 rounded-2xl px-2 py-3 text-sm font-bold ${task === t.id ? "bg-emerald-700 text-white shadow" : "bg-slate-100 text-slate-700"}`}
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
                  건물 목록으로 선택하기
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {company.buildings.map((b) => (
                    <button
                      className="btn-ghost"
                      key={b.id}
                      onClick={() => choose(taskForBuilding(b.type), b.id)}
                    >
                      {BUILDINGS[b.type].emoji} {BUILDINGS[b.type].name} (
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
              className="min-w-0 scroll-mt-40 space-y-3 rounded-3xl border border-slate-200 bg-white p-4 outline-none xl:sticky xl:top-36"
            >
              <div className="flex justify-between gap-2">
                <h2 className="text-xl font-black">
                  {COMPANY_TASKS.find((t) => t.id === task)?.icon}{" "}
                  {COMPANY_TASKS.find((t) => t.id === task)?.label}
                </h2>
                {selected && (
                  <span className="text-xs text-slate-500">
                    {BUILDINGS[selected.type].name} Lv.{selected.level}
                  </span>
                )}
              </div>
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
                          ? `사기 ${Math.round(company.morale)}점 · 안전 ${Math.round(company.safety)}점`
                          : task === "sales"
                            ? `지난 매출 ${formatMoney(company.lastRevenue)}`
                            : `건물 ${company.buildings.length}개 · 인접 조합 ${combos.length}개`}
                </p>
              </div>
              {locked(task) ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  🔒{" "}
                  {getFeatureUnlockTurn(game.gameLength, "buildingsResearch")}
                  턴(분기)에 열려요. 지금은 생산과 판매를 해 보세요.
                </p>
              ) : task === "construction" ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold">
                    내 선택 · 건물과 빈 땅을 차례로 선택하세요
                  </p>
                  {selected && (
                    <div className="rounded-xl border p-3 text-sm">
                      <b>{BUILDINGS[selected.type].name}</b>
                      <p>
                        유지비{" "}
                        {formatMoney(
                          BUILDINGS[selected.type].upkeep * selected.level,
                        )}
                        /턴 ·{" "}
                        {selected.turnsLeft > 0
                          ? `공사 ${selected.turnsLeft}턴 남음`
                          : "운영 중"}
                      </p>
                      <button
                        className="btn-primary mt-2"
                        disabled={
                          selected.turnsLeft > 0 ||
                          selected.level >= BUILDINGS[selected.type].maxLevel ||
                          company.cash <
                            buildingCostFor(selected.type, selected.level + 1)
                        }
                        onClick={() => once(() => upgrade(selected.id))}
                      >
                        업그레이드 ·{" "}
                        {formatMoney(
                          buildingCostFor(selected.type, selected.level + 1),
                        )}{" "}
                        즉시 지불
                      </button>
                      <button
                        className="btn-ghost mt-2"
                        onClick={() => {
                          if (
                            window.confirm(
                              `${BUILDINGS[selected.type].name}을 매각할까요?`,
                            )
                          )
                            once(() => {
                              demolish(selected.id);
                              setSelectedId(null);
                            });
                        }}
                      >
                        건물 매각
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {BUILDING_LIST.filter((b) =>
                      game.config.enabledBuildings.includes(b.type),
                    ).map((b) => (
                      <button
                        key={b.type}
                        disabled={
                          company.cash <
                          buildingConstructionCost(company, b.type)
                        }
                        aria-pressed={pending === b.type}
                        className={`min-h-20 rounded-xl border p-2 text-left text-xs disabled:opacity-40 ${pending === b.type ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-300" : "border-slate-200"}`}
                        onClick={() => setPending(b.type)}
                      >
                        <b className="block text-sm">
                          {b.emoji} {b.name}
                        </b>
                        {formatMoney(buildingConstructionCost(company, b.type))}{" "}
                        즉시 지불
                        <br />
                        유지비 {formatMoney(b.upkeep)}/턴 · 공사{" "}
                        {game.config.instantBuild ? 0 : b.buildTurns}턴
                      </button>
                    ))}
                  </div>
                  {pending && (
                    <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                      <p>{BUILDINGS[pending].description}</p>
                      {!recommendation && <p className="mt-2">빈 땅이 없어요. 기존 건물을 업그레이드하거나 공간을 확보하세요.</p>}
                      {recommendation && (
                        <p className="mt-2">
                          예상 인접 효과:{" "}
                          {recommendation.combos.length
                            ? recommendation.combos
                                .map((c) => `${c.name} · ${c.description}`)
                                .join(" / ")
                            : "이 칸에서는 새 조합이 없어요."}
                        </p>
                      )}
                      {recommendation && (
                        <button
                          className="btn-primary mt-2"
                          onClick={() =>
                            onCell(recommendation.x, recommendation.y)
                          }
                        >
                          추천 칸에 짓기
                        </button>
                      )}
                      <button
                        className="btn-ghost mt-2"
                        onClick={() => setPending(null)}
                      >
                        건설 취소
                      </button>
                    </div>
                  )}
                  {combos.map((c, i) => (
                    <p key={i} className="text-sm text-emerald-800">
                      {c.emoji} {c.name} · {c.description}
                    </p>
                  ))}
                </div>
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
                  {selected && unlocked && (
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
            onCompanyTask={(id) => choose(id === "workplace" ? "staff" : id === "quality" ? "research" : id === "building-combo" ? "construction" : id === "healthy-debt" ? "finance" : "production")}
            onNavigate={(d) => {
              if (d === "company" || d === "home") choose("production");
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

"use client";

import { useRef, useState } from "react";
import {
  BUILDINGS,
  BUILDING_LIST,
  buildingConstructionCost,
  buildingCostFor,
  buildingSellRefund,
  cashSafetyLine,
  estimateUpgradeImpact,
  findBestBuildingCell,
  isBuildingTypeUnlocked,
  currentSeason,
  moveCost,
  SEASONS,
  VILLAGE_BUILDINGS,
  getFeatureUnlockTurn,
  isFeatureUnlocked,
  type BuildingImpact,
  type BuildingType,
  type Company,
  type GameState,
  type PlacedBuilding,
} from "@/lib/engine";
import { formatMoney, formatNum, withJosa } from "@/lib/format";
import { BUILDING_IMG } from "@/lib/assetMap";
import {
  BUILDING_ROLE_LABELS,
  buildingEffectChips,
  buildingRole,
  buildingTagline,
  getCityCollection,
  getCityProgress,
  unlockStageFor,
  type BuildingRole,
} from "@/lib/ui/cityBuilder";
import { useGameStore } from "@/store/gameStore";
import { Term } from "./Term";

const won = (value: number) => `${formatMoney(Math.round(value))}원`;
const signedWon = (value: number) => `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(Math.round(value)))}원`;

const ROLE_STYLE: Record<BuildingRole, string> = {
  money: "border-t-amber-400",
  smart: "border-t-indigo-400",
  happy: "border-t-pink-400",
  home: "border-t-lime-400",
  decor: "border-t-rose-300",
  landmark: "border-t-teal-400",
};

type PaletteFilter = "all" | BuildingRole;
const FILTERS: PaletteFilter[] = ["all", "money", "smart", "happy", "home", "decor", "landmark"];

export function BuildingIcon({ type, size = "h-12 w-12" }: { type: BuildingType; size?: string }) {
  const src = BUILDING_IMG[type];
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 object-contain`} draggable={false} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center text-3xl`} aria-hidden>
      {BUILDINGS[type].emoji}
    </span>
  );
}

function LevelStars({ level, max }: { level: number; max: number }) {
  return (
    <span className="text-amber-500" aria-label={`레벨 ${level} / ${max}`}>
      {"★".repeat(level)}
      <span className="text-slate-300">{"★".repeat(Math.max(0, max - level))}</span>
    </span>
  );
}

export function ConstructionPanel({
  game,
  company,
  pending,
  onPick,
  selected,
  onCloseSelected,
  preview,
  needsConfirm,
  picked = false,
  onBuildPreview,
  onMove,
  initialFilter,
}: {
  game: GameState;
  company: Company;
  pending: BuildingType | null;
  onPick: (type: BuildingType | null) => void;
  selected?: PlacedBuilding;
  onCloseSelected: () => void;
  preview: BuildingImpact | null;
  needsConfirm: boolean;
  /** The player tapped a plot (instead of using the recommendation). */
  picked?: boolean;
  onBuildPreview: () => void;
  /** Start moving a building or decoration to another plot. */
  onMove?: (buildingId: string) => void;
  /** Open the palette on one category (e.g. 🌼 꾸미기 from the village tab). */
  initialFilter?: BuildingRole;
}) {
  const season = currentSeason(game.macro);
  const villageOpen = isFeatureUnlocked(game, "village");
  const safetyLine = cashSafetyLine(company);
  const [filter, setFilter] = useState<PaletteFilter>(initialFilter ?? "all");
  const [showLocked, setShowLocked] = useState(false);
  // Homes and decorations wait for the 🏘️ village lesson in guided games.
  const enabled = BUILDING_LIST.filter((b) => game.config.enabledBuildings.includes(b.type) && (villageOpen || !VILLAGE_BUILDINGS.includes(b.type)));
  // Open buildings first, then the ones a bigger city will unlock.
  const types = enabled
    .filter((b) => (filter === "all" || buildingRole(b.type) === filter) && (showLocked || isBuildingTypeUnlocked(company, b.type)))
    .sort((a, b) => {
      const lockA = isBuildingTypeUnlocked(company, a.type) ? 0 : a.unlockCityScore ?? 0;
      const lockB = isBuildingTypeUnlocked(company, b.type) ? 0 : b.unlockCityScore ?? 0;
      return lockA - lockB;
    });

  return (
    <div className="space-y-3">
      {selected && (
        <SelectedBuildingCard key={selected.id} game={game} company={company} building={selected} onClose={onCloseSelected} onMove={onMove} />
      )}

      <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950 ring-1 ring-sky-200">
        🛟 <Term term="비상금">비상금</Term> <b>{won(safetyLine)}</b>은 남겨 두세요. 갑자기 손해가 나도 버틸 수 있어요.
      </p>



      {pending && preview && (
        <BuildPreviewCard
          game={game}
          impact={preview}
          needsConfirm={needsConfirm}
          picked={picked}
          onBuild={onBuildPreview}
          onCancel={() => onPick(null)}
        />
      )}
      {pending && !preview && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          빈 땅이 없어요. 있는 건물을 업그레이드하거나, 덜 필요한 건물을 팔아 자리를 만들어 보세요.
          <button className="btn-ghost mt-2 w-full" onClick={() => onPick(null)}>
            건설 취소
          </button>
        </div>
      )}

      <section aria-labelledby="build-palette-title">
        <h3 id="build-palette-title" className="mb-2 flex flex-wrap items-center justify-between gap-1 text-sm font-black text-slate-800">
          <span>🧱 무엇을 지을까요?</span>
          <span className="text-[13px] font-bold text-slate-500">고른 뒤 지도의 빈 땅을 눌러요</span>
        </h3>
        <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="건물 종류 고르기">
          {FILTERS.filter((f) => villageOpen || (f !== "home" && f !== "decor")).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`!min-h-11 rounded-full px-3.5 py-1 text-sm font-bold ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {f === "all" ? "전체" : `${BUILDING_ROLE_LABELS[f].emoji} ${BUILDING_ROLE_LABELS[f].label.replace(" 건물", "")}`}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {types.map((def) => {
            const cost = buildingConstructionCost(company, def.type);
            const shortfall = cost - company.cash;
            const owned = company.buildings.some((b) => b.type === def.type);
            const unlocked = isBuildingTypeUnlocked(company, def.type);
            const stage = unlockStageFor(def.type);
            const best = unlocked ? findBestBuildingCell(company, def.type, game.config.mapSize) : null;
            const comboReady = (best?.combos.length ?? 0) > 0;
            const role = buildingRole(def.type);
            const active = pending === def.type;
            const outOfSeason = !!def.season && def.season !== season;
            if (!unlocked) {
              return (
                <div
                  key={def.type}
                  className={`relative flex flex-col items-center rounded-xl border border-t-4 border-dashed border-slate-300 bg-slate-50 p-2 text-center ${ROLE_STYLE[role]}`}
                  aria-label={`${def.name}: ${withJosa(stage?.label ?? "더 큰 도시", "이", "가")} 되면 열려요${def.unlockStars ? ` (마을 별 ${def.unlockStars}개여도 열려요)` : ""}`}
                >
                  <span className="opacity-40 grayscale">
                    <BuildingIcon type={def.type} />
                  </span>
                  <b className="mt-1 text-sm leading-tight text-slate-500">{def.name}</b>
                  <span className="text-[13px] leading-tight text-slate-400">{buildingTagline(def.type)}</span>
                  <span className="mt-1 rounded-md bg-white px-1.5 py-0.5 text-[13px] font-bold text-slate-600">
                    🔒 {stage?.emoji} {withJosa(stage?.label ?? "더 큰 도시", "이", "가")} 되면 열려요
                  </span>
                  {def.unlockStars && (
                    <span className="mt-1 rounded-md bg-lime-50 px-1.5 py-0.5 text-[13px] font-bold text-lime-800">
                      또는 마을 <span className="text-amber-500">★{def.unlockStars}</span>
                    </span>
                  )}
                </div>
              );
            }
            return (
              <button
                key={def.type}
                type="button"
                disabled={shortfall > 0 || !best || outOfSeason}
                aria-pressed={active}
                onClick={() => onPick(active ? null : def.type)}
                className={`relative flex flex-col items-center rounded-xl border border-t-4 bg-white p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${ROLE_STYLE[role]} ${
                  active ? "border-emerald-500 ring-2 ring-emerald-400" : "border-slate-200 hover:border-slate-300 hover:shadow"
                }`}
              >
                <div className="flex min-h-5 w-full flex-wrap justify-between gap-1">
                {comboReady && (
                  <span className=" rounded-full bg-amber-100 px-1.5 py-0.5 text-[13px] font-black text-amber-700">
                    ✨조합
                  </span>
                )}
                {def.season && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[13px] font-black ${outOfSeason ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-700"}`}>
                    {SEASONS[def.season].emoji} {outOfSeason ? `${SEASONS[def.season].name}에만` : "지금만!"}
                  </span>
                )}
                {!owned && !def.season && (
                  <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[13px] font-black text-violet-700">
                    NEW
                  </span>
                )}
                </div>
                <BuildingIcon type={def.type} />
                <b className="mt-1 text-sm leading-tight text-slate-900">{def.name}</b>
                <span className="text-[13px] leading-tight text-slate-500">{buildingTagline(def.type)}</span>
                <span className="mt-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[13px] font-bold text-slate-700">
                  {buildingEffectChips(def.type)[0]}
                </span>
                <span className="mt-1 text-[13px] font-black text-slate-900">🪙 {won(cost)}</span>
                <span className="text-[13px] text-slate-500">{def.upkeep > 0 ? `매 턴 유지비 ${won(def.upkeep)}` : "유지비 없음 ✨"}</span>
                {!game.config.instantBuild && def.buildTurns > 0 && (
                  <span className="text-[13px] text-slate-500">공사 {def.buildTurns}턴</span>
                )}
                {shortfall > 0 && (
                  <span className="mt-1 text-[13px] font-bold text-rose-600">🔒 {won(shortfall)} 더 필요</span>
                )}
                {!best && <span className="mt-1 text-[13px] font-bold text-rose-600">빈 땅이 없어요</span>}
                {outOfSeason && def.season && (
                  <span className="mt-1 text-[13px] font-bold text-slate-500">{SEASONS[def.season].emoji} {SEASONS[def.season].name}이 오면 살 수 있어요</span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn-ghost mt-3 w-full" aria-expanded={showLocked} onClick={() => setShowLocked((v) => !v)}>
          {showLocked ? "지금 지을 수 있는 건물만 보기" : "🔒 앞으로 열릴 건물도 보기"}
        </button>
        {!villageOpen && (
          <p className="mt-2 rounded-xl bg-lime-50 px-3 py-2 text-sm font-bold text-lime-900 ring-1 ring-lime-200">
            🏘️ {getFeatureUnlockTurn(game.gameLength, "village")}턴에 마을이 열려요! 주택을 지으면 이웃이 이사 오고, 꾸미기 소품도 놓을 수 있어요.
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          🔓 도시가 커지거나 마을 별이 오르면 새 건물이 열려요. 같은 건물을 또 지으면 값이 조금씩 올라요.
        </p>
      </section>

      <CityCollection game={game} company={company} />
    </div>
  );
}

function BuildPreviewCard({
  game,
  impact,
  needsConfirm,
  picked,
  onBuild,
  onCancel,
}: {
  game: GameState;
  impact: BuildingImpact;
  needsConfirm: boolean;
  picked: boolean;
  onBuild: () => void;
  onCancel: () => void;
}) {
  const def = BUILDINGS[impact.type];
  const turnsLeft = Math.max(0, game.maxTurns - game.turn);
  const earns = impact.profitDelta > 500;
  const happyGains = [
    impact.village.population > 0 ? `👥 주민 +${impact.village.population}명` : null,
    impact.village.happiness > 0 ? `🏘️ 마을 행복 +${impact.village.happiness}` : null,
    impact.gains.morale > 0 ? `😊 직원 행복 +${impact.gains.morale}` : null,
    impact.gains.reputation > 0 ? `⭐ 평판 +${impact.gains.reputation}` : null,
    impact.gains.research > 0 ? `🔬 연구력 +${impact.gains.research}` : null,
    impact.gains.executiveSlots > 0 ? `👔 임원 자리 +${impact.gains.executiveSlots}` : null,
  ].filter(Boolean);
  const boostsCustomers = !!(def.effects.marketingReach || def.effects.logistics);
  const addsCapacity = !!def.effects.productionCapacity;

  return (
    <section
      className={`rounded-2xl p-3 ring-2 ${needsConfirm ? "bg-amber-50 ring-amber-300" : "bg-emerald-50 ring-emerald-300"}`}
      aria-labelledby="build-preview-title"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <BuildingIcon type={impact.type} size="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h3 id="build-preview-title" className="font-black text-slate-900">
            🔍 {def.name} 미리보기
          </h3>
          <p className="text-sm text-slate-600">
            {picked ? "📍 고른 칸" : "⭐ 추천 칸"}({impact.x + 1}열 {impact.y + 1}줄)에 지으면
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-xl bg-white p-2.5 ring-1 ring-black/5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-slate-600">매 턴 남는 돈</span>
          <span className={`text-lg font-black ${earns ? "text-emerald-700" : "text-amber-700"}`}>
            {signedWon(impact.profitDelta)}
            <span className="text-[13px] font-bold">/턴</span>
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          번 돈 {signedWon(impact.revenueDelta)} · <Term term="유지비">유지비</Term> −{won(impact.upkeepDelta)}
          {impact.gains.capacity > 0 && ` · 최대 생산 +${formatNum(impact.gains.capacity)}개`}
          {impact.gains.customersPercent > 0 && ` · 손님 +${impact.gains.customersPercent}%`}
        </p>
        <p className="mt-1.5 text-base font-bold text-slate-800">
          {impact.paybackTurns != null
            ? impact.paybackTurns <= turnsLeft
              ? `⏳ 약 ${impact.paybackTurns}턴이면 건설비 ${won(impact.cost)}을 되찾아요`
              : `⏳ 본전까지 약 ${impact.paybackTurns}턴 — 남은 ${turnsLeft}턴 안에는 어려워요`
            : happyGains.length > 0
              ? `💛 돈 대신 ${happyGains.join(" · ")}`
              : "💤 지금은 이익이 늘지 않아요"}
        </p>
        <p className="text-sm text-slate-500">
          본전을 빨리 찾을수록(<Term term="회수 기간">회수 기간</Term>이 짧을수록) 좋은 선택이에요.
        </p>
      </div>

      {boostsCustomers && impact.after.limitedBy === "capacity" && (
        <p className="mt-2 rounded-lg bg-white/80 p-2 text-sm text-slate-700">
          🏭 지금은 공장이 부족해서 손님이 늘어도 다 못 팔아요. 공장을 먼저 지으면 효과가 커져요.
        </p>
      )}
      {addsCapacity && impact.before.limitedBy === "demand" && (
        <p className="mt-2 rounded-lg bg-white/80 p-2 text-sm text-slate-700">
          🛍️ 지금은 손님보다 만들 수 있는 양이 더 많아요. 매장·물류창고로 손님을 먼저 늘려 보세요.
        </p>
      )}
      {(impact.village.population !== 0 || impact.village.happiness !== 0 || impact.village.starsAfter !== impact.village.starsBefore) && (
        <p className="mt-2 rounded-lg bg-lime-100 p-2 text-sm font-bold text-lime-900">
          🏘️ 마을:
          {impact.village.population !== 0 && ` 👥 주민 ${impact.village.population > 0 ? "+" : ""}${impact.village.population}명`}
          {impact.village.happiness !== 0 && ` · 😊 행복 ${impact.village.happiness > 0 ? "+" : ""}${impact.village.happiness}`}
          {impact.village.starsAfter > impact.village.starsBefore && ` · ⭐ 별 ${impact.village.starsAfter}개 달성!`}
          {impact.village.starsAfter < impact.village.starsBefore && ` · 별이 ${impact.village.starsAfter}개로 줄어요`}
        </p>
      )}
      {impact.combos.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm font-bold text-amber-900">
          ✨ 이 칸에 지으면 {impact.combos.map((c) => `${c.emoji} ${c.name}`).join(", ")} 완성!
        </p>
      )}

      <div
        className={`mt-2 rounded-lg p-2 text-sm ${impact.belowSafetyLine ? "bg-rose-100 font-bold text-rose-900" : "bg-white/80 text-slate-700"}`}
      >
        🪙 지으면 남는 돈 <b>{won(impact.cashAfter)}</b>
        {impact.belowSafetyLine
          ? ` — 비상금 ${won(impact.safetyLine)}보다 적어져요! 갑자기 손해가 나면 위험해요.`
          : ` · 비상금 ${won(impact.safetyLine)} 넘게 남아요 ✓`}
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className={needsConfirm ? "btn-bull !bg-amber-500" : "btn-primary"} onClick={onBuild}>
          {needsConfirm ? "⚠️ 그래도 여기에 짓기" : picked ? `✅ 여기에 짓기 (${won(impact.cost)})` : `⭐ 추천 칸에 짓기 (${won(impact.cost)})`}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </section>
  );
}

function SelectedBuildingCard({
  game,
  company,
  building,
  onClose,
  onMove,
}: {
  game: GameState;
  company: Company;
  building: PlacedBuilding;
  onClose: () => void;
  onMove?: (buildingId: string) => void;
}) {
  const upgrade = useGameStore((s) => s.upgrade);
  const demolish = useGameStore((s) => s.demolish);
  const [confirmSell, setConfirmSell] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const lock = useRef(0);
  const once = (action: () => void) => {
    if (Date.now() < lock.current) return;
    lock.current = Date.now() + 500;
    action();
  };
  const def = BUILDINGS[building.type];
  const maxed = building.level >= def.maxLevel;
  const building_ = building.turnsLeft > 0;
  const upgradeCost = buildingCostFor(building.type, building.level + 1);
  const impact = maxed ? null : estimateUpgradeImpact(game, company, building.id);
  const refund = buildingSellRefund(building);
  const shortfall = upgradeCost - company.cash;

  return (
    <section className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-3" aria-labelledby="selected-building-title">
      <div className="flex items-start gap-2">
        <BuildingIcon type={building.type} />
        <div className="min-w-0 flex-1">
          <h3 id="selected-building-title" className="font-black text-slate-900">
            {def.name} <LevelStars level={building.level} max={def.maxLevel} />
          </h3>
          <p className="text-[13px] text-slate-600">{def.description}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {buildingEffectChips(building.type, building.level).map((chip) => (
              <span key={chip} className="rounded-md bg-white px-1.5 py-0.5 text-[13px] font-bold text-slate-700">
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            {def.decor ? "유지비 없음 · 이웃 집을 행복하게 해요" : (
              <>
                매 턴 유지비 {won(def.upkeep * building.level)} ·{" "}
                {building_ ? `공사 ${building.turnsLeft}턴 남음` : "열심히 일하는 중"}
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn-ghost !min-h-11 min-w-11 !px-2 text-base" onClick={onClose} aria-label="선택 닫기">
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="선택한 건물 관리">
        <button type="button" className="btn-primary min-h-16 flex-col !gap-1 !px-1" aria-expanded={showUpgrade} disabled={maxed || building_} onClick={() => { setShowUpgrade(!showUpgrade); setConfirmSell(false); }}>
          <span aria-hidden>⬆️</span><span>키우기</span>
        </button>
        <button type="button" className="btn-ghost min-h-16 flex-col !gap-1 !px-1" disabled={!onMove || building_ || company.cash < moveCost(building.type)} onClick={() => onMove?.(building.id)}>
          <span aria-hidden>🚚</span><span>옮기기</span>
        </button>
        <button type="button" className="btn-ghost min-h-16 flex-col !gap-1 !px-1 !bg-rose-100 !text-rose-900" aria-expanded={confirmSell} onClick={() => { setConfirmSell(!confirmSell); setShowUpgrade(false); }}>
          <span aria-hidden>🪙</span><span>{def.decor ? "치우기" : "팔기"}</span>
        </button>
      </div>
      <p className="mt-2 text-[13px] text-slate-600">{building_ ? "공사가 끝나면 키우거나 옮길 수 있어요." : maxed ? "최고 레벨이에요. 옮기기와 팔기는 할 수 있어요." : "할 일을 골라요. 비용을 보고 결정할 수 있어요."}</p>
      <p className="mt-1 text-[13px] text-slate-600">옮기기 {moveCost(building.type) ? won(moveCost(building.type)) : "무료"} · 팔면 {won(refund)} 돌려받아요.{company.cash < moveCost(building.type) ? " 옮길 돈이 부족해요." : ""}</p>

      {showUpgrade && !maxed && impact && (
        <div className="mt-2 rounded-xl bg-white p-2.5 text-sm ring-1 ring-black/5">
          <div className="font-black text-slate-800">⬆️ Lv.{building.level + 1}로 키우면</div>
          <p className="mt-0.5 text-slate-600">
            남는 돈 {signedWon(impact.profitDelta)}/턴
            {impact.gains.capacity > 0 && ` · 생산 +${formatNum(impact.gains.capacity)}개`}
            {impact.gains.customersPercent > 0 && ` · 손님 +${impact.gains.customersPercent}%`}
            {impact.gains.morale > 0 && ` · 행복 +${impact.gains.morale}`}
            {impact.gains.reputation > 0 && ` · 평판 +${impact.gains.reputation}`}
            {impact.paybackTurns != null && ` · 본전 약 ${impact.paybackTurns}턴`}
          </p>
          <p className="text-slate-500">빈 땅을 쓰지 않고 회사를 키울 수 있어요.</p>
          {impact.belowSafetyLine && (
            <p className="mt-1 font-bold text-rose-700">⚠️ 업그레이드하면 비상금보다 돈이 적어져요.</p>
          )}
        </div>
      )}

      <div className="mt-2 grid gap-2">
        {showUpgrade && !(def.decor && maxed) && (
        <button
          type="button"
          className="btn-primary"
          disabled={maxed || building_ || shortfall > 0}
          onClick={() => once(() => { upgrade(building.id); setShowUpgrade(false); })}
        >
          {maxed
            ? "🏆 최고 레벨이에요"
            : building_
              ? "공사가 끝나면 키울 수 있어요"
              : shortfall > 0
                ? `🔒 ${won(shortfall)} 더 필요해요`
                : `⬆️ ${won(upgradeCost)} 내고 키우기`}
        </button>
        )}
        {confirmSell ? (
          <div className="rounded-xl bg-rose-50 p-2 text-sm text-rose-900 ring-1 ring-rose-200">
            <b>{def.name}</b>{def.decor ? "을 치울까요?" : "을 팔까요?"} <b>{won(refund)}</b>을 돌려받고 이 칸은 빈 땅이 돼요.
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-bull !bg-rose-600"
                onClick={() =>
                  once(() => {
                    demolish(building.id);
                    setConfirmSell(false);
                    onClose();
                  })
                }
              >
                네, 팔게요
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmSell(false)}>
                그만두기
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CityCollection({ game, company }: { game: GameState; company: Company }) {
  const progress = getCityProgress(company);
  const collection = getCityCollection(game, company);
  const foundCombos = collection.combos.filter((entry) => entry.found).length;

  return (
    <section className="rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-3 ring-1 ring-violet-200" aria-labelledby="city-progress-title">
      <h3 id="city-progress-title" className="flex items-center justify-between gap-2 font-black text-slate-900">
        <span>
          {progress.stage.emoji} 우리 도시: {progress.stage.label}
        </span>
        <span className="text-[13px] font-bold text-violet-700">도시 점수 {progress.score}</span>
      </h3>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
      </div>
      <p className="mt-1 text-[13px] text-slate-600">
        {progress.next
          ? `${progress.next.emoji} ${progress.next.label}까지 ${progress.pointsToNext}점! 건물 레벨 1개 = 1점, 조합 1개 = 2점`
          : "최고 단계 드래곤 시티에 도착했어요! 🎉"}
      </p>

      <details className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-black text-violet-800">🏅 건물·조합 도감 펼치기</summary>
      <h4 className="mt-3 text-[13px] font-black text-slate-700">🏅 건물 도감</h4>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {collection.buildings.map((entry) => (
          <div
            key={entry.type}
            className={`flex flex-col items-center rounded-lg bg-white p-1 text-center ring-1 ring-slate-200 ${entry.count ? "" : "opacity-40 grayscale"}`}
            title={BUILDINGS[entry.type].name}
          >
            <BuildingIcon type={entry.type} size="h-8 w-8" />
            <span className="text-[13px] font-bold leading-tight text-slate-700">{BUILDINGS[entry.type].name.split("·")[0]}</span>
            <span className="text-[13px] text-slate-500">{entry.count ? `×${entry.count} · Lv${entry.topLevel}` : "?"}</span>
          </div>
        ))}
      </div>

      <h4 className="mt-3 text-[13px] font-black text-slate-700">
        🧩 <Term term="인접 보너스">조합</Term> 도감 {foundCombos}/{collection.combos.length}
      </h4>
      <ul className="mt-1 grid gap-1">
        {collection.combos.map(({ combo, found }) => (
          <li
            key={combo.id}
            className={`rounded-lg px-2 py-1 text-[13px] ${found ? "bg-amber-100 font-bold text-amber-900" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {found ? (
              <>
                {combo.emoji} {combo.name} ✓ <span className="font-normal">{combo.description}</span>
              </>
            ) : (
              <>
                {BUILDINGS[combo.pair[0]].emoji} {BUILDINGS[combo.pair[0]].name} + {BUILDINGS[combo.pair[1]].emoji}{" "}
                {BUILDINGS[combo.pair[1]].name} 붙이면 = ❓
              </>
            )}
          </li>
        ))}
      </ul>
      </details>
    </section>
  );
}

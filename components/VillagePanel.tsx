"use client";

import {
  BUILDINGS,
  BUILDING_LIST,
  demandLevel,
  isBuildingTypeUnlocked,
  nextStarGoal,
  villageStats,
  type BuildingType,
  type Company,
  type DemandLevel,
  type GameState,
} from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { Term } from "./Term";

// 🏘️ 마을: a SimCity-style glance at the village. How many people live
// here, how happy they are, what the village is asking for, and what the next
// star needs. Every suggestion is one tap away from the build screen.

const DEMANDS: { key: "home" | "shop" | "job"; emoji: string; label: string; builds: BuildingType[] }[] = [
  { key: "home", emoji: "🏠", label: "집", builds: ["house", "dorm"] },
  { key: "shop", emoji: "🛍️", label: "가게", builds: ["store", "cafeteria"] },
  { key: "job", emoji: "🏭", label: "일자리", builds: ["factory", "office", "warehouse"] },
];

const LEVEL_TEXT: Record<DemandLevel, { text: string; bar: string; chip: string }> = {
  high: { text: "많이 필요해요", bar: "bg-rose-500", chip: "bg-rose-100 text-rose-800" },
  some: { text: "조금 필요해요", bar: "bg-amber-400", chip: "bg-amber-100 text-amber-800" },
  enough: { text: "충분해요", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
};

export function Stars({ count, size = "text-xl" }: { count: number; size?: string }) {
  return (
    <span className={`${size} leading-none tracking-tight`} aria-label={`마을 별 ${count}개`}>
      <span className="text-amber-400">{"★".repeat(count)}</span>
      <span className="text-slate-300">{"★".repeat(Math.max(0, 5 - count))}</span>
    </span>
  );
}

export function VillagePanel({
  game,
  company,
  happyMap,
  onToggleHappyMap,
  onBuild,
}: {
  game: GameState;
  company: Company;
  happyMap: boolean;
  onToggleHappyMap: () => void;
  /** Open the build screen with this building picked. */
  onBuild: (type: BuildingType) => void;
}) {
  const stats = villageStats(company.buildings);
  const next = nextStarGoal(stats);
  const opensNext = next
    ? BUILDING_LIST.filter((def) => def.unlockStars === next.stars && game.config.enabledBuildings.includes(def.type) && !isBuildingTypeUnlocked(company, def.type))
    : [];
  const fill = stats.housing > 0 ? Math.round((stats.population / stats.housing) * 100) : 0;

  return (
    <div className="space-y-3">
      <section className="village-hero rounded-2xl p-3 ring-1 ring-lime-200" aria-labelledby="village-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="village-title" className="text-base font-black text-slate-900">
            <Term term="마을 별점">마을 별점</Term>
          </h3>
          <Stars count={stats.stars} size="text-2xl" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/90 px-1.5 py-2 ring-1 ring-black/5">
            <div className="text-xl" aria-hidden>👥</div>
            <div className="text-xs font-bold text-slate-500"><Term term="주민">주민</Term></div>
            <div className="text-base font-black text-slate-900">{stats.population}명</div>
          </div>
          <div className="rounded-xl bg-white/90 px-1.5 py-2 ring-1 ring-black/5">
            <div className="text-xl" aria-hidden>🛏️</div>
            <div className="text-xs font-bold text-slate-500">빈 집 포함 자리</div>
            <div className="text-base font-black text-slate-900">{stats.housing}명</div>
          </div>
          <div className="rounded-xl bg-white/90 px-1.5 py-2 ring-1 ring-black/5">
            <div className="text-xl" aria-hidden>{stats.happiness >= 70 ? "😄" : stats.happiness >= 50 ? "🙂" : "😟"}</div>
            <div className="text-xs font-bold text-slate-500"><Term term="마을 행복">마을 행복</Term></div>
            <div className="text-base font-black text-slate-900">{stats.happiness}점</div>
          </div>
        </div>
        {stats.housing === 0 ? (
          <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">
            🏡 아직 주민이 살 집이 없어요. <b>주택</b>을 지으면 주민이 이사 와서 우리 물건을 사는 동네 손님이 돼요.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            집 {fill}%가 찼어요. 마을이 행복할수록 더 많이 이사 와요.
          </p>
        )}
      </section>

      {next && (
        <section className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-labelledby="next-star-title">
          <h3 id="next-star-title" className="flex items-center gap-2 text-base font-black text-amber-950">
            🎯 다음 별까지 <Stars count={next.stars} size="text-base" />
          </h3>
          <ul className="mt-1.5 space-y-1">
            {next.missing.map((item) => (
              <li key={item.emoji} className="flex items-center gap-2 text-sm text-slate-800">
                <span aria-hidden>{item.emoji}</span> {item.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-bold text-amber-900">
            🎁 축하금 {formatMoney(next.reward.cash)}원 · ⭐ 평판 +{next.reward.reputation}
            {opensNext.length > 0 && ` · 🔓 ${opensNext.map((def) => `${def.emoji} ${def.name}`).join(", ")}`}
          </p>
        </section>
      )}
      {!next && (
        <p className="rounded-2xl bg-amber-50 p-3 text-base font-black text-amber-900 ring-1 ring-amber-200">
          🏆 별 5개! 최고로 살기 좋은 마을이에요.
        </p>
      )}

      <section aria-labelledby="village-demand-title">
        <h3 id="village-demand-title" className="mb-1.5 text-base font-black text-slate-800">📣 마을이 원하는 것</h3>
        <div className="space-y-2">
          {DEMANDS.map((d) => {
            const value = stats.demand[d.key];
            const level = LEVEL_TEXT[demandLevel(value)];
            const builds = d.builds.filter(
              (type) => game.config.enabledBuildings.includes(type) && isBuildingTypeUnlocked(company, type),
            );
            return (
              <div key={d.key} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-slate-800">
                    <span aria-hidden>{d.emoji}</span> {d.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-black ${level.chip}`}>{level.text}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                  <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${Math.max(4, value)}%` }} />
                </div>
                {demandLevel(value) !== "enough" && builds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {builds.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className="btn-ghost !min-h-11 !px-3 text-sm"
                        onClick={() => onBuild(type)}
                      >
                        {BUILDINGS[type].emoji} {BUILDINGS[type].name} 짓기
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-200" aria-labelledby="village-happy-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="village-happy-title" className="text-base font-black text-slate-800">😊 왜 이만큼 행복할까요?</h3>
          <button
            type="button"
            className={`!min-h-11 rounded-full px-3 text-sm font-black ${happyMap ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"}`}
            aria-pressed={happyMap}
            onClick={onToggleHappyMap}
          >
            🗺️ 행복 지도 {happyMap ? "끄기" : "보기"}
          </button>
        </div>
        <ul className="mt-2 divide-y divide-slate-100">
          {stats.factors.filter((f) => f.value !== 0 || f.label === "기본").map((factor) => (
            <li key={factor.label} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-slate-700"><span aria-hidden>{factor.emoji}</span> {factor.label}</span>
              <b className={factor.label === "기본" ? "text-slate-800" : factor.value > 0 ? "text-emerald-700" : "text-rose-600"}>
                {factor.label === "기본" ? factor.value : `${factor.value > 0 ? "+" : ""}${factor.value}`}
              </b>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          🌳 공원·분수 같은 <Term term="편의 시설">편의 시설</Term> 가까운 땅은 <b className="text-emerald-700">초록</b>,
          공장·발전소 바로 옆은 시끄러워서 <b className="text-rose-600">빨강</b>이에요. 집은 초록 땅에 지어요!
        </p>
      </section>
    </div>
  );
}

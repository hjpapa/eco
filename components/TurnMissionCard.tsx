"use client";

import type { GameState } from "@/lib/engine/types";
import {
  getTurnMissions,
  type MissionDestination,
} from "@/lib/ui/gameExperience";

export function TurnMissionCard({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (destination: MissionDestination) => void;
}) {
  const missions = getTurnMissions(game);
  const completedCount = missions.filter((mission) => mission.done).length;

  return (
    <section className="card overflow-hidden" aria-labelledby="turn-mission-title">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-amber-100 via-orange-50 to-violet-50 px-4 py-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm ring-1 ring-amber-200" aria-hidden>
          🎯
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-amber-700">{game.turn}턴(분기) 모험</p>
          <h2 id="turn-mission-title" className="font-black text-slate-900">
            이번 턴(분기) 도전 2개
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            꼭 해야 하는 숙제가 아니에요. 무엇을 해 볼지 고민될 때 하나씩 도전해 보세요.
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${
            completedCount === missions.length
              ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
              : "bg-white text-violet-700 ring-violet-200"
          }`}
          aria-live="polite"
        >
          ⭐ {completedCount}/{missions.length} 완료
        </div>
      </div>

      <ul className="grid gap-3 p-4 sm:grid-cols-2">
        {missions.map((mission) => {
          const descriptionId = `mission-${mission.id}-description`;
          return (
            <li
              key={mission.id}
              className={`relative overflow-hidden rounded-2xl p-4 ring-1 ${
                mission.done
                  ? "bg-emerald-50 ring-emerald-300"
                  : "bg-white ring-slate-200"
              }`}
            >
              <div className="flex items-start gap-3 pr-12">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm ${
                    mission.done ? "bg-emerald-100" : "bg-slate-100"
                  }`}
                  aria-hidden
                >
                  {mission.emoji}
                </span>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900">
                    {mission.title}
                    <span className="sr-only">{mission.done ? " 완료" : " 진행 중"}</span>
                  </h3>
                  <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-slate-600">
                    {mission.detail}
                  </p>
                </div>
              </div>

              {mission.done ? (
                <span
                  className="absolute right-2 top-3 -rotate-6 rounded-md border-2 border-emerald-600 bg-white/90 px-2 py-0.5 text-xs font-black text-emerald-700 shadow-sm"
                  aria-hidden
                >
                  완료 ✓
                </span>
              ) : null}

              <div className="mt-3 rounded-xl bg-slate-900/5 px-3 py-2 text-xs text-slate-600">
                <span className="font-bold text-slate-500">현재 상태</span>
                <span className={`ml-2 font-black ${mission.done ? "text-emerald-700" : "text-slate-800"}`}>
                  {mission.progress}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigate(mission.destination)}
                aria-describedby={descriptionId}
                className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] ${
                  mission.done
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                }`}
              >
                {mission.done ? "완료한 곳 다시 보기" : mission.actionLabel}
                <span aria-hidden>→</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { MissionDestination };

import Image from "next/image";

import type { GameState } from "@/lib/engine/types";
import {
  getDragonStage,
  getJourneyMilestones,
  type JourneyMilestone,
} from "@/lib/ui/gameExperience";

interface TrailPoint {
  x: number;
  height: number;
}

const FOUR_STOP_HEIGHTS = [16, 39, 64, 88] as const;
const FIVE_STOP_HEIGHTS = [14, 33, 55, 74, 91] as const;
const SIX_STOP_HEIGHTS = [14, 29, 45, 61, 75, 91] as const;

export function MountainJourney({ game }: { game: GameState }) {
  const milestones = getJourneyMilestones(game);
  const dragonStage = getDragonStage(game);
  const points = getTrailPoints(milestones.length);
  const dragonPoint = getCurrentTrailPoint(milestones, points, game.turn);
  const completedTrail = getCompletedTrailPoints(milestones, points, game.turn);
  const campaignProgress = Math.round(
    Math.min(1, Math.max(0, game.turn / Math.max(1, game.maxTurns))) * 100,
  );

  return (
    <section
      className="card overflow-hidden"
      aria-labelledby="mountain-journey-title"
    >
      <div className="bg-gradient-to-br from-indigo-950 via-brand-800 to-sky-700 p-4 text-white sm:p-5">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <div className="absolute inset-2 rounded-full bg-sky-200/25 blur-md" aria-hidden />
            <Image
              src="/assets/mascot/dragon.png"
              alt="산을 오르는 드래곤"
              width={80}
              height={80}
              loading="eager"
              className="relative h-full w-full object-contain drop-shadow-lg motion-safe:animate-floaty"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-sky-200">드래곤 경제 원정대</p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 id="mountain-journey-title" className="text-lg font-black sm:text-xl">
                경제 산길 오르기
              </h2>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold ring-1 ring-white/25">
                {dragonStage.emoji} Lv.{dragonStage.level} {dragonStage.label}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-sky-100 sm:text-sm">
              한 턴(분기)씩 회사를 키우며 새로운 경제 능력이 있는 봉우리를 발견해요.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3 text-xs">
          <div>
            <span className="font-black">{game.turn}/{game.maxTurns}턴(분기)</span>
            <span className="ml-2 text-sky-200">전체 여정 {campaignProgress}%</span>
          </div>
          <div className="text-right text-sky-100">
            {dragonStage.nextLabel
              ? `${dragonStage.nextLabel}까지 ${dragonStage.turnsToNext}턴(분기)`
              : "최고 단계 달성!"}
          </div>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-indigo-950/45 ring-1 ring-white/20"
          role="progressbar"
          aria-label={`경제 산길 전체 진행률, ${game.maxTurns}턴(분기) 중 ${game.turn}턴(분기) 완료`}
          aria-valuemin={0}
          aria-valuemax={game.maxTurns}
          aria-valuenow={game.turn}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-emerald-300 transition-[width] duration-500"
            style={{ width: `${campaignProgress}%` }}
          />
        </div>
      </div>

      <p id="mountain-scroll-help" className="sr-only">
        작은 화면에서는 산길을 좌우로 스크롤해 모든 봉우리를 볼 수 있습니다.
      </p>
      <div
        className="scroll-thin overflow-x-auto bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-50 px-3 pb-2 pt-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
        tabIndex={0}
        aria-describedby="mountain-scroll-help"
        aria-label="경제 산길 봉우리 지도"
      >
        <div
          className="relative mx-auto h-56"
          style={{ minWidth: milestones.length > 4 ? 660 : 480 }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="journey-mountain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.54" />
                <stop offset="100%" stopColor="#15803d" stopOpacity="0.24" />
              </linearGradient>
            </defs>
            <polygon
              points={`${points.map((point) => `${point.x},${100 - point.height}`).join(" ")} 100,100 0,100`}
              fill="url(#journey-mountain)"
            />
            <polyline
              points={points.map((point) => `${point.x},${100 - point.height}`).join(" ")}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.9"
              strokeWidth="2.4"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={completedTrail.map((point) => `${point.x},${100 - point.height}`).join(" ")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="absolute inset-0 m-0 list-none p-0">
            {milestones.map((milestone, index) => {
              const point = points[index];
              const status = milestone.current
                ? "현재 봉우리"
                : milestone.complete
                  ? "지나온 봉우리"
                  : `${milestone.turn}턴(분기)에 열리는 봉우리`;

              return (
                <li
                  key={milestone.id}
                  className="absolute w-24 -translate-x-1/2 text-center"
                  style={{ left: `${point.x}%`, bottom: `${point.height}%` }}
                  aria-current={milestone.current ? "step" : undefined}
                  aria-label={`${milestone.label}, ${status}`}
                >
                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-md ring-4 transition sm:h-12 sm:w-12 ${
                      milestone.current
                        ? "bg-amber-300 ring-amber-100 motion-safe:animate-pulse"
                        : milestone.complete
                          ? "bg-emerald-500 ring-emerald-100"
                          : "bg-slate-300 ring-white/80 grayscale"
                    }`}
                    aria-hidden="true"
                  >
                    {milestone.complete ? milestone.emoji : "🔒"}
                  </div>
                  <div
                    className={`mt-1 rounded-lg px-1.5 py-1 text-xs font-black leading-tight shadow-sm ring-1 ${
                      milestone.current
                        ? "bg-amber-50 text-amber-900 ring-amber-300"
                        : milestone.complete
                          ? "bg-white/95 text-emerald-800 ring-emerald-200"
                          : "bg-white/85 text-slate-500 ring-slate-200"
                    }`}
                  >
                    {milestone.label}
                    <span className="mt-0.5 block text-[11px] font-semibold opacity-75">
                      {milestone.turn === 0 ? "출발" : `${milestone.turn}턴(분기)`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 translate-y-1/2"
            style={{ left: `${dragonPoint.x}%`, bottom: `${dragonPoint.height}%` }}
            aria-hidden="true"
          >
            <Image
              src="/assets/mascot/dragon.png"
              alt=""
              width={54}
              height={54}
              className="h-12 w-12 object-contain drop-shadow-lg motion-safe:animate-floaty"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function getTrailPoints(count: number): TrailPoint[] {
  const heights = count === 4
    ? FOUR_STOP_HEIGHTS
    : count === 5
      ? FIVE_STOP_HEIGHTS
      : SIX_STOP_HEIGHTS;
  return Array.from({ length: count }, (_, index) => ({
    x: count === 1 ? 50 : 5 + (index / (count - 1)) * 90,
    height: heights[index] ?? Math.min(92, 16 + index * 14),
  }));
}

function getCurrentTrailPoint(
  milestones: JourneyMilestone[],
  points: TrailPoint[],
  turn: number,
): TrailPoint {
  if (milestones.length === 0 || points.length === 0) return { x: 5, height: 16 };
  if (turn <= milestones[0].turn) return points[0];

  for (let index = 1; index < milestones.length; index += 1) {
    const next = milestones[index];
    if (turn <= next.turn) {
      const previous = milestones[index - 1];
      const span = Math.max(1, next.turn - previous.turn);
      const ratio = Math.min(1, Math.max(0, (turn - previous.turn) / span));
      return interpolatePoint(points[index - 1], points[index], ratio);
    }
  }
  return points[points.length - 1];
}

function getCompletedTrailPoints(
  milestones: JourneyMilestone[],
  points: TrailPoint[],
  turn: number,
): TrailPoint[] {
  if (points.length === 0) return [];
  const result = milestones.flatMap((milestone, index) =>
    turn >= milestone.turn ? [points[index]] : [],
  );
  const current = getCurrentTrailPoint(milestones, points, turn);
  const last = result[result.length - 1];
  if (!last || last.x !== current.x || last.height !== current.height) result.push(current);
  return result;
}

function interpolatePoint(from: TrailPoint, to: TrailPoint, ratio: number): TrailPoint {
  return {
    x: from.x + (to.x - from.x) * ratio,
    height: from.height + (to.height - from.height) * ratio,
  };
}

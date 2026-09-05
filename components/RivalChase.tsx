import type { GameState, RankingEntry } from "@/lib/engine/types";
import { rankings } from "@/lib/engine/ranking";
import { formatMoney } from "@/lib/format";

import { CompanyMark } from "./CompanyMark";

export function RivalChase({ game }: { game: GameState }) {
  const board = rankings(game);
  const playerIndex = board.findIndex((entry) => entry.isPlayer);
  const player = board[playerIndex];
  if (!player || board.length < 2) return null;

  const ahead = playerIndex > 0 ? board[playerIndex - 1] : null;
  const behind = playerIndex < board.length - 1 ? board[playerIndex + 1] : null;

  return (
    <section className="card overflow-hidden" aria-labelledby="rival-chase-title">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-violet-950 via-brand-800 to-indigo-700 px-4 py-4 text-white">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl ring-1 ring-white/25" aria-hidden>
          {playerIndex === 0 ? "🛡️" : "⚔️"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-violet-200">실시간 회사 대결</p>
          <h2 id="rival-chase-title" className="font-black">
            라이벌 추격전
          </h2>
          <p className="text-xs leading-relaxed text-indigo-100">
            총재산 차이가 작아질수록 추격 게이지가 100에 가까워져요.
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-black ring-1 ring-white/25">
          {playerIndex === 0 ? "🥇 선두 지키기" : `🏔️ 현재 ${playerIndex + 1}위`}
        </span>
      </div>

      <div className={`grid gap-3 p-4 ${ahead && behind ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {ahead ? (
          <RivalPanel
            player={player}
            rival={ahead}
            rivalRank={playerIndex}
            kind="ahead"
          />
        ) : null}
        {behind ? (
          <RivalPanel
            player={player}
            rival={behind}
            rivalRank={playerIndex + 2}
            kind="behind"
          />
        ) : null}
      </div>
    </section>
  );
}

function RivalPanel({
  player,
  rival,
  rivalRank,
  kind,
}: {
  player: RankingEntry;
  rival: RankingEntry;
  rivalRank: number;
  kind: "ahead" | "behind";
}) {
  const gap = Math.max(0, Math.abs(rival.netWorth - player.netWorth));
  const scale = Math.max(1, Math.abs(rival.netWorth), Math.abs(player.netWorth));
  const closeness = Math.round(Math.max(0, Math.min(100, (1 - gap / scale) * 100)));
  const isAhead = kind === "ahead";
  const title = isAhead ? "따라잡을 회사" : "나를 쫓는 회사";
  const gapText = isAhead
    ? `${formatMoney(gap)} 더 성장하면 바로 앞이에요.`
    : `내가 ${formatMoney(gap)} 앞서 있어요.`;

  return (
    <article
      className={`rounded-2xl p-3.5 ring-1 ${
        isAhead ? "bg-violet-50 ring-violet-200" : "bg-amber-50 ring-amber-200"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CompanyMark color={player.logoColor} name={player.name} size="md" />
        <div className="min-w-0 flex-1" aria-hidden>
          <div className="h-1 rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${
                isAhead
                  ? "bg-gradient-to-r from-brand-500 to-violet-500"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
              }`}
              style={{ width: `${closeness}%` }}
            />
          </div>
        </div>
        <CompanyMark color={rival.logoColor} name={rival.name} size="md" />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-black ${isAhead ? "text-violet-700" : "text-amber-700"}`}>
            {isAhead ? "⚔️" : "🔥"} {title}
          </p>
          <h3 className="mt-0.5 truncate font-black text-slate-900">
            {rivalRank}위 {rival.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{gapText}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-700 shadow-sm ring-1 ring-black/5">
          {closeness}%
        </span>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-black/5"
        role="progressbar"
        aria-label={`${player.name}와 ${rival.name}의 추격 게이지 ${closeness}퍼센트`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={closeness}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            isAhead
              ? "bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500"
              : "bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"
          }`}
          style={{ width: `${closeness}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-500">
        <span>차이 큼</span>
        <span>거의 나란히!</span>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import { rankings } from "@/lib/engine";
import type { GameState } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { PRESET_MAP } from "@/lib/data/companyPresets";
import { CompanyMark } from "./CompanyMark";

export function Leaderboard({
  game,
  onVisit,
  canVisit = true,
}: {
  game: GameState;
  onVisit?: (companyId: string) => void;
  canVisit?: boolean;
}) {
  const entries = rankings(game);
  const [showAll, setShowAll] = useState(false);
  const myIndex = entries.findIndex((entry) => entry.isPlayer);
  const topFive = entries.slice(0, 5);
  const summaryEntries = myIndex >= 5 ? [...topFive, entries[myIndex]] : topFive;
  const visibleEntries = showAll ? entries : summaryEntries;
  const rankByCompanyId = new Map(entries.map((entry, index) => [entry.companyId, index]));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">🏆 회사 순위</h3>
          <p className="text-xs text-slate-500">내 총재산(순자산)으로 비교해요.</p>
        </div>
        {myIndex >= 0 && <span className="pill bg-brand-100 font-bold text-brand-700">나는 {myIndex + 1}위</span>}
      </div>
      <div className="space-y-1.5">
        {visibleEntries.map((e, visibleIndex) => {
          const i = rankByCompanyId.get(e.companyId) ?? visibleIndex;
          const separatedPlayer = !showAll && myIndex >= 5 && visibleIndex === visibleEntries.length - 1;
          return (
          <div key={e.companyId}>
            {separatedPlayer && (
              <div className="my-2 flex items-center gap-2 text-xs text-slate-400" aria-hidden>
                <span className="h-px flex-1 bg-slate-200" />
                내 위치
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            )}
          <div
            className={`flex items-center gap-3 rounded-xl p-2.5 ${
              e.isPlayer ? "bg-brand-50 ring-1 ring-brand-300" : "bg-slate-50"
            }`}
          >
            <span className="w-6 text-center text-lg">{medal(i)}</span>
            <CompanyMark color={e.logoColor} mark={PRESET_MAP[e.companyId]?.mark} name={e.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-800">
                {e.name} {e.isPlayer && <span className="text-xs text-brand-600">(나)</span>}
              </div>
              <div className="text-xs text-slate-400">
                회사 가치(기업가치) {formatMoney(e.companyValue)} · 투자 {formatMoney(e.portfolioValue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-800">{formatMoney(e.netWorth)}</div>
              {onVisit && !e.isPlayer && canVisit ? (
                <button
                  className="btn-ghost mt-1 !min-h-11 !px-3 text-sm !text-brand-700"
                  onClick={() => onVisit(e.companyId)}
                >
                  구경 가기 →
                </button>
              ) : null}
            </div>
          </div>
          </div>
          );
        })}
      </div>
      {entries.length > summaryEntries.length && (
        <button className="btn-ghost mt-3 w-full" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "상위 5개와 내 위치만 보기" : `전체 ${entries.length}개 회사 보기`}
        </button>
      )}
    </div>
  );
}

function medal(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
}

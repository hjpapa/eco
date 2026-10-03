"use client";

import { LAYER_LABELS } from "@/lib/engine";
import type { EventTone, GameState, NewsItem } from "@/lib/engine";
import { ICON_NEWS, BUILDING_IMG } from "@/lib/assetMap";
import { CampusStrip } from "./CampusStrip";

const TONE_CLS: Record<EventTone, string> = {
  positive: "border-l-bull bg-green-50",
  negative: "border-l-bear bg-red-50",
  neutral: "border-l-slate-400 bg-slate-50",
};

export function NewsFeed({ game }: { game: GameState }) {
  const items = [...game.news].reverse();
  return (
    <div className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
        <img src={ICON_NEWS} alt="" className="h-7 w-7 object-contain" />
        뉴스 &amp; 사건
      </h3>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto scroll-thin pr-1">
        {items.length === 0 && (
          <div className="relative overflow-hidden rounded-xl bg-slate-50 py-8 text-center">
            <CampusStrip className="absolute inset-x-0 bottom-0 h-14" opacity={0.15} />
            <p className="relative text-sm text-slate-500">아직 큰 사건이 없습니다. 턴을 진행해 보세요.</p>
          </div>
        )}
        {items.map((n) => (
          <NewsCard key={n.id} n={n} />
        ))}
      </div>
    </div>
  );
}

function NewsCard({ n }: { n: NewsItem }) {
  return (
    <div className={`rounded-r-lg border-l-4 p-3 ${TONE_CLS[n.tone]}`}>
      <div className="flex items-start gap-2">
        {n.portraitImg ? (
          <img src={n.portraitImg} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
        ) : (
          <span className="text-lg">{n.emoji}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <b className="text-sm text-slate-800">{n.title}</b>
          </div>
          <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{n.body}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-semibold">
              {LAYER_LABELS[n.layer]}
            </span>
            <span>{n.turn}턴</span>
          </div>
        </div>
      </div>
    </div>
  );
}

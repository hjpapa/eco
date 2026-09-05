"use client";

import Image from "next/image";
import Link from "next/link";
import type { RefObject } from "react";
import type { Company, GameState } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { getDragonStage, getEconomyWeather } from "@/lib/ui/gameExperience";
import { MASCOT_IMG } from "@/lib/assetMap";

export function GameHud({
  game,
  player,
  netWorthValue,
  rank,
  rankingUnlocked,
  muted,
  nextDisabled,
  nextButtonRef,
  onToggleMute,
  onNext,
}: {
  game: GameState;
  player: Company;
  netWorthValue: number;
  rank: number;
  rankingUnlocked: boolean;
  muted: boolean;
  nextDisabled: boolean;
  nextButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleMute: () => void;
  onNext: () => void;
}) {
  const stage = getDragonStage(game);
  const weather = getEconomyWeather(game.macro.phase);
  const campaignProgress = Math.min(100, Math.max(0, (game.turn / Math.max(1, game.maxTurns)) * 100));

  return (
    <div className="relative mx-auto max-w-5xl px-3 pb-2 pt-2 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hud-dragon relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-emerald-100 ring-2 ring-white sm:block">
          <Image src={MASCOT_IMG} alt="" fill sizes="48px" loading="eager" className="object-contain object-top" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-7 w-7 shrink-0 rounded-lg ring-2 ring-white" style={{ background: player.logoColor }} aria-hidden />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-black text-slate-900">{player.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 sm:text-xs">
                <span>{game.turn}/{game.maxTurns}턴(분기)</span>
                <span aria-hidden>·</span>
                <span className="text-violet-700">Lv.{stage.level} {stage.label}</span>
              </div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2" aria-label={`전체 여정 ${Math.round(campaignProgress)}% 진행`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="journey-progress-fill h-full rounded-full" style={{ width: `${campaignProgress}%` }} />
            </div>
            <span className="hidden text-[10px] font-bold text-slate-400 md:block">
              {stage.nextLabel ? `${stage.nextLabel}까지 ${stage.turnsToNext}턴(분기)` : "정상 도착"}
            </span>
          </div>
        </div>

        <div className="hidden items-stretch gap-1.5 lg:flex">
          <HudStat label="내 총재산(순자산)" value={formatMoney(netWorthValue)} tone="wealth" />
          <HudStat label="쓸 수 있는 돈(현금)" value={formatMoney(player.cash)} tone="cash" />
          <HudStat label="회사 순위" value={rankingUnlocked ? `${rank}위` : "🔒 준비 중"} tone="rank" />
        </div>

        <div
          className={`economy-chip economy-chip--${weather.scene} flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 md:px-2.5`}
          title={`${weather.name}: ${weather.headline}`}
          aria-label={`경제 날씨 ${weather.name}. ${weather.headline}`}
        >
          <span className="text-lg" aria-hidden>{weather.emoji}</span>
          <span className="hidden leading-tight md:block">
            <span className="block text-[10px] font-bold text-slate-500">경제 날씨</span>
            <span className="block text-xs font-black text-slate-800">{weather.name}</span>
          </span>
        </div>

        <Link href="/learn?return=/play" aria-label="배우기 메뉴 열기" className="btn-ghost min-h-11 min-w-11 shrink-0 whitespace-nowrap !px-2.5 !py-2 text-xs sm:text-sm">
          <span aria-hidden>📘</span> <span className="hidden min-[420px]:inline">배우기</span>
        </Link>
        <button onClick={onToggleMute} className="btn-ghost hidden min-h-11 min-w-11 shrink-0 !px-2.5 !py-2 sm:inline-flex" title={muted ? "소리 켜기" : "소리 끄기"} aria-label={muted ? "소리 켜기" : "소리 끄기"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          ref={nextButtonRef}
          id="btn-next-turn"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label={game.status === "ended" ? "게임 종료" : "다음 턴(분기) 진행"}
          className="btn-primary next-turn-button min-h-11 min-w-11 shrink-0 whitespace-nowrap !px-3 sm:!px-4"
        >
          {game.status === "ended" ? "게임 종료" : <><span className="hidden sm:inline">다음 턴(분기) </span><span aria-hidden>▶</span></>}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 lg:hidden">
        <HudStat label="총재산" value={formatMoney(netWorthValue)} tone="wealth" compact />
        <HudStat label="현금" value={formatMoney(player.cash)} tone="cash" compact />
        <HudStat label="순위" value={rankingUnlocked ? `${rank}위` : "잠김"} tone="rank" compact />
      </div>
    </div>
  );
}

function HudStat({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  tone: "wealth" | "cash" | "rank";
  compact?: boolean;
}) {
  return (
    <div className={`hud-stat hud-stat--${tone} min-w-0 rounded-xl border px-2.5 ${compact ? "py-1 text-center" : "min-w-24 py-1.5"}`}>
      <div className="truncate text-[10px] font-bold text-slate-500">{label}</div>
      <div className={`${compact ? "text-xs" : "text-sm"} truncate font-black text-slate-900`}>{value}</div>
    </div>
  );
}

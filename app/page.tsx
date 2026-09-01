"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LEVEL_CONFIGS } from "@/lib/engine";
import type { Level } from "@/lib/engine";
import { useGameStore } from "@/store/gameStore";
import { initAudio, playSfx } from "@/lib/audio";
import { formatMoney } from "@/lib/format";
import { COMPANY_PRESETS } from "@/lib/data/companyPresets";
import { getIndustry } from "@/lib/data/industries";
import { HelpModal } from "@/components/HelpModal";

const SPLASH_IMG = "/assets/splash.png";

const LEVELS: Level[] = ["elementary", "middle", "university"];
const LEVEL_EMOJI: Record<Level, string> = {
  elementary: "🧒",
  middle: "🧑‍🎓",
  university: "🎓",
};

const LEVEL_TAGS: Record<Level, string[]> = {
  elementary: ["즉시 건설", "낮은 변동성", "쉬운 용어"],
  middle: ["건설 대기", "인접 보너스", "금리·인플레"],
  university: ["환율·암호화폐", "복합 이벤트", "완전 개방"],
};

export default function Home() {
  const router = useRouter();
  const [level, setLevel] = useState<Level>("middle");
  const [hasSave, setHasSave] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const loadSave = useGameStore((s) => s.loadSave);
  const checkSave = useGameStore((s) => s.hasSave);

  useEffect(() => {
    initAudio();
    setHasSave(checkSave());
  }, [checkSave]);

  const startNew = () => {
    playSfx("click");
    router.push(`/setup?level=${level}`);
  };

  const continueGame = () => {
    playSfx("click");
    if (loadSave()) router.push("/play");
  };

  const cfg = LEVEL_CONFIGS[level];

  // Top companies sorted by scale — acts as a ranking preview
  const topCompanies = [...COMPANY_PRESETS].sort((a, b) => b.scale - a.scale).slice(0, 8);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Author bar */}
      <div className="flex w-full items-center justify-center bg-slate-950/80 px-3 py-1.5 text-center text-xs text-slate-400">
        <span>제작 by <span className="font-semibold text-slate-300">Dustin</span> · Teacher · Data Analytics · App Developer</span>
        <Link
          href="/learn"
          className="absolute right-3 rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          📘 배우기
        </Link>
      </div>
      {/* Full-bleed hero */}
      <img
        src={SPLASH_IMG}
        alt="유니콘 시티"
        className="w-full object-contain"
        style={{ maxHeight: "55vh" }}
      />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 pb-12">

        {/* Level selection */}
        <section className="mt-10 w-full">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            난이도(학년) 선택
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((lv) => {
              const c = LEVEL_CONFIGS[lv];
              const active = level === lv;
              return (
                <button
                  key={lv}
                  onClick={() => {
                    setLevel(lv);
                    playSfx("click");
                  }}
                  className={`rounded-2xl p-5 text-left ring-2 transition ${
                    active
                      ? "bg-brand-600 ring-brand-300"
                      : "bg-slate-800/60 ring-transparent hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{LEVEL_EMOJI[lv]}</span>
                    {active && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">선택됨</span>}
                  </div>
                  <div className="mt-2 text-lg font-bold">{c.label}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-300">{c.description}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {LEVEL_TAGS[lv].map((tag) => (
                      <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-white/15 text-white" : "bg-slate-700 text-slate-400"}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected level details */}
        <section className="mt-4 w-full rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/50">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">{LEVEL_EMOJI[level]}</span>
            <span className="font-bold text-slate-200">{cfg.label} 난이도 상세</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell icon="💰" label="시작 자금" value={formatMoney(cfg.startingCash)} />
            <StatCell icon="🏢" label="경쟁사 수" value={`${cfg.aiCount}개사`} />
            <StatCell icon="🗺️" label="캠퍼스 크기" value={`${cfg.mapSize}×${cfg.mapSize}`} />
            <StatCell icon="📊" label="시장 변동성" value={cfg.volatility === 0.5 ? "낮음" : cfg.volatility === 1.0 ? "보통" : "높음"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500">투자 가능 자산:</span>
            {cfg.enabledAssets.map(a => (
              <span key={a} className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400">{a}</span>
            ))}
          </div>
        </section>

        {/* Competitor ranking preview */}
        <section className="mt-4 w-full">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            예상 경쟁사 순위 (규모 기준)
          </h2>
          <div className="overflow-hidden rounded-2xl bg-slate-800/50 ring-1 ring-slate-700/50">
            {topCompanies.map((p, i) => {
              const ind = getIndustry(p.industryId);
              const medalEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < topCompanies.length - 1 ? "1px solid rgba(148,163,184,0.07)" : undefined }}
                >
                  <span className="w-6 text-center text-sm font-bold text-slate-600">
                    {medalEmoji ?? `${i + 1}`}
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ background: p.logoColor + "25" }}
                  >
                    {ind.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-200">{p.name}</div>
                    <div className="text-xs text-slate-500">{ind.name} · {p.blurb}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.round(p.scale * 2.5) }).map((_, j) => (
                      <span
                        key={j}
                        className="h-2 w-2 rounded-full"
                        style={{ background: j < Math.round((p.scale - 1) * 5) ? p.logoColor : "rgba(148,163,184,0.15)" }}
                      />
                    ))}
                    <span className="ml-1.5 text-xs font-mono text-slate-500">
                      {p.scale >= 1.6 ? "초대형" : p.scale >= 1.4 ? "대형" : p.scale >= 1.2 ? "중형" : "소형"}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-2.5 text-xs text-slate-600">
              ⚡ 실제 게임에서는 선택한 난이도에 따라 {cfg.aiCount}개 기업이 참가합니다
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={startNew} className="btn-primary px-8 py-4 text-lg">
            🚀 새 게임 시작
          </button>
          <button
            onClick={continueGame}
            disabled={!hasSave}
            className="btn-ghost px-8 py-4 text-lg !text-slate-800"
          >
            ⏯️ 이어서 하기
          </button>
          <button
            onClick={() => { playSfx("click"); setShowHelp(true); }}
            className="btn-ghost px-8 py-4 text-lg !text-slate-800"
          >
            📖 게임 방법
          </button>
        </section>

        <section className="mt-6 grid w-full gap-3 sm:grid-cols-2">
          <ModeCard
            emoji="🎮"
            title="싱글플레이"
            desc="AI 경쟁사들과 겨루며 회사를 키워요. 지금 바로 플레이!"
            ready
          />
          <ModeCard
            emoji="🏫"
            title="멀티플레이 (교실)"
            desc="여러 학생이 같은 시장에서 경쟁. 곧 추가됩니다."
          />
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-slate-500">
          교육용 시뮬레이션 · 실제 투자 조언이 아닙니다
        </footer>
      </div>

      {showHelp && <HelpModal open initialTab="manual" onClose={() => setShowHelp(false)} />}
    </main>
  );
}

function StatCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-700/40 px-3 py-2.5">
      <div className="text-sm">{icon}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
      <div className="text-sm font-bold text-slate-200">{value}</div>
    </div>
  );
}

function ModeCard({
  emoji,
  title,
  desc,
  ready,
}: {
  emoji: string;
  title: string;
  desc: string;
  ready?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ring-1 ${
        ready ? "bg-slate-800/60 ring-brand-500/40" : "bg-slate-800/30 ring-slate-700"
      }`}
    >
      <div className="flex items-center gap-2 text-lg font-bold">
        <span className="text-2xl">{emoji}</span>
        {title}
        {ready ? (
          <span className="pill bg-bull/20 text-bull">플레이 가능</span>
        ) : (
          <span className="pill bg-slate-600/40 text-slate-300">준비 중</span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-300">{desc}</p>
    </div>
  );
}

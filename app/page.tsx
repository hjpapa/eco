"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LEVEL_CONFIGS } from "@/lib/engine";
import { useGameStore } from "@/store/gameStore";
import { initAudio, playSfx } from "@/lib/audio";
import { COMPANY_PRESETS } from "@/lib/data/companyPresets";
import { getIndustry } from "@/lib/data/industries";
import { HelpModal } from "@/components/HelpModal";

const SPLASH_IMG = "/assets/splash-dragon.png";
const ELEMENTARY_CONFIG = LEVEL_CONFIGS.elementary;

const ECONOMY_PATH = [
  {
    icon: "🏪",
    title: "회사 운영",
    text: "가격과 생산량을 정하며 매출·비용·이익을 배워요.",
  },
  {
    icon: "🏙️",
    title: "건물과 인접 보너스",
    text: "서로 돕는 건물을 옆에 놓아 회사 효율을 높여요.",
  },
  {
    icon: "🌍",
    title: "금리·물가·환율",
    text: "뉴스와 쉬운 지표를 보고 돈의 흐름을 이해해요.",
  },
  {
    icon: "💳",
    title: "부채와 재무",
    text: "돈을 빌리고 갚으며 이자와 회사 살림을 익혀요.",
  },
] as const;

export default function Home() {
  const router = useRouter();
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
    router.push("/setup");
  };

  const continueGame = () => {
    playSfx("click");
    if (loadSave()) router.push("/play");
  };

  const cfg = ELEMENTARY_CONFIG;

  // Top companies sorted by scale — acts as a ranking preview
  const topCompanies = [...COMPANY_PRESETS].sort((a, b) => b.scale - a.scale).slice(0, 8);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white">
      <div className="relative flex w-full items-center justify-between gap-3 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 sm:justify-center">
        <span>제작 <span className="font-bold text-white">hjpapa</span></span>
        <Link
          href="/learn"
          className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:absolute sm:right-3"
        >
          📘 배우기
        </Link>
      </div>

      <section className="relative isolate overflow-hidden border-b border-emerald-300/20">
        <Image
          src={SPLASH_IMG}
          alt="산을 중심으로 펼쳐진 도시와 어린이 경제 탐험을 안내하는 드래곤"
          width={1672}
          height={941}
          priority
          sizes="100vw"
          className="h-[470px] w-full object-cover object-center sm:h-[520px] lg:h-[600px]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/52 to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-6xl items-center px-5 sm:px-8">
          <div className="max-w-2xl pb-10 sm:pb-0">
            <div className="inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-black text-emerald-100 ring-1 ring-emerald-200/40">
              초등 4~6학년 경제 탐험
            </div>
            <h1
              aria-label="드래곤 마운틴 시티"
              className="mt-4 text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl"
            >
              <span className="block">드래곤 마운틴</span>
              <span className="block text-amber-300">시티</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed text-slate-100 sm:text-xl">
              회사를 키우고, 도시를 만들고, 돈의 흐름을 배우는 쉬운 경제 게임
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
              <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">💰 시작 자금 100만 원</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">🪜 기능이 차례로 열려요</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">📘 언제든 다시 배우기</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 pb-12">
        <section className="mt-10 w-full">
          <div className="text-center">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">한 단계씩 배우는 경제</div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">어려운 말은 쉽게, 중요한 개념은 빠짐없이</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              난이도를 고를 필요가 없어요. 모든 새 게임은 초등학생에게 맞춘 같은 규칙으로 시작하고,
              건물·투자·재무 기능은 준비된 순서대로 열립니다.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ECONOMY_PATH.map((item, index) => (
              <article key={item.title} className="rounded-2xl bg-slate-800/70 p-5 ring-1 ring-slate-700/70">
                <div className="flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>{item.icon}</span>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-black text-emerald-200">
                    {index + 1}단계
                  </span>
                </div>
                <h3 className="mt-3 font-black text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-4 w-full rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/50">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">🧒</span>
            <span className="font-bold text-slate-200">초등 경제 탐험 기본 설정</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell icon="💰" label="시작 자금" value="100만 원 (고정)" />
            <StatCell icon="🏢" label="경쟁사 수" value={`${cfg.aiCount}개사`} />
            <StatCell icon="🗺️" label="기본 캠퍼스" value="8×8" />
            <StatCell icon="📊" label="시장 움직임" value="초등 맞춤·완만함" />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs text-slate-300">
            <span className="rounded-full bg-slate-700/70 px-2.5 py-1">🤝 인접 보너스</span>
            <span className="rounded-full bg-slate-700/70 px-2.5 py-1">🏦 예금·채권</span>
            <span className="rounded-full bg-slate-700/70 px-2.5 py-1">💵 환율</span>
            <span className="rounded-full bg-slate-700/70 px-2.5 py-1">💳 부채·재무</span>
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
              ⚡ 초등 경제 탐험에서는 {cfg.aiCount}개 기업과 함께 성장해요
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

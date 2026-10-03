"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { initAudio, playSfx } from "@/lib/audio";
import { HelpModal } from "@/components/HelpModal";

const SPLASH_IMG = "/assets/splash-dragon.png";

// What the game is about, in words a 4th grader can read at a glance.
const HOW_TO_PLAY = [
  { icon: "🏗️", title: "건물 짓기", text: "공장·매장·공원을 지어 우리 회사 도시를 키워요." },
  { icon: "🏭", title: "만들고 팔기", text: "물건을 몇 개 만들고 얼마에 팔지 정해요." },
  { icon: "📜", title: "의뢰 해결", text: "손님 주문과 시장님 부탁을 해결하고 보상을 받아요." },
  { icon: "📈", title: "돈 불리기", text: "남는 돈을 주식·예금·금에 나눠 넣어 봐요." },
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white">
      <div className="relative flex w-full items-center justify-between gap-3 bg-slate-950/90 px-4 py-2 text-xs text-slate-300">
        <span>제작 <span className="font-bold text-white">hjpapa</span></span>
        <Link
          href="/learn"
          className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-4 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
          className="h-[560px] w-full object-cover object-center sm:h-[600px] lg:h-[640px]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/55 to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-6xl items-center px-5 sm:px-8">
          <div className="max-w-xl">
            <div className="inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-black text-emerald-100 ring-1 ring-emerald-200/40">
              초등 4~6학년 경제 놀이
            </div>
            <h1
              aria-label="드래곤 마운틴 시티"
              className="mt-4 text-5xl font-black leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl"
            >
              <span className="block">드래곤 마운틴</span>
              <span className="block text-amber-300">시티</span>
            </h1>
            <p className="mt-4 text-lg font-semibold leading-relaxed text-slate-100 sm:text-xl">
              내 회사를 세우고, 건물을 지어 도시를 키우며
              <br className="hidden sm:block" /> 돈이 어떻게 움직이는지 배워요.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button onClick={startNew} className="btn-primary min-h-16 px-8 text-xl shadow-xl shadow-indigo-950/40">
                🚀 새 게임 시작
              </button>
              {hasSave && (
                <button onClick={continueGame} className="btn-ghost min-h-16 px-7 text-lg !text-slate-800">
                  ⏯️ 이어서 하기
                </button>
              )}
              <button
                onClick={() => { playSfx("click"); setShowHelp(true); }}
                className="btn-ghost min-h-16 bg-white/15 px-7 text-lg !text-white backdrop-blur hover:bg-white/25"
              >
                📖 게임 방법
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-12">
        <section className="mt-10 w-full">
          <h2 className="text-center text-2xl font-black sm:text-3xl">이렇게 놀아요</h2>
          <p className="mt-2 text-center text-base text-slate-300">
            처음엔 쉬운 것부터! 게임을 할수록 새 기능이 하나씩 열려요.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_TO_PLAY.map((item) => (
              <article key={item.title} className="rounded-2xl bg-slate-800/70 p-5 ring-1 ring-slate-700/70">
                <span className="text-4xl" aria-hidden>{item.icon}</span>
                <h3 className="mt-3 text-lg font-black text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-slate-500">
          교육용 게임이에요 · 게임 속 투자는 진짜 돈이 아니에요
        </footer>
      </div>

      {showHelp && <HelpModal open initialTab="manual" onClose={() => setShowHelp(false)} />}
    </main>
  );
}

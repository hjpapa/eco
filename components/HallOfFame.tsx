"use client";

import { useEffect, useState } from "react";
import { ENDINGS } from "@/lib/endings";
import { readHall, type HallRecord } from "@/lib/hallOfFame";
import { getBrowserStorage } from "@/lib/storage";
import { formatMoney } from "@/lib/format";

export function HallOfFame() {
  const [records, setRecords] = useState<HallRecord[]>([]);
  const [filter, setFilter] = useState("all");
  useEffect(() => { setRecords(readHall(getBrowserStorage())); }, []);
  const visible = records.filter((r) => filter === "all" || r.ending === filter);
  return (
    <section className="mt-8 w-full rounded-3xl border border-amber-200 bg-amber-50 p-4 text-slate-800 sm:p-6" aria-labelledby="hall-title">
      <h2 id="hall-title" className="text-2xl font-black">🏅 나의 명예의 전당</h2>
      <p className="mt-2 text-sm text-slate-600">1등뿐 아니라 모든 도전이 소중해요. 이 브라우저에 최근 30번의 모험을 보관해요.</p>
      <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
        모아 보기
        <select className="min-h-11 max-w-full rounded-xl border border-amber-300 bg-white px-3" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">모든 엔딩</option>
          {Object.entries(ENDINGS).map(([id, ending]) => <option key={id} value={id}>{ending.emoji} {ending.title}</option>)}
        </select>
      </label>
      {visible.length === 0 ? <p className="py-6 text-center text-slate-600">{records.length ? "아직 만나지 못한 엔딩이에요. 다음 모험에서 도전해 봐요!" : "첫 모험을 마치면 나만의 엔딩과 기록이 여기에 나타나요!"}</p> :
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((r) => <li key={r.id} className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-amber-200">
            <p className="font-black text-amber-800">{ENDINGS[r.ending].emoji} {ENDINGS[r.ending].title}</p>
            <p className="mt-1 break-words font-bold">{r.name}</p>
            <p className="mt-2 text-sm">{r.rank}위 · 총재산 {formatMoney(r.wealth)}원</p>
            {r.stars != null && (
              <p className="mt-1 text-sm">
                <span className="text-amber-500">{"★".repeat(r.stars)}</span>
                <span className="text-slate-300">{"★".repeat(Math.max(0, 5 - r.stars))}</span>
                {" "}· 👥 주민 {r.residents ?? 0}명 · 🐾 이웃 {r.neighbours ?? 0}명
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">{r.turns}/{r.length}턴 · {{ elementary: "초등", middle: "중등", university: "심화" }[r.level] ?? r.level} · {new Date(r.date).toLocaleDateString("ko-KR")}</p>
          </li>)}
        </ol>}
      <p className="mt-3 text-xs text-slate-500">기록은 기기 간 공유되지 않으며 브라우저 데이터를 지우면 사라져요.</p>
    </section>
  );
}

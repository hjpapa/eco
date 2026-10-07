import { BUILDINGS } from "@/lib/engine";
import type { CityAlbum as Album } from "@/lib/cityAlbum";

export function CityAlbum({ album, name }: { album: Album; name: string }) {
  const cells = new Map(album.buildings.map((b) => [`${b.x},${b.y}`, b]));
  return <section className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left text-[13px] text-slate-800" aria-label={`${name} 도시 앨범`}>
    <h3 className="text-base font-black">📷 우리 도시 앨범</h3>
    <p className="break-words">모험을 마친 날의 <b>{name}</b>이에요.</p>
    <div role="img" aria-label={`마지막 도시 배치: ${album.mapSize}칸씩, 건물과 꾸미기 ${album.buildings.length}개. 자세한 위치는 아래 목록에서 확인할 수 있어요.`}
      className="grid aspect-square gap-0.5 overflow-hidden rounded-xl border-4 border-emerald-200 bg-emerald-200 p-1"
      style={{ gridTemplateColumns: `repeat(${album.mapSize}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${album.mapSize}, minmax(0, 1fr))` }}>
      {Array.from({ length: album.mapSize * album.mapSize }, (_, i) => {
        const b = cells.get(`${i % album.mapSize},${Math.floor(i / album.mapSize)}`);
        return <span key={i} aria-hidden className={`flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-sm ${b ? "bg-white" : "bg-emerald-100"}`}
          style={{ fontSize: `clamp(13px, ${60 / album.mapSize}vw, 24px)` }}>
          {b ? b.building ? "🚧" : BUILDINGS[b.type].emoji : ""}
        </span>;
      })}
    </div>
    <dl className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-white p-2"><dt>👥 주민</dt><dd className="font-bold">{album.residents}명</dd></div>
      <div className="rounded-xl bg-white p-2"><dt>😊 행복</dt><dd className="font-bold">{album.happiness} / 100</dd></div>
      <div className="rounded-xl bg-white p-2"><dt>⭐ 마을 별</dt><dd className="font-bold">{album.stars}개</dd></div>
      <div className="rounded-xl bg-white p-2"><dt>🏅 모은 업적</dt><dd className="font-bold">{album.achievements}개</dd></div>
    </dl>
    <p className="font-bold">✨ 기억할 성과</p>
    {album.highlights.length ? <ul className="space-y-1">{album.highlights.map((text) => <li key={text}>{text}</li>)}</ul>
      : <p>내 손으로 도시를 돌본 소중한 모험이에요.</p>}
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center rounded-xl bg-white px-3 font-bold">🏘️ 건물·꾸미기 목록 ({album.buildings.length}개)</summary>
      <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-xl bg-white p-3">
        {album.buildings.map((b) => <li key={`${b.x},${b.y}`} className="break-words">
          {BUILDINGS[b.type].emoji} {BUILDINGS[b.type].name} · 레벨 {b.level} · {b.x + 1}열 {b.y + 1}줄{b.building ? " · 공사 중" : ""}
        </li>)}
        {!album.buildings.length && <li>이 모험에는 남아 있는 건물이 없어요.</li>}
      </ul>
    </details>
  </section>;
}

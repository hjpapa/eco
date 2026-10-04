"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ACHIEVEMENTS,
  STICKER_KINDS,
  stickerCatalog,
  type GameState,
  type StickerKind,
} from "@/lib/engine";

// 📖 마을 도감: every sticker the village has collected, Animal Crossing
// museum style. Empty slots show a hint for how to fill them.

type Tab = StickerKind | "badge";

export function stickerProgress(game: GameState): { owned: number; total: number } {
  const catalog = stickerCatalog(game);
  const have = new Set(game.stickers ?? []);
  const badges = (game.achievements ?? []).length;
  return { owned: catalog.filter((s) => have.has(s.key)).length + badges, total: catalog.length + ACHIEVEMENTS.length };
}

export function StickerBook({ game, onClose }: { game: GameState; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("resident");
  const [hint, setHint] = useState<string | null>(null);
  const catalog = stickerCatalog(game);
  const have = new Set(game.stickers ?? []);
  const earned = new Set((game.achievements ?? []).map((a) => a.id));
  const { owned, total } = stickerProgress(game);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = tab === "badge"
    ? ACHIEVEMENTS.map((a) => ({ key: a.id, emoji: a.emoji, name: a.title, hint: a.hint, got: earned.has(a.id) }))
    : catalog.filter((s) => s.kind === tab).map((s) => ({ key: s.key, emoji: s.emoji, name: s.name, hint: s.hint, got: have.has(s.key) }));
  const tabs: { id: Tab; emoji: string; label: string }[] = [
    ...STICKER_KINDS.map((k) => ({ id: k.kind as Tab, emoji: k.emoji, label: k.label })),
    { id: "badge", emoji: "🏅", label: "업적" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={onClose}>
      <div
        className="card sticker-book flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-book-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <h2 id="sticker-book-title" className="text-lg font-black text-amber-950">📖 마을 도감</h2>
            <p className="text-sm font-bold text-amber-800">모은 스티커 {owned} / {total}</p>
          </div>
          <button type="button" className="btn-ghost !min-h-11 min-w-11 !px-2 text-base" onClick={onClose} aria-label="도감 닫기">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 p-2" role="tablist" aria-label="도감 종류">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setHint(null); }}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-xs font-black ${tab === t.id ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              <span className="text-lg leading-none" aria-hidden>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3 pt-1 sm:grid-cols-4" role="tabpanel">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setHint(item.got ? `${item.emoji} ${item.name} — 모았어요!` : `❔ ${item.hint}`)}
              className={`sticker flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl p-2 text-center ${item.got ? "sticker--got bg-white ring-2 ring-amber-300" : "bg-slate-100 ring-1 ring-dashed ring-slate-300"}`}
              aria-label={item.got ? `${item.name} 스티커` : `아직 없는 스티커: ${item.hint}`}
            >
              <span className={`text-3xl leading-none ${item.got ? "" : "opacity-30 grayscale"}`} aria-hidden>{item.got ? item.emoji : "❔"}</span>
              <span className={`mt-1 text-xs font-black leading-tight ${item.got ? "text-slate-800" : "text-slate-400"}`}>{item.got ? item.name : "???"}</span>
            </button>
          ))}
        </div>
        {hint && (
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700" role="status">{hint}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

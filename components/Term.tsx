"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "@/lib/data/glossary";

/**
 * Tappable glossary term. In the elementary level, wrapping a difficult word
 * with <Term term="순자산">…</Term> renders it with a dotted underline and a
 * tap-to-reveal kid-friendly explanation. In other levels it's plain text.
 *
 * The popover is rendered into <body> with fixed positioning and clamped to the
 * viewport so it never gets cut off at screen edges.
 */
const TOOLTIP_W = 250;

export function Term({ term, children }: { term: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const text = children ?? term;
  const explanation = GLOSSARY[term];

  const place = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 8;
    let left = r.left + r.width / 2 - TOOLTIP_W / 2;
    left = Math.max(margin, Math.min(left, vw - TOOLTIP_W - margin));
    const below = r.top < 120; // not enough room above → show below
    const top = below ? r.bottom + 8 : r.top - 8;
    setPos({ left, top, below });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Interactive whenever a glossary explanation exists — at every level — so
  // middle/high and adult players can also tap to learn stock & economy terms.
  if (!explanation) return <>{text}</>;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="term-btn cursor-help underline decoration-dotted decoration-brand-400 underline-offset-2"
      >
        {text}
        <span className="ml-0.5 text-xs text-brand-500">❓</span>
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: TOOLTIP_W,
              transform: pos.below ? undefined : "translateY(-100%)",
              zIndex: 60,
            }}
            className="rounded-xl bg-slate-800 px-3 py-2.5 text-left text-sm font-normal leading-snug text-white shadow-xl"
          >
            <b className="mb-0.5 block text-brand-200">{term}</b>
            {explanation}
          </div>,
          document.body,
        )}
    </>
  );
}

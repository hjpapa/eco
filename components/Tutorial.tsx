"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { LEARNING_CATALOG } from "@/lib/learning";

const STEPS = LEARNING_CATALOG.spotlight;

interface Rect { top: number; left: number; width: number; height: number; }

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [pulse, setPulse] = useState(false);

  const current = STEPS[step];
  const PAD = 8;

  const measureTarget = () => {
    if (!current.targetId) { setTargetRect(null); return; }
    const el = document.getElementById(current.targetId);
    if (!el) { setTargetRect(null); return; }
    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Trigger pulse animation
    setPulse(false);
    setTimeout(() => setPulse(true), 50);
  };

  useLayoutEffect(() => {
    measureTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };
  const goPrev = () => { if (step > 0) setStep(step - 1); };

  const isLast = step === STEPS.length - 1;

  // Position tooltip card relative to the target
  const getCardStyle = (): React.CSSProperties => {
    const MARGIN = 14;
    const CARD_W = 300;
    const CARD_H = 220;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!targetRect) {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    }

    const placement = current.placement ?? "bottom";
    let top: number, left: number;

    if (placement === "bottom") {
      top = Math.min(targetRect.top + targetRect.height + MARGIN, vh - CARD_H - MARGIN);
      left = Math.min(Math.max(MARGIN, targetRect.left), vw - CARD_W - MARGIN);
    } else if (placement === "top") {
      top = Math.max(MARGIN, targetRect.top - CARD_H - MARGIN);
      left = Math.min(Math.max(MARGIN, targetRect.left), vw - CARD_W - MARGIN);
    } else {
      top = Math.max(MARGIN, targetRect.top);
      left = Math.max(MARGIN, targetRect.left - CARD_W - MARGIN);
    }

    return { position: "fixed", top, left };
  };

  // Arrow pointing from card toward target
  const getArrowStyle = (): React.CSSProperties | null => {
    if (!targetRect || !current.placement) return null;
    if (current.placement === "bottom") {
      return { position: "absolute", top: -10, left: 18, width: 0, height: 0,
        borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
        borderBottom: "10px solid white" };
    }
    if (current.placement === "top") {
      return { position: "absolute", bottom: -10, left: 18, width: 0, height: 0,
        borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
        borderTop: "10px solid white" };
    }
    return null;
  };

  const arrowStyle = getArrowStyle();

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: "none" }}>
      {/* Overlay sections creating spotlight effect */}
      {targetRect ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/70" style={{ height: targetRect.top, pointerEvents: "auto" }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ top: targetRect.top + targetRect.height, pointerEvents: "auto" }} />
          <div className="absolute bg-black/70" style={{ top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height, pointerEvents: "auto" }} />
          <div className="absolute bg-black/70" style={{ top: targetRect.top, left: targetRect.left + targetRect.width, right: 0, height: targetRect.height, pointerEvents: "auto" }} />

          {/* Spotlight border ring */}
          <div
            className="absolute rounded-xl"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              boxShadow: "0 0 0 3px rgba(99,102,241,0.9), 0 0 0 6px rgba(99,102,241,0.3)",
              transition: "all 0.3s ease",
            }}
          />

          {/* Pulsing ring animation (iorad-style) */}
          {pulse && (
            <div
              className="absolute rounded-xl animate-ping"
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
                border: "2px solid rgba(99,102,241,0.6)",
                animationDuration: "1.2s",
                animationIterationCount: 3,
              }}
            />
          )}

          {/* Cursor pointer icon near the target */}
          <div
            className="absolute text-2xl"
            style={{
              top: targetRect.top + targetRect.height - 8,
              left: targetRect.left + targetRect.width * 0.3,
              animation: "bounce 1s infinite",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}
          >
            👆
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70" style={{ pointerEvents: "auto" }} />
      )}

      {/* Tooltip card */}
      <div
        className="pointer-events-auto w-[300px] max-w-[calc(100vw-2rem)]"
        style={getCardStyle()}
      >
        <div className="relative rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          {arrowStyle && <div style={arrowStyle} />}

          {/* Progress bar at top */}
          <div className="h-1.5 overflow-hidden rounded-t-2xl bg-slate-200">
            <div
              className="h-full bg-brand-500 transition-all duration-400"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Step dots */}
            <div className="mb-3 flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-brand-500" : i < step ? "w-1.5 bg-brand-300" : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
              <span className="ml-auto text-xs text-slate-400">{step + 1}/{STEPS.length}</span>
            </div>

            <h3 className="text-sm font-bold text-slate-800 leading-snug">{current.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.body}</p>

            {/* Navigation */}
            <div className="mt-4 flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={goPrev}
                  className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50"
                >
                  ◀ 이전
                </button>
              )}
              <button
                onClick={goNext}
                className="ml-auto min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 active:scale-95 transition-transform"
              >
                {isLast ? "시작하기 🚀" : "다음 ▶"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

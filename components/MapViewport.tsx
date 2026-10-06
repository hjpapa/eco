"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { fitReadableMap, INITIAL_MAP_VIEW, MapGesture, MAX_MAP_SCALE, MIN_MAP_SCALE, zoomMap, type MapView } from "@/lib/ui/mapGestures";

/** A common touch surface keeps 2D and 3D controls, limits and accidental-tap protection identical. */
export function MapViewport({ children, rotate = false, className = "workspace-map-h", style, onReset, readableSize }: {
  children: ReactNode; rotate?: boolean; className?: string; style?: CSSProperties; onReset?: () => void;
  readableSize?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const gesture = useRef(new MapGesture());
  const current = useRef<MapView>(INITIAL_MAP_VIEW);
  const [view, setView] = useState<MapView>(INITIAL_MAP_VIEW);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const next = fitReadableMap(current.current, rect.width, rect.height, readableSize);
      if (next.x !== current.current.x || next.y !== current.current.y) {
        current.current = next;
        setView(next);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [readableSize]);
  const commit = (next: MapView) => {
    const rect = frame.current?.getBoundingClientRect();
    current.current = rect ? fitReadableMap(next, rect.width, rect.height, readableSize) : next;
    setView(current.current);
  };
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  return <div className="space-y-2">
    <div ref={frame} className={`map-gesture-surface relative isolate w-full overflow-hidden rounded-2xl ${className}`} style={style}
      onPointerDownCapture={(event) => {
        if (event.button !== 0) return;
        gesture.current.down(event.pointerId, point(event));
      }}
      onPointerMoveCapture={(event) => {
        if (!gesture.current.points.has(event.pointerId)) return;
        const next = gesture.current.move(event.pointerId, point(event), current.current, !rotate);
        if (gesture.current.moved && !rotate) event.currentTarget.setPointerCapture(event.pointerId);
        if (next !== current.current) commit(next);
      }}
      onPointerUpCapture={(event) => { gesture.current.up(event.pointerId); }}
      onPointerCancelCapture={() => gesture.current.cancel()}
      onLostPointerCapture={(event) => {
        // Touch implicitly captures a child. Transferring that capture to this
        // surface must not discard the finger that is still dragging.
        if (event.target === event.currentTarget) gesture.current.up(event.pointerId);
      }}
      onClickCapture={(event) => {
        // Keyboard-activated buttons have detail=0 and must remain usable.
        if (event.detail !== 0 && gesture.current.moved) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "center", willChange: "transform" }}>
        {children}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-2" role="group" aria-label="도시 지도 크기 조절">
      <span className="px-2 text-sm font-bold text-slate-600">도시 크기</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost !min-h-12 !min-w-12 !text-xl" aria-label="도시 축소" disabled={view.scale <= (readableSize ? 1 : MIN_MAP_SCALE)} onClick={() => commit(zoomMap(current.current, current.current.scale / 1.2))}>−</button>
        <output className="w-12 text-center text-sm tabular-nums" aria-label="지도 확대 비율">{Math.round(view.scale * 100)}%</output>
        <button type="button" className="btn-ghost !min-h-12 !min-w-12 !text-xl" aria-label="도시 확대" disabled={view.scale >= MAX_MAP_SCALE} onClick={() => commit(zoomMap(current.current, current.current.scale * 1.2))}>＋</button>
        <button type="button" className="btn-ghost !min-h-12" onClick={() => { gesture.current.cancel(); commit(INITIAL_MAP_VIEW); onReset?.(); }}>처음 보기</button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="지도에서 볼 곳 고르기">
      <span className="text-[13px] text-slate-600">다른 곳 보기</span>
      {([{ label: "왼쪽", icon: "←", x: 120, y: 0 }, { label: "위쪽", icon: "↑", x: 0, y: 120 }, { label: "아래쪽", icon: "↓", x: 0, y: -120 }, { label: "오른쪽", icon: "→", x: -120, y: 0 }]).map((direction) => (
        <button key={direction.label} type="button" className="btn-ghost !min-h-11 min-w-11" aria-label={`지도 ${direction.label} 보기`} onClick={() => commit({ ...current.current, x: current.current.x + direction.x, y: current.current.y + direction.y })}>{direction.icon}</button>
      ))}
    </div>
    <p className="px-1 text-[13px] leading-relaxed text-slate-500">방향 버튼으로 다른 곳을 볼 수 있어요.{readableSize ? " 글자가 작아지지 않도록 100%까지만 줄여요." : ""}<br />{rotate ? "한 손가락 회전" : "한 손가락 이동"} · 두 손가락 확대/축소</p>
  </div>;
}

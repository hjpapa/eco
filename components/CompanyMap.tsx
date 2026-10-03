"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { BUILDINGS, BUILDING_LIST, buildingCostFor } from "@/lib/engine";
import type { BuildingType, Company, GameState, PlacedBuilding } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { pickCityVoice } from "@/lib/data/cityVoices";

/* ── Adaptive tile dimensions ───────────────────────────────────────────── */
function getTW(n: number) {
  return n <= 5 ? 80 : n <= 6 ? 74 : n <= 7 ? 66 : 58;
}

/* ── Isometric coordinate math ──────────────────────────────────────────── */
function sX(gx: number, gy: number, n: number, tw: number): number {
  return Math.floor((n * tw) / 2) + (gx - gy) * (tw / 2);
}
function sY(gx: number, gy: number, tw: number): number {
  const th = tw >> 1;
  const bh = Math.round(tw * 0.36);
  return (gx + gy) * (th / 2) + bh + th / 2;
}
const svgW = (n: number, tw: number) => n * tw;
const svgH = (n: number, tw: number) => n * (tw >> 1) + Math.round(tw * 0.36);
const diam = (cx: number, cy: number, tw: number) => {
  const th = tw >> 1;
  return `${cx},${cy - th / 2} ${cx + tw / 2},${cy} ${cx},${cy + th / 2} ${cx - tw / 2},${cy}`;
};

/* ── Building colors: [roof, left-wall, right-wall] ─────────────────────── */
const BC: Record<string, [string, string, string]> = {
  factory:   ["#94a3b8", "#475569", "#64748b"],
  warehouse: ["#f59e0b", "#92400e", "#b45309"],
  store:     ["#60a5fa", "#1d4ed8", "#2563eb"],
  rnd:       ["#c084fc", "#6d28d9", "#7c3aed"],
  office:    ["#6ee7b7", "#065f46", "#047857"],
  hr:        ["#fde68a", "#b45309", "#d97706"],
  power:     ["#fca5a5", "#991b1b", "#b91c1c"],
  park:      ["#86efac", "#15803d", "#16a34a"],
};

const PHASE_GROUND: Record<string, string> = {
  boom: "#bbf7d0", normal: "#d1fae5", recession: "#e2e8f0",
  inflation: "#fef3c7", deflation: "#dbeafe", stagflation: "#e7e5e4",
};

/* Sky gradient stops [top, bottom] per economic phase — sets the whole mood. */
const PHASE_SKY: Record<string, [string, string]> = {
  boom:        ["#7dd3fc", "#e0f2fe"],
  normal:      ["#bae6fd", "#eff6ff"],
  recession:   ["#94a3b8", "#e2e8f0"],
  inflation:   ["#fdba74", "#fef3c7"],
  deflation:   ["#a5b4fc", "#e0e7ff"],
  stagflation: ["#a8a29e", "#e7e5e4"],
};

/* ── Window grid on a parallelogram wall face ───────────────────────────── */
type P = { x: number; y: number };
function lerp(a: P, b: P, t: number): P {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/** Map (u,v) on the parallelogram A→B (ground) × A→D (up) to a screen point. */
function facePoint(A: P, B: P, D: P, u: number, v: number): P {
  return { x: A.x + (B.x - A.x) * u + (D.x - A.x) * v, y: A.y + (B.y - A.y) * u + (D.y - A.y) * v };
}
function windowQuads(
  A: P, B: P, D: P, cols: number, rows: number, lit: (i: number, j: number) => boolean,
): { pts: string; on: boolean }[] {
  const out: { pts: string; on: boolean }[] = [];
  const mx = 0.16, my = 0.16; // margins
  const cw = (1 - mx * (cols + 1)) / cols;
  const ch = (1 - my * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const u0 = mx + i * (cw + mx);
      const v0 = my + j * (ch + my);
      const p1 = facePoint(A, B, D, u0, v0);
      const p2 = facePoint(A, B, D, u0 + cw, v0);
      const p3 = facePoint(A, B, D, u0 + cw, v0 + ch);
      const p4 = facePoint(A, B, D, u0, v0 + ch);
      out.push({
        pts: `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`,
        on: lit(i, j),
      });
    }
  }
  return out;
}

/* ── Isometric tile ─────────────────────────────────────────────────────── */
function IsoTile({
  gx, gy, n, tw, building, phase, selected, buildHighlight, onClick, onHover,
}: {
  gx: number; gy: number; n: number; tw: number;
  building?: PlacedBuilding; phase: string;
  selected: boolean; buildHighlight: boolean;
  onClick: () => void;
  onHover?: (entering: boolean) => void;
}) {
  const cx = sX(gx, gy, n, tw);
  const cy = sY(gx, gy, tw);
  const th = tw >> 1;
  const bh = Math.round(tw * 0.36);
  const ground = PHASE_GROUND[phase] ?? PHASE_GROUND.normal;

  if (!building) {
    const fill = buildHighlight ? "#86efac" : ground;
    return (
      <polygon
        points={diam(cx, cy, tw)}
        fill={fill}
        stroke={buildHighlight ? "#16a34a" : "rgba(15,23,42,0.08)"}
        strokeWidth={buildHighlight ? 1.5 : 0.5}
        onClick={onClick}
        onMouseEnter={onHover ? () => onHover(true) : undefined}
        onMouseLeave={onHover ? () => onHover(false) : undefined}
        style={{ cursor: "pointer" }}
      />
    );
  }

  const isBuilding = building.turnsLeft <= 0;
  const faceH = isBuilding ? bh + (building.level - 1) * Math.round(bh * 0.45) : Math.round(bh / 3);
  const [roof, lw, rw] = BC[building.type] ?? BC.office;

  // Face corner points (left + right walls).
  const Lg: P = { x: cx - tw / 2, y: cy };               // left ground-outer
  const Mg: P = { x: cx, y: cy + th / 2 };               // front ground-inner
  const Rg: P = { x: cx + tw / 2, y: cy };               // right ground-outer
  const Lt: P = { x: cx - tw / 2, y: cy - faceH };       // left top-outer
  const Mt: P = { x: cx, y: cy + th / 2 - faceH };       // front top-inner
  const Rt: P = { x: cx + tw / 2, y: cy - faceH };       // right top-outer

  const roofPts = `${cx},${cy - th / 2 - faceH} ${Rt.x},${Rt.y} ${Mt.x},${Mt.y} ${Lt.x},${Lt.y}`;
  const leftFace = `${Lg.x},${Lg.y} ${Mg.x},${Mg.y} ${Mt.x},${Mt.y} ${Lt.x},${Lt.y}`;
  const rightFace = `${Rg.x},${Rg.y} ${Mg.x},${Mg.y} ${Mt.x},${Mt.y} ${Rt.x},${Rt.y}`;

  const roofFill = selected ? "#818cf8" : isBuilding ? roof : "#d1d5db";
  const lwFill = isBuilding ? lw : "#9ca3af";
  const rwFill = isBuilding ? rw : "#6b7280";
  const fontSize = Math.max(10, Math.round(tw * 0.2));

  // Windows scale with building level (taller = more floors).
  const decorative = isBuilding && building.type !== "park";
  const rows = decorative ? 1 + building.level : 0;
  const litFn = (i: number, j: number) => ((gx * 7 + gy * 13 + i * 3 + j * 5 + building.level) % 4) === 0;
  const leftWin = decorative ? windowQuads(Lg, Mg, Lt, 2, rows, litFn) : [];
  const rightWin = decorative ? windowQuads(Rg, Mg, Rt, 2, rows, litFn) : [];

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* drop shadow so the building reads as 3D */}
      <ellipse cx={cx} cy={cy + th / 2 + 2} rx={tw * 0.42} ry={th * 0.32} fill="rgba(15,23,42,0.18)" />
      <polygon points={diam(cx, cy, tw)} fill={ground} stroke="rgba(15,23,42,0.06)" strokeWidth="0.5" />
      {selected && (
        <polygon points={diam(cx, cy, tw)} fill="#818cf8" className="iso-pulse" style={{ pointerEvents: "none" }} />
      )}
      <polygon points={leftFace} fill={lwFill} />
      <polygon points={rightFace} fill={rwFill} />
      {/* windows */}
      {leftWin.map((w, k) => (
        <polygon key={`lw${k}`} points={w.pts} fill={w.on ? "#fde68a" : "#cbd5e1"} opacity={w.on ? 0.95 : 0.5} style={{ pointerEvents: "none" }} />
      ))}
      {rightWin.map((w, k) => (
        <polygon key={`rw${k}`} points={w.pts} fill={w.on ? "#fde68a" : "#94a3b8"} opacity={w.on ? 0.9 : 0.45} style={{ pointerEvents: "none" }} />
      ))}
      <polygon
        points={roofPts}
        fill={roofFill}
        stroke={selected ? "#6366f1" : "rgba(15,23,42,0.12)"}
        strokeWidth={selected ? 1.5 : 0.5}
      />
      {/* roof highlight edge */}
      <line x1={cx} y1={cy - th / 2 - faceH} x2={Lt.x} y2={Lt.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" style={{ pointerEvents: "none" }} />
      <text
        x={cx} y={cy - faceH}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {isBuilding ? BUILDINGS[building.type].emoji : "🏗️"}
      </text>
      {building.level > 1 && isBuilding && (
        <text
          x={cx + tw / 2 - 2} y={cy - faceH - th / 2 + 6}
          textAnchor="end" fontSize="8" fontWeight="bold" fill="white"
          style={{ pointerEvents: "none" }}
        >
          Lv{building.level}
        </text>
      )}
      {!isBuilding && (
        <text
          x={cx} y={cy + th / 2 - 3}
          textAnchor="middle" fontSize="8" fill="#374151"
          style={{ pointerEvents: "none" }}
        >
          {building.turnsLeft}턴
        </text>
      )}
    </g>
  );
}

/* ── SVG agent shapes (no emoji) ────────────────────────────────────────── */
function CarShape({ color }: { color: string }) {
  return (
    <g>
      <rect x="-13" y="-4" width="26" height="8" rx="2.5" fill={color} />
      <rect x="-8" y="-8.5" width="16" height="6" rx="2" fill={color} />
      <rect x="-7" y="-8" width="5" height="4" rx="1" fill="#bfdbfe" opacity="0.85" />
      <rect x="1" y="-8" width="5" height="4" rx="1" fill="#bfdbfe" opacity="0.85" />
      <circle cx="-8" cy="5" r="2.5" fill="#1f2937" />
      <circle cx="8" cy="5" r="2.5" fill="#1f2937" />
      <circle cx="-8" cy="5" r="1" fill="#9ca3af" />
      <circle cx="8" cy="5" r="1" fill="#9ca3af" />
    </g>
  );
}

function PersonShape({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-8" r="3.5" fill={color} />
      <rect x="-3" y="-4.5" width="6" height="8" rx="2" fill={color} />
      <rect x="-3.5" y="3" width="3" height="6" rx="1.5" fill={color} />
      <rect x="0.5" y="3" width="3" height="6" rx="1.5" fill={color} />
    </g>
  );
}

interface AgentDef {
  color: string;
  sx: number; sy: number; dx: number; dy: number;
  flipX: boolean; dur: number; delayS: number;
}

const CAR_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981"];
const PED_COLORS = ["#ec4899", "#84cc16", "#f97316", "#0ea5e9", "#a855f7"];

/** Cars circulate ONLY on the perimeter ring road, outside the campus. */
function buildCars(n: number, tw: number, count: number): AgentDef[] {
  const c = (gx: number, gy: number): P => ({ x: sX(gx, gy, n, tw), y: sY(gx, gy, tw) });
  const top = c(0, 0), right = c(n - 1, 0), left = c(0, n - 1), bottom = c(n - 1, n - 1);
  const cx = (top.x + right.x + left.x + bottom.x) / 4;
  const cy = (top.y + right.y + left.y + bottom.y) / 4;
  const edges: [P, P][] = [
    [top, right], [right, bottom], [bottom, left], [left, top],
  ];
  const gap = tw * 0.46;

  return Array.from({ length: count }, (_, i) => {
    let [p0, p1] = edges[i % 4];
    if ((i >> 2) % 2 === 1) [p0, p1] = [p1, p0];
    const ex = p1.x - p0.x, ey = p1.y - p0.y;
    // outward perpendicular (away from campus center)
    let px = -ey, py = ex;
    const plen = Math.hypot(px, py) || 1;
    px /= plen; py /= plen;
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
    if (px * (mx - cx) + py * (my - cy) < 0) { px = -px; py = -py; }
    const ox = px * gap, oy = py * gap;
    return {
      color: CAR_COLORS[i % CAR_COLORS.length],
      sx: p0.x + ox, sy: p0.y + oy,
      dx: ex, dy: ey,
      flipX: ex < 0,
      dur: 6 + ((i * 1.7) % 6),
      delayS: (i * 1.1) % 6,
    };
  });
}

/** Pedestrians wander ONLY the interior tiles (1..n-2), never the border. */
function buildPeople(n: number, tw: number, count: number): AgentDef[] {
  const lanes = Math.max(1, n - 2);
  return Array.from({ length: count }, (_, i) => {
    const horiz = i % 2 === 0;
    const rev = (i >> 1) % 2 === 1;
    const lane = 1 + (i % lanes);
    let sx: number, sy: number, dx: number, dy: number;
    if (horiz) {
      const a = rev ? n - 2 : 1, b = rev ? 1 : n - 2;
      sx = sX(a, lane, n, tw); sy = sY(a, lane, tw);
      dx = sX(b, lane, n, tw) - sx; dy = sY(b, lane, tw) - sy;
    } else {
      const a = rev ? n - 2 : 1, b = rev ? 1 : n - 2;
      sx = sX(lane, a, n, tw); sy = sY(lane, a, tw);
      dx = sX(lane, b, n, tw) - sx; dy = sY(lane, b, tw) - sy;
    }
    return {
      color: PED_COLORS[i % PED_COLORS.length],
      sx, sy, dx, dy,
      flipX: dx < 0,
      dur: 7 + ((i * 1.9) % 8),
      delayS: (i * 0.8) % 7,
    };
  });
}

/* ── Decorations: trees + streetlights on the outer rim ─────────────────── */
function CloudShape({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="rgba(255,255,255,0.85)">
      <ellipse cx="0" cy="0" rx="18" ry="10" />
      <ellipse cx="14" cy="3" rx="14" ry="8" />
      <ellipse cx="-14" cy="3" rx="13" ry="7" />
    </g>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function CompanyMap({
  game, company, readOnly = false,
}: {
  game: GameState; company: Company; readOnly?: boolean;
}) {
  const build   = useGameStore((s) => s.build);
  const upgrade = useGameStore((s) => s.upgrade);
  const [selectedType, setSelectedType]         = useState<BuildingType | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell]           = useState<string | null>(null);
  const [speaker, setSpeaker]                   = useState<{ idx: number; text: string } | null>(null);

  // Clear any active speech bubble after a few seconds.
  useEffect(() => {
    if (!speaker) return;
    const t = setTimeout(() => setSpeaker(null), 4200);
    return () => clearTimeout(t);
  }, [speaker]);

  const n  = game.config.mapSize;
  const tw = getTW(n);
  const w  = svgW(n, tw);
  const h  = svgH(n, tw);
  const padX = tw, padTop = Math.round(tw * 1.3), padBottom = Math.round(tw * 0.7);
  const vbW = w + padX * 2;
  const vbH = h + padTop + padBottom;
  const gid = `map-${company.id}`;

  const grid = new Map<string, PlacedBuilding>();
  for (const b of company.buildings) grid.set(`${b.x},${b.y}`, b);

  // Sort tiles back-to-front (lower x+y drawn first)
  const tiles: { x: number; y: number }[] = [];
  for (let s = 0; s < 2 * n - 1; s++) {
    for (let x = 0; x <= s && x < n; x++) {
      const y = s - x;
      if (y >= 0 && y < n) tiles.push({ x, y });
    }
  }

  const onCell = (x: number, y: number) => {
    if (readOnly) return;
    const key = `${x},${y}`;
    const existing = grid.get(key);
    if (existing) {
      setSelectedBuilding(existing.id === selectedBuilding ? null : existing.id);
      setSelectedType(null);
    } else if (selectedType) {
      build(selectedType, x, y);
      setSelectedType(null);
    }
  };

  const inspected = company.buildings.find((b) => b.id === selectedBuilding);
  const built = company.buildings.length;
  const carCount = Math.min(6, 2 + Math.floor(built / 2));
  const pedCount = Math.min(10, 3 + Math.floor(built * 1.2));
  const cars   = buildCars(n, tw, carCount);
  const people = buildPeople(n, tw, pedCount);

  const sky = PHASE_SKY[game.macro.phase] ?? PHASE_SKY.normal;

  const speak = (idx: number) => {
    setSpeaker({ idx, text: pickCityVoice(company, game.macro.phase) });
  };

  return (
    <div className="space-y-3">
      {/* Isometric SVG campus */}
      <div className="overflow-hidden rounded-2xl">
        <svg
          width="100%"
          viewBox={`${-padX} ${-padTop} ${vbW} ${vbH}`}
          style={{ display: "block" }}
          aria-label="회사 캠퍼스 지도"
        >
          <defs>
            <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sky[0]} />
              <stop offset="100%" stopColor={sky[1]} />
            </linearGradient>
            <radialGradient id={`${gid}-vig`} cx="50%" cy="42%" r="75%">
              <stop offset="60%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.22)" />
            </radialGradient>
            <linearGradient id={`${gid}-road`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>

          {/* Sky background */}
          <rect x={-padX} y={-padTop} width={vbW} height={vbH} fill={`url(#${gid}-sky)`} />

          {/* Drifting clouds */}
          <g style={{ pointerEvents: "none" }}>
            <g className="cloud-drift" style={{ "--cloud-dx": `${tw * 0.8}px`, "--cloud-dur": "38s" } as React.CSSProperties}>
              <CloudShape x={w * 0.2} y={-padTop * 0.45} s={0.9} />
            </g>
            <g className="cloud-drift" style={{ "--cloud-dx": `${tw}px`, "--cloud-dur": "52s" } as React.CSSProperties}>
              <CloudShape x={w * 0.7} y={-padTop * 0.2} s={1.15} />
            </g>
          </g>

          {/* Perimeter ring road (diamond outline beneath traffic) */}
          <polygon
            points={[
              `${sX(0, 0, n, tw)},${sY(0, 0, tw) - (tw >> 2)}`,
              `${sX(n - 1, 0, n, tw) + tw * 0.5},${sY(n - 1, 0, tw)}`,
              `${sX(n - 1, n - 1, n, tw)},${sY(n - 1, n - 1, tw) + (tw >> 2)}`,
              `${sX(0, n - 1, n, tw) - tw * 0.5},${sY(0, n - 1, tw)}`,
            ].join(" ")}
            fill="none"
            stroke={`url(#${gid}-road)`}
            strokeWidth={tw * 0.5}
            strokeLinejoin="round"
            opacity="0.55"
            style={{ pointerEvents: "none" }}
          />

          {/* Cars on the ring road */}
          <g style={{ pointerEvents: "none" }}>
            {cars.map((a, i) => (
              <g key={`car${i}`} transform={`translate(${a.sx} ${a.sy})`}>
                <g
                  className="iso-agent-anim"
                  style={{ "--dx": `${a.dx}px`, "--dy": `${a.dy}px`, "--dur": `${a.dur}s`, animationDelay: `-${a.delayS}s` } as React.CSSProperties}
                >
                  <ellipse cx="0" cy="7" rx="12" ry="3" fill="rgba(15,23,42,0.18)" />
                  <g transform={a.flipX ? "scale(-1,1)" : undefined}>
                    <CarShape color={a.color} />
                  </g>
                </g>
              </g>
            ))}
          </g>

          {/* Ground tiles + buildings (back to front) */}
          {tiles.map(({ x, y }) => {
            const key = `${x},${y}`;
            return (
              <IsoTile
                key={key}
                gx={x} gy={y} n={n} tw={tw}
                building={grid.get(key)}
                phase={game.macro.phase}
                selected={grid.get(key)?.id === selectedBuilding}
                buildHighlight={!readOnly && !!selectedType && !grid.has(key) && hoveredCell === key}
                onClick={() => onCell(x, y)}
                onHover={!readOnly && selectedType && !grid.has(key)
                  ? (entering) => setHoveredCell(entering ? key : null)
                  : undefined}
              />
            );
          })}

          {/* Pedestrians inside the campus (clickable) */}
          <g>
            {people.map((a, i) => {
              const speaking = speaker?.idx === i;
              return (
                <g key={`ped${i}`} transform={`translate(${a.sx} ${a.sy})`}>
                  <g
                    className="iso-agent-anim"
                    style={{ "--dx": `${a.dx}px`, "--dy": `${a.dy}px`, "--dur": `${a.dur}s`, animationDelay: `-${a.delayS}s` } as React.CSSProperties}
                  >
                    <ellipse cx="0" cy="9" rx="5" ry="1.8" fill="rgba(15,23,42,0.2)" style={{ pointerEvents: "none" }} />
                    <g transform={a.flipX ? "scale(-1,1)" : undefined} style={{ pointerEvents: "none" }}>
                      <PersonShape color={a.color} />
                    </g>
                    {/* invisible hit area */}
                    <circle
                      cx="0" cy="-2" r="11" fill="transparent"
                      style={{ pointerEvents: "all", cursor: "pointer" }}
                      onClick={() => speak(i)}
                    />
                    {speaking && (
                      <g className="bubble-pop">
                        <foreignObject x={-78} y={-78} width={156} height={62}>
                          <div
                            style={{
                              background: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              padding: "6px 9px",
                              fontSize: 11,
                              lineHeight: 1.25,
                              color: "#334155",
                              boxShadow: "0 4px 12px rgba(15,23,42,0.18)",
                              textAlign: "center",
                            }}
                          >
                            {speaker?.text}
                          </div>
                        </foreignObject>
                        <polygon points="-5,-17 5,-17 0,-11" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
                      </g>
                    )}
                  </g>
                </g>
              );
            })}
          </g>

          {/* Vignette for depth */}
          <rect x={-padX} y={-padTop} width={vbW} height={vbH} fill={`url(#${gid}-vig)`} style={{ pointerEvents: "none" }} />
        </svg>
      </div>

      {!readOnly && (
        <>
          {/* Building inspector */}
          {inspected && (
            <div className="card flex items-center justify-between gap-3 p-3">
              <div className="text-sm">
                <span className="text-lg">{BUILDINGS[inspected.type].emoji}</span>{" "}
                <b className="text-slate-800">{BUILDINGS[inspected.type].name}</b>{" "}
                <span className="text-slate-500">Lv{inspected.level}</span>
                <div className="text-xs text-slate-500">{BUILDINGS[inspected.type].description}</div>
              </div>
              {inspected.level < BUILDINGS[inspected.type].maxLevel ? (
                <button
                  className="btn-primary whitespace-nowrap"
                  onClick={() => upgrade(inspected.id)}
                >
                  업그레이드 · {formatMoney(buildingCostFor(inspected.type, inspected.level + 1))}
                </button>
              ) : (
                <span className="pill bg-slate-100 text-slate-500">최고 레벨</span>
              )}
            </div>
          )}

          {/* Build palette */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">
              건물을 선택하고 빈 타일을 클릭하세요 · 지나가는 사람을 누르면 생각이 보여요
            </div>
            <div className="flex flex-wrap gap-2">
              {BUILDING_LIST.filter((d) => game.config.enabledBuildings.includes(d.type)).map((d) => {
                const active    = selectedType === d.type;
                const cost      = buildingCostFor(d.type, 1);
                const canAfford = company.cash >= cost;
                return (
                  <button
                    key={d.type}
                    onClick={() => {
                      setSelectedType(active ? null : d.type);
                      setSelectedBuilding(null);
                    }}
                    className={`flex flex-col items-center rounded-xl px-3 py-2 ring-2 transition ${
                      active
                        ? "bg-brand-50 ring-brand-500"
                        : "bg-white ring-slate-200 hover:ring-slate-300"
                    } ${canAfford ? "" : "opacity-50"}`}
                  >
                    <span className="text-xl">{d.emoji}</span>
                    <span className="text-xs font-semibold text-slate-700">{d.name}</span>
                    <span className="text-xs text-slate-500">{formatMoney(cost)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingType, PlacedBuilding } from "@/lib/engine";
import { useSeasonTheme } from "./seasonTheme";

// Low-poly campus buildings styled after the building illustrations in
// public/assets/buildings: a paved plinth, light walls with one accent colour,
// a rimmed flat roof with rooftop units, big windows, striped awnings, a round
// emblem sign and a few trees or props around each building.

type V3 = [number, number, number];
type Face = "front" | "side";

/** Top of the paved plinth every building stands on. */
const Y0 = 0.07;

const GLASS = { color: "#a9dcff", emissive: "#7fc4ff", emissiveIntensity: 0.28, roughness: 0.15, metalness: 0.1 };
const WARM = { color: "#ffe7a6", emissive: "#ffbf4d", emissiveIntensity: 0.55, roughness: 0.4, metalness: 0 };
const SELECT_GLOW = "#6366f1";

/* ── primitives ──────────────────────────────────────────────────────────── */

function Block({
  size, position, color, rotation, cast = false, glow = false,
  emissive, emissiveIntensity = 0, roughness = 0.85, metalness = 0, transparent, opacity,
}: {
  size: V3; position: V3; color: string; rotation?: V3; cast?: boolean; glow?: boolean;
  emissive?: string; emissiveIntensity?: number; roughness?: number; metalness?: number;
  transparent?: boolean; opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={glow ? SELECT_GLOW : emissive ?? "#000000"}
        emissiveIntensity={glow ? 0.35 : emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  );
}

function Cyl({
  r, h, position, color, rotation, segments = 16, cast = false, rTop,
  emissive, emissiveIntensity = 0, transparent, opacity, roughness = 0.8,
}: {
  r: number; h: number; position: V3; color: string; rotation?: V3; segments?: number; cast?: boolean;
  rTop?: number; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; roughness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast}>
      <cylinderGeometry args={[rTop ?? r, r, h, segments]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
        roughness={roughness}
      />
    </mesh>
  );
}

function Ball({ r, position, color, scale, emissive, emissiveIntensity = 0 }: {
  r: number; position: V3; color: string; scale?: V3; emissive?: string; emissiveIntensity?: number;
}) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[r, 12, 10]} />
      <meshStandardMaterial color={color} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} roughness={0.9} />
    </mesh>
  );
}

/* ── shared building parts ───────────────────────────────────────────────── */

function Plinth({ base = "#d7dbe1", top = "#eceff3" }: { base?: string; top?: string }) {
  return (
    <group>
      <Block size={[0.94, 0.05, 0.94]} position={[0, 0.025, 0]} color={base} />
      <Block size={[0.9, 0.02, 0.9]} position={[0, 0.06, 0]} color={top} />
    </group>
  );
}

/** Main walls. The body stands on the plinth with its centre at (x, z). */
function Body({ w, d, h, color, glow, x = 0, z = 0 }: {
  w: number; d: number; h: number; color: string; glow?: boolean; x?: number; z?: number;
}) {
  return (
    <RoundedBox args={[w, h, d]} radius={0.018} smoothness={2} position={[x, Y0 + h / 2, z]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        emissive={glow ? SELECT_GLOW : "#000000"}
        emissiveIntensity={glow ? 0.35 : 0}
      />
    </RoundedBox>
  );
}

/** Flat roof with a raised rim, like the illustrations. */
function Roof({ w, d, h, color, rim, x = 0, z = 0 }: {
  w: number; d: number; h: number; color: string; rim: string; x?: number; z?: number;
}) {
  const y = Y0 + h;
  const t = 0.04;
  return (
    <group position={[x, y, z]}>
      <Block size={[w - 0.02, 0.012, d - 0.02]} position={[0, 0.006, 0]} color={color} />
      <Block size={[w + 0.012, 0.055, t]} position={[0, 0.027, d / 2 - t / 2 + 0.006]} color={rim} />
      <Block size={[w + 0.012, 0.055, t]} position={[0, 0.027, -d / 2 + t / 2 - 0.006]} color={rim} />
      <Block size={[t, 0.055, d + 0.012]} position={[w / 2 - t / 2 + 0.006, 0.027, 0]} color={rim} />
      <Block size={[t, 0.055, d + 0.012]} position={[-w / 2 + t / 2 - 0.006, 0.027, 0]} color={rim} />
    </group>
  );
}

/** A coloured stripe wrapped around the walls at height y (above the plinth). */
function Band({ w, d, y, color, h = 0.045, x = 0, z = 0 }: {
  w: number; d: number; y: number; color: string; h?: number; x?: number; z?: number;
}) {
  return <Block size={[w + 0.014, h, d + 0.014]} position={[x, Y0 + y, z]} color={color} />;
}

/** A row of window panes on the front (+z) or side (+x) wall. */
function Panes({ face, w, d, y, count, pw, ph, warm = false, x = 0, z = 0, span, offset = 0 }: {
  face: Face; w: number; d: number; y: number; count: number; pw: number; ph: number;
  warm?: boolean; x?: number; z?: number; span?: number; offset?: number;
}) {
  const mat = warm ? WARM : GLASS;
  const width = span ?? (face === "front" ? w : d) - 0.12;
  const step = count > 1 ? (width - pw) / (count - 1) : 0;
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const along = offset + (count > 1 ? -width / 2 + pw / 2 + i * step : 0);
        const position: V3 = face === "front"
          ? [x + along, Y0 + y, z + d / 2 + 0.004]
          : [x + w / 2 + 0.004, Y0 + y, z - along];
        const size: V3 = face === "front" ? [pw, ph, 0.012] : [0.012, ph, pw];
        return (
          <mesh key={i} position={position}>
            <boxGeometry args={size} />
            <meshStandardMaterial {...mat} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Extra window rows for the upper floors of taller (upgraded) buildings. */
function UpperFloors({ w, d, h, from = 0.3, warm = false, x = 0, z = 0, count = 3 }: {
  w: number; d: number; h: number; from?: number; warm?: boolean; x?: number; z?: number; count?: number;
}) {
  const rows = Math.floor((h - from - 0.04) / 0.16);
  if (rows <= 0) return null;
  return (
    <group>
      {Array.from({ length: rows }).map((_, r) => (
        <group key={r}>
          <Panes face="front" w={w} d={d} y={from + 0.08 + r * 0.16} count={count} pw={0.1} ph={0.08} warm={warm} x={x} z={z} />
          <Panes face="side" w={w} d={d} y={from + 0.08 + r * 0.16} count={count} pw={0.1} ph={0.08} warm={warm} x={x} z={z} />
        </group>
      ))}
    </group>
  );
}

/** Door (with an optional frame) on the front or side wall. */
function Door({ face, w, d, width = 0.12, height = 0.2, color, x = 0, z = 0, offset = 0, glass = false }: {
  face: Face; w: number; d: number; width?: number; height?: number; color: string;
  x?: number; z?: number; offset?: number; glass?: boolean;
}) {
  const position: V3 = face === "front"
    ? [x + offset, Y0 + height / 2, z + d / 2 + 0.006]
    : [x + w / 2 + 0.006, Y0 + height / 2, z - offset];
  const size: V3 = face === "front" ? [width, height, 0.014] : [0.014, height, width];
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      {glass ? <meshStandardMaterial {...GLASS} /> : <meshStandardMaterial color={color} roughness={0.7} />}
    </mesh>
  );
}

/** Tilted, striped shop awning over a wall opening. */
function Awning({ face, w, d, y, width, colors, depth = 0.15, x = 0, z = 0, offset = 0, stripes = 6 }: {
  face: Face; w: number; d: number; y: number; width: number; colors: [string, string];
  depth?: number; x?: number; z?: number; offset?: number; stripes?: number;
}) {
  const stripeW = width / stripes;
  const anchor: V3 = face === "front"
    ? [x + offset, Y0 + y, z + d / 2 + depth / 2 - 0.01]
    : [x + w / 2 + depth / 2 - 0.01, Y0 + y, z - offset];
  return (
    <group position={anchor} rotation={face === "front" ? [0.38, 0, 0] : [0, Math.PI / 2, 0]}>
      <group rotation={face === "side" ? [0.38, 0, 0] : [0, 0, 0]}>
        {Array.from({ length: stripes }).map((_, i) => (
          <mesh key={i} position={[-width / 2 + stripeW / 2 + i * stripeW, 0, 0]} castShadow>
            <boxGeometry args={[stripeW, 0.018, depth]} />
            <meshStandardMaterial color={colors[i % 2]} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Flat canopy over an entrance (office, clinic, hr…). */
function Canopy({ face, w, d, y, width, color, depth = 0.13, x = 0, z = 0, offset = 0, columns = false }: {
  face: Face; w: number; d: number; y: number; width: number; color: string; depth?: number;
  x?: number; z?: number; offset?: number; columns?: boolean;
}) {
  const front = face === "front";
  const center: V3 = front
    ? [x + offset, Y0 + y, z + d / 2 + depth / 2]
    : [x + w / 2 + depth / 2, Y0 + y, z - offset];
  const size: V3 = front ? [width, 0.025, depth] : [depth, 0.025, width];
  return (
    <group>
      <Block size={size} position={center} color={color} cast />
      {columns && [-1, 1].map((s) => {
        const c: V3 = front
          ? [center[0] + s * (width / 2 - 0.02), Y0 + y / 2, center[2] + depth / 2 - 0.02]
          : [center[0] + depth / 2 - 0.02, Y0 + y / 2, center[2] + s * (width / 2 - 0.02)];
        return <Cyl key={s} r={0.014} h={y} position={c} color="#ffffff" segments={8} />;
      })}
    </group>
  );
}

/** Round emblem sign on a wall (white disc with a coloured ring). */
function Sign({ face, w, d, y, ring, center = "#ffffff", x = 0, z = 0, offset = 0, r = 0.075, children }: {
  face: Face; w: number; d: number; y: number; ring: string; center?: string;
  x?: number; z?: number; offset?: number; r?: number; children?: React.ReactNode;
}) {
  const front = face === "front";
  const position: V3 = front ? [x + offset, Y0 + y, z + d / 2 + 0.012] : [x + w / 2 + 0.012, Y0 + y, z - offset];
  return (
    <group position={position} rotation={front ? [Math.PI / 2, 0, 0] : [0, 0, -Math.PI / 2]}>
      <Cyl r={r + 0.018} h={0.012} position={[0, 0, 0]} color={ring} segments={20} />
      <Cyl r={r} h={0.014} position={[0, 0.004, 0]} color={center} segments={20} />
      {children && <group position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>{children}</group>}
    </group>
  );
}

function RooftopUnit({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <Block size={[0.13, 0.07, 0.1]} position={[0, 0.035, 0]} color="#d5d9df" cast />
      <Cyl r={0.032} h={0.008} position={[0, 0.074, 0]} color="#7b8391" segments={12} />
    </group>
  );
}

export function RoundTree({ position, scale = 1, color }: { position: V3; scale?: number; color?: string }) {
  const theme = useSeasonTheme();
  return (
    <group position={position} scale={scale}>
      <Cyl r={0.018} h={0.12} position={[0, 0.06, 0]} color="#8d5a2b" segments={6} />
      <Ball r={0.085} position={[0, 0.17, 0]} color={color ?? theme.canopy} />
      <Ball r={0.06} position={[0.04, 0.22, 0.02]} color={color ? "#7ed37a" : theme.canopyHi} />
    </group>
  );
}

export function PineTree({ position, scale = 1 }: { position: V3; scale?: number }) {
  const theme = useSeasonTheme();
  return (
    <group position={position} scale={scale}>
      <Cyl r={0.016} h={0.08} position={[0, 0.04, 0]} color="#8d5a2b" segments={6} />
      <mesh position={[0, 0.14, 0]} castShadow>
        <coneGeometry args={[0.08, 0.16, 8]} />
        <meshStandardMaterial color={theme.pineLow} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.23, 0]} castShadow>
        <coneGeometry args={[0.058, 0.12, 8]} />
        <meshStandardMaterial color={theme.pineHigh} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Bush({ position, scale = 1, color }: { position: V3; scale?: number; color?: string }) {
  const theme = useSeasonTheme();
  return <Ball r={0.05} position={position} color={color ?? theme.bush} scale={[scale * 1.2, scale * 0.8, scale]} />;
}

function Hedge({ position, length, along = "x" }: { position: V3; length: number; along?: "x" | "z" }) {
  return (
    <Block
      size={along === "x" ? [length, 0.06, 0.06] : [0.06, 0.06, length]}
      position={[position[0], position[1] + 0.03, position[2]]}
      color="#4fae4f"
    />
  );
}

function Crate({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Block size={[0.08, 0.07, 0.08]} position={[0, 0.035, 0]} color="#d4a15f" cast />
      <Block size={[0.082, 0.012, 0.082]} position={[0, 0.05, 0]} color="#b47f3d" />
    </group>
  );
}

function PlantPot({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <Cyl r={0.03} rTop={0.035} h={0.05} position={[0, 0.025, 0]} color="#d9824b" segments={10} />
      <Ball r={0.04} position={[0, 0.07, 0]} color="#5cb85c" />
    </group>
  );
}

function Bench({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block size={[0.14, 0.015, 0.045]} position={[0, 0.04, 0]} color="#b7793f" />
      <Block size={[0.14, 0.035, 0.012]} position={[0, 0.062, -0.02]} color="#b7793f" />
      <Block size={[0.012, 0.035, 0.04]} position={[-0.06, 0.017, 0]} color="#5b6170" />
      <Block size={[0.012, 0.035, 0.04]} position={[0.06, 0.017, 0]} color="#5b6170" />
    </group>
  );
}

export function SmokePuff({ position, scale = 1 }: { position: V3; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime % 2) / 2;
    ref.current.position.y = position[1] + t * 0.45;
    ref.current.scale.setScalar((0.05 + t * 0.1) * scale);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = (1 - t) * 0.55;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#e2e8f0" transparent opacity={0.4} />
    </mesh>
  );
}

/* ── building heights (also used for stars and speech bubbles) ──────────── */

const HEIGHT: Record<BuildingType, (level: number) => number> = {
  factory: (l) => 0.32 + l * 0.12,
  warehouse: (l) => 0.28 + l * 0.09,
  store: (l) => 0.34 + l * 0.11,
  office: (l) => 0.4 + l * 0.3,
  rnd: (l) => 0.38 + l * 0.2,
  hr: (l) => 0.34 + l * 0.14,
  power: (l) => 0.32 + l * 0.12,
  park: () => 0,
  cafeteria: (l) => 0.34 + l * 0.11,
  dorm: (l) => (2 + l) * 0.17 + 0.04,
  gym: (l) => 0.34 + l * 0.12,
  daycare: (l) => 0.32 + l * 0.12,
  clinic: (l) => 0.38 + l * 0.14,
  lab: (l) => 0.42 + l * 0.24,
  fountain: () => 0,
  statue: (l) => 0.2 + l * 0.06,
  clocktower: (l) => 0.7 + l * 0.25,
  ferris: (l) => 0.5 + l * 0.1,
};

/** Approximate highest point of a model, so stars and bubbles float above it. */
export function buildingTop(type: BuildingType, level: number): number {
  const h = HEIGHT[type](level);
  switch (type) {
    case "factory": return Y0 + h + 0.36;
    case "park": return 0.35;
    case "fountain": return 0.42;
    case "statue": return Y0 + h + 0.32;
    case "clocktower": return Y0 + h + 0.3;
    case "ferris": return 0.5 + level * 0.1 + 0.34 + level * 0.04 + 0.08;
    case "lab": return Y0 + h + 0.2;
    case "rnd": return Y0 + h + 0.25;
    default: return Y0 + h + 0.12;
  }
}

/* ── building models ─────────────────────────────────────────────────────── */

interface ModelProps {
  level: number;
  glow: boolean;
  /** Company colour, shown as a small flag rather than tinting the walls. */
  brand?: string;
}

function Factory({ level, glow }: ModelProps) {
  const w = 0.74, d = 0.64, h = HEIGHT.factory(level), x = -0.04, z = -0.07;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#f4efe6" glow={glow} x={x} z={z} />
      <Band w={w} d={d} y={h * 0.62} color="#f28c28" x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#7b8494" rim="#b9bfc8" x={x} z={z} />
      {/* big roll-up door with slats */}
      <Door face="front" w={w} d={d} width={0.26} height={0.22} color="#f28c28" x={x} z={z} offset={-0.13} />
      {[0.05, 0.1, 0.15].map((yy) => (
        <Block key={yy} size={[0.24, 0.01, 0.006]} position={[x - 0.13, Y0 + yy, z + d / 2 + 0.016]} color="#d36f16" />
      ))}
      <Panes face="front" w={w} d={d} y={0.16} count={2} pw={0.09} ph={0.09} x={x} z={z} span={0.24} offset={0.17} />
      <Panes face="side" w={w} d={d} y={0.16} count={3} pw={0.1} ph={0.09} x={x} z={z} />
      <Awning face="side" w={w} d={d} y={0.25} width={0.2} colors={["#f28c28", "#ffffff"]} x={x} z={z} offset={-0.18} stripes={4} />
      {/* striped chimneys */}
      {[[0.2, -0.17], [0.05, -0.2]].map(([cx, cz], i) => (
        <group key={i} position={[x + cx, roofY, z + cz]}>
          <Cyl r={0.045} h={0.3} position={[0, 0.15, 0]} color="#f28c28" cast segments={12} />
          <Cyl r={0.047} h={0.05} position={[0, 0.22, 0]} color="#ffffff" segments={12} />
          <Cyl r={0.05} h={0.02} position={[0, 0.3, 0]} color="#c85f10" segments={12} />
        </group>
      ))}
      <SmokePuff position={[x + 0.2, roofY + 0.33, z - 0.17]} />
      <RooftopUnit position={[x - 0.18, roofY, z + 0.05]} />
      <RooftopUnit position={[x - 0.18, roofY, z - 0.13]} />
      {level >= 3 && <RooftopUnit position={[x + 0.02, roofY, z + 0.12]} />}
      <Crate position={[0.33, Y0, 0.36]} />
      <Crate position={[0.25, Y0, 0.39]} scale={0.8} />
      <PineTree position={[-0.38, Y0, 0.32]} />
      <Bush position={[0.39, Y0 + 0.03, -0.3]} />
    </group>
  );
}

function Warehouse({ level, glow }: ModelProps) {
  const w = 0.8, d = 0.66, h = HEIGHT.warehouse(level), x = 0, z = -0.08;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#5f6673" glow={glow} x={x} z={z} />
      {/* corrugated ribs */}
      {Array.from({ length: 7 }).map((_, i) => (
        <Block key={`f${i}`} size={[0.012, h * 0.86, 0.008]} position={[x - w / 2 + 0.06 + i * ((w - 0.12) / 6), Y0 + h * 0.5, z + d / 2 + 0.004]} color="#737b89" />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={`s${i}`} size={[0.008, h * 0.86, 0.012]} position={[x + w / 2 + 0.004, Y0 + h * 0.5, z - d / 2 + 0.06 + i * ((d - 0.12) / 5)]} color="#737b89" />
      ))}
      <Roof w={w} d={d} h={h} color="#4b5260" rim="#f97316" x={x} z={z} />
      <Block size={[0.16, 0.014, 0.1]} position={[x - 0.14, roofY + 0.02, z]} color="#9fd2f5" />
      <Block size={[0.16, 0.014, 0.1]} position={[x + 0.14, roofY + 0.02, z]} color="#9fd2f5" />
      {/* loading docks */}
      {[-0.18, 0.18].map((ox) => (
        <group key={ox}>
          <Block size={[0.22, 0.22, 0.014]} position={[x + ox, Y0 + 0.11, z + d / 2 + 0.008]} color="#f97316" />
          <Block size={[0.18, 0.18, 0.014]} position={[x + ox, Y0 + 0.095, z + d / 2 + 0.014]} color="#2d3138" />
          <Crate position={[x + ox - 0.03, Y0, z + d / 2 - 0.03]} scale={0.8} />
          <Block size={[0.24, 0.016, 0.07]} position={[x + ox, Y0 + 0.24, z + d / 2 + 0.035]} color="#f97316" rotation={[0.35, 0, 0]} />
        </group>
      ))}
      <Block size={[0.012, 0.05, d * 0.7]} position={[x + w / 2 + 0.008, Y0 + h * 0.78, z]} color="#9fb7cf" />
      {/* crate stack + forklift */}
      <Crate position={[-0.37, Y0, 0.36]} />
      <Crate position={[-0.29, Y0, 0.38]} />
      <Crate position={[-0.33, Y0 + 0.07, 0.37]} />
      <group position={[0.3, Y0, 0.4]}>
        <Block size={[0.07, 0.05, 0.09]} position={[0, 0.03, 0]} color="#facc15" cast />
        <Block size={[0.012, 0.11, 0.012]} position={[0, 0.07, 0.05]} color="#4b5563" />
      </group>
      <PineTree position={[0.4, Y0, -0.36]} scale={0.9} />
    </group>
  );
}

function Store({ level, glow }: ModelProps) {
  const w = 0.68, d = 0.56, h = HEIGHT.store(level), x = 0, z = -0.1;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth base="#e3d7da" top="#f6eef0" />
      <Body w={w} d={d} h={h} color="#a6e3cf" glow={glow} x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#f7c9d8" rim="#fffafc" x={x} z={z} />
      <Panes face="front" w={w} d={d} y={0.11} count={2} pw={0.2} ph={0.15} warm x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.12} height={0.19} color="#2f9e8f" x={x} z={z} />
      <Awning face="front" w={w} d={d} y={0.23} width={w - 0.02} colors={["#f48fb1", "#ffffff"]} x={x} z={z} stripes={8} />
      <Sign face="front" w={w} d={d} y={Math.max(0.33, h - 0.08)} ring="#f48fb1" x={x} z={z}>
        <Block size={[0.05, 0.05, 0.01]} position={[0, 0, 0]} color="#f06292" />
      </Sign>
      <Panes face="side" w={w} d={d} y={0.12} count={1} pw={0.26} ph={0.14} warm x={x} z={z} />
      <Awning face="side" w={w} d={d} y={0.23} width={0.3} colors={["#f48fb1", "#ffffff"]} x={x} z={z} stripes={5} />
      <UpperFloors w={w} d={d} h={h - 0.08} from={0.32} warm x={x} z={z} count={2} />
      <RooftopUnit position={[x + 0.12, roofY, z - 0.08]} />
      <PlantPot position={[-0.36, Y0, 0.36]} />
      <PlantPot position={[0.36, Y0, 0.36]} />
      <Block size={[0.05, 0.06, 0.03]} position={[-0.26, Y0 + 0.03, 0.38]} color="#f48fb1" />
      <RoundTree position={[0.39, Y0, -0.3]} />
    </group>
  );
}

function Office({ level, glow, brand }: ModelProps) {
  const w = 0.66, d = 0.6, h = HEIGHT.office(level), x = -0.02, z = -0.07;
  const roofY = Y0 + h;
  const floors = 1 + level;
  const floorH = (h - 0.06) / floors;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#f6f8fc" glow={glow} x={x} z={z} />
      {Array.from({ length: floors }).map((_, f) => (
        <group key={f}>
          {f > 0 && <Panes face="front" w={w} d={d} y={0.04 + floorH * (f + 0.5)} count={3} pw={0.17} ph={floorH * 0.66} x={x} z={z} />}
          <Panes face="side" w={w} d={d} y={0.04 + floorH * (f + 0.5)} count={3} pw={0.15} ph={floorH * 0.66} x={x} z={z} />
          {f > 0 && <Block size={[w + 0.012, 0.02, d + 0.012]} position={[x, Y0 + 0.04 + floorH * f, z]} color="#dfe6f2" />}
        </group>
      ))}
      <Panes face="front" w={w} d={d} y={0.04 + floorH * 0.5} count={2} pw={0.14} ph={floorH * 0.66} x={x} z={z} span={0.56} />
      <Door face="front" w={w} d={d} width={0.14} height={0.17} color="#1f2937" glass x={x} z={z} />
      <Canopy face="front" w={w} d={d} y={0.19} width={0.26} color="#3f6fd1" x={x} z={z} columns />
      <Roof w={w} d={d} h={h} color="#8fb1ea" rim="#4a72c9" x={x} z={z} />
      <Block size={[0.22, 0.1, 0.18]} position={[x + 0.12, roofY + 0.05, z - 0.1]} color="#cfe6ff" emissive="#7fc4ff" emissiveIntensity={0.2} />
      <RooftopUnit position={[x - 0.15, roofY, z + 0.08]} />
      <RooftopUnit position={[x - 0.15, roofY, z - 0.1]} />
      {brand && (
        <group position={[x - 0.24, roofY, z - 0.2]}>
          <Cyl r={0.008} h={0.26} position={[0, 0.13, 0]} color="#cbd5e1" segments={6} />
          <Block size={[0.12, 0.07, 0.008]} position={[0.06, 0.22, 0]} color={brand} />
        </group>
      )}
      <RoundTree position={[0.37, Y0, 0.31]} />
      <RoundTree position={[-0.38, Y0, 0.33]} scale={0.9} />
      <Hedge position={[-0.2, Y0, 0.4]} length={0.2} />
      <Block size={[0.1, 0.06, 0.012]} position={[0.16, Y0 + 0.05, 0.41]} color="#ffffff" />
    </group>
  );
}

function Rnd({ level, glow }: ModelProps) {
  const w = 0.66, d = 0.6, h = HEIGHT.rnd(level), x = -0.04, z = -0.07;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#e5dbfb" glow={glow} x={x} z={z} />
      <Band w={w} d={d} y={h - 0.05} color="#9b6bdc" h={0.06} x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#ece6fb" rim="#9b6bdc" x={x} z={z} />
      {/* rounded glass corner */}
      <mesh position={[x + w / 2 - 0.1, Y0 + h * 0.45, z + d / 2 - 0.1]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, h * 0.9, 20]} />
        <meshStandardMaterial {...GLASS} transparent opacity={0.85} />
      </mesh>
      <Cyl r={0.17} h={0.03} position={[x + w / 2 - 0.1, Y0 + h * 0.9 + 0.015, z + d / 2 - 0.1]} color="#9b6bdc" segments={20} />
      <Panes face="front" w={w} d={d} y={h * 0.35} count={2} pw={0.12} ph={0.12} x={x} z={z} span={0.3} offset={-0.14} />
      <Panes face="side" w={w} d={d} y={h * 0.35} count={2} pw={0.12} ph={0.12} x={x} z={z} span={0.26} offset={0.12} />
      <Canopy face="front" w={w} d={d} y={0.18} width={0.2} color="#9b6bdc" x={x} z={z} offset={-0.15} />
      <Sign face="front" w={w} d={d} y={h * 0.72} ring="#9b6bdc" x={x} z={z} offset={-0.15} r={0.06}>
        <Ball r={0.018} position={[0, 0, 0]} color="#7c4dcc" />
      </Sign>
      <RooftopUnit position={[x - 0.16, roofY, z - 0.1]} />
      <RooftopUnit position={[x - 0.02, roofY, z - 0.14]} />
      <Cyl r={0.008} h={0.22} position={[x - 0.2, roofY + 0.11, z + 0.12]} color="#94a3b8" segments={6} />
      <Ball r={0.025} position={[x - 0.2, roofY + 0.23, z + 0.12]} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      <Hedge position={[-0.25, Y0, 0.4]} length={0.24} />
      <Crate position={[0.12, Y0, 0.4]} scale={0.7} />
      <PineTree position={[0.4, Y0, -0.34]} />
    </group>
  );
}

function Hr({ level, glow }: ModelProps) {
  const w = 0.62, d = 0.56, h = HEIGHT.hr(level), x = 0, z = -0.08;
  const roofY = Y0 + h;
  const floors = Math.max(1, Math.round(h / 0.2));
  return (
    <group>
      <Plinth base="#d9cbb5" top="#efe4d2" />
      <Body w={w} d={d} h={h} color="#efd9b4" glow={glow} x={x} z={z} />
      {Array.from({ length: floors }).map((_, f) => (
        <group key={f}>
          <Panes face="front" w={w} d={d} y={0.1 + f * 0.19} count={2} pw={0.13} ph={0.1} warm x={x} z={z} span={0.42} />
          <Panes face="side" w={w} d={d} y={0.1 + f * 0.19} count={2} pw={0.13} ph={0.1} warm x={x} z={z} />
        </group>
      ))}
      <Roof w={w} d={d} h={h} color="#a8865f" rim="#c79c6a" x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.11} height={0.17} color="#8b5a2b" x={x} z={z} />
      <Canopy face="front" w={w} d={d} y={0.19} width={0.2} color="#f59e0b" x={x} z={z} />
      <Sign face="front" w={w} d={d} y={Math.max(0.3, h - 0.08)} ring="#f59e0b" x={x} z={z}>
        <Ball r={0.02} position={[0, 0.012, 0]} color="#f59e0b" />
      </Sign>
      <RooftopUnit position={[x + 0.12, roofY, z - 0.08]} />
      <Bench position={[-0.3, Y0, 0.38]} />
      <RoundTree position={[0.37, Y0, 0.32]} />
      <Hedge position={[0.38, Y0, -0.1]} length={0.3} along="z" />
    </group>
  );
}

function Power({ level, glow }: ModelProps) {
  const w = 0.42, d = 0.58, h = HEIGHT.power(level), x = -0.22, z = -0.08;
  const roofY = Y0 + h;
  const spinRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (spinRef.current) spinRef.current.rotation.z = state.clock.elapsedTime * 2.2;
  });
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#2f6bd6" glow={glow} x={x} z={z} />
      <Band w={w} d={d} y={h * 0.55} color="#facc15" x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#1e3a8a" rim="#facc15" x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.11} height={0.17} color="#cbd5e1" x={x} z={z} />
      <Panes face="side" w={w} d={d} y={0.14} count={2} pw={0.12} ph={0.08} x={x} z={z} />
      <Sign face="side" w={w} d={d} y={h * 0.78} ring="#facc15" center="#facc15" x={x} z={z} offset={0.15} r={0.055}>
        <Block size={[0.015, 0.06, 0.01]} position={[0, 0, 0]} color="#1e3a8a" rotation={[0, 0, 0.5]} />
      </Sign>
      <RooftopUnit position={[x, roofY, z - 0.12]} />
      {level >= 2 && (
        <group position={[x, roofY, z + 0.12]}>
          <Cyl r={0.01} h={0.3} position={[0, 0.15, 0]} color="#e5e7eb" segments={6} />
          <group ref={spinRef} position={[0, 0.3, 0.02]}>
            {[0, 1, 2].map((i) => (
              <Block key={i} size={[0.02, 0.16, 0.008]} position={[0, 0, 0]} rotation={[0, 0, (i * Math.PI * 2) / 3]} color="#ffffff" />
            ))}
          </group>
        </group>
      )}
      {/* transformer yard */}
      <Block size={[0.36, 0.012, 0.66]} position={[0.22, Y0 + 0.006, 0]} color="#b8bdc6" />
      {[-0.14, 0.14].map((oz) => (
        <group key={oz} position={[0.2, Y0, oz]}>
          <Block size={[0.12, 0.1, 0.12]} position={[0, 0.05, 0]} color="#9aa3af" cast />
          <Block size={[0.13, 0.01, 0.13]} position={[0, 0.1, 0]} color="#6b7280" />
        </group>
      ))}
      {[-0.3, 0.3].map((oz) => (
        <group key={oz} position={[0.33, Y0, oz]}>
          <Cyl r={0.01} h={0.4} position={[0, 0.2, 0]} color="#6b7280" segments={6} />
          <Block size={[0.012, 0.012, 0.14]} position={[0, 0.36, 0]} color="#6b7280" />
        </group>
      ))}
      <Block size={[0.004, 0.004, 0.6]} position={[0.33, Y0 + 0.36, 0]} color="#334155" />
      <PineTree position={[-0.38, Y0, 0.36]} scale={0.9} />
    </group>
  );
}

function Park({ level }: ModelProps) {
  const flowers = ["#f87171", "#facc15", "#f472b6", "#a78bfa", "#fb923c", "#60a5fa"];
  return (
    <group>
      <Plinth base="#6fbf57" top="#8fd673" />
      <mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.045, 6, 28]} />
        <meshStandardMaterial color="#ead9b0" roughness={0.95} />
      </mesh>
      <Block size={[0.9, 0.006, 0.08]} position={[0, 0.073, 0]} color="#ead9b0" />
      <Block size={[0.08, 0.006, 0.9]} position={[0, 0.073, 0]} color="#ead9b0" />
      <Cyl r={0.1} h={0.05} position={[0, 0.095, 0]} color="#f1f5f9" segments={20} />
      <Cyl r={0.085} h={0.01} position={[0, 0.118, 0]} color="#60a5fa" segments={20} emissive="#3b82f6" emissiveIntensity={0.2} />
      <Cyl r={0.015} h={0.08} position={[0, 0.15, 0]} color="#e2e8f0" segments={8} />
      <RoundTree position={[-0.32, Y0, -0.32]} />
      <RoundTree position={[0.32, Y0, -0.32]} scale={0.9} />
      <RoundTree position={[-0.32, Y0, 0.32]} scale={0.85} />
      {level >= 2 ? <PineTree position={[0.32, Y0, 0.32]} /> : <Bush position={[0.32, Y0 + 0.03, 0.32]} />}
      <Bench position={[0.2, Y0, 0.13]} rotation={-Math.PI / 4} />
      <Bench position={[-0.2, Y0, -0.13]} rotation={(Math.PI * 3) / 4} />
      {flowers.slice(0, level >= 2 ? 6 : 4).map((c, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        return <Ball key={i} r={0.025} position={[Math.cos(a) * 0.38, Y0 + 0.02, Math.sin(a) * 0.15]} color={c} />;
      })}
    </group>
  );
}

function Cafeteria({ level, glow }: ModelProps) {
  const w = 0.64, d = 0.56, h = HEIGHT.cafeteria(level), x = 0.03, z = -0.1;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth base="#e2d6c6" top="#f4ece0" />
      <Body w={w} d={d} h={h} color="#fde3b8" glow={glow} x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#f6e7d6" rim="#f0a83c" x={x} z={z} />
      <Panes face="front" w={w} d={d} y={0.11} count={2} pw={0.17} ph={0.15} warm x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.11} height={0.18} color="#b45309" x={x} z={z} />
      <Awning face="front" w={w} d={d} y={0.22} width={0.42} colors={["#f59e0b", "#fff7ed"]} x={x} z={z} stripes={6} />
      <Sign face="front" w={w} d={d} y={Math.max(0.32, h - 0.08)} ring="#f59e0b" x={x} z={z}>
        <mesh position={[0, 0, 0]}>
          <coneGeometry args={[0.03, 0.04, 10]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </Sign>
      <Panes face="side" w={w} d={d} y={0.12} count={2} pw={0.16} ph={0.14} warm x={x} z={z} />
      <UpperFloors w={w} d={d} h={h - 0.08} from={0.32} warm x={x} z={z} count={2} />
      <RooftopUnit position={[x - 0.12, roofY, z - 0.08]} />
      <RooftopUnit position={[x + 0.08, roofY, z - 0.1]} />
      {/* parasol table */}
      <group position={[-0.32, Y0, 0.3]}>
        <Cyl r={0.04} h={0.05} position={[0, 0.05, 0]} color="#ffffff" segments={12} />
        <Cyl r={0.006} h={0.2} position={[0, 0.1, 0]} color="#94a3b8" segments={6} />
        <mesh position={[0, 0.21, 0]} castShadow>
          <coneGeometry args={[0.12, 0.06, 12]} />
          <meshStandardMaterial color="#fdba74" />
        </mesh>
      </group>
      <Bench position={[0.38, Y0, 0.12]} rotation={Math.PI / 2} />
      <PlantPot position={[0.36, Y0, 0.38]} />
      <RoundTree position={[0.38, Y0, -0.34]} scale={0.9} />
    </group>
  );
}

function Dorm({ level, glow }: ModelProps) {
  const w = 0.6, d = 0.54, h = HEIGHT.dorm(level), x = 0, z = -0.06;
  const roofY = Y0 + h;
  const floors = 2 + level;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#f4b7c9" glow={glow} x={x} z={z} />
      {Array.from({ length: floors }).map((_, f) => (
        <group key={f}>
          <Panes face="front" w={w} d={d} y={0.1 + f * 0.17} count={3} pw={0.09} ph={0.08} warm x={x} z={z} />
          <Panes face="side" w={w} d={d} y={0.1 + f * 0.17} count={3} pw={0.09} ph={0.08} warm x={x} z={z} />
          {f > 0 && <Block size={[w + 0.014, 0.015, d + 0.014]} position={[x, Y0 + f * 0.17 + 0.02, z]} color="#fff1e6" />}
        </group>
      ))}
      <Roof w={w} d={d} h={h} color="#d9c6c0" rim="#fff1e6" x={x} z={z} />
      <Block size={[w - 0.16, 0.03, d - 0.16]} position={[x, roofY + 0.025, z]} color="#7cc96a" />
      <RoundTree position={[x + 0.12, roofY + 0.03, z - 0.08]} scale={0.6} />
      <Bench position={[x - 0.1, roofY + 0.03, z + 0.06]} />
      <Canopy face="front" w={w} d={d} y={0.16} width={0.16} color="#db5c8a" x={x} z={z} offset={0.02} />
      <PineTree position={[-0.39, Y0, 0.32]} />
      <PineTree position={[0.39, Y0, 0.34]} scale={0.85} />
    </group>
  );
}

function Gym({ level, glow }: ModelProps) {
  const w = 0.68, d = 0.58, h = HEIGHT.gym(level), x = -0.02, z = -0.08;
  const roofY = Y0 + h;
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#93a7c8" glow={glow} x={x} z={z} />
      <Band w={w} d={d} y={h - 0.06} color="#a3e635" h={0.05} x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#475569" rim="#cbd5e1" x={x} z={z} />
      <Panes face="front" w={w} d={d} y={0.13} count={2} pw={0.2} ph={0.17} x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.11} height={0.18} color="#1f2937" glass x={x} z={z} />
      <Panes face="side" w={w} d={d} y={0.13} count={3} pw={0.13} ph={0.14} x={x} z={z} />
      <UpperFloors w={w} d={d} h={h - 0.08} from={0.3} x={x} z={z} count={2} />
      <Sign face="front" w={w} d={d} y={Math.max(0.32, h - 0.1)} ring="#a3e635" x={x} z={z}>
        <Block size={[0.07, 0.012, 0.01]} position={[0, 0, 0]} color="#334155" />
        <Block size={[0.015, 0.035, 0.012]} position={[-0.035, 0, 0]} color="#334155" />
        <Block size={[0.015, 0.035, 0.012]} position={[0.035, 0, 0]} color="#334155" />
      </Sign>
      <RooftopUnit position={[x + 0.14, roofY, z - 0.1]} />
      {[0.22, 0.32].map((bx) => (
        <group key={bx} position={[bx, Y0 + 0.04, 0.38]} rotation={[0, Math.PI / 2, 0]}>
          {[-0.03, 0.03].map((wz) => (
            <mesh key={wz} position={[wz, 0, 0]}>
              <torusGeometry args={[0.025, 0.006, 6, 12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}
        </group>
      ))}
      <Hedge position={[-0.25, Y0, 0.4]} length={0.26} />
      <RoundTree position={[0.39, Y0, -0.3]} />
    </group>
  );
}

function Daycare({ level, glow }: ModelProps) {
  const w = 0.64, d = 0.56, h = HEIGHT.daycare(level), x = 0, z = -0.1;
  const roofY = Y0 + h;
  const fence = ["#f87171", "#facc15", "#4ade80", "#60a5fa", "#c084fc"];
  return (
    <group>
      <Plinth base="#e8d6dd" top="#f8edf1" />
      <Body w={w} d={d} h={h} color="#fbc3d4" glow={glow} x={x} z={z} />
      <Band w={w} d={d} y={0.02} color="#fde68a" h={0.04} x={x} z={z} />
      <Roof w={w} d={d} h={h} color="#f9a8c4" rim="#fde68a" x={x} z={z} />
      <Panes face="front" w={w} d={d} y={0.13} count={2} pw={0.13} ph={0.12} warm x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.1} height={0.16} color="#f472b6" x={x} z={z} />
      {/* rainbow arch over the door */}
      {["#f87171", "#facc15", "#60a5fa"].map((c, i) => (
        <mesh key={c} position={[x, Y0 + 0.17, z + d / 2 + 0.02]}>
          <torusGeometry args={[0.1 - i * 0.022, 0.011, 6, 16, Math.PI]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <Panes face="side" w={w} d={d} y={0.13} count={2} pw={0.13} ph={0.12} warm x={x} z={z} />
      <UpperFloors w={w} d={d} h={h - 0.04} from={0.27} warm x={x} z={z} count={2} />
      <mesh position={[x - 0.16, roofY + 0.1, z + 0.12]} rotation={[0, 0, 0.3]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>
      <RooftopUnit position={[x + 0.12, roofY, z - 0.1]} />
      {fence.map((c, i) => (
        <Block key={c} size={[0.035, 0.06, 0.02]} position={[-0.38 + i * 0.05, Y0 + 0.03, 0.4]} color={c} />
      ))}
      {/* slide */}
      <group position={[0.3, Y0, 0.32]}>
        <Block size={[0.06, 0.012, 0.18]} position={[0, 0.06, 0]} rotation={[0.55, 0, 0]} color="#facc15" />
        <Block size={[0.06, 0.12, 0.012]} position={[0, 0.06, -0.08]} color="#60a5fa" />
      </group>
      <RoundTree position={[0.39, Y0, -0.32]} scale={0.85} />
    </group>
  );
}

function Clinic({ level, glow }: ModelProps) {
  const w = 0.66, d = 0.56, h = HEIGHT.clinic(level), x = 0, z = -0.08;
  const roofY = Y0 + h;
  const rows = Math.max(1, Math.round(h / 0.22));
  return (
    <group>
      <Plinth />
      <Body w={w} d={d} h={h} color="#f8fafc" glow={glow} x={x} z={z} />
      {Array.from({ length: rows }).map((_, f) => (
        <group key={f}>
          {f > 0 && <Panes face="front" w={w} d={d} y={0.12 + f * 0.2} count={3} pw={0.12} ph={0.1} x={x} z={z} />}
          <Panes face="side" w={w} d={d} y={0.12 + f * 0.2} count={3} pw={0.12} ph={0.1} x={x} z={z} />
        </group>
      ))}
      <Panes face="front" w={w} d={d} y={0.12} count={2} pw={0.12} ph={0.1} x={x} z={z} span={0.5} />
      <Roof w={w} d={d} h={h} color="#e2e8f0" rim="#cbd5e1" x={x} z={z} />
      <Door face="front" w={w} d={d} width={0.12} height={0.17} color="#1f2937" glass x={x} z={z} />
      <Awning face="front" w={w} d={d} y={0.2} width={0.22} colors={["#14b8a6", "#5eead4"]} x={x} z={z} stripes={4} />
      <Sign face="front" w={w} d={d} y={Math.max(0.34, h - 0.08)} ring="#14b8a6" x={x} z={z}>
        <Block size={[0.075, 0.022, 0.01]} position={[0, 0, 0]} color="#16a34a" />
        <Block size={[0.022, 0.075, 0.011]} position={[0, 0, 0]} color="#16a34a" />
      </Sign>
      <RooftopUnit position={[x + 0.12, roofY, z - 0.08]} />
      <RooftopUnit position={[x - 0.06, roofY, z - 0.12]} />
      <Block size={[0.14, 0.012, 0.16]} position={[0.22, Y0 + 0.03, 0.34]} rotation={[0.2, 0, 0]} color="#cbd5e1" />
      <Bench position={[-0.3, Y0, 0.38]} />
      <RoundTree position={[0.39, Y0, -0.3]} />
    </group>
  );
}

function Lab({ level, glow }: ModelProps) {
  const w = 0.66, d = 0.6, h = HEIGHT.lab(level), x = -0.02, z = -0.06;
  const roofY = Y0 + h;
  const floors = 1 + level;
  const floorH = (h - 0.04) / floors;
  return (
    <group>
      <Plinth base="#9aa4b2" top="#c3cad4" />
      <Body w={w} d={d} h={h} color="#273449" glow={glow} x={x} z={z} />
      {Array.from({ length: floors }).map((_, f) => (
        <group key={f}>
          <mesh position={[x, Y0 + 0.02 + floorH * (f + 0.5), z + d / 2 + 0.004]}>
            <boxGeometry args={[w - 0.08, floorH * 0.7, 0.012]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.55} roughness={0.2} />
          </mesh>
          <mesh position={[x + w / 2 + 0.004, Y0 + 0.02 + floorH * (f + 0.5), z]}>
            <boxGeometry args={[0.012, floorH * 0.7, d - 0.08]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.55} roughness={0.2} />
          </mesh>
        </group>
      ))}
      <Roof w={w} d={d} h={h} color="#334155" rim="#22d3ee" x={x} z={z} />
      <Block size={[0.3, 0.12, 0.26]} position={[x - 0.06, roofY + 0.06, z - 0.06]} color="#1e293b" emissive="#22d3ee" emissiveIntensity={0.15} />
      <Cyl r={0.008} h={0.24} position={[x + 0.2, roofY + 0.12, z + 0.16]} color="#cbd5e1" segments={6} />
      <mesh position={[x + 0.18, roofY + 0.06, z - 0.18]} rotation={[-0.6, 0, 0]}>
        <sphereGeometry args={[0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} />
      </mesh>
      <PineTree position={[-0.39, Y0, 0.33]} />
      <Bush position={[0.37, Y0 + 0.03, 0.38]} />
      <Bush position={[0.39, Y0 + 0.03, -0.3]} />
    </group>
  );
}

function Fountain({ level }: ModelProps) {
  const jet = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (jet.current) jet.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.18);
  });
  const flowers = ["#f87171", "#facc15", "#f472b6", "#60a5fa"];
  return (
    <group>
      <Plinth base="#d9d2c3" top="#f1ece2" />
      <Cyl r={0.34} h={0.08} position={[0, Y0 + 0.04, 0]} color="#f8fafc" segments={28} cast />
      <Cyl r={0.31} h={0.012} position={[0, Y0 + 0.078, 0]} color="#60a5fa" segments={28} emissive="#3b82f6" emissiveIntensity={0.25} />
      <Cyl r={0.05} h={0.16} position={[0, Y0 + 0.12, 0]} color="#e2e8f0" segments={12} />
      <Cyl r={0.16} rTop={0.17} h={0.04} position={[0, Y0 + 0.2, 0]} color="#f8fafc" segments={20} />
      <Cyl r={0.145} h={0.008} position={[0, Y0 + 0.222, 0]} color="#93c5fd" segments={20} />
      <Cyl r={0.025} h={0.09} position={[0, Y0 + 0.26, 0]} color="#e2e8f0" segments={10} />
      <mesh ref={jet} position={[0, Y0 + 0.33, 0]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.8} emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
      <Bench position={[0.3, Y0, 0.36]} rotation={0} />
      <Bench position={[-0.36, Y0, -0.3]} rotation={Math.PI / 2} />
      {level >= 2 && flowers.map((c, i) => {
        const cx = i % 2 === 0 ? -0.36 : 0.36;
        const cz = i < 2 ? 0.36 : -0.36;
        return (
          <group key={c} position={[cx, Y0, cz]}>
            <Block size={[0.12, 0.03, 0.12]} position={[0, 0.015, 0]} color="#7cc96a" />
            <Ball r={0.025} position={[0, 0.04, 0]} color={c} />
          </group>
        );
      })}
    </group>
  );
}

function Statue({ level, glow }: ModelProps) {
  const h = HEIGHT.statue(level);
  const top = Y0 + h;
  const dragon = level >= 3 ? "#fbbf24" : "#34d399";
  const wing = level >= 3 ? "#f59e0b" : "#10b981";
  const head = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (head.current) head.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.25;
  });
  return (
    <group>
      <Plinth base="#d9d2c3" top="#f1ece2" />
      <Block size={[0.42, h, 0.42]} position={[0, Y0 + h / 2, 0]} color="#d6d3d1" glow={glow} cast />
      <Block size={[0.44, 0.03, 0.44]} position={[0, top - 0.015, 0]} color="#fbbf24" />
      <Block size={[0.16, 0.06, 0.01]} position={[0, Y0 + h * 0.5, 0.215]} color="#fbbf24" />
      {/* the dragon */}
      <Ball r={0.11} position={[0, top + 0.1, -0.02]} color={dragon} scale={[1, 0.85, 1.25]} />
      <Ball r={0.07} position={[0, top + 0.08, 0.06]} color="#fde68a" scale={[0.8, 0.8, 0.6]} />
      <group ref={head} position={[0, top + 0.24, 0.08]}>
        <Ball r={0.075} position={[0, 0, 0]} color={dragon} />
        <Block size={[0.07, 0.05, 0.08]} position={[0, -0.015, 0.07]} color={dragon} />
        <Ball r={0.014} position={[-0.03, 0.025, 0.06]} color="#ffffff" />
        <Ball r={0.014} position={[0.03, 0.025, 0.06]} color="#ffffff" />
        {[-0.035, 0.035].map((hx) => (
          <mesh key={hx} position={[hx, 0.08, -0.01]} rotation={[-0.3, 0, 0]}>
            <coneGeometry args={[0.014, 0.06, 6]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, top + 0.2, -0.05]} rotation={[0.2, s * 0.5, s * -0.5]} castShadow>
          <coneGeometry args={[0.1, 0.2, 3]} />
          <meshStandardMaterial color={wing} flatShading />
        </mesh>
      ))}
      <mesh position={[0, top + 0.07, -0.19]} rotation={[-1.9, 0, 0]}>
        <coneGeometry args={[0.045, 0.2, 8]} />
        <meshStandardMaterial color={dragon} />
      </mesh>
      {level >= 2 && [-0.36, 0.36].map((lx) => (
        <group key={lx} position={[lx, Y0, 0.36]}>
          <Cyl r={0.01} h={0.26} position={[0, 0.13, 0]} color="#475569" segments={6} />
          <Ball r={0.03} position={[0, 0.27, 0]} color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.7} />
        </group>
      ))}
      <Bush position={[-0.36, Y0 + 0.03, -0.36]} />
      <Bush position={[0.36, Y0 + 0.03, -0.36]} />
    </group>
  );
}

function ClockTower({ level, glow }: ModelProps) {
  const H = HEIGHT.clocktower(level);
  const minute = useRef<THREE.Mesh>(null);
  const minuteSide = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const a = -state.clock.elapsedTime * 0.6;
    if (minute.current) minute.current.rotation.z = a;
    if (minuteSide.current) minuteSide.current.rotation.x = a;
  });
  const faceY = Y0 + H - 0.13;
  return (
    <group>
      <Plinth base="#d9d2c3" top="#f1ece2" />
      <Block size={[0.46, 0.14, 0.46]} position={[0, Y0 + 0.07, 0]} color="#efe1c3" cast />
      <Block size={[0.48, 0.03, 0.48]} position={[0, Y0 + 0.15, 0]} color="#a16207" />
      <Block size={[0.26, H, 0.26]} position={[0, Y0 + H / 2, 0]} color="#f1e4c8" glow={glow} cast />
      <Block size={[0.28, 0.03, 0.28]} position={[0, Y0 + H * 0.55, 0]} color="#a16207" />
      <Block size={[0.29, 0.04, 0.29]} position={[0, Y0 + H, 0]} color="#a16207" />
      {/* clock faces (front and side) */}
      <group position={[0, faceY, 0.132]}>
        <Cyl r={0.095} h={0.01} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#1f2937" segments={24} />
        <Cyl r={0.085} h={0.012} position={[0, 0, 0.002]} rotation={[Math.PI / 2, 0, 0]} color="#fffbeb" segments={24} />
        <Block size={[0.012, 0.05, 0.006]} position={[0, 0.02, 0.01]} color="#1f2937" />
        <mesh ref={minute} position={[0, 0, 0.012]}>
          <boxGeometry args={[0.008, 0.14, 0.004]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
      </group>
      <group position={[0.132, faceY, 0]}>
        <Cyl r={0.095} h={0.01} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} color="#1f2937" segments={24} />
        <Cyl r={0.085} h={0.012} position={[0.002, 0, 0]} rotation={[0, 0, Math.PI / 2]} color="#fffbeb" segments={24} />
        <mesh ref={minuteSide} position={[0.012, 0, 0]}>
          <boxGeometry args={[0.004, 0.14, 0.008]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
      </group>
      <mesh position={[0, Y0 + H + 0.13, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.22, 0.24, 4]} />
        <meshStandardMaterial color="#3b5ba9" />
      </mesh>
      <Ball r={0.025} position={[0, Y0 + H + 0.27, 0]} color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.4} />
      <RoundTree position={[0.36, Y0, 0.36]} scale={0.85} />
      <RoundTree position={[-0.36, Y0, 0.36]} scale={0.8} />
    </group>
  );
}

function Ferris({ level, glow }: ModelProps) {
  const R = 0.34 + level * 0.04;
  const hubY = 0.5 + level * 0.1;
  const wheel = useRef<THREE.Group>(null);
  const cabins = useRef<THREE.Group>(null);
  const cabinColors = ["#f87171", "#facc15", "#4ade80", "#60a5fa", "#c084fc", "#fb923c", "#f472b6", "#22d3ee"];
  useFrame((state) => {
    const a = state.clock.elapsedTime * 0.35;
    if (wheel.current) wheel.current.rotation.z = a;
    if (cabins.current) {
      cabins.current.children.forEach((cabin, i) => {
        const t = a + (i / cabinColors.length) * Math.PI * 2;
        cabin.position.set(Math.cos(t) * R, Math.sin(t) * R - 0.05, 0);
      });
    }
  });
  return (
    <group>
      <Plinth base="#d9d2c3" top="#f1ece2" />
      {/* the wheel faces the camera (diagonal) */}
      <group rotation={[0, Math.PI / 4, 0]}>
        {[-0.07, 0.07].map((oz) => (
          <group key={oz}>
            <Block size={[0.02, hubY + 0.02, 0.02]} position={[-0.16, Y0 + hubY / 2 - 0.02, oz]} rotation={[0, 0, -0.32]} color="#e5e7eb" />
            <Block size={[0.02, hubY + 0.02, 0.02]} position={[0.16, Y0 + hubY / 2 - 0.02, oz]} rotation={[0, 0, 0.32]} color="#e5e7eb" />
          </group>
        ))}
        <group position={[0, Y0 + hubY, 0]}>
          <group ref={wheel}>
            <mesh castShadow>
              <torusGeometry args={[R, 0.014, 8, 40]} />
              <meshStandardMaterial color="#f472b6" emissive={glow ? SELECT_GLOW : "#000000"} emissiveIntensity={glow ? 0.4 : 0} />
            </mesh>
            <mesh>
              <torusGeometry args={[R * 0.55, 0.01, 6, 28]} />
              <meshStandardMaterial color="#fbbf24" />
            </mesh>
            {Array.from({ length: 4 }).map((_, i) => (
              <Block key={i} size={[0.01, R * 2, 0.01]} position={[0, 0, 0]} rotation={[0, 0, (i * Math.PI) / 4]} color="#f9a8d4" />
            ))}
          </group>
          <Cyl r={0.035} h={0.18} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#94a3b8" segments={10} />
          <group ref={cabins}>
            {cabinColors.map((c) => (
              <Block key={c} size={[0.07, 0.07, 0.07]} position={[0, 0, 0]} color={c} cast />
            ))}
          </group>
        </group>
      </group>
      {/* ticket booth */}
      <group position={[0.32, Y0, 0.33]}>
        <Block size={[0.13, 0.12, 0.11]} position={[0, 0.06, 0]} color="#fde68a" cast />
        <Block size={[0.15, 0.02, 0.13]} position={[0, 0.13, 0]} color="#f87171" />
      </group>
      <RoundTree position={[-0.37, Y0, 0.36]} scale={0.85} />
    </group>
  );
}

function ThemePark({ level, glow }: ModelProps) {
  return (
    <group>
      <Plinth base="#c4b5fd" top="#fce7f3" />
      <group position={[-0.16, 0.03, -0.18]} scale={0.62}><Ferris level={level} glow={glow} /></group>
      {/* Castle entrance and pennants make this a whole park, not a single ride. */}
      {[-0.26, 0.26].map((x) => <group key={x} position={[x, Y0, 0.32]}>
        <Cyl r={0.075} h={0.27} position={[0, 0.135, 0]} color="#c4b5fd" cast />
        <Cyl r={0.1} rTop={0} h={0.16} position={[0, 0.35, 0]} color="#8b5cf6" cast />
        <Cyl r={0.008} h={0.13} position={[0, 0.48, 0]} color="#fbbf24" segments={6} />
        <Block size={[0.09, 0.045, 0.008]} position={[0.04, 0.51, 0]} color="#fb7185" />
      </group>)}
      <Block size={[0.44, 0.08, 0.09]} position={[0, Y0 + 0.23, 0.32]} color="#f472b6" glow={glow} />
      {[-0.12, 0, 0.12].map((x) => <Ball key={x} r={0.024} position={[x, Y0 + 0.23, 0.373]} color="#fef08a" />)}
      {/* Carousel canopy, centre pole and colourful seats. */}
      <group position={[0.27, Y0, -0.12]}>
        <Cyl r={0.15} h={0.035} position={[0, 0.02, 0]} color="#fbbf24" />
        <Cyl r={0.015} h={0.24} position={[0, 0.14, 0]} color="#fef3c7" />
        <Cyl r={0.17} rTop={0} h={0.12} position={[0, 0.3, 0]} color="#fb7185" />
        {[-0.09, 0.09].map((x) => <Block key={x} size={[0.055, 0.06, 0.07]} position={[x, 0.095, 0]} color="#38bdf8" cast />)}
      </group>
      <Block size={[0.14, 0.006, 0.18]} position={[0, Y0 + 0.005, 0.36]} color="#fef3c7" />
    </group>
  );
}

function StreetDetails({ brand = "#6366f1", level }: ModelProps) {
  return <group>
    <Block size={[0.16, 0.018, 0.09]} position={[0, Y0 + 0.01, 0.43]} color="#cbd5e1" />
    <Block size={[0.11, 0.06, 0.075]} position={[-0.32, Y0 + 0.03, 0.41]} color="#c08457" />
    <Ball r={0.052} position={[-0.32, Y0 + 0.09, 0.41]} color="#65a30d" scale={[1, 0.7, 0.65]} />
    {level > 1 && <Ball r={0.02} position={[-0.32, Y0 + 0.12, 0.435]} color="#f9a8d4" />}
    <Cyl r={0.009} h={0.28} position={[0.4, Y0 + 0.14, 0.4]} color="#475569" segments={6} />
    <Ball r={0.03} position={[0.4, Y0 + 0.29, 0.4]} color="#fff7cd" emissive="#fde68a" emissiveIntensity={0.4} />
    <Block size={[0.05, 0.07, 0.01]} position={[0.375, Y0 + 0.19, 0.4]} color={brand} />
  </group>;
}

function UnderConstruction() {
  return (
    <group>
      <Plinth base="#cbd5e1" top="#e2e8f0" />
      <Block size={[0.6, 0.4, 0.56]} position={[0, Y0 + 0.2, -0.05]} color="#cbd5e1" transparent opacity={0.55} />
      {[-0.3, 0.3].flatMap((sx) => [-0.32, 0.22].map((sz) => (
        <Cyl key={`${sx}${sz}`} r={0.01} h={0.5} position={[sx, Y0 + 0.25, sz]} color="#f59e0b" segments={6} />
      )))}
      <Cyl r={0.025} h={1.1} position={[0.36, Y0 + 0.55, -0.3]} color="#f59e0b" segments={8} />
      <Block size={[0.6, 0.03, 0.03]} position={[0.12, Y0 + 1.08, -0.3]} color="#f59e0b" />
      <Block size={[0.004, 0.3, 0.004]} position={[-0.1, Y0 + 0.92, -0.3]} color="#334155" />
      {[-0.24, -0.08, 0.08, 0.24].map((bx, i) => (
        <Block key={bx} size={[0.14, 0.05, 0.02]} position={[bx, Y0 + 0.05, 0.41]} color={i % 2 ? "#f8fafc" : "#f97316"} />
      ))}
    </group>
  );
}

const MODELS: Record<BuildingType, (props: ModelProps) => React.ReactElement> = {
  factory: Factory,
  warehouse: Warehouse,
  store: Store,
  office: Office,
  rnd: Rnd,
  hr: Hr,
  power: Power,
  park: Park,
  cafeteria: Cafeteria,
  dorm: Dorm,
  gym: Gym,
  daycare: Daycare,
  clinic: Clinic,
  lab: Lab,
  fountain: Fountain,
  statue: Statue,
  clocktower: ClockTower,
  ferris: ThemePark,
};

export function Building3D({
  building, selected, brand,
}: { building: PlacedBuilding; selected: boolean; brand?: string }) {
  if (building.turnsLeft > 0) return <UnderConstruction />;
  const Model = MODELS[building.type];
  return <group>
    <Model level={building.level} glow={selected} brand={brand} />
    {["factory", "office", "store", "warehouse", "rnd", "hr"].includes(building.type) && <StreetDetails level={building.level} glow={selected} brand={brand} />}
  </group>;
}

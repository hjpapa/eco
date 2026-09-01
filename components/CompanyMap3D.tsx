"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "@/store/gameStore";
import { BUILDING_LIST, buildingCostFor, countAdjacencyPairs } from "@/lib/engine";
import type { BuildingType, Company, GameState, PlacedBuilding } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { pickCityVoice, pickVisitorVoices } from "@/lib/data/cityVoices";
import { getIndustry } from "@/lib/data/industries";
import { BuildingInteriorModal } from "./BuildingInteriorModal";
import { BUILDING_IMG } from "@/lib/assetMap";

/* ── palette ─────────────────────────────────────────────────────────────── */
// [body, roof, accent]
const COLORS: Record<BuildingType, [string, string, string]> = {
  factory:   ["#7c8896", "#9aa6b4", "#5b6675"],
  warehouse: ["#c98a3a", "#e0a44e", "#92580f"],
  store:     ["#3b82f6", "#60a5fa", "#1d4ed8"],
  rnd:       ["#a855f7", "#c084fc", "#6d28d9"],
  office:    ["#22a884", "#34d399", "#0f766e"],
  hr:        ["#eab308", "#fde047", "#a16207"],
  power:     ["#ef5350", "#f87171", "#991b1b"],
  park:      ["#34a853", "#4ade80", "#15803d"],
  cafeteria: ["#fb923c", "#fdba74", "#c2410c"],
  dorm:      ["#f9a8d4", "#fbcfe8", "#be185d"],
  gym:       ["#2dd4bf", "#5eead4", "#0f766e"],
  daycare:   ["#facc15", "#fde68a", "#b45309"],
  clinic:    ["#f1f5f9", "#e2e8f0", "#ef4444"],
  lab:       ["#818cf8", "#a5b4fc", "#4338ca"],
};

const PHASE_BG: Record<string, string> = {
  boom: "#bfe9ff", normal: "#d6efff", recession: "#cdd6e0",
  inflation: "#ffe6c2", deflation: "#dfe7ff", stagflation: "#dcdad6",
};
const PHASE_GRASS: Record<string, string> = {
  boom: "#7ec850", normal: "#86d05a", recession: "#9fb08c",
  inflation: "#b6c46a", deflation: "#8fc4a8", stagflation: "#a7ad8e",
};

const TILE = 1; // world units per grid cell

/* Blend two hex colors (t=0 → a, t=1 → b). */
function blend(a: string, b: string, t: number): string {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();
}

/* ── low-poly building ───────────────────────────────────────────────────── */
function Building3D({
  building, selected, tint, seed = 0,
}: { building: PlacedBuilding; selected: boolean; tint?: string; seed?: number }) {
  const base = COLORS[building.type];
  // Brand-tint each company's buildings toward its logo color so campuses differ.
  // A per-company seed jitters the blend strength so two companies with the same
  // building type still look a little different.
  const jitter = ((seed % 5) - 2) * 0.03; // -0.06 .. +0.06
  const body = tint ? blend(base[0], tint, 0.24 + jitter) : base[0];
  const roof = tint ? blend(base[1], tint, 0.14 + jitter * 0.5) : base[1];
  const accent = tint ? blend(base[2], tint, 0.1 + Math.abs(jitter)) : base[2];
  const lvl = building.level;
  const underConstruction = building.turnsLeft > 0;

  if (underConstruction) {
    return (
      <group>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.7]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.6} />
        </mesh>
        {/* crane */}
        <mesh position={[0.35, 0.6, 0.35]}>
          <boxGeometry args={[0.05, 1.2, 0.05]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0.15, 1.15, 0.35]}>
          <boxGeometry args={[0.5, 0.05, 0.05]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
    );
  }

  const emissive = selected ? new THREE.Color("#6366f1") : new THREE.Color("#000000");

  switch (building.type) {
    case "office": {
      const h = 0.7 + lvl * 0.55;
      return (
        <group>
          <RoundedBox args={[0.62, h, 0.62]} radius={0.04} smoothness={2} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          {/* window bands */}
          {Array.from({ length: lvl + 1 }).map((_, i) => (
            <mesh key={i} position={[0, 0.35 + i * 0.42, 0.315]}>
              <boxGeometry args={[0.5, 0.12, 0.02]} />
              <meshStandardMaterial color="#bfe3ff" emissive="#9cc7ff" emissiveIntensity={0.5} />
            </mesh>
          ))}
          <mesh position={[0, h + 0.04, 0]}>
            <boxGeometry args={[0.66, 0.08, 0.66]} />
            <meshStandardMaterial color={roof} />
          </mesh>
        </group>
      );
    }
    case "factory": {
      const h = 0.5 + lvl * 0.18;
      return (
        <group>
          <RoundedBox args={[0.8, h, 0.8]} radius={0.03} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          <mesh position={[0.22, h + 0.25, 0.22]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.5, 8]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          <SmokePuff position={[0.22, h + 0.55, 0.22]} />
          {/* sawtooth roof */}
          <mesh position={[0, h + 0.05, 0]}>
            <boxGeometry args={[0.82, 0.06, 0.82]} />
            <meshStandardMaterial color={roof} />
          </mesh>
        </group>
      );
    }
    case "warehouse": {
      const h = 0.4 + lvl * 0.12;
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.85, h, 0.85]} />
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </mesh>
          {/* gable roof */}
          <mesh position={[0, h + 0.18, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.86, 4]} />
            <meshStandardMaterial color={roof} />
          </mesh>
          <mesh position={[0, 0.18, 0.43]}>
            <boxGeometry args={[0.5, 0.34, 0.02]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      );
    }
    case "store": {
      const h = 0.45 + lvl * 0.2;
      return (
        <group>
          <RoundedBox args={[0.7, h, 0.7]} radius={0.03} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          {/* awning */}
          <mesh position={[0, 0.28, 0.4]} rotation={[Math.PI / 6, 0, 0]} castShadow>
            <boxGeometry args={[0.72, 0.04, 0.22]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, h + 0.12, 0]}>
            <boxGeometry args={[0.4, 0.16, 0.05]} />
            <meshStandardMaterial color={roof} emissive="#fde047" emissiveIntensity={0.3} />
          </mesh>
        </group>
      );
    }
    case "rnd": {
      const h = 0.55 + lvl * 0.25;
      return (
        <group>
          <RoundedBox args={[0.66, h, 0.66]} radius={0.05} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          <mesh position={[0, h + 0.08, 0]} castShadow>
            <sphereGeometry args={[0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={roof} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, h + 0.45, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.35, 6]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          <mesh position={[0, h + 0.62, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    }
    case "power": {
      const h = 0.45 + lvl * 0.15;
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, h, 0.7]} />
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </mesh>
          <mesh position={[-0.15, h + 0.2, -0.1]} castShadow>
            <cylinderGeometry args={[0.16, 0.22, 0.55, 12]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
          <SmokePuff position={[-0.15, h + 0.55, -0.1]} scale={0.7} />
          <mesh position={[0.2, h + 0.02, 0.2]} rotation={[-Math.PI / 5, 0, 0]}>
            <boxGeometry args={[0.28, 0.02, 0.28]} />
            <meshStandardMaterial color="#1e3a8a" metalness={0.4} />
          </mesh>
        </group>
      );
    }
    case "hr": {
      const h = 0.5 + lvl * 0.2;
      return (
        <group>
          <RoundedBox args={[0.66, h, 0.66]} radius={0.04} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          <mesh position={[0, 0.16, 0.34]}>
            <boxGeometry args={[0.2, 0.32, 0.02]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          <mesh position={[0, h + 0.04, 0]}>
            <boxGeometry args={[0.7, 0.08, 0.7]} />
            <meshStandardMaterial color={roof} />
          </mesh>
        </group>
      );
    }
    case "cafeteria": {
      const h = 0.45 + lvl * 0.15;
      return (
        <group>
          <RoundedBox args={[0.78, h, 0.78]} radius={0.04} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          {/* striped awning */}
          <mesh position={[0, 0.3, 0.42]} rotation={[Math.PI / 6, 0, 0]} castShadow>
            <boxGeometry args={[0.8, 0.04, 0.24]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, h + 0.14, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
            <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    }
    case "dorm": {
      const h = 0.5 + lvl * 0.2;
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, h, 0.7]} />
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </mesh>
          <mesh position={[0, h + 0.16, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.58, 0.34, 4]} />
            <meshStandardMaterial color={roof} />
          </mesh>
          {[-0.18, 0.18].map((x, i) => (
            <mesh key={i} position={[x, h * 0.55, 0.36]}>
              <boxGeometry args={[0.14, 0.14, 0.02]} />
              <meshStandardMaterial color="#bfe3ff" emissive="#9cc7ff" emissiveIntensity={0.4} />
            </mesh>
          ))}
        </group>
      );
    }
    case "gym": {
      const h = 0.42 + lvl * 0.12;
      return (
        <group>
          <RoundedBox args={[0.78, h, 0.62]} radius={0.05} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          {/* dumbbell sign */}
          <mesh position={[0, h + 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.34, 8]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          {[-0.18, 0.18].map((x, i) => (
            <mesh key={i} position={[x, h + 0.12, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          ))}
        </group>
      );
    }
    case "daycare": {
      const h = 0.4 + lvl * 0.16;
      return (
        <group>
          <RoundedBox args={[0.7, h, 0.7]} radius={0.08} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          <mesh position={[0, h + 0.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.5, 0.3, 4]} />
            <meshStandardMaterial color="#f472b6" />
          </mesh>
          {/* balloon */}
          <mesh position={[0.28, h + 0.35, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        </group>
      );
    }
    case "clinic": {
      const h = 0.5 + lvl * 0.16;
      return (
        <group>
          <RoundedBox args={[0.7, h, 0.7]} radius={0.04} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} />
          </RoundedBox>
          {/* red cross */}
          <mesh position={[0, h * 0.6, 0.36]}>
            <boxGeometry args={[0.18, 0.06, 0.02]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, h * 0.6, 0.36]}>
            <boxGeometry args={[0.06, 0.18, 0.02]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, h + 0.04, 0]}>
            <boxGeometry args={[0.74, 0.08, 0.74]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      );
    }
    case "lab": {
      const h = 0.6 + lvl * 0.3;
      return (
        <group>
          <RoundedBox args={[0.66, h, 0.66]} radius={0.05} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={body} emissive={emissive} emissiveIntensity={selected ? 0.4 : 0} metalness={0.2} />
          </RoundedBox>
          {Array.from({ length: lvl + 1 }).map((_, i) => (
            <mesh key={i} position={[0, 0.35 + i * 0.4, 0.335]}>
              <boxGeometry args={[0.54, 0.14, 0.02]} />
              <meshStandardMaterial color="#c7d2fe" emissive="#818cf8" emissiveIntensity={0.5} />
            </mesh>
          ))}
          <mesh position={[0, h + 0.1, 0]} castShadow>
            <sphereGeometry args={[0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={roof} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      );
    }
    case "park":
    default:
      return (
        <group>
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 16]} />
            <meshStandardMaterial color={body} />
          </mesh>
          {[[-0.2, 0.18], [0.2, -0.15], [0.1, 0.22]].map(([x, z], i) => (
            <Tree key={i} position={[x, 0, z]} scale={0.8} />
          ))}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.18, 0.04, 0.06]} />
            <meshStandardMaterial color="#92400e" />
          </mesh>
        </group>
      );
  }
}

function SmokePuff({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime % 2) / 2;
    ref.current.position.y = position[1] + t * 0.5;
    const s = (0.06 + t * 0.12) * scale;
    ref.current.scale.setScalar(s);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = (1 - t) * 0.5;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#cbd5e1" transparent opacity={0.4} />
    </mesh>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.2, 6]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <coneGeometry args={[0.16, 0.4, 8]} />
        <meshStandardMaterial color="#2f9e44" />
      </mesh>
    </group>
  );
}

/* ── agents ──────────────────────────────────────────────────────────────── */
type VehicleType = "car" | "truck" | "taxi" | "motorcycle";

function VehicleModel({ type, color }: { type: VehicleType; color: string }) {
  switch (type) {
    case "truck":
      return (
        <group>
          <RoundedBox args={[0.22, 0.2, 0.22]} radius={0.04} position={[-0.18, 0.1, 0]} castShadow>
            <meshStandardMaterial color={color} />
          </RoundedBox>
          <mesh position={[0.16, 0.11, 0]} castShadow>
            <boxGeometry args={[0.44, 0.22, 0.24]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[-0.18, 0.22, 0]}>
            <boxGeometry args={[0.16, 0.06, 0.18]} />
            <meshStandardMaterial color="#bfdbfe" transparent opacity={0.5} />
          </mesh>
        </group>
      );
    case "taxi":
      return (
        <group>
          <RoundedBox args={[0.34, 0.12, 0.18]} radius={0.04} position={[0, 0.06, 0]} castShadow>
            <meshStandardMaterial color="#fde047" />
          </RoundedBox>
          <RoundedBox args={[0.18, 0.1, 0.15]} radius={0.03} position={[0, 0.16, 0]}>
            <meshStandardMaterial color="#fde047" />
          </RoundedBox>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.07]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      );
    case "motorcycle":
      return (
        <group>
          <RoundedBox args={[0.26, 0.07, 0.09]} radius={0.03} position={[0, 0.05, 0]} castShadow>
            <meshStandardMaterial color={color} />
          </RoundedBox>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {([-0.1, 0.1] as const).map((xo, i) => (
            <mesh key={i} position={[xo, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.055, 0.04, 8]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))}
        </group>
      );
    default: // car
      return (
        <group>
          <RoundedBox args={[0.34, 0.12, 0.18]} radius={0.04} position={[0, 0.06, 0]} castShadow>
            <meshStandardMaterial color={color} />
          </RoundedBox>
          <RoundedBox args={[0.18, 0.1, 0.15]} radius={0.03} position={[0, 0.16, 0]}>
            <meshStandardMaterial color={color} />
          </RoundedBox>
        </group>
      );
  }
}

function Car({ a }: { a: AgentPath }) {
  const ref = useRef<THREE.Group>(null);
  const [showInfo, setShowInfo] = useState(false);
  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime / a.dur + a.phase) % 1 + 1) % 1;
    const p = a.at(t);
    const p2 = a.at((t + 0.005) % 1);
    ref.current.position.set(p.x, 0.08, p.z);
    const dx = p2.x - p.x, dz = p2.z - p.z;
    if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
      ref.current.rotation.y = Math.atan2(dx, dz);
    }
  });
  return (
    <group ref={ref}>
      <group onClick={(e) => { e.stopPropagation(); setShowInfo((v) => !v); }}>
        {/* Pre-rotate -90° around Y so the vehicle's long X-axis aligns with
            the group's forward Z-axis (which Math.atan2(dx,dz) already targets). */}
        <group rotation={[0, -Math.PI / 2, 0]}>
          <VehicleModel type={a.vehicleType ?? "car"} color={a.color} />
        </group>
      </group>
      {showInfo && a.destination && (
        <Html position={[0, 0.55, 0]} center distanceFactor={8} zIndexRange={[40, 0]}>
          <div
            style={{
              background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
              padding: "5px 8px", fontSize: 12, lineHeight: 1.3, maxWidth: 140,
              textAlign: "center", color: "#334155", boxShadow: "0 4px 12px rgba(15,23,42,0.18)",
              cursor: "pointer",
            }}
            onClick={() => setShowInfo(false)}
          >
            <div style={{ fontWeight: 700 }}>→ {a.destination}</div>
            {a.destinationReason && (
              <div style={{ fontSize: 11, color: "#64748b" }}>{a.destinationReason}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

const PERSON_PALETTE: Record<PersonKind, string[]> = {
  man: ["#2563eb", "#0f766e", "#475569", "#7c3aed", "#b45309", "#1e293b"],
  woman: ["#db2777", "#e11d48", "#9333ea", "#0ea5e9", "#16a34a", "#f97316"],
  child: ["#f59e0b", "#84cc16", "#fb7185", "#22d3ee", "#a855f7", "#ef4444"],
};
const HAIR = ["#3b2a1a", "#1f2937", "#6b3f1d", "#111827", "#7c2d12", "#facc15"];
const HAT = ["#ef4444", "#1d4ed8", "#15803d", "#f59e0b"];

const PANTS = ["#1e293b", "#334155", "#42302a", "#1f2937", "#3f3f46", "#374151"];

/** Varied hairstyles, positioned relative to the head centre. */
function Hair({ style, color }: { style: number; color: string }) {
  switch (style % 6) {
    case 1: // long, falling down the back
      return (
        <group>
          <mesh position={[0, 0.02, 0]}><sphereGeometry args={[0.066, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, -0.04, -0.045]}><boxGeometry args={[0.1, 0.13, 0.04]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 2: // top bun
      return (
        <group>
          <mesh position={[0, 0.02, 0]}><sphereGeometry args={[0.064, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 0.085, -0.02]}><sphereGeometry args={[0.032, 10, 10]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 3: // spiky
      return <mesh position={[0, 0.03, 0]}><coneGeometry args={[0.07, 0.09, 8]} /><meshStandardMaterial color={color} /></mesh>;
    case 4: // ponytail
      return (
        <group>
          <mesh position={[0, 0.02, 0]}><sphereGeometry args={[0.064, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, -0.01, -0.06]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.018, 0.01, 0.13, 6]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 5: // bald-ish / very short
      return <mesh position={[0, 0.04, 0]}><sphereGeometry args={[0.06, 12, 12, 0, Math.PI * 2, 0, Math.PI / 3]} /><meshStandardMaterial color={color} /></mesh>;
    default: // short cap
      return <mesh position={[0, 0.025, 0]}><sphereGeometry args={[0.066, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} /></mesh>;
  }
}

function PersonModel({
  kind, seed, walking, gait,
}: { kind: PersonKind; seed: number; walking: boolean; gait: number }) {
  const shirt = PERSON_PALETTE[kind][seed % PERSON_PALETTE[kind].length];
  const hairColor = HAIR[seed % HAIR.length];
  const pants = PANTS[seed % PANTS.length];
  const hairStyle = (seed * 3 + (kind === "woman" ? 1 : 0)) % 6;
  const hasHat = seed % 5 === 0;
  const hasTie = kind !== "child" && seed % 3 === 1;
  const hasBag = kind !== "child" && seed % 4 === 2;
  const hasGlasses = seed % 6 === 3;
  const isWoman = kind === "woman";
  const scale = kind === "child" ? 0.66 : 1;

  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  // Natural gait: legs and arms swing in opposition + a gentle body bob.
  useFrame((state) => {
    const sw = walking ? Math.sin(state.clock.elapsedTime * 7 + gait) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    if (armL.current) armL.current.rotation.x = -sw * 0.8;
    if (armR.current) armR.current.rotation.x = sw * 0.8;
    if (root.current) root.current.position.y = walking ? Math.abs(Math.sin(state.clock.elapsedTime * 7 + gait)) * 0.015 : 0;
  });

  const hipY = 0.11, shoulderY = 0.24, headY = 0.33;

  return (
    <group ref={root} scale={scale}>
      {/* legs (swing from the hip) */}
      <group ref={legL} position={[-0.035, hipY, 0]}>
        <mesh position={[0, -0.055, 0]} castShadow><boxGeometry args={[0.04, 0.11, 0.04]} /><meshStandardMaterial color={pants} /></mesh>
      </group>
      <group ref={legR} position={[0.035, hipY, 0]}>
        <mesh position={[0, -0.055, 0]} castShadow><boxGeometry args={[0.04, 0.11, 0.04]} /><meshStandardMaterial color={pants} /></mesh>
      </group>

      {/* torso (skirt for women) */}
      <mesh position={[0, (hipY + shoulderY) / 2, 0]} castShadow>
        <boxGeometry args={[0.12, shoulderY - hipY + 0.02, 0.07]} />
        <meshStandardMaterial color={shirt} />
      </mesh>
      {isWoman && (
        <mesh position={[0, hipY + 0.02, 0]} castShadow>
          <coneGeometry args={[0.1, 0.13, 12]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
      )}
      {hasTie && (
        <mesh position={[0, shoulderY - 0.06, 0.037]}>
          <boxGeometry args={[0.02, 0.1, 0.006]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      )}
      {hasBag && (
        <mesh position={[0.085, (hipY + shoulderY) / 2, 0]} castShadow>
          <boxGeometry args={[0.045, 0.09, 0.06]} />
          <meshStandardMaterial color={isWoman ? "#be185d" : "#92400e"} />
        </mesh>
      )}

      {/* arms (swing from the shoulder) */}
      <group ref={armL} position={[-0.078, shoulderY, 0]}>
        <mesh position={[0, -0.05, 0]} castShadow><boxGeometry args={[0.028, 0.1, 0.028]} /><meshStandardMaterial color={shirt} /></mesh>
      </group>
      <group ref={armR} position={[0.078, shoulderY, 0]}>
        <mesh position={[0, -0.05, 0]} castShadow><boxGeometry args={[0.028, 0.1, 0.028]} /><meshStandardMaterial color={shirt} /></mesh>
      </group>

      {/* head + hair + accessories */}
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[0.058, 14, 14]} />
        <meshStandardMaterial color="#fcd5b5" />
      </mesh>
      <group position={[0, headY, 0]}><Hair style={hairStyle} color={hairColor} /></group>
      {hasGlasses && (
        <mesh position={[0, headY - 0.005, 0.05]}>
          <boxGeometry args={[0.085, 0.018, 0.008]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      )}
      {hasHat && (
        <group position={[0, headY + 0.05, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.05, 0.055, 0.05, 12]} /><meshStandardMaterial color={HAT[seed % HAT.length]} /></mesh>
          <mesh position={[0, -0.025, 0]}><cylinderGeometry args={[0.085, 0.085, 0.012, 12]} /><meshStandardMaterial color={HAT[seed % HAT.length]} /></mesh>
        </group>
      )}
    </group>
  );
}

function Person({
  a, index, speaking, onClick,
}: { a: AgentPath; index: number; speaking: string | null; onClick: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const act = a.activity ?? "walk";
  useFrame((state) => {
    if (!ref.current) return;
    const clk = state.clock.elapsedTime;
    if (act === "walk") {
      const raw = (clk / a.dur + a.phase) % 2;
      const t = raw < 1 ? raw : 2 - raw; // ping-pong (stroll back and forth)
      const p = a.at(t);
      ref.current.position.set(p.x, 0, p.z);
      // Face the actual direction of travel so nobody moonwalks.
      const A = a.at(0), B = a.at(1);
      const dir = raw < 1 ? 1 : -1;
      const vx = (B.x - A.x) * dir, vz = (B.z - A.z) * dir;
      if (vx !== 0 || vz !== 0) ref.current.rotation.y = Math.atan2(vx, vz);
    } else {
      // Stationary daily-life action at the middle of its lane.
      const p = a.at(0.5);
      const ph = a.phase * 6;
      if (act === "exercise") {
        ref.current.position.set(p.x, Math.abs(Math.sin(clk * 3 + ph)) * 0.08, p.z);
        ref.current.rotation.y = 0;
      } else if (act === "chat") {
        ref.current.position.set(p.x, 0, p.z);
        ref.current.rotation.y = Math.sin(clk * 1.5 + ph) * 0.4;
      } else if (act === "wave") {
        ref.current.position.set(p.x, Math.sin(clk * 2 + ph) * 0.02, p.z);
        ref.current.rotation.y = Math.sin(clk * 4 + ph) * 0.15;
      } else { // rest
        ref.current.position.set(p.x, -0.04 + Math.sin(clk * 1.2 + ph) * 0.01, p.z);
        ref.current.rotation.y = ph;
      }
    }
  });
  const kind = a.kind ?? "man";
  return (
    <group ref={ref}>
      <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <PersonModel kind={kind} seed={a.seed ?? index} walking={act === "walk"} gait={a.phase * 6 + index} />
      </group>
      {speaking && (
        <Html position={[0, 0.5, 0]} center distanceFactor={8} zIndexRange={[40, 0]}>
          <div style={{
            background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: "5px 8px", fontSize: 13, lineHeight: 1.25, width: 150,
            textAlign: "center", color: "#334155", boxShadow: "0 4px 12px rgba(15,23,42,0.18)",
          }}>
            {speaking}
          </div>
        </Html>
      )}
    </group>
  );
}

/* Industry monument at a corner so each company's campus signals its sector. */
function IndustryLandmark({ industryId, color, x, z }: { industryId: string; color: string; x: number; z: number }) {
  const emoji = getIndustry(industryId).emoji;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.32, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 0.55, 0]} center distanceFactor={9}>
        <div style={{ fontSize: 36, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }}>{emoji}</div>
      </Html>
    </group>
  );
}

const VISITOR_KIND_COLOR: Record<string, string> = {
  politician: "#1e3a8a",
  ceo: "#374151",
  celebrity: "#db2777",
  investor: "#d97706",
};
const VISITOR_KIND_SEED: Record<string, number> = {
  politician: 11, ceo: 22, celebrity: 33, investor: 44,
};

function VisitorAgent({
  visitor, half, company,
}: {
  visitor: NonNullable<Company["visitor"]>;
  half: number;
  company: Company;
}) {
  const ref = useRef<THREE.Group>(null);
  const [voiceIdx, setVoiceIdx] = useState(0);

  const voices = useMemo(
    () => pickVisitorVoices(visitor, company),
    // Re-generate when company state changes meaningfully.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visitor.kind, visitor.name, company.reputation, company.morale, company.lastProfit],
  );

  // Tour waypoints that wander the campus interior (stay within ±half*0.75).
  const waypoints = useMemo(() => {
    const r = half * 0.72;
    return [
      { x: 0,        z: r * 0.85 },   // bottom-center (entry)
      { x: -r * 0.6, z: r * 0.4 },    // bottom-left
      { x: -r * 0.8, z: -r * 0.2 },   // left
      { x: -r * 0.3, z: -r * 0.75 },  // top-left
      { x: r * 0.5,  z: -r * 0.65 },  // top-right
      { x: r * 0.8,  z: r * 0.2 },    // right
      { x: r * 0.4,  z: r * 0.7 },    // bottom-right
      { x: 0,        z: 0 },           // center (linger)
    ];
  }, [half]);

  const SEG_DUR = 9; // seconds per waypoint segment

  // Cycle through dialogue automatically every 5 s.
  useEffect(() => {
    const id = setInterval(
      () => setVoiceIdx((i) => (i + 1) % voices.length),
      5000,
    );
    return () => clearInterval(id);
  }, [voices.length]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const n = waypoints.length;
    const segF = (t / SEG_DUR) % n;
    const segI = Math.floor(segF);
    const segT = segF - segI;
    const from = waypoints[segI];
    const to = waypoints[(segI + 1) % n];
    // Smooth-step so the visitor decelerates into each waypoint.
    const st = segT * segT * (3 - 2 * segT);
    ref.current.position.set(
      from.x + (to.x - from.x) * st,
      0,
      from.z + (to.z - from.z) * st,
    );
    const dx = to.x - from.x, dz = to.z - from.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      ref.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  const kindColor = VISITOR_KIND_COLOR[visitor.kind] ?? "#374151";
  const kindSeed = VISITOR_KIND_SEED[visitor.kind] ?? 0;

  return (
    <group ref={ref}>
      {/* Slightly larger than regular employees so they stand out. */}
      <group
        scale={1.4}
        onClick={(e) => { e.stopPropagation(); setVoiceIdx((i) => (i + 1) % voices.length); }}
      >
        <PersonModel kind="man" seed={kindSeed} walking={true} gait={2.1} />
        {/* Glowing star crown to mark VIP status */}
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Name badge (always visible) */}
      <Html position={[0, 0.78, 0]} center distanceFactor={8} zIndexRange={[50, 0]}>
        <div
          style={{
            background: kindColor, color: "white", borderRadius: 999,
            padding: "3px 10px", fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
            cursor: "pointer",
          }}
          onClick={() => setVoiceIdx((i) => (i + 1) % voices.length)}
        >
          {visitor.emoji} {visitor.name}
        </div>
      </Html>

      {/* Auto-cycling speech bubble — offset to the right so it doesn't
          cover the visitor model on screen. */}
      <Html position={[1.6, 0.6, 0]} center distanceFactor={8} zIndexRange={[51, 0]}>
        <div
          style={{
            background: "white", border: `2px solid ${kindColor}`,
            borderRadius: 12, padding: "6px 10px",
            fontSize: 11, lineHeight: 1.45, maxWidth: 160,
            textAlign: "center", color: "#334155",
            boxShadow: "0 4px 16px rgba(15,23,42,0.2)",
            cursor: "pointer", whiteSpace: "pre-wrap",
          }}
          onClick={() => setVoiceIdx((i) => (i + 1) % voices.length)}
        >
          {voices[voiceIdx]}
        </div>
      </Html>
    </group>
  );
}

/* ── tile ────────────────────────────────────────────────────────────────── */
function Tile({
  x, z, grass, highlight, onClick, onHover,
}: {
  x: number; z: number; grass: string; highlight: boolean;
  onClick: () => void; onHover: (on: boolean) => void;
}) {
  return (
    <mesh
      position={[x, 0.012, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={() => onHover(false)}
    >
      <planeGeometry args={[TILE * 0.96, TILE * 0.96]} />
      <meshStandardMaterial color={highlight ? "#a7f3d0" : grass} transparent opacity={highlight ? 1 : 0.35} />
    </mesh>
  );
}

/* ── agent path helpers ──────────────────────────────────────────────────── */
type PersonKind = "man" | "woman" | "child";
type Activity = "walk" | "chat" | "rest" | "exercise" | "wave";
interface AgentPath {
  color: string; dur: number; phase: number; heading: number;
  kind?: PersonKind;
  activity?: Activity;
  seed?: number;
  vehicleType?: VehicleType;
  destination?: string;
  destinationReason?: string;
  at: (t: number) => { x: number; z: number };
}

// Vehicles visiting campus buildings with appropriate purposes.
const VEHICLE_DESTINATIONS: Record<string, { vType: VehicleType; dest: string; reason: string }[]> = {
  factory:   [{ vType: "truck",      dest: "생산 공장",   reason: "원자재 납품" }],
  warehouse: [{ vType: "truck",      dest: "물류창고",    reason: "재고 보충" }],
  store:     [{ vType: "motorcycle", dest: "매장",        reason: "긴급 배달" },
              { vType: "truck",      dest: "매장",        reason: "상품 납품" }],
  office:    [{ vType: "taxi",       dest: "본사 오피스", reason: "임원 출근" },
              { vType: "car",        dest: "본사",        reason: "미팅 참석" }],
  rnd:       [{ vType: "car",        dest: "연구소",      reason: "연구원 출근" }],
  hr:        [{ vType: "taxi",       dest: "인사팀",      reason: "면접자 이동" }],
  cafeteria: [{ vType: "truck",      dest: "구내식당",    reason: "식자재 배달" }],
  clinic:    [{ vType: "car",        dest: "의무실",      reason: "의료용품 배달" }],
  lab:       [{ vType: "car",        dest: "실험실",      reason: "협력사 방문" }],
  dorm:      [{ vType: "taxi",       dest: "기숙사",      reason: "입주 이동" }],
  gym:       [{ vType: "motorcycle", dest: "체육관",      reason: "장비 배달" }],
};

function buildPaths(n: number, childBias = false, companySeed = 0, buildings: { type: string; turnsLeft: number }[] = []) {
  const half = (n * TILE) / 2;
  const COLORS_CW  = ["#ef4444", "#3b82f6", "#f59e0b"];
  const COLORS_CCW = ["#8b5cf6", "#06b6d4", "#10b981"];
  const ring = half + 0.45;

  // Clockwise corners (top-left → top-right → bottom-right → bottom-left)
  const CW: { x: number; z: number }[] = [
    { x: -ring, z: -ring }, { x: ring, z: -ring },
    { x: ring,  z:  ring }, { x: -ring, z: ring },
  ];
  // Counter-clockwise = same points, reversed direction
  const CCW = [...CW].reverse();

  const makeRingAt = (pts: typeof CW) => (t: number) => {
    const sf = t * 4;
    const si = Math.floor(sf) % 4;
    const st = sf - Math.floor(sf);
    const from = pts[si], to = pts[(si + 1) % 4];
    return { x: from.x + (to.x - from.x) * st, z: from.z + (to.z - from.z) * st };
  };

  // Build destination pool from active buildings.
  const activeTypes = buildings.filter((b) => b.turnsLeft <= 0).map((b) => b.type);
  const destPool: { vType: VehicleType; dest: string; reason: string }[] = [
    { vType: "car",        dest: "캠퍼스",    reason: "업무 출근" },
    { vType: "taxi",       dest: "캠퍼스",    reason: "고객 방문" },
    { vType: "motorcycle", dest: "캠퍼스",    reason: "배달" },
    { vType: "truck",      dest: "물류센터",  reason: "화물 운송" },
  ];
  for (const t of activeTypes) {
    const entries = VEHICLE_DESTINATIONS[t];
    if (entries) destPool.push(...entries);
  }

  const cars: AgentPath[] = [];
  const carCount = Math.min(6, 2 + Math.floor(n / 2));
  for (let i = 0; i < carCount; i++) {
    const cw = i % 2 === 0;
    const di = (companySeed + i * 3) % destPool.length;
    const { vType, dest, reason } = destPool[di];
    cars.push({
      color: cw ? COLORS_CW[i % COLORS_CW.length] : COLORS_CCW[i % COLORS_CCW.length],
      dur: 22 + (i % 4) * 5, phase: (i * 0.37) % 1, heading: 0,
      vehicleType: vType, destination: dest, destinationReason: reason,
      at: makeRingAt(cw ? CW : CCW),
    });
  }

  const people: AgentPath[] = [];
  const pedCount = Math.min(12, 4 + n);
  const inner = half - 0.7;
  const kindCycle: PersonKind[] = childBias
    ? ["man", "woman", "child", "child", "woman", "man", "child"]
    : ["man", "woman", "man", "woman", "child", "man", "woman"];
  // Mix of strolling and stationary daily-life actions for a lively campus.
  const actCycle: Activity[] = ["walk", "walk", "chat", "rest", "walk", "exercise", "wave", "walk"];
  for (let i = 0; i < pedCount; i++) {
    const horiz = i % 2 === 0;
    const lane = ((i % (n - 1)) - (n - 1) / 2) * (TILE * 0.78);
    // Offset the cycles by the company seed so each campus has a different crowd mix.
    const kind = kindCycle[(i + companySeed) % kindCycle.length];
    const activity = actCycle[(i + companySeed) % actCycle.length];
    people.push({
      // strolling pace (ping-pong handled in <Person>)
      color: "#000000", dur: 18 + (i % 5) * 3, phase: (i * 0.5) % 2, heading: 0, kind, activity,
      seed: companySeed * 7 + i * 13,
      at: (t) => horiz
        ? { x: -inner + 2 * inner * t, z: lane }
        : { x: lane, z: -inner + 2 * inner * t },
    });
  }
  return { cars, people, half };
}

/* ── scene ───────────────────────────────────────────────────────────────── */
function Scene({
  game, company, readOnly, overview, selectedType, selectedBuildingId, onCell,
}: {
  game: GameState; company: Company; readOnly: boolean; overview: boolean;
  selectedType: BuildingType | null;
  selectedBuildingId: string | null;
  onCell: (x: number, y: number) => void;
}) {
  const n = game.config.mapSize;
  const half = (n * TILE) / 2;
  const grass = PHASE_GRASS[game.macro.phase] ?? PHASE_GRASS.normal;
  // Deterministic per-company seed so each campus's skyline & crowd look distinct.
  const companySeed = [...company.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [hover, setHover] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<{ i: number; text: string } | null>(null);

  // Auto-dismiss person speech bubbles after 3 s.
  useEffect(() => {
    if (!speaker) return;
    const t = setTimeout(() => setSpeaker(null), 3000);
    return () => clearTimeout(t);
  }, [speaker]);

  // Build the lookup every render: company.buildings is mutated in place, so a
  // memo keyed on the array reference would go stale and new builds wouldn't show.
  const grid = new Map<string, PlacedBuilding>();
  for (const b of company.buildings) grid.set(`${b.x},${b.y}`, b);

  const hasDaycare = company.buildings.some((b) => b.type === "daycare" && b.turnsLeft <= 0);
  const { cars, people } = useMemo(
    () => buildPaths(n, hasDaycare, companySeed, company.buildings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, hasDaycare, companySeed],
  );

  const tileWorld = (gx: number, gy: number) => ({
    x: (gx - (n - 1) / 2) * TILE,
    z: (gy - (n - 1) / 2) * TILE,
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.5]} />
      <directionalLight
        position={[half + 3, half + 6, half + 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-half - 3}
        shadow-camera-right={half + 3}
        shadow-camera-top={half + 3}
        shadow-camera-bottom={-half - 3}
      />

      {/* plot base (extruded ground); top sits at y=0 */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[n * TILE + 1.4, 0.3, n * TILE + 1.4]} />
        <meshStandardMaterial color="#b9a07a" />
      </mesh>
      {/* ring road (border, just above the base) */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[n * TILE + 0.9, n * TILE + 0.9]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* grass field (above the road) */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[n * TILE, n * TILE]} />
        <meshStandardMaterial color={grass} />
      </mesh>

      {/* tiles + buildings */}
      {Array.from({ length: n }).map((_, gy) =>
        Array.from({ length: n }).map((__, gx) => {
          const key = `${gx},${gy}`;
          const b = grid.get(key);
          const { x, z } = tileWorld(gx, gy);
          return (
            <group key={key}>
              {!b && (
                <Tile
                  x={x} z={z} grass={grass}
                  highlight={!readOnly && !!selectedType && hover === key}
                  onClick={() => onCell(gx, gy)}
                  onHover={(on) => setHover(on ? key : null)}
                />
              )}
              {b && (
                <group
                  position={[x, 0, z]}
                  scale={[1, 0.85 + ((b.x * 7 + b.y * 13 + companySeed) % 7) * 0.055, 1]}
                  onClick={(e) => { e.stopPropagation(); onCell(gx, gy); }}
                >
                  <Building3D
                    building={b}
                    selected={b.id === selectedBuildingId}
                    tint={company.logoColor}
                    seed={companySeed + b.x * 7 + b.y * 13}
                  />
                </group>
              )}
            </group>
          );
        }),
      )}

      {/* agents */}
      {cars.map((a, i) => <Car key={`c${i}`} a={a} />)}
      {people.map((a, i) => (
        <Person
          key={`p${i}`}
          a={a}
          index={i}
          speaking={speaker?.i === i ? speaker.text : null}
          onClick={() => setSpeaker({ i, text: pickCityVoice(company, game.macro.phase, { personKind: a.kind }) })}
        />
      ))}

      <IndustryLandmark industryId={company.industryId} color={company.logoColor} x={-(half + 0.35)} z={half + 0.35} />

      {company.visitor && (
        <VisitorAgent visitor={company.visitor} half={half} company={company} />
      )}

      <OrbitControls
        enablePan={false}
        minDistance={n * 0.9}
        maxDistance={n * 2.4}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.4}
        autoRotate={overview}
        autoRotateSpeed={0.6}
        target={[0, 0.3, 0]}
      />
    </>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */
export function CompanyMap3D({
  game, company, readOnly = false, overview = false,
}: {
  game: GameState; company: Company; readOnly?: boolean; overview?: boolean;
}) {
  const build = useGameStore((s) => s.build);
  const [selectedType, setSelectedType] = useState<BuildingType | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const n = game.config.mapSize;
  const adjacencyCount = countAdjacencyPairs(company.buildings);

  const onCell = (gx: number, gy: number) => {
    if (readOnly) return;
    const existing = company.buildings.find((b) => b.x === gx && b.y === gy);
    if (existing) {
      setSelectedBuildingId(existing.id === selectedBuildingId ? null : existing.id);
      setSelectedType(null);
    } else if (selectedType) {
      build(selectedType, gx, gy);
      setSelectedType(null);
    }
  };

  const inspected = company.buildings.find((b) => b.id === selectedBuildingId);

  return (
    <div className="space-y-3">
      <div
        className="w-full overflow-hidden rounded-2xl"
        style={{
          aspectRatio: overview ? "16 / 10" : "16 / 9",
          maxHeight: overview ? 320 : 560,
          background: PHASE_BG[game.macro.phase] ?? PHASE_BG.normal,
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.8]}
          camera={{ position: [n * 1.15, n * 0.95, n * 1.2], fov: 40 }}
        >
          <color attach="background" args={[PHASE_BG[game.macro.phase] ?? PHASE_BG.normal]} />
          <Scene
            game={game}
            company={company}
            readOnly={readOnly}
            overview={overview}
            selectedType={selectedType}
            selectedBuildingId={selectedBuildingId}
            onCell={onCell}
          />
        </Canvas>
      </div>

      {!readOnly && !overview && inspected && (
        <BuildingInteriorModal
          game={game}
          company={company}
          building={inspected}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}

      {!readOnly && !overview && (
        <div>
          {game.config.adjacencyBonus ? (
            <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900 ring-1 ring-emerald-200">
              ✨ <b>인접 보너스 {adjacencyCount}개</b>
              <span className="block text-xs text-emerald-800">
                공장+창고, 창고+매장, 매장+본사, 본사+연구소를 상하좌우로 붙이면 회사 효율이 올라요.
              </span>
            </div>
          ) : null}
          <div className="mb-1 text-xs font-semibold text-slate-500">
            건물을 선택하고 빈 타일을 클릭하세요 · 드래그로 회전, 휠로 확대 · 사람을 누르면 생각이 보여요
          </div>
          <div className="flex flex-wrap gap-2">
            {BUILDING_LIST.filter((d) => game.config.enabledBuildings.includes(d.type)).map((d) => {
              const active = selectedType === d.type;
              const cost = buildingCostFor(d.type, 1);
              const canAfford = company.cash >= cost;
              return (
                <button
                  key={d.type}
                  onClick={() => setSelectedType(active ? null : d.type)}
                  className={`flex flex-col items-center rounded-xl px-3 py-2 ring-2 transition ${
                    active ? "bg-brand-50 ring-brand-500" : "bg-white ring-slate-200 hover:ring-slate-300"
                  } ${canAfford ? "" : "opacity-50"}`}
                >
                  {BUILDING_IMG[d.type] ? (
                    <img src={BUILDING_IMG[d.type]} alt="" className="h-9 w-9 object-contain" />
                  ) : (
                    <span className="text-xl">{d.emoji}</span>
                  )}
                  <span className="text-xs font-semibold text-slate-700">{d.name}</span>
                  <span className="text-xs text-slate-500">{formatMoney(cost)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyMap3D;

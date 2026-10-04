import { createContext, useContext } from "react";
import type { Season } from "@/lib/engine";

// How each season paints the 3D campus. Primitive colours only: illustrated
// seasonal art can replace these later (see SEASON_ART in lib/assetMap.ts).

export interface SeasonTheme {
  season: Season;
  /** Workspace grass field. */
  grass: string;
  /** Workspace sky / canvas background. */
  sky: string;
  /** Round tree canopy (main ball, small highlight ball). */
  canopy: string;
  canopyHi: string;
  /** Pine cones (lower, upper). Upper turns white with snow in winter. */
  pineLow: string;
  pineHigh: string;
  bush: string;
  /** Falling particles, if any. */
  particles: { kind: "petal" | "leaf" | "snow"; colors: string[]; count: number } | null;
}

export const SEASON_THEMES: Record<Season, SeasonTheme> = {
  spring: {
    season: "spring",
    grass: "#b3dc8c",
    sky: "#f7eef4",
    canopy: "#f9a8d4",
    canopyHi: "#fbcfe8",
    pineLow: "#2f9e57",
    pineHigh: "#3fb168",
    bush: "#86c96a",
    particles: { kind: "petal", colors: ["#f9a8d4", "#fbcfe8", "#fce7f3"], count: 46 },
  },
  summer: {
    season: "summer",
    grass: "#a9d98a",
    sky: "#e4f4ed",
    canopy: "#5cb85c",
    canopyHi: "#7ed37a",
    pineLow: "#2f9e57",
    pineHigh: "#3fb168",
    bush: "#4fae4f",
    particles: null,
  },
  autumn: {
    season: "autumn",
    grass: "#cfc67c",
    sky: "#fbf2e4",
    canopy: "#f59e0b",
    canopyHi: "#fb923c",
    pineLow: "#2f7d4f",
    pineHigh: "#3a8f5c",
    bush: "#d97706",
    particles: { kind: "leaf", colors: ["#f97316", "#f59e0b", "#dc2626", "#facc15"], count: 34 },
  },
  winter: {
    season: "winter",
    grass: "#eef2f7",
    sky: "#d9e4f2",
    canopy: "#e2e8f0",
    canopyHi: "#f8fafc",
    pineLow: "#2f7d57",
    pineHigh: "#f1f5f9",
    bush: "#dbe4ee",
    particles: { kind: "snow", colors: ["#ffffff", "#f1f5f9"], count: 80 },
  },
};

/** Summer keeps the original greens, so maps outside a game look as before. */
export const SeasonThemeContext = createContext<SeasonTheme>(SEASON_THEMES.summer);

export function useSeasonTheme(): SeasonTheme {
  return useContext(SeasonThemeContext);
}

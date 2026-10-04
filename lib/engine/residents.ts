import type { BuildingType, Company, GameState, PlacedBuilding, Quest, ResidentState } from "./types";
import { RESIDENTS, RESIDENT_MAP, residentSays, type ResidentDef } from "../data/residents";
import { BUILDINGS, isBuildingTypeUnlocked } from "./buildings";
import { villageStats } from "./village";
import { createRng, nextFloat, type RngState } from "./rng";
import { withJosa } from "../format";
import { isFeatureUnlocked } from "./campaign";

// Named residents (Animal Crossing style) living in the student's village.
//  • One named neighbour for every 6 residents; a happy village (50+) lets one
//    new neighbour move in per turn.
//  • A gloomy (under 40) or overcrowded village makes the least-attached
//    neighbour worry first; only if nothing changes by the next turn do they
//    move away. A warning always comes one turn early.
//  • Hearts (0–5) grow when a favourite building appears or a wish is granted.
//    Five hearts makes a best friend, who brings a one-off gift.
//  • Wishes are build requests on the 📜 board, in the neighbour's own words.
// Residents use their own seeded RNG, so the market and rivals never change.

export const PEOPLE_PER_RESIDENT = 6;
export const MOVE_IN_HAPPINESS = 50;
export const LEAVE_HAPPINESS = 40;
export const MAX_HEARTS = 5;
export const BEST_FRIEND_GIFT = { cash: 30_000, reputation: 1 } as const;

/** How many named neighbours a village of this size has room for. */
export function residentSlots(population: number): number {
  return Math.min(RESIDENTS.length, Math.floor(Math.max(0, population) / PEOPLE_PER_RESIDENT));
}

export interface ResidentUpdate {
  movedIn: string[];
  worried: string[];
  relieved: string[];
  left: string[];
  /** Neighbours whose heart grew because a favourite building appeared. */
  hearts: string[];
  /** New best friends who brought a gift. */
  gifts: string[];
  wish: Quest | null;
}

function residentRng(state: GameState, salt: number): RngState {
  return createRng((state.seed ^ Math.imul(state.turn + 307, 0x9e3779b1) ^ salt) >>> 0);
}

function favouriteCount(buildings: PlacedBuilding[], def: ResidentDef): number {
  return buildings.filter((b) => b.turnsLeft <= 0 && def.favorites.includes(b.type)).length;
}

function playerOf(state: GameState): Company | undefined {
  return state.companies.find((c) => c.id === state.playerCompanyId);
}

export function livingResidents(state: GameState): (ResidentState & { def: ResidentDef })[] {
  return (state.residents ?? [])
    .map((r) => ({ ...r, def: RESIDENT_MAP[r.id] }))
    .filter((r): r is ResidentState & { def: ResidentDef } => !!r.def);
}

const WISH_TEXT: Partial<Record<BuildingType, string>> = {
  cafeteria: "맛있는 밥집이 하나 더 있으면 좋겠어요",
  store: "새 가게에서 구경하고 싶어요",
  park: "나무 많은 공원에서 놀고 싶어요",
  gym: "헬스장에서 다 같이 운동하고 싶어요",
  fountain: "분수 앞에서 사진을 찍고 싶어요",
  statue: "멋진 드래곤 동상을 보고 싶어요",
  ferris: "놀이기구를 타 보고 싶어요",
  rnd: "연구소에 견학 가고 싶어요",
  lab: "데이터센터의 반짝이는 불빛이 보고 싶어요",
  clinic: "아플 때 갈 보건실이 있으면 안심이 돼요",
  daycare: "아이들이 놀 어린이집이 있으면 좋겠어요",
  house: "친구가 우리 마을로 이사 오고 싶대요. 집을 하나 더 지어 주세요",
};

/** Post one neighbour's wish when none is open (about 6 turns in 10). */
function postWish(state: GameState, player: Company): Quest | null {
  const residents = state.residents ?? [];
  if (!residents.length) return null;
  const quests = (state.quests ??= []);
  if (quests.some((q) => q.residentId && (q.status === "active" || q.status === "ready"))) return null;
  const rng = residentRng(state, 0x7a11);
  if (nextFloat(rng) > 0.6) return null;

  const resident = residents[Math.floor(nextFloat(rng) * residents.length)] ?? residents[0];
  const def = RESIDENT_MAP[resident.id];
  if (!def) return null;
  const enabled = state.config.enabledBuildings;
  const stats = villageStats(player.buildings);
  const canBuild = (type: BuildingType) => enabled.includes(type) && isBuildingTypeUnlocked(player, type);
  const options: BuildingType[] = def.favorites.filter(canBuild);
  // A full village: someone's friend wants to move in too.
  if (stats.housing > 0 && stats.population >= stats.housing * 0.9 && canBuild("house")) options.push("house");
  if (!options.length && canBuild("park")) options.push("park");
  if (!options.length) return null;

  const type = options[Math.floor(nextFloat(rng) * options.length)] ?? options[0];
  const building = BUILDINGS[type];
  const baseline = player.buildings.filter((b) => b.type === type).length;
  const wish: Quest = {
    id: `wish-${state.turn}-${def.id}`,
    kind: "build",
    status: "active",
    client: def.name,
    clientEmoji: def.emoji,
    title: `${building.emoji} ${baseline > 0 ? `${building.name} 하나 더` : withJosa(building.name, "을", "를")} 지어 주세요`,
    detail: residentSays(def, WISH_TEXT[type] ?? `${withJosa(building.name, "이", "가")} 있으면 좋겠어요`),
    postedTurn: state.turn,
    deadlineTurn: state.turn + 4,
    reward: { cash: Math.max(20_000, Math.round((building.cost * 0.3) / 1000) * 1000), reputation: 1 },
    buildingType: type,
    baseline,
    residentId: def.id,
  };
  quests.push(wish);
  return wish;
}

/**
 * After a turn: hearts from new favourite buildings, worries and moving
 * away, one possible newcomer, best-friend gifts and a new wish.
 */
export function updateResidents(state: GameState): ResidentUpdate {
  const result: ResidentUpdate = { movedIn: [], worried: [], relieved: [], left: [], hearts: [], gifts: [], wish: null };
  const player = playerOf(state);
  if (!player || state.status === "ended" || !isFeatureUnlocked(state, "village")) return result;
  const residents = (state.residents ??= []);
  const stats = villageStats(player.buildings);
  const slots = residentSlots(stats.population);

  // 1) A new favourite building warms a neighbour's heart.
  for (const resident of residents) {
    const def = RESIDENT_MAP[resident.id];
    if (!def) continue;
    const count = favouriteCount(player.buildings, def);
    if (count > resident.favoriteCount && resident.hearts < MAX_HEARTS) {
      resident.hearts += 1;
      result.hearts.push(resident.id);
    }
    resident.favoriteCount = count;
  }

  // 2) Worry first, move away only if nothing changes by the next turn.
  const unhappy = stats.happiness < LEAVE_HAPPINESS;
  const crowded = residents.length > slots;
  const worried = residents.find((r) => r.worriedTurn != null);
  if (worried) {
    if (unhappy || crowded) {
      if (state.turn > (worried.worriedTurn ?? state.turn)) {
        state.residents = residents.filter((r) => r.id !== worried.id);
        state.quests = (state.quests ?? []).filter((q) => q.residentId !== worried.id);
        result.left.push(worried.id);
      }
    } else {
      worried.worriedTurn = undefined;
      result.relieved.push(worried.id);
    }
  } else if (unhappy || crowded) {
    const pick = [...residents].sort((a, b) => a.hearts - b.hearts || b.movedIn - a.movedIn)[0];
    if (pick) {
      pick.worriedTurn = state.turn;
      result.worried.push(pick.id);
    }
  }

  // 3) A happy village with room welcomes one new neighbour.
  const living = state.residents ?? [];
  if (!result.left.length && stats.happiness >= MOVE_IN_HAPPINESS && living.length < slots) {
    const here = new Set(living.map((r) => r.id));
    const candidates = RESIDENTS.filter((def) => !here.has(def.id));
    if (candidates.length) {
      // Neighbours are drawn to villages that already have what they love.
      const weights = candidates.map((def) => (favouriteCount(player.buildings, def) > 0 ? 3 : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = nextFloat(residentRng(state, 0x3e11)) * total;
      let chosen = candidates[candidates.length - 1];
      for (let i = 0; i < candidates.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) {
          chosen = candidates[i];
          break;
        }
      }
      living.push({ id: chosen.id, hearts: 1, movedIn: state.turn, favoriteCount: favouriteCount(player.buildings, chosen) });
      result.movedIn.push(chosen.id);
    }
  }

  // 4) Best friends bring a thank-you gift, once.
  for (const resident of living) {
    if (resident.hearts >= MAX_HEARTS && !resident.gift) {
      resident.gift = true;
      player.cash += BEST_FRIEND_GIFT.cash;
      player.reputation = Math.min(100, player.reputation + BEST_FRIEND_GIFT.reputation);
      result.gifts.push(resident.id);
    }
  }

  // 5) Maybe a new wish on the board.
  result.wish = postWish(state, player);
  return result;
}

/** A granted wish: the neighbour's heart grows. Returns their name for the toast. */
export function grantWish(state: GameState, quest: Quest): string | null {
  if (!quest.residentId) return null;
  const resident = (state.residents ?? []).find((r) => r.id === quest.residentId);
  const def = RESIDENT_MAP[quest.residentId];
  if (!resident || !def) return null;
  resident.hearts = Math.min(MAX_HEARTS, resident.hearts + 1);
  // The wished-for building already earned its heart: don't count it twice.
  const player = playerOf(state);
  if (player) resident.favoriteCount = Math.max(resident.favoriteCount, favouriteCount(player.buildings, def));
  return def.name;
}

/** A line for a neighbour to say right now (UI only; stable within a turn). */
export function residentLine(state: GameState, id: string, nudge = 0): string {
  const def = RESIDENT_MAP[id];
  if (!def) return "";
  const resident = (state.residents ?? []).find((r) => r.id === id);
  if (resident?.worriedTurn != null) return residentSays(def, "요즘 마을이 좀 쓸쓸해요… 이사를 갈까 고민 중이에요");
  const wish = (state.quests ?? []).find((q) => q.residentId === id && q.status === "active");
  if (wish && nudge % 3 === 0) return wish.detail;
  const index = Math.abs(state.turn * 7 + nudge + def.id.length) % def.lines.length;
  return residentSays(def, def.lines[index]);
}

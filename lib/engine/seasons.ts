import type { BuildingType, Company, GameState, MacroState, Season } from "./types";

export type { Season } from "./types";

// One turn is three months, so every turn is one season: 봄 → 여름 → 가을 →
// 겨울, and four turns make a year. Seasons nudge how many customers want each
// industry's goods (계절 수요) and bring a small festival that rewards the
// buildings that fit the season. Everything here is deterministic.

export const SEASON_ORDER: readonly Season[] = ["spring", "summer", "autumn", "winter"];

export interface FestivalDef {
  id: string;
  name: string;
  emoji: string;
  /** Any one of these operational buildings lets the city join in. */
  needs: readonly BuildingType[];
  reward: { cash?: number; reputation?: number; morale?: number };
  /** What happens when the city joins in. */
  story: string;
  /** A hint for next year when no matching building exists yet. */
  missing: string;
}

export interface SeasonDef {
  id: Season;
  name: string;
  emoji: string;
  festival: FestivalDef;
}

export const SEASONS: Record<Season, SeasonDef> = {
  spring: {
    id: "spring",
    name: "봄",
    emoji: "🌸",
    festival: {
      id: "blossom",
      name: "벚꽃 축제",
      emoji: "🌸",
      needs: ["park", "fountain"],
      reward: { reputation: 2 },
      story: "공원에 벚꽃이 활짝 피었어요! 꽃구경 온 시민들이 우리 회사를 칭찬해요.",
      missing: "공원이나 분수 광장이 있으면 꽃구경 손님이 찾아와 평판이 올라요.",
    },
  },
  summer: {
    id: "summer",
    name: "여름",
    emoji: "🌞",
    festival: {
      id: "splash",
      name: "물놀이 축제",
      emoji: "💦",
      needs: ["fountain", "ferris"],
      reward: { cash: 40_000 },
      story: "분수와 놀이기구에서 물놀이 축제가 열렸어요! 놀러 온 관광객이 기념품을 샀어요.",
      missing: "분수 광장이나 테마파크가 있으면 관광객이 놀러 와 돈을 쓰고 가요.",
    },
  },
  autumn: {
    id: "autumn",
    name: "가을",
    emoji: "🍂",
    festival: {
      id: "harvest",
      name: "수확 장터",
      emoji: "🌾",
      needs: ["store", "cafeteria"],
      reward: { cash: 40_000 },
      story: "가을 수확 장터가 열렸어요! 매장과 식당 앞에서 물건이 불티나게 팔렸어요.",
      missing: "매장이나 구내식당이 있으면 가을 장터에서 물건을 더 팔 수 있어요.",
    },
  },
  winter: {
    id: "winter",
    name: "겨울",
    emoji: "⛄",
    festival: {
      id: "snow",
      name: "눈 축제",
      emoji: "⛄",
      needs: ["cafeteria", "dorm", "gym"],
      reward: { morale: 3 },
      story: "하얀 눈이 펑펑! 직원들이 눈사람을 만들고 따뜻한 쉼터에서 핫초코를 나눠 마셨어요.",
      missing: "구내식당·기숙사·헬스장처럼 따뜻한 쉼터가 있으면 직원들이 더 행복해져요.",
    },
  },
};

/** The season of a turn. Turn 0 (the first turn) is spring. */
export function seasonOf(turn: number): Season {
  return SEASON_ORDER[((Math.floor(turn) % 4) + 4) % 4];
}

/** 1년차, 2년차… four turns make a year. */
export function yearOf(turn: number): number {
  return Math.floor(Math.max(0, turn) / 4) + 1;
}

/** The season the economy is in. Older saves without one start in spring. */
export function currentSeason(macro: Pick<MacroState, "season">): Season {
  return macro.season && SEASON_ORDER.includes(macro.season) ? macro.season : "spring";
}

/**
 * How many customers each industry has in each season, compared with an
 * ordinary season [봄, 여름, 가을, 겨울]. Every row averages 1.0, so a whole
 * year sells the same amount as before; only the timing moves.
 */
export const SEASONAL_DEMAND: Record<string, readonly [number, number, number, number]> = {
  tech: [1.08, 0.94, 0.94, 1.04],
  manufacturing: [1.06, 0.94, 1.04, 0.96],
  food: [0.95, 1.15, 1.05, 0.85],
  fashion: [1.08, 0.9, 1.1, 0.92],
  energy: [0.9, 1.1, 0.85, 1.15],
  finance: [1.0, 0.95, 1.0, 1.05],
  entertainment: [0.95, 1.15, 0.92, 0.98],
  bio: [0.98, 0.9, 0.97, 1.15],
  ai: [1.05, 0.97, 1.0, 0.98],
  robotics: [1.05, 0.95, 1.02, 0.98],
  space: [1.0, 1.06, 0.98, 0.96],
  ev: [1.06, 1.0, 1.04, 0.9],
  crypto_co: [1.0, 0.97, 1.0, 1.03],
};

/** Why customers come or stay away, for factors far enough from normal to notice. */
const SEASON_REASONS: Record<string, Partial<Record<Season, string>>> = {
  tech: {
    spring: "새 학기라 노트북과 앱을 새로 사는 사람이 많아요.",
    summer: "여름휴가 때는 새 기기 사는 걸 잠시 미뤄요.",
    autumn: "특별한 날이 적어서 조용한 계절이에요.",
  },
  manufacturing: {
    spring: "봄에는 공사와 새 공장 일이 많이 시작돼요.",
    summer: "장마철에는 바깥 공사가 자주 멈춰요.",
  },
  food: {
    spring: "봄에는 평소보다 손님이 조금 적어요.",
    summer: "더운 여름엔 시원한 음료와 아이스크림을 찾는 손님이 많아요.",
    autumn: "추석과 수확철이라 음식 선물이 많이 팔려요.",
    winter: "추워서 밖에 나와 사 먹는 손님이 줄어요.",
  },
  fashion: {
    spring: "따뜻해져서 새 봄옷을 사는 사람이 많아요.",
    summer: "더워서 옷을 덜 사고 가볍게 입어요.",
    autumn: "선선해져서 새 옷과 화장품을 많이 사요.",
    winter: "겨울 외투는 한 번 사면 오래 입어서 덜 사요.",
  },
  energy: {
    spring: "날씨가 따뜻해서 난방도 냉방도 덜 써요.",
    summer: "에어컨을 켜느라 전기를 많이 써요.",
    autumn: "선선해서 에너지를 가장 적게 쓰는 계절이에요.",
    winter: "난방 때문에 에너지를 아주 많이 써요.",
  },
  finance: {
    summer: "휴가철엔 은행 일이 조금 줄어요.",
    winter: "연말에 저축과 보험을 정리하는 사람이 많아요.",
  },
  entertainment: {
    spring: "새 학기라 바빠서 놀 시간이 줄어요.",
    summer: "여름방학이라 게임과 영화를 즐기는 사람이 많아요.",
    autumn: "공부하고 일하느라 바쁜 계절이에요.",
  },
  bio: {
    summer: "건강한 여름엔 약을 덜 찾아요.",
    winter: "감기와 독감이 유행해서 약을 많이 찾아요.",
  },
  ai: { spring: "새해 계획을 세운 회사들이 새 기술을 많이 사요." },
  robotics: {
    spring: "봄에 공장들이 새 로봇을 들여놔요.",
    summer: "휴가철이라 공장 주문이 조금 줄어요.",
  },
  space: { summer: "날씨가 맑아서 로켓 발사와 우주 체험이 많아요." },
  ev: {
    spring: "봄나들이 전에 새 차를 사는 사람이 많아요.",
    winter: "추우면 배터리가 빨리 닳아서 차 사는 걸 미뤄요.",
  },
};

/** Customer multiplier for an industry in a season (1 = an ordinary season). */
export function seasonalDemandFactor(industryId: string, season: Season): number {
  const row = SEASONAL_DEMAND[industryId];
  return row ? row[SEASON_ORDER.indexOf(season)] : 1;
}

export interface SeasonOutlook {
  season: Season;
  factor: number;
  /** Rounded percent change, e.g. +15 or -10. */
  percent: number;
  /** Big enough (±5% or more) to be worth telling a student about. */
  notable: boolean;
  reason: string;
  /** What a student might do about it. */
  tip: string;
}

/** A kid-friendly forecast of how this season changes customers for an industry. */
export function seasonOutlook(industryId: string, season: Season): SeasonOutlook {
  const factor = seasonalDemandFactor(industryId, season);
  const percent = Math.round((factor - 1) * 100);
  const def = SEASONS[season];
  const notable = Math.abs(percent) >= 5;
  const reason = (notable && SEASON_REASONS[industryId]?.[season]) || `${def.name}에도 손님 수는 평소와 비슷해요.`;
  const tip = !notable
    ? "평소처럼 손님 수에 맞춰 만들면 돼요."
    : percent > 0
      ? "손님이 늘 때는 조금 넉넉히 만들어 두면 더 많이 팔 수 있어요."
      : "손님이 줄 때는 조금만 만들어야 창고에 물건이 쌓이지 않아요.";
  return { season, factor, percent, notable, reason, tip };
}

export interface FestivalResult {
  season: Season;
  year: number;
  festival: FestivalDef;
  /** True when the student's city had a building that joined in. */
  joined: boolean;
  /** The building that hosted it, if any. */
  host?: BuildingType;
}

/** Which of the student's operational buildings can host this season's festival. */
export function festivalHost(company: Pick<Company, "buildings">, season: Season): BuildingType | undefined {
  const { needs } = SEASONS[season].festival;
  return needs.find((type) => company.buildings.some((b) => b.type === type && b.turnsLeft <= 0));
}

/**
 * Turn the season over for the turn now starting and hold its festival for
 * the student's company. Called once per turn, after the clock advances.
 */
export function startSeason(state: GameState): FestivalResult {
  const season = seasonOf(state.turn);
  state.macro.season = season;
  const festival = SEASONS[season].festival;
  const player = state.companies.find((company) => company.id === state.playerCompanyId);
  const host = player ? festivalHost(player, season) : undefined;
  if (player && host) {
    const { cash = 0, reputation = 0, morale = 0 } = festival.reward;
    player.cash += cash;
    player.reputation = Math.min(100, player.reputation + reputation);
    player.morale = Math.min(100, player.morale + morale);
  }
  return { season, year: yearOf(state.turn), festival, joined: !!host, host };
}

/** A short label for a festival reward, e.g. "평판 +2" or "+4만원". */
export function festivalRewardText(festival: FestivalDef): string {
  const parts: string[] = [];
  if (festival.reward.cash) parts.push(`💰 +${Math.round(festival.reward.cash / 10_000)}만원`);
  if (festival.reward.reputation) parts.push(`⭐ 평판 +${festival.reward.reputation}`);
  if (festival.reward.morale) parts.push(`😊 직원 만족 +${festival.reward.morale}`);
  return parts.join(" · ");
}

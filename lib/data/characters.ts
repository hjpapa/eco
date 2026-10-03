import type { Character } from "../engine/types";

// Catalog of hireable talents — fictional characters inspired by archetypes of
// famous entrepreneurs, engineers and investors (names are invented, not real
// people). Easily extendable: add entries and they appear in the talent market.

function c(
  id: string,
  name: string,
  avatar: string,
  preferredRole: Character["preferredRole"],
  rarity: Character["rarity"],
  stats: Character["stats"],
  trait: string,
  traitName: string,
  traitDesc: string,
): Character {
  // Salary scales with overall ability and rarity. Tuned so a star exec costs a
  // meaningful but affordable slice of quarterly profit (not more than revenue).
  const total =
    stats.management +
    stats.tech +
    stats.creativity +
    stats.finance +
    stats.leadership +
    stats.marketing;
  const avg = total / 6;
  const rarityMult = { common: 1, rare: 1.25, epic: 1.5, legendary: 1.9 }[rarity];
  const salary = Math.round((avg * 90 + 2000) * rarityMult);
  return {
    id,
    name,
    avatar,
    preferredRole,
    rarity,
    stats,
    trait,
    traitName,
    traitDesc,
    salary,
  };
}

export const CHARACTERS: Character[] = [
  c("visionary_ace", "강도현", "🧑‍💼", "ceo", "legendary",
    { management: 95, tech: 70, creativity: 92, finance: 80, leadership: 96, marketing: 88 },
    "visionary", "비전가", "모든 능력이 조금 오르고 평판이 빨리 올라요"),
  c("rocket_min", "이로켓", "👨‍🚀", "cto", "legendary",
    { management: 70, tech: 98, creativity: 95, finance: 60, leadership: 85, marketing: 75 },
    "innovator", "혁신가", "연구가 아주 빨라져요"),
  c("oracle_kim", "워런 김", "🧓", "cfo", "legendary",
    { management: 80, tech: 50, creativity: 70, finance: 99, leadership: 82, marketing: 65 },
    "investor", "투자귀재", "투자로 버는 돈이 늘어요"),
  c("queen_sales", "박세일", "👩‍💼", "cmo", "epic",
    { management: 72, tech: 45, creativity: 88, finance: 60, leadership: 78, marketing: 96 },
    "rainmaker", "세일즈퀸", "광고로 손님이 많이 늘어요"),
  c("ironworks", "정철강", "🧔", "coo", "epic",
    { management: 90, tech: 75, creativity: 55, finance: 70, leadership: 80, marketing: 50 },
    "operator", "생산달인", "만드는 비용을 아껴요"),
  c("chip_wizard", "한반도체", "👨‍🔬", "cto", "epic",
    { management: 60, tech: 95, creativity: 80, finance: 55, leadership: 65, marketing: 60 },
    "innovator", "혁신가", "연구가 빨라져요"),
  c("people_first", "최사람", "🧑‍🏫", "chro", "epic",
    { management: 78, tech: 50, creativity: 70, finance: 60, leadership: 92, marketing: 65 },
    "motivator", "사기충전", "직원 행복과 충성도가 올라요"),
  c("deal_maker", "송협상", "🤵", "cfo", "epic",
    { management: 75, tech: 45, creativity: 72, finance: 90, leadership: 80, marketing: 70 },
    "negotiator", "협상가", "이자 같은 돈 관리 비용을 아껴요"),
  c("brand_star", "유브랜드", "💃", "cmo", "rare",
    { management: 60, tech: 40, creativity: 85, finance: 55, leadership: 65, marketing: 88 },
    "rainmaker", "세일즈퀸", "광고로 손님이 늘어요"),
  c("code_ninja", "임코딩", "🧑‍💻", "cto", "rare",
    { management: 55, tech: 88, creativity: 78, finance: 50, leadership: 60, marketing: 55 },
    "innovator", "혁신가", "연구가 빨라져요"),
  c("steady_hand", "고안전", "👷", "coo", "rare",
    { management: 82, tech: 65, creativity: 50, finance: 65, leadership: 72, marketing: 45 },
    "guardian", "안전제일", "사고와 나쁜 소문을 줄여요"),
  c("money_flow", "남재무", "🧮", "cfo", "rare",
    { management: 70, tech: 45, creativity: 60, finance: 86, leadership: 68, marketing: 55 },
    "investor", "투자귀재", "투자로 버는 돈이 조금 늘어요"),
  c("growth_lead", "백성장", "🧑‍💼", "ceo", "rare",
    { management: 85, tech: 60, creativity: 72, finance: 72, leadership: 84, marketing: 70 },
    "visionary", "비전가", "모든 능력이 조금 올라요"),
  c("market_eye", "윤시장", "🕵️", "cmo", "rare",
    { management: 65, tech: 50, creativity: 80, finance: 62, leadership: 66, marketing: 84 },
    "trendspotter", "트렌드세터", "유행 소식에 손님이 많이 늘어요"),
  c("supply_master", "조공급", "🚚", "coo", "rare",
    { management: 80, tech: 60, creativity: 55, finance: 66, leadership: 70, marketing: 50 },
    "operator", "생산달인", "배송·생산 비용을 아껴요"),
  c("bright_intern", "신입생", "🧑", "coo", "common",
    { management: 50, tech: 55, creativity: 60, finance: 48, leadership: 45, marketing: 52 },
    "eager", "열정러", "급여가 싸고 앞으로 클 수 있어요"),
  c("solid_pm", "주관리", "🧑‍💼", "coo", "common",
    { management: 65, tech: 55, creativity: 50, finance: 55, leadership: 60, marketing: 50 },
    "operator", "생산달인", "만드는 비용을 조금 아껴요"),
  c("ad_rookie", "광고림", "📣", "cmo", "common",
    { management: 48, tech: 40, creativity: 68, finance: 45, leadership: 50, marketing: 70 },
    "rainmaker", "세일즈퀸", "광고로 손님이 조금 늘어요"),
  c("lab_assist", "연구보", "🥽", "cto", "common",
    { management: 45, tech: 70, creativity: 62, finance: 42, leadership: 48, marketing: 45 },
    "innovator", "혁신가", "연구가 조금 빨라져요"),
  c("ledger_keep", "장부지", "📒", "cfo", "common",
    { management: 60, tech: 40, creativity: 45, finance: 72, leadership: 55, marketing: 48 },
    "negotiator", "협상가", "이자 같은 비용을 조금 아껴요"),
  c("hr_buddy", "인사돌", "🤝", "chro", "common",
    { management: 58, tech: 42, creativity: 55, finance: 50, leadership: 70, marketing: 50 },
    "motivator", "사기충전", "직원 행복이 조금 올라요"),
  c("hustle_kid", "막판승", "🔥", "cmo", "common",
    { management: 52, tech: 45, creativity: 72, finance: 50, leadership: 58, marketing: 66 },
    "trendspotter", "트렌드세터", "유행 소식에 손님이 조금 늘어요"),
];

export const CHARACTER_MAP: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

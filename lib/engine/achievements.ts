import type { Company, GameState } from "./types";
import { BUILDINGS, CITY_STAGES, cityScore, getActiveBuildingCombos } from "./buildings";
import { portfolioValue } from "./ranking";

// 🏅 업적 — collectable badges for milestones in building, running the company
// and finishing requests. Once earned they stay earned (saved in the game).

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  /** How to earn it, shown on locked badges. */
  hint: string;
  check: (state: GameState, company: Company) => boolean;
}

const stageScore = (id: string) => CITY_STAGES.find((stage) => stage.id === id)?.min ?? Infinity;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-building", emoji: "🏗️", title: "첫 건물", hint: "건물을 하나 지어요", check: (_, c) => c.buildings.some((b) => !b.id.startsWith("start-")) },
  { id: "first-combo", emoji: "🤝", title: "첫 조합", hint: "서로 돕는 건물을 붙여 지어요", check: (_, c) => getActiveBuildingCombos(c.buildings).length >= 1 },
  { id: "combo-master", emoji: "🧩", title: "조합 마스터", hint: "조합 4개를 동시에 만들어요", check: (_, c) => getActiveBuildingCombos(c.buildings).length >= 4 },
  { id: "town", emoji: "🏘️", title: "마을 탄생", hint: "도시를 마을로 키워요", check: (_, c) => cityScore(c.buildings) >= stageScore("town") },
  { id: "small-city", emoji: "🏙️", title: "소도시 시장님", hint: "도시를 소도시로 키워요", check: (_, c) => cityScore(c.buildings) >= stageScore("small-city") },
  { id: "city", emoji: "🌆", title: "도시 설계자", hint: "도시를 도시 단계로 키워요", check: (_, c) => cityScore(c.buildings) >= stageScore("city") },
  { id: "metropolis", emoji: "🌃", title: "대도시의 꿈", hint: "도시를 대도시로 키워요", check: (_, c) => cityScore(c.buildings) >= stageScore("metropolis") },
  { id: "dragon-city", emoji: "🐉", title: "드래곤 시티", hint: "최고 단계 도시를 완성해요", check: (_, c) => cityScore(c.buildings) >= stageScore("dragon-city") },
  { id: "landmark", emoji: "🎡", title: "첫 랜드마크", hint: "랜드마크를 하나 지어요", check: (_, c) => c.buildings.some((b) => BUILDINGS[b.type].landmark) },
  { id: "max-level", emoji: "🏆", title: "최고 레벨", hint: "건물 하나를 Lv.3까지 키워요", check: (_, c) => c.buildings.some((b) => b.level >= 3) },
  { id: "profit-streak", emoji: "🪙", title: "3번 연속 이익", hint: "3턴 연속 이익을 내요", check: (_, c) => c.profitHistory.length >= 3 && c.profitHistory.slice(-3).every((p) => p > 0) },
  { id: "big-profit", emoji: "💰", title: "이익 10만 원", hint: "한 턴에 이익 10만 원을 내요", check: (_, c) => c.lastProfit >= 100_000 },
  { id: "first-quest", emoji: "📜", title: "첫 의뢰 완료", hint: "의뢰 게시판의 의뢰를 끝내요", check: (s) => (s.questStats?.completed ?? 0) >= 1 },
  { id: "quest-hero", emoji: "🎖️", title: "의뢰 해결사", hint: "의뢰 5개를 끝내요", check: (s) => (s.questStats?.completed ?? 0) >= 5 },
  { id: "big-order", emoji: "📦", title: "큰 주문 성공", hint: "500개 이상 주문을 끝내요", check: (s) => (s.questStats?.bigOrders ?? 0) >= 1 },
  { id: "happy-company", emoji: "😊", title: "행복한 회사", hint: "직원 행복을 80점까지 올려요", check: (_, c) => c.morale >= 80 },
  { id: "first-investment", emoji: "📈", title: "첫 투자", hint: "주식이나 자산을 사 봐요", check: (s, c) => portfolioValue(c, s) > 0 },
  { id: "full-safe", emoji: "🐷", title: "든든한 금고", hint: "현금 300만 원을 모아요", check: (_, c) => c.cash >= 3_000_000 },
];

/** Record newly earned achievements and return them (oldest first). */
export function checkAchievements(state: GameState): AchievementDef[] {
  const company = state.companies.find((c) => c.id === state.playerCompanyId);
  if (!company) return [];
  if (!state.achievements) state.achievements = [];
  const earned = new Set(state.achievements.map((a) => a.id));
  const fresh = ACHIEVEMENTS.filter((def) => !earned.has(def.id) && def.check(state, company));
  for (const def of fresh) state.achievements.push({ id: def.id, turn: state.turn });
  return fresh;
}

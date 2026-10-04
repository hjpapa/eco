import { getCampaignOutcome, villageStars, type GameState } from "./engine";

export const ENDINGS = {
  comeback: { emoji: "🌱", title: "다시 도전하는 사장님", story: "이번 도시는 잠시 쉬어 가요. 손님이 원하는 만큼 만들고 비상금을 모으면, 다음 도시는 더 튼튼해질 거예요.", tip: "다음 도전: 새 건물을 짓기 전에 남는 돈을 확인해요." },
  champion: { emoji: "👑", title: "드래곤 시티의 챔피언", story: "작은 회사가 도시 최고의 회사로 자랐어요! 드래곤과 시민들이 광장에 모여 사장님의 멋진 선택을 축하해요.", tip: "다음 도전: 1등과 직원 행복을 함께 지켜 볼까요?" },
  village: { emoji: "🏡", title: "이웃이 행복한 마을", story: "이웃들이 사장님 마을을 정말 좋아해요! 꽃밭 사이로 아이들이 뛰어놀고, 단짝 이웃들이 감사 편지를 우체통 가득 보냈어요.", tip: "마을 별 4개와 이름 있는 이웃 6명 이상을 달성했어요." },
  harmony: { emoji: "🌈", title: "함께 행복한 도시", story: "좋은 물건, 믿음직한 회사, 행복한 직원, 안전한 일터! 시민들은 오래 머물고 싶은 우리 도시에 무지개 깃발을 달았어요.", tip: "품질·평판·직원 만족·안전을 모두 60 이상 달성했어요." },
  growth: { emoji: "🚀", title: "쑥쑥 자라는 도시", story: "처음보다 더 튼튼한 재산을 만들었어요. 차곡차곡 쌓은 선택이 씨앗이 되어 도시 곳곳에 새로운 꿈이 피어나요.", tip: "다음 도전: 번 돈 일부는 비상금으로 남겨 보세요." },
  climber: { emoji: "⭐", title: "한 걸음 앞선 도전자", story: "처음보다 회사 순위가 올랐어요! 한 번에 최고가 되지 않아도 괜찮아요. 시민들은 꾸준히 나아간 사장님에게 별을 선물했어요.", tip: "다음 도전: 순위와 함께 내 총재산도 늘려 볼까요?" },
  explorer: { emoji: "🧭", title: "경제 탐험가의 첫 모험", story: "도시를 끝까지 이끌며 만들기, 팔기, 돈 관리에 도전했어요. 드래곤이 다음 모험의 지도를 건네요. 경험도 소중한 보물이에요!", tip: "다음 도전: 손님 수와 만드는 비용을 살펴보세요." },
} as const;
export type EndingId = keyof typeof ENDINGS;

export function getEndingId(game: GameState): EndingId {
  const outcome = getCampaignOutcome(game);
  if (game.endReason === "insolvent") return "comeback";
  if (outcome.isChampion) return "champion";
  const player = game.companies.find((c) => c.id === game.playerCompanyId);
  if (player && villageStars(player.buildings) >= 4 && (game.residents ?? []).length >= 6) return "village";
  if (outcome.badges.some((b) => b.id === "balancedCompany" && b.earned)) return "harmony";
  if (outcome.netWorthGrowth > 0) return "growth";
  if (outcome.rankGain > 0) return "climber";
  return "explorer";
}

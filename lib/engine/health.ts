import { getCountry } from "../data/countries";
import { getIndustry } from "../data/industries";
import { estimateDemand } from "./company";
import { isFeatureUnlocked } from "./campaign";
import { netWorth } from "./ranking";
import type { Company, GameState } from "./types";

export type CompanyHealthLevel = "healthy" | "watch" | "danger" | "insolvent";

export interface RecoveryStep {
  emoji: string;
  title: string;
  detail: string;
}

export interface RecoveryPlan {
  level: Exclude<CompanyHealthLevel, "healthy">;
  title: string;
  summary: string;
  steps: RecoveryStep[];
}

export interface CompanyHealth {
  level: CompanyHealthLevel;
  netWorth: number;
  lossStreak: number;
  lowCash: boolean;
  heavyDebt: boolean;
}

/** A transparent health check used by coaching, tests and the failure rule. */
export function assessCompanyHealth(state: GameState, company: Company): CompanyHealth {
  const recent = company.profitHistory.slice(-4);
  let lossStreak = 0;
  for (let index = recent.length - 1; index >= 0 && recent[index] < 0; index -= 1) {
    lossStreak += 1;
  }
  const worth = netWorth(company, state);
  const lowCash = company.cash < 100_000;
  const heavyDebt = company.debt > Math.max(500_000, worth + company.debt * 0.55);
  const insolvent =
    state.turn >= 13 &&
    lossStreak >= 3 &&
    company.cash < 25_000 &&
    company.debt >= 600_000 &&
    worth <= 0;
  const danger = lossStreak >= 3 || (lowCash && company.debt >= 300_000) || worth < 150_000;
  const watch = lossStreak >= 2 || lowCash || heavyDebt;
  return {
    level: insolvent ? "insolvent" : danger ? "danger" : watch ? "watch" : "healthy",
    netWorth: worth,
    lossStreak,
    lowCash,
    heavyDebt,
  };
}

/** End the run only after the turn-10 rescue lesson had time to be used. */
export function shouldDeclareInsolvent(state: GameState, company: Company): boolean {
  return assessCompanyHealth(state, company).level === "insolvent";
}

/** A one-time, concrete rescue lesson shown after completing turn 10. */
export function getTurnTenRecoveryPlan(state: GameState): RecoveryPlan | null {
  if (state.turn !== 10) return null;
  const company = state.companies.find((candidate) => candidate.id === state.playerCompanyId);
  if (!company) return null;
  const health = assessCompanyHealth(state, company);
  if (health.level === "healthy") return null;

  const industry = getIndustry(company.industryId);
  const country = getCountry(company.countryId);
  const demand = estimateDemand(company, industry, country, state.macro, state.config);
  const unitCost = Math.round(industry.unitCost * country.laborCost);
  const steps: RecoveryStep[] = [];

  if (company.inventory > demand * 1.2) {
    steps.push({
      emoji: "📦",
      title: "먼저 생산량 줄이기",
      detail: `재고가 ${Math.round(company.inventory).toLocaleString()}개예요. 다음 생산 목표를 예상 수요 약 ${Math.round(demand).toLocaleString()}개보다 낮게 잡아 보세요.`,
    });
  }
  if (company.lastProfit < 0) {
    steps.push({
      emoji: "🏷️",
      title: "파는 값과 만드는 값 비교하기",
      detail: `물건 1개를 만드는 데 약 ${unitCost.toLocaleString()}원(원가)이 들어요. 파는 값이 이보다 충분히 비싼지 확인해요.`,
    });
  }
  if (health.lowCash) {
    steps.push({
      emoji: "🛑",
      title: "새 지출 잠시 멈추기",
      detail: "현금이 회복될 때까지 새 건물·투자를 쉬고, 마케팅·연구·복지 예산을 꼭 필요한 만큼만 써 보세요.",
    });
  }
  if (health.heavyDebt) {
    steps.push({
      emoji: "🧾",
      title: "빚과 이자 줄이기",
      detail: isFeatureUnlocked(state, "visitsPartnershipsAdvanced")
        ? "이익이 생기면 빚부터 조금씩 갚으세요. 금리가 오르면 내는 이자도 커져요."
        : "지금은 추가 지출을 줄여 빚이 더 늘지 않게 하세요. 회사 돈 관리가 열리면 빚을 조금씩 갚을 수 있어요.",
    });
  }
  if (steps.length < 3) {
    steps.push({
      emoji: "🎯",
      title: "한 번에 하나씩 바꾸기",
      detail: "가격이나 생산량 중 하나만 바꾸고 다음 턴 결과를 비교하면 원인을 쉽게 찾을 수 있어요.",
    });
  }

  return {
    level: health.level === "insolvent" ? "danger" : health.level,
    title: "10턴 경영 구조대",
    summary: health.level === "danger"
      ? "회사가 위험 신호를 보내고 있어요. 아래 순서대로 고치지 않으면 경영에 실패할 수 있어요."
      : "조금 불안한 신호가 보여요. 지금 바로 손보면 충분히 회복할 수 있어요.",
    steps: steps.slice(0, 4),
  };
}

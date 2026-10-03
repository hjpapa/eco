import type { EconomyPhase, GameState, NewsItem } from "./types";
import { getCountry } from "../data/countries";
import { PHASE_EMOJI, PHASE_LABELS, tickEconomy } from "./economy";

/** What a change of economic phase means, in words a 4th grader can read. */
const PHASE_NEWS: Record<EconomyPhase, string> = {
  boom: "경기가 아주 좋아졌어요(호황). 사람들이 물건을 많이 사요.",
  normal: "경기가 안정됐어요. 차근차근 회사를 키우기 좋은 때예요.",
  recession: "경기가 나빠졌어요(불황). 사람들이 물건을 덜 사요.",
  inflation: "물건값이 쑥쑥 오르고 있어요(인플레이션). 같은 돈으로 살 수 있는 게 줄어요.",
  deflation: "물건값이 계속 내려가요(디플레이션). 사람들이 사는 걸 미루곤 해요.",
  stagflation: "경기는 나쁜데 물건값은 올라요(스태그플레이션). 아주 조심해야 할 때예요.",
};
import { runAiTurn } from "./ai";
import { marketAttractiveness, runCompanyTurn, type CompanyTurnResult } from "./company";
import { getIndustry } from "../data/industries";
import { tickStocks } from "./market";
import { tickAssets } from "./assets";
import { generateEvents } from "./events";
import { generateFunEvent } from "./funEvents";
import {
  activeOrder,
  deliverOrders,
  orderRemaining,
  updateQuests,
  type OrderDelivery,
  type QuestUpdate,
} from "./quests";
import { updateDilemma } from "./dilemmas";
import { checkAchievements } from "./achievements";
import { decayRelations } from "./relations";
import { recordNetWorth } from "./ranking";
import { topUpTalentPool } from "./characters";
import { getCampaignGrowthMultiplier, isFeatureUnlocked } from "./campaign";
import {
  getTurnTenRecoveryPlan,
  shouldDeclareInsolvent,
  type RecoveryPlan,
} from "./health";

export interface TurnSummary {
  turn: number;
  playerResult: CompanyTurnResult | null;
  rateChange: number;
  phaseChanged: boolean;
  events: NewsItem[];
  recoveryPlan: RecoveryPlan | null;
  /** Units the accepted order received this turn. */
  orderDelivery?: OrderDelivery | null;
  /** Request-board changes after the turn (failed, expired, posted, ready). */
  questUpdate?: QuestUpdate | null;
  /** A new "사장님의 선택" card appeared. */
  newDilemma?: boolean;
  /** Achievements earned during this turn. */
  achievements?: { id: string; emoji: string; title: string }[];
}

let monetaryCounter = 0;

/** Advance the whole simulation by one turn. Mutates and returns a summary. */
export function advanceTurn(state: GameState): TurnSummary {
  if (state.status === "ended") {
    return { turn: state.turn, playerResult: null, rateChange: 0, phaseChanged: false, events: [], recoveryPlan: null };
  }

  const homeCountry = getCountry(
    state.companies.find((c) => c.id === state.playerCompanyId)?.countryId ?? "us",
  );

  decayRelations(state.relations);

  // Clear last turn's campus visitors; events this turn may set new ones.
  for (const c of state.companies) c.visitor = undefined;

  // 1) Macro economy + central-bank policy.
  const { phaseChanged, rateChange } = tickEconomy(
    state.macro,
    homeCountry,
    state.config,
    state.rng,
  );

  const enabled = new Set(state.config.enabledEventLayers);
  if (phaseChanged && enabled.has("macro")) {
    pushNews(state, {
      layer: "macro",
      tone: state.macro.phase === "boom" ? "positive" : state.macro.phase === "normal" ? "neutral" : "negative",
      emoji: PHASE_EMOJI[state.macro.phase],
      title: `경제 날씨가 바뀌었어요: ${PHASE_LABELS[state.macro.phase]}`,
      body: PHASE_NEWS[state.macro.phase],
      tags: ["macro", state.macro.phase],
    });
  }
  if (Math.abs(rateChange) >= 0.1 && enabled.has("monetary")) {
    const hike = rateChange > 0;
    const oldRate = state.macro.interestRate - rateChange;
    pushNews(state, {
      layer: "monetary",
      tone: hike ? "negative" : "positive",
      emoji: hike ? "📈" : "📉",
      title: `${homeCountry.centralBank} 기준금리 ${hike ? "인상" : "인하"}`,
      body: `돈을 빌릴 때 기준이 되는 금리가 ${oldRate.toFixed(2)}%에서 ${state.macro.interestRate.toFixed(2)}%로 ${hike ? "올랐어요" : "내렸어요"}. ${hike ? "대출 이자 부담과 예금 이자가 함께 커질 수 있어요." : "대출 이자 부담이 줄어 회사가 돈을 쓰기 쉬워질 수 있어요."}`,
      tags: ["monetary"],
    });
  }

  // 2) AI competitors act (decisions, expansion, hiring, investing).
  for (const company of state.companies) {
    if (company.isAI) runAiTurn(state, company);
  }

  // 3) Resolve every company's operating turn. First measure the field's average
  //    "pull" on customers so each company competes for a shared customer pool:
  //    falling behind the average steadily costs you sales (see estimateDemand).
  const pulls = state.companies.map((c) =>
    marketAttractiveness(c, getIndustry(c.industryId), state.config),
  );
  const marketPressure =
    pulls.length > 0 ? pulls.reduce((a, b) => a + b, 0) / pulls.length : 1;

  let playerResult: CompanyTurnResult | null = null;
  const growthMultiplier = getCampaignGrowthMultiplier(state);
  const researchUnlocked = isFeatureUnlocked(state, "research");
  for (const company of state.companies) {
    // Treat the engine as the final authority even if a caller or edited save
    // tries to inject an R&D budget before guided research unlocks.
    if (!researchUnlocked) company.decisions.rndBudget = 0;
    const result = runCompanyTurn(
      company,
      state.macro,
      state.config,
      state.rng,
      marketPressure,
      growthMultiplier,
      company.id === state.playerCompanyId ? orderRemaining(activeOrder(state)) : 0,
    );
    if (company.id === state.playerCompanyId) playerResult = result;
  }

  // 3b) Pay for the units the student's accepted order received.
  const playerCompany = state.companies.find((company) => company.id === state.playerCompanyId);
  const orderDelivery = playerCompany ? deliverOrders(state, playerCompany, playerResult?.reserved ?? 0) : null;
  if (playerResult && orderDelivery && orderDelivery.revenue > 0) {
    playerResult = {
      ...playerResult,
      revenue: playerResult.revenue + orderDelivery.revenue,
      profit: playerResult.profit + orderDelivery.revenue,
    };
  }

  // 4) Update markets.
  tickStocks(state.stocks, state.companies, state.macro, state.config, state.rng);
  tickAssets(state.assets, state.macro, state.config, state.rng);

  // 5) Fire events (shocks on top of the regular market move), plus maybe one
  //    light-hearted 깜짝 소식 about the student's company.
  const events = generateEvents(state);
  const funEvent = generateFunEvent(state);

  // 6) Record net worth history for charts/leaderboard.
  recordNetWorth(state);

  // 7) Keep the talent market steadily stocked every turn.
  {
    const hiredIds = new Set(state.companies.flatMap((c) => c.hired.map((h) => h.id)));
    state.talentPool = topUpTalentPool(state.talentPool, hiredIds, state.rng);
  }

  // 8) Advance the clock.
  state.turn += 1;
  const recoveryPlan = getTurnTenRecoveryPlan(state);
  const player = state.companies.find((company) => company.id === state.playerCompanyId);
  if (state.turn >= state.maxTurns) {
    state.status = "ended";
    state.endReason = "completed";
  } else if (player && shouldDeclareInsolvent(state, player)) {
    state.status = "ended";
    state.endReason = "insolvent";
  }
  state.updatedAt = Date.now();

  // The simulation may prepare news in the background, but guided players do
  // not receive news cut-ins or campus visitors until those lessons unlock.
  const newsUnlocked = isFeatureUnlocked(state, "talentNewsRanking");
  const visitsUnlocked = isFeatureUnlocked(state, "visitsPartnershipsAdvanced");
  if (!visitsUnlocked) {
    for (const company of state.companies) company.visitor = undefined;
  }
  const visibleEvents = newsUnlocked
    ? events.filter((event) => event.layer !== "visitor" || visitsUnlocked)
    : [];
  // Jokes are about the student's own company, so they appear from turn one.
  if (funEvent) visibleEvents.push(funEvent);

  // 9) Request board, choice cards and achievements for the new turn.
  const questUpdate = updateQuests(state);
  const newDilemma = updateDilemma(state) !== null;
  const achievements = checkAchievements(state).map(({ id, emoji, title }) => ({ id, emoji, title }));

  return {
    turn: state.turn,
    playerResult,
    rateChange,
    phaseChanged,
    events: visibleEvents,
    recoveryPlan,
    orderDelivery,
    questUpdate,
    newDilemma,
    achievements,
  };
}

function pushNews(state: GameState, item: Omit<NewsItem, "id" | "turn">): void {
  state.news.push({ ...item, id: `sys-${state.turn}-${monetaryCounter++}`, turn: state.turn });
}

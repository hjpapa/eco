import {
  getActiveBuildingCombos,
  getFeatureUnlockTurn,
  isFeatureUnlocked,
  netWorth,
  portfolioValue,
  productionCapacity,
  rankings,
  seasonOf,
  seasonOutlook,
  SEASONS,
  totalUpkeep,
  type EconomyPhase,
  type GameState,
} from "../engine";
import type { TurnSummary } from "../engine/tick";

export type MissionDestination = "home" | "company" | "invest" | "talent" | "more";

export type TurnMissionId =
  | "first-building"
  | "city-growth"
  | "upgrade"
  | "first-sale"
  | "profit"
  | "inventory"
  | "cash-reserve"
  | "quality"
  | "workplace"
  | "building-combo"
  | "first-investment"
  | "healthy-debt";

export interface TurnMission {
  id: TurnMissionId;
  emoji: string;
  title: string;
  detail: string;
  progress: string;
  done: boolean;
  destination: MissionDestination;
  actionLabel: string;
}

export interface JourneyMilestone {
  id: string;
  emoji: string;
  label: string;
  turn: number;
  complete: boolean;
  current: boolean;
}

export interface DragonStage {
  id: string;
  emoji: string;
  label: string;
  level: number;
  progress: number;
  nextLabel: string | null;
  turnsToNext: number;
}

export interface EconomyWeather {
  emoji: string;
  name: string;
  headline: string;
  advice: string;
  scene: "sun" | "clear" | "rain" | "heat" | "snow" | "fog";
}

export interface RankingSnapshotEntry {
  companyId: string;
  name: string;
  netWorth: number;
  rank: number;
  isPlayer: boolean;
}

export interface TurnPresentationSnapshot {
  /** Number of completed turns before advanceTurn mutates the game. */
  turn: number;
  netWorth: number;
  rank: number;
  cash: number;
  inventory: number;
  productionTarget: number;
  productPrices?: number[];
  phase: EconomyPhase;
  rankingUnlocked: boolean;
  /** Detached values only: never retain a Company/RankingEntry from mutable state. */
  ranking: RankingSnapshotEntry[];
  missionIds: TurnMissionId[];
  /** Campus size before the turn, to show what new buildings changed. */
  buildingCount?: number;
  capacity?: number;
}

export interface RankingMovementEntry {
  companyId: string;
  name: string;
  beforeRank: number;
  afterRank: number;
}

export interface TurnRankingComparison {
  /** False while guided ranking lessons are locked; names are then withheld. */
  visible: boolean;
  beforeRank: number;
  afterRank: number;
  /** Positive means the player climbed; negative means the player fell. */
  rankGain: number;
  overtaken: RankingMovementEntry[];
  passedBy: RankingMovementEntry[];
}

export interface RivalChase {
  mode: "chasing" | "defending";
  player: RankingSnapshotEntry;
  rival: RankingSnapshotEntry;
  gap: number;
  /** 100 means the two companies have almost the same net worth. */
  closenessPercent: number;
}

export interface TurnHighlight {
  emoji: string;
  title: string;
  detail: string;
  tone: "good" | "warning" | "info";
}

const DRAGON_STAGES = [
  { id: "apprentice", emoji: "🥚", label: "견습 상인", threshold: 0 },
  { id: "merchant", emoji: "🐲", label: "마을 경영자", threshold: 0.2 },
  { id: "builder", emoji: "🏗️", label: "도시 설계자", threshold: 0.45 },
  { id: "captain", emoji: "🏰", label: "산악 CEO", threshold: 0.7 },
  { id: "dragon", emoji: "🐉", label: "드래곤 CEO", threshold: 0.9 },
] as const;

const WEATHER: Record<EconomyPhase, EconomyWeather> = {
  boom: {
    emoji: "☀️",
    name: "맑고 활기참",
    headline: "손님들의 지갑이 열리는 날씨예요.",
    advice: "성장 기회를 잡되 너무 많이 만들지는 살펴보세요.",
    scene: "sun",
  },
  normal: {
    emoji: "🌤️",
    name: "잔잔한 맑음",
    headline: "회사를 차근차근 키우기 좋은 날씨예요.",
    advice: "가격과 생산량을 맞추며 비상금도 남겨 두세요.",
    scene: "clear",
  },
  recession: {
    emoji: "🌧️",
    name: "경기 비구름",
    headline: "손님들이 돈을 조심해서 쓰고 있어요.",
    advice: "생산량과 지출을 줄이고 현금을 지켜 보세요.",
    scene: "rain",
  },
  inflation: {
    emoji: "🔥",
    name: "물가 폭염",
    headline: "물건과 재료의 값이 빠르게 오르고 있어요.",
    advice: "판매 가격이 비용보다 충분히 높은지 확인하세요.",
    scene: "heat",
  },
  deflation: {
    emoji: "❄️",
    name: "소비 한파",
    headline: "값이 내려갈 거라 생각해 구매를 미루기도 해요.",
    advice: "재고가 쌓이지 않도록 생산을 작게 시험하세요.",
    scene: "snow",
  },
  stagflation: {
    emoji: "🌫️",
    name: "짙은 경제 안개",
    headline: "물가는 오르는데 경기는 느려진 어려운 날씨예요.",
    advice: "큰 지출보다 현금·안전·핵심 상품을 먼저 지키세요.",
    scene: "fog",
  },
};

export function getEconomyWeather(phase: EconomyPhase): EconomyWeather {
  return WEATHER[phase];
}

export function getDragonStage(game: GameState): DragonStage {
  const campaignProgress = clamp(game.turn / Math.max(1, game.maxTurns), 0, 1);
  let index = 0;
  for (let i = 1; i < DRAGON_STAGES.length; i += 1) {
    if (campaignProgress >= DRAGON_STAGES[i].threshold) index = i;
  }

  const stage = DRAGON_STAGES[index];
  const next = DRAGON_STAGES[index + 1];
  const localProgress = next
    ? clamp((campaignProgress - stage.threshold) / (next.threshold - stage.threshold), 0, 1)
    : 1;
  const nextTurn = next ? Math.ceil(next.threshold * game.maxTurns) : game.maxTurns;

  return {
    id: stage.id,
    emoji: stage.emoji,
    label: stage.label,
    level: index + 1,
    progress: localProgress,
    nextLabel: next?.label ?? null,
    turnsToNext: Math.max(0, nextTurn - game.turn),
  };
}

export function getJourneyMilestones(game: GameState): JourneyMilestone[] {
  const raw = game.revealMode === "all"
    ? [
        { id: "start", emoji: "🚩", label: "전체 기능 출발", turn: 0 },
        { id: "quarter", emoji: "🏕️", label: "첫 쉼터", turn: Math.ceil(game.maxTurns * 0.25) },
        { id: "half", emoji: "🏔️", label: "중턱", turn: Math.ceil(game.maxTurns * 0.5) },
        { id: "high-camp", emoji: "⛺", label: "고지대 캠프", turn: Math.ceil(game.maxTurns * 0.75) },
        { id: "summit", emoji: "🏆", label: "정상", turn: game.maxTurns },
      ]
    : [
        { id: "start", emoji: "🏗️", label: "회사·건설", turn: 0 },
        { id: "research", emoji: "🔬", label: "연구", turn: getFeatureUnlockTurn(game.gameLength, "research") },
        { id: "invest", emoji: "📈", label: "투자", turn: getFeatureUnlockTurn(game.gameLength, "investment") },
        { id: "talent", emoji: "👔", label: "인재·순위", turn: getFeatureUnlockTurn(game.gameLength, "talentNewsRanking") },
        { id: "visit", emoji: "🌍", label: "방문·제휴", turn: getFeatureUnlockTurn(game.gameLength, "visitsPartnershipsAdvanced") },
        { id: "summit", emoji: "🏆", label: "정상", turn: game.maxTurns },
      ];

  let currentIndex = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (game.turn >= raw[i].turn) currentIndex = i;
  }
  return raw.map((milestone, index) => ({
    ...milestone,
    complete: game.turn >= milestone.turn,
    current: index === currentIndex && game.turn < game.maxTurns,
  }));
}

export function getTurnMissions(game: GameState): TurnMission[] {
  if (game.turn === 0) {
    return [
      evaluateMission(game, "first-building", game.turn),
      evaluateMission(game, "first-sale", game.turn),
    ];
  }

  const available = getAvailableTurnMissionIds(game);
  const selected = [...available]
    .sort((left, right) => {
      const scoreDiff = missionScore(game.seed, game.turn, left) - missionScore(game.seed, game.turn, right);
      return scoreDiff || left.localeCompare(right);
    })
    .slice(0, Math.min(2, available.length));
  return selected.map((id) => evaluateMission(game, id, game.turn));
}

/** Full candidate list, useful for proving that locked systems never leak into missions. */
export function getAvailableTurnMissionIds(game: GameState): TurnMissionId[] {
  // Construction is open from the first turn, so city missions always appear.
  const available: TurnMissionId[] = [
    "profit",
    "inventory",
    "cash-reserve",
    "workplace",
    "building-combo",
    "city-growth",
    "upgrade",
  ];
  if (isFeatureUnlocked(game, "research")) available.push("quality");
  if (isFeatureUnlocked(game, "investment")) available.push("first-investment");
  if (isFeatureUnlocked(game, "visitsPartnershipsAdvanced")) available.push("healthy-debt");
  return available;
}

/**
 * Evaluate a mission against current values while keeping targets from the
 * turn on which it was offered. This matters at progress thresholds: the
 * mutable engine increments game.turn before the result popup is built.
 */
export function evaluateMission(
  game: GameState,
  id: TurnMissionId,
  offeredTurn = game.turn,
  offeredProductionTarget?: number,
): TurnMission {
  const player = getPlayer(game);
  const comboCount = getActiveBuildingCombos(player.buildings).length;
  const invested = portfolioValue(player, game);
  const inventoryGoal = Math.max(
    40,
    Math.round((offeredProductionTarget ?? player.decisions.productionTarget) * 0.4),
  );
  const qualityGoal = Math.min(70, 35 + Math.floor((offeredTurn / Math.max(1, game.maxTurns)) * 4) * 10);
  const hasCompletedOfferedTurn = game.turn > offeredTurn;
  const builtByPlayer = player.buildings.filter((building) => !building.id.startsWith("start-")).length;
  const cityGoal = Math.min(game.config.mapSize ** 2, 4 + Math.floor(offeredTurn / 3));
  const upgradeGoal = 1 + Math.floor(offeredTurn / 10);
  const upgradedCount = player.buildings.filter((building) => building.level >= 2).length;

  switch (id) {
    case "first-building":
      return mission(id, "🏗️", "첫 건물 짓기", "건설을 눌러 건물을 고르고 빈 땅에 지어요. 미리보기에서 '본전까지 몇 턴'인지 꼭 확인해요.", `${Math.min(1, builtByPlayer)} / 1개`, builtByPlayer >= 1, "company", "건물 지으러 가기");
    case "city-growth":
      return mission(id, "🏙️", `건물 ${cityGoal}개 도시`, "비상금은 남겨 두고, 돈을 벌어 주는 건물부터 하나씩 늘려요.", `${player.buildings.length} / ${cityGoal}개`, player.buildings.length >= cityGoal, "company", "도시 키우기");
    case "upgrade":
      return mission(id, "⬆️", `업그레이드 ${upgradeGoal}곳`, "새로 짓는 대신 있는 건물을 키우는 것도 좋은 방법이에요. 빈 땅을 아낄 수 있어요.", `${upgradedCount} / ${upgradeGoal}곳`, upgradedCount >= upgradeGoal, "company", "건물 키우러 가기");
    case "first-sale":
      return mission(id, "🛍️", "첫 손님 만나기", "가격과 생산량을 정한 뒤 다음 턴을 눌러 첫 판매를 시작해요.", `${hasCompletedOfferedTurn && player.lastRevenue > 0 ? "판매 성공" : "판매 준비 중"}`, hasCompletedOfferedTurn && player.lastRevenue > 0, "company", "회사 운영하기");
    case "profit":
      return mission(id, "🪙", "이익 남기기", "번 돈이 쓴 돈보다 많으면 성공해요.", game.turn > 0 ? `${player.lastProfit >= 0 ? "+" : ""}${Math.round(player.lastProfit).toLocaleString()}원` : "결과 전", game.turn > 0 && player.lastProfit > 0, "company", "가격·생산 보기");
    case "inventory":
      return mission(id, "📦", "창고를 가볍게", "팔릴 만큼만 만들면 창고에 물건이 쌓이지 않아요.", `${Math.round(player.inventory).toLocaleString()} / ${inventoryGoal.toLocaleString()}개 이하`, game.turn > 0 && player.inventory <= inventoryGoal, "company", "생산량 조절하기");
    case "cash-reserve":
      return mission(id, "🛟", "비상금 지키기", "갑자기 생길 일에 대비해 돈 70만 원을 남겨 봐요.", `${Math.round(player.cash).toLocaleString()} / 700,000원`, (offeredTurn > 0 || hasCompletedOfferedTurn) && player.cash >= 700_000, "home", "회사 살림 보기");
    case "quality":
      return mission(id, "🔬", `품질 ${qualityGoal}점 도전`, "연구와 좋은 건물 조합은 더 좋은 상품을 만들게 해요.", `${Math.round(player.quality)} / ${qualityGoal}점`, player.quality >= qualityGoal, "company", "연구 계획 세우기");
    case "workplace":
      return mission(id, "😊", "튼튼한 일터", "직원 행복과 안전을 모두 55점 이상으로 지켜요.", `행복 ${Math.round(player.morale)} · 안전 ${Math.round(player.safety)}`, player.morale >= 55 && player.safety >= 55, "company", "직원 환경 살피기");
    case "building-combo":
      return mission(id, "🧩", "건물 팀 만들기", "서로 돕는 건물을 상하좌우로 붙여 조합 1개를 완성해요.", `${comboCount} / 1개`, comboCount >= 1, "company", "건물 조합하기");
    case "first-investment":
      return mission(id, "🌱", "첫 투자 해 보기", "돈을 다 쓰지 말고 조금만 주식이나 예금에 넣어 봐요.", invested > 0 ? `${Math.round(invested).toLocaleString()}원 투자 중` : "아직 0원", invested > 0, "invest", "투자 둘러보기");
    case "healthy-debt":
      return mission(id, "⚖️", "감당할 수 있는 빚", "가진 돈이 빚보다 많으면 이자가 올라도 버티기 쉬워요.", `돈 ${Math.round(player.cash).toLocaleString()} · 빚 ${Math.round(player.debt).toLocaleString()}원`, player.cash >= player.debt, "company", "재무 확인하기");
  }
}

/** Re-evaluate exactly the missions that were captured before advanceTurn. */
export function evaluateSnapshotMissions(
  game: GameState,
  snapshot: TurnPresentationSnapshot,
): TurnMission[] {
  return snapshot.missionIds.map((id) =>
    evaluateMission(game, id, snapshot.turn, snapshot.productionTarget),
  );
}

export function captureTurnSnapshot(game: GameState): TurnPresentationSnapshot {
  const player = getPlayer(game);
  const board = getRankingSnapshot(game);
  return {
    turn: game.turn,
    netWorth: netWorth(player, game),
    rank: board.find((entry) => entry.isPlayer)?.rank ?? 0,
    cash: player.cash,
    inventory: player.inventory,
    productionTarget: player.decisions.productionTarget,
    productPrices: (player.productPrices ?? []).filter((price, index) => price > 0 && (player.productEnabled?.[index] ?? index === 0)),
    phase: game.macro.phase,
    rankingUnlocked: isFeatureUnlocked(game, "talentNewsRanking"),
    ranking: board,
    missionIds: getTurnMissions(game).map((item) => item.id),
    buildingCount: player.buildings.length,
    capacity: productionCapacity(player, game.config),
  };
}

/** Compare detached before-values with the current live board. */
export function compareTurnRankings(
  snapshot: TurnPresentationSnapshot,
  game: GameState,
): TurnRankingComparison {
  const after = getRankingSnapshot(game);
  const afterPlayer = after.find((entry) => entry.isPlayer);
  const afterById = new Map(after.map((entry) => [entry.companyId, entry]));
  const visible = snapshot.rankingUnlocked && isFeatureUnlocked(game, "talentNewsRanking");
  const beforeRank = snapshot.rank;
  const afterRank = afterPlayer?.rank ?? 0;

  if (!visible || beforeRank <= 0 || afterRank <= 0) {
    return {
      visible,
      beforeRank,
      afterRank,
      rankGain: beforeRank > 0 && afterRank > 0 ? beforeRank - afterRank : 0,
      overtaken: [],
      passedBy: [],
    };
  }

  const overtaken: RankingMovementEntry[] = [];
  const passedBy: RankingMovementEntry[] = [];
  for (const before of snapshot.ranking) {
    if (before.isPlayer) continue;
    const current = afterById.get(before.companyId);
    if (!current) continue;
    const movement = {
      companyId: before.companyId,
      name: current.name,
      beforeRank: before.rank,
      afterRank: current.rank,
    };
    if (before.rank < beforeRank && current.rank > afterRank) overtaken.push(movement);
    if (before.rank > beforeRank && current.rank < afterRank) passedBy.push(movement);
  }

  overtaken.sort((left, right) => left.afterRank - right.afterRank);
  passedBy.sort((left, right) => left.afterRank - right.afterRank);
  return {
    visible,
    beforeRank,
    afterRank,
    rankGain: beforeRank - afterRank,
    overtaken,
    passedBy,
  };
}

/** Live nearest-rival information for the dashboard chase meter. */
export function getRivalChase(game: GameState): RivalChase | null {
  if (!isFeatureUnlocked(game, "talentNewsRanking")) return null;
  const board = getRankingSnapshot(game);
  const playerIndex = board.findIndex((entry) => entry.isPlayer);
  if (playerIndex < 0 || board.length < 2) return null;
  const rivalIndex = playerIndex === 0 ? 1 : playerIndex - 1;
  const player = board[playerIndex];
  const rival = board[rivalIndex];
  const gap = Math.abs(player.netWorth - rival.netWorth);
  const scale = Math.max(1, Math.abs(player.netWorth), Math.abs(rival.netWorth));
  return {
    mode: playerIndex === 0 ? "defending" : "chasing",
    player,
    rival,
    gap,
    closenessPercent: Math.round(clamp(1 - gap / scale, 0, 1) * 100),
  };
}

export function getTurnHighlights(
  game: GameState,
  summary: TurnSummary,
  snapshot: TurnPresentationSnapshot,
): TurnHighlight[] {
  const result = summary.playerResult;
  if (!result) return [];
  const player = getPlayer(game);
  const availableUnits = Math.max(1, snapshot.inventory + result.unitsProduced);
  const sellThrough = result.unitsSold / availableUnits;
  const spending =
    player.decisions.marketingBudget +
    player.decisions.rndBudget +
    player.decisions.welfareBudget +
    player.decisions.safetyBudget;
  const highlights: TurnHighlight[] = [];

  if (result.profit > 0 && sellThrough >= 0.7) {
    highlights.push({ emoji: "🎯", title: "만든 만큼 잘 팔렸어요", detail: `만든 물건의 약 ${Math.round(Math.min(1, sellThrough) * 100)}%가 팔려서 이익이 났어요.`, tone: "good" });
  } else if (sellThrough < 0.5 && player.inventory > snapshot.inventory) {
    highlights.push({ emoji: "📦", title: "창고에 물건이 남았어요", detail: "만든 양보다 팔린 양이 적었어요. 다음 턴에는 조금 덜 만들어 봐요.", tone: "warning" });
  } else if (result.profit <= 0 && spending > Math.max(50_000, result.revenue * 0.25)) {
    highlights.push({ emoji: "🧾", title: "쓴 돈이 많았어요", detail: "광고·연구·직원·안전에 쓴 돈이 이번에 번 돈에 비해 많았어요. 한두 가지만 남겨 봐요.", tone: "warning" });
  } else if (result.profit > 0) {
    highlights.push({ emoji: "🪙", title: "회사가 돈을 남겼어요", detail: "판 돈이 만들고 운영하는 데 쓴 돈보다 많아서 쓸 돈이 늘었어요.", tone: "good" });
  } else {
    highlights.push({ emoji: "🧭", title: "균형을 다시 맞출 때예요", detail: "가격·만드는 양·쓰는 돈 중 한 가지만 조금 바꾸고 다음 결과와 비교해 봐요.", tone: "warning" });
  }

  if (summary.rateChange >= 0.1 && player.debt > 0) {
    highlights.push({ emoji: "🏦", title: "금리가 올라 이자를 조심해야 해요", detail: "빚이 있다면 앞으로 나가는 이자가 커질 수 있어요. 현금을 남기거나 일부를 갚아 보세요.", tone: "warning" });
  } else if (summary.rateChange <= -0.1 && player.debt > 0) {
    highlights.push({ emoji: "🏦", title: "금리 부담이 조금 가벼워졌어요", detail: "빌린 돈의 이자 부담이 줄어들 수 있지만, 갚을 계획은 계속 세워 두세요.", tone: "info" });
  } else if (snapshot.phase !== game.macro.phase) {
    const weather = getEconomyWeather(game.macro.phase);
    highlights.push({ emoji: weather.emoji, title: `경제 날씨가 '${weather.name}'으로 바뀌었어요`, detail: weather.advice, tone: "info" });
  } else {
    // The season of the turn that just ended (계절 수요).
    const past = seasonOutlook(player.industryId, seasonOf(game.turn - 1));
    if (Math.abs(past.percent) >= 10) {
      const season = SEASONS[past.season];
      highlights.push({
        emoji: season.emoji,
        title: `${season.name}이라 손님이 ${Math.abs(past.percent)}% ${past.percent > 0 ? "많았어요" : "적었어요"}`,
        detail: `${past.reason} 계절에 따라 사려는 사람 수가 바뀌는 걸 '계절 수요'라고 해요.`,
        tone: "info",
      });
    }
  }

  const newBuildings = player.buildings.length - (snapshot.buildingCount ?? player.buildings.length);
  const upkeep = totalUpkeep(player.buildings);
  if (newBuildings > 0) {
    const capacityNow = productionCapacity(player, game.config);
    const capacityText = snapshot.capacity != null && capacityNow !== snapshot.capacity
      ? `최대로 만들 수 있는 양이 ${snapshot.capacity.toLocaleString()}개에서 ${capacityNow.toLocaleString()}개로 바뀌었어요. `
      : "";
    highlights.splice(1, 0, {
      emoji: "🏗️",
      title: `새 건물 ${newBuildings}개가 일하기 시작했어요`,
      detail: `${capacityText}매 턴 건물 유지비는 모두 ${Math.round(upkeep).toLocaleString()}원이에요.`,
      tone: "good",
    });
  } else if (result.profit <= 0 && upkeep > Math.max(20_000, result.revenue * 0.3)) {
    highlights.splice(1, 0, {
      emoji: "🏚️",
      title: "건물 유지비가 많이 나가요",
      detail: `매 턴 유지비 ${Math.round(upkeep).toLocaleString()}원이 나가요. 미리보기에서 돈을 벌어 주는 건물(공장·매장)을 먼저 고르고, 안 쓰는 건물은 팔 수도 있어요.`,
      tone: "warning",
    });
  }

  const rankingChange = compareTurnRankings(snapshot, game);
  if (rankingChange.visible && rankingChange.rankGain > 0) {
    const names = formatMovementNames(rankingChange.overtaken);
    highlights.push({
      emoji: "⚔️",
      title: names ? `${names} 추월! ${rankingChange.afterRank}위` : `라이벌을 추월해 ${rankingChange.afterRank}위!`,
      detail: `${rankingChange.beforeRank}위에서 ${rankingChange.afterRank}위로 올라섰어요. 지금 전략의 좋은 점을 찾아 보세요.`,
      tone: "good",
    });
  } else if (rankingChange.visible && rankingChange.rankGain < 0) {
    const names = formatMovementNames(rankingChange.passedBy);
    highlights.push({
      emoji: "🔥",
      title: names ? `${names} 앞서갔어요` : "라이벌 회사가 앞서갔어요",
      detail: `${rankingChange.beforeRank}위에서 ${rankingChange.afterRank}위가 되었어요. 실패가 아니라 다음 전략을 고를 단서예요.`,
      tone: "warning",
    });
  }

  return highlights.slice(0, 3);
}

function mission(
  id: TurnMissionId,
  emoji: string,
  title: string,
  detail: string,
  progress: string,
  done: boolean,
  destination: MissionDestination,
  actionLabel: string,
): TurnMission {
  return { id, emoji, title, detail, progress, done, destination, actionLabel };
}

function getPlayer(game: GameState) {
  return game.companies.find((company) => company.id === game.playerCompanyId)!;
}

function getRankingSnapshot(game: GameState): RankingSnapshotEntry[] {
  return rankings(game).map((entry, index) => ({
    companyId: entry.companyId,
    name: entry.name,
    netWorth: entry.netWorth,
    rank: index + 1,
    isPlayer: entry.isPlayer,
  }));
}

/** Stable UI-only hash. It never consumes or mutates the simulation RNG. */
function missionScore(seed: number, turn: number, id: TurnMissionId): number {
  let hash = (seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function formatMovementNames(entries: RankingMovementEntry[]): string {
  if (entries.length === 0) return "";
  if (entries.length <= 2) return entries.map((entry) => entry.name).join("·");
  return `${entries[0].name}·${entries[1].name} 외 ${entries.length - 2}곳`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

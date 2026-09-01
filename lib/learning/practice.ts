export const PRACTICE_SEED = 20260901;

export interface PracticeResult {
  demand: number;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
  inventory: number;
}

export interface PracticeState {
  seed: number;
  turn: number;
  maxTurns: number;
  cash: number;
  price: number;
  production: number;
  inventory: number;
  quality: number;
  reputation: number;
  turnsPlayed: number;
  profitableTurns: number;
  lastResult: PracticeResult | null;
}

export type PracticeDecision = Pick<PracticeState, "price" | "production">;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A deterministic 0..1 value. It never reads Math.random or global state. */
export function seededPracticeNoise(seed: number, turn: number): number {
  const x = Math.sin(seed * 0.001 + turn * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function createPracticeState(seed = PRACTICE_SEED): PracticeState {
  return {
    seed,
    turn: 1,
    maxTurns: 3,
    cash: 200,
    price: 10,
    production: 8,
    inventory: 2,
    quality: 50,
    reputation: 50,
    turnsPlayed: 0,
    profitableTurns: 0,
    lastResult: null,
  };
}

export function updatePracticeDecision(
  state: PracticeState,
  decision: Partial<PracticeDecision>,
): PracticeState {
  if (state.turn > state.maxTurns) return state;
  return {
    ...state,
    price: clamp(Math.round(decision.price ?? state.price), 6, 16),
    production: clamp(Math.round(decision.production ?? state.production), 0, 16),
  };
}

export function estimatePracticeDemand(state: PracticeState): number {
  const smallMarketChange = (seededPracticeNoise(state.seed, state.turn) - 0.5) * 2;
  const priceEffect = (10 - state.price) * 1.3;
  const trustEffect = (state.quality + state.reputation - 100) / 20;
  return clamp(Math.round(10 + smallMarketChange + priceEffect + trustEffect), 3, 18);
}

export function advancePracticeTurn(state: PracticeState): PracticeState {
  if (state.turn > state.maxTurns) return state;

  const demand = estimatePracticeDemand(state);
  const available = state.inventory + state.production;
  const sold = Math.min(available, demand);
  const revenue = sold * state.price;
  const cost = state.production * 5 + 12;
  const profit = revenue - cost;
  const inventory = available - sold;

  return {
    ...state,
    turn: state.turn + 1,
    cash: state.cash + profit,
    inventory,
    quality: clamp(state.quality + 1, 0, 100),
    reputation: clamp(state.reputation + (sold >= demand ? 1 : -1), 0, 100),
    turnsPlayed: state.turnsPlayed + 1,
    profitableTurns: state.profitableTurns + (profit >= 0 ? 1 : 0),
    lastResult: { demand, sold, revenue, cost, profit, inventory },
  };
}

export function isPracticeReadyToComplete(state: PracticeState): boolean {
  return state.turnsPlayed >= 2 && state.profitableTurns >= 1;
}

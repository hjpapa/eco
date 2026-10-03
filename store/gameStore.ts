"use client";

import { create } from "zustand";
import {
  acceptQuest as acceptQuestAction,
  advanceTurn,
  checkAchievements,
  claimQuest as claimQuestAction,
  createGame,
  declineQuest as declineQuestAction,
  isFeatureUnlocked,
  planWithOrder,
  resolveDilemma,
  syncQuestProgress,
  type AssetClass,
  type BuildingType,
  type CompanyDecisions,
  type GameLength,
  type GameState,
  type Level,
  type RevealMode,
} from "@/lib/engine";
import {
  buildBuilding,
  buyAsset,
  buyStock,
  emptyCell,
  hireCharacter,
  fireCharacter,
  poachCharacter,
  raiseSalary,
  repayLoan,
  sellAsset,
  sellBuilding,
  sellStock,
  takeLoan,
  upgradeBuilding,
  applyCompanyAction,
  proposeDeal,
} from "@/lib/engine/actions";
import type { TurnSummary } from "@/lib/engine/tick";
import { playSfx } from "@/lib/audio";
import { formatMoney } from "@/lib/format";
import { markLearningIntroSeen } from "@/lib/learning";
import {
  clearGameSaves,
  hasGameSave,
  loadGameFromStorage,
  saveGameToStorage,
} from "@/lib/gamePersistence";
import { getBrowserStorage } from "@/lib/storage";

export { GAME_SAVE_KEY, LEGACY_GAME_SAVE_KEYS } from "@/lib/gamePersistence";

export interface NewGameInput {
  level: Level;
  playerCompanyName: string;
  industryId: string;
  countryId: string;
  logoColor?: string;
  basedOn?: string;
  gameLength?: GameLength;
  revealMode?: RevealMode;
  maxTurns?: number;
  mapSize?: number;
}

interface GameStore {
  game: GameState | null;
  lastSummary: TurnSummary | null;
  toast: { text: string; tone: "good" | "bad" | "info" } | null;

  newGame: (input: NewGameInput) => void;
  loadSave: () => boolean;
  hasSave: () => boolean;
  clearSave: () => void;
  acknowledgeLearningIntro: () => void;

  next: () => void;
  setDecisions: (partial: Partial<CompanyDecisions>) => void;
  build: (type: BuildingType, x?: number, y?: number) => void;
  upgrade: (buildingId: string) => void;
  demolish: (buildingId: string) => void;
  companyAction: (actionId: string) => void;
  proposeDeal: (targetCompanyId: string, dealId: string) => void;
  hire: (characterId: string, overrideSalary?: number, loyaltyBonus?: number) => void;
  fire: (characterId: string) => void;
  poach: (targetCompanyId: string, characterId: string, overrideSalary?: number, loyaltyBonus?: number) => void;
  negotiateSalary: (characterId: string, newSalary: number, miniGameBonus: number) => void;
  tradeStock: (companyId: string, shares: number, side: "buy" | "sell") => boolean;
  tradeAsset: (assetClass: AssetClass, units: number, side: "buy" | "sell") => boolean;
  loan: (amount: number, side: "borrow" | "repay") => void;
  setProductPrice: (index: number, price: number) => void;
  toggleProduct: (index: number) => void;
  acceptQuest: (questId: string) => void;
  declineQuest: (questId: string) => void;
  claimQuest: (questId: string) => void;
  chooseDilemma: (optionIndex: number) => void;
  /** Set the production plan to market demand + the accepted order. */
  planForOrder: () => void;
  dismissToast: () => void;
}

function player(game: GameState) {
  return game.companies.find((c) => c.id === game.playerCompanyId)!;
}

function persist(game: GameState): boolean {
  const storage = getBrowserStorage();
  return storage ? saveGameToStorage(storage, game) : false;
}

/**
 * After any action: finished city requests become claimable and newly earned
 * achievements replace the toast so the student notices them.
 */
function afterAction(game: GameState, toast: { text: string; tone: "good" | "bad" | "info" }) {
  syncQuestProgress(game);
  const earned = checkAchievements(game);
  if (earned.length === 0) return toast;
  playSfx("win");
  const first = earned[0];
  return {
    text: `🏅 업적 달성! ${first.emoji} ${first.title}${earned.length > 1 ? ` 외 ${earned.length - 1}개` : ""}`,
    tone: "good" as const,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  lastSummary: null,
  toast: null,

  newGame: (input) => {
    const game = createGame(input);
    persist(game);
    set({ game, lastSummary: null, toast: null });
  },

  loadSave: () => {
    const storage = getBrowserStorage();
    if (!storage) return false;
    const loaded = loadGameFromStorage(storage);
    if (!loaded) return false;
    // Existing pre-campaign saves should never receive a surprise first-run
    // dialog. Record that fact outside the game save before persisting its
    // normal campaign migration.
    if (loaded.legacyCampaign) markLearningIntroSeen(loaded.game.createdAt);
    set({ game: loaded.game, lastSummary: null });
    return true;
  },

  hasSave: () => {
    const storage = getBrowserStorage();
    return storage ? hasGameSave(storage) : false;
  },

  clearSave: () => {
    const storage = getBrowserStorage();
    if (storage) clearGameSaves(storage);
  },

  acknowledgeLearningIntro: () => {
    const game = get().game;
    if (!game) return;
    markLearningIntroSeen(game.createdAt);
  },

  next: () => {
    const game = get().game;
    if (!game || game.status === "ended") return;
    const summary = advanceTurn(game);
    persist(game);
    if ((game.status as string) === "ended") playSfx("win");
    else playSfx("turn");
    set({ game: { ...game }, lastSummary: summary });
  },

  setDecisions: (partial) => {
    const game = get().game;
    if (!game) return;
    const company = player(game);
    const allowed: Partial<CompanyDecisions> = { ...partial };
    if (!isFeatureUnlocked(game, "research")) {
      delete allowed.rndBudget;
      company.decisions.rndBudget = 0;
    }
    Object.assign(company.decisions, allowed);
    persist(game);
    set({ game: { ...game } });
  },

  build: (type, x, y) => {
    const game = get().game;
    if (!game) return;
    const p = player(game);
    let cell: { x: number; y: number } | null = x != null && y != null ? { x, y } : emptyCell(p, game.config.mapSize);
    if (!cell) return showToast(set, "빈 땅이 없어요.", "bad");
    const res = buildBuilding(game, p, type, cell.x, cell.y);
    if (!res.ok) return showToast(set, res.error ?? "건설 실패", "bad");
    playSfx("build");
    const toast = afterAction(game, { text: res.message ?? "건설 완료!", tone: "good" });
    persist(game);
    set({ game: { ...game }, toast });
  },

  upgrade: (buildingId) => {
    const game = get().game;
    if (!game) return;
    const res = upgradeBuilding(game, player(game), buildingId);
    if (!res.ok) return showToast(set, res.error ?? "업그레이드 실패", "bad");
    playSfx("build");
    const toast = afterAction(game, { text: res.message ?? "업그레이드 완료!", tone: "good" });
    persist(game);
    set({ game: { ...game }, toast });
  },

  demolish: (buildingId) => {
    const game = get().game;
    if (!game) return;
    const res = sellBuilding(game, player(game), buildingId);
    if (!res.ok) return showToast(set, res.error ?? "매각 실패", "bad");
    playSfx("click");
    persist(game);
    set({ game: { ...game }, toast: { text: `건물을 팔았어요 · ${formatMoney(res.refund ?? 0)}원 돌려받음`, tone: "info" } });
  },

  companyAction: (actionId) => {
    const game = get().game;
    if (!game) return;
    const res = applyCompanyAction(game, player(game), actionId);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("click");
    const toast = afterAction(game, { text: res.message ?? "실행 완료!", tone: "good" });
    persist(game);
    set({ game: { ...game }, toast });
  },

  proposeDeal: (targetCompanyId, dealId) => {
    const game = get().game;
    if (!game) return;
    const res = proposeDeal(game, player(game), targetCompanyId, dealId);
    if (!res.ok) return showToast(set, res.error ?? "제안 실패", "bad");
    const succeeded = !res.message?.includes("결렬");
    playSfx(succeeded ? "hire" : "click");
    persist(game);
    set({ game: { ...game }, toast: { text: res.message ?? "교류 성사!", tone: succeeded ? "good" : "info" } });
  },

  hire: (characterId, overrideSalary, loyaltyBonus) => {
    const game = get().game;
    if (!game) return;
    const res = hireCharacter(game, player(game), characterId, overrideSalary, loyaltyBonus);
    if (!res.ok) return showToast(set, res.error ?? "영입 실패", "bad");
    playSfx("hire");
    persist(game);
    const msg = overrideSalary ? "⭐ 전설 인재와 계약했어요!" : "🎉 인재를 뽑았어요!";
    set({ game: { ...game }, toast: { text: msg, tone: "good" } });
  },

  fire: (characterId) => {
    const game = get().game;
    if (!game) return;
    const res = fireCharacter(game, player(game), characterId);
    if (!res.ok) return showToast(set, res.error ?? "해고 실패", "bad");
    playSfx("click");
    persist(game);
    set({ game: { ...game }, toast: { text: "👋 인재를 내보냈어요", tone: "info" } });
  },

  poach: (targetCompanyId, characterId, overrideSalary, loyaltyBonus) => {
    const game = get().game;
    if (!game) return;
    const res = poachCharacter(game, player(game), targetCompanyId, characterId, overrideSalary, loyaltyBonus);
    if (!res.ok) return showToast(set, res.error ?? "스카우트 실패", "bad");
    playSfx("hire");
    persist(game);
    set({ game: { ...game }, toast: { text: res.message ?? "스카우트 성공!", tone: "good" } });
  },

  negotiateSalary: (characterId, newSalary, miniGameBonus) => {
    const game = get().game;
    if (!game) return;
    const res = raiseSalary(game, player(game), characterId, newSalary, miniGameBonus);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("click");
    persist(game);
    set({ game: { ...game }, toast: { text: res.message ?? "💝 급여를 올렸어요!", tone: "good" } });
  },

  tradeStock: (companyId, shares, side) => {
    const game = get().game;
    if (!game) return false;
    const p = player(game);
    const res =
      side === "buy" ? buyStock(game, p, companyId, shares) : sellStock(game, p, companyId, shares);
    if (!res.ok) { showToast(set, res.error ?? "거래 실패", "bad"); return false; }
    playSfx(side === "buy" ? "buy" : "sell");
    // Spread companies array so every subscriber sees new references for the mutated player.
    const companies = game.companies.map((c) => (c.id === p.id ? { ...p, portfolio: { ...p.portfolio, stocks: { ...p.portfolio.stocks }, stockCost: { ...p.portfolio.stockCost } } } : c));
    let text = side === "buy" ? `매수 완료 · 잔고 ${formatMoney(p.cash)}` : "매도 완료";
    if (side === "sell" && res.realized != null) {
      const sign = res.realized >= 0 ? "+" : "−";
      text = `매도 완료 · 실현 ${sign}${formatMoney(Math.abs(res.realized))}`;
    }
    const updated = { ...game, companies };
    const toast = afterAction(updated, { text, tone: "good" });
    persist(updated);
    set({ game: updated, toast });
    return true;
  },

  tradeAsset: (assetClass, units, side) => {
    const game = get().game;
    if (!game) return false;
    const p = player(game);
    const res =
      side === "buy" ? buyAsset(game, p, assetClass, units) : sellAsset(game, p, assetClass, units);
    if (!res.ok) { showToast(set, res.error ?? "거래 실패", "bad"); return false; }
    playSfx(side === "buy" ? "buy" : "sell");
    const companies = game.companies.map((c) => (c.id === p.id ? { ...p, portfolio: { ...p.portfolio, assets: { ...p.portfolio.assets } } } : c));
    const updated = { ...game, companies };
    const toast = afterAction(updated, { text: side === "buy" ? `매수 완료 · 잔고 ${formatMoney(p.cash)}` : "매도 완료", tone: "good" });
    persist(updated);
    set({ game: updated, toast });
    return true;
  },

  loan: (amount, side) => {
    const game = get().game;
    if (!game) return;
    const p = player(game);
    const res = side === "borrow" ? takeLoan(game, p, amount) : repayLoan(game, p, amount);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("click");
    persist(game);
    set({ game: { ...game }, toast: { text: side === "borrow" ? "💳 돈을 빌렸어요" : "✅ 빚을 갚았어요", tone: "good" } });
  },

  setProductPrice: (index, price) => {
    const game = get().game;
    if (!game) return;
    const p = player(game);
    if (!p.productPrices) p.productPrices = [];
    p.productPrices[index] = Math.max(0, price);
    persist(game);
    set({ game: { ...game } });
  },

  toggleProduct: (index) => {
    const game = get().game;
    if (!game) return;
    const p = player(game);
    if (!p.productEnabled) p.productEnabled = [true, false, false, false];
    p.productEnabled = p.productEnabled.map((v, i) => (i === index ? !v : v));
    persist(game);
    set({ game: { ...game } });
  },

  acceptQuest: (questId) => {
    const game = get().game;
    if (!game) return;
    const res = acceptQuestAction(game, questId);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("hire");
    persist(game);
    set({ game: { ...game }, toast: { text: res.message ?? "주문을 받았어요!", tone: "good" } });
  },

  declineQuest: (questId) => {
    const game = get().game;
    if (!game) return;
    const res = declineQuestAction(game, questId);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("click");
    persist(game);
    set({ game: { ...game }, toast: { text: res.message ?? "거절했어요.", tone: "info" } });
  },

  claimQuest: (questId) => {
    const game = get().game;
    if (!game) return;
    const res = claimQuestAction(game, questId);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("sell");
    const toast = afterAction(game, { text: res.message ?? "보상 받기 완료!", tone: "good" });
    persist(game);
    set({ game: { ...game }, toast });
  },

  chooseDilemma: (optionIndex) => {
    const game = get().game;
    if (!game) return;
    const res = resolveDilemma(game, optionIndex);
    if (!res.ok) return showToast(set, res.error ?? "실패", "bad");
    playSfx("click");
    const toast = afterAction(game, { text: res.message ?? "결정했어요!", tone: "good" });
    persist(game);
    set({ game: { ...game }, toast });
  },

  planForOrder: () => {
    const game = get().game;
    if (!game) return;
    const company = player(game);
    const { plan } = planWithOrder(game, company);
    company.decisions.productionTarget = plan;
    persist(game);
    set({ game: { ...game }, toast: { text: `생산 계획을 ${plan.toLocaleString()}개로 맞췄어요`, tone: "info" } });
  },

  dismissToast: () => set({ toast: null }),
}));

function showToast(
  set: (partial: Partial<GameStore>) => void,
  text: string,
  tone: "good" | "bad" | "info",
): void {
  if (tone === "bad") playSfx("bad");
  set({ toast: { text, tone } });
}

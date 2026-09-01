import {
  estimateDemand,
  isFeatureUnlocked,
  playerRank,
  productionCapacity,
  netWorth,
  type GameState,
} from "./engine";
import { getCountry } from "./data/countries";
import { getIndustry } from "./data/industries";

// Rule-based CEO secretary. Inspects the game state and returns prioritised,
// situational advice (warnings, opportunities, tips). Each rule offers several
// phrasings so the secretary doesn't repeat herself turn after turn.

export interface Advice {
  tone: "warn" | "tip" | "good";
  text: string;
}

/** Pick a random phrasing (UI-only; doesn't touch the deterministic game RNG). */
function r(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateAdvice(game: GameState): Advice[] {
  const p = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const industry = getIndustry(p.industryId);
  const country = getCountry(p.countryId);
  const buildingsUnlocked = isFeatureUnlocked(game, "buildingsResearch");
  const investmentUnlocked = isFeatureUnlocked(game, "investment");
  const talentUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const advancedUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");
  const adv = game.config.showAdvancedMetrics && advancedUnlocked;

  const warns: string[] = [];
  const tips: string[] = [];
  const goods: string[] = [];

  const capacity = productionCapacity(p, game.config);
  const demand = estimateDemand(p, industry, country, game.macro, game.config);
  const recent = p.profitHistory.slice(-3);
  const lossStreak = recent.length >= 2 && recent.every((x) => x < 0);
  const profitStreak = recent.length >= 2 && recent.every((x) => x > 0);
  const margin = p.lastRevenue > 0 ? p.lastProfit / p.lastRevenue : 0;
  const unitCost = industry.unitCost * country.laborCost;

  // ===== Warnings (most urgent) =====
  if (p.cash < 80_000) {
    warns.push(advancedUnlocked
      ? r([
          "현금이 거의 바닥났어요! 생산을 줄이거나 대출을 받아 숨통을 틔우세요.",
          "통장이 위험해요. 불필요한 지출을 줄이고 현금을 확보하셔야 해요.",
          "현금이 부족합니다. 보유 자산을 일부 팔아 유동성을 마련하는 건 어떨까요?",
        ])
      : "현금이 부족해요. 생산량과 가격을 조정해 다음 분기 지출을 줄여보세요.");
  }
  if (lossStreak) {
    warns.push(r([
      "여러 분기 연속 적자예요. 판매가가 원가보다 충분히 높은지 점검해 주세요.",
      buildingsUnlocked
        ? "적자가 이어지고 있어요. 마케팅·R&D 예산이 과한지 살펴보면 좋겠어요."
        : "적자가 이어지고 있어요. 생산량과 판매 가격을 다시 살펴보세요.",
      "계속 손해를 보고 있어요. 가격을 올리거나 비용을 줄여 흑자 전환을 노려요.",
    ]));
  }
  if (margin < 0 && p.lastRevenue > 0 && !lossStreak) {
    warns.push(r([
      "이번 분기는 적자예요. 가격이 원가보다 낮지 않은지 확인하세요.",
      "지출이 매출보다 컸어요. 예산을 한 번 조정해 볼 때예요.",
    ]));
  }
  if (adv && p.debt > p.cash * 2) {
    warns.push(r([
      "부채가 너무 많아요. 신용등급 강등 위험이 있으니 일부 상환을 권해요.",
      "빚 부담이 커요. 이자 비용이 이익을 갉아먹고 있어요.",
    ]));
  }
  if (p.safety < 40) {
    warns.push(buildingsUnlocked
      ? r([
          "안전 수준이 낮아요. 안전 예산이나 R&D를 늘리지 않으면 사고가 날 수 있어요.",
          "공장 안전이 걱정돼요. 의무실·안전 투자로 사고를 예방하세요.",
        ])
      : "안전 수준이 낮아요. 당분간 무리하게 생산량을 늘리지 말고 비용을 아껴보세요.");
  }
  if (p.morale < 45) {
    warns.push(buildingsUnlocked
      ? r([
          "직원 사기가 낮아요. 복지 예산을 늘리거나 인사센터를 지어보세요.",
          "사기가 떨어졌어요. 구내식당·헬스장 같은 복지 건물이 도움이 돼요.",
          "직원들이 지쳐 있어요. 복지 활동으로 힘을 북돋아 주세요.",
        ])
      : "직원들이 지쳐 있어요. 무리한 생산을 피하고 회사의 현금을 안정시켜 보세요.");
  }

  // ===== Operational tips =====
  if (p.inventory > demand * 1.5 && demand >= 0) {
    tips.push(r([
      "재고가 많이 쌓였어요. 가격을 낮추거나 마케팅을 늘려 판매를 끌어올려요.",
      "안 팔린 물건이 창고에 가득해요. 생산 목표를 잠시 낮춰도 좋겠어요.",
    ]));
  }
  if (buildingsUnlocked && demand > capacity * 1.2) {
    tips.push(r([
      "수요가 생산 능력을 넘어서요. 공장을 더 지으면 매출을 키울 수 있어요.",
      "물건이 없어서 못 파는 상황이에요. 생산 설비를 늘릴 때예요.",
    ]));
  }
  if (p.decisions.price < unitCost * 1.1 && p.lastRevenue > 0) {
    tips.push(r([
      "판매가가 원가에 너무 가까워요. 가격을 조금 올려 이익률을 높여보세요.",
      "지금 가격으로는 남는 게 적어요. 품질이 받쳐준다면 가격 인상을 고려하세요.",
    ]));
  }
  if (buildingsUnlocked && p.decisions.rndBudget < 8000 && industry.rndDependence > 0.6) {
    tips.push(r([
      `${industry.name}은(는) 기술이 핵심이에요. R&D 투자를 늘려 품질을 끌어올려요.`,
      "연구개발이 부족해요. R&D 예산을 늘리면 품질과 신제품에 도움이 돼요.",
    ]));
  }
  if (buildingsUnlocked && p.quality < 35) {
    tips.push(r([
      "제품 품질이 낮아요. R&D와 연구동 투자로 경쟁력을 키우세요.",
      "품질이 아쉬워요. 기술 투자를 늘리면 더 비싸게 팔 수 있어요.",
    ]));
  }
  if (p.reputation < 40) {
    tips.push(r([
      "평판이 낮아 수요가 줄고 있어요. 마케팅과 사회공헌으로 이미지를 개선해요.",
      "브랜드 평판을 키워야 해요. 꾸준한 마케팅이 도움이 돼요.",
    ]));
  }
  if (buildingsUnlocked && p.buildings.length < 3) {
    tips.push(r([
      "캠퍼스가 아직 작아요. 건물을 더 지어 생산·연구 역량을 키워보세요.",
      "빈 땅이 많아요. 다양한 건물을 지어 회사를 키워봐요.",
    ]));
  }
  if (talentUnlocked && p.hired.length === 0) {
    tips.push(r([
      "아직 영입한 임원이 없어요. 인재 시장에서 능력자를 데려오면 큰 힘이 돼요.",
      "핵심 인재가 없네요. 인재를 영입해 능력치 보너스를 받아보세요.",
    ]));
  }

  // ===== Investment / macro tips =====
  const investedValue = Object.keys(p.portfolio.stocks).length + Object.keys(p.portfolio.assets).length;
  if (investmentUnlocked && p.cash > 600_000 && investedValue === 0) {
    tips.push(r([
      "현금이 놀고 있어요. 주식이나 안전자산에 투자해 돈이 일하게 하세요.",
      "여유 자금이 많아요. 투자 탭에서 분산 투자를 시작해 보세요.",
    ]));
  }
  if (advancedUnlocked && (game.macro.phase === "inflation" || game.macro.phase === "stagflation")) {
    tips.push(r([
      "물가가 오르고 있어요. 금·원자재 같은 인플레이션 방어 자산이 유리할 수 있어요.",
      "인플레이션 국면이에요. 현금만 들고 있으면 가치가 줄어드니 실물자산을 살펴봐요.",
    ]));
  }
  if (advancedUnlocked && (game.macro.phase === "recession" || game.macro.phase === "deflation")) {
    tips.push(r([
      "경기가 위축됐어요. 무리한 확장보다 현금을 지키며 기회를 기다려요.",
      "불황기예요. 싸진 우량주를 조금씩 모아두면 회복기에 빛을 봐요.",
    ]));
  }
  if (advancedUnlocked && investmentUnlocked && game.macro.sentiment < -0.3) {
    tips.push(r([
      "시장이 불안해요. 안전자산(채권·예금)이나 현금 비중을 늘려 위험을 줄이세요.",
      "투자 심리가 얼어붙었어요. 변동성이 큰 자산은 잠시 줄이는 게 안전해요.",
    ]));
  }
  if (adv && game.macro.interestRate > 5) {
    tips.push(r([
      "금리가 높아요. 빚이 있다면 이자 부담이 크니 상환을 우선해요.",
      "고금리 시기엔 예금·채권 같은 안전자산 수익이 쏠쏠해요.",
    ]));
  }

  // ===== Positives =====
  if (advancedUnlocked && investmentUnlocked && game.macro.sentiment > 0.4) {
    goods.push(r([
      "시장 분위기가 아주 좋아요. 성장주 투자 기회를 살펴보세요!",
      "강세장이에요. 좋은 종목에 적극 투자해 볼 만해요.",
    ]));
  }
  if (profitStreak) {
    goods.push(r(buildingsUnlocked && talentUnlocked
      ? [
          "흑자가 이어지고 있어요. 번 돈을 재투자해 더 키워봐요! 📈",
          "실적이 탄탄해요. 이 기세로 설비와 인재에 투자하면 좋겠어요.",
        ]
      : [
          "흑자가 이어지고 있어요. 지금의 가격과 생산 전략을 이어가 보세요! 📈",
          "실적이 탄탄해요. 한 분기씩 결과를 보며 안정적으로 키워봐요.",
        ]));
  }
  if (margin > 0.2) {
    goods.push(r([
      "이익률이 훌륭해요. 가격 전략이 잘 통하고 있어요!",
      "수익성이 아주 좋아요. 지금 전략을 유지하세요.",
    ]));
  }

  // ===== Performance (always one) =====
  if (talentUnlocked) {
    const rank = playerRank(game);
    const total = game.companies.length;
    const turnsLeft = game.maxTurns - game.turn;
    if (rank === 1) {
      goods.push(r([
        `현재 순자산 ${total}개사 중 1위예요! 이대로 유지해봐요. 🏆`,
        "선두를 달리고 있어요! 방심하지 말고 격차를 벌려요. 🏆",
      ]));
    } else if (rank <= 3) {
      tips.push(r([
        `현재 ${rank}위, 선두권이에요. 조금만 더 밀어붙이면 1위도 가능해요!`,
        `${rank}위로 좋은 위치예요. 한 번의 좋은 투자로 역전할 수 있어요.`,
      ]));
    } else {
      tips.push(r([
        `현재 ${rank}위예요. 경영과 투자, 두 마리 토끼를 모두 잡아 순위를 끌어올려요!`,
        `아직 ${rank}위예요. 남은 ${turnsLeft}분기 동안 과감한 전략이 필요해요.`,
      ]));
    }
  } else {
    tips.push(r([
      "지금은 순위보다 가격과 생산량의 균형을 익혀보세요.",
      "한 분기씩 결과를 보고 가격과 생산량을 조금씩 바꾸면 돼요.",
    ]));
  }

  // Prioritise: warnings first, then a couple of tips, then a positive.
  const out: Advice[] = [
    ...warns.slice(0, 2).map((text) => ({ tone: "warn" as const, text })),
    ...shuffle(tips).slice(0, 2).map((text) => ({ tone: "tip" as const, text })),
    ...goods.slice(0, 1).map((text) => ({ tone: "good" as const, text })),
  ];
  // Top up with more tips if we have spare room.
  if (out.length < 4) {
    for (const text of shuffle(tips)) {
      if (out.length >= 4) break;
      if (!out.some((a) => a.text === text)) out.push({ tone: "tip", text });
    }
  }
  return out.slice(0, 5);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

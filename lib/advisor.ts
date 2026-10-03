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
  const researchUnlocked = isFeatureUnlocked(game, "research");
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
          "쓸 돈이 거의 바닥났어요! 만드는 양을 줄이거나 돈을 조금 빌려 버텨 봐요.",
          "통장이 위험해요. 꼭 필요하지 않은 곳에 돈을 쓰지 말아요.",
          "쓸 돈이 부족해요. 사 둔 주식이나 금을 조금 팔아 돈을 마련해 볼까요?",
        ])
      : "쓸 돈이 부족해요. 만드는 양과 가격을 바꿔 다음 턴에 나갈 돈을 줄여 봐요.");
  }
  if (lossStreak) {
    warns.push(r([
      "여러 턴째 손해예요. 파는 값이 만드는 데 드는 돈(원가)보다 충분히 비싼지 확인해 봐요.",
      researchUnlocked
        ? "손해가 이어지고 있어요. 광고비·연구비를 너무 많이 쓰고 있지 않은지 살펴봐요."
        : "손해가 이어지고 있어요. 만드는 양과 파는 값을 다시 살펴봐요.",
      "계속 손해를 보고 있어요. 값을 올리거나 쓰는 돈을 줄여서 이익을 내 봐요.",
    ]));
  }
  if (margin < 0 && p.lastRevenue > 0 && !lossStreak) {
    warns.push(r([
      "이번 턴은 손해예요. 파는 값이 만드는 데 드는 돈(원가)보다 낮지 않은지 확인해요.",
      "쓴 돈이 번 돈보다 많았어요. 돈 쓰는 계획을 다시 세워 봐요.",
    ]));
  }
  if (adv && p.debt > p.cash * 2) {
    warns.push(r([
      "빚이 너무 많아요. 돈이 생기면 조금씩 갚아 나가요.",
      "빚 부담이 커요. 매 턴 내는 이자 때문에 남는 돈이 줄고 있어요.",
    ]));
  }
  if (p.safety < 40) {
    warns.push(researchUnlocked
      ? r([
          "안전 점수가 낮아요. 안전 점검을 하지 않으면 사고가 날 수 있어요.",
          "공장 안전이 걱정돼요. 안전 점검·안전 교육으로 사고를 예방하세요.",
        ])
      : "안전 점수가 낮아요. 당분간 무리하게 많이 만들지 말고 돈을 아껴 봐요.");
  }
  if (p.morale < 45) {
    warns.push(r([
      "직원 행복이 낮아요. 구내식당이나 공원을 지어 보세요. 행복한 직원이 더 많이 만들어요.",
      "직원들이 지쳐 있어요. 구내식당·공원·어린이집 같은 복지 건물이 도움이 돼요.",
      "직원들이 지쳐 있어요. 복지 활동으로 힘을 북돋아 주세요.",
    ]));
  }

  // ===== Operational tips =====
  if (p.inventory > demand * 1.5 && demand >= 0) {
    tips.push(r([
      "창고에 물건이 많이 쌓였어요. 값을 조금 내리거나 광고를 해서 더 팔아 봐요.",
      "안 팔린 물건이 창고에 가득해요. 잠시 덜 만들어도 좋아요.",
    ]));
  }
  if (demand > capacity * 1.2) {
    tips.push(r([
      "사려는 손님이 만들 수 있는 양보다 많아요. 공장을 더 지으면 더 많이 팔 수 있어요.",
      "물건이 없어서 못 파고 있어요. 공장을 늘릴 때예요.",
    ]));
  }
  if (p.decisions.price < unitCost * 1.1 && p.lastRevenue > 0) {
    tips.push(r([
      "파는 값이 만드는 데 드는 돈과 거의 같아요. 값을 조금 올려 한 개에 남는 돈을 늘려 봐요.",
      "지금 가격으로는 남는 게 적어요. 품질이 좋다면 값을 조금 올려 봐요.",
    ]));
  }
  if (researchUnlocked && p.decisions.rndBudget < 8000 && industry.rndDependence > 0.6) {
    tips.push(r([
      `${industry.name} 회사는 기술이 중요해요. 연구를 해서 품질을 올려 봐요.`,
      "연구가 부족해요. 연구비를 쓰면 품질이 오르고 새 물건도 만들 수 있어요.",
    ]));
  }
  if (researchUnlocked && p.quality < 35) {
    tips.push(r([
      "물건 품질이 낮아요. 연구를 하거나 연구소를 지어 품질을 올려 봐요.",
      "품질이 아쉬워요. 연구로 품질을 올리면 더 비싸게 팔 수 있어요.",
    ]));
  }
  if (p.reputation < 40) {
    tips.push(r([
      "평판이 낮아 손님이 줄고 있어요. 광고나 나눔 활동으로 회사 이미지를 좋게 만들어요.",
      "회사 평판을 키워야 해요. 꾸준한 광고가 도움이 돼요.",
    ]));
  }
  if (p.buildings.length < 3) {
    tips.push(r([
      "회사 도시가 아직 작아요. 건물을 더 지어 회사를 키워 봐요.",
      "빈 땅이 많아요. 다양한 건물을 지어 회사를 키워봐요.",
    ]));
  }
  if (talentUnlocked && p.hired.length === 0) {
    tips.push(r([
      "아직 뽑은 인재가 없어요. 인재 시장에서 능력자를 데려오면 큰 힘이 돼요.",
      "인재가 없네요. 인재를 뽑으면 특별한 능력 보너스를 받아요.",
    ]));
  }

  // ===== Investment / macro tips =====
  const investedValue = Object.keys(p.portfolio.stocks).length + Object.keys(p.portfolio.assets).length;
  if (investmentUnlocked && p.cash > 600_000 && investedValue === 0) {
    tips.push(r([
      "돈이 놀고 있어요. 주식이나 예금에 나눠 넣어 돈이 일하게 해 봐요.",
      "남는 돈이 많아요. 투자 탭에서 여러 곳에 나눠 투자해 봐요.",
    ]));
  }
  if (advancedUnlocked && (game.macro.phase === "inflation" || game.macro.phase === "stagflation")) {
    tips.push(r([
      "물건값(물가)이 오르고 있어요. 이럴 땐 금 같은 자산이 값을 지켜 줄 수 있어요.",
      "물건값이 오르는 때예요. 돈만 들고 있으면 살 수 있는 게 줄어드니 금을 살펴봐요.",
    ]));
  }
  if (advancedUnlocked && (game.macro.phase === "recession" || game.macro.phase === "deflation")) {
    tips.push(r([
      "경기가 나빠졌어요. 무리하게 키우기보다 돈을 지키며 기회를 기다려요.",
      "불황이에요. 값이 싸진 튼튼한 회사 주식을 조금씩 사 두면 나중에 오를 수 있어요.",
    ]));
  }
  if (advancedUnlocked && investmentUnlocked && game.macro.sentiment < -0.3) {
    tips.push(r([
      "주식 시장이 불안해요. 예금·채권처럼 안전한 곳에 돈을 더 넣어 봐요.",
      "사람들이 주식 사기를 무서워해요. 값이 크게 오르내리는 주식은 잠시 줄여요.",
    ]));
  }
  if (adv && game.macro.interestRate > 5) {
    tips.push(r([
      "금리(이자율)가 높아요. 빚이 있다면 이자가 많이 나가니 먼저 갚아요.",
      "금리가 높을 땐 예금·채권 이자가 쏠쏠해요.",
    ]));
  }

  // ===== Positives =====
  if (advancedUnlocked && investmentUnlocked && game.macro.sentiment > 0.4) {
    goods.push(r([
      "주식 시장 분위기가 아주 좋아요. 쑥쑥 크는 회사 주식을 살펴봐요!",
      "주식 값이 오르는 때예요. 좋은 회사에 투자해 볼 만해요.",
    ]));
  }
  if (profitStreak) {
    goods.push(r(researchUnlocked && talentUnlocked
      ? [
          "이익이 이어지고 있어요. 번 돈으로 건물을 더 지어 키워 봐요! 📈",
          "회사가 튼튼해요. 이 기세로 공장과 인재에 투자해 봐요.",
        ]
      : [
          "이익이 이어지고 있어요. 지금 가격과 만드는 양을 이어가 봐요! 📈",
          "회사가 튼튼해요. 한 턴씩 결과를 보며 차근차근 키워 봐요.",
        ]));
  }
  if (margin > 0.2) {
    goods.push(r([
      "한 개에 남는 돈이 넉넉해요. 가격을 잘 정했어요!",
      "돈을 아주 잘 벌고 있어요. 지금처럼 해 봐요.",
    ]));
  }

  // ===== Performance (always one) =====
  if (talentUnlocked) {
    const rank = playerRank(game);
    const total = game.companies.length;
    const turnsLeft = game.maxTurns - game.turn;
    if (rank === 1) {
      goods.push(r([
        `회사 전체 재산이 ${total}개 회사 중 1등이에요! 이대로 지켜 봐요. 🏆`,
        "1등을 달리고 있어요! 방심하지 말고 더 앞서 나가요. 🏆",
      ]));
    } else if (rank <= 3) {
      tips.push(r([
        `지금 ${rank}위, 앞쪽이에요. 조금만 더 힘내면 1등도 할 수 있어요!`,
        `${rank}위로 좋은 위치예요. 한 번의 좋은 투자로 역전할 수 있어요.`,
      ]));
    } else {
      tips.push(r([
        `지금 ${rank}위예요. 회사도 키우고 투자도 해서 순위를 올려 봐요!`,
        `아직 ${rank}위예요. 남은 ${turnsLeft}턴 동안 힘껏 도전해 봐요.`,
      ]));
    }
  } else {
    tips.push(r([
      "지금은 순위보다 가격과 생산량의 균형을 익혀보세요.",
      "한 턴씩 결과를 보고 가격과 생산량을 조금씩 바꾸면 돼요.",
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

"use client";

import { useMemo } from "react";
import type { Company, GameState } from "@/lib/engine";
import { isFeatureUnlocked, playerRank } from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getIndustryProducts } from "@/lib/data/products";
import { formatMoney } from "@/lib/format";

interface Item { text: string; tone: "pos" | "neg" | "neu" }

function buildItems(game: GameState, company: Company): Item[] {
  const industry = getIndustry(company.industryId);
  const productDefs = getIndustryProducts(company.industryId);
  const items: Item[] = [];
  const rankingNewsUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const advancedInfoUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");

  // ── 1. 품질 ──────────────────────────────────────────────────────────────
  const q = Math.round(company.quality);
  if (q < 25) {
    items.push({ text: `⚡ 품질 ${q}점 — 소비자들이 제품 완성도에 불만을 제기하고 있습니다`, tone: "neg" });
  } else if (q >= 70) {
    items.push({ text: `⚡ 품질 ${q}점 — 업계 고품질 브랜드로 인정받고 있습니다`, tone: "pos" });
  } else {
    items.push({ text: `⚡ 제품 품질 ${q}점 — 추가 R&D 투자로 경쟁력을 높일 수 있습니다`, tone: "neu" });
  }

  // ── 2. 평판 ──────────────────────────────────────────────────────────────
  const rep = Math.round(company.reputation);
  if (rep < 35) {
    items.push({ text: `💬 소비자 평판 낮음 (${rep}점) — SNS에서 불만 게시물이 늘고 있다는 제보`, tone: "neg" });
  } else if (rep >= 72) {
    items.push({ text: `💬 브랜드 선호도 상승 중 (${rep}점) — 재구매 의사가 높아지고 있습니다`, tone: "pos" });
  } else {
    items.push({ text: `💬 브랜드 인지도 ${rep}점 — 꾸준한 마케팅과 품질 관리가 필요합니다`, tone: "neu" });
  }

  // ── 3. 가격 신호 ─────────────────────────────────────────────────────────
  const priceFactor = company.decisions.price / industry.basePrice;
  if (priceFactor > 1.8) {
    items.push({ text: `💸 판매가(${formatMoney(company.decisions.price)})가 시장 평균의 ${Math.round(priceFactor * 100)}% — 일부 고객이 저가 경쟁사로 이동 중`, tone: "neg" });
  } else if (priceFactor > 1.3) {
    items.push({ text: `💰 프리미엄 가격대 유지 중 — 품질이 뒷받침되면 높은 마진 기대`, tone: "neu" });
  } else if (priceFactor < 0.75) {
    items.push({ text: `💲 저가 전략 운영 중 — 볼륨은 늘지만 수익률이 낮을 수 있습니다`, tone: "neu" });
  } else {
    items.push({ text: `💵 판매가가 시장 평균 수준 — 균형 잡힌 포지셔닝입니다`, tone: "pos" });
  }

  // ── 4. 이익·현금 흐름 ────────────────────────────────────────────────────
  if (company.lastRevenue > 0) {
    const margin = company.lastProfit / company.lastRevenue;
    if (margin < -0.1) {
      items.push({ text: `📉 지난 분기 수익률 ${Math.round(margin * 100)}% — 비용 구조 점검이 필요합니다`, tone: "neg" });
    } else if (margin > 0.3) {
      items.push({ text: `📈 수익률 ${Math.round(margin * 100)}% 달성 — 효율적인 경영이 성과를 내고 있습니다`, tone: "pos" });
    }
  }
  if (company.cash < 100_000) {
    items.push({ text: `⚠️ 현금 보유량이 낮습니다 (${formatMoney(company.cash)}) — 유동성 위기에 주의하세요`, tone: "neg" });
  }

  // ── 5. 직원 사기 ─────────────────────────────────────────────────────────
  const morale = Math.round(company.morale);
  if (morale < 40) {
    items.push({ text: `😟 직원 만족도 ${morale}점 — 핵심 인재 이탈 가능성이 높아지고 있습니다`, tone: "neg" });
  } else if (morale >= 80) {
    items.push({ text: `😊 직원 사기 ${morale}점 — 생산성과 창의성이 높아지고 있습니다`, tone: "pos" });
  }

  // ── 6. 안전 ──────────────────────────────────────────────────────────────
  if (company.safety < 40) {
    items.push({ text: `⚠️ 안전 지수 ${Math.round(company.safety)}점 — 사고 발생 시 평판·비용 피해 위험`, tone: "neg" });
  }

  // ── 7. 거시경제 국면 ─────────────────────────────────────────────────────
  const phaseHints: Record<string, Item> = {
    boom:        { text: "🚀 경기 호황기 — 소비 심리 강세, 매출 확장의 적기입니다", tone: "pos" },
    recession:   { text: "📉 경기 침체기 — 소비가 위축되고 있어 가격 경쟁력이 생존의 열쇠입니다", tone: "neg" },
    inflation:   { text: "🔥 물가(인플레이션)가 빠르게 올라요 — 같은 돈으로 살 수 있는 것이 줄어들어요", tone: "neg" },
    deflation:   { text: "🧊 물가 하락기 — 소비 심리가 위축되어 있습니다. 현금 보유 유리", tone: "neg" },
    stagflation: { text: "🌫️ 스태그플레이션 — 원가 상승 + 수요 위축 이중고, 비용 절감이 최우선", tone: "neg" },
    normal:      { text: "📊 경기 안정기 — 지속적인 성장과 효율화로 경쟁력을 다질 시기", tone: "neu" },
  };
  if (advancedInfoUnlocked && phaseHints[game.macro.phase]) items.push(phaseHints[game.macro.phase]);

  // ── 8. 금리 ──────────────────────────────────────────────────────────────
  const rate = game.macro.interestRate;
  if (advancedInfoUnlocked && rate > 5) {
    items.push({ text: `🏦 돈 빌리는 값(기준금리) ${rate.toFixed(1)}% — 대출 이자 부담이 커지고 예금 이자도 늘 수 있어요`, tone: "neg" });
  } else if (advancedInfoUnlocked && rate < 2) {
    items.push({ text: `🏦 돈 빌리는 값(기준금리) ${rate.toFixed(1)}% — 이자 부담이 낮지만 필요한 만큼만 빌려요`, tone: "pos" });
  }

  // ── 9. 상품 라인업 힌트 ──────────────────────────────────────────────────
  if (company.rndUnlockDone && productDefs[3]) {
    items.push({ text: `🔬 R&D 성과 — ${productDefs[3].name} 출시 가능! 상품 라인업에서 활성화하세요`, tone: "pos" });
  }
  const enabled = company.productEnabled ?? [true, false, false, false];
  const activeCount = enabled.filter(Boolean).length;
  if (activeCount <= 1 && company.quality >= 25 && productDefs[1]) {
    items.push({ text: `📦 품질이 충분히 올랐습니다 — ${productDefs[1].name} 추가 판매로 매출 다각화 가능`, tone: "neu" });
  }

  // ── 10. 순위 힌트 ────────────────────────────────────────────────────────
  if (rankingNewsUnlocked) {
    const rank = playerRank(game);
    const total = game.companies.length;
    if (rank === 1) {
      items.push({ text: `🏆 현재 순위 1위 — 선두를 유지하려면 지속적인 투자와 혁신이 필요합니다`, tone: "pos" });
    } else if (rank > total * 0.7) {
      items.push({ text: `📊 순위 ${rank}위/${total} — 경쟁사와의 격차를 줄이기 위한 전략 변화가 필요합니다`, tone: "neg" });
    } else {
      items.push({ text: `📊 순위 ${rank}위/${total} — 꾸준한 성과로 상위권 진입을 노려보세요`, tone: "neu" });
    }
  }

  // ── 11. 최근 뉴스 (관련 항목) ────────────────────────────────────────────
  const relatedNews = rankingNewsUnlocked ? game.news
    .filter(n =>
      n.tags.some(t =>
        t === company.id || t === company.industryId ||
        t === "macro" || t === "monetary" || t === "rate_hike",
      ),
    )
    .slice(-8)
    .reverse()
    .slice(0, 5) : [];
  for (const n of relatedNews) {
    items.push({ text: `${n.emoji} ${n.title}`, tone: n.tone === "positive" ? "pos" : n.tone === "negative" ? "neg" : "neu" });
  }

  return items;
}

export function CompanyTicker({ game, company }: { game: GameState; company: Company }) {
  const items = useMemo(() => buildItems(game, company), [game.turn, company.quality, company.reputation, company.morale, company.cash, game.macro.phase]);

  if (items.length === 0) return null;

  // Duplicate so the scroll loops seamlessly
  const all = [...items, ...items];

  return (
    <div
      className="relative overflow-hidden border-b border-slate-100"
      style={{ background: "#0f172a", height: 34 }}
    >
      <div className="flex h-full items-center animate-ticker whitespace-nowrap" style={{ width: "max-content" }}>
        {all.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-0">
            <span
              className="px-4 text-xs font-medium"
              style={{
                color: item.tone === "pos" ? "#4ade80" : item.tone === "neg" ? "#f87171" : "#94a3b8",
              }}
            >
              {item.text}
            </span>
            <span className="text-slate-700 text-xs">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

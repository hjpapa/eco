"use client";

import { getFeatureUnlockTurn, isFeatureUnlocked, type Company, type GameState } from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { formatMoney } from "@/lib/format";
import { Bar } from "./Sparkline";
import { Term } from "./Term";
import { useState } from "react";

export function CompanyStatusCard({ game, company }: { game: GameState; company: Company }) {
  const [open, setOpen] = useState(true);
  const industry = getIndustry(company.industryId);
  const advancedInfoUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-lg">{industry.emoji}</span>
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-700">{company.name}</div>
          <div className="text-[10px] text-slate-500">
            현금 {formatMoney(company.cash)}
            {company.lastProfit !== 0 && (
              <span className={company.lastProfit > 0 ? "text-bull" : "text-bear"}>
                {" "}({company.lastProfit > 0 ? "+" : ""}{formatMoney(company.lastProfit)})
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-slate-100 px-4 py-3">
          <StatMini label={<Term term="품질">품질</Term>} value={company.quality} color="#6366f1" />
          <StatMini label={<Term term="평판" />} value={company.reputation} color="#0ea5e9" />
          <StatMini label={<Term term="사기">직원 사기</Term>} value={company.morale} color="#16a34a" />
          <StatMini label={<Term term="안전" />} value={company.safety} color="#f59e0b"
            warn={company.safety < 40 ? "⚠ 낮음" : undefined} />
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>재고 {company.inventory.toLocaleString()}개</span>
            {advancedInfoUnlocked
              ? <span><Term term="부채">갚을 돈(부채)</Term> {formatMoney(company.debt)}</span>
              : <span>🔒 돈 관리는 {getFeatureUnlockTurn(game.gameLength, "visitsPartnershipsAdvanced")}분기</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({
  label, value, color, warn,
}: { label: React.ReactNode; value: number; color: string; warn?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className="text-[10px] font-semibold text-slate-700">
          {Math.round(value)}
          {warn && <span className="ml-1 text-amber-500">{warn}</span>}
        </span>
      </div>
      <Bar value={value} color={color} />
    </div>
  );
}

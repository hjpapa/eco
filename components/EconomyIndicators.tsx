"use client";

import { PHASE_EMOJI, PHASE_LABELS } from "@/lib/engine";
import type { GameState } from "@/lib/engine";
import { getCountry } from "@/lib/data/countries";
import { getInflationDisplay } from "@/lib/ui/economyIndicators";
import { Term } from "./Term";
import { ASSET_ICONS, ECONOMY_ICONS, PHASE_ICONS } from "@/lib/assetMap";

export function EconomyIndicators({ game }: { game: GameState }) {
  const m = game.macro;
  const country = getCountry(
    game.companies.find((c) => c.id === game.playerCompanyId)!.countryId,
  );
  const sentimentPct = Math.round((m.sentiment + 1) * 50);
  const fx = game.assets.fx;
  const inflationDisplay = getInflationDisplay(m.inflation);

  return (
    <div className="card p-4">
      <h3 className="text-base font-bold text-slate-800">🌍 세상의 돈 흐름</h3>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
        숫자를 외우지 않아도 괜찮아요. 아래의 쉬운 뜻을 보고 이번 분기 결정을 생각해 보세요.
      </p>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
        {PHASE_ICONS[m.phase] ? (
          <img src={PHASE_ICONS[m.phase]} alt={m.phase} className="h-9 w-9 object-contain" />
        ) : (
          <span className="text-3xl">{PHASE_EMOJI[m.phase]}</span>
        )}
        <div>
          <div className="font-bold text-slate-800">{PHASE_LABELS[m.phase]}</div>
          <div className="text-xs text-slate-500">현재 경제 국면</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric icon={ECONOMY_ICONS.gdp} term="GDP 성장률" label="경제 성장(GDP)" value={`${m.gdpGrowth.toFixed(1)}%`} hint={m.gdpGrowth >= 0 ? "경제가 커지고 있어요" : "경제가 잠시 줄고 있어요"} />
        <Metric icon={ECONOMY_ICONS.inflation} term={inflationDisplay.term} label={inflationDisplay.label} value={`${m.inflation.toFixed(1)}%`} hint={inflationDisplay.hint} />
        <Metric icon={ECONOMY_ICONS.rate} term="기준금리" label="돈 빌리는 값(기준금리)" value={`${m.interestRate.toFixed(2)}%`} hint="오르면 대출·예금 이자도 커져요" />
        <Metric icon={ECONOMY_ICONS.sentiment} term="시장 심리" label="사람들의 기대(시장 심리)" value={`${sentimentPct}점`} hint={sentimentPct >= 50 ? "좋아질 거라고 보는 사람이 많아요" : "조심하려는 사람이 많아요"} />
        {game.config.enabledAssets.includes("fx") && fx ? (
          <Metric icon={ASSET_ICONS.fx} term="환율" label="다른 나라 돈값(환율 지수)" value={`${fx.price.toFixed(1)}`} hint="100에서 시작해요. 오르면 달러가 비싸진 뜻이에요" />
        ) : null}
      </div>
      <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
        💡 <b>{country.centralBank}</b>이 기준금리를 바꾸면 빚의 이자와 예금 수익도 함께 달라질 수 있어요.
      </div>
    </div>
  );
}

function Metric({ icon, term, label, value, hint }: { icon?: string; term: string; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
        {icon && <img src={icon} alt="" className="h-4 w-4 object-contain" />}
        <Term term={term}>{label}</Term>
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

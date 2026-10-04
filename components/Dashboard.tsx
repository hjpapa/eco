"use client";

import {
  netWorth,
  playerRank,
  portfolioValue,
  fundamentalValue,
  getFeatureUnlockTurn,
  isFeatureUnlocked,
  stockMetrics,
  type GameState,
} from "@/lib/engine";
import { getIndustry } from "@/lib/data/industries";
import { getCountry } from "@/lib/data/countries";
import { formatMoney, formatNum, changePct, formatPct } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { CompanyCity } from "./CompanyCity";
import { CampusStrip } from "./CampusStrip";
import { Term } from "./Term";
import { FINANCE_ICONS, FACT_ICONS } from "@/lib/assetMap";
import { MountainJourney } from "./MountainJourney";
import { TurnMissionCard } from "./TurnMissionCard";
import { RivalChase } from "./RivalChase";
import type { MissionDestination } from "@/lib/ui/gameExperience";

export function Dashboard({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (destination: MissionDestination) => void;
}) {
  const p = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const nw = netWorth(p, game);
  const rank = playerRank(game);
  const ind = getIndustry(p.industryId);
  const ctry = getCountry(p.countryId);
  const hist = p.netWorthHistory;
  const nwChange = changePct(nw, hist[hist.length - 2] ?? nw);
  const rankingUnlocked = isFeatureUnlocked(game, "talentNewsRanking");
  const advancedInfoUnlocked = isFeatureUnlocked(game, "visitsPartnershipsAdvanced");

  return (
    <div className="space-y-4">
      <MountainJourney game={game} />

      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-indigo-500 p-5 text-white">
          {/* Company skyline backdrop */}
          <CampusStrip
            buildings={p.buildings}
            className="absolute inset-x-0 bottom-0 h-20"
            opacity={0.22}
          />
          <div className="relative flex items-center gap-2 text-sm opacity-90">
            <span className="h-6 w-6 rounded" style={{ background: p.logoColor }} />
            {p.name}
            <span className="pill bg-white/20">{ctry.flag} {ind.emoji} {ind.name}</span>
            {p.basedOn && <span className="pill bg-white/20">모티브</span>}
          </div>
          <div className="mt-3 text-xs uppercase tracking-wide opacity-80">내 총재산 (<Term term="순자산" />)</div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-black">{formatMoney(nw)}</div>
            <div className={`mb-1 text-sm font-bold ${nwChange >= 0 ? "text-green-200" : "text-red-200"}`}>
              {formatPct(nwChange)}
            </div>
          </div>
          <div className="mt-2">
            <Sparkline data={hist.slice(-24)} width={260} height={40} stroke="#ffffff" />
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
          <Cell label={<>내 순위 (<Term term="순위" />)</>} value={rankingUnlocked ? `${rank}위 / ${game.companies.length}` : "🔒 아직 비공개"} />
          <Cell icon={FINANCE_ICONS.cash}         label={<>쓸 수 있는 돈 (<Term term="현금" />)</>} value={formatMoney(p.cash)} />
          <Cell icon={FINANCE_ICONS.companyValue} label={<>회사 가치 (<Term term="기업가치" />)</>} value={formatMoney(fundamentalValue(p))} />
          <Cell icon={FINANCE_ICONS.portfolio}    label={<>투자한 돈 (<Term term="투자자산" />)</>} value={formatMoney(portfolioValue(p, game))} />
        </div>
      </div>

      <TurnMissionCard game={game} onNavigate={onNavigate} />

      {rankingUnlocked ? <RivalChase game={game} /> : null}

      {/* Our stock */}
      <OurStock game={game} showExpert={advancedInfoUnlocked} />
      {!advancedInfoUnlocked && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-200">
          🔒 전문가용 회사 정보는 {getFeatureUnlockTurn(game.gameLength, "visitsPartnershipsAdvanced")}턴에 열려요.
        </div>
      )}

      {/* Living campus overview */}
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">🏙️ 우리 회사 전경</h3>
          <span className="text-xs text-slate-400">드래그로 둘러보기</span>
        </div>
        <CompanyCity game={game} company={p} readOnly overview />
      </div>

      {/* Quick facts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label={<Term term="매출">지난 매출</Term>} value={formatMoney(p.lastRevenue)} icon={FACT_ICONS.revenue} />
        <Mini label={<Term term="이익">지난 이익</Term>} value={formatMoney(p.lastProfit)} icon={FACT_ICONS.profit} />
        <Mini label="건물" value={`${p.buildings.length}개`} icon={FACT_ICONS.buildings} />
        <Mini label="임원" value={`${p.hired.length}명`} icon={FACT_ICONS.staff} />
      </div>
    </div>
  );
}

function OurStock({ game, showExpert }: { game: GameState; showExpert: boolean }) {
  const p = game.companies.find((c) => c.id === game.playerCompanyId)!;
  const stock = game.stocks[p.id];
  if (!stock) return null;
  const ch = changePct(stock.price, stock.history[stock.history.length - 2] ?? stock.price);
  const cap = stock.price * stock.sharesOutstanding;
  const m = stockMetrics(stock, p);
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <img src="/assets/icons/stock.png" alt="" className="h-5 w-5 object-contain" />
          우리 회사 <Term term="주가" />
        </h3>
        <div className="text-right">
          <div className="text-lg font-black text-slate-800">{formatNum(stock.price)}</div>
          <div className={`text-xs font-bold ${ch >= 0 ? "text-bull" : "text-bear"}`}>{formatPct(ch)}</div>
        </div>
      </div>
      <Sparkline data={stock.history.slice(-24)} width={280} height={36} />
      {showExpert && (
        <details className="group mt-3 rounded-xl bg-slate-50 p-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-bold text-slate-600">
            전문가 회사 정보 보기 (PER·PBR·ROE)
            <span className="ml-auto transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white p-2">
              <div className="text-slate-500"><Term term="시가총액">시가총액</Term></div>
              <div className="font-bold text-slate-800">{formatMoney(cap)}</div>
            </div>
            <div className="rounded-lg bg-white p-2">
              <div className="text-slate-500"><Term term="PER" /></div>
              <div className="font-bold text-slate-800">{m.per != null ? m.per.toFixed(1) : "—"}</div>
            </div>
            <div className="rounded-lg bg-white p-2">
              <div className="text-slate-500"><Term term="PBR" /></div>
              <div className="font-bold text-slate-800">{m.pbr != null ? m.pbr.toFixed(2) : "—"}</div>
            </div>
            <div className="rounded-lg bg-white p-2">
              <div className="text-slate-500"><Term term="ROE" /></div>
              <div className="font-bold text-slate-800">{m.roe != null ? m.roe.toFixed(1) + "%" : "—"}</div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function Cell({ icon, label, value }: { icon?: string; label: React.ReactNode; value: string }) {
  return (
    <div className="p-3 text-center">
      {icon && <img src={icon} alt="" className="mx-auto mb-1 h-5 w-5 object-contain" />}
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Mini({ label, value, icon, emoji }: { label: React.ReactNode; value: string; icon?: string; emoji?: string }) {
  return (
    <div className="card flex items-center gap-2 p-3">
      {icon
        ? <img src={icon} alt="" className="h-8 w-8 shrink-0 object-contain" />
        : <span className="text-xl">{emoji}</span>
      }
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

"use client";

import {
  ACHIEVEMENTS,
  BUILDINGS,
  getDilemma,
  openQuests,
  orderRemaining,
  planWithOrder,
  questProgress,
  type BuildingType,
  type Company,
  type GameState,
  type Quest,
} from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";

const won = (n: number) => `${formatMoney(Math.round(n))}원`;

function rewardText(quest: Quest): string {
  const parts = [`💰 ${won(quest.reward.cash)}`];
  if (quest.reward.reputation) parts.push(`⭐ 평판 +${quest.reward.reputation}`);
  if (quest.reward.morale) parts.push(`😊 행복 +${quest.reward.morale}`);
  return parts.join(" · ");
}

function turnsLeftText(game: GameState, quest: Quest): string {
  const left = quest.deadlineTurn - game.turn;
  if (quest.status === "offered") return "이번 턴에만 받을 수 있어요";
  if (left <= 0) return "이번 턴이 마지막!";
  return left === 1 ? "⏰ 이번 턴이 마지막 기회!" : `⏳ ${left}턴 남았어요`;
}

function Progress({ ratio, tone }: { ratio: number; tone: "amber" | "sky" | "emerald" }) {
  const color = tone === "amber" ? "bg-amber-500" : tone === "sky" ? "bg-sky-500" : "bg-emerald-500";
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-black/5" aria-hidden>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.round(Math.min(1, ratio) * 100)}%` }} />
    </div>
  );
}

/** 📜 의뢰 게시판: orders, city requests and the pending choice card. */
export function QuestBoard({
  game,
  company,
  onGoBuild,
  onGoProduction,
  layout = "row",
}: {
  game: GameState;
  company: Company;
  onGoBuild: (type?: BuildingType) => void;
  onGoProduction: () => void;
  /** "stack" = one card per row inside the side panel. */
  layout?: "row" | "stack";
}) {
  const quests = openQuests(game);
  const dilemma = game.dilemma ? getDilemma(game.dilemma.id) : undefined;
  const stack = layout === "stack";
  if (quests.length === 0 && !dilemma) {
    return (
      <section className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-4 text-base text-amber-900" aria-label="의뢰 게시판">
        📜 지금은 새 의뢰가 없어요. 다음 턴에 손님과 시장님이 찾아올 거예요!
      </section>
    );
  }
  return (
    <section aria-labelledby="quest-board-title">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 id="quest-board-title" className={stack ? "sr-only" : "text-base font-black text-slate-900"}>
          📜 의뢰 게시판
        </h2>
        <span className="text-sm font-bold text-slate-500">의뢰를 해결하면 보상을 받아요 🎁</span>
      </div>
      <div className={stack ? "quest-stack grid gap-3" : "-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 scroll-thin md:grid md:grid-cols-3 md:overflow-visible"}>
        {quests.map((quest) =>
          quest.kind === "order" ? (
            <OrderCard key={quest.id} game={game} company={company} quest={quest} onGoProduction={onGoProduction} />
          ) : (
            <CityCard key={quest.id} game={game} quest={quest} onGoBuild={onGoBuild} />
          ),
        )}
        {dilemma && <DilemmaCard game={game} company={company} />}
      </div>
    </section>
  );
}

function CardShell({ tone, children, label }: { tone: "amber" | "sky" | "violet" | "emerald"; children: React.ReactNode; label: string }) {
  const style = {
    amber: "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50",
    sky: "border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50",
    violet: "border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50",
    emerald: "quest-ready border-emerald-400 bg-gradient-to-br from-emerald-50 to-lime-50",
  }[tone];
  return (
    <article
      aria-label={label}
      className={`quest-card flex min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl border-2 p-3 shadow-sm md:min-w-0 md:max-w-none ${style}`}
    >
      {children}
    </article>
  );
}

function OrderCard({
  game,
  company,
  quest,
  onGoProduction,
}: {
  game: GameState;
  company: Company;
  quest: Quest;
  onGoProduction: () => void;
}) {
  const accept = useGameStore((s) => s.acceptQuest);
  const decline = useGameStore((s) => s.declineQuest);
  const claim = useGameStore((s) => s.claimQuest);
  const planForOrder = useGameStore((s) => s.planForOrder);
  const progress = questProgress(game, quest);
  const plan = planWithOrder(game, company);
  const turnsToGo = Math.max(1, quest.deadlineTurn - game.turn);
  const impossible = plan.capacity * turnsToGo < orderRemaining(quest);
  const squeezesCustomers = plan.capacity < plan.demand + Math.ceil(orderRemaining(quest) / turnsToGo);
  const ready = quest.status === "ready";
  const planned = company.decisions.productionTarget >= plan.plan;

  return (
    <CardShell tone={ready ? "emerald" : "amber"} label={`주문 의뢰: ${quest.title}`}>
      <div className="flex items-start gap-2">
        <span className="text-3xl leading-none" aria-hidden>{quest.clientEmoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-amber-700">📦 주문 · {quest.client}</div>
          <h3 className="font-black leading-tight text-slate-900">{quest.title}</h3>
        </div>
      </div>
      <p className="mt-1 text-sm leading-snug text-slate-700">{quest.detail}</p>
      <div className="mt-1.5 text-sm font-bold text-slate-600">
        완료 보너스 {rewardText(quest)}
      </div>
      {quest.status !== "offered" && <Progress ratio={progress.ratio} tone="amber" />}
      <div className="mt-1 flex justify-between text-sm font-bold text-slate-600">
        <span>{quest.status === "offered" ? `개당 ${won(quest.unitPrice ?? 0)}` : progress.label}</span>
        <span>{ready ? "🎉 배달 완료!" : turnsLeftText(game, quest)}</span>
      </div>
      {quest.status === "offered" && impossible && (
        <p className="mt-1.5 rounded-lg bg-white/80 p-1.5 text-sm text-rose-700">
          ⚠️ 지금 공장으로는 기한 안에 다 못 만들어요. 공장을 더 지으면 할 수 있어요!
        </p>
      )}
      {quest.status === "offered" && !impossible && squeezesCustomers && (
        <p className="mt-1.5 rounded-lg bg-white/80 p-1.5 text-sm text-amber-800">
          💡 주문 몫을 먼저 보내면 손님에게 팔 상품이 조금 줄어요. 어느 쪽이 더 이득일까요? (기회비용)
        </p>
      )}
      <div className="mt-auto pt-2">
        {quest.status === "offered" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" className="btn-primary !py-2 text-sm" onClick={() => accept(quest.id)}>
              ✅ 주문 받기
            </button>
            <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => decline(quest.id)}>
              거절
            </button>
          </div>
        )}
        {quest.status === "active" && (
          <div className="grid gap-1.5">
            <button
              type="button"
              className={`${planned ? "btn-ghost" : "btn-primary"} !py-2 text-sm`}
              onClick={() => {
                planForOrder();
                onGoProduction();
              }}
            >
              {planned ? "✓ 주문 몫까지 만들기로 했어요" : `🏭 주문 몫까지 만들기 (${plan.plan.toLocaleString()}개)`}
            </button>
            <p className="text-xs text-slate-500">
              손님 {plan.demand.toLocaleString()} + 주문 {orderRemaining(quest).toLocaleString()} · 최대 {plan.capacity.toLocaleString()}개까지 만들 수 있어요
            </p>
          </div>
        )}
        {ready && (
          <button type="button" className="btn-bull w-full !bg-emerald-600 !py-2 text-sm" onClick={() => claim(quest.id)}>
            🎁 보너스 받기 +{won(quest.reward.cash)}
          </button>
        )}
      </div>
    </CardShell>
  );
}

function CityCard({ game, quest, onGoBuild }: { game: GameState; quest: Quest; onGoBuild: (type?: BuildingType) => void }) {
  const claim = useGameStore((s) => s.claimQuest);
  const progress = questProgress(game, quest);
  const ready = quest.status === "ready" || progress.ratio >= 1;
  const kindLabel = quest.kind === "build" ? "🏗️ 건설 요청" : quest.kind === "combo" ? "🧩 조합 요청" : quest.kind === "upgrade" ? "⬆️ 업그레이드 요청" : "🏙️ 도시 성장 요청";
  return (
    <CardShell tone={ready ? "emerald" : "sky"} label={`도시 요청: ${quest.title}`}>
      <div className="flex items-start gap-2">
        <span className="text-3xl leading-none" aria-hidden>{quest.clientEmoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-sky-700">{kindLabel} · {quest.client}</div>
          <h3 className="font-black leading-tight text-slate-900">{quest.title}</h3>
        </div>
      </div>
      <p className="mt-1 text-sm leading-snug text-slate-700">{quest.detail}</p>
      <div className="mt-1.5 text-sm font-bold text-slate-600">보상 {rewardText(quest)}</div>
      <Progress ratio={progress.ratio} tone="sky" />
      <div className="mt-1 flex justify-between text-sm font-bold text-slate-600">
        <span>{progress.label}</span>
        <span>{ready ? "🎉 완성!" : turnsLeftText(game, quest)}</span>
      </div>
      <div className="mt-auto pt-2">
        {ready ? (
          <button type="button" className="btn-bull w-full !bg-emerald-600 !py-2 text-sm" onClick={() => claim(quest.id)}>
            🎁 보상 받기 +{won(quest.reward.cash)}
          </button>
        ) : (
          <button type="button" className="btn-primary w-full !py-2 text-sm" onClick={() => onGoBuild(quest.buildingType)}>
            {quest.kind === "build" && quest.buildingType
              ? `${BUILDINGS[quest.buildingType].emoji} 지으러 가기`
              : "🏗️ 건설하러 가기"}
          </button>
        )}
      </div>
    </CardShell>
  );
}

function DilemmaCard({ game, company }: { game: GameState; company: Company }) {
  const choose = useGameStore((s) => s.chooseDilemma);
  const def = game.dilemma ? getDilemma(game.dilemma.id) : undefined;
  if (!def) return null;
  const left = 2 - (game.turn - (game.dilemma?.postedTurn ?? game.turn));
  return (
    <CardShell tone="violet" label={`사장님의 선택: ${def.title}`}>
      <div className="flex items-start gap-2">
        <span className="text-3xl leading-none" aria-hidden>{def.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-violet-700">🤔 사장님의 선택</div>
          <h3 className="font-black leading-tight text-slate-900">{def.title}</h3>
        </div>
      </div>
      <p className="mt-1 text-sm leading-snug text-slate-700">{def.body}</p>
      <div className="mt-auto grid gap-1.5 pt-2">
        {def.options.map((option, index) => {
          const short = company.cash < option.cost;
          return (
            <button
              key={option.label}
              type="button"
              disabled={short}
              onClick={() => choose(index)}
              className="rounded-xl bg-white px-3 py-2 text-left text-sm ring-1 ring-violet-200 transition hover:ring-violet-400 disabled:opacity-50"
            >
              <span className="font-black text-slate-900">
                {option.emoji} {option.label}
              </span>
              <span className="mt-0.5 block text-sm text-slate-600">
                {option.cost > 0 ? `💸 ${won(option.cost)} · ` : "💸 0원 · "}
                {option.effect}
                {short ? " · 돈이 부족해요" : ""}
              </span>
            </button>
          );
        })}
        <p className="text-xs text-slate-500">{left <= 1 ? "이번 턴에 고르지 않으면 기회가 사라져요" : "다음 턴까지 고를 수 있어요"}</p>
      </div>
    </CardShell>
  );
}

/** Production hint shown in the 생산 task when an order is in progress. */
export function OrderPlanner({ game, company }: { game: GameState; company: Company }) {
  const planForOrder = useGameStore((s) => s.planForOrder);
  const quest = openQuests(game).find((q) => q.kind === "order" && q.status === "active");
  if (!quest) return null;
  const plan = planWithOrder(game, company);
  const short = plan.capacity < plan.demand + orderRemaining(quest);
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950 ring-1 ring-amber-300">
      <b>
        📦 {quest.client} 주문 {orderRemaining(quest).toLocaleString()}개 남음
      </b>
      <p className="mt-1">
        손님 예상 {plan.demand.toLocaleString()}개 + 주문 {orderRemaining(quest).toLocaleString()}개
        {company.inventory > 0 ? ` − 창고 재고 ${Math.round(company.inventory).toLocaleString()}개` : ""} = 필요{" "}
        <b>{plan.plan.toLocaleString()}개</b> (최대 {plan.capacity.toLocaleString()}개까지 만들 수 있어요)
      </p>
      {short && (
        <p className="mt-1 text-amber-800">
          💡 다 만들 수 없으면 주문 몫을 먼저 보내고 남은 만큼만 손님에게 팔아요. 공장을 더 지으면 둘 다 챙길 수 있어요.
        </p>
      )}
      <button type="button" className="btn-primary mt-2 w-full !py-2 text-sm" onClick={planForOrder}>
        🏭 {plan.plan.toLocaleString()}개 만들기로 정하기
      </button>
    </div>
  );
}

/** 🏅 업적 선반: earned badges in colour, locked ones as hints. */
export function AchievementShelf({ game }: { game: GameState }) {
  const earned = new Map((game.achievements ?? []).map((a) => [a.id, a.turn]));
  return (
    <details className="card group p-4" id="achievement-shelf">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-black text-slate-800">
        🏅 업적 {earned.size} / {ACHIEVEMENTS.length}
        <span className="text-xs font-bold text-slate-500">모아서 최고의 사장님이 되어 봐요</span>
        <span className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ACHIEVEMENTS.map((def) => {
          const turn = earned.get(def.id);
          const got = turn != null;
          return (
            <div
              key={def.id}
              className={`flex flex-col items-center rounded-xl p-2 text-center ring-1 ${got ? "bg-amber-50 ring-amber-300" : "bg-slate-50 ring-slate-200"}`}
              title={def.hint}
            >
              <span className={`text-2xl ${got ? "" : "opacity-30 grayscale"}`} aria-hidden>{def.emoji}</span>
              <span className={`mt-0.5 text-sm font-black leading-tight ${got ? "text-slate-900" : "text-slate-400"}`}>{def.title}</span>
              <span className="mt-0.5 text-xs leading-tight text-slate-500">{got ? `${turn}턴 달성` : def.hint}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

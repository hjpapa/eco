import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, BUILDINGS } from "../engine";
import { useGameStore } from "../../store/gameStore";
import { decorCategory } from "./cityBuilder";

vi.mock("../audio", () => ({ playSfx: vi.fn(), haptic: vi.fn() }));

function start() {
  const game = createGame({ level: "elementary", seed: 29, playerCompanyName: "되돌리기", industryId: "food", countryId: "kr", revealMode: "all" });
  useGameStore.setState({ game, buildUndo: null, toast: null, lastSummary: null });
  return game;
}

beforeEach(() => start());

describe("마지막 배치 되돌리기", () => {
  it.each(["grass", "factory"] as const)("%s 비용·생산 계획·의뢰·업적·스티커를 배치 전으로 복원한다", (type) => {
    const before = structuredClone(useGameStore.getState().game!);
    useGameStore.getState().build(type, 0, 0);
    const store = useGameStore.getState();
    expect(store.buildUndo).not.toBeNull();
    expect(store.game!.companies[0].buildings.length).toBe(before.companies[0].buildings.length + 1);
    store.undoBuild();
    expect(useGameStore.getState().game).toEqual(before);
    expect(useGameStore.getState().buildUndo).toBeNull();
    useGameStore.getState().undoBuild();
    expect(useGameStore.getState().game).toEqual(before);
  });

  it("여러 번 배치하면 가장 최근 것만 취소하며 실패한 배치는 기록을 덮지 않는다", () => {
    useGameStore.getState().build("grass", 0, 0);
    const first = structuredClone(useGameStore.getState().game);
    useGameStore.getState().build("clover", 1, 0);
    useGameStore.getState().build("pinetree", 1, 0);
    useGameStore.getState().undoBuild();
    expect(useGameStore.getState().game).toEqual(first);
  });

  it.each(["decision", "turn", "sale", "move"] as const)("다른 행동 %s 후에는 취소로 이전 상태를 덮어쓰지 않는다", (action) => {
    useGameStore.getState().build("grass", 0, 0);
    const store = useGameStore.getState();
    const building = store.game!.companies.find((c) => c.id === store.game!.playerCompanyId)!.buildings.find((b) => b.type === "grass")!;
    if (action === "decision") store.setDecisions({ productionTarget: 100 });
    if (action === "turn") store.next();
    if (action === "sale") store.demolish(building.id);
    if (action === "move") store.move(building.id, 1, 0);
    expect(useGameStore.getState().buildUndo).toBeNull();
    const after = structuredClone(useGameStore.getState().game);
    store.undoBuild();
    expect(useGameStore.getState().game).toEqual(after);
  });

  it("메뉴·알림을 닫아도 되돌리기는 유지된다", () => {
    useGameStore.getState().build("grass", 0, 0);
    useGameStore.getState().dismissToast();
    expect(useGameStore.getState().buildUndo?.type).toBe("grass");
  });
});

describe("꾸미기 분류", () => {
  it("바닥·식물·소품에 모든 꾸미기가 한 번씩 분류된다", () => {
    for (const def of Object.values(BUILDINGS)) {
      expect(decorCategory(def.type) !== null).toBe(Boolean(def.decor));
    }
    expect(decorCategory("grass")).toBe("ground");
    expect(decorCategory("clover")).toBe("ground");
    for (const type of ["flowerbed", "bigtree", "pinetree", "birchtree", "cherrytree"] as const) expect(decorCategory(type)).toBe("plants");
    expect(decorCategory("bench")).toBe("props");
    expect(decorCategory("snowman")).toBe("props");
  });
});

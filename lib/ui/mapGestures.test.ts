import { describe, expect, it } from "vitest";
import { constrainMap, fitReadableMap, readableMapSize, INITIAL_MAP_VIEW, MapGesture, zoomMap } from "./mapGestures";

describe("지도 터치 조작", () => {
  it("작은 화면에서도 글자와 터치 칸은 줄이지 않고 모든 가장자리로 이동할 수 있다", () => {
    for (const cells of [5, 8, 12]) {
      const size = readableMapSize(cells);
      expect((size - 16 - (cells - 1) * 4) / cells).toBeGreaterThanOrEqual(80);
      const view = fitReadableMap({ scale: 0.6, x: 0, y: 0 }, 320, 360, size);
      expect(view.scale).toBe(1);
      const edge = fitReadableMap({ scale: 1, x: 9999, y: 9999 }, 320, 360, size);
      expect(edge.x).toBeGreaterThanOrEqual((size - 320) / 2);
      expect(edge.y).toBeGreaterThanOrEqual((size - 360) / 2);
    }
    expect(fitReadableMap({ scale: 0.6, x: 0, y: 0 }, 320, 360).scale).toBe(0.6);
  });
  it("손가락 흔들림은 탭으로 두고 스와이프는 이동으로 구분한다", () => {
    const gesture = new MapGesture(); gesture.down(1, { x: 0, y: 0 });
    expect(gesture.move(1, { x: 4, y: 3 }, INITIAL_MAP_VIEW)).toEqual(INITIAL_MAP_VIEW);
    expect(gesture.moved).toBe(false);
    expect(gesture.move(1, { x: 40, y: 30 }, INITIAL_MAP_VIEW)).toMatchObject({ x: 36, y: 27 });
    gesture.up(1); expect(gesture.moved).toBe(true);
    gesture.down(2, { x: 0, y: 0 }); expect(gesture.moved).toBe(false);
  });
  it("핀치 중심을 유지하고 손가락을 떼도 건설 탭으로 바뀌지 않는다", () => {
    const gesture = new MapGesture();
    gesture.down(1, { x: -50, y: 0 }); gesture.down(2, { x: 50, y: 0 });
    let view = gesture.move(1, { x: -100, y: 0 }, INITIAL_MAP_VIEW);
    view = gesture.move(2, { x: 100, y: 0 }, view);
    expect(view.scale).toBeCloseTo(2); expect(view.x).toBeCloseTo(0);
    gesture.up(2); view = gesture.move(1, { x: -80, y: 10 }, view);
    expect(view).toMatchObject({ x: 20, y: 10, scale: 2 });
    gesture.up(1); expect(gesture.moved).toBe(true);
  });
  it("배율·이동 한계와 취소 후 새 터치를 처리한다", () => {
    expect(zoomMap(INITIAL_MAP_VIEW, 99).scale).toBe(2.5);
    expect(zoomMap(INITIAL_MAP_VIEW, 0).scale).toBe(0.6);
    expect(constrainMap({ scale: 1, x: 9999, y: -9999 }, 300, 400)).toEqual({ scale: 1, x: 150, y: -200 });
    const gesture = new MapGesture(); gesture.down(1, { x: 0, y: 0 }); gesture.cancel();
    expect(gesture.points.size).toBe(0);
    expect(gesture.move(1, { x: 90, y: 0 }, INITIAL_MAP_VIEW)).toEqual(INITIAL_MAP_VIEW);
    gesture.down(2, { x: 0, y: 0 }); expect(gesture.moved).toBe(false);
  });
  it("회전 모드에서도 핀치는 되고 한 손가락으로 화면이 밀리지 않는다", () => {
    const gesture = new MapGesture(); gesture.down(1, { x: 0, y: 0 });
    expect(gesture.move(1, { x: 50, y: 0 }, INITIAL_MAP_VIEW, false)).toEqual(INITIAL_MAP_VIEW);
    gesture.down(2, { x: 100, y: 0 });
    expect(gesture.move(2, { x: 150, y: 0 }, INITIAL_MAP_VIEW, false).scale).toBe(2);
  });
});

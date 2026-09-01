import { describe, expect, it } from "vitest";
import { getInflationDisplay } from "./economyIndicators";

describe("getInflationDisplay", () => {
  it("describes every negative rate as deflation and falling prices", () => {
    expect(getInflationDisplay(-0.1)).toEqual({
      term: "디플레이션",
      label: "물건값 내림(디플레이션)",
      hint: "물건값이 전반적으로 내려가고 있어요",
    });
  });

  it("keeps zero in the inflation branch", () => {
    const display = getInflationDisplay(0);

    expect(display.term).toBe("인플레이션");
    expect(display.label).toBe("물건값 오름(인플레이션)");
    expect(display.hint).toContain("오르");
  });

  it("gives progressively clearer guidance as inflation rises", () => {
    expect(getInflationDisplay(2).hint).toBe("물건값이 조금씩 오르고 있어요");
    expect(getInflationDisplay(4).hint).toBe(
      "같은 돈으로 살 수 있는 양이 빠르게 줄어요",
    );
  });
});

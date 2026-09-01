export interface InflationDisplay {
  term: "인플레이션" | "디플레이션";
  label: string;
  hint: string;
}

/** Kid-friendly copy for the inflation indicator, including the zero boundary. */
export function getInflationDisplay(inflation: number): InflationDisplay {
  if (inflation < 0) {
    return {
      term: "디플레이션",
      label: "물건값 내림(디플레이션)",
      hint: "물건값이 전반적으로 내려가고 있어요",
    };
  }

  const hint = inflation >= 4
    ? "같은 돈으로 살 수 있는 양이 빠르게 줄어요"
    : inflation >= 2
      ? "물건값이 조금씩 오르고 있어요"
      : "물건값이 거의 오르지 않거나 천천히 오르고 있어요";

  return {
    term: "인플레이션",
    label: "물건값 오름(인플레이션)",
    hint,
  };
}

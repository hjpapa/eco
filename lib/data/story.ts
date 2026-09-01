import type { Level } from "../engine/types";

// Opening narrative scenes, differentiated by level. Kept as data so teachers
// can swap or customise them for a lesson context.

export interface StoryScene {
  emoji: string;
  title: string;
  body: string;
}

export const STORY: Record<Level, StoryScene[]> = {
  elementary: [
    {
      emoji: "🐉",
      title: "드래곤마운틴 시티에 오신 걸 환영해요",
      body: "산 아래 작은 회사의 새 사장님이 되었어요. 시작 자금 100만 원으로 멋진 도시 회사를 키워 볼까요?",
    },
    {
      emoji: "🏙️",
      title: "건물이 서로 도와요",
      body: "공장 옆에 창고를 놓는 것처럼 서로 돕는 건물을 붙이면 인접 보너스를 받을 수 있어요.",
    },
    {
      emoji: "🌍",
      title: "세상의 돈 흐름도 배워요",
      body: "물건을 팔고 투자하면서 금리·물가·환율, 빚과 이자를 쉬운 말로 하나씩 익혀요.",
    },
  ],
  middle: [
    {
      emoji: "🚀",
      title: "창업가의 길",
      body: "여러분은 유망한 스타트업의 새 CEO입니다. 회사를 성장시키고 시장을 정복하세요.",
    },
    {
      emoji: "📈",
      title: "경영과 투자, 두 날개",
      body: "제품을 만들어 이익을 내고(경영), 그 돈으로 주식·자산에 투자(투자)해 자본을 불립니다.",
    },
    {
      emoji: "🌍",
      title: "세상은 끊임없이 변합니다",
      body: "금리, 경기, 뉴스, 경쟁사… 다양한 사건이 시장을 흔듭니다. 현명하게 대응하세요.",
    },
  ],
  university: [
    {
      emoji: "🏛️",
      title: "시장 브리핑",
      body: "당신은 신임 CEO다. 거시경제 국면, 금리 정책, 환율, 지정학 리스크가 모두 변수다.",
    },
    {
      emoji: "🎯",
      title: "목표: 순자산 극대화",
      body: "기업가치(경영) + 투자 포트폴리오 + 현금 − 부채. 순자산(net worth) 1위가 목표다.",
    },
    {
      emoji: "⚖️",
      title: "선택에는 결과가 따른다",
      body: "안전 투자를 소홀히 하면 사고가, 과도한 부채는 신용 위기를 부른다. 모든 결정이 확률을 바꾼다.",
    },
  ],
};

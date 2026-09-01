import { GLOSSARY } from "../data/glossary";
import {
  GLOSSARY_GROUPS,
  MANUAL_SECTIONS,
} from "../data/manual";

export const LEARNING_CATALOG_VERSION = 1 as const;

export type LearningCourseId =
  | "basics"
  | "growth"
  | "investing"
  | "talent"
  | "world"
  | "glossary";

export interface LearningSection {
  title: string;
  body: string;
  tip?: string;
}

export interface LearningCourse {
  id: LearningCourseId;
  icon: string;
  title: string;
  shortTitle: string;
  duration: string;
  summary: string;
  goals: string[];
  sections: LearningSection[];
  practice?: "basic-company";
}

export interface SpotlightTutorialStep {
  targetId?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const COURSES: LearningCourse[] = [
  {
    id: "basics",
    icon: "🎮",
    title: "기초 운영",
    shortTitle: "기초",
    duration: "약 2분",
    summary: "가격과 생산량을 정하고 한 분기를 진행하는 핵심 흐름을 직접 연습해요.",
    goals: ["가격과 생산량 정하기", "예상 수요와 재고 살피기", "다음 분기 결과 읽기"],
    sections: [
      {
        title: "한 분기에 한 번씩 결정해요",
        body: "가격과 생산량을 정한 뒤 다음 분기를 누르면 판매량, 이익, 남은 재고가 계산돼요.",
        tip: "처음에는 예상 수요와 비슷한 만큼 생산하면 이해하기 쉬워요.",
      },
      {
        title: "싸다고 언제나 좋은 것은 아니에요",
        body: "가격을 내리면 더 많이 팔릴 수 있지만, 한 개를 팔 때 남는 돈은 줄어요. 적당한 가격을 찾아보세요.",
      },
    ],
    practice: "basic-company",
  },
  {
    id: "growth",
    icon: "🏗️",
    title: "회사 성장",
    shortTitle: "성장",
    duration: "약 3분",
    summary: "품질, 평판, 연구와 건물이 왜 긴 시간 동안 회사를 튼튼하게 만드는지 알아봐요.",
    goals: ["품질과 평판의 역할 알기", "건물과 연구의 효과 비교하기", "현금을 남겨 두는 이유 알기"],
    sections: [
      {
        title: "오늘의 이익과 내일의 성장을 나눠요",
        body: "연구개발(R&D)은 당장 비용이 들지만 품질을 올려 미래의 판매에 도움을 줘요. 마케팅은 회사의 평판을 키워요.",
        tip: "돈을 모두 쓰지 말고 다음 분기의 생산비도 남겨 두세요.",
      },
      {
        title: "건물은 역할이 달라요",
        body: "공장은 더 많이 만들게 하고, 연구소는 품질 성장을 돕고, 복지 건물은 직원이 힘내도록 도와줘요.",
      },
    ],
  },
  {
    id: "investing",
    icon: "📈",
    title: "투자",
    shortTitle: "투자",
    duration: "약 3분",
    summary: "안전한 자산과 많이 출렁이는 자산을 구분하고 나누어 투자하는 법을 배워요.",
    goals: ["위험도 카드 읽기", "분산투자 뜻 알기", "평가손익과 실제 현금 구분하기"],
    sections: [
      {
        title: "수익이 클 수 있으면 위험도 커요",
        body: "예금은 천천히 움직이는 대신 비교적 안전하고, 성장주나 암호화폐는 크게 오르거나 내릴 수 있어요.",
        tip: "처음에는 낮은 위험과 보통 위험 자산을 섞어 보세요.",
      },
      {
        title: "한 바구니에 모두 담지 않아요",
        body: "여러 자산에 나누어 투자하면 하나의 가격이 떨어져도 전체 손실을 줄일 수 있어요. 이것을 분산투자라고 해요.",
      },
    ],
  },
  {
    id: "talent",
    icon: "🧑‍💼",
    title: "인재",
    shortTitle: "인재",
    duration: "약 2분",
    summary: "대표 효과를 먼저 보고 회사에 지금 필요한 사람을 고르는 방법을 익혀요.",
    goals: ["대표 효과 읽기", "역할과 회사 상황 연결하기", "연봉과 충성도 살피기"],
    sections: [
      {
        title: "가장 필요한 효과부터 봐요",
        body: "기술 인재는 연구와 품질, 마케팅 인재는 판매와 평판처럼 역할마다 잘하는 일이 달라요.",
        tip: "재고가 많다면 생산보다 판매를 돕는 인재가 먼저일 수 있어요.",
      },
      {
        title: "영입 뒤에도 돌봐야 해요",
        body: "인재에게는 연봉이 필요하고 회사 사기가 낮으면 충성도도 떨어질 수 있어요. 효과와 비용을 함께 비교하세요.",
      },
    ],
  },
  {
    id: "world",
    icon: "🗞️",
    title: "뉴스·순위·방문",
    shortTitle: "세상 보기",
    duration: "약 3분",
    summary: "뉴스를 읽고 순위 변화를 확인하며 다른 회사를 방문해 배울 점을 찾아요.",
    goals: ["호재와 악재 구분하기", "내 순위와 성장 함께 보기", "방문과 제휴의 목적 알기"],
    sections: [
      {
        title: "뉴스는 다음 결정을 돕는 단서예요",
        body: "좋은 뉴스(호재)는 수요나 주가를 올릴 수 있고, 나쁜 뉴스(악재)는 반대일 수 있어요. 제목뿐 아니라 영향을 확인하세요.",
      },
      {
        title: "1등만이 성장은 아니에요",
        body: "순위가 올랐는지, 내 총재산(순자산)이 늘었는지, 회사가 한쪽으로 치우치지 않았는지도 함께 살펴보세요.",
        tip: "다른 회사를 방문하면 잘하는 점을 보고 다음 행동의 힌트를 얻을 수 있어요.",
      },
    ],
  },
  {
    id: "glossary",
    icon: "🔤",
    title: "용어집",
    shortTitle: "용어집",
    duration: "필요할 때",
    summary: "게임에 나오는 경제 말을 쉬운 설명과 함께 찾아봐요.",
    goals: ["쉬운 말과 정식 용어 연결하기", "모르는 말을 직접 검색하기"],
    sections: [
      {
        title: "쉬운 말부터 이해하면 돼요",
        body: "예를 들어 내 총재산은 정식 경제 용어로 순자산이라고 해요. 게임에서는 두 표현을 함께 보여줘요.",
        tip: "외우기보다 게임 중 궁금할 때 다시 찾아보세요.",
      },
    ],
  },
];

const SPOTLIGHT_TUTORIAL: SpotlightTutorialStep[] = [
  {
    title: "🎮 유니콘 시티에 오신 것을 환영합니다!",
    body: "가격과 생산량을 정하고 한 분기씩 회사를 키워 보세요. 배우기 메뉴의 2분 연습은 실제 저장 게임에 영향을 주지 않아요.",
  },
  {
    targetId: "btn-next-turn",
    title: "📅 다음 분기",
    body: "이 버튼을 누르면 한 분기(3개월)가 지나가요. 먼저 가격과 생산량을 확인해 보세요.",
    placement: "bottom",
  },
  {
    targetId: "tab-company",
    title: "🏢 회사",
    body: "가격과 생산량을 먼저 정해요. 건물과 연구 같은 활동은 회사가 성장하면 차례로 열려요.",
    placement: "bottom",
  },
  {
    targetId: "tab-invest",
    title: "📈 투자",
    body: "위험도 카드를 보고 안전한 자산부터 골라 보세요. 자세한 숫자는 전문가 보기에서 확인할 수 있어요.",
    placement: "bottom",
  },
  {
    targetId: "tab-talent",
    title: "🧑‍💼 인재",
    body: "대표 효과를 보고 회사에 필요한 인재를 골라요. 연봉과 자세한 능력은 펼쳐서 볼 수 있어요.",
    placement: "bottom",
  },
  {
    title: "🚀 준비 완료!",
    body: "완벽한 결정은 없어요. 한 분기씩 결과를 보고 조금씩 바꾸면 됩니다. 언제든 📘 배우기를 다시 열 수 있어요.",
  },
];

const QUICK_START = [
  {
    icon: "👋",
    title: "유니콘 시티에 오신 걸 환영해요!",
    text: "회사를 키우고 투자하며 내 총재산(순자산)을 늘리는 게임이에요. 게임 길이는 20·50·100분기 중에서 고를 수 있어요.",
  },
  {
    icon: "🏢",
    title: "1. 회사를 경영해요",
    text: "회사에서 가격과 생산량을 먼저 정해요. 가격을 낮추면 더 팔릴 수 있지만 한 개당 남는 돈은 줄어요.",
  },
  {
    icon: "🔄",
    title: "2. 다음 분기로 넘어가요",
    text: "다음 분기를 누르면 판매량·이익·재고가 계산돼요. 결과를 본 뒤 다음 결정을 조금씩 바꿔 보세요.",
  },
  {
    icon: "🔓",
    title: "3. 기능이 차례로 열려요",
    text: "건물·연구부터 투자와 인재까지 조금씩 열려요. 이미 익숙하다면 새 게임 설정에서 전체 기능 바로 열기를 고를 수 있어요.",
  },
  {
    icon: "📘",
    title: "도움이 필요하면",
    text: "위쪽의 📘 배우기를 누르면 실제 저장에 영향을 주지 않는 연습장과 쉬운 용어집을 언제든 다시 열 수 있어요.",
  },
];

const UPDATED_MANUAL = MANUAL_SECTIONS.map((section) => section.id === "goal"
  ? {
      ...section,
      body: [
        "20·50·100분기 중 원하는 길이를 골라 회사를 경영하고 **내 총재산(순자산)**을 키우는 게임이에요.",
        "내 총재산(순자산) = 현금 + 투자자산 + 기업가치 − 부채. 이 네 가지를 함께 키우는 게 핵심이에요.",
        "1위는 가장 큰 보상이고, 순위 상승·총재산 성장·회사 균형으로도 배지를 받을 수 있어요.",
      ],
    }
  : section);

/**
 * The single read model for every learning surface. Existing manual and term
 * definitions are adapted here so the help modal, spotlight and /learn page
 * all consume the same catalog instead of maintaining separate UI copies.
 */
export const LEARNING_CATALOG = {
  version: LEARNING_CATALOG_VERSION,
  courses: COURSES,
  quickStart: QUICK_START,
  spotlight: SPOTLIGHT_TUTORIAL,
  manual: UPDATED_MANUAL,
  glossary: GLOSSARY_GROUPS.map((group) => ({
    ...group,
    entries: group.terms.map((term) => ({
      term,
      definition: GLOSSARY[term] ?? "설명이 준비 중이에요.",
    })),
  })),
} as const;

export function getLearningCourse(id: LearningCourseId): LearningCourse {
  const course = LEARNING_CATALOG.courses.find((item) => item.id === id);
  if (!course) throw new Error(`Unknown learning course: ${id}`);
  return course;
}

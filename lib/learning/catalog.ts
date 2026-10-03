import { GLOSSARY } from "../data/glossary";
import {
  GLOSSARY_GROUPS,
  MANUAL_SECTIONS,
} from "../data/manual";

export const LEARNING_CATALOG_VERSION = 1 as const;

export const WORK_LESSONS = {
  fx: { term: "환율", text: "환율은 다른 나라 돈의 값이에요. 1달러를 사려면 우리 돈이 얼마나 필요한지 알려 줘요.", impact: "달러를 산 뒤 환율이 오르면 내 달러의 값도 올라요. 내려가면 줄어요." },
  production: { term: "재고", text: "만들었는데 아직 안 팔린 물건이 재고예요. 너무 많이 만들면 만드는 데 쓴 돈이 창고에 쌓여 있어요.", impact: "손님 수(예상 수요)와 비슷하게 만들면 재고가 덜 남아요." },
  sales: { term: "매출", text: "판 개수 × 가격 = 매출(번 돈)이에요. 값을 내리면 더 많이 팔리지만 한 개에 남는 돈은 줄어요.", impact: "바꾼 가격은 다음 턴 판매부터 적용돼요. 경기와 라이벌 회사도 판매에 영향을 줘요." },
  research: { term: "투자", text: "연구는 더 좋은 물건을 만들려고 미리 돈을 쓰는 투자예요. 품질이 오르면 더 비싸게 팔 수 있어요.", impact: "연구 버튼은 바로 돈이 나가요. 회사 운영에 쓸 돈은 남겨 두세요." },
  staff: { term: "생산성", text: "직원이 행복하고 일터가 안전하면 같은 시간에 더 많이 만들 수 있어요. 이것이 생산성이에요.", impact: "버튼을 누르면 바로 돈이 나가요. 행복·안전 점수가 낮은 것부터 챙겨요." },
  finance: { term: "이자", text: "돈을 빌리면 빌린 돈(원금)에 더해 빌린 값(이자)도 내야 해요. 금리가 오르면 이자도 늘어요.", impact: "꼭 필요할 때만 빌리고, 돈이 생기면 빨리 갚는 게 좋아요." },
  construction: { term: "회수 기간", text: "건물을 짓는 데 쓴 돈을 다시 벌어들이는 데 걸리는 시간(본전 찾기)이에요. 짧을수록 좋은 선택이에요.", impact: "서로 돕는 건물을 옆에 붙이면 ✨조합 보너스! 지은 뒤에도 비상금은 꼭 남겨 두세요." },
  quests: { term: "기회비용", text: "하나를 고르면 다른 하나는 포기해야 해요. 주문을 받으면 그만큼 손님에게 팔 물건이 줄어요. 포기한 것의 가치가 기회비용이에요.", impact: "보상과 기한을 보고 해낼 수 있는 의뢰만 받아요." },
} as const;

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
    summary: "가격과 만들 개수를 정하고 한 턴을 넘겨 보는 연습을 해요.",
    goals: ["가격과 만들 개수 정하기", "손님 수와 창고 재고 살피기", "다음 턴 결과 읽기"],
    sections: [
      {
        title: "한 턴에 한 번씩 결정해요",
        body: "가격과 만들 개수를 정한 뒤 다음 턴을 누르면 판 개수, 이익, 창고에 남은 물건이 계산돼요.",
        tip: "처음에는 손님 수(예상 수요)와 비슷한 만큼 만들면 이해하기 쉬워요.",
      },
      {
        title: "싸다고 언제나 좋은 것은 아니에요",
        body: "가격을 내리면 더 많이 팔릴 수 있지만, 한 개를 팔 때 남는 돈은 줄어요. 적당한 가격을 찾아보세요.",
      },
      {
        title: "회사 돈은 세 줄로 읽어요",
        body: "물건을 팔아 들어온 돈은 매출, 회사를 움직이며 쓴 돈은 비용, 매출에서 비용을 뺀 남은 돈은 이익이에요. 지금 바로 쓸 수 있는 돈은 현금이라고 해요.",
        tip: "매출이 커도 비용이 더 크면 이익은 마이너스가 될 수 있어요.",
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
        body: "연구는 당장 돈이 들지만 품질을 올려 앞으로 더 잘 팔리게 도와줘요. 광고(마케팅)는 회사의 평판을 키워요.",
        tip: "돈을 모두 쓰지 말고 다음 턴의 생산비도 남겨 두세요.",
      },
      {
        title: "건물은 역할이 달라요",
        body: "공장은 더 많이 만들게 하고, 연구소는 품질 성장을 돕고, 복지 건물은 직원이 힘내도록 도와줘요.",
      },
      {
        title: "옆에 붙이면 인접 보너스",
        body: "서로 돕는 건물을 위아래·양옆으로 붙이면 ✨조합 보너스(인접 보너스)를 받아요. 생산·배송, 빠른 판매, 아이디어, 직원 행복처럼 조합마다 효과가 달라요.",
        tip: "건물을 고르면 지도에서 빛나는 추천 칸을 써 보세요. 같은 건물을 반복하면 건설비가 조금 올라요.",
      },
      {
        title: "회사가 튼튼한지도 함께 봐요",
        body: "기업가치는 회사 자체가 얼마짜리인지예요. 회사 전체 재산(순자산)은 가진 돈(현금) + 투자한 것(투자자산) + 회사 값(기업가치)에서 빚(부채)을 뺀 값이라서, 빚만 늘려서는 진짜 부자가 되지 않아요.",
      },
      {
        title: "📜 의뢰 게시판: 약속을 지키면 보상이 와요",
        body: "손님의 주문을 받으면 만든 상품 중 주문 몫을 먼저 보내요. 그만큼 시장 손님에게 팔 상품은 줄어들어요. 하나를 고르면 다른 하나를 포기하게 되는 것, 이것을 기회비용이라고 해요.",
        tip: "주문을 받기 전에 최대로 만들 수 있는 양과 기한을 확인해요. 기한을 놓치면 평판이 조금 떨어져요.",
      },
      {
        title: "🤔 사장님의 선택과 🧪 가격 실험실",
        body: "축제를 열면 직원이 행복해지지만 돈이 들어요. 가격을 올리면 한 개당 남는 돈은 늘지만 손님이 줄 수 있어요. 정답은 상황마다 달라요. 숫자를 비교하며 가장 좋은 선택을 찾아봐요.",
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
    goals: ["🛡️⚖️🎢 위험도 카드 읽기", "분산 투자 뜻 알기", "'지금 팔면 얼마'와 진짜 돈 구분하기"],
    sections: [
      {
        title: "수익이 클 수 있으면 위험도 커요",
        body: "예금은 천천히 늘어나는 대신 안전한 편이고, 빨리 크는 회사 주식이나 달러는 더 크게 오르거나 내릴 수 있어요.",
        tip: "처음에는 낮은 위험과 보통 위험 자산을 섞어 보세요.",
      },
      {
        title: "한 바구니에 모두 담지 않아요",
        body: "여러 곳에 나누어 투자하면 하나의 값이 떨어져도 전체 손해를 줄일 수 있어요. 이것을 분산 투자라고 해요.",
      },
      {
        title: "금리·인플레이션·환율은 서로 연결돼요",
        body: "기준금리가 오르면 예금 이자는 커질 수 있지만 채권 값은 내려갈 수 있어요. 물가(인플레이션)가 높으면 같은 현금으로 살 수 있는 것이 줄어 금을 찾는 사람이 늘기도 해요. 환율은 다른 나라 돈의 값으로, 게임에서는 달러 값 지수를 100에서 시작해 살펴봐요.",
      },
      {
        title: "어려운 숫자는 나중에 배워도 돼요",
        body: "어른들은 PER·PBR·ROE 같은 숫자로 주식이 싼지 비싼지 따져요. 이 게임에서는 🛡️⚖️🎢 위험도와 값 그래프를 먼저 보면 충분해요. 궁금하면 용어집의 '더 알고 싶다면'에서 찾아봐요.",
        tip: "어떤 숫자 하나만 보고 투자 결정을 내리지 않아요.",
      },
      {
        title: "대출은 공짜 돈이 아니에요",
        body: "돈을 빌리면(대출) 가진 돈(현금)과 빚(부채)이 함께 늘고, 매 턴 이자를 내야 해요. 갚을 계획이 있을 때 필요한 만큼만 빌려요.",
      },
    ],
  },
  {
    id: "talent",
    icon: "🧑‍💼",
    title: "인재",
    shortTitle: "인재",
    duration: "약 2분",
    summary: "✨ 특별 능력을 먼저 보고 회사에 지금 필요한 사람을 고르는 방법을 익혀요.",
    goals: ["✨ 특별 능력 읽기", "역할과 회사 상황 연결하기", "급여와 충성도 살피기"],
    sections: [
      {
        title: "가장 필요한 효과부터 봐요",
        body: "기술 담당은 연구와 품질, 광고 담당은 손님과 평판처럼 역할마다 잘하는 일이 달라요.",
        tip: "창고에 물건이 많다면 만드는 사람보다 파는 걸 돕는 인재가 먼저일 수 있어요.",
      },
      {
        title: "뽑은 뒤에도 돌봐야 해요",
        body: "인재에게는 급여가 필요하고 직원 행복이 낮으면 충성도도 떨어질 수 있어요. 효과와 비용을 함께 비교해요.",
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
    goals: ["좋은 소식과 나쁜 소식 구분하기", "내 순위와 성장 함께 보기", "다른 회사 구경의 목적 알기"],
    sections: [
      {
        title: "뉴스는 다음 결정을 돕는 단서예요",
        body: "좋은 소식(호재)은 손님 수나 주식 값을 올릴 수 있고, 나쁜 소식(악재)은 반대일 수 있어요. 제목뿐 아니라 어떤 영향이 있는지 확인해요.",
      },
      {
        title: "1등만이 성장은 아니에요",
        body: "순위가 올랐는지, 내 총재산(순자산)이 늘었는지, 회사가 한쪽으로 치우치지 않았는지도 함께 살펴보세요.",
        tip: "다른 회사를 방문하면 잘하는 점을 보고 다음 행동의 힌트를 얻을 수 있어요.",
      },
      {
        title: "경제 뉴스는 원인과 결과를 연결해요",
        body: "기준금리 뉴스가 나오면 대출 이자와 예금을, 인플레이션 뉴스가 나오면 물건값과 금을, 환율 뉴스가 나오면 달러 값을 함께 살펴보세요.",
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
    title: "🎮 드래곤 마운틴 시티에 오신 것을 환영합니다!",
    body: "건물을 짓고, 만들 개수와 가격을 정하고, 한 턴씩 회사를 키워 보세요. 배우기 메뉴의 2턴 연습은 진짜 게임에 영향을 주지 않아요.",
  },
  {
    targetId: "btn-next-turn",
    title: "📅 다음 턴",
    body: "이 버튼을 누르면 한 턴(3개월)이 지나가요. 먼저 만들 개수와 가격을 확인해 보세요.",
    placement: "bottom",
  },
  {
    targetId: "tab-company",
    title: "🏢 회사",
    body: "왼쪽 지도에 건물을 지어 회사를 도시처럼 키우고, 오른쪽 버튼으로 만들기·팔기를 정해요. 연구 같은 활동은 차례로 열려요.",
    placement: "bottom",
  },
  {
    targetId: "tab-invest",
    title: "📈 투자",
    body: "🛡️⚖️🎢 위험도 카드를 보고 안전한 것부터 조금씩 골라 보세요.",
    placement: "bottom",
  },
  {
    targetId: "tab-talent",
    title: "🧑‍💼 인재",
    body: "✨ 특별 능력을 보고 회사에 필요한 인재를 뽑아요. 급여를 올려 주면 더 오래 함께해요.",
    placement: "bottom",
  },
  {
    title: "🚀 준비 완료!",
    body: "완벽한 결정은 없어요. 한 턴씩 결과를 보고 조금씩 바꾸면 돼요. 언제든 📘 배우기를 다시 열 수 있어요.",
  },
];

const QUICK_START = [
  {
    icon: "👋",
    title: "드래곤 마운틴 시티에 오신 걸 환영해요!",
    text: "회사를 키우고 남는 돈을 불려서 회사 전체 재산(순자산)을 늘리는 게임이에요. 게임 길이는 20·50·100턴 중에서 골라요.",
  },
  {
    icon: "🏢",
    title: "1. 회사를 경영해요",
    text: "건물을 짓고, 만들 개수와 가격을 정해요. 값을 내리면 더 팔리지만 한 개에 남는 돈은 줄어요.",
  },
  {
    icon: "🔄",
    title: "2. 다음 턴으로 넘어가요",
    text: "다음 턴을 누르면 판 개수·이익·창고 재고가 계산돼요. 결과를 본 뒤 조금씩 바꿔 봐요.",
  },
  {
    icon: "🔓",
    title: "3. 기능이 차례로 열려요",
    text: "건물은 처음부터 지을 수 있고, 연구·투자·인재는 조금씩 열려요. 선생님은 새 게임의 '선생님 설정'에서 처음부터 모두 열 수 있어요.",
  },
  {
    icon: "📘",
    title: "도움이 필요하면",
    text: "위쪽의 📘 배우기를 누르면 진짜 게임에 영향을 주지 않는 연습장과 쉬운 용어집을 언제든 열 수 있어요.",
  },
];

const UPDATED_MANUAL = MANUAL_SECTIONS.map((section) => section.id === "goal"
  ? {
      ...section,
      body: [
        "20·50·100턴 중 원하는 길이를 골라 회사를 키우고 **회사 전체 재산(순자산)**을 늘리는 게임이에요.",
        "회사 전체 재산(순자산) = 가진 돈 + 투자한 것 + 회사 값 − 빚. 네 가지를 함께 키워야 해요.",
        "1등이 가장 큰 목표지만, 순위 올리기·재산 늘리기·회사 균형으로도 배지를 받을 수 있어요. 1턴은 회사의 3개월이에요.",
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
  courses: COURSES.map((course) => course.id === "basics" ? { ...course, sections: [...course.sections, ...Object.values(WORK_LESSONS).map((lesson) => ({ title: lesson.term, body: lesson.text, tip: lesson.impact }))] } : course),
  workLessons: WORK_LESSONS,
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

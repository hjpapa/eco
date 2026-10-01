import type { BuildingType, Company, EconomyPhase } from "../engine/types";
import { getIndustry } from "./industries";
import { getIndustryProducts } from "./products";

// Little speech bubbles that pop up over campus buildings. Each building has
// its own voice, a few jokes, and lines that react to the company's numbers,
// so the city feels alive and quietly shows what is going on.

type Lines = (c: Company) => string[];

function basicPriceRatio(c: Company): number {
  const def = getIndustryProducts(c.industryId)[0];
  if (!def) return 1;
  const ref = getIndustry(c.industryId).basePrice * def.priceRatio;
  return (c.productPrices?.[0] ?? ref) / Math.max(1, ref);
}

const LINES: Record<BuildingType, Lines> = {
  factory: (c) => [
    "뚝딱뚝딱! 오늘도 열심히 만드는 중 🔨",
    "기계가 콧노래를 불러요: 삐-빠-뽀 🎵",
    `이번 턴 목표는 ${Math.round(c.decisions.productionTarget).toLocaleString()}개! 💪`,
    ...(c.inventory > 400 ? ["창고에서 그만 좀 보내래요… 📦😵"] : []),
  ],
  warehouse: (c) => [
    "상자 테트리스 중… 한 줄만 더! 🧩",
    "지게차 운전 실력이 날로 늘어요 🚜",
    c.inventory > 400
      ? `재고 ${Math.round(c.inventory).toLocaleString()}개… 문이 안 닫혀요! 😵`
      : `재고 ${Math.round(c.inventory).toLocaleString()}개, 아직 여유 있어요 👍`,
  ],
  store: (c) => [
    "어서 오세요~ 구경만 해도 돼요! 🛍️",
    "손님이 '이거 사면 행복해져요?' 물어봤어요 😊",
    ...(basicPriceRatio(c) >= 1.25 ? ["손님이 가격표 보고 안경을 두 번 닦았어요 👓"] : []),
    ...(basicPriceRatio(c) <= 0.75 ? ["너무 싸서 '혹시 공짜예요?' 문의 폭주! 😲"] : []),
  ],
  office: (c) => [
    "회의 중… 회의를 위한 회의 중 📋",
    "사장님 결재 도장이 오늘 좀 지쳐 보여요 🖊️",
    c.lastProfit >= 0 ? "보고서 그래프가 위로 쭉! 📈" : "보고서 그래프가 아래로… 커피 더 주세요 ☕",
  ],
  rnd: (c) => [
    "실험 성공! …아니 실패! …아니 성공! 🔬",
    "연구원이 '유레카!' 외치고 목욕탕 갔대요 🛁",
    c.quality >= 60 ? "우리 제품 품질, 이제 자신 있어요 ✨" : "품질을 올릴 아이디어 찾는 중 💡",
  ],
  hr: () => [
    "면접자가 너무 떨려서 자기 이름을 두 번 말했어요 😳",
    "새 직원 환영 파티 준비 중 🎉",
  ],
  power: () => [
    "찌릿찌릿 ⚡ 오늘도 불 켜 드려요!",
    "전기를 아끼면 생산비도 줄어요 💡",
  ],
  park: () => [
    "벤치 명당 자리 쟁탈전 중 🪑",
    "고양이가 출근 도장 찍었어요 🐱",
    "나무 그늘에서 쉬니까 힘이 나요 🌳",
  ],
  cafeteria: (c) => [
    "오늘 메뉴는 떡볶이! 줄이 끝이 안 보여요 🌶️",
    "영양사님: '편식하면 안 돼요!' 🥦",
    ...(c.morale >= 65 ? ["밥이 맛있으니 다들 웃어요 😋"] : []),
  ],
  dorm: () => [
    "출근 거리 30초! 지각하면 핑계가 없어요 😅",
    "옥상 정원에서 상추 수확했어요 🥬",
  ],
  gym: () => [
    "하나! 둘! …셋은 내일 할게요 💪",
    "러닝머신 위에서 회의 중 🏃",
  ],
  daycare: () => [
    "사장님 초상화 그렸어요! 코가 좀 커요 🎨",
    "낮잠 시간이에요… 쉿! 😴",
    "미끄럼틀 대기 줄이 회사 회의보다 길어요 🛝",
  ],
  clinic: () => [
    "사탕 받으러 온 직원이 또 왔어요 🍬",
    "건강검진 결과: 모두 튼튼! 🩺",
  ],
  lab: () => [
    "여기가 회사에서 제일 시원해요 ❄️",
    "AI가 '저도 점심 먹고 싶어요'라고 했어요 🤖",
  ],
  fountain: () => [
    "동전 던지고 소원 비는 중 🪙✨",
    "비둘기들이 분수 수영장 개장했대요 🕊️",
  ],
  statue: () => [
    "드래곤 동상 앞 인증샷 줄이 길어요 📸",
    "밤에 드래곤 눈이 반짝였다는 소문이… 👀",
  ],
  clocktower: () => [
    "땡! 땡! 정시 출근 성공! ⏰",
    "시계탑 덕분에 '5분만 더'가 사라졌어요 😅",
  ],
  ferris: () => [
    "꼭대기에서 우리 도시가 다 보여요! 🎡",
    "관광객 모자가 날아갔어요… 잡아 주세요! 🧢",
  ],
};

const PHASE_LINES: Partial<Record<EconomyPhase, string[]>> = {
  boom: ["경기가 좋아서 손님이 북적북적! 🎉"],
  recession: ["요즘 손님들이 지갑을 꼭 닫았어요 👛"],
  inflation: ["재료값이 또 올랐대요 😮‍💨"],
  deflation: ["다들 '다음에 더 싸지면 살래요' 해요 🤔"],
  stagflation: ["물가는 오르고 손님은 줄고… 힘내자! 💪"],
};

/** One line for a bubble over a building. `rand` keeps the game RNG untouched. */
export function pickBuildingChatter(
  type: BuildingType,
  company: Company,
  phase: EconomyPhase,
  rand: () => number = Math.random,
): string {
  const pool = [...LINES[type](company)];
  if (rand() < 0.15) pool.push(...(PHASE_LINES[phase] ?? []));
  return pool[Math.floor(rand() * pool.length)] ?? pool[0];
}

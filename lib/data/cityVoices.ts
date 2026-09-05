import type { Company, EconomyPhase, VisitorInfo } from "../engine/types";

// Flavour dialogue for the little people walking around a company campus.
// Touching a pedestrian shows what they think about the company — lines are
// chosen from pools that match the company's current state, so the chatter
// reflects morale, reputation, finances and the macro mood. Lots of variety
// on purpose: pools are large and a generic pool is always mixed in.

type Pool = (c: Company) => string[];

const HIGH_MORALE: Pool = (c) => [
  `${c.name}에서 일하는 거 요즘 너무 즐거워요!`,
  "팀 분위기가 최고예요. 출근이 기다려진다니까요.",
  "복지가 좋아져서 동료들 표정이 다 밝아요.",
  "야근이 줄었어요. 이런 회사 또 없죠.",
  "사내 카페에서 커피 한 잔! 행복합니다 ☕",
  "동료들이랑 점심 먹는 시간이 제일 좋아요.",
];

const LOW_MORALE: Pool = (c) => [
  `${c.name}... 요즘 사기가 영 바닥이에요.`,
  "또 야근이라니, 너무 지쳐요…",
  "분위기가 가라앉아서 다들 말이 없어요.",
  "이직 사이트를 자꾸 들여다보게 되네요.",
  "휴게실이라도 좀 만들어 줬으면…",
  "월급은 그대로인데 일은 자꾸 늘어요.",
];

const HIGH_REP: Pool = (c) => [
  `${c.name} 다닌다고 하면 다들 부러워해요.`,
  "우리 회사 평판이 진짜 좋아졌어요!",
  "친구한테 입사 추천했어요. 자랑스럽거든요.",
  "고객들이 우리 브랜드를 믿어줘서 뿌듯해요.",
  "뉴스에 좋게 나와서 기분이 좋네요.",
];

const LOW_REP: Pool = (c) => [
  `요즘 ${c.name} 이미지가 좀 안 좋아서 속상해요.`,
  "사람들이 우리 회사를 안 좋게 봐서 걱정이에요.",
  "평판 관리가 시급해 보여요.",
  "고객 불만이 늘었다는 소문이…",
  "친구한테 회사 얘기 꺼내기가 좀 그래요.",
];

const HIGH_QUALITY: Pool = (c) => [
  "우리 제품 품질만큼은 자신 있어요!",
  "신제품 반응이 정말 뜨거워요 🔥",
  `${c.name} 기술력은 업계 최고죠.`,
  "연구소에서 또 대단한 걸 만들었대요.",
  "품질 좋다고 리뷰가 칭찬 일색이에요.",
];

const HIGH_DEBT: Pool = (c) => [
  "회사 빚이 많다던데… 괜찮을까요?",
  "대출 이자 얘기가 자꾸 들려서 불안해요.",
  "재무팀이 요즘 바빠 보여요. 무슨 일이죠?",
  "확장도 좋지만 빚은 좀 줄였으면…",
];

const RICH_CASH: Pool = (c) => [
  `${c.name} 금고가 두둑하다던데요? 😎`,
  "현금이 넉넉하니 보너스 기대해도 될까요?",
  "투자 여력이 충분하다니 든든하네요.",
  "재정이 탄탄해서 마음이 놓여요.",
];

const PROFIT: Pool = (c) => [
  "이번 턴(분기) 실적이 좋았대요! 보너스 가즈아~",
  `${c.name} 흑자라니 어깨가 으쓱해요.`,
  "장사가 잘되니 회사에 활기가 도네요.",
  "매출이 쭉쭉 오른다는 소식, 기분 좋아요.",
];

const LOSS: Pool = (c) => [
  "적자라는 얘기에 다들 긴장하고 있어요…",
  "이번 턴(분기)은 좀 힘들었나 봐요.",
  "비용을 줄여야 한다는 말이 돌아요.",
  `${c.name}, 다음 턴(분기)엔 반등하길!`,
];

const PHASE: Record<EconomyPhase, string[]> = {
  boom: [
    "경기가 좋으니 거리에 사람도 많네요!",
    "다들 지갑을 여는 분위기예요. 호황이죠!",
    "주가도 오르고, 살 맛 나는 요즘입니다.",
  ],
  normal: [
    "오늘도 평범하지만 평화로운 하루네요.",
    "꾸준한 게 최고죠. 무탈하게 일합니다.",
    "특별한 일은 없지만 그게 좋아요.",
  ],
  recession: [
    "불경기라 다들 허리띠를 졸라매요.",
    "요즘 소비가 줄어서 거리가 한산해요.",
    "어려운 시기지만 버텨봐야죠.",
  ],
  inflation: [
    "물가가 너무 올라서 점심값이 무서워요.",
    "월급 빼고 다 오른다더니 정말이네요.",
    "장바구니 물가에 한숨이 나와요.",
  ],
  deflation: [
    "물건값이 자꾸 떨어지니 묘하게 불안해요.",
    "사람들이 소비를 미뤄서 가게가 조용해요.",
    "싸지는 건 좋은데 경기가 걱정이에요.",
  ],
  stagflation: [
    "경기는 나쁜데 물가는 오르고… 최악이에요.",
    "월급은 그대론데 물가만 뛰니 힘드네요.",
    "이런 시기엔 뭘 해도 어렵다더라고요.",
  ],
};

const GENERIC: Pool = (c) => [
  "안녕하세요! 좋은 하루 보내세요 😊",
  `여기가 ${c.name} 캠퍼스군요. 멋지네요!`,
  "점심 뭐 먹을지 고민 중이에요…",
  "오늘 날씨 정말 좋네요.",
  "퇴근하고 운동하러 갈 거예요!",
  "이 동네 산책로가 참 예뻐요.",
  "커피 한 잔의 여유, 최고죠.",
  "버스 시간 맞추려고 뛰는 중이에요 🏃",
  "새로 생긴 건물 구경하고 있었어요.",
  "주말엔 좀 쉬고 싶네요~",
  "회의가 방금 끝났어요. 휴~",
  "동료랑 산책하며 아이디어 짜는 중이에요.",
  "엘리베이터가 또 만원이네요 😅",
  "오늘 발표 잘 끝나서 다행이에요.",
];

const CHILD: Pool = (c) => [
  "엄마 아빠 회사 구경 왔어요! 🧒",
  `${c.name}는 진짜 크다! 우와~`,
  "어린이집 친구들이랑 놀았어요!",
  "아이스크림 먹고 싶어요 🍦",
  "여기 분수 너무 멋져요!",
  "커서 이 회사 사장님 될래요!",
  "강아지처럼 뛰어다니고 싶어요 🐶",
  "풍선 주세요~ 🎈",
];

const MAN: Pool = () => [
  "이번 프로젝트 마감이 코앞이에요.",
  "헬스장에서 한 세트 더 하고 왔어요 💪",
  "주차 자리가 없어서 한참 돌았네요.",
];
const WOMAN: Pool = () => [
  "신제품 기획안 발표 준비 중이에요.",
  "오늘 팀 점심은 제가 쏘기로 했어요!",
  "퇴근하고 친구 만나기로 했어요 ☕",
];

// Lines unlocked by welfare / research buildings on campus.
const BUILDING_LINES: Partial<Record<string, string[]>> = {
  cafeteria: ["오늘 구내식당 메뉴 대박이에요 🍱", "사내 식당 밥이 집밥보다 맛있어요!"],
  gym: ["사내 헬스장 덕분에 건강해졌어요 🏋️", "점심엔 헬스장에서 운동해요!"],
  dorm: ["사택이 회사 바로 옆이라 너무 편해요 🏠", "출퇴근이 5분이라 천국이에요."],
  daycare: ["회사 어린이집에 아이를 맡겨서 든든해요 🧸", "아이가 회사 어린이집을 좋아해요!"],
  clinic: ["의무실이 있어서 아플 때 안심돼요 🏥", "건강검진을 회사에서 받았어요."],
  lab: ["연구동에서 밤새 실험했어요 🧪", "데이터센터 성능이 끝내줘요!"],
  rnd: ["연구소에서 새 기술을 만들고 있어요 🔬"],
  park: ["공원에서 점심 먹으니 기분 좋아요 🌳"],
};

interface VoiceOpts {
  personKind?: "man" | "woman" | "child";
  rand?: () => number;
}

/**
 * Pick one line that reflects the company's current state, the speaker, and the
 * campus buildings. `rand` defaults to Math.random so callers don't perturb the
 * deterministic game RNG.
 */
export function pickCityVoice(
  company: Company,
  phase: EconomyPhase,
  opts: VoiceOpts = {},
): string {
  const rand = opts.rand ?? Math.random;

  // Children mostly say child-like things.
  if (opts.personKind === "child") {
    const kidPool = [...CHILD(company)];
    if (rand() < 0.3) kidPool.push(...PHASE[phase]);
    return kidPool[Math.floor(rand() * kidPool.length)] ?? CHILD(company)[0];
  }

  const pool: string[] = [...GENERIC(company), ...PHASE[phase]];
  if (opts.personKind === "man") pool.push(...MAN(company));
  if (opts.personKind === "woman") pool.push(...WOMAN(company));

  // Welfare / research buildings give people things to talk about.
  const types = new Set(company.buildings.filter((b) => b.turnsLeft <= 0).map((b) => b.type));
  for (const t of types) {
    const lines = BUILDING_LINES[t];
    if (lines) pool.push(...lines);
  }

  if (company.morale >= 65) pool.push(...HIGH_MORALE(company));
  if (company.morale <= 40) pool.push(...LOW_MORALE(company));
  if (company.reputation >= 65) pool.push(...HIGH_REP(company));
  if (company.reputation <= 40) pool.push(...LOW_REP(company));
  if (company.quality >= 60) pool.push(...HIGH_QUALITY(company));
  if (company.debt > company.cash * 1.2) pool.push(...HIGH_DEBT(company));
  if (company.cash > 1_500_000) pool.push(...RICH_CASH(company));
  if (company.lastProfit > 0) pool.push(...PROFIT(company));
  if (company.lastProfit < 0) pool.push(...LOSS(company));

  return pool[Math.floor(rand() * pool.length)] ?? GENERIC(company)[0];
}

// ---------------------------------------------------------------------------
// Visitor dialogue — context-reactive lines per kind of VIP
// ---------------------------------------------------------------------------

const VISITOR_POOLS: Record<VisitorInfo["kind"], (name: string, c: Company) => string[]> = {
  politician: (name, c) => [
    `${c.name}의 일자리 창출에 깊이 감사드립니다!`,
    `${name}입니다. 이런 기업이 많아야 나라가 삽니다.`,
    `고용도 늘리고 세금도 잘 내시고, 훌륭합니다!`,
    `기업 투자 환경 개선에 최선을 다하겠습니다.`,
    `${c.name}의 성장이 곧 국민의 행복이에요.`,
    `직원 복지 수준이 정말 인상적이군요.`,
    `다음 산업 정책에 좋은 사례로 소개하겠습니다.`,
    `이 규모 캠퍼스라면 지역 경제에도 큰 힘이 되겠네요.`,
  ],
  ceo: (name, c) => [
    `${name}입니다. 협업 기회를 한번 논의해 봤으면 합니다.`,
    `${c.name}의 비즈니스 모델, 매우 흥미롭습니다.`,
    `이 규모의 캠퍼스라니 — 인상적이군요.`,
    `직원들 표정이 밝네요. 좋은 문화가 있다는 증거죠.`,
    `우리 회사와 시너지를 낼 수 있을 것 같습니다.`,
    `성장 잠재력이 상당해 보입니다.`,
    `인재 경쟁 상대가 될 수도 있겠는데요?`,
    `벤치마킹하고 싶은 부분이 많네요.`,
  ],
  celebrity: (name, c) => [
    `와, 여기 분위기 완전 좋다! ✨`,
    `${name}이에요! ${c.name} 팬이에요~`,
    `${c.name} 제품 저도 써봤어요. 완전 마음에 들었어요!`,
    `여기서 화보 촬영 하면 대박일 것 같아!`,
    `이런 회사에서 일하면 매일이 행복할 것 같아요.`,
    `셀카 한 장 찍어도 될까요? 📸`,
    `팔로워들한테 꼭 소개해줄게요!`,
    `건물 디자인이 진짜 예뻐요~`,
  ],
  investor: (name, c) => [
    `${name}입니다. 투자 가능성을 검토 중입니다.`,
    `${c.name}의 수익률을 눈여겨봐 왔습니다.`,
    `재무 지표가 꽤 안정적이군요.`,
    `성장성과 수익성, 둘 다 보입니다.`,
    `이 정도 현금 흐름이면 투자 가치가 충분합니다.`,
    `리스크 대비 리턴이 매력적이네요.`,
    `다음 턴(분기) 실적도 기대해도 될까요?`,
    `포트폴리오에 추가를 심각하게 고려해 보겠습니다.`,
  ],
};

/**
 * Build the full set of dialogue lines for a VIP visitor touring the campus.
 * Returns every available line; the caller cycles through them.
 */
export function pickVisitorVoices(
  visitor: Pick<VisitorInfo, "kind" | "name">,
  company: Company,
): string[] {
  const base = VISITOR_POOLS[visitor.kind]?.(visitor.name, company) ?? [
    `${company.name}을 방문하게 되어 영광입니다!`,
    "정말 훌륭한 캠퍼스네요.",
  ];
  const extra: string[] = [];
  if (company.reputation >= 65) extra.push(`${company.name} 명성이 자자하더니 역시 다르네요!`);
  if (company.morale >= 65) extra.push("직원들이 정말 활기차 보입니다!");
  if (company.quality >= 60) extra.push("제품 퀄리티가 높다더니, 캠퍼스에서도 느껴지네요.");
  if (company.lastProfit > 0) extra.push("흑자 경영이라는 게 분위기에서도 느껴져요.");
  if (company.cash > 2_000_000) extra.push("재정이 탄탄하니 앞으로도 기대됩니다!");
  return [...base, ...extra];
}

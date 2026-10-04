import type { BuildingType } from "../engine/types";

// Named village residents, Animal Crossing style. Each one has a personality,
// favourite buildings and a catchphrase, so a child can recognise and care
// about them. No portraits yet: emoji stand in until art is drawn
// (see RESIDENT_ART_TODO in lib/assetMap.ts).

export type Personality = "foodie" | "sporty" | "bookworm" | "stylish";

export const PERSONALITIES: Record<Personality, { emoji: string; label: string; likes: string }> = {
  foodie: { emoji: "🍙", label: "먹보", likes: "맛있는 식당과 가게" },
  sporty: { emoji: "⚽", label: "운동광", likes: "공원과 헬스장" },
  bookworm: { emoji: "📚", label: "책벌레", likes: "조용한 공원과 연구소" },
  stylish: { emoji: "🎀", label: "멋쟁이", likes: "분수·동상 같은 멋진 곳" },
};

export interface ResidentDef {
  id: string;
  name: string;
  emoji: string;
  personality: Personality;
  /** Buildings this resident loves; a new one makes their heart grow. */
  favorites: readonly BuildingType[];
  /** Said at the end of sentences, like a real neighbour's habit. */
  catchphrase: string;
  lines: readonly string[];
}

export const RESIDENTS: readonly ResidentDef[] = [
  {
    id: "toto", name: "토토", emoji: "🐰", personality: "foodie", favorites: ["cafeteria", "store"], catchphrase: "깡총",
    lines: ["당근 케이크 파는 가게 어디 없나요", "배고프면 귀가 축 처져요", "오늘 점심 메뉴는 뭘까요"],
  },
  {
    id: "mongsil", name: "몽실", emoji: "🐑", personality: "bookworm", favorites: ["park", "rnd"], catchphrase: "음메",
    lines: ["나무 그늘에서 책 읽는 게 제일 좋아요", "연구소 박사님이랑 친구가 됐어요", "조용한 마을이 좋아요"],
  },
  {
    id: "basak", name: "바삭", emoji: "🦊", personality: "stylish", favorites: ["fountain", "statue"], catchphrase: "반짝",
    lines: ["분수 앞에서 사진 찍으면 멋지게 나와요", "오늘 제 목도리 어때요", "멋진 광장이 있는 마을이 좋아요"],
  },
  {
    id: "kungkung", name: "쿵쿵", emoji: "🐻", personality: "sporty", favorites: ["gym", "park"], catchphrase: "으랏차",
    lines: ["아침마다 공원을 열 바퀴 뛰어요", "근육이 오늘도 인사해요", "같이 운동할 친구 구해요"],
  },
  {
    id: "kongi", name: "콩이", emoji: "🐹", personality: "foodie", favorites: ["store", "cafeteria"], catchphrase: "냠냠",
    lines: ["볼에 해바라기씨를 잔뜩 넣었어요", "새 가게가 생기면 제일 먼저 가 볼래요", "간식은 언제나 옳아요"],
  },
  {
    id: "ruru", name: "루루", emoji: "🐱", personality: "stylish", favorites: ["ferris", "fountain"], catchphrase: "야옹",
    lines: ["놀이기구 꼭대기에서 노을을 보고 싶어요", "제 털은 오늘도 윤기 반짝", "예쁜 마을에 살고 싶어요"],
  },
  {
    id: "penggu", name: "펭구", emoji: "🐧", personality: "sporty", favorites: ["park", "gym"], catchphrase: "뒤뚱",
    lines: ["겨울이 제일 신나요", "미끄럼 타기 대회 나갈 거예요", "운동하고 먹는 생선이 꿀맛이에요"],
  },
  {
    id: "buong", name: "부엉", emoji: "🦉", personality: "bookworm", favorites: ["lab", "clinic"], catchphrase: "부엉",
    lines: ["밤에 별을 보며 공부해요", "데이터센터 불빛이 별처럼 예뻐요", "모르는 건 물어봐요, 다 알려 줄게요"],
  },
  {
    id: "dalbong", name: "달봉", emoji: "🐿️", personality: "foodie", favorites: ["cafeteria", "park"], catchphrase: "도토리",
    lines: ["도토리를 공원에 숨겨 놨어요. 비밀이에요", "식당 밥이 엄마 밥처럼 맛있어요", "겨울 간식을 모으는 중이에요"],
  },
  {
    id: "coco", name: "코코", emoji: "🐨", personality: "bookworm", favorites: ["park", "daycare"], catchphrase: "느릿",
    lines: ["천천히 걸어도 괜찮아요", "어린이집 아이들한테 동화를 읽어 줘요", "낮잠 자기 좋은 마을이에요"],
  },
  {
    id: "jjakjjak", name: "짹짹", emoji: "🐤", personality: "sporty", favorites: ["gym", "fountain"], catchphrase: "짹",
    lines: ["분수에서 물장구치는 게 제일 좋아요", "오늘도 아침 체조 완료", "작아도 힘은 세요"],
  },
  {
    id: "pinky", name: "핑키", emoji: "🐷", personality: "stylish", favorites: ["statue", "store"], catchphrase: "꿀꿀",
    lines: ["드래곤 동상 옆에서 패션쇼 하고 싶어요", "새 옷 사러 매장에 가요", "오늘의 포인트는 분홍 리본"],
  },
];

export const RESIDENT_MAP: Record<string, ResidentDef> = Object.fromEntries(RESIDENTS.map((r) => [r.id, r]));

/** Every resident line ends with their catchphrase, e.g. "…좋아요, 깡총!" */
export function residentSays(def: ResidentDef, line: string): string {
  return `${line}, ${def.catchphrase}!`;
}

// Motif templates inspired by well-known listed companies worldwide. Names are
// lightly fictionalised; values are balanced game profiles, NOT real financials.
// Selecting a preset pre-fills industry, country, starting scale and brand color.
// Each industry has at least 2 representatives so AI picks are always diverse.

export interface CompanyPreset {
  id: string;
  name: string;
  industryId: string;
  countryId: string;
  logoColor: string;
  /** Relative starting scale multiplier for capabilities; player cash stays fixed. */
  scale: number;
  blurb: string;
  /** Distinctive icon/emoji mark for the company logo badge. */
  mark?: string;
}

export const COMPANY_PRESETS: CompanyPreset[] = [
  // ── AI·반도체 ────────────────────────────────────────────────────────────
  { id: "samsong",    name: "삼송전자",    industryId: "ai",            countryId: "kr", logoColor: "#1428a0", scale: 1.6, blurb: "반도체·전자 거인",     mark: "🔷" },
  { id: "pear",       name: "페어",        industryId: "ai",            countryId: "us", logoColor: "#555555", scale: 1.8, blurb: "프리미엄 디바이스",    mark: "🍐" },
  { id: "nvidcondor", name: "엔비콘",      industryId: "ai",            countryId: "us", logoColor: "#76b900", scale: 1.6, blurb: "AI 가속 칩",           mark: "🟩" },

  // ── IT·소프트웨어 ────────────────────────────────────────────────────────
  { id: "naber",      name: "네버",        industryId: "tech",          countryId: "kr", logoColor: "#03c75a", scale: 1.2, blurb: "검색·플랫폼",          mark: "🔍" },
  { id: "kakdo",      name: "카카도",      industryId: "tech",          countryId: "kr", logoColor: "#ffcd00", scale: 1.1, blurb: "메신저·핀테크",        mark: "💬" },
  { id: "softmax",    name: "소프트맥스",  industryId: "tech",          countryId: "us", logoColor: "#00a4ef", scale: 1.7, blurb: "소프트웨어·클라우드",  mark: "🪟" },
  { id: "amazonia",   name: "아마조니아",  industryId: "tech",          countryId: "us", logoColor: "#ff9900", scale: 1.7, blurb: "전자상거래·클라우드",  mark: "📦" },
  { id: "sapphire",   name: "사파이어",    industryId: "tech",          countryId: "de", logoColor: "#0faaff", scale: 1.3, blurb: "기업용 소프트웨어",    mark: "☁️" },
  { id: "alibobo",    name: "알리보보",    industryId: "tech",          countryId: "cn", logoColor: "#ff6a00", scale: 1.6, blurb: "전자상거래",            mark: "🛒" },
  { id: "infobyte",   name: "인포바이트",  industryId: "tech",          countryId: "in", logoColor: "#007cc3", scale: 1.1, blurb: "IT 서비스",            mark: "💡" },

  // ── 전기차·배터리 ────────────────────────────────────────────────────────
  { id: "hyundo",     name: "현도자동차",  industryId: "ev",            countryId: "kr", logoColor: "#002c5f", scale: 1.4, blurb: "글로벌 완성차",        mark: "🚘" },
  { id: "voltra",     name: "볼트라",      industryId: "ev",            countryId: "us", logoColor: "#cc0000", scale: 1.5, blurb: "전기차·에너지",        mark: "⚡" },
  { id: "tonota",     name: "토노타",      industryId: "ev",            countryId: "jp", logoColor: "#eb0a1e", scale: 1.5, blurb: "하이브리드·완성차",    mark: "🏎️" },
  { id: "benzwerk",   name: "벤츠베르크",  industryId: "ev",            countryId: "de", logoColor: "#00adef", scale: 1.4, blurb: "프리미엄 자동차",      mark: "💠" },
  { id: "byvolt",     name: "비볼트",      industryId: "ev",            countryId: "cn", logoColor: "#d81e06", scale: 1.4, blurb: "전기차·배터리",        mark: "🔋" },

  // ── 게임·엔터 ────────────────────────────────────────────────────────────
  { id: "starflix",   name: "스타플릭스",  industryId: "entertainment", countryId: "us", logoColor: "#e50914", scale: 1.2, blurb: "스트리밍",             mark: "🎬" },
  { id: "sany",       name: "사니",        industryId: "entertainment", countryId: "jp", logoColor: "#000000", scale: 1.3, blurb: "전자·게임·엔터",       mark: "🎵" },
  { id: "nintondo",   name: "닌텐도우",    industryId: "entertainment", countryId: "jp", logoColor: "#e60012", scale: 1.2, blurb: "게임 콘솔",            mark: "🕹️" },
  { id: "tencube",    name: "텐큐브",      industryId: "entertainment", countryId: "cn", logoColor: "#1296db", scale: 1.5, blurb: "게임·메신저",          mark: "🐧" },

  // ── 우주항공 ─────────────────────────────────────────────────────────────
  { id: "starlinkr",  name: "스타링커",    industryId: "space",         countryId: "us", logoColor: "#111827", scale: 1.4, blurb: "민간 우주",            mark: "🚀" },
  { id: "aerojet",    name: "에어로젯",    industryId: "space",         countryId: "us", logoColor: "#1e40af", scale: 1.2, blurb: "항공·방산",            mark: "✈️" },

  // ── 로봇·자동화 ──────────────────────────────────────────────────────────
  { id: "siemann",    name: "지멘",        industryId: "robotics",      countryId: "de", logoColor: "#009999", scale: 1.4, blurb: "산업 자동화",          mark: "🏭" },
  { id: "fanuku",     name: "파누크",      industryId: "robotics",      countryId: "jp", logoColor: "#ffd700", scale: 1.3, blurb: "산업로봇·CNC",         mark: "🤖" },

  // ── 제조 ─────────────────────────────────────────────────────────────────
  { id: "steelmax",   name: "스틸맥스",    industryId: "manufacturing", countryId: "kr", logoColor: "#b45309", scale: 1.3, blurb: "철강·중공업",          mark: "⚒️" },
  { id: "giantwork",  name: "자이언트웍스",industryId: "manufacturing", countryId: "us", logoColor: "#1e40af", scale: 1.4, blurb: "산업기계·에너지장비",  mark: "🏗️" },

  // ── 식품·외식 ────────────────────────────────────────────────────────────
  { id: "nestview",   name: "네슬레뷰",    industryId: "food",          countryId: "de", logoColor: "#b91c1c", scale: 1.3, blurb: "글로벌 식품기업",      mark: "🍫" },
  { id: "kfood",      name: "케이푸드",    industryId: "food",          countryId: "kr", logoColor: "#16a34a", scale: 1.1, blurb: "K푸드·스낵·라면",      mark: "🍜" },

  // ── 패션·뷰티 ────────────────────────────────────────────────────────────
  { id: "zaralink",   name: "자라링크",    industryId: "fashion",       countryId: "de", logoColor: "#7c3aed", scale: 1.2, blurb: "패스트패션",           mark: "👗" },
  { id: "nikestar",   name: "나이크스타",  industryId: "fashion",       countryId: "us", logoColor: "#111827", scale: 1.4, blurb: "스포츠웨어·신발",      mark: "👟" },

  // ── 에너지 ───────────────────────────────────────────────────────────────
  { id: "shelloil",   name: "쉘오일",      industryId: "energy",        countryId: "de", logoColor: "#dc2626", scale: 1.5, blurb: "석유·가스 메이저",     mark: "🐚" },
  { id: "ecopower",   name: "에코파워",    industryId: "energy",        countryId: "us", logoColor: "#10b981", scale: 1.2, blurb: "신재생에너지",          mark: "🌿" },

  // ── 금융 ─────────────────────────────────────────────────────────────────
  { id: "goldberg",   name: "골드버그",    industryId: "finance",       countryId: "us", logoColor: "#b45309", scale: 1.6, blurb: "투자은행·자산관리",    mark: "💰" },
  { id: "kbfinance",  name: "KB파이낸셜",  industryId: "finance",       countryId: "kr", logoColor: "#f59e0b", scale: 1.3, blurb: "은행·금융지주",        mark: "🏦" },

  // ── 바이오·제약 ──────────────────────────────────────────────────────────
  { id: "phyzerx",    name: "파이저X",     industryId: "bio",           countryId: "us", logoColor: "#1d4ed8", scale: 1.5, blurb: "글로벌 제약·백신",     mark: "💊" },
  { id: "celltrion",  name: "셀트리온바이오",industryId: "bio",          countryId: "kr", logoColor: "#8b5cf6", scale: 1.2, blurb: "바이오시밀러·신약",    mark: "🧬" },

  // ── 핀테크·블록체인 ──────────────────────────────────────────────────────
  { id: "coinbace",   name: "코인바스",    industryId: "crypto_co",     countryId: "us", logoColor: "#0ea5e9", scale: 1.3, blurb: "암호화폐 거래소",      mark: "🔵" },
  { id: "upvit",      name: "업비트X",     industryId: "crypto_co",     countryId: "kr", logoColor: "#ef4444", scale: 1.1, blurb: "디지털자산 플랫폼",    mark: "📈" },
];

export const PRESET_MAP: Record<string, CompanyPreset> = Object.fromEntries(
  COMPANY_PRESETS.map((p) => [p.id, p]),
);

// Extra fictional listings that never appear as in-game competitors, but are
// always investable on the market — so players can build a broad, diversified
// portfolio across companies that "don't show up in this game".
export const EXTRA_LISTINGS: CompanyPreset[] = [
  // AI·반도체
  { id: "x-quantix",   name: "퀀틱스반도체",  industryId: "ai",            countryId: "us", logoColor: "#0ea5e9", scale: 1.5, blurb: "AI 가속 반도체",   mark: "🔬" },
  { id: "x-tsensei",   name: "TS센세이",      industryId: "ai",            countryId: "kr", logoColor: "#7c3aed", scale: 1.4, blurb: "파운드리",          mark: "⚙️" },
  { id: "x-deepmindr", name: "딥마인더",      industryId: "ai",            countryId: "us", logoColor: "#2563eb", scale: 1.6, blurb: "생성형 AI 연구",    mark: "🧠" },
  // IT·소프트웨어
  { id: "x-cloudpeak", name: "클라우드픽",    industryId: "tech",          countryId: "us", logoColor: "#10b981", scale: 1.4, blurb: "클라우드 인프라",   mark: "🌤️" },
  { id: "x-datagrid",  name: "데이터그리드",  industryId: "tech",          countryId: "in", logoColor: "#f59e0b", scale: 1.2, blurb: "데이터 플랫폼",     mark: "📊" },
  { id: "x-bitnest",   name: "비트네스트",    industryId: "tech",          countryId: "kr", logoColor: "#ef4444", scale: 1.0, blurb: "보안 SaaS",         mark: "🛡️" },
  // 전기차·배터리
  { id: "x-voltway",   name: "볼트웨이",      industryId: "ev",            countryId: "us", logoColor: "#22c55e", scale: 1.3, blurb: "전기 상용차",       mark: "🚐" },
  { id: "x-cellforge", name: "셀포지",        industryId: "ev",            countryId: "cn", logoColor: "#0891b2", scale: 1.4, blurb: "배터리 셀",         mark: "⚗️" },
  // 게임·엔터
  { id: "x-pixelpop",  name: "픽셀팝",        industryId: "entertainment", countryId: "jp", logoColor: "#ec4899", scale: 1.1, blurb: "모바일 게임",       mark: "🎮" },
  { id: "x-streamly",  name: "스트림리",      industryId: "entertainment", countryId: "us", logoColor: "#f43f5e", scale: 1.2, blurb: "라이브 스트리밍",   mark: "📺" },
  // 우주항공
  { id: "x-orbital",   name: "오비탈다이내믹", industryId: "space",        countryId: "us", logoColor: "#1f2937", scale: 1.3, blurb: "위성 발사",         mark: "🛸" },
  // 로봇
  { id: "x-mechwave",  name: "메크웨이브",    industryId: "robotics",      countryId: "de", logoColor: "#14b8a6", scale: 1.2, blurb: "협동로봇",          mark: "🦾" },
  // 제조
  { id: "x-forgeco",   name: "포지코",        industryId: "manufacturing", countryId: "kr", logoColor: "#a16207", scale: 1.1, blurb: "정밀부품",          mark: "🔩" },
  // 식품
  { id: "x-freshbite", name: "프레시바이트",  industryId: "food",          countryId: "us", logoColor: "#65a30d", scale: 1.1, blurb: "건강식품",          mark: "🥗" },
  // 패션·뷰티
  { id: "x-luxede",    name: "럭세드",        industryId: "fashion",       countryId: "de", logoColor: "#9333ea", scale: 1.2, blurb: "명품 패션",         mark: "💎" },
  // 에너지
  { id: "x-sungrid",   name: "선그리드",      industryId: "energy",        countryId: "us", logoColor: "#facc15", scale: 1.2, blurb: "태양광",            mark: "☀️" },
  // 금융
  { id: "x-meridian",  name: "메리디안뱅크",  industryId: "finance",       countryId: "us", logoColor: "#0369a1", scale: 1.4, blurb: "글로벌 은행",       mark: "🏛️" },
  // 바이오
  { id: "x-genecure",  name: "진큐어",        industryId: "bio",           countryId: "kr", logoColor: "#db2777", scale: 1.2, blurb: "유전자 치료",       mark: "🧪" },
  // 핀테크·블록체인
  { id: "x-chainly",   name: "체인리",        industryId: "crypto_co",     countryId: "us", logoColor: "#6366f1", scale: 1.1, blurb: "블록체인 인프라",   mark: "⛓️" },
];

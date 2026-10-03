export interface IndustryProductDef {
  id: string;
  name: string;
  emoji: string;
  demandShare: number;  // fraction of total demand (sums to ~1 for first 3)
  priceRatio: number;   // default price relative to industry.basePrice
  qualityRequired: number; // minimum company quality to offer this tier
  isRndUnlock: boolean; // if true, requires rndUnlockDone on company
}

export const INDUSTRY_PRODUCTS: Record<string, IndustryProductDef[]> = {
  tech: [
    { id: "p1", name: "기본 앱",          emoji: "📱", demandShare: 0.50, priceRatio: 0.6, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "프로 소프트웨어",   emoji: "💻", demandShare: 0.35, priceRatio: 1.0, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "회사용 프로그램",emoji: "🖥️", demandShare: 0.15, priceRatio: 2.0, qualityRequired: 55, isRndUnlock: false },
    { id: "p4", name: "AI 플랫폼",         emoji: "🤖", demandShare: 0.10, priceRatio: 3.5, qualityRequired: 75, isRndUnlock: true  },
  ],
  manufacturing: [
    { id: "p1", name: "표준 부품",    emoji: "⚙️",  demandShare: 0.50, priceRatio: 0.7, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "정밀 기계",    emoji: "🔧",  demandShare: 0.35, priceRatio: 1.1, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "산업용 장비",  emoji: "🏗️",  demandShare: 0.15, priceRatio: 2.2, qualityRequired: 55, isRndUnlock: false },
    { id: "p4", name: "똑똑한 공장 기계",emoji: "🤖",  demandShare: 0.08, priceRatio: 4.0, qualityRequired: 75, isRndUnlock: true  },
  ],
  food: [
    { id: "p1", name: "일반 식품",    emoji: "🥫",  demandShare: 0.55, priceRatio: 0.7, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "간편 도시락",   emoji: "🍱",  demandShare: 0.30, priceRatio: 1.1, qualityRequired: 20, isRndUnlock: false },
    { id: "p3", name: "프리미엄 식품", emoji: "🍽️", demandShare: 0.15, priceRatio: 1.8, qualityRequired: 50, isRndUnlock: false },
    { id: "p4", name: "건강 식품",  emoji: "💊",  demandShare: 0.08, priceRatio: 3.0, qualityRequired: 70, isRndUnlock: true  },
  ],
  fashion: [
    { id: "p1", name: "기본 옷",      emoji: "👕", demandShare: 0.50, priceRatio: 0.6, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "유행 옷",    emoji: "👗", demandShare: 0.35, priceRatio: 1.2, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "명품 옷",      emoji: "💎", demandShare: 0.15, priceRatio: 2.5, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "한정판 옷", emoji: "✨",  demandShare: 0.08, priceRatio: 5.0, qualityRequired: 80, isRndUnlock: true  },
  ],
  energy: [
    { id: "p1", name: "기본 에너지",  emoji: "⚡",  demandShare: 0.55, priceRatio: 0.8, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "산업용 에너지",emoji: "🔌",  demandShare: 0.30, priceRatio: 1.1, qualityRequired: 20, isRndUnlock: false },
    { id: "p3", name: "청정 에너지",  emoji: "🌱",  demandShare: 0.15, priceRatio: 1.7, qualityRequired: 50, isRndUnlock: false },
    { id: "p4", name: "수소 에너지",  emoji: "💧",  demandShare: 0.08, priceRatio: 3.0, qualityRequired: 75, isRndUnlock: true  },
  ],
  finance: [
    { id: "p1", name: "기본 통장",   emoji: "🏧", demandShare: 0.50, priceRatio: 0.7, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "투자 서비스",     emoji: "📈", demandShare: 0.35, priceRatio: 1.2, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "부자 고객 서비스",  emoji: "💰", demandShare: 0.15, priceRatio: 2.5, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "모바일 돈 관리 앱",emoji: "📊", demandShare: 0.08, priceRatio: 3.5, qualityRequired: 75, isRndUnlock: true  },
  ],
  entertainment: [
    { id: "p1", name: "기본 게임",   emoji: "🎮", demandShare: 0.50, priceRatio: 0.6, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "콘솔·PC 게임",emoji: "🕹️", demandShare: 0.35, priceRatio: 1.2, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "대작 게임", emoji: "🏆",  demandShare: 0.15, priceRatio: 2.0, qualityRequired: 55, isRndUnlock: false },
    { id: "p4", name: "VR 가상 세계", emoji: "🥽", demandShare: 0.10, priceRatio: 3.5, qualityRequired: 75, isRndUnlock: true  },
  ],
  bio: [
    { id: "p1", name: "일반 의약품",   emoji: "💊", demandShare: 0.50, priceRatio: 0.7, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "처방 의약품",   emoji: "🩺", demandShare: 0.35, priceRatio: 1.5, qualityRequired: 30, isRndUnlock: false },
    { id: "p3", name: "바이오 신약",  emoji: "🧬", demandShare: 0.15, priceRatio: 3.0, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "기적의 신약",emoji: "✨", demandShare: 0.08, priceRatio: 6.0, qualityRequired: 80, isRndUnlock: true  },
  ],
  ai: [
    { id: "p1", name: "AI 도우미 서비스",  emoji: "🔌", demandShare: 0.50, priceRatio: 0.6, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "회사용 AI",      emoji: "🤖", demandShare: 0.35, priceRatio: 1.3, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "맞춤형 AI 모델", emoji: "🧠", demandShare: 0.15, priceRatio: 3.0, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "만능 AI",     emoji: "💫", demandShare: 0.10, priceRatio: 8.0, qualityRequired: 85, isRndUnlock: true  },
  ],
  robotics: [
    { id: "p1", name: "산업용 로봇팔", emoji: "🦾", demandShare: 0.50, priceRatio: 0.8, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "협동 로봇",     emoji: "🤝", demandShare: 0.35, priceRatio: 1.3, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "자율주행 로봇", emoji: "🚗", demandShare: 0.15, priceRatio: 2.5, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "인간형 로봇",   emoji: "🦿", demandShare: 0.08, priceRatio: 5.0, qualityRequired: 80, isRndUnlock: true  },
  ],
  space: [
    { id: "p1", name: "위성 서비스",  emoji: "📡", demandShare: 0.50, priceRatio: 0.8, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "로켓 발사 서비스",emoji: "🚀", demandShare: 0.35, priceRatio: 1.5, qualityRequired: 30, isRndUnlock: false },
    { id: "p3", name: "우주 관광",    emoji: "🌌", demandShare: 0.15, priceRatio: 3.0, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "우주 정거장",  emoji: "🛸", demandShare: 0.08, priceRatio: 7.0, qualityRequired: 85, isRndUnlock: true  },
  ],
  ev: [
    { id: "p1", name: "작은 전기차",    emoji: "🚗", demandShare: 0.50, priceRatio: 0.7, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "중형 전기차",  emoji: "🚙", demandShare: 0.35, priceRatio: 1.2, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "프리미엄 전기차",emoji: "🏎️",demandShare: 0.15, priceRatio: 2.5, qualityRequired: 60, isRndUnlock: false },
    { id: "p4", name: "스스로 달리는 전기차",  emoji: "✨", demandShare: 0.08, priceRatio: 4.5, qualityRequired: 80, isRndUnlock: true  },
  ],
  crypto_co: [
    { id: "p1", name: "코인 거래소", emoji: "💹", demandShare: 0.50, priceRatio: 0.6, qualityRequired: 0,  isRndUnlock: false },
    { id: "p2", name: "블록체인 은행",  emoji: "⛓️", demandShare: 0.35, priceRatio: 1.2, qualityRequired: 25, isRndUnlock: false },
    { id: "p3", name: "디지털 그림(NFT)",emoji: "🎨",demandShare: 0.15, priceRatio: 2.0, qualityRequired: 50, isRndUnlock: false },
    { id: "p4", name: "블록체인 인터넷",  emoji: "🌐", demandShare: 0.10, priceRatio: 3.5, qualityRequired: 75, isRndUnlock: true  },
  ],
};

export function getIndustryProducts(industryId: string): IndustryProductDef[] {
  return INDUSTRY_PRODUCTS[industryId] ?? INDUSTRY_PRODUCTS.tech;
}

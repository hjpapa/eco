import type { BuildingType, CharacterRole } from "@/lib/engine";

export const BUILDING_IMG: Partial<Record<BuildingType, string>> = {
  ferris:    "/assets/buildings/themepark.svg",
  office:    "/assets/buildings/office.png",
  factory:   "/assets/buildings/factory.png",
  rnd:       "/assets/buildings/rnd.png",
  store:     "/assets/buildings/store.png",
  warehouse: "/assets/buildings/warehouse.png",
  cafeteria: "/assets/buildings/cafeteria.png",
  gym:       "/assets/buildings/gym.png",
  daycare:   "/assets/buildings/daycare.png",
  clinic:    "/assets/buildings/clinic.png",
  power:     "/assets/buildings/power.png",
  hr:        "/assets/buildings/hr.png",
  park:      "/assets/buildings/park.png",
  dorm:      "/assets/buildings/dorm.png",
  lab:       "/assets/buildings/lab.png",
};

// Management decision icons (one per slider label).
export const MGMT_ICONS = {
  price:      "/assets/icons/icon_price.png",
  production: "/assets/icons/icon_production.png",
  marketing:  "/assets/icons/icon_marketing.png",
  rnd:        "/assets/icons/icon_rnd.png",
  welfare:    "/assets/icons/icon_welfare.png",
  safety:     "/assets/icons/icon_safety.png",
} as const;

// Economy indicator icons (for EconomyIndicators panel).
export const ECONOMY_ICONS = {
  gdp:       "/assets/icons/icon_gdp.png",
  inflation: "/assets/icons/icon_inflation.png",
  rate:      "/assets/icons/icon_rate.png",
  sentiment: "/assets/icons/icon_sentiment.png",
} as const;

// Dashboard / finance icons.
export const FINANCE_ICONS = {
  cash:          "/assets/icons/icon_cash.png",
  portfolio:     "/assets/icons/icon_portfolio.png",
  companyValue:  "/assets/icons/icon_company_value.png",
  debt:          "/assets/icons/icon_debt.png",
} as const;

export const MASCOT_IMG = "/assets/mascot/dragon.png";

// Per-role images used when no per-character image is assigned.
export const ROLE_IMG: Partial<Record<CharacterRole, string>> = {
  ceo:  "/assets/characters/role_strategy.png",
  cto:  "/assets/characters/role_researcher.png",
  cmo:  "/assets/characters/role_marketing.png",
  cfo:  "/assets/characters/role_finance.png",
  coo:  "/assets/characters/role_sales.png",
  chro: "/assets/characters/role_hr.png",
};

// 32 diverse talent portraits (img_07 × 16 + img_08 × 16).
// Use charCodeSum(character.id) % TALENT_IMGS.length to pick deterministically.
export const TALENT_IMGS: string[] = Array.from({ length: 32 }, (_, i) =>
  `/assets/characters/talent_${String(i + 1).padStart(2, "0")}.png`,
);

// 32 famous-person portraits (img_09 × 16 + img_10 × 16) for visitor events.
export const FAMOUS_IMGS: string[] = Array.from({ length: 32 }, (_, i) =>
  `/assets/characters/famous_${String(i + 1).padStart(2, "0")}.png`,
);

/** Deterministic index into an image array from a string id. */
export function idToIndex(id: string, len: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

export const SECRETARY_IMG = "/assets/characters/secretary.png";
export const ICON_STOCK    = "/assets/icons/stock.png";
export const ICON_NEWS     = "/assets/icons/news.png";

// Economy phase icons
export const PHASE_ICONS: Record<string, string> = {
  boom:        "/assets/icons/phase_boom.png",
  normal:      "/assets/icons/phase_normal.png",
  recession:   "/assets/icons/phase_recession.png",
  inflation:   "/assets/icons/phase_inflation.png",
  deflation:   "/assets/icons/phase_deflation.png",
  stagflation: "/assets/icons/phase_stagflation.png",
};

// Tab navigation icons
export const TAB_ICONS = {
  home:    "/assets/icons/tab_home.png",
  company: "/assets/icons/tab_company.png",
  invest:  "/assets/icons/tab_invest.png",
  talent:  "/assets/icons/tab_talent.png",
  news:    "/assets/icons/tab_news.png",
  rank:    "/assets/icons/tab_rank.png",
  visit:   "/assets/icons/tab_visit.png",
} as const;

// Quickfact dashboard icons
export const FACT_ICONS = {
  revenue:   "/assets/icons/fact_revenue.png",
  profit:    "/assets/icons/fact_profit.png",
  buildings: "/assets/icons/fact_buildings.png",
  staff:     "/assets/icons/fact_staff.png",
} as const;

// Result/game-over illustrations
export const RESULT_ICONS = {
  win: "/assets/mascot/dragon.png",
  end: "/assets/mascot/dragon.png",
} as const;

// Investment asset class icons
export const ASSET_ICONS: Record<string, string> = {
  deposit:    "/assets/icons/asset_deposit.png",
  bond:       "/assets/icons/asset_bond.png",
  etf:        "/assets/icons/asset_etf.png",
  realestate: "/assets/icons/asset_realestate.png",
  gold:       "/assets/icons/asset_gold.png",
  oil:        "/assets/icons/asset_oil.png",
  fx:         "/assets/icons/asset_fx.png",
  crypto:     "/assets/icons/asset_crypto.png",
};

// Event banners
export const BANNER_IMGS = {
  positive: "/assets/banners/banner_positive.png",
  negative: "/assets/banners/banner_negative.png",
  neutral:  "/assets/banners/banner_neutral.png",
  report:   "/assets/banners/banner_report.png",
} as const;

// TODO(asset): seasonal art for the village upgrade. Until these files exist
// the game uses emoji and primitive 3D colours (components/seasonTheme.ts), so
// nothing here is referenced yet. Fill the paths when the images are drawn.
export const SEASON_ART_TODO = {
  springBanner: "/assets/seasons/spring_blossom.png",
  summerBanner: "/assets/seasons/summer_splash.png",
  autumnBanner: "/assets/seasons/autumn_harvest.png",
  winterBanner: "/assets/seasons/winter_snow.png",
} as const;

// TODO(asset): portraits for the named village neighbours (lib/data/residents.ts).
// The game shows their emoji until these exist; nothing references them yet.
export const RESIDENT_ART_TODO: Record<string, string> = {
  toto: "/assets/residents/toto.png",
  mongsil: "/assets/residents/mongsil.png",
  basak: "/assets/residents/basak.png",
  kungkung: "/assets/residents/kungkung.png",
  kongi: "/assets/residents/kongi.png",
  ruru: "/assets/residents/ruru.png",
  penggu: "/assets/residents/penggu.png",
  buong: "/assets/residents/buong.png",
  dalbong: "/assets/residents/dalbong.png",
  coco: "/assets/residents/coco.png",
  jjakjjak: "/assets/residents/jjakjjak.png",
  pinky: "/assets/residents/pinky.png",
};

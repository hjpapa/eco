# 추가로 필요한 일러스트 에셋 프롬프트 (Needed-only)

> 이 파일은 **아직 이모지로 대체 중이라 새로 제작이 필요한 에셋의 프롬프트만** 모은 문서입니다.
> 이미 완성된 에셋(건물 14종 · 인재/유명인 초상 · 역할 · 경영/경제/재무 아이콘 · 마스코트) 현황과
> 전체 가이드는 `scripts/asset-prompts.md`를 참고하세요.

공통 규칙
- 정사각 아이콘/캐릭터: 512×512 또는 256×256, **흰색 또는 투명 배경**
- 배너/씬: 비율 표기를 따르고 여백 여유
- 제작 후 `scripts/process-assets.py`로 전처리(흰 배경 임계값 235 → 투명)
- 우선순위: ⭐ 높음 / ☆ 낮음

---

## 1. ⭐ 이벤트 팝업 배너 4종
배치: `public/assets/banners/` · 사이즈: **1280×400px (약 16:5)**
용도: 분기 진행 시 뜨는 속보/실적 팝업(`EventPopup`·`ResultsPopup`) 헤더. 현재 📣📊📉 이모지.

**`banner_positive.png` (호재)**
```
Wide cartoon banner illustration (1280x400), bull market celebration,
a rising green stock chart arrow, gold coins and confetti raining,
cheerful chibi business people clapping, bright green and gold palette,
Korean educational game art style, clean, not too busy
```

**`banner_negative.png` (악재)**
```
Wide cartoon banner illustration (1280x400), bear market mood,
a falling red/blue stock chart arrow, a worried but cute chibi businessperson,
soft rainy blue-gray palette, still friendly cartoon (not scary),
Korean educational game art style
```

**`banner_neutral.png` (중립/속보)**
```
Wide cartoon banner illustration (1280x400), breaking-news broadcast scene,
a cute news anchor or microphone with a "속보" ribbon, neutral slate-blue palette,
Korean educational game art style, clean and simple
```

**`banner_report.png` (분기 실적 보고 배경)**
```
Wide cartoon banner (1280x400), modern Korean office conference room,
presentation screen showing bar/line charts, floor-to-ceiling city-view windows,
warm professional cream and light-blue palette, webtoon style
```

---

## 2. ⭐ 경제 국면 아이콘 6종
배치: `public/assets/icons/` · 사이즈: **128×128px, 투명 배경**, 동일 톤
용도: 경제 국면 표시(`EconomyIndicators`, 엔진 `PHASE_EMOJI`). 현재 🚀🙂📉🔥🧊🌫️.

```
A set of 6 flat round economy-state icons (128x128 each, transparent background),
consistent cute game-UI style, two-tone with a soft circular badge behind:
- boom (호황): rocket / upward green arrow, energetic
- normal (안정): calm smiling sun or steady balance scale
- recession (경기침체): downward red arrow / drooping graph
- inflation (인플레이션): flame with a rising price tag
- deflation (디플레이션): ice / snowflake with a falling price tag
- stagflation (스태그플레이션): fog cloud with a flat-but-hot mixed symbol
Minimalist, clean, matching existing economy indicator icons
```
파일명: `phase_boom.png`, `phase_normal.png`, `phase_recession.png`, `phase_inflation.png`, `phase_deflation.png`, `phase_stagflation.png`

---

## 3. ⭐ 하단 탭 아이콘 7종
배치: `public/assets/icons/` · 사이즈: **96×96px, 투명 배경**, 단색 틴트가 잘 먹도록 단순하게
용도: play 화면 하단 탭바(`app/play/page.tsx`). 현재 🏠🏙️📈👔📰🏆🌍.

```
A set of 7 simple flat navigation icons (96x96, transparent background),
single-shape silhouettes that read well when tinted one color:
- 대시보드(home): house / dashboard gauge
- 회사(company): isometric office building cluster
- 투자(invest): line chart with upward arrow
- 인재(talent): person with tie / ID badge
- 뉴스(news): newspaper
- 순위(rank): trophy
- 방문(visit): globe / world map pin
Clean minimal game-UI icon set, consistent stroke weight
```
파일명: `tab_home.png`, `tab_company.png`, `tab_invest.png`, `tab_talent.png`, `tab_news.png`, `tab_rank.png`, `tab_visit.png`

---

## 4. ☆ 대시보드 퀵팩트 / 결과·게임오버 일러스트

**4-1. 퀵팩트 미니카드 아이콘 (96×96, 투명)** — Dashboard `Mini` (현재 💵📈🏗️👔)
- 지난 매출: 지폐 다발 / ₩
- 지난 이익: 위/아래 화살표가 있는 미니 차트
- 건물 수: 크레인 + 건물
- 임원 수: 넥타이 / 사원증
파일명: `fact_revenue.png`, `fact_profit.png`, `fact_buildings.png`, `fact_staff.png`

**4-2. 결과·게임오버 히어로 (512×512, 투명)** — `ResultsPopup`/`GameOver` (현재 🏆🎮)
```
Two celebratory cartoon scenes (512x512, transparent), Korean game style:
- win: a cute dragon mascot holding a #1 gold trophy, confetti, mountain-city celebration
- end (non-win): the dragon mascot waving "수고했어요", friendly encouraging
Matching the existing Dragon Mountain City dragon mascot design
```
파일명: `result_win.png`, `result_end.png`

---

## 5. ☆ 스플래시 / OG 이미지

**`splash-dragon.png` (1920×1080 또는 1080×1920)**
```
Game splash illustration, "드래곤 마운틴 시티" title prominent,
isometric mountain cityscape skyline of cute company buildings, the dragon mascot
front and center, vibrant gradient sky (indigo to pink), Korean educational
business game, exciting and colorful, cartoon style
```

**`og.png` (1200×630)**
```
Social share card (1200x630), "드래곤 마운틴 시티 — 회사를 키우고 투자하는 경제 게임",
mountain city skyline + dragon mascot + a small rising stock chart,
bright friendly palette, large readable Korean title text
```

---

## 6. ⭐ 도시 성장 단계 배지 6종 (건설 강화)
배치: `public/assets/icons/` · 사이즈: **128×128px, 투명 배경**, 같은 톤의 세트
용도: 건설 패널의 "우리 도시" 진행도와 지도 위 도시 단계 배지, 성장 축하 팝업
(`lib/ui/cityBuilder.ts`의 `CITY_STAGES`, `components/ConstructionPanel.tsx`, `components/CompanyWorkspace.tsx`).
현재 🏡🏘️🏙️🌆🌃🐉 이모지.

```
A set of 6 round badge icons (128x128 each, transparent background) showing a
cute isometric company town growing step by step, same camera angle and palette:
- village (작은 마을): two tiny buildings and a tree on a grassy tile
- town (마을): a handful of small houses and a shop
- small-city (소도시): a few mid-rise offices, a factory chimney, a park
- city (도시): a dense cluster of office towers and warehouses
- metropolis (대도시): tall glowing skyscrapers at dusk
- dragon-city (드래곤 시티): a grand skyline on a mountain with the friendly dragon mascot curled around it
Korean educational game art style, bright, clean outlines
```
파일명: `city_village.png`, `city_town.png`, `city_small-city.png`, `city_city.png`, `city_metropolis.png`, `city_dragon-city.png`

## 7. ☆ 건물 역할 아이콘 3종 · 조합 배지 10종
배치: `public/assets/icons/` · 사이즈: **96×96px, 투명 배경**
용도: 건물 카드 위쪽 역할 색 띠(💰돈 버는 건물 / 💡똑똑한 건물 / 😊행복한 건물)와
조합 도감 항목(`BUILDING_COMBOS`의 🚚⚡📦📣💡🍱🧸🌿🧪💪). 현재 이모지·색 띠.

```
Simple flat game-UI icons (96x96, transparent), consistent stroke weight:
- role_money: gold coin stack with an upward arrow
- role_smart: light bulb with a gear
- role_happy: smiling heart
- 10 combo badges, each two small buildings joined by a glowing link, with a
  symbol for the team: delivery truck, lightning, box, megaphone, light bulb,
  lunch box, teddy bear, leaf, test tube, flexed arm
```
파일명: `role_money.png`, `role_smart.png`, `role_happy.png`, `combo_<combo-id>.png`
(combo-id: `make-and-move`, `smart-energy`, `quick-store`, `brand-center`, `idea-lab`,
`happy-lunch`, `family-campus`, `green-break`, `deep-research`, `healthy-work`)

## 8. ☆ 건물 레벨 2·3 이미지 (선택)
배치: `public/assets/buildings/` · 기존 건물 이미지와 같은 규격
용도: 업그레이드한 건물 카드·2D 지도. 지금은 같은 이미지 위에 ★ 표시만 붙여요.
파일명: `<type>_lv2.png`, `<type>_lv3.png` (예: `factory_lv2.png`) — 같은 건물을 더 크고 화려하게.

---

## 처리 & 반영

```bash
# 단일 아이콘/배너 (흰 배경 → 투명, 트림, 리사이즈)
python3 scripts/process-assets.py --input raw.png \
  --output public/assets/banners/banner_positive.png --size 1280
```

반영 절차: `lib/assetMap.ts`에 경로 상수 등록 → 해당 컴포넌트에서 이모지를 `<img>`로 교체
(`MGMT_ICONS`/`BUILDING_IMG` 패턴 참고).

# 드래곤 마운틴 시티 — 그래픽 에셋 제작 프롬프트 가이드

이미지 생성 AI(Midjourney, DALL·E, Stable Diffusion 등)에 아래 프롬프트를 붙여 넣어 에셋을 제작하세요.
공통 규칙:
- **정사각 아이콘/캐릭터**: 512×512 또는 256×256, **흰색 또는 투명 배경**
- **배너/씬 일러스트**: 비율 표기를 따르되 여백을 넉넉히
- 흰 배경은 `scripts/process-assets.py`가 자동으로 투명 처리합니다(임계값 235).

---

## 현재 에셋 현황 (2026-06)

이미 완성되어 게임에 반영된 에셋:
- ✅ **건물 14종** — office, factory, rnd, store, warehouse, cafeteria, gym, daycare, clinic, power, hr, park, dorm, lab
- ✅ **인재 초상 32종** (`talent_01~32`) — 인재시장/임원진
- ✅ **유명인 초상 32종** (`famous_01~32`) — 방문 이벤트
- ✅ **역할 이미지** (`role_*`) — ceo/cto/cmo/cfo/coo/chro 등
- ✅ **경영결정 아이콘 6종** — price/production/marketing/rnd/welfare/safety
- ✅ **경제지표 아이콘 4종** — gdp/inflation/rate/sentiment
- ✅ **재무 아이콘 4종** — cash/portfolio/company_value/debt
- ✅ **기타 아이콘** — stock, news
- ✅ **마스코트** — `mascot/dragon.png` (홈·게임 종료 히어로)

아래 1~6번이 **아직 이모지로 대체 중이라 추가 제작이 필요한 부분**입니다.
우선순위는 ⭐(높음)~☆(낮음)로 표기했습니다.

---

## 1. ⭐ 이벤트 팝업 배너 일러스트

분기 진행 시 뜨는 속보/실적 팝업(`app/play/page.tsx`의 `EventPopup`·`ResultsPopup`)은
지금 큰 이모지(📣 📊 📉)로 헤더를 채웁니다. 톤별 와이드 배너로 교체하면 임팩트가 큽니다.

배치 위치: `public/assets/banners/`
권장 사이즈: **1280×400px (약 16:5)**, 양옆 여백 여유.

### 호재 배너 (`banner_positive.png`)
```
Wide cartoon banner illustration (1280x400), bull market celebration,
a rising green stock chart arrow, gold coins and confetti raining,
cheerful chibi business people clapping, bright green and gold palette,
Korean educational game art style, clean, not too busy
```

### 악재 배너 (`banner_negative.png`)
```
Wide cartoon banner illustration (1280x400), bear market mood,
a falling red/blue stock chart arrow, a worried but cute chibi businessperson,
soft rainy blue-gray palette, still friendly cartoon (not scary),
Korean educational game art style
```

### 중립/속보 배너 (`banner_neutral.png`)
```
Wide cartoon banner illustration (1280x400), breaking-news broadcast scene,
a cute news anchor or microphone with "속보" ribbon, neutral slate-blue palette,
Korean educational game art style, clean and simple
```

### 분기 실적 보고 배경 (`banner_report.png`)
```
Wide cartoon banner (1280x400), modern Korean office conference room,
presentation screen showing bar/line charts, floor-to-ceiling city-view windows,
warm professional cream and light-blue palette, webtoon style
```

---

## 2. ⭐ 경제 국면 아이콘 6종

경제 국면은 현재 이모지(🚀 🙂 📉 🔥 🧊 🌫️)입니다 (`lib/engine/economy.ts`의 `PHASE_EMOJI`,
`components/EconomyIndicators.tsx`에서 표시). 일관된 아이콘 세트로 교체하면 좋습니다.

배치 위치: `public/assets/icons/`
사이즈: **128×128px, 투명 배경**, 동일한 라인/채색 톤.

```
A set of 6 flat round economy-state icons (128x128 each, transparent background),
consistent cute game-UI style, two-tone with a soft circular badge behind:
- boom (호황): rocket / upward green arrow, energetic
- normal (안정): calm smiling sun or steady balance scale
- recession (경기침체): downward red arrow / drooping graph
- inflation (인플레이션): flame with a rising price tag
- deflation (디플레이션): ice / snowflake with a falling price tag
- stagflation (스태그플레이션): fog cloud with a flat-but-hot mixed symbol
Minimalist, clean, matching the existing economy indicator icons
```
파일명: `phase_boom.png`, `phase_normal.png`, `phase_recession.png`, `phase_inflation.png`, `phase_deflation.png`, `phase_stagflation.png`

---

## 3. ⭐ 하단 탭 아이콘 7종

`app/play/page.tsx`의 탭바는 이모지(🏠🏙️📈👔📰🏆🌍)입니다. 픽셀/아이소메트릭 톤에 맞춘
아이콘으로 교체하면 통일감이 생깁니다.

배치 위치: `public/assets/icons/`
사이즈: **96×96px, 투명 배경**, 선택/비선택 상태에서 단색 틴트가 잘 먹도록 단순하게.

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

### 4-1. 퀵팩트 미니카드 아이콘 (Dashboard `Mini`: 💵 📈 🏗️ 👔)
사이즈 96×96, 투명 배경. 위 탭 아이콘과 같은 톤.
- 지난 매출: 지폐 다발 / ₩
- 지난 이익: 위/아래 화살표가 있는 미니 차트
- 건물 수: 크레인 + 건물
- 임원 수: 넥타이 / 사원증

### 4-2. 결과·게임오버 히어로 (`ResultsPopup`/`GameOver`)
세로 일러스트 또는 정사각, 512×512 권장.
```
Two celebratory cartoon scenes (512x512, transparent), Korean game style:
- win: a cute dragon mascot holding a #1 gold trophy, confetti, mountain-city celebration
- end (non-win): the dragon mascot waving "수고했어요", friendly encouraging
Matching the existing Dragon Mountain City dragon mascot design
```
파일명: `result_win.png`, `result_end.png`

---

## 5. ☆ 스플래시 / 로딩 / OG 이미지

홈 화면·로딩·SNS 공유 미리보기에 사용.

### 스플래시 (`splash-dragon.png`, 1920×1080 또는 1080×1920)
```
Game splash illustration, "드래곤 마운틴 시티" title prominent,
isometric mountain cityscape skyline of cute company buildings, the dragon mascot
front and center, vibrant gradient sky (indigo to pink), Korean educational
business game, exciting and colorful, cartoon style
```

### OG / 썸네일 (`og.png`, 1200×630)
```
Social share card (1200x630), "드래곤 마운틴 시티 — 회사를 키우고 투자하는 경제 게임",
mountain city skyline + dragon mascot + a small rising stock chart,
bright friendly palette, large readable Korean title text
```

---

## 6. ☆ 캐릭터/건물 다양성 확장 (선택)

현재 톤이 충분하다면 생략 가능. 더 다양한 얼굴/건물이 필요할 때만.
- 역할 이미지 대안 세트(역할별 2종 추가) — 4×2 그리드, 512×512, 기존 talent 그리드와 동일 톤
- 신규 건물 타입(예: HQ 본사 타워, 물류센터 대형, 데이터센터) — 기존 아이소메트릭 건물과 동일 스타일

---

## 처리 방법

생성한 이미지는 `scripts/process-assets.py`로 전처리합니다.

```bash
# 단일 아이콘/배너 (흰 배경 → 투명, 트림, 리사이즈)
python3 scripts/process-assets.py --input raw.png --output public/assets/banners/banner_positive.png --size 1280

# 그리드 분할 (예: 4×2 캐릭터 그리드)
python3 scripts/process-assets.py --input grid.png --cols 4 --rows 2 \
  --output-dir public/assets/characters/ --names "a,b,c,d,e,f,g,h"
```

새 에셋을 추가한 뒤에는 `lib/assetMap.ts`에 경로 상수를 등록하고 해당 컴포넌트에서
이모지를 `<img>`로 교체하면 됩니다(기존 `MGMT_ICONS`/`BUILDING_IMG` 패턴 참고).

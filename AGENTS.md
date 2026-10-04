<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 게임 업그레이드 공통 규칙

드래곤 마운틴 시티를 "초등학생용 SimCity + 동물의 숲 + 경제 시뮬레이션(아주 가볍게)"으로 키우는 작업에 공통으로 적용한다.

- 대상: 초등 4~6학년, 태블릿 터치. 새 기능은 탭으로만 쓴다(드래그 배치, 길게 누르기 금지).
- 버튼·터치 영역 44px 이상, 글자 13px 이상, 4학년이 읽을 수 있는 말(어려운 말은 괄호에).
- 이미지 에셋은 만들지 않는다. 이모지·3D 기본 도형·CSS로 임시 표현하고, 에셋이 필요한 곳은 `lib/assetMap.ts`에 TODO 키로 남긴다(에셋은 나중에 따로 작업).
- `lib/engine`은 결정적이어야 한다(같은 seed면 같은 결과). 새 무작위는 의뢰·이벤트처럼 별도 seeded RNG를 쓴다.
- 예전 세이브가 깨지면 안 된다: 새 필드는 optional로 두고 불러올 때 기본값을 채운 뒤 테스트로 확인한다.
- 이미 있는 지표(직원 만족·평판·조합·의뢰)와 겹치면 새로 만들지 말고 재사용한다.
- 완료 조건: `npm run typecheck`, `npm test`, `npm run build` 통과 + 새 기능의 vitest 테스트.
- 멀티플레이, 실시간 시계, 결제는 만들지 않는다.

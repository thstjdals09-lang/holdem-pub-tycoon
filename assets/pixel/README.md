# 도트 에셋 라이브러리 (생성 파이프라인)

## 구조
- `_anchor/` — 스타일 앵커 후보. `a1.png`을 기준으로 확정했다.
- `raw/` — 생성 원본(마젠타 배경, 1024px). 게임은 안 읽는다.
- `out/<folder>/` — 후처리 완료본. 투명 배경 PNG.

## 스타일 앵커
모든 에셋은 `a1.png`(6인 기본 포커 테이블)을 `image_references`로 물려서 생성한다.
앵커 없이 따로 뽑으면 200장의 픽셀 밀도·카메라 각도·팔레트가 전부 제각각이 된다.

Higgsfield media_id: `8217b2d2-05c7-4bf4-87c9-35f027a7847f`

## 프롬프트 규칙 (모든 에셋 공통)
- "Match the reference image exactly in art style, pixel density, isometric camera angle,
  lighting direction, outline treatment and world scale."
- 3/4 탑다운 아이소메트릭, 좌상단 광원, 안티에일리어싱 없음, 재질당 3단 명암, 접지 그림자
- **평평한 마젠타 #FF00FF 배경 위에 오브젝트 하나만** — 바닥·벽·사람·글자·UI·테두리 금지

## 후처리
```
node tools/asset-pack.mjs --pixel assets/pixel/raw assets/pixel/out/<folder> [최대변]
```
1. 마젠타 크로마키(색상 300° ±26°) → 알파 0
2. 알파 영역에 맞춰 트림
3. 알파 블리드 2패스 — 투명 픽셀 RGB를 가장자리 색으로 물들이고, 안 닿은 곳은 완전히 비운다.
   안 하면 알파를 무시하는 뷰어에서 마젠타가 보이고 보간 시 가장자리에 마젠타가 번진다.

## 알려진 이슈
- **스케일이 자동으로 맞지 않는다.** 레퍼런스를 물려도 모델이 오브젝트마다 카메라 거리를
  다르게 잡는다(예: 프리미엄 의자가 테이블 대비 과도하게 큼). 에셋별 목표 높이를 정해
  인제스트 때 리사이즈해야 한다.
- 생성물이 가끔 16비트 PNG로 온다 → 디코더가 상위 바이트만 취해 처리한다.

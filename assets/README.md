# 에셋

포스터 키비주얼의 아트 방향(파스텔 핑크·크림·우드 + 골드 포인트, 진한 브라운 아웃라인,
셀셰이딩)을 두 갈래로 나눠 만들었다.

- **반복해서 작게 뜨는 것** — UI 아이콘, 등급 카드 프레임, 배지 → **SVG 코드** (`js/assets.js`)
- **크게 한 번 보여주는 그림** — 트로피, 프레스티지 건물, 테마 썸네일, 앱 아이콘, 로딩 아트 → **PNG** (`assets/img/`)

전부 한 화면에서 보려면 **`assets-preview.html`** 을 열면 된다. 각 에셋 옆에 호출 코드가 같이 적혀 있다.

---

## 1. SVG — `js/assets.js`

외부 이미지 없이 코드로 그린다(`js/portraits.js`와 같은 철학). 그라데이션을 안 쓰는 이유는
같은 화면에 인라인 SVG가 수십 개 깔리면 `<linearGradient>`의 id가 충돌하기 때문 —
셀셰이딩은 원래 "단색 면 + 하이라이트 도형"이라 아트 방향과도 맞는다.

```js
GameAssets.icon("diamond", { size: 20 })      // <svg> 문자열 → innerHTML에 그대로
GameAssets.dataUri("diamond")                 // CSS background-image용 data URI
GameAssets.rarityBadge("epic", { w: 46 })     // N/U/R/SR/SSR/MR 알약
GameAssets.rarityFrame("legendary", { w: 124, name: "강민혁", portrait })
GameAssets.trophy("world", { size: 64 })      // PNG를 못 받았을 때의 대체본
GameAssets.building(3, { size: 120 })         // 프레스티지 건물 대체본
GameAssets.logo({ w: 320 })                   // 워드마크 (Jua 웹폰트 필요)
GameAssets.appIcon({ size: 192 })
```

아이콘 44종: 재화(bb·diamond·trophy·ticket) / 네비(build·crew·tournament·shop) /
세부 탭(table·fixture·staff·interior) / 시설·직원 개별 / 역할 4종 / 특성 6종 /
사이드 레일(gift·attendance·mission·boost) / 트로피 상점(moon·target·hall·shard) / 공용.

`GameAssets.icons()`로 전체 목록, `GameAssets.labels`로 한국어 이름을 얻는다.
기존 이모지를 점진적으로 교체할 수 있게 `icon("💎")`처럼 이모지로도 부를 수 있다.

CSS는 `css/assets.css` — 크기 프리셋(`.ga-sm`/`.ga-md`/…), 재화 표기(`.ga-cur`),
등급 광채(`.ga-aura-*`), 로딩 화면(`.ga-loading`).

## 2. PNG — `assets/img/`

| 경로 | 개수 | 크기 | 쓰는 곳 |
| --- | --- | --- | --- |
| `trophy/{local,city,national,asia,world}-{192,96}.png` | 5단계 | 6~28KB | 대회 탭 — `data.js`의 `tournament.tiers`와 id가 1:1 |
| `prestige/{pub,club,premium,empire}-{256,128}.png` | 4단계 | 8~70KB | 리뉴얼 단계 외관 |
| `theme/{classic,princess,european,neon,japanese}.png` | 5종 | ~100KB | 인테리어 탭 — `data.js`의 `themes`와 id가 1:1 |
| `brand/app-icon-{512,192,180,32}.png` | — | 2~315KB | 파비콘 / PWA / iOS 홈화면 |
| `brand/loading-pub-{720,360}.png` | — | 153·520KB | 로딩 화면 디오라마 |

트로피·건물은 **배경이 투명**하다. 로딩 아트도 배경 그라데이션을 벗겨 디오라마만 남겼다 —
배경은 `.ga-loading`의 CSS 그라데이션이 그리므로 화면 비율이 달라도 안 잘리고,
이미지도 2MB에서 150KB대로 줄었다.

`assets/raw/`에는 가공 전 원본(2048px)이 들어 있다. 게임은 이 폴더를 읽지 않는다 —
배포에 포함할 필요 없다.

## 3. 원본을 다시 가공하려면

```
node tools/asset-pack.mjs              # 전부
node tools/asset-pack.mjs --only trophy # 한 묶음만
```

`assets/raw/`의 PNG를 읽어 배경 제거 → 크롭 → 축소 → `assets/img/`에 저장한다.
외부 패키지 없이 Node 내장 zlib만 쓴다(npm install 불필요).

배경 제거는 **테두리에서 시작하는 flood fill**이다. 밝기로 한 번에 자르면 그림 안쪽의
크림색 면까지 뚫리기 때문에, 바깥과 연결된 영역만 따라간다. 모드 3가지:

- `white` — 거의 순백만 배경으로 본다
- `pale` — 밝고 채도가 낮으면 배경 (생성 이미지 배경은 순백이 아니라 옅은 회색·베이지
  비네트인 경우가 많다. 순백 기준으로는 테두리 근처에서 멈춰 사각형 배경이 남는다)
- `adaptive` — 이미 배경으로 판정된 이웃과 색이 비슷하면 배경. 핑크 그라데이션처럼
  **채도가 있는** 배경을 벗길 때. 단 밝은 물체를 먹어들어갈 수 있으니 tolerance를 낮게.

새 원본을 추가하려면 `tools/asset-pack.mjs` 아래쪽 `JOBS` 배열에 한 줄 넣으면 된다.

## 4. 게임 연결 상태

HUD 지갑·하단 네비·사이드 레일·업그레이드 목록·대회 트로피·인테리어 테마 썸네일·파비콘은
모두 연결돼 있다.

3D 매장(딜러·테이블·손님·기물·구조물)은 이미지 에셋이 아니라 `js/scene3d.js`가 Three.js로
만드는 지오메트리다. 세 축으로 나뉜다 — 자세한 건 그 파일의 주석을 볼 것.

- **테마**(`THEMES`) — 바닥/벽/펠트 + `props`(기물 색) + `customers`(손님 옷) +
  `dealerTint`(딜러 정장) + `lights`(전구/제등) + `bottles`(술병). `applyTheme()`이
  `PAL` 팔레트를 덮어쓰면 다음 렌더에서 매장 전체가 새 색으로 다시 그려진다.
- **테마 전용 소품**(`THEME_DECOR`) — 노렌·벽난로·네온 사인처럼 그 컨셉에서만 나오는 것.
- **명성 단계 구조물**(`VENUE_STAGES`) — game.js의 `BUILDING_STEPS`(명성 0/5/20/50)와 같은
  기준으로 대형 사인 → 샹들리에·기둥·트로피 진열장 → 2층 메자닌·골드 아치가 붙는다.
  리뉴얼 탭에 뜨는 외관 PNG와 실제 매장이 같은 단계를 쓴다.
- **매장 밖 동네**(`OUTSIDE`) — 벽 너머 풍경.
- **파트 마스크**(`THEMES[].parts`) — 테마마다 가구를 새로 만들지 않고, 표준 가구의 파트를
  숨기거나(`hidden`) 반투명(`ghost`) 처리해서 다르게 보이게 한다. 가구 지오메트리는 모든
  테마가 공유하므로, 테마가 늘거나 "부분만 바꾸기" 기능이 생겨도 조합마다 빌더를 새로 만들 필요가 없다.
  나중에 붙일 부분 변경 기능은 `partOverrides`에 얹으면 테마 마스크를 덮어쓴다.

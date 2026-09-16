# 🍺 홀덤펍 키우기 (Hold'em Pub Tycoon)

작은 홀덤펍 하나로 시작해서, 테이블을 늘리고 직원을 고용하고 인테리어를 꾸며
대박 펍으로 키우는 **모바일 친화적인 3D 브라우저 방치형(incremental/idle) 게임**입니다.
매장 내부가 [Three.js](https://threejs.org)로 렌더링된 3D 씬으로 표현되고, 손가락(또는 마우스)으로
드래그해서 매장을 둘러보고 꼬집어서 확대/축소할 수 있어요. 빌드 도구 없이 CDN에서 Three.js를
바로 불러오는 구조라 별도 설치 없이 실행됩니다.

## 🎮 플레이

GitHub Pages 링크: **https://thstjdals09-lang.github.io/holdem-pub-tycoon/**
(저장소를 clone 후 `index.html`을 브라우저로 열어도 바로 플레이할 수 있습니다.)

## 🕹 게임 방법

펍은 실제 매장처럼 3D 공간(바닥, 벽, 테이블, 시설)으로 시각화됩니다. 드래그로 회전, 핀치/휠로 확대·축소하며 둘러볼 수 있어요.

- **딜링하기** 버튼을 눌러 수동으로 칩을 벌 수 있어요. (버튼을 누르면 3D 씬에 칩이 튀어오르는 이펙트가 나와요)
- **매장** 탭: 매장을 확장해 테이블 슬롯을 늘리고, 바 카운터·냉장고·칩 금고 같은 시설을 설치/업그레이드해요. 각 시설은 레벨마다 초당 수익 또는 클릭 수익을 올려줘요.
- **테이블** 탭: 매장 슬롯이 남아있는 만큼 홀덤 테이블을 추가하고, 전체 테이블을 리모델링해서 수익을 강화해요. 실제 3D 매장 바닥에 테이블이 하나씩 배치되는 게 보여요.
- **직원** 탭: 바텐더(바 카운터에 배치)/딜러(테이블에 1명씩 배치)/서빙 직원·마케터(매장을 돌아다님)를 고용해 클릭 수익, 테이블 수익, 오프라인 수익 효율을 강화해요.
- **인테리어** 탭: 화분, 네온사인, 샹들리에 등 아기자기한 장식을 사서 펍을 꾸미고 추가 수익 보너스를 받아요.
- **프레스티지** 탭: 누적 수익이 충분히 쌓이면 "브랜드 리뉴얼"로 초기화하고 영구 수익 배율을 얻을 수 있어요.
- 게임을 꺼도 **오프라인 수익**이 쌓이고, 다시 접속하면 안내 팝업으로 알려줘요.

## 🧩 프로젝트 구조

```
holdem-pub-tycoon/
├── index.html          # 게임 화면 마크업 (importmap으로 Three.js CDN 로드)
├── css/style.css        # 아기자기한 파스텔 톤 UI 스타일
├── js/data.js            # 밸런스 수치(테이블/직원/장식/프레스티지 설정)
├── js/backend.js         # 저장 데이터 어댑터 (localStorage 기반, 실제 API로 교체 가능)
├── js/scene3d.js          # Three.js 3D 매장 씬 렌더링 (ES 모듈)
├── js/game.js              # 게임 루프·경제 로직·2D UI 렌더링
└── assets/img/cards/     # Kenney.nl CC0 카드 이미지
```

`js/scene3d.js`는 ES 모듈이라 `window.PubScene3D = { init, update, chipBurst }`로 전역에 노출되고,
`game.js`(클래식 스크립트)는 구매/고용 등 상태가 바뀔 때마다 `PubScene3D.update(snapshot)`을 호출해
3D 씬을 다시 그립니다. Three.js는 CDN(jsDelivr)에서 ES 모듈로 불러오므로 npm 설치가 필요 없어요.

### 백엔드 연결 방식

`js/backend.js`의 `GameBackend` 모듈이 저장/불러오기 API 역할을 합니다.
지금은 브라우저 `localStorage`를 사용하지만, 함수 시그니처(`saveState`, `loadState`, `resetState`)를
그대로 두고 내부 구현만 실제 서버 `fetch()` 호출로 바꾸면 진짜 백엔드(Node/Express, Firebase 등)로
쉽게 교체할 수 있도록 어댑터 패턴으로 분리해두었습니다. `game.js`는 `GameBackend`가 로컬 저장소인지
원격 서버인지 알 필요가 없습니다.

설정 탭에서 저장 데이터를 base64 코드로 내보내기/가져오기 할 수도 있어요.

## 🎨 에셋 출처

- 카드 이미지: [Kenney.nl – Playing Cards Pack](https://kenney.nl/assets/playing-cards-pack) (CC0, 출처 표기 불필요하지만 감사의 의미로 명시)
- 3D 매장(테이블·바·냉장고·금고·직원·인테리어)은 외부 3D 모델 없이 Three.js 기본 도형(Box/Cylinder/Capsule 등)으로 직접 조합해 만든 자체 제작 로우폴리 오브젝트입니다.
- 그 외 2D UI는 이모지 + CSS로 구성한 자체 제작 요소입니다.

## 🚀 로컬 실행

빌드 과정은 없지만, 3D 씬이 ES 모듈(`<script type="module">` + importmap)로 Three.js를 불러오기 때문에
**반드시 로컬 정적 서버로 열어야 합니다.** (`index.html`을 `file://`로 직접 열면 브라우저 보안 정책 때문에
모듈이 로드되지 않아 3D 화면이 비어 보일 수 있어요 — 나머지 2D UI는 정상 동작합니다.)

```bash
# 예시 (Python이 있다면)
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

## 📄 라이선스

코드는 MIT 라이선스입니다. `assets/img/cards`의 이미지는 [Kenney.nl](https://kenney.nl)의 CC0 라이선스를 따릅니다.

# 🍺 홀덤펍 키우기 (Hold'em Pub Tycoon)

작은 홀덤펍 하나로 시작해서, 테이블을 늘리고 직원을 고용하고 인테리어를 꾸며
대박 펍으로 키우는 **브라우저 방치형(incremental/idle) 게임**입니다.
프레임워크 없이 순수 HTML/CSS/JavaScript로만 만들어져 있어 별도 빌드 없이 바로 실행됩니다.

## 🎮 플레이

GitHub Pages 링크: **https://thstjdals09-lang.github.io/holdem-pub-tycoon/**
(저장소를 clone 후 `index.html`을 브라우저로 열어도 바로 플레이할 수 있습니다.)

## 🕹 게임 방법

- **딜링하기** 버튼을 눌러 수동으로 칩을 벌 수 있어요.
- **테이블** 탭: 홀덤 테이블을 늘리거나 리모델링해서 초당 수익을 올려요.
- **직원** 탭: 바텐더/딜러/서빙 직원/마케터를 고용해 클릭 수익, 테이블 수익, 오프라인 수익 효율을 강화해요.
- **인테리어** 탭: 화분, 네온사인, 샹들리에 등 아기자기한 장식을 사서 펍을 꾸미고 추가 수익 보너스를 받아요.
- **프레스티지** 탭: 누적 수익이 충분히 쌓이면 "브랜드 리뉴얼"로 초기화하고 영구 수익 배율을 얻을 수 있어요.
- 게임을 꺼도 **오프라인 수익**이 쌓이고, 다시 접속하면 안내 팝업으로 알려줘요.

## 🧩 프로젝트 구조

```
holdem-pub-tycoon/
├── index.html          # 게임 화면 마크업
├── css/style.css        # 아기자기한 파스텔 톤 UI 스타일
├── js/data.js            # 밸런스 수치(테이블/직원/장식/프레스티지 설정)
├── js/backend.js         # 저장 데이터 어댑터 (localStorage 기반, 실제 API로 교체 가능)
├── js/game.js             # 게임 루프 및 렌더링 로직
└── assets/img/cards/     # Kenney.nl CC0 카드 이미지
```

### 백엔드 연결 방식

`js/backend.js`의 `GameBackend` 모듈이 저장/불러오기 API 역할을 합니다.
지금은 브라우저 `localStorage`를 사용하지만, 함수 시그니처(`saveState`, `loadState`, `resetState`)를
그대로 두고 내부 구현만 실제 서버 `fetch()` 호출로 바꾸면 진짜 백엔드(Node/Express, Firebase 등)로
쉽게 교체할 수 있도록 어댑터 패턴으로 분리해두었습니다. `game.js`는 `GameBackend`가 로컬 저장소인지
원격 서버인지 알 필요가 없습니다.

설정 탭에서 저장 데이터를 base64 코드로 내보내기/가져오기 할 수도 있어요.

## 🎨 에셋 출처

- 카드 이미지: [Kenney.nl – Playing Cards Pack](https://kenney.nl/assets/playing-cards-pack) (CC0, 출처 표기 불필요하지만 감사의 의미로 명시)
- 그 외 UI는 이모지 + CSS로 구성한 자체 제작 요소입니다.

## 🚀 로컬 실행

빌드 과정이 없는 정적 사이트라 아무 정적 서버로 열면 됩니다.

```bash
# 예시 (Python이 있다면)
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속

# 또는 그냥 index.html을 더블클릭해서 열어도 동작합니다.
```

## 📄 라이선스

코드는 MIT 라이선스입니다. `assets/img/cards`의 이미지는 [Kenney.nl](https://kenney.nl)의 CC0 라이선스를 따릅니다.

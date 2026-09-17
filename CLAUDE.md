# 홀덤펍 키우기 작업 메모

새 세션을 시작하면 아래 "진행 상황 로그"부터 읽고 이어서 작업할 것. 세션을 마칠 때는 맨 위에 날짜와 함께 새 항목을 추가한다 (무엇을 했는지 / 다음에 할 일).

## 진행 상황 로그

### 2026-09-17 (1차) — 회원가입/계정설정 + 수익모델(다이아 상점) 신설
- **계정 시스템**: Firebase Authentication(아이디/비번, 내부적으로 `아이디@holdem-pub-tycoon.local` 이메일로 변환) 도입. `js/firebase-init.js`(초기화) / `js/account.js`(가입·로그인·로그아웃·비번변경·계정삭제) / `js/auth-gate.js`(로그인 전 풀스크린 게이트, 로그인 성공 시 `window.HoldemGame.start()` 호출).
  - **Firebase 프로젝트는 casino-tycoon(다른 프로젝트)과 동일한 프로젝트(`jinojino-6aba2`)를 재사용**했다 — 새 프로젝트 생성 없이 바로 씀. 이메일 접미사(`@holdem-pub-tycoon.local`)와 Firestore 컬렉션 접두사(`holdemPub_`)로 데이터가 섞이지 않게 분리.
  - `js/backend.js`를 로컬 전용 → Firestore(`holdemPub_saves/{uid}`) 우선 + localStorage는 오프라인 캐시로 개편(계정별 클라우드 세이브, 여러 기기에서 이어할 수 있음).
  - 설정(⚙️) 탭에 "계정" 섹션 추가: 현재 아이디 표시, 비밀번호 변경, 로그아웃, 계정 삭제(클라우드 세이브까지 함께 삭제).
- **수익모델(상점)**: `js/data.js`에 `shop`/`payment` 설정 신설 — 방치형 타이쿤 장르 표준 구성 참고(신규 전환용 1회 한정 스타터팩 + 단계별 다이아 패키지(고액일수록 보너스%↑) + 월 정기권 구독). 광고는 이번엔 제외(사용자 결정).
  - 재화(다이아) 옆에 "＋" 버튼 신설 → 상점 탭으로 바로 이동(업계 표준 UX).
  - `js/shop.js`: PortOne(아임포트) V2 브라우저 SDK(`https://cdn.portone.io/v2/browser-sdk.js`, `PortOne.requestPayment`) 연동 코드 작성. **아직 PG 가맹점 미가입**이라 `D.payment.storeId`/`channelKey`가 빈 값이면 상점 버튼이 "결제 준비중" 안내만 뜨고 실제 결제는 막혀 있음 — PortOne 가입 후 그 두 값만 채우면 바로 실 결제로 전환됨.
  - 첫 결제 1회는 다이아 2배 지급(전환 유도), VIP 월 정기권은 구매 시 즉시 다이아 + 30일간 매일 접속 시 다이아 자동 지급 + 전체 수익 +10%(전부 프레스티지해도 유지되는 계정 단위 상태).
  - **⚠️ 중요 미해결 사항**: 지금 구조는 결제 성공 응답을 **클라이언트가 그대로 신뢰**해서 재화를 지급한다(서버 검증 없음 — 이 프로젝트는 GitHub Pages 정적 호스팅이라 서버가 없음). 즉 마음만 먹으면 브라우저 콘솔에서 재화를 위조할 수 있는 상태. **실제로 돈을 받기 시작하기 전에는 반드시** Firebase Cloud Functions 등으로 PortOne 결제 검증(`paymentId`로 조회해 실제로 결제됐는지 확인) 후에만 재화를 지급하도록 서버 로직을 추가해야 한다. Cloud Functions를 쓰려면 Firebase 요금제를 Blaze(종량제, 카드 등록 필요)로 올려야 함 — 사용자와 상의 필요.
  - Firestore 보안 규칙은 casino-tycoon 때와 마찬가지로 아직 "테스트 모드"(로그인 여부와 무관하게 열려있음) 그대로 둠 — 실서비스 전에 규칙을 조여야 하는 것도 미해결.
- `js/game.js`: 상점 탭 렌더러, VIP 상태에 따른 수익 배율/일일 다이아 지급, 계정 정보 렌더러 추가. 게임 시작을 `DOMContentLoaded` 자동 실행에서 `window.HoldemGame.start()`(auth-gate가 로그인 확인 후 호출)로 변경.
- 정적 사이트 실행 특성상(빌드 없음) 아직 `npx serve .`로 브라우저 실기동 검증은 못함 — 다음 세션에서 로컬 서버 띄워 로그인→가입→상점 구매(결제 준비중 안내 뜨는지)→계정 설정까지 Playwright로 스크린샷 검증 필요.
- **다음 할 일**: (1) 브라우저 실기동 검증, (2) PortOne 가맹점 가입 후 storeId/channelKey 반영, (3) Cloud Functions 결제 검증 로직 추가(Blaze 요금제 전환 필요 여부 사용자와 논의), (4) Firestore 보안 규칙 조이기, (5) 원하면 리워드 광고(무료 다이아) 나중에 추가 검토.

## 참고

- 이 프로젝트는 [casino-tycoon](../casino-tycoon)(Phaser 3 기반, 별개 게임)과 완전히 다른 프로젝트이지만 Firebase 프로젝트만 공유한다.
- 빌드 도구 없음 — `js/scene3d.js`만 ES 모듈(importmap으로 Three.js 로드), `js/account.js`/`js/backend.js`/`js/shop.js`/`js/auth-gate.js`도 이번에 ES 모듈로 추가됨(Firebase 모듈 SDK를 gstatic CDN에서 직접 import). `js/data.js`/`js/portraits.js`/`js/game.js`는 여전히 클래식 스크립트(`defer`) — 문서 순서가 곧 실행 순서이므로 `index.html`의 `<script>` 태그 순서를 바꿀 땐 주의.
- `file://`로 열면 모듈이 로드되지 않으므로 반드시 `npx serve .` 등 로컬 정적 서버로 열어야 한다(README 참고).

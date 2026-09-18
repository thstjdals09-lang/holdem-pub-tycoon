// 게임 밸런스 데이터 정의 (한 곳에서 관리)
// 설계 원칙
//  1) 모든 성장 요소는 "무한 업그레이드" — 한 번 사고 끝나는 항목을 두지 않는다.
//     (장식품/인테리어 테마도 레벨 개념을 가진다)
//  2) 보상은 가능한 한 "현재 초당 수익 x N초"(chipSeconds)로 표현해 초반/후반 체감을 맞춘다.
const GAME_DATA = {
  // 전 계정 데이터 강제 초기화용 버전. 이 값보다 낮은 버전으로 저장된 세이브는 다음 접속 때 버려지고 새로 시작한다.
  // 1: 2026-09-17 뽑기 1/10/30회·10성·운영진 효과 패치 때 사용자 요청으로 전체 초기화
  dataResetVersion: 1,

  store: {
    baseCapacity: 6, // 매장 기본 테이블 슬롯 수
    capacityPerExpansion: 4, // 확장 1회당 늘어나는 슬롯 수
    expansionBaseCost: 300,
    expansionCostGrowth: 1.6,
    maxShownSlots: 24, // 화면에 그리는 슬롯 상한 (그 이상은 "+N"으로 표시)
  },

  fixtures: [
    {
      id: "bar",
      name: "바 카운터",
      emoji: "🍸",
      desc: "칵테일 판매로 초당 수익 증가",
      baseCost: 300,
      costGrowth: 1.35,
      incomePerLevel: 1.2,
    },
    {
      id: "fridge",
      name: "냉장고",
      emoji: "🧊",
      desc: "주류/안주 재고 확보로 초당 수익 증가",
      baseCost: 200,
      costGrowth: 1.3,
      incomePerLevel: 0.7,
    },
  ],

  table: {
    baseCost: 15,
    costGrowth: 1.15,
    baseIncome: 0.5, // 테이블 1개당 초당 수익
    seatsMin: 4,
    seatsMax: 9,
  },
  tableUpgrade: {
    baseCost: 50,
    costGrowth: 1.22,
    bonusPerLevel: 0.1, // 레벨당 전체 테이블 수익 +10%
  },

  staff: [
    {
      id: "bartender",
      name: "바텐더",
      emoji: "🍹",
      desc: "바 카운터 서비스 향상 → 테이블 수익 +5% · 바 카운터에 배치됨",
      baseCost: 80,
      costGrowth: 1.14,
      effect: { type: "incomeMult", value: 0.05 },
    },
    {
      id: "server",
      name: "서빙 직원",
      emoji: "🍽️",
      desc: "오프라인 수익 효율 +2% · 매장을 돌아다님",
      baseCost: 250,
      costGrowth: 1.18,
      effect: { type: "offline", value: 0.02 },
    },
    {
      id: "marketer",
      name: "마케터",
      emoji: "📣",
      desc: "홍보로 시간당 방문객 수를 늘림 → 방문객이 많을수록 전체 매출 증가(체감 곡선)",
      baseCost: 1200,
      costGrowth: 1.22,
      effect: { type: "visitor", value: 0.15 }, // 레벨당 방문객 +15% (customerFlow()에서 사용)
    },
  ],

  // ---------- 방문객(마케터가 늘리는 값, 매출에 직접 반영됨) ----------
  customerFlow: {
    baseVisitorsPerHour: 20,
    visitorsPerTable: 8,
    incomePerVisitorLog: 0.5, // 방문객이 늘수록 매출도 늘지만 로그형으로 완만하게 체감
    visitorDivisor: 40,
    // 3D 매장에서 홀덤 테이블 좌석이 차는 비율 = 테이블당 시간당 방문객 / visitorsPerFullTable (min~max로 제한)
    // → 마케터·운영진 방문객 효과로 방문객이 늘수록 테이블이 꽉 찬다
    visitorsPerFullTable: 16,
    minOccupancy: 0.35,
    maxOccupancy: 0.95,
  },

  // ---------- 운영진 가챠 ----------
  // 운영진(구 "딜러")은 칩이 아니라 다이아 가챠로 스카우트한다.
  // 중복으로 뽑으면 조각이 쌓이고, 조각으로 개별 운영진을 ★승급시킨다.
  // 배치(동시 운영 가능 인원)는 최대 D.deployment.maxDeployed명 — 배치된 인원의 보너스만 실제로 적용되고,
  // 서로 다른 역할(role)을 고루 배치하면 시너지 보너스가 추가로 붙는다.
  //
  // 가챠에는 "가챠 레벨"(1~10)이 있다 — 뽑을수록(pullsPerLevel회마다) 레벨이 올라가고,
  // 레벨이 높을수록 SSR/SR/R 확률이 커진다(levelTable, %). U는 항상 20% 고정, N(일반)은 나머지 전부.
  gacha: {
    // 뽑기 버튼 3종. 무료 뽑기권이 count장 이상 있으면 그 버튼은 다이아 대신 뽑기권 count장을 쓰는 "무료 뽑기"로 바뀐다.
    pullOptions: [
      { count: 1, costDiamonds: 80, label: "1회 뽑기" },
      { count: 10, costDiamonds: 720, label: "10회 뽑기" }, // 1회분 할인
      { count: 30, costDiamonds: 2040, label: "30회 뽑기" }, // 약 15% 할인
    ],
    multiGuarantee: "rare", // 10장마다 희귀 이상 1장 확정(10회=1장, 30회=3장)
    // 연속 뽑기: 고른 묶음(1/10/30회)을 멈춤 조건에 걸리거나 재화가 떨어질 때까지 반복
    autoPull: { intervalMs: 700, singleIntervalMs: 380 },
    pullsPerLevel: 20, // 누적 20회 뽑을 때마다 가챠 레벨 +1
    maxLevel: 10,
    rarities: [
      { id: "common", name: "일반", short: "N", bonus: 0.05, color: "#9b9b9b", emoji: "🃏" },
      { id: "uncommon", name: "고급", short: "U", bonus: 0.07, color: "#7bc67e", emoji: "🍀" },
      { id: "rare", name: "희귀", short: "R", bonus: 0.1, color: "#4fa3ff", emoji: "🎩" },
      { id: "epic", name: "영웅", short: "SR", bonus: 0.2, color: "#c86bff", emoji: "👑" },
      { id: "legendary", name: "전설", short: "SSR", bonus: 0.4, color: "#ffb400", emoji: "✨" },
    ],
    // 신화 등급은 기본 가챠 확률표에 없다 — 상점에서 해당 인물을 1번 구매하면 그 순간부터
    // 낮은 고정 확률로 가챠 풀에 합류한다(계정별로 state.purchases.unlockedMythic에 기록).
    mythicRarity: { id: "mythic", name: "신화", short: "MR", weight: 1, bonus: 0.7, color: "#ff5fd0", emoji: "👑" },
    // 레벨 1~10 확률표(%). ssr/sr/r/u 4개만 정의하고 나머지(100-합계)는 전부 N으로 채워진다.
    levelTable: [
      { ssr: 0.0, sr: 2.5, r: 3.0, u: 20.0 },
      { ssr: 1.6, sr: 3.0, r: 4.0, u: 20.0 },
      { ssr: 1.7, sr: 3.5, r: 5.0, u: 20.0 },
      { ssr: 1.8, sr: 4.0, r: 6.0, u: 20.0 },
      { ssr: 1.9, sr: 4.5, r: 7.0, u: 20.0 },
      { ssr: 2.0, sr: 5.0, r: 8.0, u: 20.0 },
      { ssr: 2.1, sr: 5.5, r: 9.0, u: 20.0 },
      { ssr: 2.2, sr: 6.0, r: 10.0, u: 20.0 },
      { ssr: 2.3, sr: 6.5, r: 11.0, u: 20.0 },
      { ssr: 2.4, sr: 7.0, r: 12.0, u: 20.0 },
    ],
  },
  dealerStar: {
    maxStar: 10,
    bonusPerStar: 0.25, // ★1당 해당 운영진 기본 보너스의 +25% (★10이면 기본의 3.25배)
    // 등급별로 다른 승급 곡선 — 낮은 등급일수록 가챠에서 훨씬 자주 나오므로
    // 별을 올리는 데 필요한 조각 수도 그만큼 크게 잡는다(그렇지 않으면 하위 등급이 너무 쉽게 만성됨).
    // 배열의 n번째 값 = ★(n+1) → ★(n+2)로 올릴 때 필요한 조각 (★1→★2 ... ★9→★10, 총 9단계)
    shardsPerStarByRarity: {
      common: [6, 12, 24, 40, 64, 96, 140, 200, 280],
      uncommon: [5, 10, 20, 34, 55, 82, 120, 170, 240],
      rare: [4, 8, 16, 28, 45, 68, 100, 140, 195],
      epic: [3, 5, 10, 17, 28, 42, 62, 88, 120],
      legendary: [2, 3, 6, 10, 16, 24, 35, 50, 70],
      mythic: [1, 2, 3, 5, 8, 12, 17, 24, 33],
    },
  },
  // 이름 붙은 운영진 로스터 — 도감 탭에서 개별로 확인/승급, "운영" 탭에서 배치(최대 10명)한다.
  // role은 개별 능력치가 아니라 배치 시너지 계산용 태그(서로 다른 role을 고루 배치할수록 보너스가 커짐).
  // 초상화는 js/portraits.js가 SVG로 그린다 (외부 이미지 에셋 없음).
  //
  // 구성: 사용자가 지정한 실명 10명은 전부 SR 이상(특별 취급) + 랜덤 이름 40명을 N~SSR에 고르게 채워 넣어
  // 로스터를 총 50명(+ 상점 전용 신화 1명)으로 확장했다.
  dealerRoster: [
    // ---------- N (일반) 14명 ----------
    { id: "ex01", name: "김도윤", rarity: "common", role: "영업", emoji: "🎒", desc: "출근 첫날부터 웃음이 한가득" },
    { id: "ex02", name: "이서준", rarity: "common", role: "서비스", emoji: "🧻", desc: "정리정돈은 내가 최고" },
    { id: "ex03", name: "박하은", rarity: "common", role: "이벤트", emoji: "🎈", desc: "풍선 하나로 분위기를 바꾼다" },
    { id: "ex04", name: "최시우", rarity: "common", role: "인맥", emoji: "📱", desc: "단골 번호는 다 외우고 있어요" },
    { id: "ex05", name: "정은우", rarity: "common", role: "영업", emoji: "🥤", desc: "음료 서빙 속도 매장 1등" },
    { id: "ex06", name: "조수아", rarity: "common", role: "서비스", emoji: "🧽", desc: "테이블 닦기 달인" },
    { id: "ex07", name: "장민서", rarity: "common", role: "이벤트", emoji: "🎊", desc: "깜짝 이벤트 아이디어 뱅크" },
    { id: "ex08", name: "임지호", rarity: "common", role: "인맥", emoji: "🤙", desc: "동네 사장님들이랑 다 친해요" },
    { id: "ex09", name: "한소율", rarity: "common", role: "영업", emoji: "🧾", desc: "계산은 정확하고 친절하게" },
    { id: "ex10", name: "오준영", rarity: "common", role: "서비스", emoji: "🧊", desc: "얼음은 항상 넉넉하게" },
    { id: "ex11", name: "서예은", rarity: "common", role: "이벤트", emoji: "🎤", desc: "사회 보는 걸 제일 좋아해요" },
    { id: "ex12", name: "신다인", rarity: "common", role: "인맥", emoji: "📇", desc: "명함 정리만 몇백 장" },
    { id: "ex13", name: "권나윤", rarity: "common", role: "영업", emoji: "💳", desc: "결제 안내는 눈 감고도" },
    { id: "ex14", name: "황준서", rarity: "common", role: "서비스", emoji: "🚪", desc: "손님맞이 인사는 내 담당" },
    // ---------- U (고급) 12명 ----------
    { id: "ex15", name: "안유진", rarity: "uncommon", role: "영업", emoji: "🍀", desc: "운이 좋은 날엔 매출도 좋다" },
    { id: "ex16", name: "송재현", rarity: "uncommon", role: "서비스", emoji: "🍸", desc: "칵테일 셰이킹 연습 중" },
    { id: "ex17", name: "전소민", rarity: "uncommon", role: "이벤트", emoji: "🎁", desc: "선물 포장은 늘 야무지게" },
    { id: "ex18", name: "홍지안", rarity: "uncommon", role: "인맥", emoji: "📸", desc: "단골 손님 얼굴은 다 기억해요" },
    { id: "ex19", name: "고은채", rarity: "uncommon", role: "영업", emoji: "📈", desc: "목표 매출은 꼭 채운다" },
    { id: "ex20", name: "문승우", rarity: "uncommon", role: "서비스", emoji: "🧺", desc: "정리 담당, 손이 빨라요" },
    { id: "ex21", name: "양하늘", rarity: "uncommon", role: "이벤트", emoji: "🌟", desc: "깜짝 공연 준비 중" },
    { id: "ex22", name: "손예린", rarity: "uncommon", role: "인맥", emoji: "💌", desc: "단골 손님께 손편지도 써요" },
    { id: "ex23", name: "배준혁", rarity: "uncommon", role: "영업", emoji: "🏷️", desc: "할인 타이밍은 나한테 맡겨요" },
    { id: "ex24", name: "백서아", rarity: "uncommon", role: "서비스", emoji: "🧴", desc: "위생관리 하나는 확실하게" },
    { id: "ex25", name: "허진우", rarity: "uncommon", role: "이벤트", emoji: "🎉", desc: "생일 손님한텐 늘 서프라이즈" },
    { id: "ex26", name: "유리안", rarity: "uncommon", role: "인맥", emoji: "🗂️", desc: "단골 리스트를 손수 관리해요" },
    // ---------- R (희귀) 8명 ----------
    { id: "ex27", name: "남궁민", rarity: "rare", role: "영업", emoji: "💰", desc: "숫자 감각 하나는 타고났다" },
    { id: "ex28", name: "심다혜", rarity: "rare", role: "서비스", emoji: "🍹", desc: "칵테일 레시피 30종 완주" },
    { id: "ex29", name: "노태양", rarity: "rare", role: "이벤트", emoji: "🔥", desc: "무대 체질, 분위기 메이커" },
    { id: "ex30", name: "하유빈", rarity: "rare", role: "인맥", emoji: "🤝", desc: "협력업체 사장님들도 다 친구" },
    { id: "ex31", name: "곽서진", rarity: "rare", role: "영업", emoji: "📊", desc: "매출 그래프를 매일 체크한다" },
    { id: "ex32", name: "성지원", rarity: "rare", role: "서비스", emoji: "🧹", desc: "청결은 타협 없다" },
    { id: "ex33", name: "차은호", rarity: "rare", role: "이벤트", emoji: "🎶", desc: "선곡 센스가 남다르다" },
    { id: "ex34", name: "주아영", rarity: "rare", role: "인맥", emoji: "📞", desc: "단골 예약 전화는 항상 웃으며" },
    // ---------- SR (영웅) — 랜덤 4명 + 실명 5명 ----------
    { id: "ex35", name: "우진서", rarity: "epic", role: "영업", emoji: "💼", desc: "이달의 매출왕 단골손님" },
    { id: "ex36", name: "구현정", rarity: "epic", role: "서비스", emoji: "🍾", desc: "고급 손님 응대는 나한테" },
    { id: "ex37", name: "민서율", rarity: "epic", role: "이벤트", emoji: "🎇", desc: "대형 이벤트 기획 전문" },
    { id: "ex38", name: "강태오", rarity: "epic", role: "인맥", emoji: "🕴️", desc: "인맥으로 대형 예약을 따온다" },
    { id: "yujin", name: "최유진", rarity: "epic", role: "이벤트", emoji: "🎶", desc: "분위기 메이커, 테이블이 늘 시끌시끌" },
    { id: "taewoong", name: "김태웅", rarity: "epic", role: "영업", emoji: "🔥", desc: "패기 하나는 최고참 못지않다" },
    { id: "yeonju", name: "조연주", rarity: "epic", role: "영업", emoji: "😊", desc: "웃는 얼굴로 재방문율을 끌어올린다" },
    { id: "jiseok", name: "강지석", rarity: "epic", role: "서비스", emoji: "📋", desc: "성실함으로 승부하는 신입" },
    { id: "jihyung", name: "이지형", rarity: "epic", role: "인맥", emoji: "🗺️", desc: "동네 상권은 이미 다 꿰고 있다" },
    // ---------- SSR (전설) — 랜덤 2명 + 실명 5명 ----------
    { id: "ex39", name: "윤도현", rarity: "legendary", role: "영업", emoji: "💎", desc: "매출을 두 배로 만드는 손" },
    { id: "ex40", name: "임하람", rarity: "legendary", role: "인맥", emoji: "🌐", desc: "전국구 인맥왕" },
    { id: "minhyuk", name: "강민혁", rarity: "legendary", role: "영업", emoji: "💼", desc: "이 바닥에서 모르면 간첩인 전설의 영업통" },
    { id: "taegyu", name: "정태규", rarity: "legendary", role: "인맥", emoji: "🤝", desc: "그의 명함첩엔 없는 사람이 없다" },
    { id: "hyeseo", name: "김혜서", rarity: "legendary", role: "서비스", emoji: "🍹", desc: "손님 취향을 한 번에 기억하는 감각파" },
    { id: "seongmin", name: "손성민", rarity: "legendary", role: "이벤트", emoji: "🎉", desc: "판을 키우는 이벤트 기획의 달인" },
    { id: "hyeyeon", name: "윤혜연", rarity: "legendary", role: "서비스", emoji: "🧾", desc: "디테일 하나 놓치지 않는 꼼꼼함" },
    // 신화 등급 — 가챠로는 절대 안 나오고 상점(D.shop.operators)에서만 구매 가능.
    // 구매하는 순간 이 자리에 실제 존재가 추가되고, 그 이후로는 가챠에도 낮은 확률로 등장하기 시작한다.
    { id: "hyunmo", name: "구현모", rarity: "mythic", role: "영업", emoji: "👑", desc: "전설의 투자자, 그가 오면 매출이 요동친다", shopOnly: true },
  ],

  // ---------- 운영진 효과: 보유효과(뽑기만 해도) + 장착효과(배치했을 때) ----------
  // 수치 = 등급 기본값(gacha.rarities[].bonus) × 별 배율(1 + (★-1)×bonusPerStar) × 종류별 배율(typeScale)
  // 장착효과 종류는 역할(role)로 정해지고, 보유효과 종류는 운영진 id로 6종 중 하나가 고정으로 정해진다.
  // 종류별 배율은 "수익으로 환산했을 때 대략 비슷한 가치"가 되도록 맞췄다(방문객은 로그형이라 약하게 먹히므로 크게 등).
  dealerEffects: {
    // diamond = 테이블 손님이 💎 말풍선을 띄우는 빈도 (다이아 금고 삭제 후 다이아는 말풍선 터치로 모은다)
    equipByRole: { 영업: "income", 서비스: "fixture", 이벤트: "diamond", 인맥: "visitor" },
    ownedTypes: ["income", "fixture", "diamond", "visitor", "offline", "gift"],
    ownedScale: 0.15, // 보유효과는 장착효과의 15% 크기
    typeScale: { income: 1, fixture: 2, diamond: 2, visitor: 2, offline: 0.5, gift: 3 },
    labels: {
      income: "전체 수익",
      fixture: "바·시설 수익",
      diamond: "다이아 말풍선",
      visitor: "방문객",
      offline: "오프라인 효율",
      gift: "선물 보상",
    },
    emojis: { income: "💰", fixture: "🍸", diamond: "💎", visitor: "👣", offline: "🌙", gift: "🎁" },
  },

  // ---------- 배치(운영) — 동시에 몇 명까지 "일하게" 할지 + 조합 시너지 ----------
  deployment: {
    maxDeployed: 10,
    presets: 5, // 편성 프리셋(팀) 개수 — 도감 위 스테이지에서 번호로 전환한다
    synergyPerTier: 0.05, // 활성화된 특성 시너지 단계 1당 장착효과 +5% (곱연산)
    fullSquadBonus: 0.2, // 정확히 10명 전원 배치 시 추가 +20%
  },

  // ---------- 특성 시너지 ----------
  // 운영진마다 특성이 2개씩 있고(역할에서 1개 + 고유 1개), 편성한 10명 중 같은 특성을 가진 사람이
  // tiers.need명 이상 모이면 그 단계 보너스가 매장 전체에 붙는다(롤토체스/쿠키런식 조합 짜기).
  // effect: income=전체 수익 / fixture=바·시설 수익 / visitor=방문객 / power=대회 전투력
  //         bubble=💎 말풍선 빈도 / offline=오프라인 효율
  traits: {
    tierNames: ["1단계", "2단계", "3단계"],
    list: [
      // 10명 × 특성 2개 = 20칸을 6종류가 나눠 가지므로, 한 특성을 3/5/7명까지 모으려면 일부러 몰아줘야 한다
      { id: "dealing", name: "딜링", emoji: "🃏", color: "#4fa3ff", effect: "income", effectLabel: "전체 수익", desc: "카드를 다루는 손이 빠르다", tiers: [{ need: 3, bonus: 0.1 }, { need: 5, bonus: 0.25 }, { need: 7, bonus: 0.5 }] },
      { id: "social", name: "처세", emoji: "🗣️", color: "#ff8fab", effect: "visitor", effectLabel: "방문객", desc: "누구와도 금방 친해진다", tiers: [{ need: 3, bonus: 0.15 }, { need: 5, bonus: 0.35 }, { need: 7, bonus: 0.7 }] },
      { id: "service", name: "접객", emoji: "🍸", color: "#7bc67e", effect: "fixture", effectLabel: "바·시설 수익", desc: "손님 잔이 비는 걸 못 본다", tiers: [{ need: 3, bonus: 0.2 }, { need: 5, bonus: 0.5 }, { need: 7, bonus: 1.0 }] },
      { id: "gambler", name: "승부사", emoji: "🎲", color: "#ffb400", effect: "power", effectLabel: "대회 전투력", desc: "판이 커질수록 강해진다", tiers: [{ need: 3, bonus: 0.12 }, { need: 5, bonus: 0.3 }, { need: 7, bonus: 0.65 }] },
      { id: "host", name: "흥", emoji: "🎉", color: "#c86bff", effect: "bubble", effectLabel: "💎 말풍선 빈도", desc: "테이블 분위기를 띄운다", tiers: [{ need: 3, bonus: 0.2 }, { need: 5, bonus: 0.5 }, { need: 7, bonus: 1.0 }] },
      { id: "brain", name: "두뇌", emoji: "🧠", color: "#62d0f0", effect: "offline", effectLabel: "오프라인 효율", desc: "없을 때도 매장이 굴러가게 만든다", tiers: [{ need: 3, bonus: 0.06 }, { need: 5, bonus: 0.14 }, { need: 7, bonus: 0.28 }] },
    ],
    // 역할에서 오는 기본 특성 (나머지 1개는 id를 해시해 고정으로 정해진다 — 같은 사람은 항상 같은 특성)
    roleTrait: { 영업: "dealing", 서비스: "service", 이벤트: "host", 인맥: "social" },
    // 특정 운영진의 특성을 손으로 정하고 싶으면 여기에 { 아이디: ["dealing", "gambler"] } 형태로 적는다
    overrides: {
      minhyuk: ["dealing", "gambler"], // 강민혁 — 전설의 영업통
      taegyu: ["social", "gambler"], // 정태규 — 인맥왕
      hyeseo: ["service", "social"], // 김혜서 — 취향을 기억하는 감각파
      seongmin: ["host", "gambler"], // 손성민 — 판을 키우는 이벤트 기획자
      hyeyeon: ["service", "brain"], // 윤혜연 — 디테일에 강함
      hyunmo: ["dealing", "brain"], // 구현모 — 전설의 투자자
    },
  },

  // ---------- 영구 업그레이드(다이아) — 리뉴얼(프레스티지)해도 절대 초기화되지 않는다 ----------
  // 칩으로 사는 테이블/시설/직원/장식은 리뉴얼하면 초기화되는 "이번 회차용" 성장이고,
  // 여기 있는 건 계정에 영구히 남는 성장이라 다이아(또는 결제)로만 살 수 있다.
  permanentUpgrades: [
    { id: "incomeCore", name: "영구 매출 코어", emoji: "🏆", desc: "레벨당 전체 수익 영구 +3% (리뉴얼해도 유지)", baseCostDiamonds: 150, costGrowth: 1.35, bonusPerLevel: 0.03 },
    { id: "offlineCore", name: "영구 오프라인 코어", emoji: "🌙", desc: "레벨당 오프라인 수익 효율 영구 +4%", baseCostDiamonds: 120, costGrowth: 1.32, bonusPerLevel: 0.04 },
    { id: "gachaCore", name: "영구 행운 코어", emoji: "🍀", desc: "레벨당 희귀 등급 이상 가챠 확률 영구 +3%(상대비율)", baseCostDiamonds: 200, costGrowth: 1.4, bonusPerLevel: 0.03 },
  ],

  // ---------- 광고(리워드) ----------
  // 실제 광고 SDK는 아직 연동 전 — js/ads.js가 D.ads.network가 비어 있으면 "광고 준비중"으로 막아둔다
  // (상점 결제 준비중 패턴과 동일). 광고 제거는 D.shop.removeAds로 판매.
  ads: {
    network: "", // TODO: 애드센스/애드몹 등 실제 광고 SDK 연동 후 채우기
    dailyFreePull: { id: "dailyFreePull", label: "무료 1회 뽑기", desc: "광고 시청하고 운영진 가챠 1회 무료로 뽑기", cooldownMs: 24 * 60 * 60 * 1000 },
    incomeBoost: { id: "incomeBoost", label: "수익 2배", desc: "광고 시청 시 5분간 수익 2배(boosts.adBoost)", cooldownMs: 20 * 60 * 1000 },
  },

  // ---------- 유명인 방문 특수 이벤트 ----------
  celebrity: {
    minIntervalMs: 25 * 60 * 1000,
    maxIntervalMs: 55 * 60 * 1000,
    visitDurationMs: 45 * 1000,
    guests: [
      { name: "강민혁", emoji: "🕶️", line: "\"오, 여기 요즘 물 좋다며?\"" },
      { name: "정태규", emoji: "🎩", line: "\"사장님, 저 VIP 대우 좀 해주시죠?\"" },
    ],
    reward: { chipSeconds: 3600, diamonds: 25 },
  },

  diamond: {
    prestigeReward: 5, // 프레스티지 포인트 1당 지급 다이아
  },

  // ---------- 💎 다이아 말풍선 ----------
  // 시간이 지나면 저절로 쌓이던 다이아(테이블 수 × 다이아 금고)는 수급이 너무 쉬워서 없앴다.
  // 대신 테이블에 앉은 손님이 가끔 💎 말풍선을 띄우고, 터치해야 받는다(오프라인 중에는 안 쌓임).
  // 간격은 운영진 "다이아 말풍선" 효과만큼 짧아진다.
  diamondBubble: {
    minIntervalMs: 25 * 1000,
    maxIntervalMs: 55 * 1000,
    tutorialIntervalMs: 6 * 1000, // 지금 할 미션이 "말풍선 터치"면 금방 띄워준다
    lifeSec: 12,
    diamondsMin: 1,
    diamondsMax: 2,
  },

  // 장식품 — 사고 끝이 아니라 무한 레벨업 (레벨당 수익 보너스가 누적된다)
  decor: [
    { id: "plant", name: "화분", emoji: "🌿", baseCost: 200, costGrowth: 1.26, bonusPerLevel: 0.01 },
    { id: "neon", name: "네온사인", emoji: "🎰", baseCost: 500, costGrowth: 1.28, bonusPerLevel: 0.02 },
    { id: "dart", name: "다트보드", emoji: "🎯", baseCost: 800, costGrowth: 1.29, bonusPerLevel: 0.03 },
    { id: "jukebox", name: "주크박스", emoji: "🎵", baseCost: 1500, costGrowth: 1.3, bonusPerLevel: 0.04 },
    { id: "chandelier", name: "샹들리에", emoji: "💡", baseCost: 3000, costGrowth: 1.31, bonusPerLevel: 0.05 },
    { id: "vip", name: "VIP룸", emoji: "✨", baseCost: 8000, costGrowth: 1.33, bonusPerLevel: 0.08 },
  ],

  // 매장 전체 분위기(바닥/벽/테이블 색)를 바꾸는 테마. 실제 색상은 scene3d.js에 정의.
  // 테마도 구매 후 무한히 "인테리어 등급"을 올릴 수 있고, 등급은 테마별로 따로 쌓인다.
  themes: [
    { id: "classic", name: "클래식", emoji: "🍺", desc: "아늑한 기본 홀덤펍 인테리어", cost: 0 },
    { id: "princess", name: "공주풍", emoji: "👑", desc: "파스텔 핑크의 우아한 공주풍 매장", cost: 4000 },
    { id: "european", name: "유럽풍", emoji: "🏛️", desc: "고풍스러운 유럽 클래식 인테리어", cost: 9000 },
    { id: "neon", name: "네온 라운지", emoji: "🌃", desc: "화려한 밤의 네온 라운지 스타일", cost: 18000 },
  ],
  themeUpgrade: {
    baseCost: 1200,
    costGrowth: 1.3,
    bonusPerLevel: 0.02, // 적용 중인 테마의 등급 1당 +2% 수익
  },

  gift: {
    cooldownMs: 5 * 60 * 1000, // 5분마다 선물 상자 리필
    chipSeconds: 60, // 선물 칩 = 현재 초당 수익 x 60초
    diamondMin: 3,
    diamondMax: 8,
  },

  // ---------- 리텐션: 출석 / 일일 미션 / 부스트 ----------
  attendance: {
    cycleLength: 7,
    rewards: [
      { day: 1, diamonds: 20, chipSeconds: 0, label: "💎20" },
      { day: 2, diamonds: 0, chipSeconds: 300, label: "5분치" },
      { day: 3, diamonds: 30, chipSeconds: 0, label: "💎30" },
      { day: 4, diamonds: 0, chipSeconds: 600, label: "10분치" },
      { day: 5, diamonds: 40, chipSeconds: 0, label: "💎40" },
      { day: 6, diamonds: 0, chipSeconds: 900, label: "15분치" },
      { day: 7, diamonds: 100, chipSeconds: 1800, label: "💎100+30분" },
    ],
  },
  missions: {
    slots: 3, // 하루에 받는 미션 개수
    pool: [
      { id: "buyTable", name: "테이블 늘리기", desc: "홀덤 테이블 {n}개 구매", targets: [2, 3, 5], reward: { chipSeconds: 240, diamonds: 6 } },
      { id: "upgradeTable", name: "리모델링", desc: "테이블 리모델링 {n}회", targets: [3, 5, 8], reward: { chipSeconds: 300, diamonds: 5 } },
      { id: "hireStaff", name: "직원 채용", desc: "직원 {n}명 고용", targets: [2, 3, 5], reward: { chipSeconds: 260, diamonds: 6 } },
      { id: "upgradeFixture", name: "시설 정비", desc: "매장 시설 {n}회 업그레이드", targets: [2, 4, 6], reward: { chipSeconds: 280, diamonds: 5 } },
      { id: "upgradeDecor", name: "분위기 꾸미기", desc: "장식품 {n}회 업그레이드", targets: [2, 3, 5], reward: { chipSeconds: 260, diamonds: 5 } },
      { id: "gacha", name: "운영진 스카우트", desc: "운영진 가챠 {n}회", targets: [1, 2, 3], reward: { chipSeconds: 360, diamonds: 10 } },
      { id: "boost", name: "영업 스퍼트", desc: "부스트 {n}회 사용", targets: [1, 2, 3], reward: { chipSeconds: 320, diamonds: 6 } },
      { id: "expand", name: "매장 확장", desc: "매장 {n}회 확장", targets: [1, 1, 2], reward: { chipSeconds: 400, diamonds: 12 } },
      { id: "tournament", name: "대회 출전", desc: "홀덤 대회 {n}회 참가", targets: [1, 2, 3], reward: { chipSeconds: 300, diamonds: 8 } },
      { id: "diamondBubble", name: "단골 챙기기", desc: "💎 말풍선 {n}개 터치", targets: [2, 3, 5], reward: { chipSeconds: 240, diamonds: 5 } },
    ],
    allClearReward: { chipSeconds: 900, diamonds: 25 },
  },

  // ---------- 성장 미션 (튜토리얼을 가장한 순차 퀘스트) ----------
  // 쿠키런/메이플 키우기처럼 하단 배너에 한 단계씩 떠서, 따라가다 보면
  // 게임의 모든 시스템을 자연스럽게 한 번씩 써보게 된다.
  // goal.kind:
  //   "state" - 현재 상태값이 target 이상이면 달성 (진행도가 사라지지 않는다)
  //   "count" - 해당 행동을 target번 하면 달성 (일회성 행동용)
  // 튜토리얼 중간에 단계를 끼워 넣으면 이 값을 올리고 game.js mergeWithDefaults()에서 진행 단계를 밀어준다
  //  2: t14 뒤에 t14b(첫 대회 출전) 추가
  tutorialVersion: 2,
  tutorial: [
    { id: "t1", title: "두 번째 테이블", desc: "홀덤 테이블을 하나 더 놓아보세요", hint: "3D 화면의 빈 자리를 직접 탭해도 돼요", goal: { kind: "state", stat: "tables", target: 2 }, reward: { chipSeconds: 120, diamonds: 5 } },
    { id: "t2", title: "테이블 리모델링", desc: "테이블을 1회 강화하세요", hint: "테이블 탭에서 강화할 수 있어요", goal: { kind: "state", stat: "tableLevel", target: 1 }, reward: { chipSeconds: 150, diamonds: 5 } },
    { id: "t3", title: "바 카운터 오픈", desc: "바 카운터를 설치하세요", hint: "매장 탭 → 매장 시설", goal: { kind: "state", stat: "fixtures.bar", target: 1 }, reward: { chipSeconds: 180, diamonds: 8 } },
    { id: "t4", title: "첫 직원 채용", desc: "바텐더를 1명 고용하세요", hint: "직원 탭에서 고용해요", goal: { kind: "state", stat: "staff.bartender", target: 1 }, reward: { chipSeconds: 200, diamonds: 8 } },
    { id: "t5", title: "서빙 직원 채용", desc: "서빙 직원을 1명 고용하세요", hint: "운영진 탭 → 직원 고용", goal: { kind: "state", stat: "staff.server", target: 1 }, reward: { chipSeconds: 220, diamonds: 10 } },
    { id: "t6", title: "손님이 북적북적", desc: "테이블을 4개까지 늘리세요", goal: { kind: "state", stat: "tables", target: 4 }, reward: { chipSeconds: 260, diamonds: 10 } },
    { id: "t7", title: "매장 확장", desc: "매장을 1회 확장하세요", hint: "테이블 슬롯이 4칸 늘어나요", goal: { kind: "state", stat: "store.expansions", target: 1 }, reward: { chipSeconds: 300, diamonds: 12 } },
    { id: "t8", title: "재고 확보", desc: "냉장고를 설치하세요", goal: { kind: "state", stat: "fixtures.fridge", target: 1 }, reward: { chipSeconds: 320, diamonds: 12 } },
    { id: "t9", title: "영업 스퍼트", desc: "⚡ 부스트를 1회 사용하세요", hint: "응원 부스트는 무료예요", goal: { kind: "count", action: "boost", target: 1 }, reward: { chipSeconds: 340, diamonds: 15 } },
    { id: "t10", title: "다이아 말풍선", desc: "테이블 손님의 💎 말풍선을 터치하세요", hint: "손님이 가끔 말풍선을 띄워요", goal: { kind: "count", action: "diamondBubble", target: 1 }, reward: { chipSeconds: 360, diamonds: 20 } },
    { id: "t11", title: "첫 운영진 스카우트", desc: "운영진 가챠를 1회 뽑으세요", hint: "운영진 탭 → 운영진 스카우트", goal: { kind: "count", action: "gacha", target: 1 }, reward: { chipSeconds: 400, diamonds: 15 } },
    { id: "t12", title: "출석 체크", desc: "📅 출석 보상을 받으세요", goal: { kind: "count", action: "attendance", target: 1 }, reward: { chipSeconds: 420, diamonds: 15 } },
    { id: "t13", title: "분위기 잡기", desc: "장식품을 1개 설치하세요", hint: "인테리어 탭 → 장식품", goal: { kind: "state", stat: "decorTotal", target: 1 }, reward: { chipSeconds: 450, diamonds: 15 } },
    { id: "t14", title: "운영진 배치", desc: "운영진을 1명 이상 배치하세요", hint: "운영진 → 도감에서 배치 또는 빠른 배치", goal: { kind: "state", stat: "deployedCount", target: 1 }, reward: { chipSeconds: 500, diamonds: 18 } },
    { id: "t14b", title: "첫 대회 출전", desc: "🏆 홀덤 대회에 1회 참가하세요", hint: "배치한 운영진이 강할수록 순위가 올라요", goal: { kind: "count", action: "tournament", target: 1 }, reward: { chipSeconds: 520, diamonds: 20 } },
    { id: "t15", title: "운영진 도감", desc: "운영진을 3명 모으세요", hint: "📖 도감 탭에서 확인해요", goal: { kind: "state", stat: "dealerCount", target: 3 }, reward: { chipSeconds: 560, diamonds: 25 } },
    { id: "t16", title: "본격 리모델링", desc: "테이블 리모델링 Lv.10 달성", hint: "x10 일괄 강화를 써보세요", goal: { kind: "state", stat: "tableLevel", target: 10 }, reward: { chipSeconds: 640, diamonds: 25 } },
    { id: "t17", title: "에이스 운영진", desc: "운영진 1명을 ★2로 승급하세요", hint: "중복으로 뽑은 조각으로 승급해요", goal: { kind: "state", stat: "maxStar", target: 2 }, reward: { chipSeconds: 720, diamonds: 30 } },
    { id: "t18", title: "매장 분위기 변신", desc: "인테리어 테마를 1개 구매하세요", goal: { kind: "state", stat: "themeCount", target: 2 }, reward: { chipSeconds: 820, diamonds: 35 } },
    { id: "t19", title: "대박 홀덤펍", desc: "테이블을 10개까지 늘리세요", goal: { kind: "state", stat: "tables", target: 10 }, reward: { chipSeconds: 950, diamonds: 40 } },
    { id: "t20", title: "브랜드 리뉴얼", desc: "프레스티지를 1회 진행하세요", hint: "영구 수익 배율을 얻어요", goal: { kind: "state", stat: "prestigePoints", target: 1 }, reward: { chipSeconds: 1200, diamonds: 60 } },
  ],

  // ---------- 반복 퀘스트 (무한) ----------
  // 성장 미션 20단계가 끝나면 같은 배너에서 이어서 돌아간다.
  // 하나 깰 때마다 회차가 오르고 목표치와 보상이 같이 커져서, 계속 재화가 들어온다.
  // 출석처럼 하루 한 번만 가능한 행동은 넣지 않는다 (진행이 막히면 안 된다).
  // 목표치는 회차마다 커지지만 항목별 상한(max)이 있다. 매장 확장은 비용이 1.6배씩, 선물·부스트는
  // 쿨타임이 있어서 상한 없이 키우면 후반에 사실상 깰 수 없는 퀘스트가 된다.
  repeatQuests: {
    // 2026-09-18 난이도 하향: 시작값·증가율·상한을 전부 낮춤 (예전엔 리모델링 25회·매출 600초치까지 커졌음).
    // 상한이 낮아지기 전에 받아둔 퀘스트도 game.js repeatState()에서 새 상한으로 줄여준다.
    pool: [
      { id: "buyTable", title: "테이블 증설", desc: "홀덤 테이블 {n}개 구매", base: 1, growth: 1.1, max: 2 },
      { id: "upgradeTable", title: "리모델링", desc: "테이블 {n}회 강화", base: 3, growth: 1.12, max: 10 },
      { id: "upgradeFixture", title: "시설 정비", desc: "매장 시설 {n}회 업그레이드", base: 2, growth: 1.12, max: 8 },
      { id: "hireStaff", title: "직원 충원", desc: "직원 {n}명 고용", base: 2, growth: 1.12, max: 6 },
      { id: "upgradeDecor", title: "인테리어 손질", desc: "장식품 {n}회 강화", base: 2, growth: 1.12, max: 6 },
      { id: "gacha", title: "운영진 스카우트", desc: "운영진 가챠 {n}회", base: 1, growth: 1.05, max: 3 },
      { id: "boost", title: "영업 스퍼트", desc: "부스트 {n}회 사용", base: 1, growth: 1, max: 1 },
      { id: "tournament", title: "대회 출전", desc: "홀덤 대회 {n}회 참가", base: 1, growth: 1.05, max: 2 },
      { id: "diamondBubble", title: "단골 챙기기", desc: "💎 말풍선 {n}개 터치", base: 1, growth: 1.05, max: 2 },
      // 그냥 가만히 둬도 달성되는 퀘스트 — 방치형답게 하나는 섞어둔다
      { id: "earn", title: "매출 올리기", desc: "{n} BB 벌기", incomeSeconds: 60, growth: 1.04, maxSeconds: 240 },
    ],
    reward: {
      chipSecondsBase: 200,
      chipSecondsPerRound: 16,
      chipSecondsMax: 2400,
      diamondsBase: 5,
      diamondsPerRound: 0.6,
      diamondsMax: 80,
      // 성장 미션(튜토리얼) 20단계를 다 끝내고 반복 퀘스트로 넘어간 뒤부터는
      // 소량의 재화와 함께 "무료 뽑기권"도 준다(디디아 없이도 가챠를 계속 즐길 수 있게).
      ticketsBase: 1,
      ticketsEveryNRounds: 3, // 3회차마다 1장씩 추가로
      ticketsMax: 3,
    },
  },

  boosts: {
    free: {
      id: "free",
      name: "응원 부스트",
      emoji: "⚡",
      desc: "10분마다 무료로 60초간 수익 2배",
      mult: 2,
      durationMs: 60 * 1000,
      cooldownMs: 10 * 60 * 1000,
    },
    rush: {
      id: "rush",
      name: "풀하우스 러시",
      emoji: "🔥",
      desc: "다이아를 써서 5분간 수익 3배",
      mult: 3,
      durationMs: 5 * 60 * 1000,
      costDiamonds: 30,
    },
    golden: {
      id: "golden",
      name: "황금 시간대",
      emoji: "🌟",
      desc: "손님이 몰리는 시간! 2분간 수익 2배",
      mult: 2,
      durationMs: 2 * 60 * 1000,
      minIntervalMs: 18 * 60 * 1000,
      maxIntervalMs: 40 * 60 * 1000,
    },
    // 광고 시청(또는 광고 제거 구매자)으로 받는 수익 부스트 — D.ads.incomeBoost가 발동시킨다
    adBoost: {
      id: "adBoost",
      name: "광고 부스트",
      emoji: "🎬",
      desc: "광고 보고 5분간 수익 2배",
      mult: 2,
      durationMs: 5 * 60 * 1000,
    },
  },

  // ---------- 🏆 홀덤펍 대회 (새 재화: 트로피) ----------
  // 우리 펍 대표로 대회에 나간다. 참가비는 BB, 순위는 "대회 전투력"(배치한 운영진 + 매장)과 운으로 정해진다.
  // 한 번에 하나만 참가할 수 있고 실제 시간이 흘러야 끝난다(앱을 꺼도 진행). 탈락하면 그 시점에 바로 끝난다.
  // 이전 등급 대회에서 상금권에 들면 다음 등급 대회가 열린다.
  tournament: {
    rarityPower: { common: 10, uncommon: 14, rare: 20, epic: 40, legendary: 80, mythic: 140 }, // ★1 기준, 별마다 dealerStar.bonusPerStar만큼 커짐
    tablePower: 2, // 테이블 1개당 전투력
    tableLevelPower: 1, // 리모델링 1레벨당 전투력
    buyInSecondsPerMin: 30, // 참가비 = 부스트 뺀 초당 수익 × 대회 시간(분) × 30초 → 2분 대회면 1분치 수익
    minBuyIn: 50,
    itmFraction: 0.15, // 상위 15%(최소 9명)까지 상금권
    fieldCurve: 1.6, // 남은 인원이 줄어드는 곡선 (클수록 초반에 많이 탈락)
    // 추천 전투력의 3배를 넘으면 보상이 줄어든다 — 쉬운 대회만 반복해서 트로피를 쓸어 담지 못하게
    overpowerRatio: 3,
    minRewardMult: 0.1,
    tiers: [
      { id: "local", name: "동네 홀덤 대회", emoji: "🏘️", field: 30, durationMin: 2, recommended: 40, trophies: 2, diamonds: 2 },
      { id: "city", name: "시티 오픈", emoji: "🏙️", field: 80, durationMin: 5, recommended: 150, trophies: 5, diamonds: 5 },
      { id: "national", name: "코리아 챔피언십", emoji: "🎖️", field: 200, durationMin: 10, recommended: 500, trophies: 12, diamonds: 10 },
      { id: "asia", name: "아시아 포커 투어", emoji: "🌏", field: 500, durationMin: 20, recommended: 1500, trophies: 30, diamonds: 20 },
      { id: "world", name: "월드 그랜드 파이널", emoji: "🌍", field: 1000, durationMin: 40, recommended: 4000, trophies: 75, diamonds: 40 },
    ],
    // 순위 구간별 보상 배율 — 위에서부터 처음 맞는 구간을 쓴다. maxPlace "itm" = 상금권 인원
    payouts: [
      { id: "win", label: "🥇 우승", maxPlace: 1, trophyMult: 5, bbMult: 3, diamondMult: 1 },
      { id: "podium", label: "🏅 톱3", maxPlace: 3, trophyMult: 3, bbMult: 2, diamondMult: 0.5 },
      { id: "final", label: "🎖️ 파이널 테이블", maxPlace: 9, trophyMult: 2, bbMult: 1.5, diamondMult: 0 },
      { id: "itm", label: "💵 상금권", maxPlace: "itm", trophyMult: 1.5, bbMult: 1.1, diamondMult: 0 },
      { id: "bust", label: "💥 탈락", maxPlace: Infinity, trophyMult: 0.5, bbMult: 0, diamondMult: 0 },
    ],
  },

  // ---------- 🏆 트로피 사용처 (계정 단위라 리뉴얼해도 유지) ----------
  trophyShop: {
    upgrades: [
      { id: "offlineHours", name: "영업시간 연장", emoji: "🌙", desc: "오프라인 수익을 받는 최대 시간 +30분", baseCost: 10, costGrowth: 1.25, secondsPerLevel: 30 * 60, maxLevel: 20 },
      { id: "training", name: "대회 훈련", emoji: "🎯", desc: "대회 전투력 +8%", baseCost: 15, costGrowth: 1.3, bonusPerLevel: 0.08 },
      { id: "hallOfFame", name: "명예의 전당", emoji: "🏛️", desc: "전체 수익 +4% (리뉴얼해도 유지)", baseCost: 25, costGrowth: 1.3, bonusPerLevel: 0.04 },
    ],
    ticket: { cost: 25, dailyLimit: 5 }, // 무료 뽑기권 교환 (하루 5장)
    // 운영진 상세 창에서 원하는 운영진의 승급 조각을 트로피로 산다
    shardCost: { common: 3, uncommon: 4, rare: 6, epic: 10, legendary: 20, mythic: 35 },
  },

  // ---------- 조작 편의 ----------
  buyQuantities: [1, 10, 100, "MAX"],

  // 프로필 레벨: 프레스티지를 해도 사라지지 않는 누적 수익 기반
  level: {
    base: 300,
    growth: 1.6,
    diamondRewardBase: 5, // 레벨업 1회당 지급 다이아 = base + level*perLevel
    diamondRewardPerLevel: 2,
    titles: [
      { min: 1, name: "펍 알바" },
      { min: 5, name: "펍 매니저" },
      { min: 10, name: "펍 사장" },
      { min: 18, name: "체인 대표" },
      { min: 28, name: "홀덤 거물" },
      { min: 40, name: "카지노 재벌" },
    ],
  },

  prestige: {
    baseRequirement: 100000, // 명성 포인트 1점을 얻기 위한 기준 누적 수익
    pointBonus: 0.1, // 프레스티지 포인트 1당 +10% 영구 수익
  },
  offline: {
    baseEfficiency: 0.5, // 기본 오프라인 수익 효율 50%
    maxEfficiency: 1.0,
    baseMaxSeconds: 2 * 60 * 60, // 처음엔 최대 2시간까지만 인정 — 🏆 트로피 상점 "영업시간 연장"으로 늘린다
  },
  tick: {
    intervalMs: 200,
    autosaveMs: 10000,
  },

  // ---------- 수익모델(상점) ----------
  // 방치형 타이쿤 장르의 표준 구성을 참고: 신규유저 전환용 스타터팩(초저가·고효율) +
  // 단계별 다이아 패키지(고액일수록 보너스% 증가) + 월 정기권(구독형 리텐션+매출) +
  // 상점 전용 신화 운영진(구매하면 그 순간부터 가챠에도 등장) + 광고 제거.
  shop: {
    firstPurchaseBonusMult: 2, // 계정당 첫 결제 1회는 다이아 2배 지급(전환 유도)
    starter: {
      id: "starter",
      name: "창업 지원팩",
      emoji: "🎉",
      tag: "최초 1회 한정",
      desc: "신규 사장님 전용 특가 · 계정당 1번만 구매할 수 있어요",
      amountKRW: 1200,
      priceLabel: "₩1,200",
      diamonds: 150,
      chipSeconds: 1800, // 현재 초당 수익 x 30분치 칩도 함께 지급
    },
    diamondPacks: [
      { id: "dia_s", name: "다이아 한 줌", emoji: "💎", amountKRW: 1200, priceLabel: "₩1,200", diamonds: 80 },
      { id: "dia_m", name: "다이아 주머니", emoji: "💎", amountKRW: 4900, priceLabel: "₩4,900", diamonds: 360, bonusPct: 12 },
      { id: "dia_l", name: "다이아 상자", emoji: "💎", amountKRW: 9900, priceLabel: "₩9,900", diamonds: 800, bonusPct: 25, tag: "인기" },
      { id: "dia_xl", name: "다이아 금고", emoji: "💎", amountKRW: 19900, priceLabel: "₩19,900", diamonds: 1800, bonusPct: 40 },
      { id: "dia_xxl", name: "다이아 트럭", emoji: "💎", amountKRW: 49900, priceLabel: "₩49,900", diamonds: 5000, bonusPct: 56, tag: "최고 혜택" },
    ],
    vip: {
      id: "vip_monthly",
      name: "사장님 월 정기권",
      emoji: "👑",
      desc: "즉시 💎100 · 30일간 매일 💎20 + 전체 수익 +10%",
      amountKRW: 4900,
      priceLabel: "₩4,900",
      durationDays: 30,
      instantDiamonds: 100,
      dailyDiamonds: 20,
      incomeBonusPct: 10,
    },
    // 상점에서만 살 수 있는 신화 등급 운영진 — dealerRoster 안의 shopOnly:true 항목과 id로 연결된다.
    // 구매하면 즉시 보유하게 되고, 이후로는 이 운영진이 가챠(mythicRarity) 확률로도 등장하기 시작한다.
    operators: [
      { id: "hyunmo", rosterId: "hyunmo", name: "구현모 영입", emoji: "👑", desc: "신화 등급 '구현모' 즉시 영입 + 이후 가챠에도 등장", amountKRW: 29900, priceLabel: "₩29,900" },
    ],
    // 광고 제거 — 구매하면 리워드 광고 버튼이 전부 "무료로 즉시 받기"로 바뀐다(js/ads.js 참고).
    removeAds: {
      id: "remove_ads",
      name: "광고 제거",
      emoji: "🚫",
      desc: "이후로 모든 무료 보상을 광고 없이 바로 받아요(1회 구매, 영구 적용)",
      amountKRW: 3900,
      priceLabel: "₩3,900",
    },
  },

  // PortOne(아임포트) V2 결제 연동 자리. 사업자등록/PG 가맹점 가입 전이라 아직 빈 값 —
  // storeId/channelKey를 채우기 전까지 상점은 "결제 준비중" 상태로 표시된다.
  // js/shop.js 참고: 지금은 결제 성공 응답을 클라이언트가 그대로 신뢰해 재화를 지급하므로,
  // 실 서비스 오픈 전 반드시 서버(Cloud Function 등) 검증을 추가해야 한다.
  payment: {
    provider: "portone",
    storeId: "",
    channelKey: "",
  },
};

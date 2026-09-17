// 게임 밸런스 데이터 정의 (한 곳에서 관리)
// 설계 원칙
//  1) 모든 성장 요소는 "무한 업그레이드" — 한 번 사고 끝나는 항목을 두지 않는다.
//     (장식품/인테리어 테마도 레벨 개념을 가진다)
//  2) 보상은 가능한 한 "현재 초당 수익 x N초"(chipSeconds)로 표현해 초반/후반 체감을 맞춘다.
const GAME_DATA = {
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
    {
      id: "vault",
      name: "다이아 금고",
      emoji: "🗄️",
      desc: "다이아 적립 속도 증가",
      baseCost: 400,
      costGrowth: 1.32,
      diamondChancePerLevel: 0.006,
    },
  ],

  table: {
    baseCost: 15,
    costGrowth: 1.15,
    baseIncome: 0.5, // 테이블 1개당 초당 수익
    seatsMin: 4,
    seatsMax: 8,
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
      desc: "테이블 수익 +12% (신규 손님 유치) · 입구에서 홍보",
      baseCost: 1200,
      costGrowth: 1.22,
      effect: { type: "incomeMult", value: 0.12 },
    },
  ],

  // ---------- 딜러 가챠 ----------
  // 딜러는 칩으로 고용하지 않고 다이아 가챠로 뽑는다.
  // 중복으로 뽑으면 조각이 쌓이고, 조각으로 개별 딜러를 ★승급시킨다.
  gacha: {
    costDiamonds: 80,
    multiCount: 10,
    multiCost: 720, // 10연차는 1회분 할인
    multiGuarantee: "rare", // 10연차는 희귀 이상 1장 확정
    rarities: [
      { id: "common", name: "일반", short: "N", weight: 58, bonus: 0.05, color: "#9b9b9b", emoji: "🃏" },
      { id: "rare", name: "희귀", short: "R", weight: 27, bonus: 0.1, color: "#4fa3ff", emoji: "🎩" },
      { id: "epic", name: "영웅", short: "SR", weight: 12, bonus: 0.2, color: "#c86bff", emoji: "👑" },
      { id: "legendary", name: "전설", short: "SSR", weight: 3, bonus: 0.4, color: "#ffb400", emoji: "✨" },
    ],
  },
  dealerStar: {
    maxStar: 5,
    bonusPerStar: 0.25, // ★1당 해당 딜러 기본 보너스의 +25%
    shardsPerStar: [2, 4, 8, 14, 22], // ★2로 올릴 때 필요한 조각부터 순서대로
  },
  // 이름 붙은 딜러 로스터 — 도감 탭에서 개별로 확인/승급한다.
  // 초상화는 js/portraits.js가 SVG로 그린다 (외부 이미지 에셋 없음).
  dealerRoster: [
    { id: "minsu", name: "알바 민수", rarity: "common", emoji: "🧢", desc: "첫 출근이라 손이 조금 떨려요" },
    { id: "jieun", name: "신입 지은", rarity: "common", emoji: "🎀", desc: "칩 정리는 누구보다 깔끔하게" },
    { id: "taeho", name: "견습 태호", rarity: "common", emoji: "🥤", desc: "셔플 연습만 3개월째" },
    { id: "sujin", name: "아르바이트 수진", rarity: "common", emoji: "📚", desc: "룰북을 통째로 외웠어요" },
    { id: "doyun", name: "연습생 도윤", rarity: "common", emoji: "🎧", desc: "리듬감 하나는 타고났다" },
    { id: "haneul", name: "새내기 하늘", rarity: "common", emoji: "☁️", desc: "손님 이름을 다 기억해요" },
    { id: "jungwoo", name: "베테랑 정우", rarity: "rare", emoji: "🕶️", desc: "10년째 같은 자리를 지킨다" },
    { id: "soyeon", name: "칵테일 소연", rarity: "rare", emoji: "🍹", desc: "딜링과 셰이킹을 동시에" },
    { id: "leo", name: "마술사 레오", rarity: "rare", emoji: "🎪", desc: "카드가 사라졌다 나타나요" },
    { id: "yuna", name: "미소천사 유나", rarity: "rare", emoji: "😊", desc: "테이블 분위기 메이커" },
    { id: "jun", name: "카드핸들러 준", rarity: "rare", emoji: "🤹", desc: "한 손으로 리플 셔플" },
    { id: "sera", name: "프로딜러 세라", rarity: "epic", emoji: "💼", desc: "국제 대회 공식 딜러 출신" },
    { id: "kangtae", name: "하이롤러 강태", rarity: "epic", emoji: "🐉", desc: "큰 판만 골라서 맡는다" },
    { id: "mina", name: "럭키걸 미나", rarity: "epic", emoji: "🍀", desc: "그녀의 테이블은 늘 북적인다" },
    { id: "royal", name: "전설의 딜러 로열", rarity: "legendary", emoji: "👑", desc: "로열 스트레이트만 12번 봤다" },
    { id: "diana", name: "카지노 여왕 다이애나", rarity: "legendary", emoji: "💎", desc: "그녀가 앉으면 펍이 바뀐다" },
  ],

  diamond: {
    baseRatePerTableSecond: 0.0018, // 테이블 1개당 초당 다이아
    vaultBonusPerLevel: 0.35, // 금고 레벨당 다이아 적립 배율 +35%
    prestigeReward: 5, // 프레스티지 포인트 1당 지급 다이아
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
      { id: "gacha", name: "딜러 스카우트", desc: "딜러 가챠 {n}회", targets: [1, 2, 3], reward: { chipSeconds: 360, diamonds: 10 } },
      { id: "gift", name: "선물 수령", desc: "사장님 선물 {n}회 받기", targets: [2, 3, 4], reward: { chipSeconds: 200, diamonds: 8 } },
      { id: "boost", name: "영업 스퍼트", desc: "부스트 {n}회 사용", targets: [1, 2, 3], reward: { chipSeconds: 320, diamonds: 6 } },
      { id: "expand", name: "매장 확장", desc: "매장 {n}회 확장", targets: [1, 1, 2], reward: { chipSeconds: 400, diamonds: 12 } },
    ],
    allClearReward: { chipSeconds: 900, diamonds: 25 },
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
  },

  // ---------- 조작 편의 ----------
  buyQuantities: [1, 10, 100, "MAX"],
  autoUpgrade: {
    intervalMs: 900, // 자동 업그레이드 판정 주기
    maxPerTick: 3, // 한 번에 최대 구매 횟수 (연출이 밀리지 않게)
  },

  // 프로필 레벨: 프레스티지를 해도 사라지지 않는 누적 수익 기반
  level: {
    base: 300,
    growth: 1.6,
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
    maxSeconds: 8 * 60 * 60, // 최대 8시간까지 오프라인 수익 인정
  },
  tick: {
    intervalMs: 200,
    autosaveMs: 10000,
  },
};

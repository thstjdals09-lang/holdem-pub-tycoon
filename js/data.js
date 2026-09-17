// 게임 밸런스 데이터 정의 (한 곳에서 관리)
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
      desc: "손님이 놓고 가는 다이아 획득 확률 증가",
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
      desc: "오프라인 수익 효율 +5% · 매장을 돌아다님",
      baseCost: 250,
      costGrowth: 1.18,
      effect: { type: "offline", value: 0.05 },
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
  // 딜러는 칩으로 고용하지 않고 다이아 가챠로 뽑는다.
  gacha: {
    costDiamonds: 50,
    rarities: [
      { id: "common", name: "일반", weight: 58, bonus: 0.05, color: "#9b9b9b", emoji: "🃏" },
      { id: "rare", name: "희귀", weight: 27, bonus: 0.1, color: "#4fa3ff", emoji: "🎩" },
      { id: "epic", name: "영웅", weight: 12, bonus: 0.2, color: "#c86bff", emoji: "👑" },
      { id: "legendary", name: "전설", weight: 3, bonus: 0.4, color: "#ffb400", emoji: "✨" },
    ],
  },
  diamond: {
    baseRatePerTableSecond: 0.0025, // 테이블 1개당 초당 다이아(냉장고 없어도 조금씩 적립)
    vaultBonusPerLevel: 0.35, // 금고 레벨당 다이아 적립 배율 +35%
    prestigeReward: 5, // 프레스티지 포인트 1당 지급 다이아
  },
  decor: [
    { id: "plant", name: "화분", emoji: "🪴", desc: "+1% 수익", cost: 200, bonus: 0.01 },
    { id: "neon", name: "네온사인", emoji: "🎰", desc: "+2% 수익", cost: 500, bonus: 0.02 },
    { id: "dart", name: "다트보드", emoji: "🎯", desc: "+3% 수익", cost: 800, bonus: 0.03 },
    { id: "jukebox", name: "주크박스", emoji: "🎵", desc: "+4% 수익", cost: 1500, bonus: 0.04 },
    { id: "chandelier", name: "샹들리에", emoji: "💡", desc: "+5% 수익", cost: 3000, bonus: 0.05 },
    { id: "vip", name: "VIP룸", emoji: "✨", desc: "+8% 수익", cost: 8000, bonus: 0.08 },
  ],
  // 매장 전체 분위기(바닥/벽/테이블 색)를 바꾸는 테마. 실제 색상은 scene3d.js에 정의.
  themes: [
    { id: "classic", name: "클래식", emoji: "🍺", desc: "아늑한 기본 홀덤펍 인테리어", cost: 0 },
    { id: "princess", name: "공주풍", emoji: "👑", desc: "파스텔 핑크의 우아한 공주풍 매장", cost: 4000 },
    { id: "european", name: "유럽풍", emoji: "🏛️", desc: "고풍스러운 유럽 클래식 인테리어", cost: 9000 },
    { id: "neon", name: "네온 라운지", emoji: "🌃", desc: "화려한 밤의 네온 라운지 스타일", cost: 18000 },
  ],
  gift: {
    cooldownMs: 5 * 60 * 1000, // 5분마다 선물 상자 리필
    chipMinutes: 1, // 선물 칩 = 현재 초당 수익 x 60초
    diamondMin: 3,
    diamondMax: 8,
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

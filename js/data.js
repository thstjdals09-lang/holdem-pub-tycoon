// 게임 밸런스 데이터 정의 (한 곳에서 관리)
const GAME_DATA = {
  table: {
    baseCost: 15,
    costGrowth: 1.15,
    baseIncome: 0.5, // 테이블 1개당 초당 수익
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
      emoji: "🍸",
      desc: "클릭(직접 딜링) 수익 +1",
      baseCost: 80,
      costGrowth: 1.14,
      effect: { type: "click", value: 1 },
    },
    {
      id: "dealer",
      name: "딜러",
      emoji: "🃏",
      desc: "테이블 수익 +8%",
      baseCost: 100,
      costGrowth: 1.16,
      effect: { type: "incomeMult", value: 0.08 },
    },
    {
      id: "server",
      name: "서빙 직원",
      emoji: "🦂",
      desc: "오프라인 수익 효율 +5%",
      baseCost: 250,
      costGrowth: 1.18,
      effect: { type: "offline", value: 0.05 },
    },
    {
      id: "marketer",
      name: "마케터",
      emoji: "📣",
      desc: "테이블 수익 +12% (신규 손님 유치)",
      baseCost: 1200,
      costGrowth: 1.22,
      effect: { type: "incomeMult", value: 0.12 },
    },
  ],
  decor: [
    { id: "plant", name: "화분", emoji: "🪴", desc: "+1% 수익", cost: 200, bonus: 0.01 },
    { id: "neon", name: "네온사인", emoji: "🎰", desc: "+2% 수익", cost: 500, bonus: 0.02 },
    { id: "dart", name: "다트보드", emoji: "🎯", desc: "+3% 수익", cost: 800, bonus: 0.03 },
    { id: "jukebox", name: "주크박스", emoji: "🎵", desc: "+4% 수익", cost: 1500, bonus: 0.04 },
    { id: "chandelier", name: "샹들리에", emoji: "💡", desc: "+5% 수익", cost: 3000, bonus: 0.05 },
    { id: "vip", name: "VIP룸", emoji: "✨", desc: "+8% 수익", cost: 8000, bonus: 0.08 },
  ],
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

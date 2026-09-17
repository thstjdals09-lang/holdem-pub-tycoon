// 홀덤펍 키우기 - 메인 게임 로직
// 구조: 상태(state) → 파생값 계산 → 액션 → 렌더. 3D 씬은 PubScene3D로 스냅샷만 넘긴다.
(() => {
  const D = GAME_DATA;
  const $ = (id) => document.getElementById(id);

  // 인테리어 상점 카드용 미리보기 색상 (실제 3D 색상은 scene3d.js THEMES와 맞춰둠)
  const THEME_SWATCH_COLORS = {
    classic: "linear-gradient(135deg, #f3c988, #ffd3e6)",
    princess: "linear-gradient(135deg, #ffd9ec, #ffb3d9)",
    european: "linear-gradient(135deg, #c9a876, #7a5a3f)",
    neon: "linear-gradient(135deg, #2a1a3a, #ff2fd0)",
  };

  const rarityDef = (id) => {
    if (id === "mythic") return D.gacha.mythicRarity;
    return D.gacha.rarities.find((r) => r.id === id) || D.gacha.rarities[0];
  };
  const rosterDef = (id) => D.dealerRoster.find((d) => d.id === id);
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ============================================================
  // 상태
  // ============================================================
  const defaultState = (keep = {}) => ({
    chips: 20,
    totalEarned: 0, // 이번 회차 누적 (프레스티지 기준)
    lifetimeEarned: keep.lifetimeEarned ?? 0, // 전체 누적 (프로필 레벨 기준)
    diamonds: keep.diamonds ?? 0,
    tables: 1,
    tableLevel: 0,
    store: { expansions: 0 },
    fixtures: Object.fromEntries(D.fixtures.map((f) => [f.id, 0])),
    staff: Object.fromEntries(D.staff.map((s) => [s.id, 0])),
    decor: Object.fromEntries(D.decor.map((d) => [d.id, 0])),

    // 운영진 도감: { [dealerId]: { star, shards } } — 프레스티지에도 유지된다
    dealers: keep.dealers ?? {},
    codexNew: keep.codexNew ?? [],
    // 동시 배치(운영) 중인 운영진 id 목록 — 최대 D.deployment.maxDeployed명. 프레스티지에도 유지.
    deployedIds: keep.deployedIds ?? [],

    // 가챠 레벨(뽑을수록 오름, 최대 10) + 누적 뽑기 횟수 + 무료 뽑기권(반복 퀘스트 보상) — 전부 계정 단위로 유지
    gachaLevel: keep.gachaLevel ?? 1,
    gachaPulls: keep.gachaPulls ?? 0,
    gachaTickets: keep.gachaTickets ?? 0,

    // 닉네임 — 기본값은 로그인 아이디, 프로필에서 자유롭게 변경 가능
    nickname: keep.nickname ?? null,
    // 프로필 레벨업 보상을 이미 지급한 최고 레벨(중복 지급 방지). 프레스티지해도 유지.
    profileRewardedLevel: keep.profileRewardedLevel ?? 1,

    theme: keep.theme ?? "classic",
    ownedThemes: keep.ownedThemes ?? ["classic"],
    themeLevels: keep.themeLevels ?? {},

    giftReadyAt: keep.giftReadyAt ?? Date.now(),
    prestige: keep.prestige ?? { points: 0 },

    settings: { showTableIncome: true, autoAssign: true },
    ui: { buyQty: 1, autoUpgrade: false, codexFilter: "all" },

    // 영구 업그레이드 레벨 — 리뉴얼해도 절대 초기화되지 않는다(다이아 전용)
    permanentUpgrades: keep.permanentUpgrades ?? Object.fromEntries(D.permanentUpgrades.map((p) => [p.id, 0])),

    // 광고(리워드) 관련 상태 — 계정 단위로 유지
    ads: keep.ads ?? { lastFreePullDate: null, boostUntil: 0, boostCooldownUntil: 0 },

    // 유명인 방문 이벤트 타이머
    celebrity: keep.celebrity ?? { nextAt: Date.now() + 8 * 60 * 1000, active: null, activeUntil: 0 },

    // 상점(결제) 관련 — 계정과 함께 클라우드에 저장된다
    purchases: keep.purchases ?? {
      firstPurchaseDone: false,
      starterBought: false,
      vipUntil: 0,
      vipLastDailyDate: null,
      totalSpentKRW: 0,
      unlockedMythic: [], // 상점에서 구매해 가챠 풀에 합류시킨 신화 운영진 id 목록
      adsRemoved: false,
    },

    attendance: keep.attendance ?? { lastDate: null, cycleDay: 0 },
    missions: { date: null, list: [], allClaimed: false },
    // 성장 미션(튜토리얼)과 반복 퀘스트는 프레스티지를 해도 이어진다
    tutorial: keep.tutorial ?? { step: 0, counts: {} },
    repeat: keep.repeat ?? { round: 0, quest: null },
    boosts: keep.boosts ?? { freeReadyAt: 0, active: {}, goldenNextAt: Date.now() + 8 * 60 * 1000 },
  });

  let state = defaultState();
  let lastTickAt = Date.now();
  let sceneDirty = true;
  let activeTab = "store";
  let sheetOpen = false;
  let lastAutoAt = 0;
  let lastLiveRenderAt = 0;
  // 도감을 연 순간의 NEW 목록. 탭을 여는 즉시 알림 점은 끄되, 배지는 보는 동안 유지한다.
  let codexNewSnapshot = [];

  // 칩 보유량에 따라 버튼 활성/비활성이 바뀌는 탭만 주기적으로 다시 그린다.
  const LIVE_TABS = new Set(["store", "tables", "staff", "decor", "prestige"]);
  const LIVE_RENDER_MS = 500;

  // 저장된 데이터에 새 필드가 없어도 기본값으로 채우고, 옛 세이브 형식을 마이그레이션한다.
  function mergeWithDefaults(saved) {
    const base = defaultState();
    const s = { ...base, ...saved };

    s.store = { ...base.store, ...saved.store };
    s.fixtures = { ...base.fixtures, ...saved.fixtures };
    s.staff = { ...base.staff, ...saved.staff };
    s.settings = { ...base.settings, ...saved.settings };
    s.ui = { ...base.ui, ...saved.ui };
    s.prestige = { ...base.prestige, ...saved.prestige };
    s.attendance = { ...base.attendance, ...saved.attendance };
    s.boosts = { ...base.boosts, ...saved.boosts };
    s.boosts.active = s.boosts.active || {};
    s.purchases = { ...base.purchases, ...saved.purchases };
    s.purchases.unlockedMythic = Array.isArray(saved.purchases?.unlockedMythic) ? saved.purchases.unlockedMythic : [];
    s.permanentUpgrades = { ...base.permanentUpgrades, ...saved.permanentUpgrades };
    s.ads = { ...base.ads, ...saved.ads };
    s.celebrity = { ...base.celebrity, ...saved.celebrity };
    s.deployedIds = Array.isArray(saved.deployedIds) ? saved.deployedIds : [];
    s.gachaLevel = saved.gachaLevel ?? 1;
    s.gachaPulls = saved.gachaPulls ?? 0;
    s.gachaTickets = saved.gachaTickets ?? 0;
    s.nickname = saved.nickname ?? null;
    s.profileRewardedLevel = saved.profileRewardedLevel ?? 1;
    s.missions = { ...base.missions, ...saved.missions };
    s.tutorial = { ...base.tutorial, ...saved.tutorial };
    s.tutorial.counts = s.tutorial.counts || {};
    s.repeat = { ...base.repeat, ...saved.repeat };
    s.themeLevels = { ...base.themeLevels, ...saved.themeLevels };
    s.ownedThemes = Array.isArray(saved.ownedThemes) ? saved.ownedThemes : base.ownedThemes;
    s.codexNew = Array.isArray(saved.codexNew) ? saved.codexNew : [];
    s.lifetimeEarned = saved.lifetimeEarned ?? saved.totalEarned ?? 0;

    // 장식품: 예전에는 boolean(사면 끝)이었고 지금은 무한 레벨이다.
    s.decor = { ...base.decor };
    if (saved.decor) {
      Object.entries(saved.decor).forEach(([k, v]) => {
        if (!(k in s.decor)) return;
        s.decor[k] = v === true ? 1 : typeof v === "number" ? v : 0;
      });
    }

    // 딜러: 예전에는 [{rarity, bonus}] 배열이었고 지금은 이름 붙은 도감이다.
    if (Array.isArray(saved.dealers)) {
      const migrated = {};
      saved.dealers.forEach((old) => {
        const pool = D.dealerRoster.filter((r) => r.rarity === old.rarity);
        if (!pool.length) return;
        const fresh = pool.find((r) => !migrated[r.id]);
        if (fresh) migrated[fresh.id] = { star: 1, shards: 0 };
        else {
          const target = pool[Math.floor(Math.random() * pool.length)];
          migrated[target.id].shards += 1;
        }
      });
      s.dealers = migrated;
    } else {
      s.dealers = saved.dealers && typeof saved.dealers === "object" ? saved.dealers : {};
    }
    // 예전 "칩으로 고용하는 딜러" 잔재 제거
    if (s.staff.dealer !== undefined) delete s.staff.dealer;

    return s;
  }

  // ============================================================
  // 비용 계산 (기하급수 · 무한 업그레이드)
  // ============================================================
  const costFor = (base, growth, owned) => Math.ceil(base * Math.pow(growth, owned));

  // owned개를 이미 가진 상태에서 n개를 더 살 때의 총 비용
  function bulkCost(base, growth, owned, n) {
    if (n <= 0) return 0;
    if (growth === 1) return Math.ceil(base * n);
    const first = base * Math.pow(growth, owned);
    return Math.ceil((first * (Math.pow(growth, n) - 1)) / (growth - 1));
  }

  // 가진 칩으로 최대 몇 개까지 살 수 있는지
  function maxAffordable(chips, base, growth, owned) {
    const first = base * Math.pow(growth, owned);
    if (chips < first) return 0;
    if (growth === 1) return Math.floor(chips / base);
    const n = Math.floor(Math.log(1 + (chips * (growth - 1)) / first) / Math.log(growth));
    return Math.max(0, n);
  }

  // 현재 선택된 배수(x1/x10/x100/MAX)로 실제 몇 개를 살지 결정
  function plannedQty(base, growth, owned, cap = Infinity) {
    const q = state.ui.buyQty;
    if (q === "MAX") {
      return Math.max(0, Math.min(maxAffordable(state.chips, base, growth, owned), cap));
    }
    return Math.max(0, Math.min(q, cap));
  }

  // ============================================================
  // 파생값
  // ============================================================
  // 3D 씬이 실제로 그릴 수 있는 한계(D.store.maxShownSlots)를 넘는 슬롯은 아예 팔지 않는다
  // ("확장했다고 표시만 되고 실제 테이블은 안 보이는" 문제를 없애기 위해 상한을 둠).
  const tableCapacity = () => Math.min(D.store.maxShownSlots, D.store.baseCapacity + state.store.expansions * D.store.capacityPerExpansion);
  const isStoreMaxed = () => tableCapacity() >= D.store.maxShownSlots;
  const expansionCost = () => costFor(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions);
  const staffDef = (id) => D.staff.find((s) => s.id === id);
  const fixtureDef = (id) => D.fixtures.find((f) => f.id === id);
  const decorDef = (id) => D.decor.find((d) => d.id === id);
  const themeDef = (id) => D.themes.find((t) => t.id === id);
  const themeLevel = (id = state.theme) => state.themeLevels[id] || 0;

  // 운영진 한 명의 실제 보너스 (등급 기본값 × ★ 보정) — 배치 여부와 무관하게 계산은 가능하지만
  // 실제로 수익에 반영되는 건 "배치된"(deployedIds) 인원의 보너스뿐이다.
  function dealerBonus(dealerId) {
    const owned = state.dealers[dealerId];
    if (!owned) return 0;
    const def = rosterDef(dealerId);
    if (!def) return 0;
    const base = rarityDef(def.rarity).bonus;
    return base * (1 + (owned.star - 1) * D.dealerStar.bonusPerStar);
  }
  const ownedDealerIds = () => Object.keys(state.dealers).filter((id) => rosterDef(id));

  // ---------- 배치(운영) ----------
  const deployedIds = () => (state.deployedIds || []).filter((id) => state.dealers[id]);
  const isDeployed = (id) => deployedIds().includes(id);
  const deployedBonusSum = () => deployedIds().reduce((sum, id) => sum + dealerBonus(id), 0);

  // 배치된 인원끼리 서로 다른 역할(role)을 고루 갖추면 시너지, 정원(10명)을 꽉 채우면 추가 보너스
  function deploymentSynergyMultiplier() {
    const ids = deployedIds();
    if (ids.length === 0) return 1;
    const roles = new Set(ids.map((id) => rosterDef(id)?.role).filter(Boolean));
    let mult = 1 + roles.size * D.deployment.synergyPerRole;
    if (ids.length >= D.deployment.maxDeployed) mult *= 1 + D.deployment.fullSquadBonus;
    return mult;
  }
  const deploymentBonusTotal = () => deployedBonusSum() * deploymentSynergyMultiplier();

  function toggleDeploy(dealerId) {
    const list = state.deployedIds || (state.deployedIds = []);
    const idx = list.indexOf(dealerId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= D.deployment.maxDeployed) {
        toast(`⚠️ 동시 배치는 최대 ${D.deployment.maxDeployed}명까지예요`);
        return;
      }
      list.push(dealerId);
    }
    sceneDirty = true;
    refresh();
  }

  // 새로 스카우트한 운영진은 자동배치 설정이 켜져 있고 자리가 남아있으면 바로 배치된다
  function autoDeployIfRoom(dealerId) {
    if (!state.settings.autoAssign) return;
    const list = state.deployedIds || (state.deployedIds = []);
    if (list.length < D.deployment.maxDeployed && !list.includes(dealerId)) list.push(dealerId);
  }

  // 테이블에 앉힐 운영진 목록(3D 씬 표시용) — 배치된 인원을 우선 채우고, 자리가 남으면 미배치 보유 인원,
  // 그래도 모자라면 이름 없는 기본 운영진(rarity:"staff")으로 채운다. 빈 테이블은 절대 없다.
  function assignedDealers() {
    const shown = Math.min(state.tables, D.store.maxShownSlots);
    const deployed = deployedIds();
    const rest = ownedDealerIds().filter((id) => !deployed.includes(id));
    const ordered = state.settings.autoAssign
      ? [...deployed, ...rest].sort((a, b) => dealerBonus(b) - dealerBonus(a))
      : [...deployed, ...rest];
    const list = [];
    for (let i = 0; i < shown; i++) {
      const id = ordered[i];
      list.push(id ? { id, rarity: rosterDef(id).rarity } : { id: null, rarity: "staff" });
    }
    return list;
  }

  // 활성화된 부스트 배율 (서로 곱해진다)
  function boostMultiplier() {
    const now = Date.now();
    let mult = 1;
    Object.entries(state.boosts.active).forEach(([id, until]) => {
      if (until > now) {
        const def = D.boosts[id];
        if (def) mult *= def.mult;
      }
    });
    return mult;
  }

  const prestigeMultiplier = (points = state.prestige.points) => 1 + points * D.prestige.pointBonus;

  function incomeMultiplier() {
    let mult = 1;
    D.staff.forEach((s) => {
      if (s.effect.type === "incomeMult") mult += s.effect.value * state.staff[s.id];
    });
    mult += deploymentBonusTotal();
    D.decor.forEach((d) => {
      mult += d.bonusPerLevel * (state.decor[d.id] || 0);
    });
    mult += D.themeUpgrade.bonusPerLevel * themeLevel();
    mult += permanentBonus("incomeCore");
    if (vipActive()) mult *= 1 + D.shop.vip.incomeBonusPct / 100;
    mult *= customerFlowMultiplier();
    mult *= prestigeMultiplier();
    mult *= boostMultiplier();
    return mult;
  }

  const vipActive = () => state.purchases.vipUntil > Date.now();

  // ---------- 방문객(마케터가 늘리는 값) ----------
  // 마케터는 더 이상 매출에 고정 %를 더하지 않고, "시간당 방문객 수"를 늘린다.
  // 방문객이 많을수록 매출도 늘지만 로그형으로 완만하게 체감된다(무한정 비례하지 않음).
  function visitorsPerHour() {
    const c = D.customerFlow;
    const marketerStaff = staffDef("marketer");
    const marketerLevel = state.staff.marketer || 0;
    const marketerMult = 1 + (marketerStaff?.effect.value ?? 0) * marketerLevel;
    const base = c.baseVisitorsPerHour + state.tables * c.visitorsPerTable;
    return Math.round(base * marketerMult);
  }
  function customerFlowMultiplier() {
    const c = D.customerFlow;
    return 1 + Math.log2(1 + visitorsPerHour() / c.visitorDivisor) * c.incomePerVisitorLog;
  }

  // ---------- 영구 업그레이드 (리뉴얼해도 초기화되지 않음, 다이아 전용) ----------
  const permanentDef = (id) => D.permanentUpgrades.find((p) => p.id === id);
  const permanentLevel = (id) => state.permanentUpgrades[id] || 0;
  const permanentCost = (id) => {
    const def = permanentDef(id);
    return Math.ceil(def.baseCostDiamonds * Math.pow(def.costGrowth, permanentLevel(id)));
  };
  const permanentBonus = (id) => {
    const def = permanentDef(id);
    if (!def) return 0;
    return def.bonusPerLevel * permanentLevel(id);
  };
  function buyPermanent(id) {
    const def = permanentDef(id);
    const cost = permanentCost(id);
    if (!def || state.diamonds < cost) {
      toast("💎 다이아가 부족해요");
      return;
    }
    state.diamonds -= cost;
    state.permanentUpgrades[id] = permanentLevel(id) + 1;
    toast(`🏆 ${def.name} Lv.${state.permanentUpgrades[id]}!`);
    burst(0xffd24a);
    renderShopTab();
    refresh();
  }

  function fixtureIncome() {
    let income = 0;
    D.fixtures.forEach((f) => {
      if (f.incomePerLevel) income += f.incomePerLevel * state.fixtures[f.id];
    });
    return income;
  }

  const perTableIncome = () =>
    D.table.baseIncome * (1 + state.tableLevel * D.tableUpgrade.bonusPerLevel) * incomeMultiplier();
  const incomePerSecond = () => state.tables * perTableIncome() + fixtureIncome() * incomeMultiplier();

  const diamondPerSecond = () => {
    const vaultLevel = state.fixtures.vault || 0;
    return (
      D.diamond.baseRatePerTableSecond *
      state.tables *
      (1 + vaultLevel * D.diamond.vaultBonusPerLevel) *
      prestigeMultiplier()
    );
  };

  function offlineEfficiency() {
    let eff = D.offline.baseEfficiency;
    D.staff.forEach((s) => {
      if (s.effect.type === "offline") eff += s.effect.value * state.staff[s.id];
    });
    eff += permanentBonus("offlineCore");
    return Math.min(D.offline.maxEfficiency, eff);
  }

  const prestigeRequirement = (forPoints = state.prestige.points + 1) =>
    Math.round(D.prestige.baseRequirement * forPoints * forPoints);
  const potentialPrestigePoints = () => {
    if (state.totalEarned < D.prestige.baseRequirement) return 0;
    return Math.floor(Math.sqrt(state.totalEarned / D.prestige.baseRequirement));
  };

  // 프로필 레벨: 전체 누적 수익 기반 (프레스티지해도 유지)
  function levelInfo() {
    const { base, growth } = D.level;
    const x = Math.max(0, state.lifetimeEarned);
    const level = 1 + Math.floor(Math.log(1 + x / base) / Math.log(growth));
    // 레벨 n의 시작 누적치: base * (growth^(n-1) - 1)
    const startOf = (lv) => base * (Math.pow(growth, lv - 1) - 1);
    const cur = startOf(level);
    const next = startOf(level + 1);
    const progress = next > cur ? Math.min(1, (x - cur) / (next - cur)) : 0;
    let title = D.level.titles[0].name;
    D.level.titles.forEach((t) => {
      if (level >= t.min) title = t.name;
    });
    return { level, progress, title, toNext: Math.max(0, next - x) };
  }

  // 프로필 레벨이 오를 때마다 다이아를 지급한다(이미 지급한 레벨은 다시 지급 안 함)
  function checkProfileLevelReward() {
    const level = levelInfo().level;
    if (level <= state.profileRewardedLevel) return;
    let totalDia = 0;
    for (let lv = state.profileRewardedLevel + 1; lv <= level; lv++) {
      totalDia += D.level.diamondRewardBase + lv * D.level.diamondRewardPerLevel;
    }
    state.profileRewardedLevel = level;
    addDiamonds(totalDia);
    toast(`🆙 레벨 ${level} 달성! 💎${totalDia} 지급`);
    burst(0xffd24a);
  }

  const displayName = () => state.nickname || (window.Account ? window.Account.getCurrentUsername() : null) || "사장님";

  // ============================================================
  // 표시용 포맷
  // ============================================================
  const NUM_UNITS = [
    { val: 1e32, label: "구" },
    { val: 1e28, label: "양" },
    { val: 1e24, label: "자" },
    { val: 1e20, label: "해" },
    { val: 1e16, label: "경" },
    { val: 1e12, label: "조" },
    { val: 1e8, label: "억" },
    { val: 1e4, label: "만" },
  ];
  function formatNumber(n) {
    if (!isFinite(n)) return "∞";
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString("ko-KR");
    for (const u of NUM_UNITS) {
      if (n >= u.val) return (n / u.val).toFixed(2).replace(/\.?0+$/, "") + u.label;
    }
    return n.toExponential(2);
  }
  // 화폐 단위는 BB(빅블라인드) — 홀덤 테마에 맞춰 칩 대신 이 단위를 씀
  const formatChips = (n) => `${formatNumber(n)} BB`;
  function formatRate(n) {
    if (n < 100) return (Math.round(n * 10) / 10).toFixed(1);
    return formatNumber(n);
  }
  function formatDuration(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}분 ${s % 60}초`;
    return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  }

  // ============================================================
  // 이펙트
  // ============================================================
  function toast(msg) {
    const wrap = $("toast-wrap");
    if (!wrap) return;
    while (wrap.children.length >= 3) wrap.removeChild(wrap.firstChild);
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
  const burst = (color) => window.PubScene3D && window.PubScene3D.chipBurst(color);

  // ============================================================
  // 재화 / 보상
  // ============================================================
  function addChips(amount) {
    state.chips += amount;
    state.totalEarned += amount;
    state.lifetimeEarned += amount;
  }
  const addDiamonds = (amount) => {
    state.diamonds += amount;
  };
  // chipSeconds 단위 보상을 실제 칩으로 환산 (초반에도 최소한의 값은 보장)
  const chipSecondsToChips = (sec) => Math.max(20, incomePerSecond() * sec);

  function grantReward(reward) {
    let chips = 0;
    let dia = 0;
    if (reward.chipSeconds) {
      chips = chipSecondsToChips(reward.chipSeconds);
      addChips(chips);
    }
    if (reward.diamonds) {
      dia = reward.diamonds;
      addDiamonds(dia);
    }
    if (reward.tickets) {
      state.gachaTickets = (state.gachaTickets || 0) + reward.tickets;
    }
    return { chips, dia, tickets: reward.tickets || 0 };
  }
  const rewardLabel = (reward) => {
    const parts = [];
    if (reward.chipSeconds) parts.push(`💰${formatChips(chipSecondsToChips(reward.chipSeconds))}`);
    if (reward.diamonds) parts.push(`💎${reward.diamonds}`);
    if (reward.tickets) parts.push(`🎫${reward.tickets}`);
    return parts.join(" · ");
  };

  // ============================================================
  // 미션 추적
  // ============================================================
  function trackMission(actionId, amount = 1) {
    // 성장 미션(튜토리얼)의 일회성 목표도 같은 이벤트로 센다.
    // 이 카운터는 프레스티지·날짜 변경에도 초기화하지 않는다 — 초기화하면
    // "출석 보상 받기" 같은 하루 한 번짜리 목표에서 진행이 막혀버린다.
    state.tutorial.counts[actionId] = (state.tutorial.counts[actionId] || 0) + amount;
    // 반복 퀘스트 진행도
    if (state.repeat.quest && state.repeat.quest.id === actionId) {
      state.repeat.quest.progress += amount;
    }
    let changed = false;
    state.missions.list.forEach((m) => {
      if (m.id === actionId && !m.claimed && m.progress < m.target) {
        m.progress = Math.min(m.target, m.progress + amount);
        changed = true;
      }
    });
    if (changed) refreshDots();
  }

  function rollMissions() {
    const pool = [...D.missions.pool];
    const list = [];
    for (let i = 0; i < D.missions.slots && pool.length; i++) {
      const def = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const target = def.targets[Math.min(i, def.targets.length - 1)];
      list.push({ id: def.id, target, progress: 0, claimed: false });
    }
    state.missions = { date: todayKey(), list, allClaimed: false };
  }

  function ensureDailyState() {
    const key = todayKey();
    if (state.missions.date !== key) rollMissions();
    if (vipActive() && state.purchases.vipLastDailyDate !== key) {
      state.purchases.vipLastDailyDate = key;
      addDiamonds(D.shop.vip.dailyDiamonds);
      toast(`👑 월 정기권 · 오늘의 다이아 💎${D.shop.vip.dailyDiamonds} 지급!`);
    }
  }

  function claimMission(index) {
    const m = state.missions.list[index];
    if (!m || m.claimed || m.progress < m.target) return;
    const def = D.missions.pool.find((p) => p.id === m.id);
    m.claimed = true;
    const got = grantReward(def.reward);
    toast(`📋 미션 완료! 💰${formatChips(got.chips)} 💎${got.dia}`);
    burst();
    if (state.missions.list.every((x) => x.claimed) && !state.missions.allClaimed) {
      state.missions.allClaimed = true;
      const bonus = grantReward(D.missions.allClearReward);
      toast(`🏆 오늘의 미션 전부 완료! 💰${formatChips(bonus.chips)} 💎${bonus.dia}`);
    }
    renderMissionModal();
    refreshDots();
  }

  // ============================================================
  // 성장 미션 (튜토리얼을 가장한 순차 퀘스트)
  // ============================================================
  function tutorialStat(key) {
    switch (key) {
      case "tables": return state.tables;
      case "tableLevel": return state.tableLevel;
      case "store.expansions": return state.store.expansions;
      case "fixtures.bar": return state.fixtures.bar || 0;
      case "fixtures.fridge": return state.fixtures.fridge || 0;
      case "fixtures.vault": return state.fixtures.vault || 0;
      case "staff.bartender": return state.staff.bartender || 0;
      case "staff.server": return state.staff.server || 0;
      case "staff.marketer": return state.staff.marketer || 0;
      case "dealerCount": return ownedDealerIds().length;
      case "decorTotal": return D.decor.reduce((sum, d) => sum + (state.decor[d.id] || 0), 0);
      case "themeCount": return state.ownedThemes.length;
      case "prestigePoints": return state.prestige.points;
      case "maxStar": return ownedDealerIds().reduce((m, id) => Math.max(m, state.dealers[id].star), 0);
      case "level": return levelInfo().level;
      default: return 0;
    }
  }

  // 현재 단계와 진행도. 전부 끝났으면 null.
  function tutorialState() {
    const step = state.tutorial.step;
    if (step >= D.tutorial.length) return null;
    const def = D.tutorial[step];
    const raw =
      def.goal.kind === "state"
        ? tutorialStat(def.goal.stat)
        : state.tutorial.counts[def.goal.action] || 0;
    return {
      def,
      step,
      cur: Math.min(raw, def.goal.target),
      target: def.goal.target,
      done: raw >= def.goal.target,
    };
  }

  function claimTutorial() {
    const t = tutorialState();
    if (!t || !t.done) return;
    const got = grantReward(t.def.reward);
    state.tutorial.step += 1;
    toast(`📜 ${t.def.title} 완료! 💰${formatChips(got.chips)} 💎${got.dia}`);
    burst("#ffd166");
    const next = tutorialState();
    if (next) setTimeout(() => toast(`📜 다음 목표: ${next.def.title}`), 1200);
    else setTimeout(() => toast("🏆 성장 미션 완료! 이제 반복 퀘스트가 계속 이어져요"), 1200);
    refresh();
  }

  // ============================================================
  // 반복 퀘스트 (무한) — 성장 미션이 끝나면 같은 배너에서 이어진다
  // ============================================================
  const repeatDef = (id) => D.repeatQuests.pool.find((p) => p.id === id);

  function rollRepeatQuest() {
    const pool = D.repeatQuests.pool;
    const prev = state.repeat.quest && state.repeat.quest.id;
    // 같은 퀘스트가 연달아 나오지 않게 한 번 걸러준다
    const candidates = pool.filter((p) => p.id !== prev);
    const list = candidates.length ? candidates : pool;
    const def = list[Math.floor(Math.random() * list.length)];
    const round = state.repeat.round;
    // 회차에 따라 목표가 커지되 항목별 상한까지만 — 후반에 깰 수 없는 퀘스트가 나오지 않게 한다
    const target =
      def.id === "earn"
        ? Math.max(200, Math.ceil(incomePerSecond() * Math.min(def.maxSeconds || Infinity, def.incomeSeconds * Math.pow(def.growth, round))))
        : Math.max(1, Math.min(def.max || Infinity, Math.ceil(def.base * Math.pow(def.growth, round))));
    state.repeat.quest = { id: def.id, target, progress: 0, startEarned: state.totalEarned };
  }

  function repeatReward() {
    const R = D.repeatQuests.reward;
    const r = state.repeat.round;
    const tickets = Math.min(R.ticketsMax, R.ticketsBase + Math.floor(r / R.ticketsEveryNRounds));
    return {
      chipSeconds: Math.min(R.chipSecondsMax, R.chipSecondsBase + r * R.chipSecondsPerRound),
      diamonds: Math.min(R.diamondsMax, Math.round(R.diamondsBase + r * R.diamondsPerRound)),
      tickets,
    };
  }

  function repeatState() {
    if (!state.repeat.quest || !repeatDef(state.repeat.quest.id)) rollRepeatQuest();
    const q = state.repeat.quest;
    const def = repeatDef(q.id);
    // "칩 벌기"는 별도 카운터 없이 누적 수익 차이로 판정한다
    const raw = q.id === "earn" ? Math.max(0, state.totalEarned - q.startEarned) : q.progress;
    return {
      def,
      cur: Math.min(raw, q.target),
      target: q.target,
      done: raw >= q.target,
      round: state.repeat.round,
      reward: repeatReward(),
    };
  }

  function claimRepeat() {
    const r = repeatState();
    if (!r.done) return;
    const got = grantReward(r.reward);
    state.repeat.round += 1;
    rollRepeatQuest();
    const ticketPart = got.tickets ? ` 🎫${got.tickets}` : "";
    toast(`🔁 반복 퀘스트 #${r.round + 1} 완료! 💰${formatChips(got.chips)} 💎${got.dia}${ticketPart}`);
    burst("#7bc67e");
    refresh();
  }

  // ============================================================
  // 출석
  // ============================================================
  const attendanceReady = () => state.attendance.lastDate !== todayKey();
  function claimAttendance() {
    if (!attendanceReady()) {
      toast("📅 오늘 출석은 이미 받았어요!");
      return;
    }
    const day = (state.attendance.cycleDay % D.attendance.cycleLength) + 1;
    const def = D.attendance.rewards[day - 1];
    const got = grantReward({ chipSeconds: def.chipSeconds, diamonds: def.diamonds });
    state.attendance.lastDate = todayKey();
    state.attendance.cycleDay = day % D.attendance.cycleLength;
    trackMission("attendance");
    toast(`📅 ${day}일차 출석! ${got.chips ? `💰${formatChips(got.chips)} ` : ""}${got.dia ? `💎${got.dia}` : ""}`);
    burst("#ffd166");
    renderAttendanceModal();
    refreshDots();
  }

  // ============================================================
  // 부스트
  // ============================================================
  const boostActiveUntil = (id) => state.boosts.active[id] || 0;
  const boostIsActive = (id) => boostActiveUntil(id) > Date.now();
  const freeBoostReady = () => Date.now() >= (state.boosts.freeReadyAt || 0);

  function activateBoost(id) {
    const def = D.boosts[id];
    if (!def) return;
    // 이미 적용 중인 부스트는 재구매/재발동 불가(만료될 때까지 기다려야 함)
    if (boostIsActive(id)) {
      toast(`${def.emoji} 이미 적용 중이에요 · ${formatDuration(boostActiveUntil(id) - Date.now())} 남음`);
      return;
    }
    if (id === "free") {
      if (!freeBoostReady()) {
        toast(`⚡ ${formatDuration(state.boosts.freeReadyAt - Date.now())} 후에 다시 쓸 수 있어요`);
        return;
      }
      state.boosts.freeReadyAt = Date.now() + def.cooldownMs;
    } else if (id === "rush") {
      if (state.diamonds < def.costDiamonds) {
        toast("💎 다이아가 부족해요");
        return;
      }
      state.diamonds -= def.costDiamonds;
    }
    state.boosts.active[id] = Date.now() + def.durationMs;
    trackMission("boost");
    toast(`${def.emoji} ${def.name} 발동! 수익 x${def.mult}`);
    burst("#ffb43c");
    renderBoostModal();
    refreshDots();
  }

  function tickGoldenHour() {
    const def = D.boosts.golden;
    const now = Date.now();
    if (!state.boosts.goldenNextAt) {
      state.boosts.goldenNextAt = now + def.minIntervalMs;
      return;
    }
    if (now >= state.boosts.goldenNextAt) {
      state.boosts.active.golden = now + def.durationMs;
      state.boosts.goldenNextAt =
        now + def.durationMs + def.minIntervalMs + Math.random() * (def.maxIntervalMs - def.minIntervalMs);
      toast(`🌟 황금 시간대! ${formatDuration(def.durationMs)} 동안 수익 x${def.mult}`);
      burst("#ffd166");
    }
  }

  // ---------- 유명인 방문 특수 이벤트 ----------
  function tickCelebrity() {
    const c = D.celebrity;
    const now = Date.now();
    if (state.celebrity.active && now >= state.celebrity.activeUntil) {
      state.celebrity.active = null;
      state.celebrity.nextAt = now + c.minIntervalMs + Math.random() * (c.maxIntervalMs - c.minIntervalMs);
    }
    if (!state.celebrity.active && now >= state.celebrity.nextAt) {
      const guest = c.guests[Math.floor(Math.random() * c.guests.length)];
      state.celebrity.active = guest.name;
      state.celebrity.activeUntil = now + c.visitDurationMs;
      showCelebrityModal(guest);
    }
  }
  function showCelebrityModal(guest) {
    $("celebrity-emoji").textContent = guest.emoji;
    $("celebrity-name").textContent = `${guest.name}님이 방문했어요!`;
    $("celebrity-line").textContent = guest.line;
    $("celebrity-modal").classList.remove("hidden");
  }
  function claimCelebrity() {
    const got = grantReward(D.celebrity.reward);
    toast(`🌟 특별 방문 보상! 💰${formatChips(got.chips)} 💎${got.dia}`);
    $("celebrity-modal").classList.add("hidden");
    burst(0xffd24a);
    refresh();
  }

  // ============================================================
  // 액션 — 모두 무한 업그레이드 + 일괄 구매 지원
  // ============================================================
  function buyTable(force) {
    const cap = tableCapacity() - state.tables;
    if (cap <= 0) {
      toast("🏗 매장이 가득 찼어요! 확장해보세요");
      return 0;
    }
    const n = force || plannedQty(D.table.baseCost, D.table.costGrowth, state.tables - 1, cap);
    if (n <= 0) return 0;
    const cost = bulkCost(D.table.baseCost, D.table.costGrowth, state.tables - 1, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.tables += n;
    sceneDirty = true;
    trackMission("buyTable", n);
    toast(`🃏 테이블 ${n > 1 ? `${n}개 ` : ""}오픈! (총 ${state.tables})`);
    burst();
    refresh();
    return n;
  }

  function upgradeTable(force) {
    const n = force || plannedQty(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel);
    if (n <= 0) return 0;
    const cost = bulkCost(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.tableLevel += n;
    sceneDirty = true;
    trackMission("upgradeTable", n);
    toast(`📈 리모델링 Lv.${state.tableLevel}!`);
    refresh();
    return n;
  }

  function expandStore(force) {
    if (isStoreMaxed()) {
      toast(`🏗 이미 최대 ${D.store.maxShownSlots}칸까지 확장했어요`);
      return 0;
    }
    const n = force || plannedQty(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions);
    if (n <= 0) return 0;
    const cost = bulkCost(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.store.expansions += n;
    sceneDirty = true;
    trackMission("expand", n);
    toast(`🏗 매장 확장! 슬롯 +${D.store.capacityPerExpansion * n}`);
    refresh();
    return n;
  }

  function upgradeFixture(id, force) {
    const def = fixtureDef(id);
    const owned = state.fixtures[id];
    const n = force || plannedQty(def.baseCost, def.costGrowth, owned);
    if (n <= 0) return 0;
    const cost = bulkCost(def.baseCost, def.costGrowth, owned, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.fixtures[id] += n;
    sceneDirty = true;
    trackMission("upgradeFixture", n);
    toast(`${def.emoji} ${def.name} Lv.${state.fixtures[id]}`);
    refresh();
    return n;
  }

  function hireStaff(id, force) {
    const def = staffDef(id);
    const owned = state.staff[id];
    const n = force || plannedQty(def.baseCost, def.costGrowth, owned);
    if (n <= 0) return 0;
    const cost = bulkCost(def.baseCost, def.costGrowth, owned, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.staff[id] += n;
    sceneDirty = true;
    trackMission("hireStaff", n);
    toast(`${def.emoji} ${def.name} 고용! (총 ${state.staff[id]}명)`);
    refresh();
    return n;
  }

  function upgradeDecor(id, force) {
    const def = decorDef(id);
    const owned = state.decor[id] || 0;
    const n = force || plannedQty(def.baseCost, def.costGrowth, owned);
    if (n <= 0) return 0;
    const cost = bulkCost(def.baseCost, def.costGrowth, owned, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.decor[id] = owned + n;
    sceneDirty = true;
    trackMission("upgradeDecor", n);
    toast(`${def.emoji} ${def.name} Lv.${state.decor[id]}`);
    refresh();
    return n;
  }

  function buyTheme(id) {
    const def = themeDef(id);
    if (!def || state.ownedThemes.includes(id) || state.chips < def.cost) return;
    state.chips -= def.cost;
    state.ownedThemes.push(id);
    state.theme = id;
    sceneDirty = true;
    toast(`${def.emoji} ${def.name} 테마 구매!`);
    refresh();
  }
  function equipTheme(id) {
    if (!state.ownedThemes.includes(id) || state.theme === id) return;
    state.theme = id;
    sceneDirty = true;
    toast(`${themeDef(id).emoji} ${themeDef(id).name} 적용!`);
    refresh();
  }
  function upgradeTheme(id, force) {
    if (!state.ownedThemes.includes(id)) return 0;
    const owned = themeLevel(id);
    const n = force || plannedQty(D.themeUpgrade.baseCost, D.themeUpgrade.costGrowth, owned);
    if (n <= 0) return 0;
    const cost = bulkCost(D.themeUpgrade.baseCost, D.themeUpgrade.costGrowth, owned, n);
    if (state.chips < cost) return 0;
    state.chips -= cost;
    state.themeLevels[id] = owned + n;
    sceneDirty = true;
    toast(`${themeDef(id).emoji} 인테리어 등급 Lv.${state.themeLevels[id]}`);
    refresh();
    return n;
  }

  // ---------- 선물 ----------
  const isGiftReady = () => Date.now() >= state.giftReadyAt;
  function openGift() {
    if (!isGiftReady()) {
      toast(`🎁 다음 선물까지 ${formatDuration(state.giftReadyAt - Date.now())}`);
      return;
    }
    const chipGain = chipSecondsToChips(D.gift.chipSeconds);
    const diaGain = D.gift.diamondMin + Math.floor(Math.random() * (D.gift.diamondMax - D.gift.diamondMin + 1));
    addChips(chipGain);
    addDiamonds(diaGain);
    state.giftReadyAt = Date.now() + D.gift.cooldownMs;
    trackMission("gift");
    $("event-text").textContent = `칩 ${formatChips(chipGain)}과 다이아 ${diaGain}개를 받았어요!`;
    $("event-modal").classList.remove("hidden");
    burst();
    refresh();
  }

  // ---------- 가챠 ----------
  const mythicUnlocked = () => (state.purchases.unlockedMythic || []).length > 0;

  // 가챠 레벨(1~10)에 따른 등급별 확률(%). ssr/sr/r/u는 표에서 가져오고, 나머지는 전부 N(일반)이 가져간다.
  function gachaRarityPercents() {
    const row = D.gacha.levelTable[Math.min(state.gachaLevel, D.gacha.maxLevel) - 1];
    const luckMult = 1 + permanentBonus("gachaCore"); // 영구 행운 코어: N을 제외한 등급 확률을 끌어올림
    const ssr = row.ssr * luckMult;
    const sr = row.sr * luckMult;
    const r = row.r * luckMult;
    const u = row.u * luckMult;
    const n = Math.max(0, 100 - ssr - sr - r - u);
    return { common: n, uncommon: u, rare: r, epic: sr, legendary: ssr };
  }

  function weightedRandomRarity(minRarity) {
    const percents = gachaRarityPercents();
    let pool = D.gacha.rarities.map((r) => ({ r, w: percents[r.id] ?? 0 }));
    if (mythicUnlocked()) pool.push({ r: D.gacha.mythicRarity, w: D.gacha.mythicRarity.weight });
    if (minRarity) {
      const minIdx = pool.findIndex((x) => x.r.id === minRarity);
      pool = pool.slice(minIdx);
    }
    const total = pool.reduce((sum, x) => sum + x.w, 0);
    let roll = Math.random() * total;
    for (const x of pool) {
      if (roll < x.w) return x.r;
      roll -= x.w;
    }
    return pool[pool.length - 1].r;
  }

  // 뽑을 때마다 누적 카운트 → D.gacha.pullsPerLevel회마다 가챠 레벨 +1(최대치까지)
  function trackGachaPull() {
    state.gachaPulls += 1;
    const targetLevel = Math.min(D.gacha.maxLevel, 1 + Math.floor(state.gachaPulls / D.gacha.pullsPerLevel));
    if (targetLevel > state.gachaLevel) {
      state.gachaLevel = targetLevel;
      toast(`🎰 가챠 레벨 Lv.${state.gachaLevel}로 상승! 고등급 확률이 올랐어요`);
    }
  }

  // 한 장 뽑기 → 새로 얻었으면 {isNew:true}, 중복이면 조각 +1
  function pullOne(minRarity) {
    trackGachaPull();
    const rarity = weightedRandomRarity(minRarity);
    let pool = D.dealerRoster.filter((d) => d.rarity === rarity.id);
    if (rarity.id === "mythic") {
      const unlocked = state.purchases.unlockedMythic || [];
      pool = pool.filter((d) => unlocked.includes(d.id));
    }
    if (pool.length === 0) pool = D.dealerRoster.filter((d) => d.rarity === "common");
    const def = pool[Math.floor(Math.random() * pool.length)];
    const owned = state.dealers[def.id];
    let isNew = false;
    if (!owned) {
      state.dealers[def.id] = { star: 1, shards: 0 };
      state.codexNew.push(def.id);
      isNew = true;
      autoDeployIfRoom(def.id);
    } else {
      owned.shards += 1;
    }
    return { def, rarity, isNew };
  }

  function showGachaResults(results) {
    const box = $("gacha-results");
    $("gacha-head").textContent = results.length > 1 ? `운영진 ${results.length}명 영입!` : "운영진 영입!";
    box.innerHTML = results
      .map(
        (r, i) => `
        <div class="gacha-result-item" style="--rc:${r.rarity.color};animation-delay:${i * 45}ms">
          <img src="${DealerPortraits.url(r.def.id, r.def.rarity)}" alt="${r.def.name}" />
          <div class="gr-name">${r.def.name}</div>
          <div class="gr-tag">${r.rarity.short}${r.isNew ? " · NEW" : " · 조각+1"}</div>
        </div>`
      )
      .join("");
    $("gacha-modal").classList.remove("hidden");
  }

  function pullGacha(count) {
    const multi = count > 1;
    const cost = multi ? D.gacha.multiCost : D.gacha.costDiamonds;
    if (state.diamonds < cost) {
      toast("💎 다이아가 부족해요");
      return;
    }
    state.diamonds -= cost;
    const rarityRank = (id) => {
      const idx = D.gacha.rarities.findIndex((r) => r.id === id);
      return id === "mythic" ? D.gacha.rarities.length : idx;
    };
    const guaranteeRank = rarityRank(D.gacha.multiGuarantee);
    const results = [];
    for (let i = 0; i < count; i++) {
      // 10연차는 마지막 한 장을 희귀 이상으로 확정(그 전까지 이미 희귀 이상이 나왔으면 확정 불필요)
      const guarantee = multi && i === count - 1 && !results.some((r) => rarityRank(r.rarity.id) >= guaranteeRank);
      results.push(pullOne(guarantee ? D.gacha.multiGuarantee : null));
    }
    trackMission("gacha", count);
    sceneDirty = true;
    showGachaResults(results);
    const best = results.reduce((a, b) => (rarityRank(b.rarity.id) > rarityRank(a.rarity.id) ? b : a));
    burst(best.rarity.color);
    refresh();
  }

  // 무료 뽑기권(반복 퀘스트 보상)으로 1회 뽑기 — 다이아 소모 없음, 가챠 레벨 진행에는 그대로 반영됨
  function pullWithTicket() {
    if ((state.gachaTickets || 0) <= 0) {
      toast("🎫 무료 뽑기권이 없어요 (반복 퀘스트로 받을 수 있어요)");
      return;
    }
    state.gachaTickets -= 1;
    const results = [pullOne(null)];
    trackMission("gacha", 1);
    sceneDirty = true;
    showGachaResults(results);
    burst(results[0].rarity.color);
    refresh();
  }

  // ---------- 운영진 승급 ----------
  function starUpCost(dealerId) {
    const owned = state.dealers[dealerId];
    if (!owned || owned.star >= D.dealerStar.maxStar) return null;
    const def = rosterDef(dealerId);
    const curve = D.dealerStar.shardsPerStarByRarity[def.rarity] || D.dealerStar.shardsPerStarByRarity.common;
    return curve[owned.star - 1];
  }
  function starUp(dealerId) {
    const owned = state.dealers[dealerId];
    const need = starUpCost(dealerId);
    if (!owned || need === null || owned.shards < need) return;
    owned.shards -= need;
    owned.star += 1;
    sceneDirty = true;
    const def = rosterDef(dealerId);
    toast(`⭐ ${def.name} ★${owned.star} 승급!`);
    burst(rarityDef(def.rarity).color);
    renderDealerModal(dealerId);
    refresh();
  }

  // ---------- 프레스티지 / 초기화 ----------
  function doPrestige() {
    const gain = potentialPrestigePoints();
    if (gain <= state.prestige.points) return;
    if (!window.confirm(`정말 브랜드를 리뉴얼할까요?\n테이블·직원·시설·칩이 초기화되고 명성 포인트가 ${gain}점이 됩니다.`)) return;
    const diamondReward = D.diamond.prestigeReward * gain;
    state = defaultState({
      prestige: { points: gain },
      diamonds: state.diamonds + diamondReward,
      dealers: state.dealers,
      codexNew: state.codexNew,
      deployedIds: state.deployedIds,
      gachaLevel: state.gachaLevel,
      gachaPulls: state.gachaPulls,
      gachaTickets: state.gachaTickets,
      nickname: state.nickname,
      profileRewardedLevel: state.profileRewardedLevel,
      permanentUpgrades: state.permanentUpgrades,
      ads: state.ads,
      celebrity: state.celebrity,
      theme: state.theme,
      ownedThemes: state.ownedThemes,
      themeLevels: state.themeLevels,
      giftReadyAt: state.giftReadyAt,
      tutorial: state.tutorial,
      repeat: state.repeat,
      attendance: state.attendance,
      boosts: state.boosts,
      lifetimeEarned: state.lifetimeEarned,
      purchases: state.purchases,
    });
    ensureDailyState();
    sceneDirty = true;
    toast(`✨ 리뉴얼 완료! 명성 ${gain}점 · 💎+${diamondReward}`);
    refresh();
  }

  async function resetGame() {
    if (!window.confirm("정말 모든 진행 상황을 초기화할까요? 되돌릴 수 없어요.")) return;
    state = defaultState();
    ensureDailyState();
    await GameBackend.resetState();
    sceneDirty = true;
    toast("초기화 완료");
    refresh();
  }

  // ============================================================
  // 자동 업그레이드 — 살 수 있는 것 중 가장 싼 것부터
  // ============================================================
  function autoUpgradeTick() {
    if (!state.ui.autoUpgrade) return;
    const now = Date.now();
    if (now - lastAutoAt < D.autoUpgrade.intervalMs) return;
    lastAutoAt = now;

    // 광고로 받은 "업그레이드 가속" 중이면 한 틱에 더 많이 처리한다
    const boosted = state.ads.boostUntil > now;
    const perTick = D.autoUpgrade.maxPerTick * (boosted ? D.ads.upgradeBoost.mult : 1);
    for (let i = 0; i < perTick; i++) {
      const options = [];
      if (state.tables < tableCapacity()) {
        options.push({ cost: costFor(D.table.baseCost, D.table.costGrowth, state.tables - 1), run: () => buyTable(1) });
      }
      options.push({
        cost: costFor(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel),
        run: () => upgradeTable(1),
      });
      if (!isStoreMaxed()) {
        options.push({
          cost: costFor(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions),
          run: () => expandStore(1),
        });
      }
      D.fixtures.forEach((f) => {
        options.push({ cost: costFor(f.baseCost, f.costGrowth, state.fixtures[f.id]), run: () => upgradeFixture(f.id, 1) });
      });
      D.staff.forEach((s) => {
        options.push({ cost: costFor(s.baseCost, s.costGrowth, state.staff[s.id]), run: () => hireStaff(s.id, 1) });
      });
      D.decor.forEach((d) => {
        options.push({ cost: costFor(d.baseCost, d.costGrowth, state.decor[d.id] || 0), run: () => upgradeDecor(d.id, 1) });
      });

      const affordable = options.filter((o) => o.cost <= state.chips).sort((a, b) => a.cost - b.cost);
      if (!affordable.length) return;
      affordable[0].run();
    }
  }

  // ============================================================
  // 렌더링
  // ============================================================
  function renderHUD() {
    $("chips-value").textContent = `${formatNumber(state.chips)} BB`;
    $("income-value").textContent = `${formatRate(incomePerSecond())}BB/초`;
    $("diamonds-value").textContent = formatNumber(state.diamonds);
    $("diamond-rate").textContent = `${(diamondPerSecond() * 60).toFixed(1)}/분`;
    $("prestige-mult").textContent = `x${prestigeMultiplier().toFixed(2)}`;
    renderQuestBanner();

    const li = levelInfo();
    $("avatar-lv").textContent = li.level;
    $("profile-title").textContent = li.title;
    $("xp-fill").style.width = `${(li.progress * 100).toFixed(1)}%`;
    $("avatar-ring").style.setProperty("--xp", `${(li.progress * 100).toFixed(1)}%`);

    // 활성 부스트 표시
    const strip = $("boost-strip");
    const now = Date.now();
    const active = Object.entries(state.boosts.active).filter(([, until]) => until > now);
    strip.innerHTML = active
      .map(([id, until]) => {
        const def = D.boosts[id];
        return `<span class="boost-pill">${def.emoji} x${def.mult} ${formatDuration(until - now)}</span>`;
      })
      .join("");
  }

  // 하단 퀘스트 배너 — 성장 미션이 남아 있으면 그걸, 끝났으면 반복 퀘스트를 보여준다.
  // 배너는 절대 비지 않는다 (항상 다음 목표와 보상이 걸려 있다).
  function currentQuest() {
    const t = tutorialState();
    if (t) {
      return {
        kind: "tutorial",
        key: t.def.goal.stat || t.def.goal.action,
        icon: t.done ? "🎉" : "📜",
        title: t.def.title,
        step: `${t.step + 1}/${D.tutorial.length}`,
        desc: t.def.hint ? `${t.def.desc} · ${t.def.hint}` : t.def.desc,
        cur: t.cur,
        target: t.target,
        done: t.done,
        reward: t.def.reward,
      };
    }
    const r = repeatState();
    return {
      kind: "repeat",
      key: r.def.id,
      icon: r.done ? "🎉" : "🔁",
      title: r.def.title,
      step: `반복 #${r.round + 1}`,
      desc: r.def.desc.replace("{n}", r.def.id === "earn" ? formatNumber(r.target) : r.target),
      cur: r.cur,
      target: r.target,
      done: r.done,
      reward: r.reward,
    };
  }

  function renderQuestBanner() {
    const q = currentQuest();
    const banner = $("quest-banner");
    banner.hidden = false;
    banner.classList.toggle("ready", q.done);
    $("quest-icon").textContent = q.icon;
    $("quest-title").textContent = q.title;
    $("quest-step").textContent = q.step;
    $("quest-desc").textContent = q.done ? `보상 ${rewardLabel(q.reward)}` : q.desc;
    $("quest-fill").style.width = `${((q.cur / q.target) * 100).toFixed(1)}%`;
    const btn = $("quest-claim");
    btn.disabled = !q.done;
    btn.textContent = q.done ? "받기" : `${formatNumber(q.cur)}/${formatNumber(q.target)}`;
  }

  // 퀘스트 배지(받기 버튼 제외)를 탭하면 그 목표를 수행할 수 있는 곳으로 바로 이동시킨다
  const QUEST_TAB_MAP = {
    tables: "tables", buyTable: "tables",
    tableLevel: "tables", upgradeTable: "tables",
    "store.expansions": "store", expand: "store",
    "fixtures.bar": "store", "fixtures.fridge": "store", "fixtures.vault": "store", upgradeFixture: "store",
    "staff.bartender": "staff", "staff.server": "staff", "staff.marketer": "staff", hireStaff: "staff",
    dealerCount: "staff", gacha: "staff",
    decorTotal: "decor", upgradeDecor: "decor", themeCount: "decor",
    prestigePoints: "prestige",
    maxStar: "codex",
    earn: "store",
  };
  const TAB_TITLES = { store: "매장", tables: "테이블", staff: "운영진 & 가챠", codex: "운영진 도감", decor: "인테리어", prestige: "브랜드 리뉴얼" };
  function goToQuest() {
    const q = currentQuest();
    if (q.done) return; // 받을 수 있으면 배지 탭보다 '받기' 버튼을 누르게 유도(배너 자체 탭은 이동만 함)
    if (q.key === "gift") return openGift();
    if (q.key === "boost") {
      renderBoostModal();
      return $("boost-modal").classList.remove("hidden");
    }
    if (q.key === "attendance") {
      renderAttendanceModal();
      return $("attendance-modal").classList.remove("hidden");
    }
    if (q.key === "autoUpgrade") return openSheet("settings", "설정");
    const tab = QUEST_TAB_MAP[q.key];
    if (tab) openSheet(tab, TAB_TITLES[tab] || tab);
  }

  function claimQuest() {
    if (tutorialState()) claimTutorial();
    else claimRepeat();
  }

  function refreshDots() {
    $("gift-dot").classList.toggle("show", isGiftReady());
    $("attendance-dot").classList.toggle("show", attendanceReady());
    const missionReady = state.missions.list.some((m) => !m.claimed && m.progress >= m.target);
    $("mission-dot").classList.toggle("show", missionReady);
    $("boost-dot").classList.toggle("show", freeBoostReady());
    $("codex-dot").classList.toggle("show", state.codexNew.length > 0);
  }

  // 버튼에 "현재 배수 기준 개수/비용"을 채운다
  function setBuyButton(btn, { base, growth, owned, cap = Infinity, label }) {
    const n = plannedQty(base, growth, owned, cap);
    const cost = bulkCost(base, growth, owned, Math.max(n, 1));
    const qtyLabel = state.ui.buyQty === "MAX" ? (n > 0 ? `x${n}` : "MAX") : `x${state.ui.buyQty}`;
    btn.innerHTML = `${label} ${qtyLabel}<small>${formatChips(cost)}</small>`;
    btn.disabled = n <= 0 || state.chips < cost;
    return n;
  }

  function renderStoreTab() {
    $("store-capacity").textContent = tableCapacity();
    const expandBtn = $("expand-store-btn");
    if (isStoreMaxed()) {
      expandBtn.textContent = "최대 확장 완료";
      expandBtn.disabled = true;
    } else {
      setBuyButton(expandBtn, {
        base: D.store.expansionBaseCost,
        growth: D.store.expansionCostGrowth,
        owned: state.store.expansions,
        label: "확장",
      });
    }
    const visitorsEl = $("store-visitors");
    if (visitorsEl) visitorsEl.textContent = `👣 시간당 방문객 약 ${formatNumber(visitorsPerHour())}명`;

    const wrap = $("fixture-list");
    wrap.innerHTML = "";
    D.fixtures.forEach((f) => {
      const level = state.fixtures[f.id];
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${f.emoji}</div>
        <div class="item-info">
          <div class="item-title">${f.name} <span class="lvl-chip">Lv.${level}</span></div>
          <div class="item-desc">${f.desc}</div>
        </div>
        <button class="btn btn-buy"></button>`;
      const btn = card.querySelector("button");
      setBuyButton(btn, { base: f.baseCost, growth: f.costGrowth, owned: level, label: level === 0 ? "설치" : "강화" });
      btn.addEventListener("click", () => upgradeFixture(f.id));
      wrap.appendChild(card);
    });
  }

  function renderTablesTab() {
    const capacity = tableCapacity();
    $("table-count").textContent = state.tables;
    $("table-capacity").textContent = capacity;
    $("table-per-income").textContent = `${formatRate(perTableIncome())}BB`;
    $("table-level-chip").textContent = `Lv.${state.tableLevel}`;

    const buyBtn = $("buy-table-btn");
    if (state.tables >= capacity) {
      buyBtn.innerHTML = `구매<small>매장 확장 필요</small>`;
      buyBtn.disabled = true;
    } else {
      setBuyButton(buyBtn, {
        base: D.table.baseCost,
        growth: D.table.costGrowth,
        owned: state.tables - 1,
        cap: capacity - state.tables,
        label: "구매",
      });
    }
    setBuyButton($("upgrade-table-btn"), {
      base: D.tableUpgrade.baseCost,
      growth: D.tableUpgrade.costGrowth,
      owned: state.tableLevel,
      label: "강화",
    });
  }

  function renderStaffTab() {
    const wrap = $("staff-list");
    wrap.innerHTML = "";
    D.staff.forEach((s) => {
      const owned = state.staff[s.id];
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${s.emoji}</div>
        <div class="item-info">
          <div class="item-title">${s.name} <span class="lvl-chip">${owned}명</span></div>
          <div class="item-desc">${s.desc}</div>
        </div>
        <button class="btn btn-buy"></button>`;
      const btn = card.querySelector("button");
      setBuyButton(btn, { base: s.baseCost, growth: s.costGrowth, owned, label: "고용" });
      btn.addEventListener("click", () => hireStaff(s.id));
      wrap.appendChild(card);
    });

    $("gacha-cost").textContent = formatNumber(D.gacha.costDiamonds);
    $("gacha-multi-cost").textContent = formatNumber(D.gacha.multiCost);
    $("gacha-pull-btn").disabled = state.diamonds < D.gacha.costDiamonds;
    $("gacha-multi-btn").disabled = state.diamonds < D.gacha.multiCost;
    $("gacha-level-chip").textContent = `Lv.${state.gachaLevel}`;
    $("gacha-ticket-count").textContent = `${state.gachaTickets || 0}장`;
    $("gacha-ticket-btn").disabled = (state.gachaTickets || 0) <= 0;
    $("dealer-count").textContent = ownedDealerIds().length;
    $("dealer-bonus-total").textContent = `+${Math.round(deploymentBonusTotal() * 100)}%`;
    const shownRarities = mythicUnlocked() ? [...D.gacha.rarities, D.gacha.mythicRarity] : D.gacha.rarities;
    $("dealer-breakdown").innerHTML = shownRarities
      .map((r) => {
        const total = D.dealerRoster.filter((d) => d.rarity === r.id).length;
        const have = D.dealerRoster.filter((d) => d.rarity === r.id && state.dealers[d.id]).length;
        return `<span class="rarity-chip" style="--rc:${r.color}">${r.short} ${have}/${total}</span>`;
      })
      .join("");
    const deployEl = $("deploy-summary");
    if (deployEl) {
      const n = deployedIds().length;
      const synergyPct = Math.round((deploymentSynergyMultiplier() - 1) * 100);
      deployEl.textContent = `🧑‍💼 배치 ${n}/${D.deployment.maxDeployed}명 · 시너지 +${synergyPct}% (도감 탭에서 배치 변경)`;
    }
    renderAdButtons();
  }

  function renderCodexTab() {
    const owned = ownedDealerIds().length;
    // 상점 전용(신화)은 구매 전까지 도감 수집 모수에서 제외 — 안 그러면 "0/11"처럼 영원히 못 채울 것처럼 보임
    const total = D.dealerRoster.filter((d) => !d.shopOnly || state.dealers[d.id]).length;
    $("codex-owned").textContent = owned;
    $("codex-total").textContent = total;
    $("codex-fill").style.width = `${((owned / total) * 100).toFixed(1)}%`;

    const filters = [{ id: "all", name: "전체" }, ...D.gacha.rarities.map((r) => ({ id: r.id, name: r.short }))];
    $("codex-filter").innerHTML = filters
      .map((f) => `<button class="filter-chip ${state.ui.codexFilter === f.id ? "active" : ""}" data-filter="${f.id}">${f.name}</button>`)
      .join("");
    $("codex-filter")
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          state.ui.codexFilter = b.dataset.filter;
          renderCodexTab();
        })
      );

    const list = D.dealerRoster
      .filter((d) => !d.shopOnly || state.dealers[d.id])
      .filter((d) => state.ui.codexFilter === "all" || d.rarity === state.ui.codexFilter);
    const grid = $("codex-grid");
    grid.innerHTML = list
      .map((d) => {
        const own = state.dealers[d.id];
        const r = rarityDef(d.rarity) || D.gacha.mythicRarity;
        const isNew = codexNewSnapshot.includes(d.id);
        const stars = own ? "★".repeat(own.star) + "☆".repeat(D.dealerStar.maxStar - own.star) : "";
        const need = own ? starUpCost(d.id) : null;
        const shardPct = own && need ? Math.min(100, (own.shards / need) * 100) : own ? 100 : 0;
        const deployed = own && isDeployed(d.id);
        return `
          <div class="codex-card ${own ? "" : "locked"}" data-dealer="${d.id}" style="--rc:${r.color}">
            <span class="codex-rank">${r.short}</span>
            ${isNew ? '<span class="badge-new">NEW</span>' : ""}
            <img src="${DealerPortraits.url(d.id, d.rarity)}" alt="${d.name}" loading="lazy" />
            ${own ? "" : '<span class="codex-lock">🔒</span>'}
            <div class="codex-name">${own ? d.name : "???"}</div>
            <div class="codex-stars">${stars}</div>
            ${own ? `<div class="shard-bar"><i style="width:${shardPct}%"></i></div>` : ""}
            ${own ? `<button class="deploy-toggle ${deployed ? "on" : ""}" data-deploy="${d.id}">${deployed ? "배치중" : "배치"}</button>` : ""}
          </div>`;
      })
      .join("");
    grid.querySelectorAll("[data-dealer]").forEach((el) =>
      el.querySelector("img").addEventListener("click", () => openDealerModal(el.dataset.dealer))
    );
    grid.querySelectorAll("[data-deploy]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDeploy(btn.dataset.deploy);
        renderCodexTab();
      })
    );
  }

  function renderDecorTab() {
    const themeWrap = $("theme-list");
    themeWrap.innerHTML = "";
    D.themes.forEach((t) => {
      const owned = state.ownedThemes.includes(t.id);
      const equipped = state.theme === t.id;
      const lv = themeLevel(t.id);
      const card = document.createElement("div");
      card.className = "theme-card" + (equipped ? " equipped" : "");
      card.innerHTML = `
        <div class="theme-swatch" style="background:${THEME_SWATCH_COLORS[t.id] || "#ccc"}"></div>
        <div class="theme-name">${t.emoji} ${t.name} ${owned ? `<span class="lvl-chip">Lv.${lv}</span>` : ""}</div>
        <div class="theme-cost">${owned ? (equipped ? `적용중 · +${Math.round(lv * D.themeUpgrade.bonusPerLevel * 100)}% 수익` : "보유중") : `💰${formatChips(t.cost)}`}</div>
        <button class="btn ${equipped ? "btn-buy" : "btn-buy"}" data-act="${equipped ? "up" : owned ? "equip" : "buy"}"></button>`;
      const btn = card.querySelector("button");
      const act = btn.dataset.act;
      if (act === "up") {
        setBuyButton(btn, { base: D.themeUpgrade.baseCost, growth: D.themeUpgrade.costGrowth, owned: lv, label: "등급↑" });
        btn.addEventListener("click", () => upgradeTheme(t.id));
      } else if (act === "equip") {
        btn.innerHTML = "적용하기";
        btn.addEventListener("click", () => equipTheme(t.id));
      } else {
        btn.innerHTML = `구매<small>${formatChips(t.cost)}</small>`;
        btn.disabled = state.chips < t.cost;
        btn.addEventListener("click", () => buyTheme(t.id));
      }
      themeWrap.appendChild(card);
    });

    const wrap = $("decor-list");
    wrap.innerHTML = "";
    D.decor.forEach((d) => {
      const lv = state.decor[d.id] || 0;
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${d.emoji}</div>
        <div class="item-info">
          <div class="item-title">${d.name} <span class="lvl-chip">Lv.${lv}</span></div>
          <div class="item-desc">현재 +${(lv * d.bonusPerLevel * 100).toFixed(0)}% · 레벨당 +${(d.bonusPerLevel * 100).toFixed(0)}% 수익</div>
        </div>
        <button class="btn btn-buy"></button>`;
      const btn = card.querySelector("button");
      setBuyButton(btn, { base: d.baseCost, growth: d.costGrowth, owned: lv, label: lv === 0 ? "설치" : "강화" });
      btn.addEventListener("click", () => upgradeDecor(d.id));
      wrap.appendChild(card);
    });
  }

  function renderPrestigeTab() {
    $("prestige-total-earned").textContent = formatNumber(state.totalEarned);
    $("prestige-requirement").textContent = formatNumber(prestigeRequirement());
    const gain = potentialPrestigePoints();
    $("prestige-gain").textContent = gain;
    $("prestige-current-mult").textContent = `x${prestigeMultiplier().toFixed(2)}`;
    $("prestige-next-mult").textContent = `x${prestigeMultiplier(Math.max(gain, state.prestige.points)).toFixed(2)}`;
    $("prestige-diamond-reward").textContent = D.diamond.prestigeReward * gain;
    $("prestige-btn").disabled = gain <= state.prestige.points;
  }

  function renderSettingsTab() {
    $("show-table-income-toggle").checked = state.settings.showTableIncome;
    $("auto-assign-toggle").checked = state.settings.autoAssign;
    renderAccountInfo();
  }

  // ============================================================
  // 프로필 (닉네임 + 매장 현황 요약)
  // ============================================================
  function renderProfileModal() {
    const li = levelInfo();
    const box = $("profile-detail");
    box.innerHTML = `
      <div class="profile-nickname-row">
        <b id="profile-nickname-text">${displayName()}</b>
        <button class="btn" id="profile-nickname-edit">닉네임 변경</button>
      </div>
      <h3>Lv.${li.level} ${li.title}</h3>
      <div class="xp-bar" style="margin:0 4px 10px"><i style="width:${(li.progress * 100).toFixed(1)}%"></i></div>
      <p class="muted" style="margin-top:-6px">다음 레벨까지 💰${formatChips(li.toNext)}</p>
      <div class="dealer-stat-row">
        <div class="dealer-stat">초당 수익<b>${formatRate(incomePerSecond())}BB</b></div>
        <div class="dealer-stat">보유 BB<b>${formatNumber(state.chips)}</b></div>
        <div class="dealer-stat">다이아<b>💎${formatNumber(state.diamonds)}</b></div>
        <div class="dealer-stat">누적 수익<b>${formatNumber(state.lifetimeEarned)}</b></div>
        <div class="dealer-stat">테이블<b>${state.tables}/${tableCapacity()}</b></div>
        <div class="dealer-stat">방문객<b>👣${formatNumber(visitorsPerHour())}/h</b></div>
        <div class="dealer-stat">운영진<b>${ownedDealerIds().length}명 보유</b></div>
        <div class="dealer-stat">배치<b>${deployedIds().length}/${D.deployment.maxDeployed}명</b></div>
        <div class="dealer-stat">가챠 레벨<b>Lv.${state.gachaLevel}</b></div>
        <div class="dealer-stat">프레스티지<b>x${prestigeMultiplier().toFixed(2)}</b></div>
      </div>
    `;
    $("profile-nickname-edit").addEventListener("click", () => {
      const next = window.prompt("새 닉네임을 입력해주세요 (2~12자)", state.nickname || displayName());
      if (!next) return;
      const trimmed = next.trim();
      if (trimmed.length < 2 || trimmed.length > 12) {
        toast("닉네임은 2~12자로 입력해주세요");
        return;
      }
      state.nickname = trimmed;
      toast(`닉네임을 "${trimmed}"(으)로 변경했어요`);
      renderProfileModal();
      saveGame();
    });
  }

  function renderAccountInfo() {
    const box = $("account-info");
    if (!box) return;
    const username = window.Account ? window.Account.getCurrentUsername() : null;
    box.innerHTML = `
      <p class="muted">아이디 <b>${username ?? "-"}</b> · 진행 상황은 이 계정에 자동으로 클라우드 저장돼요.</p>
      <div class="settings-row">
        <button class="btn" id="change-password-btn">비밀번호 변경</button>
        <button class="btn" id="logout-btn">로그아웃</button>
        <button class="btn btn-danger" id="delete-account-btn">계정 삭제</button>
      </div>
    `;
    $("logout-btn").addEventListener("click", async () => {
      if (!window.confirm("로그아웃할까요?")) return;
      await saveGame();
      await window.Account.logout();
      window.location.reload();
    });
    $("change-password-btn").addEventListener("click", async () => {
      const next = window.prompt("새 비밀번호를 입력해주세요 (6자 이상)");
      if (!next) return;
      const res = await window.Account.changePassword(next);
      toast(res.ok ? "비밀번호를 변경했어요" : res.error);
    });
    $("delete-account-btn").addEventListener("click", async () => {
      if (!window.confirm("정말 계정을 삭제할까요? 클라우드에 저장된 진행 상황도 함께 사라지고 되돌릴 수 없어요.")) return;
      const res = await window.Account.deleteAccount();
      if (res.ok) window.location.reload();
      else toast(res.error);
    });
  }

  // ============================================================
  // 상점 (다이아 결제)
  // ============================================================
  function shopItemCard({ id, emoji, name, desc, priceLabel, tag, owned, action }) {
    return `
      <div class="item-card shop-card ${owned ? "shop-card-owned" : ""}">
        <div class="item-icon">${emoji}</div>
        <div class="item-info">
          <div class="item-title">${name}${tag ? `<span class="shop-tag">${tag}</span>` : ""}</div>
          <div class="item-desc">${desc}</div>
        </div>
        ${owned ? '<button class="btn btn-owned" disabled>보유중</button>' : `<button class="btn btn-buy" data-shop="${id}">${action ?? "구매"}<small>${priceLabel}</small></button>`}
      </div>`;
  }

  function renderShopTab() {
    const list = $("shop-list");
    if (!list) return;
    const parts = [];

    if (vipActive()) {
      const daysLeft = Math.ceil((state.purchases.vipUntil - Date.now()) / (24 * 60 * 60 * 1000));
      parts.push(shopItemCard({
        id: "vip_monthly",
        emoji: D.shop.vip.emoji,
        name: D.shop.vip.name,
        desc: `이용중 · ${daysLeft}일 남음 · 매일 💎${D.shop.vip.dailyDiamonds} + 수익 +${D.shop.vip.incomeBonusPct}%`,
        owned: true,
      }));
    } else {
      parts.push(shopItemCard({
        id: D.shop.vip.id,
        emoji: D.shop.vip.emoji,
        name: D.shop.vip.name,
        desc: D.shop.vip.desc,
        priceLabel: D.shop.vip.priceLabel,
      }));
    }

    if (!state.purchases.starterBought) {
      const s = D.shop.starter;
      parts.push(shopItemCard({ id: s.id, emoji: s.emoji, name: s.name, desc: s.desc, priceLabel: s.priceLabel, tag: s.tag }));
    }

    D.shop.diamondPacks.forEach((pack) => {
      const bonus = pack.bonusPct ? ` (+${pack.bonusPct}% 보너스)` : "";
      parts.push(shopItemCard({
        id: pack.id,
        emoji: pack.emoji,
        name: pack.name,
        desc: `💎${pack.diamonds}${bonus}`,
        priceLabel: pack.priceLabel,
        tag: pack.tag,
      }));
    });

    // 상점 전용 신화 운영진
    D.shop.operators.forEach((op) => {
      const owned = Boolean(state.dealers[op.rosterId]);
      parts.push(shopItemCard({ id: op.id, emoji: op.emoji, name: op.name, desc: op.desc, priceLabel: op.priceLabel, owned }));
    });

    // 광고 제거
    const ra = D.shop.removeAds;
    parts.push(shopItemCard({ id: ra.id, emoji: ra.emoji, name: ra.name, desc: ra.desc, priceLabel: ra.priceLabel, owned: state.purchases.adsRemoved }));

    parts.push('<h4 class="sheet-sub">영구 업그레이드 <span class="muted">· 리뉴얼해도 유지</span></h4>');
    D.permanentUpgrades.forEach((p) => {
      const lv = permanentLevel(p.id);
      parts.push(`
        <div class="item-card">
          <div class="item-icon">${p.emoji}</div>
          <div class="item-info">
            <div class="item-title">${p.name} <span class="lvl-chip">Lv.${lv}</span></div>
            <div class="item-desc">${p.desc}</div>
          </div>
          <button class="btn btn-buy" data-permanent="${p.id}">강화<small>💎${permanentCost(p.id)}</small></button>
        </div>`);
    });

    list.innerHTML = parts.join("");
    list.querySelectorAll("[data-shop]").forEach((btn) => btn.addEventListener("click", () => buyShopItem(btn.dataset.shop, btn)));
    list.querySelectorAll("[data-permanent]").forEach((btn) => btn.addEventListener("click", () => buyPermanent(btn.dataset.permanent)));
  }

  function findShopItem(id) {
    if (id === D.shop.starter.id) return { ...D.shop.starter, kind: "starter" };
    if (id === D.shop.vip.id) return { ...D.shop.vip, kind: "vip" };
    if (id === D.shop.removeAds.id) return { ...D.shop.removeAds, kind: "removeAds" };
    const pack = D.shop.diamondPacks.find((p) => p.id === id);
    if (pack) return { ...pack, kind: "diamond" };
    const op = D.shop.operators.find((o) => o.id === id);
    return op ? { ...op, kind: "operator" } : null;
  }

  async function buyShopItem(id, btn) {
    const item = findShopItem(id);
    if (!item || !window.Shop) return;
    if (btn) btn.disabled = true;
    const result = await window.Shop.checkout(item);
    if (btn) btn.disabled = false;
    if (!result.ok) {
      toast(result.notReady ? "🛠 " + result.error : "❌ " + result.error);
      return;
    }

    const firstPurchase = !state.purchases.firstPurchaseDone;
    const bonusMult = firstPurchase ? D.shop.firstPurchaseBonusMult : 1;
    state.purchases.firstPurchaseDone = true;
    state.purchases.totalSpentKRW += item.amountKRW;
    // 결제 미연동 상태라 테스트로 무료 지급된 경우, 나중에 헷갈리지 않도록 토스트에 표시해준다
    const testPrefix = result.test ? "🧪(테스트 지급) " : "";

    if (item.kind === "starter") {
      state.purchases.starterBought = true;
      addDiamonds(item.diamonds * bonusMult);
      addChips(chipSecondsToChips(item.chipSeconds));
      toast(`${testPrefix}🎉 창업 지원팩! 💎${item.diamonds * bonusMult} 지급${firstPurchase ? " (첫 구매 2배!)" : ""}`);
    } else if (item.kind === "vip") {
      const now = Date.now();
      const base = Math.max(now, state.purchases.vipUntil);
      state.purchases.vipUntil = base + item.durationDays * 24 * 60 * 60 * 1000;
      addDiamonds(item.instantDiamonds * bonusMult);
      toast(`${testPrefix}👑 월 정기권 시작! 💎${item.instantDiamonds * bonusMult} 지급`);
    } else if (item.kind === "removeAds") {
      state.purchases.adsRemoved = true;
      toast(`${testPrefix}🚫 광고 제거 완료! 이제 무료 보상은 광고 없이 바로 받아요`);
    } else if (item.kind === "operator") {
      const unlocked = state.purchases.unlockedMythic || (state.purchases.unlockedMythic = []);
      if (!unlocked.includes(item.rosterId)) unlocked.push(item.rosterId);
      if (!state.dealers[item.rosterId]) {
        state.dealers[item.rosterId] = { star: 1, shards: 0 };
        autoDeployIfRoom(item.rosterId);
      }
      sceneDirty = true;
      toast(`${testPrefix}👑 ${item.name.replace(" 영입", "")} 영입 완료! 이제 가챠에도 등장해요`);
    } else {
      addDiamonds(item.diamonds * bonusMult);
      toast(`${testPrefix}💎 다이아 +${item.diamonds * bonusMult} 충전 완료${firstPurchase ? " (첫 구매 2배!)" : ""}`);
    }

    burst(0x7fd4ff);
    sceneDirty = true;
    renderShopTab();
    await saveGame();
    refresh();
  }

  // ============================================================
  // 광고(리워드)
  // ============================================================
  function renderAdButtons() {
    const freeBtn = $("ad-free-pull-btn");
    const boostBtn = $("ad-upgrade-boost-btn");
    if (!freeBtn || !boostBtn) return;
    const removed = state.purchases.adsRemoved;
    const now = Date.now();
    const freeUsedToday = state.ads.lastFreePullDate === todayKey();
    freeBtn.disabled = freeUsedToday;
    freeBtn.textContent = freeUsedToday ? "오늘 이미 받음" : removed ? "🎁 무료 뽑기 (광고 없이)" : "🎬 광고보고 무료뽑기";

    const boostActive = state.ads.boostUntil > now;
    const boostCooling = state.ads.boostCooldownUntil > now;
    boostBtn.disabled = boostActive || boostCooling;
    boostBtn.textContent = boostActive
      ? `⚡ 가속 중 (${formatDuration(state.ads.boostUntil - now)})`
      : boostCooling
      ? `대기 ${formatDuration(state.ads.boostCooldownUntil - now)}`
      : removed
      ? "⚡ 업그레이드 가속 (광고 없이)"
      : "🎬 광고보고 가속";
  }

  async function watchAdFor(kind) {
    let testGrant = false;
    if (!state.purchases.adsRemoved) {
      const res = await window.Ads.requestRewardedAd();
      if (!res.ok) {
        toast(res.notReady ? "🛠 " + res.error : "❌ " + res.error);
        return;
      }
      testGrant = Boolean(res.test);
    }
    // 광고 SDK 미연동 상태라 테스트로 바로 지급된 경우, 나중에 헷갈리지 않도록 토스트에 표시해준다
    const testPrefix = testGrant ? "🧪(테스트 지급) " : "";
    if (kind === "dailyFreePull") {
      state.ads.lastFreePullDate = todayKey();
      const results = [pullOne(null)];
      trackMission("gacha", 1);
      sceneDirty = true;
      showGachaResults(results);
      burst(results[0].rarity.color);
    } else if (kind === "upgradeBoost") {
      const d = D.ads.upgradeBoost;
      state.ads.boostUntil = Date.now() + d.durationMs;
      state.ads.boostCooldownUntil = Date.now() + d.cooldownMs;
      toast(`${testPrefix}⚡ ${Math.round(d.durationMs / 60000)}분간 자동 업그레이드 ${d.mult}배 가속!`);
    }
    renderAdButtons();
    refresh();
  }

  const TAB_RENDERERS = {
    store: renderStoreTab,
    tables: renderTablesTab,
    staff: renderStaffTab,
    codex: renderCodexTab,
    decor: renderDecorTab,
    prestige: renderPrestigeTab,
    shop: renderShopTab,
    settings: renderSettingsTab,
  };

  function renderScene() {
    if (!window.PubScene3D) return;
    window.PubScene3D.update({
      tables: state.tables,
      capacity: tableCapacity(),
      maxShown: D.store.maxShownSlots,
      fixtures: state.fixtures,
      staff: state.staff,
      decor: state.decor,
      assignedDealers: assignedDealers(),
      perTableIncome: perTableIncome(),
      showTableIncome: state.settings.showTableIncome,
      seatsMin: D.table.seatsMin,
      seatsMax: D.table.seatsMax,
      theme: state.theme,
    });
  }

  // 상태가 바뀐 직후 호출 — 열려 있는 탭만 다시 그린다 (전체 재렌더는 비싸다)
  function refresh() {
    renderHUD();
    refreshDots();
    if (sheetOpen && TAB_RENDERERS[activeTab]) TAB_RENDERERS[activeTab]();
    if (sceneDirty) {
      renderScene();
      sceneDirty = false;
    }
  }

  // ============================================================
  // 모달 렌더
  // ============================================================
  function renderAttendanceModal() {
    const grid = $("attendance-grid");
    const claimedDays = state.attendance.cycleDay;
    const todayIdx = claimedDays % D.attendance.cycleLength;
    grid.innerHTML = D.attendance.rewards
      .map((r, i) => {
        const claimed = i < claimedDays;
        const isToday = i === todayIdx && attendanceReady();
        const cls = ["attend-cell", claimed ? "claimed" : "", isToday ? "today" : "", i === 6 ? "big" : ""]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}">
          <div class="ad-day">${r.day}일차</div>
          <span class="ad-emoji">${claimed ? "✅" : r.diamonds ? "💎" : "💰"}</span>
          <div>${r.label}</div>
        </div>`;
      })
      .join("");
    const btn = $("attendance-claim");
    btn.disabled = !attendanceReady();
    btn.textContent = attendanceReady() ? "오늘의 보상 받기" : "내일 다시 오세요!";
    $("attendance-sub").textContent = `연속 ${claimedDays}일차 진행 중`;
  }

  function renderMissionModal() {
    ensureDailyState();
    const list = $("mission-list");
    list.innerHTML = state.missions.list
      .map((m, i) => {
        const def = D.missions.pool.find((p) => p.id === m.id);
        const done = m.progress >= m.target;
        const pct = Math.min(100, (m.progress / m.target) * 100);
        return `
          <div class="mission-item ${m.claimed ? "done" : ""}">
            <div class="mission-body">
              <div class="mission-name">${def.desc.replace("{n}", m.target)}</div>
              <div class="mission-reward">${rewardLabel(def.reward)} · ${m.progress}/${m.target}</div>
              <div class="mission-prog"><i style="width:${pct}%"></i></div>
            </div>
            ${
              m.claimed
                ? '<button class="btn btn-owned" disabled>완료 ✅</button>'
                : `<button class="btn ${done ? "btn-primary" : "btn-buy"}" data-mission="${i}" ${done ? "" : "disabled"}>${done ? "받기" : "진행중"}</button>`
            }
          </div>`;
      })
      .join("");
    list.querySelectorAll("[data-mission]").forEach((b) =>
      b.addEventListener("click", () => claimMission(Number(b.dataset.mission)))
    );
    const all = state.missions.list.every((m) => m.claimed);
    $("mission-allclear").innerHTML = all
      ? `🏆 오늘의 미션을 모두 완료했어요! (보너스 ${rewardLabel(D.missions.allClearReward)} 지급됨)`
      : `🏆 전부 완료하면 보너스 ${rewardLabel(D.missions.allClearReward)}`;
  }

  function renderBoostModal() {
    const now = Date.now();
    const items = [
      {
        def: D.boosts.free,
        state: boostIsActive("free")
          ? `발동 중 · ${formatDuration(boostActiveUntil("free") - now)}`
          : freeBoostReady()
          ? "지금 사용 가능!"
          : `쿨타임 ${formatDuration(state.boosts.freeReadyAt - now)}`,
        can: freeBoostReady(),
        label: "무료 사용",
      },
      {
        def: D.boosts.rush,
        state: boostIsActive("rush") ? `적용중 · ${formatDuration(boostActiveUntil("rush") - now)} 남음` : `💎${D.boosts.rush.costDiamonds}`,
        can: !boostIsActive("rush") && state.diamonds >= D.boosts.rush.costDiamonds,
        label: boostIsActive("rush") ? "적용중" : `💎${D.boosts.rush.costDiamonds}`,
      },
      {
        def: D.boosts.golden,
        state: boostIsActive("golden")
          ? `적용중 · ${formatDuration(boostActiveUntil("golden") - now)} 남음`
          : `다음 황금시간까지 ${formatDuration((state.boosts.goldenNextAt || now) - now)}`,
        can: false,
        label: boostIsActive("golden") ? "적용중" : "자동 발동",
      },
    ];
    $("boost-list").innerHTML = items
      .map((it) => {
        const active = boostIsActive(it.def.id);
        return `
        <div class="boost-item ${active ? "active" : ""}">
          <div class="item-icon">${it.def.emoji}</div>
          <div class="item-info">
            <div class="item-title">${it.def.name} <span class="lvl-chip">x${it.def.mult}</span>${active ? '<span class="shop-tag">적용중</span>' : ""}</div>
            <div class="item-desc">${it.def.desc}<br/><b>${it.state}</b></div>
          </div>
          <button class="btn ${active ? "btn-owned" : "btn-buy"}" data-boost="${it.def.id}" ${it.can ? "" : "disabled"}>${it.label}</button>
        </div>`;
      })
      .join("");
    $("boost-list")
      .querySelectorAll("[data-boost]")
      .forEach((b) => b.addEventListener("click", () => activateBoost(b.dataset.boost)));
  }

  function openDealerModal(dealerId) {
    renderDealerModal(dealerId);
    $("dealer-modal").classList.remove("hidden");
  }
  function renderDealerModal(dealerId) {
    const def = rosterDef(dealerId);
    const r = rarityDef(def.rarity);
    const own = state.dealers[dealerId];
    const box = $("dealer-detail");
    if (!own) {
      box.innerHTML = `
        <img src="${DealerPortraits.url(def.id, def.rarity)}" alt="" style="filter:brightness(.35) grayscale(1)" />
        <h3>??? <span style="color:${r.color}">${r.short}</span></h3>
        <p class="dealer-quote">아직 만나지 못한 운영진이에요.<br/>가챠로 영입해보세요!</p>`;
      return;
    }
    const need = starUpCost(dealerId);
    const canUp = need !== null && own.shards >= need;
    box.innerHTML = `
      <img src="${DealerPortraits.url(def.id, def.rarity)}" alt="${def.name}" style="box-shadow:0 6px 20px ${r.color}66" />
      <h3>${def.name} <span style="color:${r.color}">${r.short}</span></h3>
      <p class="dealer-quote">"${def.desc}"</p>
      <div class="dealer-stat-row">
        <div class="dealer-stat">등급<b style="color:${r.color}">${r.name}</b></div>
        <div class="dealer-stat">승급<b>${"★".repeat(own.star)}${"☆".repeat(D.dealerStar.maxStar - own.star)}</b></div>
        <div class="dealer-stat">수익 보너스<b>+${(dealerBonus(dealerId) * 100).toFixed(1)}%</b></div>
      </div>
      <p class="muted" style="margin:-4px 0 8px">💡 이 보너스는 "배치"돼 있을 때만 실제로 적용돼요(동시 배치 최대 ${D.deployment.maxDeployed}명).</p>
      <button class="deploy-toggle ${isDeployed(dealerId) ? "on" : ""}" id="dealer-modal-deploy-btn" style="width:100%;margin-bottom:8px;padding:8px 0;font-size:12px">${isDeployed(dealerId) ? "✅ 배치 중 (탭하면 해제)" : "🧑‍💼 배치하기"}</button>
      ${
        need === null
          ? '<div class="mission-allclear">⭐ 최고 등급까지 승급했어요!</div>'
          : `<div class="mission-allclear">조각 ${own.shards} / ${need}<div class="shard-bar" style="margin-top:6px"><i style="width:${Math.min(100, (own.shards / need) * 100)}%"></i></div></div>
             <button class="btn btn-primary btn-wide" id="star-up-btn" ${canUp ? "" : "disabled"} style="margin-top:10px">★${own.star + 1} 승급하기</button>`
      }`;
    const upBtn = $("star-up-btn");
    if (upBtn) upBtn.addEventListener("click", () => starUp(dealerId));
    $("dealer-modal-deploy-btn").addEventListener("click", () => {
      toggleDeploy(dealerId);
      renderDealerModal(dealerId);
    });
  }

  // 3D 씬에서 테이블/시설을 탭했을 때 뜨는 업그레이드 팝업
  let popupAction = null;
  function openContextPopup({ title, bodyHtml, actionLabel, actionDisabled, onAction }) {
    $("context-popup-title").textContent = title;
    $("context-popup-desc").innerHTML = bodyHtml;
    const btn = $("context-popup-action");
    btn.textContent = actionLabel;
    btn.disabled = !!actionDisabled;
    popupAction = onAction;
    $("context-popup").classList.remove("hidden");
  }
  function closeContextPopup() {
    $("context-popup").classList.add("hidden");
    popupAction = null;
  }
  function handleSceneTap(info) {
    if (info.type === "buyTable") {
      const cap = tableCapacity() - state.tables;
      if (cap <= 0) {
        toast("🏗 매장이 가득 찼어요! 매장 탭에서 확장해보세요");
        return;
      }
      const n = Math.max(1, plannedQty(D.table.baseCost, D.table.costGrowth, state.tables - 1, cap));
      const cost = bulkCost(D.table.baseCost, D.table.costGrowth, state.tables - 1, n);
      openContextPopup({
        title: "🃏 새 테이블 추가",
        bodyHtml: `빈 자리에 새 홀덤 테이블을 놓을까요?<br/>테이블당 수익 <b>${formatRate(perTableIncome())}BB/초</b>`,
        actionLabel: `테이블 x${n} 추가 (💰${formatChips(cost)})`,
        actionDisabled: state.chips < cost,
        onAction: () => buyTable(),
      });
    } else if (info.type === "table") {
      const n = Math.max(1, plannedQty(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel));
      const cost = bulkCost(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel, n);
      openContextPopup({
        title: "🃏 테이블 강화",
        bodyHtml: `이 테이블은 <b>${formatRate(perTableIncome())}BB/초</b>를 벌고 있어요.<br/>리모델링 레벨 <b>Lv.${state.tableLevel}</b> (상한 없음)`,
        actionLabel: `전체 강화 x${n} (💰${formatChips(cost)})`,
        actionDisabled: state.chips < cost,
        onAction: () => upgradeTable(),
      });
    } else if (info.type === "fixture") {
      const f = fixtureDef(info.id);
      if (!f) return;
      const level = state.fixtures[info.id];
      const n = Math.max(1, plannedQty(f.baseCost, f.costGrowth, level));
      const cost = bulkCost(f.baseCost, f.costGrowth, level, n);
      openContextPopup({
        title: `${f.emoji} ${f.name}`,
        bodyHtml: `${f.desc}<br/>현재 레벨 <b>Lv.${level}</b> (상한 없음)`,
        actionLabel: `${level === 0 ? "설치" : "강화"} x${n} (💰${formatChips(cost)})`,
        actionDisabled: state.chips < cost,
        onAction: () => upgradeFixture(info.id),
      });
    }
  }

  // ============================================================
  // 시트 / 탭 / 컨트롤 바
  // ============================================================
  function openSheet(tabName, titleText) {
    activeTab = tabName;
    sheetOpen = true;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
    $("sheet-title").textContent = titleText;
    $("sheet-panel").classList.add("open");
    $("sheet-panel").setAttribute("aria-hidden", "false");
    $("sheet-backdrop").classList.add("open");
    document.body.classList.add("sheet-open");
    $("sheet-body").scrollTop = 0;
    // 도감을 열면 알림 점은 바로 끄되, NEW 배지는 보는 동안 남겨둔다.
    if (tabName === "codex") {
      codexNewSnapshot = [...state.codexNew];
      state.codexNew = [];
      refreshDots();
    } else {
      codexNewSnapshot = [];
    }
    if (TAB_RENDERERS[tabName]) TAB_RENDERERS[tabName]();
  }
  function closeSheet() {
    sheetOpen = false;
    $("sheet-panel").classList.remove("open");
    $("sheet-panel").setAttribute("aria-hidden", "true");
    $("sheet-backdrop").classList.remove("open");
    document.body.classList.remove("sheet-open");
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const isSame = sheetOpen && activeTab === btn.dataset.tab;
        if (isSame) closeSheet();
        else openSheet(btn.dataset.tab, btn.dataset.title || btn.dataset.tab);
      });
    });
    $("sheet-close-btn").addEventListener("click", closeSheet);
    $("sheet-backdrop").addEventListener("click", closeSheet);
  }

  function setupControlBar() {
    const group = $("qty-group");
    group.innerHTML = D.buyQuantities
      .map((q) => `<button class="qty-btn ${q === state.ui.buyQty ? "active" : ""}" data-qty="${q}">${q === "MAX" ? "MAX" : "x" + q}</button>`)
      .join("");
    group.querySelectorAll("[data-qty]").forEach((b) =>
      b.addEventListener("click", () => {
        const raw = b.dataset.qty;
        state.ui.buyQty = raw === "MAX" ? "MAX" : Number(raw);
        group.querySelectorAll(".qty-btn").forEach((x) => x.classList.toggle("active", x === b));
        refresh();
      })
    );

    const auto = $("auto-toggle");
    const syncAuto = () => {
      auto.classList.toggle("on", state.ui.autoUpgrade);
      auto.querySelector(".auto-text").innerHTML = `자동 <b>${state.ui.autoUpgrade ? "ON" : "OFF"}</b>`;
    };
    auto.addEventListener("click", () => {
      state.ui.autoUpgrade = !state.ui.autoUpgrade;
      syncAuto();
      if (state.ui.autoUpgrade) trackMission("autoUpgrade");
      toast(state.ui.autoUpgrade ? "🤖 자동 업그레이드 ON" : "🤖 자동 업그레이드 OFF");
      refresh();
    });
    syncAuto();
  }

  // ============================================================
  // 저장 / 오프라인
  // ============================================================
  const saveGame = () => GameBackend.saveState(state);

  async function loadGameAndComputeOffline() {
    const res = await GameBackend.loadState();
    if (!(res.ok && res.state)) return;
    const loaded = res.state;
    state = mergeWithDefaults(loaded);
    const savedAt = loaded.savedAt || Date.now();
    const elapsedSec = Math.max(0, Math.min((Date.now() - savedAt) / 1000, D.offline.maxSeconds));
    if (elapsedSec <= 20) return;
    // 오프라인 동안에는 부스트가 걸리지 않은 상태로 계산한다
    const savedActive = state.boosts.active;
    state.boosts.active = {};
    const gain = incomePerSecond() * elapsedSec * offlineEfficiency();
    const diaGain = diamondPerSecond() * elapsedSec * offlineEfficiency();
    state.boosts.active = savedActive;
    if (gain > 0) {
      addChips(gain);
      addDiamonds(diaGain);
      showOfflineModal(gain, diaGain, elapsedSec);
    }
  }

  function showOfflineModal(gain, diaGain, elapsedSec) {
    const mins = Math.round(elapsedSec / 60);
    const timeLabel = mins < 60 ? `${mins}분` : `${(mins / 60).toFixed(1)}시간`;
    $("offline-text").innerHTML =
      `${timeLabel} 동안<br/><b>💰 ${formatChips(gain)}</b>${diaGain >= 1 ? ` · <b>💎 ${Math.floor(diaGain)}</b>` : ""}<br/>` +
      `<span class="muted">오프라인 효율 ${Math.round(offlineEfficiency() * 100)}%</span>`;
    $("offline-modal").classList.remove("hidden");
  }

  // ============================================================
  // 메인 루프
  // ============================================================
  function tick() {
    const now = Date.now();
    const dt = (now - lastTickAt) / 1000;
    lastTickAt = now;

    addChips(incomePerSecond() * dt);
    addDiamonds(diamondPerSecond() * dt);

    // 만료된 부스트 정리
    let boostChanged = false;
    Object.entries(state.boosts.active).forEach(([id, until]) => {
      if (until <= now) {
        delete state.boosts.active[id];
        boostChanged = true;
      }
    });
    tickGoldenHour();
    tickCelebrity();
    checkProfileLevelReward();
    ensureDailyState();
    autoUpgradeTick();

    renderHUD();
    refreshDots();
    if (boostChanged) sceneDirty = true;
    // 시트는 매 틱이 아니라 0.5초마다 갱신 (버튼 눌림 연출이 끊기지 않게)
    if (sheetOpen && LIVE_TABS.has(activeTab) && now - lastLiveRenderAt >= LIVE_RENDER_MS) {
      lastLiveRenderAt = now;
      TAB_RENDERERS[activeTab]();
    }
    if (sceneDirty) {
      renderScene();
      sceneDirty = false;
    }
  }

  // ============================================================
  // 초기화
  // ============================================================
  async function init() {
    setupTabs();

    if (window.PubScene3D) {
      window.PubScene3D.init($("pub-3d-container"));
      window.PubScene3D.onTap = handleSceneTap;
    }

    await loadGameAndComputeOffline();
    ensureDailyState();
    setupControlBar();

    // 시트 내부 액션
    $("buy-table-btn").addEventListener("click", () => buyTable());
    $("upgrade-table-btn").addEventListener("click", () => upgradeTable());
    $("expand-store-btn").addEventListener("click", () => expandStore());
    $("prestige-btn").addEventListener("click", doPrestige);
    $("gacha-pull-btn").addEventListener("click", () => pullGacha(1));
    $("gacha-multi-btn").addEventListener("click", () => pullGacha(D.gacha.multiCount));
    $("gacha-ticket-btn").addEventListener("click", pullWithTicket);
    $("ad-free-pull-btn").addEventListener("click", () => watchAdFor("dailyFreePull"));
    $("ad-upgrade-boost-btn").addEventListener("click", () => watchAdFor("upgradeBoost"));

    // 사이드 레일
    $("gift-btn").addEventListener("click", openGift);
    $("attendance-btn").addEventListener("click", () => {
      renderAttendanceModal();
      $("attendance-modal").classList.remove("hidden");
    });
    $("mission-btn").addEventListener("click", () => {
      renderMissionModal();
      $("mission-modal").classList.remove("hidden");
    });
    $("boost-btn").addEventListener("click", () => {
      renderBoostModal();
      $("boost-modal").classList.remove("hidden");
    });
    $("profile-btn").addEventListener("click", () => {
      renderProfileModal();
      $("profile-modal").classList.remove("hidden");
    });
    $("prestige-badge").addEventListener("click", () => openSheet("prestige", "브랜드 리뉴얼"));
    $("quest-claim").addEventListener("click", (e) => {
      e.stopPropagation();
      claimQuest();
    });
    $("quest-banner").addEventListener("click", goToQuest);

    // 모달 닫기
    const closers = [
      ["offline-close", "offline-modal"],
      ["gacha-close", "gacha-modal"],
      ["event-claim-btn", "event-modal"],
      ["attendance-close", "attendance-modal"],
      ["mission-close", "mission-modal"],
      ["boost-close", "boost-modal"],
      ["dealer-close", "dealer-modal"],
      ["profile-close", "profile-modal"],
    ];
    closers.forEach(([btnId, modalId]) => $(btnId).addEventListener("click", () => $(modalId).classList.add("hidden")));
    document.querySelectorAll(".modal").forEach((m) =>
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.add("hidden");
      })
    );
    $("attendance-claim").addEventListener("click", claimAttendance);
    $("celebrity-claim").addEventListener("click", claimCelebrity);
    $("context-popup-close").addEventListener("click", closeContextPopup);
    $("context-popup-action").addEventListener("click", () => {
      if (popupAction) popupAction();
      closeContextPopup();
    });

    // 설정
    $("show-table-income-toggle").addEventListener("change", (e) => {
      state.settings.showTableIncome = e.target.checked;
      sceneDirty = true;
      refresh();
    });
    $("auto-assign-toggle").addEventListener("change", (e) => {
      state.settings.autoAssign = e.target.checked;
      sceneDirty = true;
      refresh();
    });
    $("export-btn").addEventListener("click", async () => {
      await saveGame();
      $("save-code").value = await GameBackend.exportState();
      toast("저장 코드를 생성했어요");
    });
    $("import-btn").addEventListener("click", async () => {
      const code = $("save-code").value;
      if (!code.trim()) return toast("가져올 코드를 붙여넣어 주세요");
      const res = await GameBackend.importState(code);
      if (res.ok) {
        state = mergeWithDefaults(res.state);
        ensureDailyState();
        sceneDirty = true;
        refresh();
        toast("가져오기 완료!");
      } else toast("코드를 확인해주세요");
    });
    $("reset-btn").addEventListener("click", resetGame);

    sceneDirty = true;
    refresh();

    lastTickAt = Date.now();
    setInterval(tick, D.tick.intervalMs);
    setInterval(saveGame, D.tick.autosaveMs);
    window.addEventListener("beforeunload", () => GameBackend.saveState(state));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveGame();
      else lastTickAt = Date.now();
    });
  }

  // 로그인 게이트(auth-gate.js)가 로그인 성공을 확인한 뒤에만 게임을 시작시킨다.
  window.HoldemGame = { start: init };
})();

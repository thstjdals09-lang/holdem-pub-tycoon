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

  const rarityDef = (id) => D.gacha.rarities.find((r) => r.id === id) || D.gacha.rarities[0];
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

    // 딜러 도감: { [dealerId]: { star, shards } } — 프레스티지에도 유지된다
    dealers: keep.dealers ?? {},
    codexNew: keep.codexNew ?? [],

    theme: keep.theme ?? "classic",
    ownedThemes: keep.ownedThemes ?? ["classic"],
    themeLevels: keep.themeLevels ?? {},

    giftReadyAt: keep.giftReadyAt ?? Date.now(),
    prestige: keep.prestige ?? { points: 0 },

    settings: { showTableIncome: true, autoAssign: true },
    ui: { buyQty: 1, autoUpgrade: false, codexFilter: "all" },

    attendance: keep.attendance ?? { lastDate: null, cycleDay: 0 },
    missions: { date: null, list: [], allClaimed: false },
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
    s.missions = { ...base.missions, ...saved.missions };
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
  const tableCapacity = () => D.store.baseCapacity + state.store.expansions * D.store.capacityPerExpansion;
  const expansionCost = () => costFor(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions);
  const staffDef = (id) => D.staff.find((s) => s.id === id);
  const fixtureDef = (id) => D.fixtures.find((f) => f.id === id);
  const decorDef = (id) => D.decor.find((d) => d.id === id);
  const themeDef = (id) => D.themes.find((t) => t.id === id);
  const themeLevel = (id = state.theme) => state.themeLevels[id] || 0;

  // 딜러 한 명의 실제 보너스 (등급 기본값 × ★ 보정)
  function dealerBonus(dealerId) {
    const owned = state.dealers[dealerId];
    if (!owned) return 0;
    const def = rosterDef(dealerId);
    if (!def) return 0;
    const base = rarityDef(def.rarity).bonus;
    return base * (1 + (owned.star - 1) * D.dealerStar.bonusPerStar);
  }
  const ownedDealerIds = () => Object.keys(state.dealers).filter((id) => rosterDef(id));
  const dealerBonusSum = () => ownedDealerIds().reduce((sum, id) => sum + dealerBonus(id), 0);

  // 수익 높은 순으로 테이블에 배치 (3D 씬 표시용)
  function assignedDealers() {
    const ids = ownedDealerIds();
    if (!state.settings.autoAssign) return ids.map((id) => ({ id, rarity: rosterDef(id).rarity }));
    return ids
      .map((id) => ({ id, rarity: rosterDef(id).rarity, bonus: dealerBonus(id) }))
      .sort((a, b) => b.bonus - a.bonus);
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
    mult += dealerBonusSum();
    D.decor.forEach((d) => {
      mult += d.bonusPerLevel * (state.decor[d.id] || 0);
    });
    mult += D.themeUpgrade.bonusPerLevel * themeLevel();
    mult *= prestigeMultiplier();
    mult *= boostMultiplier();
    return mult;
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
  const formatChips = (n) => `${formatNumber(n)}`;
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
    return { chips, dia };
  }
  const rewardLabel = (reward) => {
    const parts = [];
    if (reward.chipSeconds) parts.push(`💰${formatChips(chipSecondsToChips(reward.chipSeconds))}`);
    if (reward.diamonds) parts.push(`💎${reward.diamonds}`);
    return parts.join(" · ");
  };

  // ============================================================
  // 미션 추적
  // ============================================================
  function trackMission(actionId, amount = 1) {
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
  function weightedRandomRarity(minRarity) {
    let pool = D.gacha.rarities;
    if (minRarity) {
      const minIdx = D.gacha.rarities.findIndex((r) => r.id === minRarity);
      pool = D.gacha.rarities.slice(minIdx);
    }
    const total = pool.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of pool) {
      if (roll < r.weight) return r;
      roll -= r.weight;
    }
    return pool[pool.length - 1];
  }

  // 한 장 뽑기 → 새로 얻었으면 {isNew:true}, 중복이면 조각 +1
  function pullOne(minRarity) {
    const rarity = weightedRandomRarity(minRarity);
    const pool = D.dealerRoster.filter((d) => d.rarity === rarity.id);
    const def = pool[Math.floor(Math.random() * pool.length)];
    const owned = state.dealers[def.id];
    let isNew = false;
    if (!owned) {
      state.dealers[def.id] = { star: 1, shards: 0 };
      state.codexNew.push(def.id);
      isNew = true;
    } else {
      owned.shards += 1;
    }
    return { def, rarity, isNew };
  }

  function showGachaResults(results) {
    const box = $("gacha-results");
    $("gacha-head").textContent = results.length > 1 ? `딜러 ${results.length}명 영입!` : "딜러 영입!";
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
    const results = [];
    for (let i = 0; i < count; i++) {
      // 10연차는 마지막 한 장을 희귀 이상으로 확정
      const guarantee = multi && i === count - 1 && !results.some((r) => r.rarity.id !== "common");
      results.push(pullOne(guarantee ? D.gacha.multiGuarantee : null));
    }
    trackMission("gacha", count);
    sceneDirty = true;
    showGachaResults(results);
    const best = results.reduce((a, b) => (a.rarity.weight <= b.rarity.weight ? a : b));
    burst(best.rarity.color);
    refresh();
  }

  // ---------- 딜러 승급 ----------
  function starUpCost(dealerId) {
    const owned = state.dealers[dealerId];
    if (!owned || owned.star >= D.dealerStar.maxStar) return null;
    return D.dealerStar.shardsPerStar[owned.star - 1];
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
      theme: state.theme,
      ownedThemes: state.ownedThemes,
      themeLevels: state.themeLevels,
      giftReadyAt: state.giftReadyAt,
      attendance: state.attendance,
      boosts: state.boosts,
      lifetimeEarned: state.lifetimeEarned,
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

    for (let i = 0; i < D.autoUpgrade.maxPerTick; i++) {
      const options = [];
      if (state.tables < tableCapacity()) {
        options.push({ cost: costFor(D.table.baseCost, D.table.costGrowth, state.tables - 1), run: () => buyTable(1) });
      }
      options.push({
        cost: costFor(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel),
        run: () => upgradeTable(1),
      });
      options.push({
        cost: costFor(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions),
        run: () => expandStore(1),
      });
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
    $("chips-value").textContent = formatNumber(state.chips);
    $("income-value").textContent = `${formatRate(incomePerSecond())}/초`;
    $("diamonds-value").textContent = formatNumber(state.diamonds);
    $("diamond-rate").textContent = `${(diamondPerSecond() * 60).toFixed(1)}/분`;
    $("prestige-mult").textContent = `x${prestigeMultiplier().toFixed(2)}`;

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
    setBuyButton($("expand-store-btn"), {
      base: D.store.expansionBaseCost,
      growth: D.store.expansionCostGrowth,
      owned: state.store.expansions,
      label: "확장",
    });

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
    $("table-per-income").textContent = formatRate(perTableIncome());
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
    $("dealer-count").textContent = ownedDealerIds().length;
    $("dealer-bonus-total").textContent = `+${Math.round(dealerBonusSum() * 100)}%`;
    $("dealer-breakdown").innerHTML = D.gacha.rarities
      .map((r) => {
        const total = D.dealerRoster.filter((d) => d.rarity === r.id).length;
        const have = D.dealerRoster.filter((d) => d.rarity === r.id && state.dealers[d.id]).length;
        return `<span class="rarity-chip" style="--rc:${r.color}">${r.short} ${have}/${total}</span>`;
      })
      .join("");
  }

  function renderCodexTab() {
    const owned = ownedDealerIds().length;
    const total = D.dealerRoster.length;
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

    const list = D.dealerRoster.filter((d) => state.ui.codexFilter === "all" || d.rarity === state.ui.codexFilter);
    const grid = $("codex-grid");
    grid.innerHTML = list
      .map((d) => {
        const own = state.dealers[d.id];
        const r = rarityDef(d.rarity);
        const isNew = codexNewSnapshot.includes(d.id);
        const stars = own ? "★".repeat(own.star) + "☆".repeat(D.dealerStar.maxStar - own.star) : "";
        const need = own ? starUpCost(d.id) : null;
        const shardPct = own && need ? Math.min(100, (own.shards / need) * 100) : own ? 100 : 0;
        return `
          <div class="codex-card ${own ? "" : "locked"}" data-dealer="${d.id}" style="--rc:${r.color}">
            <span class="codex-rank">${r.short}</span>
            ${isNew ? '<span class="badge-new">NEW</span>' : ""}
            <img src="${DealerPortraits.url(d.id, d.rarity)}" alt="${d.name}" loading="lazy" />
            ${own ? "" : '<span class="codex-lock">🔒</span>'}
            <div class="codex-name">${own ? d.name : "???"}</div>
            <div class="codex-stars">${stars}</div>
            ${own ? `<div class="shard-bar"><i style="width:${shardPct}%"></i></div>` : ""}
          </div>`;
      })
      .join("");
    grid.querySelectorAll("[data-dealer]").forEach((el) =>
      el.addEventListener("click", () => openDealerModal(el.dataset.dealer))
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
  }

  const TAB_RENDERERS = {
    store: renderStoreTab,
    tables: renderTablesTab,
    staff: renderStaffTab,
    codex: renderCodexTab,
    decor: renderDecorTab,
    prestige: renderPrestigeTab,
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
        state: boostIsActive("rush") ? `발동 중 · ${formatDuration(boostActiveUntil("rush") - now)}` : `💎${D.boosts.rush.costDiamonds}`,
        can: state.diamonds >= D.boosts.rush.costDiamonds,
        label: `💎${D.boosts.rush.costDiamonds}`,
      },
      {
        def: D.boosts.golden,
        state: boostIsActive("golden")
          ? `발동 중 · ${formatDuration(boostActiveUntil("golden") - now)}`
          : `다음 황금시간까지 ${formatDuration((state.boosts.goldenNextAt || now) - now)}`,
        can: false,
        label: "자동 발동",
      },
    ];
    $("boost-list").innerHTML = items
      .map(
        (it) => `
        <div class="boost-item ${boostIsActive(it.def.id) ? "active" : ""}">
          <div class="item-icon">${it.def.emoji}</div>
          <div class="item-info">
            <div class="item-title">${it.def.name} <span class="lvl-chip">x${it.def.mult}</span></div>
            <div class="item-desc">${it.def.desc}<br/><b>${it.state}</b></div>
          </div>
          <button class="btn btn-buy" data-boost="${it.def.id}" ${it.can ? "" : "disabled"}>${it.label}</button>
        </div>`
      )
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
        <p class="dealer-quote">아직 만나지 못한 딜러예요.<br/>가챠로 영입해보세요!</p>`;
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
      ${
        need === null
          ? '<div class="mission-allclear">⭐ 최고 등급까지 승급했어요!</div>'
          : `<div class="mission-allclear">조각 ${own.shards} / ${need}<div class="shard-bar" style="margin-top:6px"><i style="width:${Math.min(100, (own.shards / need) * 100)}%"></i></div></div>
             <button class="btn btn-primary btn-wide" id="star-up-btn" ${canUp ? "" : "disabled"} style="margin-top:10px">★${own.star + 1} 승급하기</button>`
      }`;
    const upBtn = $("star-up-btn");
    if (upBtn) upBtn.addEventListener("click", () => starUp(dealerId));
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
        bodyHtml: `빈 자리에 새 홀덤 테이블을 놓을까요?<br/>테이블당 수익 <b>${formatRate(perTableIncome())}/초</b>`,
        actionLabel: `테이블 x${n} 추가 (💰${formatChips(cost)})`,
        actionDisabled: state.chips < cost,
        onAction: () => buyTable(),
      });
    } else if (info.type === "table") {
      const n = Math.max(1, plannedQty(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel));
      const cost = bulkCost(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel, n);
      openContextPopup({
        title: "🃏 테이블 강화",
        bodyHtml: `이 테이블은 <b>${formatRate(perTableIncome())}/초</b>를 벌고 있어요.<br/>리모델링 레벨 <b>Lv.${state.tableLevel}</b> (상한 없음)`,
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
      toast(state.ui.autoUpgrade ? "🤖 자동 업그레이드 ON" : "🤖 자동 업그레이드 OFF");
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
      const li = levelInfo();
      toast(`Lv.${li.level} ${li.title} · 다음 레벨까지 💰${formatChips(li.toNext)}`);
    });
    $("prestige-badge").addEventListener("click", () => openSheet("prestige", "브랜드 리뉴얼"));

    // 모달 닫기
    const closers = [
      ["offline-close", "offline-modal"],
      ["gacha-close", "gacha-modal"],
      ["event-claim-btn", "event-modal"],
      ["attendance-close", "attendance-modal"],
      ["mission-close", "mission-modal"],
      ["boost-close", "boost-modal"],
      ["dealer-close", "dealer-modal"],
    ];
    closers.forEach(([btnId, modalId]) => $(btnId).addEventListener("click", () => $(modalId).classList.add("hidden")));
    document.querySelectorAll(".modal").forEach((m) =>
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.add("hidden");
      })
    );
    $("attendance-claim").addEventListener("click", claimAttendance);
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

  document.addEventListener("DOMContentLoaded", init);
})();

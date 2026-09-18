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
    dataResetVersion: D.dataResetVersion,
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
    // 편성 프리셋 5개 — 각각 최대 D.deployment.maxDeployed명, 지금 쓰는 팀은 activeSquad. 프레스티지에도 유지.
    squads: keep.squads ?? Array.from({ length: D.deployment.presets }, () => []),
    activeSquad: keep.activeSquad ?? 0,

    // 가챠 레벨(뽑을수록 오름, 최대 10) + 누적 뽑기 횟수 + 무료 뽑기권(반복 퀘스트 보상) — 전부 계정 단위로 유지
    gachaLevel: keep.gachaLevel ?? 1,
    gachaPulls: keep.gachaPulls ?? 0,
    gachaTickets: keep.gachaTickets ?? 0,

    // 🏆 대회 — 트로피와 트로피 강화, 대회 기록은 계정 단위로 유지
    trophies: keep.trophies ?? 0,
    trophyUpgrades: keep.trophyUpgrades ?? Object.fromEntries(D.trophyShop.upgrades.map((u) => [u.id, 0])),
    trophyDaily: keep.trophyDaily ?? { date: null, tickets: 0 },
    // active: 참가 중인 대회 1개 (순위는 참가 순간 정해지고, 시간이 흐르면서 공개된다) / best: 대회별 최고 순위
    tournament: keep.tournament ?? { active: null, best: {}, entries: 0, wins: 0 },

    // 닉네임 — 기본값은 로그인 아이디, 프로필에서 자유롭게 변경 가능
    nickname: keep.nickname ?? null,
    // 프로필 레벨업 보상을 이미 지급한 최고 레벨(중복 지급 방지). 프레스티지해도 유지.
    profileRewardedLevel: keep.profileRewardedLevel ?? 1,

    theme: keep.theme ?? "classic",
    ownedThemes: keep.ownedThemes ?? ["classic"],
    themeLevels: keep.themeLevels ?? {},

    giftReadyAt: keep.giftReadyAt ?? Date.now(),
    prestige: keep.prestige ?? { points: 0 },

    settings: { showTableIncome: true, autoAssign: true, sfxVolume: 0.6 },
    // lastSub: 네비 묶음별로 마지막에 본 세부 탭 / autoPull: 연속 뽑기 설정(묶음 크기 index, 멈춤 조건, 뽑기권만)
    ui: { buyQty: 1, codexFilter: "all", lastSub: {}, autoPull: { sizeIdx: 1, stop: "legendary", ticketOnly: false } },

    // 영구 업그레이드 레벨 — 리뉴얼해도 절대 초기화되지 않는다(다이아 전용)
    permanentUpgrades: keep.permanentUpgrades ?? Object.fromEntries(D.permanentUpgrades.map((p) => [p.id, 0])),

    // 광고(리워드) 관련 상태 — 계정 단위로 유지
    ads: keep.ads ?? { lastFreePullDate: null, boostCooldownUntil: 0 },

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
    tutorial: keep.tutorial ?? { step: 0, counts: {}, v: D.tutorialVersion },
    repeat: keep.repeat ?? { round: 0, quest: null },
    boosts: keep.boosts ?? { freeReadyAt: 0, active: {}, goldenNextAt: Date.now() + 8 * 60 * 1000 },
  });

  let state = defaultState();
  let lastTickAt = Date.now();
  let sceneDirty = true;
  let activeTab = "tables";
  let sheetOpen = false;
  let lastLiveRenderAt = 0;
  // 도감을 연 순간의 NEW 목록. 탭을 여는 즉시 알림 점은 끄되, 배지는 보는 동안 유지한다.
  let codexNewSnapshot = [];
  // 💎 말풍선 타이머(세이브 안 함 — 접속 중에만 뜬다)
  let nextBubbleAt = Date.now() + 15000;
  let lastBubbleAt = Date.now();
  let bubbleRetryAt = 0;

  // 하단 네비 4묶음 — 업그레이드가 여러 탭에 흩어져 있던 걸 "무엇을 하는 곳인지" 기준으로 묶었다.
  // 묶음 안의 세부 탭은 시트 상단 칩으로 고른다. [탭 id, 이름] — 휴대폰 폭에 5개가 한 줄로 들어가게 글자만 쓴다
  const NAV_GROUPS = {
    upgrade: { title: "업그레이드", tabs: [["tables", "테이블"], ["fixtures", "시설"], ["staff", "직원"], ["decor", "인테리어"], ["permanent", "💎영구"]] },
    crew: { title: "운영진", tabs: [["scout", "스카우트"], ["codex", "도감"]] },
    tournament: { title: "홀덤 대회", tabs: [["tournament", "🏆 대회"], ["trophyShop", "트로피 상점"]] },
    shop: { title: "상점", tabs: [["shop", "상점"]] },
  };
  // 네비에 없는 탭(좌상단 버튼으로 연다)
  const STANDALONE_TITLES = { prestige: "브랜드 리뉴얼", settings: "설정" };

  // 재화·시간에 따라 버튼 활성/비활성이나 진행 표시가 바뀌는 탭만 주기적으로 다시 그린다.
  const LIVE_TABS = new Set(["tables", "fixtures", "staff", "decor", "permanent", "scout", "tournament", "trophyShop", "prestige"]);
  // x1/x10/x100/MAX 배수 선택이 의미 있는(칩으로 구매·강화하는) 탭 — 시트 안 배수 줄은 이 탭들에서만 보인다
  const QTY_TABS = new Set(["tables", "fixtures", "staff", "decor"]);
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
    s.ui.lastSub = { ...(saved.ui?.lastSub || {}) };
    s.ui.autoPull = { ...base.ui.autoPull, ...(saved.ui?.autoPull || {}) };
    s.trophies = saved.trophies ?? 0;
    s.trophyUpgrades = { ...base.trophyUpgrades, ...saved.trophyUpgrades };
    s.trophyDaily = { ...base.trophyDaily, ...saved.trophyDaily };
    s.tournament = { ...base.tournament, ...saved.tournament };
    s.tournament.best = { ...(saved.tournament?.best || {}) };
    // 다이아 금고 삭제(2026-09-18) — 예전 세이브의 금고 레벨은 버린다
    delete s.fixtures.vault;
    s.prestige = { ...base.prestige, ...saved.prestige };
    s.attendance = { ...base.attendance, ...saved.attendance };
    s.boosts = { ...base.boosts, ...saved.boosts };
    s.boosts.active = s.boosts.active || {};
    s.purchases = { ...base.purchases, ...saved.purchases };
    s.purchases.unlockedMythic = Array.isArray(saved.purchases?.unlockedMythic) ? saved.purchases.unlockedMythic : [];
    s.permanentUpgrades = { ...base.permanentUpgrades, ...saved.permanentUpgrades };
    s.ads = { ...base.ads, ...saved.ads };
    s.celebrity = { ...base.celebrity, ...saved.celebrity };
    // 편성 프리셋 — 예전 세이브의 단일 배치 목록(deployedIds)은 1번 팀으로 옮긴다
    s.squads = Array.from({ length: D.deployment.presets }, (_, i) => {
      const from = Array.isArray(saved.squads) ? saved.squads[i] : i === 0 ? saved.deployedIds : null;
      return Array.isArray(from) ? from.slice(0, D.deployment.maxDeployed) : [];
    });
    s.activeSquad = Math.min(D.deployment.presets - 1, Math.max(0, Number(saved.activeSquad) || 0));
    delete s.deployedIds;
    s.gachaLevel = saved.gachaLevel ?? 1;
    s.gachaPulls = saved.gachaPulls ?? 0;
    s.gachaTickets = saved.gachaTickets ?? 0;
    s.nickname = saved.nickname ?? null;
    s.profileRewardedLevel = saved.profileRewardedLevel ?? 1;
    s.missions = { ...base.missions, ...saved.missions };
    s.tutorial = { ...base.tutorial, ...saved.tutorial };
    s.tutorial.counts = s.tutorial.counts || {};
    // 튜토리얼 v2에서 t14 뒤(index 14)에 "첫 대회 출전"이 끼어들었다 — 이미 그 뒤로 넘어간 세이브는 한 칸 밀어서
    // 같은 미션을 다시 받거나 보상을 두 번 받지 않게 한다
    if ((saved.tutorial?.v ?? 1) < 2 && s.tutorial.step >= 14) s.tutorial.step += 1;
    s.tutorial.v = D.tutorialVersion;
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

  // ---------- 배치(편성) ----------
  // 지금 쓰는 팀(프리셋)의 목록. 로스터에서 사라진 id(예전 이름 변경 등)가 세이브에 남아 있어도
  // 매장 렌더가 깨지지 않게, 읽을 때 로스터에 있는 것만 인정한다.
  function squadList(index = state.activeSquad) {
    if (!Array.isArray(state.squads[index])) state.squads[index] = [];
    return state.squads[index];
  }
  const deployedIds = () => squadList().filter((id) => state.dealers[id] && rosterDef(id));
  const squadCount = (index) => squadList(index).filter((id) => state.dealers[id] && rosterDef(id)).length;
  function setActiveSquad(index) {
    if (index === state.activeSquad) return;
    state.activeSquad = index;
    sceneDirty = true;
    toast(`🧑‍💼 ${index + 1}번 편성 적용 · ${squadCount(index)}명`);
    renderCodexTab();
    refresh();
  }
  const isDeployed = (id) => deployedIds().includes(id);
  // ---------- 특성 시너지 ----------
  // 운영진마다 특성 2개: 역할에서 오는 것 + id를 해시해 고정으로 정해지는 것(같은 사람은 항상 같은 특성).
  // D.traits.overrides에 적어두면 그 사람만 손으로 정한 특성을 쓴다.
  const traitDef = (id) => D.traits.list.find((t) => t.id === id);
  const traitCache = new Map();
  function dealerTraits(dealerId) {
    if (traitCache.has(dealerId)) return traitCache.get(dealerId);
    const def = rosterDef(dealerId);
    let traits = D.traits.overrides[dealerId];
    if (!traits) {
      const primary = D.traits.roleTrait[def?.role] || D.traits.list[0].id;
      const rest = D.traits.list.map((t) => t.id).filter((t) => t !== primary);
      let h = 0;
      for (let i = 0; i < dealerId.length; i++) h = (h * 33 + dealerId.charCodeAt(i)) >>> 0;
      traits = [primary, rest[h % rest.length]];
    }
    traitCache.set(dealerId, traits);
    return traits;
  }

  // 편성한 인원의 특성별 인원 수
  function traitCounts(ids = deployedIds()) {
    const counts = {};
    ids.forEach((id) => dealerTraits(id).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    return counts;
  }
  // 특성별 현재 단계(0=미달) — { tier, bonus, next } 형태
  function traitTier(traitId, counts = traitCounts()) {
    const def = traitDef(traitId);
    const n = counts[traitId] || 0;
    let tier = 0;
    let bonus = 0;
    def.tiers.forEach((t, i) => {
      if (n >= t.need) {
        tier = i + 1;
        bonus = t.bonus;
      }
    });
    return { def, count: n, tier, bonus, next: def.tiers[tier] || null };
  }
  // 종류별 시너지 합계 — income/fixture/visitor/power/bubble/offline
  function traitBonus(effect, counts = traitCounts()) {
    let total = 0;
    D.traits.list.forEach((t) => {
      if (t.effect === effect) total += traitTier(t.id, counts).bonus;
    });
    return total;
  }
  const activeTierSum = (counts = traitCounts()) => D.traits.list.reduce((sum, t) => sum + traitTier(t.id, counts).tier, 0);

  // 장착효과 배율 — 시너지 단계가 쌓일수록, 정원(10명)을 꽉 채우면 추가로 커진다
  function deploymentSynergyMultiplier(ids = deployedIds()) {
    if (ids.length === 0) return 1;
    let mult = 1 + activeTierSum(traitCounts(ids)) * D.deployment.synergyPerTier;
    if (ids.length >= D.deployment.maxDeployed) mult *= 1 + D.deployment.fullSquadBonus;
    return mult;
  }

  // ---------- 운영진 효과: 장착효과(배치 시) + 보유효과(보유만 해도) ----------
  // 보유효과 종류는 id로 고정(같은 사람은 항상 같은 효과)
  function ownedEffectType(dealerId) {
    let h = 0;
    for (let i = 0; i < dealerId.length; i++) h = (h * 31 + dealerId.charCodeAt(i)) >>> 0;
    const types = D.dealerEffects.ownedTypes;
    return types[h % types.length];
  }
  function equipEffect(dealerId) {
    const def = rosterDef(dealerId);
    const type = D.dealerEffects.equipByRole[def.role] || "income";
    return { type, value: dealerBonus(dealerId) * D.dealerEffects.typeScale[type] };
  }
  function ownedEffect(dealerId) {
    const type = ownedEffectType(dealerId);
    return { type, value: dealerBonus(dealerId) * D.dealerEffects.ownedScale * D.dealerEffects.typeScale[type] };
  }
  // 종류별 합계 — 장착효과에는 배치 시너지가 곱해지고, 보유효과는 보유한 전원 합산
  function dealerEffectTotal(type) {
    const synergy = deploymentSynergyMultiplier();
    let total = 0;
    deployedIds().forEach((id) => {
      const e = equipEffect(id);
      if (e.type === type) total += e.value * synergy;
    });
    ownedDealerIds().forEach((id) => {
      const e = ownedEffect(id);
      if (e.type === type) total += e.value;
    });
    return total;
  }
  const effectLabel = (e) => `${D.dealerEffects.emojis[e.type]} ${D.dealerEffects.labels[e.type]} +${(e.value * 100).toFixed(1)}%`;

  function toggleDeploy(dealerId) {
    const list = squadList();
    const idx = list.indexOf(dealerId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= D.deployment.maxDeployed) {
        toast(`⚠️ 편성은 최대 ${D.deployment.maxDeployed}명까지예요`);
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
    const list = squadList();
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
    mult += dealerEffectTotal("income");
    D.decor.forEach((d) => {
      mult += d.bonusPerLevel * (state.decor[d.id] || 0);
    });
    mult += D.themeUpgrade.bonusPerLevel * themeLevel();
    mult += permanentBonus("incomeCore");
    mult += trophyBonus("hallOfFame");
    mult += traitBonus("income"); // 🃏 딜링 시너지
    if (vipActive()) mult *= 1 + D.shop.vip.incomeBonusPct / 100;
    mult *= customerFlowMultiplier();
    mult *= prestigeMultiplier();
    mult *= boostMultiplier();
    return mult;
  }

  const vipActive = () => state.purchases.vipUntil > Date.now();

  // 3D 매장에서 홀덤 테이블 좌석이 차는 비율 — 테이블당 방문객이 많을수록(마케터·운영진 방문객 효과) 꽉 찬다
  function tableOccupancy() {
    const c = D.customerFlow;
    const perTable = visitorsPerHour() / Math.max(1, state.tables);
    return Math.max(c.minOccupancy, Math.min(c.maxOccupancy, perTable / c.visitorsPerFullTable));
  }

  // ---------- 방문객(마케터가 늘리는 값) ----------
  // 마케터는 더 이상 매출에 고정 %를 더하지 않고, "시간당 방문객 수"를 늘린다.
  // 방문객이 많을수록 매출도 늘지만 로그형으로 완만하게 체감된다(무한정 비례하지 않음).
  function visitorsPerHour() {
    const c = D.customerFlow;
    const marketerStaff = staffDef("marketer");
    const marketerLevel = state.staff.marketer || 0;
    const marketerMult = 1 + (marketerStaff?.effect.value ?? 0) * marketerLevel;
    const base = c.baseVisitorsPerHour + state.tables * c.visitorsPerTable;
    // 🗣️ 처세 시너지도 방문객을 늘린다
    return Math.round(base * marketerMult * (1 + dealerEffectTotal("visitor") + traitBonus("visitor")));
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
    sfx("buy");
    burst(0xffd24a);
    refresh();
  }

  function fixtureIncome() {
    let income = 0;
    D.fixtures.forEach((f) => {
      if (f.incomePerLevel) income += f.incomePerLevel * state.fixtures[f.id];
    });
    return income * (1 + dealerEffectTotal("fixture") + traitBonus("fixture")); // 🍸 접객 시너지
  }

  const perTableIncome = () =>
    D.table.baseIncome * (1 + state.tableLevel * D.tableUpgrade.bonusPerLevel) * incomeMultiplier();
  const incomePerSecond = () => state.tables * perTableIncome() + fixtureIncome() * incomeMultiplier();

  // ---------- 🏆 트로피 강화 ----------
  const trophyUpgradeDef = (id) => D.trophyShop.upgrades.find((u) => u.id === id);
  const trophyLevel = (id) => state.trophyUpgrades[id] || 0;
  const trophyMaxed = (id) => {
    const def = trophyUpgradeDef(id);
    return def.maxLevel != null && trophyLevel(id) >= def.maxLevel;
  };
  const trophyUpgradeCost = (id) => {
    const def = trophyUpgradeDef(id);
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, trophyLevel(id)));
  };
  const trophyBonus = (id, level = trophyLevel(id)) => (trophyUpgradeDef(id).bonusPerLevel || 0) * level;

  // 오프라인 수익을 인정하는 최대 시간 — 처음엔 2시간, "영업시간 연장"으로 늘린다
  const offlineMaxSeconds = (level = trophyLevel("offlineHours")) =>
    D.offline.baseMaxSeconds + level * trophyUpgradeDef("offlineHours").secondsPerLevel;

  function offlineEfficiency() {
    let eff = D.offline.baseEfficiency;
    D.staff.forEach((s) => {
      if (s.effect.type === "offline") eff += s.effect.value * state.staff[s.id];
    });
    eff += permanentBonus("offlineCore");
    eff += dealerEffectTotal("offline");
    eff += traitBonus("offline"); // 🧠 두뇌 시너지
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
    sfx("star");
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
  // 남은 시간 "4:59" / "1:02:03" — 글자 수가 거의 안 바뀌어서 HUD 알약·타이머 폭이 흔들리지 않는다
  function formatClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
    const ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  // 오프라인 한도 표시용 "2시간" / "2시간 30분"
  function formatHours(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m ? `${h}시간 ${m}분` : `${h}시간`;
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
  // 효과음 (js/sfx.js — 외부 파일 없이 WebAudio로 합성, 설정 탭에서 음량 조절)
  const sfx = (name, arg) => window.Sfx && window.Sfx.play(name, arg);

  // ============================================================
  // 에셋 (js/assets.js의 GameAssets = SVG 아이콘, assets/img/*.png = 트로피·건물·테마)
  // 에셋 파일이 없어도 게임이 돌아가게, 없으면 원래 이모지로 떨어진다.
  // ============================================================
  const GA = () => window.GameAssets;
  const gaIcon = (name, size = 24) => (GA() ? GA().icon(name, { size }) : "");
  // 아이콘이 있으면 SVG, 없으면 이모지
  const itemIcon = (name, emoji, size = 26) => gaIcon(name, size) || emoji;
  const pngIcon = (src, size = 34) => `<img class="ga-img" src="${src}" alt="" width="${size}" height="${size}" loading="lazy" />`;
  // 시설·직원·특성처럼 데이터 id ↔ 아이콘 이름이 다른 것들
  const FIXTURE_ICON = { bar: "bar", fridge: "fridge" };
  const STAFF_ICON = { bartender: "bartender", server: "server", marketer: "marketer" };
  const TRAIT_ICON = { dealing: "traitDealing", social: "traitSocial", service: "traitHospitality", gambler: "traitGambler", host: "traitHype", brain: "traitBrain" };
  const TROPHY_SHOP_ICON = { offlineHours: "moon", training: "target", hallOfFame: "hall", ticket: "ticket", shard: "shard" };
  const traitIcon = (traitId, size = 14) => gaIcon(TRAIT_ICON[traitId], size) || traitDef(traitId).emoji;
  // 프레스티지 포인트에 따른 매장 외관 단계 (assets/img/prestige)
  const BUILDING_STEPS = [
    { id: "pub", name: "로컬 펍", min: 0 },
    { id: "club", name: "인기 클럽", min: 5 },
    { id: "premium", name: "프리미엄 하우스", min: 20 },
    { id: "empire", name: "포커 제국", min: 50 },
  ];
  const buildingStep = (points = state.prestige.points) =>
    [...BUILDING_STEPS].reverse().find((b) => points >= b.min) || BUILDING_STEPS[0];

  // HUD·네비·사이드레일의 이모지를 아이콘으로 한 번만 교체한다
  function applyStaticAssets() {
    if (!GA()) return;
    [["cur-icon-chip", "bb"], ["cur-icon-dia", "diamond"], ["cur-icon-trophy", "trophy"]].forEach(([cls, name]) => {
      document.querySelectorAll("." + cls).forEach((el) => {
        el.style.backgroundImage = `url("${GA().dataUri(name)}")`;
      });
    });
    const NAV_ICON = { upgrade: "build", crew: "crew", tournament: "tournament", shop: "shop" };
    document.querySelectorAll(".bottom-nav .tab-btn").forEach((btn) => {
      const slot = btn.querySelector(".nav-icon");
      const markup = gaIcon(NAV_ICON[btn.dataset.group], 24);
      if (slot && markup) slot.innerHTML = markup;
    });
    const RAIL_ICON = { "gift-btn": "gift", "attendance-btn": "attendance", "mission-btn": "mission", "boost-btn": "boost" };
    Object.entries(RAIL_ICON).forEach(([id, name]) => {
      const btn = $(id);
      const markup = gaIcon(name, 24);
      if (!btn || !markup) return;
      const dot = btn.querySelector(".dot");
      btn.innerHTML = markup;
      if (dot) btn.appendChild(dot); // 알림 점은 살려둔다
    });
    const settingsBtn = document.querySelector('.icon-btn[data-tab="settings"]');
    const settingsIcon = gaIcon("settings", 20);
    if (settingsBtn && settingsIcon) settingsBtn.innerHTML = settingsIcon;
    // 시트 안의 고정 카드 아이콘(테이블·리모델링·매장 확장)
    const staticIcons = [
      ["#buy-table-btn", "table"],
      ["#upgrade-table-btn", "income"],
      ["#expand-store-btn", "build"],
    ];
    staticIcons.forEach(([btnSel, name]) => {
      const slot = document.querySelector(btnSel)?.closest(".item-card")?.querySelector(".item-icon");
      const markup = gaIcon(name, 26);
      if (slot && markup) slot.innerHTML = markup;
    });
  }

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
    sfx("reward"); // 퀘스트·미션·출석·선물 보상은 전부 여기를 지나간다
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

  // 매장 크기(테이블 최대 24칸)에 상한이 있어서, 이미 최대치면 달성할 수 없는 미션은 뽑지 않는다
  const tablesLeftToMax = () => Math.max(0, D.store.maxShownSlots - state.tables);
  function missionPossible(id) {
    if (id === "expand") return !isStoreMaxed();
    if (id === "buyTable") return tablesLeftToMax() > 0;
    return true;
  }
  const capMissionTarget = (id, target) => (id === "buyTable" ? Math.min(target, tablesLeftToMax()) : target);

  function rollMissions() {
    const pool = D.missions.pool.filter((p) => missionPossible(p.id));
    const list = [];
    for (let i = 0; i < D.missions.slots && pool.length; i++) {
      const def = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const target = capMissionTarget(def.id, def.targets[Math.min(i, def.targets.length - 1)]);
      list.push({ id: def.id, target, progress: 0, claimed: false });
    }
    state.missions = { date: todayKey(), list, allClaimed: false };
  }

  function ensureDailyState() {
    const key = todayKey();
    // 날짜가 바뀌었거나, 예전 세이브에 지금은 없어진 미션(선물 받기 등)이 남아 있으면 새로 뽑는다
    const staleMission = state.missions.list.some((m) => !D.missions.pool.find((p) => p.id === m.id));
    if (state.missions.date !== key || staleMission) rollMissions();
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
      case "staff.bartender": return state.staff.bartender || 0;
      case "staff.server": return state.staff.server || 0;
      case "staff.marketer": return state.staff.marketer || 0;
      case "dealerCount": return ownedDealerIds().length;
      case "deployedCount": return deployedIds().length;
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
    const pool = D.repeatQuests.pool.filter((p) => missionPossible(p.id));
    const prev = state.repeat.quest && state.repeat.quest.id;
    // 같은 퀘스트가 연달아 나오지 않게 한 번 걸러준다
    const candidates = pool.filter((p) => p.id !== prev);
    const list = candidates.length ? candidates : pool;
    const def = list[Math.floor(Math.random() * list.length)];
    const round = state.repeat.round;
    // 회차에 따라 목표가 커지되 항목별 상한까지만 — 후반에 깰 수 없는 퀘스트가 나오지 않게 한다.
    // 매출 목표는 부스트를 뺀 기본 수익으로 잡는다(부스트 켜진 순간에 뽑히면 목표가 몇 배로 부풀어 사실상 못 깸)
    const target =
      def.id === "earn"
        ? Math.max(200, Math.ceil((incomePerSecond() / boostMultiplier()) * Math.min(def.maxSeconds || Infinity, def.incomeSeconds * Math.pow(def.growth, round))))
        : Math.max(1, capMissionTarget(def.id, Math.min(def.max || Infinity, Math.ceil(def.base * Math.pow(def.growth, round)))));
    state.repeat.quest = { id: def.id, target, progress: 0, startLifetime: state.lifetimeEarned };
  }

  // "매출 올리기" 진행도 = 퀘스트를 받은 뒤 번 돈. 리뉴얼하면 이번 회차 누적(totalEarned)은 0이 되므로
  // 줄어들지 않는 평생 누적(lifetimeEarned) 차이로 센다.
  function earnProgress(q) {
    if (q.startLifetime == null) {
      // 예전 방식(startEarned = 이번 회차 누적 기준)으로 저장된 퀘스트는 지금까지 번 만큼을 살려서 옮긴다
      q.startLifetime = state.lifetimeEarned - Math.max(0, state.totalEarned - (q.startEarned || 0));
      delete q.startEarned;
    }
    return Math.max(0, state.lifetimeEarned - q.startLifetime);
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
    // 예전 세이브의 없어진 퀘스트(매장 확장 등)나, 매장이 최대라 더는 진행할 수 없게 된 퀘스트는 새로 뽑는다
    const q0 = state.repeat.quest;
    const stuck = q0 && !missionPossible(q0.id) && q0.progress < q0.target;
    if (!q0 || !repeatDef(q0.id) || stuck) rollRepeatQuest();
    const q = state.repeat.quest;
    const def = repeatDef(q.id);
    // 난이도 하향 전에 받아둔 퀘스트도 지금 상한까지만 요구한다
    if (def.max && q.target > def.max) q.target = def.max;
    if (q.id === "earn" && def.maxSeconds) {
      const cap = Math.max(200, Math.ceil((incomePerSecond() / boostMultiplier()) * def.maxSeconds));
      if (q.target > cap) q.target = cap;
    }
    // "매출 올리기"는 별도 카운터 없이 누적 수익 차이로 판정한다
    const raw = q.id === "earn" ? earnProgress(q) : q.progress;
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
    sfx("boost");
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
  // 💎 다이아 말풍선 — 테이블 손님이 가끔 띄우고, 터치하면 다이아 (다이아 금고 대체)
  // ============================================================
  const bubbleTutorialActive = () => {
    const t = tutorialState();
    return Boolean(t && !t.done && t.def.goal.action === "diamondBubble");
  };
  function scheduleNextBubble(now) {
    const b = D.diamondBubble;
    const base = b.minIntervalMs + Math.random() * (b.maxIntervalMs - b.minIntervalMs);
    // 🎉 흥 시너지 + 운영진 "다이아 말풍선" 효과만큼 간격이 짧아진다
    nextBubbleAt = now + base / (1 + dealerEffectTotal("diamond") + traitBonus("bubble"));
  }
  function tickDiamondBubble() {
    if (!window.PubScene3D || !window.PubScene3D.spawnDiamondBubble || document.hidden) return;
    const now = Date.now();
    if (now < bubbleRetryAt) return;
    const due = now >= nextBubbleAt || (bubbleTutorialActive() && now >= lastBubbleAt + D.diamondBubble.tutorialIntervalMs);
    if (!due) return;
    if (window.PubScene3D.spawnDiamondBubble(D.diamondBubble.lifeSec)) {
      lastBubbleAt = now;
      scheduleNextBubble(now);
    } else {
      bubbleRetryAt = now + 3000; // 앉은 손님이 없거나 말풍선이 이미 많으면 잠시 뒤 다시 시도
    }
  }
  // 3D 씬이 말풍선 터치를 감지하면 부른다 → 지급한 다이아 수를 돌려주면 씬이 "+💎n"을 띄운다
  function collectDiamondBubble() {
    const b = D.diamondBubble;
    const amount = b.diamondsMin + Math.floor(Math.random() * (b.diamondsMax - b.diamondsMin + 1));
    addDiamonds(amount);
    trackMission("diamondBubble");
    sfx("gem");
    refresh();
    return amount;
  }

  // ============================================================
  // 🏆 홀덤펍 대회 — 새 재화 트로피
  // ============================================================
  const T = D.tournament;
  const tierDef = (id) => T.tiers.find((t) => t.id === id);
  const itmPlaces = (tier) => Math.max(9, Math.ceil(tier.field * T.itmFraction));
  // 이전 등급 대회에서 상금권에 든 적이 있으면 열린다
  const tierUnlocked = (i) => i === 0 || (state.tournament.best[T.tiers[i - 1].id] ?? Infinity) <= itmPlaces(T.tiers[i - 1]);

  // 대회 전투력 = (배치한 운영진 등급·별 × 배치 시너지 + 테이블·리모델링) × 대회 훈련
  function tournamentPowerParts() {
    let crew = 0;
    deployedIds().forEach((id) => {
      const def = rosterDef(id);
      crew += (T.rarityPower[def.rarity] || T.rarityPower.common) * (1 + (state.dealers[id].star - 1) * D.dealerStar.bonusPerStar);
    });
    crew *= deploymentSynergyMultiplier();
    const pub = state.tables * T.tablePower + state.tableLevel * T.tableLevelPower;
    // 🎲 승부사 시너지 + 🏆 대회 훈련
    const training = (1 + trophyBonus("training")) * (1 + traitBonus("power"));
    return { crew: Math.round(crew), pub, training, total: Math.round((crew + pub) * training) };
  }
  const tournamentPower = () => tournamentPowerParts().total;
  const tournamentBuyIn = (tier) =>
    Math.max(T.minBuyIn, Math.ceil((incomePerSecond() / boostMultiplier()) * tier.durationMin * T.buyInSecondsPerMin));
  // 추천 전투력보다 한참 세면 보상을 줄인다(쉬운 대회 반복 파밍 방지)
  const overpowerMult = (ratio) => (ratio > T.overpowerRatio ? Math.max(T.minRewardMult, T.overpowerRatio / ratio) : 1);
  const payoutFor = (tier, place) => T.payouts.find((p) => place <= (p.maxPlace === "itm" ? itmPlaces(tier) : p.maxPlace));
  function matchupLabel(ratio) {
    if (ratio > T.overpowerRatio) return { text: "너무 쉬움 · 보상↓", cls: "over" };
    if (ratio >= 1.5) return { text: "유리", cls: "good" };
    if (ratio >= 0.8) return { text: "해볼 만함", cls: "even" };
    if (ratio >= 0.4) return { text: "불리", cls: "hard" };
    return { text: "매우 불리", cls: "hard" };
  }
  // 대회 시간 중 t(0~1) 시점에 남아 있는 인원
  const playersLeft = (tier, t) => Math.max(1, Math.round(1 + (tier.field - 1) * Math.pow(1 - Math.min(1, t), T.fieldCurve)));

  function enterTournament(tierId) {
    const idx = T.tiers.findIndex((t) => t.id === tierId);
    const tier = T.tiers[idx];
    if (!tier || !tierUnlocked(idx)) return;
    if (state.tournament.active) {
      toast("🏆 이미 참가 중인 대회가 있어요");
      return;
    }
    const buyIn = tournamentBuyIn(tier);
    if (state.chips < buyIn) {
      toast("💰 참가비가 부족해요");
      return;
    }
    state.chips -= buyIn;
    const power = tournamentPower();
    const ratio = power / tier.recommended;
    // 순위는 참가 순간 정한다. 상위 비율 = 난수^지수 — 전투력이 높을수록 지수가 커져 상위권이 잘 나오지만 운은 항상 남는다
    const topFrac = Math.pow(Math.random(), 0.5 + 1.5 * ratio);
    const place = Math.min(tier.field, Math.max(1, Math.ceil(topFrac * tier.field)));
    // 남은 인원이 내 순위 밑으로 내려가는 순간 탈락 → 그때 대회가 끝난다(우승이면 끝까지)
    const endFrac = place === 1 ? 1 : Math.max(0.08, 1 - Math.pow((place - 1) / (tier.field - 1), 1 / T.fieldCurve));
    const now = Date.now();
    const durationMs = tier.durationMin * 60 * 1000;
    state.tournament.active = { tierId, startAt: now, endAt: now + durationMs * endFrac, durationMs, place, buyIn, power, ratio, notified: false };
    state.tournament.entries = (state.tournament.entries || 0) + 1;
    trackMission("tournament");
    toast(`${tier.emoji} ${tier.name} 참가! 결과는 대회 탭에서 확인해요`);
    burst(0xffd24a);
    refresh();
  }

  function tournamentReward(a) {
    const tier = tierDef(a.tierId);
    const pay = payoutFor(tier, a.place);
    const mult = overpowerMult(a.ratio);
    return {
      tier,
      pay,
      trophies: Math.max(1, Math.round(tier.trophies * pay.trophyMult * mult)),
      bb: Math.floor(a.buyIn * pay.bbMult * mult),
      diamonds: mult < 1 ? 0 : Math.round(tier.diamonds * pay.diamondMult),
    };
  }

  function claimTournament() {
    const a = state.tournament.active;
    if (!a || Date.now() < a.endAt) return;
    state.tournament.active = null;
    if (!tierDef(a.tierId)) return refresh(); // 없어진 대회(데이터 변경)는 조용히 정리
    const unlockedBefore = T.tiers.map((_, i) => tierUnlocked(i));
    const r = tournamentReward(a);
    state.trophies += r.trophies;
    if (r.bb) addChips(r.bb);
    if (r.diamonds) addDiamonds(r.diamonds);
    const best = state.tournament.best[a.tierId];
    state.tournament.best[a.tierId] = best ? Math.min(best, a.place) : a.place;
    if (a.place === 1) {
      state.tournament.wins = (state.tournament.wins || 0) + 1;
      sceneDirty = true; // 대회 접수대에 우승 트로피가 늘어난다
    }
    const parts = [`🏆${r.trophies}`];
    if (r.bb) parts.push(`💰${formatChips(r.bb)}`);
    if (r.diamonds) parts.push(`💎${r.diamonds}`);
    toast(`${r.pay.label} (${a.place}위) · ${parts.join(" ")}`);
    const opened = T.tiers.find((t, i) => tierUnlocked(i) && !unlockedBefore[i]);
    if (opened) setTimeout(() => toast(`🔓 ${opened.emoji} ${opened.name} 참가 가능!`), 1100);
    sfx(r.pay.id === "bust" ? "lose" : "win");
    burst(a.place <= 3 ? 0xffd24a : 0x7bc67e);
    refresh();
  }

  function tickTournament() {
    const a = state.tournament.active;
    if (!a || a.notified || Date.now() < a.endAt) return;
    a.notified = true;
    const tier = tierDef(a.tierId);
    if (tier) toast(`${tier.emoji} ${tier.name} 결과 발표! ${a.place}위 — 대회 탭에서 보상을 받아요`);
    refreshDots();
  }

  // ---------- 🏆 트로피 상점 ----------
  function buyTrophyUpgrade(id) {
    if (trophyMaxed(id)) return;
    const cost = trophyUpgradeCost(id);
    if (state.trophies < cost) {
      toast("🏆 트로피가 부족해요");
      return;
    }
    state.trophies -= cost;
    state.trophyUpgrades[id] = trophyLevel(id) + 1;
    sfx("buy");
    burst(0xffd24a);
    refresh();
  }
  function trophyTicketsLeft() {
    if (state.trophyDaily.date !== todayKey()) state.trophyDaily = { date: todayKey(), tickets: 0 };
    return Math.max(0, D.trophyShop.ticket.dailyLimit - state.trophyDaily.tickets);
  }
  function buyTicketWithTrophies() {
    const cost = D.trophyShop.ticket.cost;
    if (trophyTicketsLeft() <= 0 || state.trophies < cost) return;
    state.trophies -= cost;
    state.trophyDaily.tickets += 1;
    state.gachaTickets = (state.gachaTickets || 0) + 1;
    toast("🎫 무료 뽑기권 1장 교환!");
    refresh();
  }
  const shardTrophyCost = (dealerId) => D.trophyShop.shardCost[rosterDef(dealerId).rarity] || D.trophyShop.shardCost.common;
  function buyShardWithTrophies(dealerId) {
    const own = state.dealers[dealerId];
    if (!own || starUpCost(dealerId) === null) return;
    const cost = shardTrophyCost(dealerId);
    if (state.trophies < cost) {
      toast("🏆 트로피가 부족해요");
      return;
    }
    state.trophies -= cost;
    own.shards += 1;
    renderDealerModal(dealerId);
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
    sfx("buy");
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
    sfx("buy");
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
    sfx("buy");
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
    sfx("buy");
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
    sfx("buy");
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
    sfx("buy");
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
    sfx("buy");
    sceneDirty = true;
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
    const giftMult = 1 + dealerEffectTotal("gift"); // 운영진 "선물 보상" 효과
    const chipGain = chipSecondsToChips(D.gift.chipSeconds) * giftMult;
    const diaGain = Math.round((D.gift.diamondMin + Math.floor(Math.random() * (D.gift.diamondMax - D.gift.diamondMin + 1))) * giftMult);
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
    if (!autoPull) $("gacha-head").textContent = results.length > 1 ? `운영진 ${results.length}명 영입!` : "운영진 영입!";
    box.innerHTML = results
      .map(
        (r, i) => `
        <div class="gacha-result-item" style="--rc:${r.rarity.color};animation-delay:${autoPull ? 0 : i * 45}ms">
          <img src="${DealerPortraits.url(r.def.id, r.def.rarity)}" alt="${r.def.name}" />
          <div class="gr-name">${r.def.name}</div>
          <div class="gr-tag">${r.rarity.short}${r.isNew ? " · NEW" : " · 조각+1"}</div>
        </div>`
      )
      .join("");
    box.classList.toggle("many", results.length >= 10);
    box.classList.toggle("auto", Boolean(autoPull));
    box.scrollTop = 0;
    $("gacha-modal").classList.remove("hidden");
    renderGachaModalControls();
  }

  const rarityRank = (id) => (id === "mythic" ? D.gacha.rarities.length : D.gacha.rarities.findIndex((r) => r.id === id));

  // 무료 뽑기권이 count장 이상이면 그 버튼은 뽑기권으로(무료), 아니면 다이아로 뽑는다
  const canPullFree = (opt) => (state.gachaTickets || 0) >= opt.count;
  const canAffordPull = (opt, ticketOnly = false) => canPullFree(opt) || (!ticketOnly && state.diamonds >= opt.costDiamonds);

  // 뽑기 한 묶음(1/10/30회) 실행. 재화가 모자라면 { error }를 돌려주고 아무것도 쓰지 않는다.
  function executePull(opt, { ticketOnly = false } = {}) {
    const free = canPullFree(opt);
    if (free) state.gachaTickets -= opt.count;
    else if (ticketOnly) return { error: "🎫 뽑기권이 부족해요" };
    else if (state.diamonds < opt.costDiamonds) return { error: "💎 다이아가 부족해요" };
    else state.diamonds -= opt.costDiamonds;

    const guaranteeRank = rarityRank(D.gacha.multiGuarantee);
    const results = [];
    for (let i = 0; i < opt.count; i++) {
      // 10장 단위마다 마지막 한 장은 희귀 이상 확정(그 10장 안에서 이미 희귀 이상이 나왔으면 확정 불필요)
      const blockStart = i - (i % 10);
      const lastOfBlock = i % 10 === 9;
      const blockHasRare = results.slice(blockStart).some((r) => rarityRank(r.rarity.id) >= guaranteeRank);
      const guarantee = opt.count >= 10 && lastOfBlock && !blockHasRare;
      results.push(pullOne(guarantee ? D.gacha.multiGuarantee : null));
    }
    trackMission("gacha", opt.count);
    // 새 얼굴이 들어왔을 때만 테이블 딜러가 바뀐다 — 연속 뽑기 중 매번 매장 전체를 다시 그리지 않게
    if (results.some((r) => r.isNew)) sceneDirty = true;
    const best = results.reduce((a, b) => (rarityRank(b.rarity.id) > rarityRank(a.rarity.id) ? b : a));
    sfx("gacha", rarityRank(best.rarity.id)); // 등급이 높을수록 화려한 소리
    return { results, free, best };
  }

  let lastPullOpt = D.gacha.pullOptions[0];
  function pullGacha(opt) {
    if (autoPull) return;
    const res = executePull(opt);
    if (res.error) return toast(res.error);
    lastPullOpt = opt;
    showGachaResults(res.results);
    burst(res.best.rarity.color);
    refresh();
  }

  // ---------- 🔁 연속 뽑기 ----------
  // 고른 묶음을 멈춤 조건(SSR/SR 이상/새 운영진)에 걸리거나 재화가 떨어지거나 "멈추기"를 누를 때까지 반복한다.
  let autoPull = null;
  const AUTO_STOP_LABEL = { legendary: "SSR", epic: "SR 이상", new: "새 운영진", none: "" };
  function autoStopHit(stop, r) {
    if (stop === "new") return r.isNew;
    if (stop === "epic" || stop === "legendary") return rarityRank(r.rarity.id) >= rarityRank(stop);
    return false;
  }
  function startAutoPull() {
    if (autoPull) return;
    const cfg = state.ui.autoPull;
    const opt = D.gacha.pullOptions[cfg.sizeIdx] || D.gacha.pullOptions[1];
    if (!canAffordPull(opt, cfg.ticketOnly)) {
      toast(cfg.ticketOnly ? "🎫 뽑기권이 부족해요" : "💎 다이아가 부족해요");
      return;
    }
    autoPull = { opt, stop: cfg.stop, ticketOnly: cfg.ticketOnly, running: true, rounds: 0, pulls: 0, counts: {}, newCount: 0, spentDia: 0, spentTickets: 0, reason: "", timer: null };
    $("gacha-head").textContent = "🔁 연속 뽑기";
    autoPullStep();
  }
  function autoPullStep() {
    const ap = autoPull;
    if (!ap || !ap.running) return;
    const res = executePull(ap.opt, { ticketOnly: ap.ticketOnly });
    if (res.error) return stopAutoPull(`${res.error} · 연속 뽑기 끝`);
    ap.rounds += 1;
    ap.pulls += ap.opt.count;
    if (res.free) ap.spentTickets += ap.opt.count;
    else ap.spentDia += ap.opt.costDiamonds;
    res.results.forEach((r) => {
      ap.counts[r.rarity.id] = (ap.counts[r.rarity.id] || 0) + 1;
      if (r.isNew) ap.newCount += 1;
    });
    showGachaResults(res.results);
    burst(res.best.rarity.color);
    refresh();
    const hit = res.results.find((r) => autoStopHit(ap.stop, r));
    if (hit) return stopAutoPull(`✨ ${hit.rarity.short} ${hit.def.name}${hit.isNew ? " (NEW)" : ""} 등장! 멈췄어요`);
    ap.timer = setTimeout(autoPullStep, ap.opt.count === 1 ? D.gacha.autoPull.singleIntervalMs : D.gacha.autoPull.intervalMs);
  }
  function stopAutoPull(reason = "⏹ 멈췄어요") {
    if (!autoPull) return;
    clearTimeout(autoPull.timer);
    autoPull.running = false;
    autoPull.reason = reason;
    renderGachaModalControls();
  }
  function closeGachaModal() {
    if (autoPull) clearTimeout(autoPull.timer);
    autoPull = null;
    $("gacha-modal").classList.add("hidden");
    refresh();
  }
  function renderGachaModalControls() {
    const summary = $("gacha-auto-summary");
    const again = $("gacha-again");
    if (autoPull) {
      const ap = autoPull;
      const chips = [...D.gacha.rarities, D.gacha.mythicRarity]
        .filter((r) => ap.counts[r.id])
        .sort((a, b) => rarityRank(b.id) - rarityRank(a.id))
        .map((r) => `<span class="rarity-chip" style="--rc:${r.color}">${r.short} ${ap.counts[r.id]}</span>`)
        .join("");
      const spent = [ap.spentDia ? `💎-${formatNumber(ap.spentDia)}` : "", ap.spentTickets ? `🎫-${ap.spentTickets}` : ""].filter(Boolean).join(" · ");
      summary.innerHTML = `
        <div class="gas-line"><b>${ap.rounds}회차</b> · 총 ${ap.pulls}회 · NEW ${ap.newCount}${spent ? ` · ${spent}` : ""}</div>
        <div class="rarity-chip-row">${chips}</div>
        <div class="gas-reason">${ap.running ? `${ap.opt.count}회씩 뽑는 중…${AUTO_STOP_LABEL[ap.stop] ? ` (${AUTO_STOP_LABEL[ap.stop]} 나오면 멈춤)` : ""}` : ap.reason}</div>`;
      summary.hidden = false;
      again.textContent = ap.running ? "⏹ 멈추기" : "🔁 다시 연속 뽑기";
      again.disabled = !ap.running && !canAffordPull(ap.opt, ap.ticketOnly);
    } else {
      summary.hidden = true;
      const free = canPullFree(lastPullOpt);
      again.textContent = free ? `🎫 ${lastPullOpt.count}회 더` : `${lastPullOpt.count}회 더 · 💎${formatNumber(lastPullOpt.costDiamonds)}`;
      again.disabled = !canAffordPull(lastPullOpt);
    }
  }
  function onGachaAgain() {
    if (autoPull && autoPull.running) return stopAutoPull();
    if (autoPull) {
      autoPull = null;
      return startAutoPull();
    }
    pullGacha(lastPullOpt);
  }

  // 뽑기 버튼은 운영진 탭이 0.5초마다 다시 그려질 때도 누른 탭이 씹히지 않게 한 번만 만들고 내용만 갱신한다
  function setupPullButtons() {
    const row = $("gacha-pull-row");
    row.innerHTML = "";
    D.gacha.pullOptions.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-buy gacha-pull-btn";
      btn.dataset.pull = i;
      btn.addEventListener("click", () => pullGacha(opt));
      row.appendChild(btn);
    });
  }
  function renderPullButtons() {
    $("gacha-pull-row")
      .querySelectorAll("[data-pull]")
      .forEach((btn) => {
        const opt = D.gacha.pullOptions[Number(btn.dataset.pull)];
        const free = canPullFree(opt);
        const extra = opt.count >= 10 ? ` · R확정${opt.count > 10 ? ` ${opt.count / 10}장` : ""}` : "";
        const html = free
          ? `🎫 무료 ${opt.count}회<small>뽑기권 ${opt.count}장${extra}</small>`
          : `${opt.label}<small>${formatNumber(opt.costDiamonds)}💎${extra}</small>`;
        if (btn.innerHTML !== html) btn.innerHTML = html;
        btn.classList.toggle("gacha-free", free);
        btn.classList.toggle("gacha-multi", !free && opt.count >= 10);
        btn.disabled = !free && state.diamonds < opt.costDiamonds;
      });
  }

  // ---------- 운영진 승급 ----------
  function starUpCost(dealerId) {
    const owned = state.dealers[dealerId];
    if (!owned || owned.star >= D.dealerStar.maxStar) return null;
    const def = rosterDef(dealerId);
    const curve = D.dealerStar.shardsPerStarByRarity[def.rarity] || D.dealerStar.shardsPerStarByRarity.common;
    return curve[owned.star - 1];
  }
  const canStarUp = (dealerId) => {
    const need = starUpCost(dealerId);
    return need !== null && state.dealers[dealerId].shards >= need;
  };
  function starUp(dealerId) {
    if (!canStarUp(dealerId)) return;
    const owned = state.dealers[dealerId];
    owned.shards -= starUpCost(dealerId);
    owned.star += 1;
    sceneDirty = true;
    sfx("star");
    burst(rarityDef(rosterDef(dealerId).rarity).color);
    renderDealerModal(dealerId);
    refresh();
  }

  // 도감 일괄 승급: 조각이 충분한 운영진을 전부, 올릴 수 있는 만큼 끝까지 승급
  function starUpAll() {
    let stars = 0;
    const people = new Set();
    ownedDealerIds().forEach((id) => {
      while (canStarUp(id)) {
        const owned = state.dealers[id];
        owned.shards -= starUpCost(id);
        owned.star += 1;
        stars += 1;
        people.add(id);
      }
    });
    if (!stars) {
      toast("⭐ 지금 승급할 수 있는 운영진이 없어요");
      return;
    }
    sceneDirty = true;
    sfx("star");
    burst(0xffc83c);
    toast(`⭐ ${people.size}명 승급 완료 (별 +${stars})`);
    refresh();
  }

  // 자동 편성: 전투력 상위 조합과 특성 시너지를 노린 조합들을 만들어 보고 점수가 가장 높은 걸 고른다
  function quickDeploy() {
    const owned = ownedDealerIds().sort((a, b) => dealerBonus(b) - dealerBonus(a));
    if (!owned.length) {
      toast("🧑‍💼 편성할 운영진이 없어요. 먼저 스카우트해보세요");
      return;
    }
    const max = D.deployment.maxDeployed;
    // 점수 = 장착효과 합 × 시너지 배율 × 수익계 특성 보너스
    // (특성마다 오르는 값이 달라서 정확히는 못 비교하니, 수익에 직접 닿는 쪽에 가중치를 둔다)
    const score = (ids) => {
      const counts = traitCounts(ids);
      const value = 1 + traitBonus("income", counts) + 0.5 * traitBonus("fixture", counts) + 0.5 * traitBonus("visitor", counts);
      return ids.reduce((s, id) => s + dealerBonus(id), 0) * deploymentSynergyMultiplier(ids) * value;
    };
    const fill = (base) => [...base, ...owned.filter((id) => !base.includes(id))].slice(0, max);
    const candidates = [owned.slice(0, max)];
    // 특성별로 그 특성을 가진 최강 인원부터 몰아주는 조합도 후보에 넣는다(3단계까지 노릴 수 있게)
    D.traits.list.forEach((t) => {
      candidates.push(fill(owned.filter((id) => dealerTraits(id).includes(t.id)).slice(0, 6)));
    });
    // 특성 2종류를 같이 노리는 조합
    D.traits.list.forEach((t1) => {
      D.traits.list.forEach((t2) => {
        if (t1.id >= t2.id) return;
        const pick = [
          ...owned.filter((id) => dealerTraits(id).includes(t1.id)).slice(0, 4),
          ...owned.filter((id) => dealerTraits(id).includes(t2.id)).slice(0, 4),
        ];
        candidates.push(fill([...new Set(pick)]));
      });
    });
    state.squads[state.activeSquad] = candidates.reduce((best, c) => (score(c) > score(best) ? c : best));
    sceneDirty = true;
    toast(`⚡ ${state.activeSquad + 1}번 편성 완료 · ${deployedIds().length}명 · 시너지 +${Math.round((deploymentSynergyMultiplier() - 1) * 100)}%`);
    renderCodexTab();
    refresh();
  }

  // ★ 표시: 5칸 — ★1~5는 은색 별이 차오르고, ★6부터는 왼쪽부터 금색으로 바뀐다(★10 = 금별 5개)
  function starsHtml(star) {
    const slots = 5;
    const gold = Math.max(0, star - slots);
    let html = "";
    for (let i = 0; i < slots; i++) {
      const cls = i < gold ? "star-gold" : i < Math.min(star, slots) ? "star-silver" : "star-empty";
      html += `<i class="${cls}">${cls === "star-empty" ? "☆" : "★"}</i>`;
    }
    return `<span class="stars">${html}</span>`;
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
      trophies: state.trophies,
      trophyUpgrades: state.trophyUpgrades,
      trophyDaily: state.trophyDaily,
      tournament: state.tournament,
      dealers: state.dealers,
      codexNew: state.codexNew,
      squads: state.squads,
      activeSquad: state.activeSquad,
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

  // (전체 초기화·저장 코드 내보내기/가져오기 UI는 설정에서 뺐다. 필요하면 GameBackend.resetState/
  //  exportState/importState가 그대로 남아 있으니 버튼만 다시 붙이면 된다)


  // ============================================================
  // 렌더링
  // ============================================================
  function renderHUD() {
    setText($("chips-value"), `${formatNumber(state.chips)} BB`);
    setText($("income-value"), `+${formatRate(incomePerSecond())} BB/초`);
    setText($("diamonds-value"), formatNumber(state.diamonds));
    setText($("trophies-value"), formatNumber(state.trophies));
    setText($("prestige-mult"), `x${prestigeMultiplier().toFixed(2)}`);
    renderQuestBanner();

    const li = levelInfo();
    $("avatar-lv").textContent = li.level;
    $("profile-title").textContent = li.title;
    $("xp-fill").style.width = `${(li.progress * 100).toFixed(1)}%`;
    $("avatar-ring").style.setProperty("--xp", `${(li.progress * 100).toFixed(1)}%`);

    // 활성 부스트 표시
    const strip = $("boost-strip");
    const now = Date.now();
    const active = Object.entries(state.boosts.active).filter(([id, until]) => until > now && D.boosts[id]);
    const pills = active.map(([id, until]) => {
      const def = D.boosts[id];
      return `<span class="boost-pill">${def.emoji} x${def.mult} <i>${formatClock(until - now)}</i></span>`;
    });
    // 참가 중인 대회도 같은 줄에 남은 시간/결과 대기를 보여준다
    const a = state.tournament.active;
    if (a && tierDef(a.tierId)) {
      pills.push(
        now < a.endAt
          ? `<span class="boost-pill tourney-pill">🏆 <i>${formatClock(a.endAt - now)}</i></span>`
          : `<span class="boost-pill tourney-pill ready">🏆 결과!</span>`
      );
    }
    setHtml(strip, pills.join(""));
  }
  // 같은 글자면 DOM을 건드리지 않는다(0.2초마다 갱신되는 HUD가 레이아웃을 흔들지 않게).
  // 요소가 없어도 게임 전체가 멈추지 않게 조용히 넘어간다(캐시가 섞여 옛 HTML이 뜨는 경우 대비).
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
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
    "store.expansions": "tables", expand: "tables",
    "fixtures.bar": "fixtures", "fixtures.fridge": "fixtures", upgradeFixture: "fixtures",
    "staff.bartender": "staff", "staff.server": "staff", "staff.marketer": "staff", hireStaff: "staff",
    dealerCount: "scout", gacha: "scout",
    decorTotal: "decor", upgradeDecor: "decor", themeCount: "decor",
    prestigePoints: "prestige",
    maxStar: "codex", deployedCount: "codex",
    tournament: "tournament",
    earn: "tables",
  };
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
    if (q.key === "diamondBubble") {
      closeSheet();
      return toast("💎 테이블에 앉은 손님 머리 위 말풍선을 터치해보세요!");
    }
    const tab = QUEST_TAB_MAP[q.key];
    if (tab) openSheet(tab);
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
    $("tournament-dot").classList.toggle("show", tournamentResultReady());
    const codexSub = document.querySelector('.subtab[data-sub="codex"] .dot');
    if (codexSub) codexSub.classList.toggle("show", state.codexNew.length > 0);
    const tourneySub = document.querySelector('.subtab[data-sub="tournament"] .dot');
    if (tourneySub) tourneySub.classList.toggle("show", tournamentResultReady());
  }
  const tournamentResultReady = () => Boolean(state.tournament.active && Date.now() >= state.tournament.active.endAt);

  // 버튼에 "현재 배수 기준 개수/비용"을 채운다
  function setBuyButton(btn, { base, growth, owned, cap = Infinity, label }) {
    const n = plannedQty(base, growth, owned, cap);
    const cost = bulkCost(base, growth, owned, Math.max(n, 1));
    const qtyLabel = state.ui.buyQty === "MAX" ? (n > 0 ? `x${n}` : "MAX") : `x${state.ui.buyQty}`;
    setHtml(btn, `${label} ${qtyLabel}<small>${formatChips(cost)}</small>`);
    btn.disabled = n <= 0 || state.chips < cost;
    return n;
  }

  // 내용이 바뀔 때만 다시 쓴다(0.5초마다 같은 내용을 덮어쓰면 누르는 도중 버튼 속 글자가 교체됨)
  function setHtml(el, html) {
    if (!el || el.dataset.html === html) return;
    el.innerHTML = html;
    el.dataset.html = html;
  }

  // 목록 카드는 구성이 바뀔 때만 새로 만들고, 평소엔 만들어 둔 카드의 내용만 갱신한다.
  // 탭이 열려 있으면 0.5초마다 다시 그리는데, 그때마다 카드를 통째로 새로 만들면
  // 손가락을 떼기 전에 버튼이 바뀌어 탭이 씹힌다(구매가 안 되고 퀘스트도 안 오름).
  function keyedCards(wrap, items, keyOf, build) {
    const keys = items.map(keyOf).join("|");
    if (wrap.dataset.keys !== keys) {
      wrap.innerHTML = "";
      items.forEach((it) => wrap.appendChild(build(it)));
      wrap.dataset.keys = keys;
    }
    return Array.from(wrap.children);
  }

  function renderFixturesTab() {
    const cards = keyedCards($("fixture-list"), D.fixtures, (f) => f.id, (f) => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${itemIcon(FIXTURE_ICON[f.id], f.emoji)}</div>
        <div class="item-info">
          <div class="item-title">${f.name} <span class="lvl-chip"></span></div>
          <div class="item-desc">${f.desc}</div>
        </div>
        <button class="btn btn-buy"></button>`;
      card.querySelector("button").addEventListener("click", () => upgradeFixture(f.id));
      return card;
    });
    D.fixtures.forEach((f, i) => {
      const level = state.fixtures[f.id];
      setHtml(cards[i].querySelector(".lvl-chip"), `Lv.${level}`);
      setBuyButton(cards[i].querySelector("button"), { base: f.baseCost, growth: f.costGrowth, owned: level, label: level === 0 ? "설치" : "강화" });
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
      setHtml(buyBtn, `구매<small>매장 확장 필요</small>`);
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

    setText($("store-capacity"), String(tableCapacity()));
    const expandBtn = $("expand-store-btn");
    if (isStoreMaxed()) {
      setHtml(expandBtn, "최대 확장");
      expandBtn.disabled = true;
    } else {
      setBuyButton(expandBtn, {
        base: D.store.expansionBaseCost,
        growth: D.store.expansionCostGrowth,
        owned: state.store.expansions,
        label: "확장",
      });
    }
    setText($("store-visitors"), `👣 시간당 방문객 약 ${formatNumber(visitorsPerHour())}명 · 테이블 좌석 약 ${Math.round(tableOccupancy() * 100)}% 채움 (마케터를 고용하면 늘어요)`);
  }

  function renderStaffTab() {
    const cards = keyedCards($("staff-list"), D.staff, (s) => s.id, (s) => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${itemIcon(STAFF_ICON[s.id], s.emoji)}</div>
        <div class="item-info">
          <div class="item-title">${s.name} <span class="lvl-chip"></span></div>
          <div class="item-desc">${s.desc}</div>
        </div>
        <button class="btn btn-buy"></button>`;
      card.querySelector("button").addEventListener("click", () => hireStaff(s.id));
      return card;
    });
    D.staff.forEach((s, i) => {
      const owned = state.staff[s.id];
      setHtml(cards[i].querySelector(".lvl-chip"), `${owned}명`);
      setBuyButton(cards[i].querySelector("button"), { base: s.baseCost, growth: s.costGrowth, owned, label: "고용" });
    });
  }

  function renderScoutTab() {
    renderPullButtons();
    const cfg = state.ui.autoPull;
    $("auto-pull-size").value = String(cfg.sizeIdx);
    $("auto-pull-stop").value = cfg.stop;
    $("auto-pull-ticket-only").checked = cfg.ticketOnly;
    const autoOpt = D.gacha.pullOptions[cfg.sizeIdx] || D.gacha.pullOptions[1];
    $("auto-pull-start").disabled = Boolean(autoPull) || !canAffordPull(autoOpt, cfg.ticketOnly);
    $("gacha-level-chip").textContent = `Lv.${state.gachaLevel}`;
    // 뽑기 레벨 경험치 바: 현재 레벨 안에서 몇 회 뽑았는지 / 레벨업에 필요한 횟수
    const gachaMaxed = state.gachaLevel >= D.gacha.maxLevel;
    const pullsIntoLevel = state.gachaPulls - (state.gachaLevel - 1) * D.gacha.pullsPerLevel;
    $("gacha-level-fill").style.width = `${gachaMaxed ? 100 : Math.min(100, (pullsIntoLevel / D.gacha.pullsPerLevel) * 100)}%`;
    $("gacha-level-next").textContent = gachaMaxed ? "MAX" : `${pullsIntoLevel}/${D.gacha.pullsPerLevel}회`;
    const rates = gachaRarityPercents();
    setText($("gacha-level-rates"), `현재 확률 · SSR ${rates.legendary.toFixed(1)}% · SR ${rates.epic.toFixed(1)}% · R ${rates.rare.toFixed(1)}% · U ${rates.uncommon.toFixed(1)}%`);
    setText($("gacha-ticket-count"), formatNumber(state.gachaTickets || 0));
    setText($("dealer-count"), String(ownedDealerIds().length));
    setText($("dealer-bonus-total"), `+${Math.round(dealerEffectTotal("income") * 100)}%`);
    const shownRarities = mythicUnlocked() ? [...D.gacha.rarities, D.gacha.mythicRarity] : D.gacha.rarities;
    setHtml(
      $("dealer-breakdown"),
      shownRarities
        .map((r) => {
          const total = D.dealerRoster.filter((d) => d.rarity === r.id).length;
          const have = D.dealerRoster.filter((d) => d.rarity === r.id && state.dealers[d.id]).length;
          return `<span class="rarity-chip" style="--rc:${r.color}">${r.short} ${have}/${total}</span>`;
        })
        .join("")
    );
    const n = deployedIds().length;
    const synergyPct = Math.round((deploymentSynergyMultiplier() - 1) * 100);
    setText($("deploy-summary"), `🧑‍💼 편성 ${n}/${D.deployment.maxDeployed}명 · 시너지 +${synergyPct}% (도감에서 변경)`);
    renderAdButtons();
  }

  function renderPermanentTab() {
    const cards = keyedCards($("permanent-list"), D.permanentUpgrades, (p) => p.id, (p) => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${p.emoji}</div>
        <div class="item-info">
          <div class="item-title">${p.name} <span class="lvl-chip"></span></div>
          <div class="item-desc">${p.desc}</div>
        </div>
        <button class="btn btn-buy"></button>`;
      card.querySelector("button").addEventListener("click", () => buyPermanent(p.id));
      return card;
    });
    D.permanentUpgrades.forEach((p, i) => {
      const cost = permanentCost(p.id);
      setHtml(cards[i].querySelector(".lvl-chip"), `Lv.${permanentLevel(p.id)}`);
      const btn = cards[i].querySelector("button");
      setHtml(btn, `강화<small>💎${formatNumber(cost)}</small>`);
      btn.disabled = state.diamonds < cost;
    });
  }

  // ---------- 🏆 대회 탭 ----------
  function renderTournamentTab() {
    const parts = tournamentPowerParts();
    setText($("tourney-trophies"), formatNumber(state.trophies));
    setText($("tourney-power"), formatNumber(parts.total));
    setText(
      $("tourney-power-detail"),
      `편성 운영진 ${formatNumber(parts.crew)} + 매장(테이블·리모델링) ${formatNumber(parts.pub)}${parts.training > 1 ? ` · 훈련 +${Math.round((parts.training - 1) * 100)}%` : ""}`
    );

    // 참가 중인 대회 / 결과
    // 데이터에서 없어진 대회에 참가 중인 세이브는 정리해서 새 대회에 나갈 수 있게 한다
    if (state.tournament.active && !tierDef(state.tournament.active.tierId)) state.tournament.active = null;
    const a = state.tournament.active;
    const tierA = a && tierDef(a.tierId);
    let activeHtml;
    if (!tierA) {
      activeHtml = `<div class="tourney-idle">🃏 참가 중인 대회가 없어요. 아래에서 대회를 골라 출전하세요!</div>`;
    } else if (Date.now() < a.endAt) {
      const t = (Date.now() - a.startAt) / a.durationMs;
      const left = Math.max(a.place, playersLeft(tierA, t));
      activeHtml = `
        <div class="tourney-live">
          <div class="tl-head"><b>${tierA.emoji} ${tierA.name}</b><span class="tl-time">⏱ ${formatClock(a.endAt - Date.now())}</span></div>
          <div class="tl-bar"><i style="width:${Math.min(100, t * 100).toFixed(1)}%"></i></div>
          <div class="tl-info">남은 인원 <b>${formatNumber(left)}</b> / ${formatNumber(tierA.field)}명 · 우리 펍 대표 생존 중 🔥</div>
        </div>`;
    } else {
      const r = tournamentReward(a);
      const rewardParts = [`🏆${r.trophies}`];
      if (r.bb) rewardParts.push(`💰${formatChips(r.bb)}`);
      if (r.diamonds) rewardParts.push(`💎${r.diamonds}`);
      activeHtml = `
        <div class="tourney-live done place-${r.pay.id}">
          <div class="tl-head"><b>${tierA.emoji} ${tierA.name} 결과</b></div>
          <div class="tl-place">${r.pay.label}<small>${formatNumber(tierA.field)}명 중 ${a.place}위</small></div>
          <div class="tl-reward">${rewardParts.join(" · ")}${overpowerMult(a.ratio) < 1 ? '<small>너무 쉬운 대회라 보상이 줄었어요</small>' : ""}</div>
          <button class="btn btn-primary btn-wide" data-tourney-claim>보상 받기</button>
        </div>`;
    }
    setHtml($("tourney-active"), activeHtml);

    // 대회 목록 — 열림/잠김이 바뀔 때만 카드를 새로 만든다
    const power = parts.total;
    const cards = keyedCards($("tourney-list"), T.tiers, (t) => `${t.id}:${tierUnlocked(T.tiers.indexOf(t))}`, (tier) => {
      const card = document.createElement("div");
      card.className = "item-card tourney-card";
      card.innerHTML = `
        <div class="item-icon">${pngIcon(`assets/img/trophy/${tier.id}-96.png`)}</div>
        <div class="item-info">
          <div class="item-title"></div>
          <div class="item-desc"></div>
        </div>
        <button class="btn btn-buy"></button>`;
      card.querySelector("button").addEventListener("click", () => enterTournament(tier.id));
      return card;
    });
    T.tiers.forEach((tier, i) => {
      const card = cards[i];
      const unlocked = tierUnlocked(i);
      const best = state.tournament.best[tier.id];
      const btn = card.querySelector("button");
      card.classList.toggle("locked", !unlocked);
      if (!unlocked) {
        const prev = T.tiers[i - 1];
        setHtml(card.querySelector(".item-title"), `${tier.name}`);
        setHtml(card.querySelector(".item-desc"), `🔒 ${prev.name}에서 ${itmPlaces(prev)}위 안에 들면 열려요<br/>👥 ${formatNumber(tier.field)}명 · ⏱ ${tier.durationMin}분 · 추천 ⚔️${formatNumber(tier.recommended)}`);
        setHtml(btn, "잠김");
        btn.disabled = true;
        return;
      }
      const m = matchupLabel(power / tier.recommended);
      const buyIn = tournamentBuyIn(tier);
      setHtml(
        card.querySelector(".item-title"),
        `${tier.name} <span class="matchup ${m.cls}">${m.text}</span>${best ? `<span class="lvl-chip">최고 ${best}위</span>` : ""}`
      );
      setHtml(
        card.querySelector(".item-desc"),
        `👥 ${formatNumber(tier.field)}명 · ⏱ ${tier.durationMin}분 · 추천 ⚔️${formatNumber(tier.recommended)}<br/>🥇 우승 🏆${tier.trophies * T.payouts[0].trophyMult} · 💎${tier.diamonds} · 상금권 ${itmPlaces(tier)}위까지`
      );
      setHtml(btn, a ? "참가 중" : `참가<small>${formatChips(buyIn)}</small>`);
      btn.disabled = Boolean(a) || state.chips < buyIn;
    });
  }

  // ---------- 🏆 트로피 상점 ----------
  const TROPHY_SHOP_ITEMS = [...D.trophyShop.upgrades.map((u) => u.id), "ticket", "shard"];
  function renderTrophyShopTab() {
    setText($("trophy-shop-balance"), formatNumber(state.trophies));
    const cards = keyedCards($("trophy-shop-list"), TROPHY_SHOP_ITEMS, (id) => id, (id) => {
      const card = document.createElement("div");
      card.className = "item-card trophy-card";
      const up = trophyUpgradeDef(id);
      const icon = itemIcon(TROPHY_SHOP_ICON[id], up ? up.emoji : id === "ticket" ? "🎫" : "🧩");
      const name = up ? up.name : id === "ticket" ? "뽑기권 교환" : "운영진 조각 교환";
      card.innerHTML = `
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-title">${name} <span class="lvl-chip"></span></div>
          <div class="item-desc"></div>
        </div>
        <button class="btn btn-buy"></button>`;
      const btn = card.querySelector("button");
      if (up) btn.addEventListener("click", () => buyTrophyUpgrade(id));
      else if (id === "ticket") btn.addEventListener("click", buyTicketWithTrophies);
      else btn.addEventListener("click", () => openSheet("codex"));
      return card;
    });
    TROPHY_SHOP_ITEMS.forEach((id, i) => {
      const card = cards[i];
      const chip = card.querySelector(".lvl-chip");
      const desc = card.querySelector(".item-desc");
      const btn = card.querySelector("button");
      const up = trophyUpgradeDef(id);
      if (up) {
        const lv = trophyLevel(id);
        const maxed = trophyMaxed(id);
        setHtml(chip, maxed ? "MAX" : `Lv.${lv}`);
        let effect;
        if (id === "offlineHours") effect = `오프라인 최대 ${formatHours(offlineMaxSeconds())}${maxed ? "" : ` → ${formatHours(offlineMaxSeconds(lv + 1))}`}`;
        else if (id === "training") effect = `대회 전투력 +${Math.round(trophyBonus(id) * 100)}%${maxed ? "" : ` → +${Math.round(trophyBonus(id, lv + 1) * 100)}%`}`;
        else effect = `전체 수익 +${Math.round(trophyBonus(id) * 100)}% → +${Math.round(trophyBonus(id, lv + 1) * 100)}% · 리뉴얼해도 유지`;
        setHtml(desc, effect);
        const cost = trophyUpgradeCost(id);
        setHtml(btn, maxed ? "최대" : `강화<small>🏆${formatNumber(cost)}</small>`);
        btn.disabled = maxed || state.trophies < cost;
      } else if (id === "ticket") {
        const left = trophyTicketsLeft();
        setHtml(chip, `오늘 ${left}/${D.trophyShop.ticket.dailyLimit}`);
        setHtml(desc, `🏆으로 무료 뽑기권 1장 · 매일 ${D.trophyShop.ticket.dailyLimit}장까지 (보유 🎫${formatNumber(state.gachaTickets || 0)})`);
        setHtml(btn, `교환<small>🏆${D.trophyShop.ticket.cost}</small>`);
        btn.disabled = left <= 0 || state.trophies < D.trophyShop.ticket.cost;
      } else {
        const c = D.trophyShop.shardCost;
        chip.hidden = true;
        setHtml(desc, `도감에서 운영진을 눌러 원하는 사람의 승급 조각을 사요<br/>조각 1개 · N 🏆${c.common} · U ${c.uncommon} · R ${c.rare} · SR ${c.epic} · SSR ${c.legendary}`);
        setHtml(btn, "도감 열기");
      }
    });
  }

  function renderCodexTab() {
    const owned = ownedDealerIds().length;
    // 상점 전용(신화)은 구매 전까지 도감 수집 모수에서 제외 — 안 그러면 "0/11"처럼 영원히 못 채울 것처럼 보임
    const total = D.dealerRoster.filter((d) => !d.shopOnly || state.dealers[d.id]).length;
    $("codex-owned").textContent = owned;
    $("codex-total").textContent = total;
    $("codex-fill").style.width = `${((owned / total) * 100).toFixed(1)}%`;
    const readyCount = ownedDealerIds().filter((id) => canStarUp(id)).length;
    $("codex-starup-all").innerHTML = `⭐ 일괄 승급${readyCount ? ` <b>${readyCount}</b>` : ""}`;
    $("codex-starup-all").disabled = readyCount === 0;
    renderSquadStage();

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

    // 보유 → 등급 → 별 순으로, 편성 중인 운영진이 맨 앞에 오게 정렬한다(쿠키런식 목록)
    const list = D.dealerRoster
      .filter((d) => !d.shopOnly || state.dealers[d.id])
      .filter((d) => state.ui.codexFilter === "all" || d.rarity === state.ui.codexFilter)
      .map((d) => ({ d, own: state.dealers[d.id] }))
      .sort((a, b) => {
        const key = (x) =>
          (x.own ? 1000 : 0) + (isDeployed(x.d.id) ? 2000 : 0) + rarityRank(x.d.rarity) * 20 + (x.own ? x.own.star : 0);
        return key(b) - key(a);
      });
    const grid = $("codex-grid");
    grid.innerHTML = list
      .map(({ d, own }) => {
        const r = rarityDef(d.rarity) || D.gacha.mythicRarity;
        const isNew = codexNewSnapshot.includes(d.id);
        const need = own ? starUpCost(d.id) : null;
        const shardPct = own && need ? Math.min(100, (own.shards / need) * 100) : own ? 100 : 0;
        const deployed = own && isDeployed(d.id);
        const upReady = own && canStarUp(d.id);
        return `
          <div class="codex-card ${own ? "" : "locked"} ${deployed ? "deployed" : ""}" data-dealer="${d.id}" style="--rc:${r.color}">
            <span class="codex-rank">${r.short}</span>
            ${own ? `<span class="codex-star-chip">★${own.star}</span>` : ""}
            ${isNew ? '<span class="badge-new">NEW</span>' : ""}
            <img src="${DealerPortraits.url(d.id, d.rarity)}" alt="${d.name}" loading="lazy" />
            ${own ? "" : '<span class="codex-lock">🔒</span>'}
            <div class="codex-traits">${dealerTraits(d.id).map((t) => `<span title="${traitDef(t).name}">${traitIcon(t, 13)}</span>`).join("")}</div>
            <div class="codex-name">${own ? d.name : "???"}</div>
            <div class="codex-stars">${own ? starsHtml(own.star) : ""}</div>
            ${own ? `<div class="shard-bar ${upReady ? "ready" : ""}"><i style="width:${shardPct}%"></i></div>` : ""}
            ${own ? `<button class="deploy-toggle ${deployed ? "on" : ""}" data-deploy="${d.id}">${deployed ? "편성중" : "편성"}</button>` : ""}
          </div>`;
      })
      .join("");
    // 카드를 누르면 상세, 아래 띠를 누르면 바로 편성/해제
    grid.querySelectorAll("[data-dealer]").forEach((el) => el.addEventListener("click", () => openDealerModal(el.dataset.dealer)));
    grid.querySelectorAll("[data-deploy]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDeploy(btn.dataset.deploy);
        renderCodexTab();
      })
    );
  }

  // 도감 위 "편성 스테이지" — 지금 팀(프리셋)에 들어간 운영진을 10칸으로 보여준다
  function renderSquadStage() {
    const deployed = deployedIds();
    const max = D.deployment.maxDeployed;
    setText($("squad-power"), formatNumber(tournamentPower()));
    setText(
      $("squad-synergy"),
      `편성 ${deployed.length}/${max} · 시너지 +${Math.round((deploymentSynergyMultiplier() - 1) * 100)}%`
    );

    const slots = $("squad-slots");
    slots.innerHTML = Array.from({ length: max }, (_, i) => {
      const id = deployed[i];
      if (!id) return `<div class="squad-slot empty"><span>+</span></div>`;
      const def = rosterDef(id);
      const r = rarityDef(def.rarity) || D.gacha.mythicRarity;
      return `
        <button class="squad-slot" data-squad-member="${id}" style="--rc:${r.color}" title="${def.name}">
          <img src="${DealerPortraits.url(id, def.rarity)}" alt="${def.name}" />
          <span class="squad-slot-star">★${state.dealers[id].star}</span>
          <span class="squad-slot-name">${def.name}</span>
        </button>`;
    }).join("");
    slots.querySelectorAll("[data-squad-member]").forEach((el) =>
      el.addEventListener("click", () => openDealerModal(el.dataset.squadMember))
    );
    slots.querySelectorAll(".squad-slot.empty").forEach((el) =>
      el.addEventListener("click", () => toast("🧑‍💼 아래 목록에서 운영진을 눌러 편성하세요"))
    );

    // 특성 시너지 칩 — 활성화된 것부터, 미달이면 몇 명 더 필요한지 보여준다
    const counts = traitCounts(deployed);
    const tiers = D.traits.list
      .map((t) => traitTier(t.id, counts))
      .sort((a, b) => b.tier - a.tier || b.count - a.count);
    setHtml(
      $("squad-synergies"),
      tiers
        .map((s) => {
          const label = s.tier
            ? `${s.def.effectLabel} +${Math.round(s.bonus * 100)}%`
            : `${s.def.effectLabel} +${Math.round(s.next.bonus * 100)}%까지 ${s.next.need - s.count}명`;
          return `<span class="synergy-chip ${s.tier ? "on" : ""}" style="--tc:${s.def.color}" title="${s.def.name} · ${s.def.desc} · ${label}">
            ${traitIcon(s.def.id, 14)} ${s.def.name} <b>${s.count}${s.tier ? "" : `/${s.next.need}`}</b>${s.tier ? `<i class="synergy-tier">${s.tier}</i><small>+${Math.round(s.bonus * 100)}%</small>` : ""}</span>`;
        })
        .join("")
    );

    const presets = $("squad-presets");
    presets.innerHTML = Array.from({ length: D.deployment.presets }, (_, i) => {
      const n = squadCount(i);
      return `<button class="squad-preset ${i === state.activeSquad ? "active" : ""}" data-preset="${i}">${i + 1}<small>${n ? `${n}명` : "비어있음"}</small></button>`;
    }).join("");
    presets.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => setActiveSquad(Number(b.dataset.preset))));
  }

  function renderDecorTab() {
    // 테마 버튼 역할(구매 → 적용 → 등급↑)이 바뀔 때만 카드를 새로 만든다
    const themeAct = (t) => (state.theme === t.id ? "up" : state.ownedThemes.includes(t.id) ? "equip" : "buy");
    const themeCards = keyedCards($("theme-list"), D.themes, (t) => `${t.id}:${themeAct(t)}`, (t) => {
      const act = themeAct(t);
      const card = document.createElement("div");
      card.className = "theme-card" + (act === "up" ? " equipped" : "");
      card.innerHTML = `
        <div class="theme-swatch" style="background:${THEME_SWATCH_COLORS[t.id] || "#ccc"}">
          <img class="theme-thumb" src="assets/img/theme/${t.id}.png" alt="" loading="lazy" onerror="this.remove()" />
        </div>
        <div class="theme-name"></div>
        <div class="theme-cost"></div>
        <button class="btn btn-buy"></button>`;
      const btn = card.querySelector("button");
      if (act === "up") btn.addEventListener("click", () => upgradeTheme(t.id));
      else if (act === "equip") btn.addEventListener("click", () => equipTheme(t.id));
      else btn.addEventListener("click", () => buyTheme(t.id));
      return card;
    });
    D.themes.forEach((t, i) => {
      const card = themeCards[i];
      const act = themeAct(t);
      const owned = act !== "buy";
      const lv = themeLevel(t.id);
      setHtml(card.querySelector(".theme-name"), `${t.emoji} ${t.name} ${owned ? `<span class="lvl-chip">Lv.${lv}</span>` : ""}`);
      setHtml(
        card.querySelector(".theme-cost"),
        owned ? (act === "up" ? `적용중 · +${Math.round(lv * D.themeUpgrade.bonusPerLevel * 100)}% 수익` : "보유중") : `💰${formatChips(t.cost)}`
      );
      const btn = card.querySelector("button");
      if (act === "up") {
        setBuyButton(btn, { base: D.themeUpgrade.baseCost, growth: D.themeUpgrade.costGrowth, owned: lv, label: "등급↑" });
      } else if (act === "equip") {
        setHtml(btn, "적용하기");
      } else {
        setHtml(btn, `구매<small>${formatChips(t.cost)}</small>`);
        btn.disabled = state.chips < t.cost;
      }
    });

    const decorCards = keyedCards($("decor-list"), D.decor, (d) => d.id, (d) => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${d.emoji}</div>
        <div class="item-info">
          <div class="item-title">${d.name} <span class="lvl-chip"></span></div>
          <div class="item-desc"></div>
        </div>
        <button class="btn btn-buy"></button>`;
      card.querySelector("button").addEventListener("click", () => upgradeDecor(d.id));
      return card;
    });
    D.decor.forEach((d, i) => {
      const card = decorCards[i];
      const lv = state.decor[d.id] || 0;
      setHtml(card.querySelector(".lvl-chip"), `Lv.${lv}`);
      setHtml(card.querySelector(".item-desc"), `현재 +${(lv * d.bonusPerLevel * 100).toFixed(0)}% · 레벨당 +${(d.bonusPerLevel * 100).toFixed(0)}% 수익`);
      setBuyButton(card.querySelector("button"), { base: d.baseCost, growth: d.costGrowth, owned: lv, label: lv === 0 ? "설치" : "강화" });
    });
  }

  function renderPrestigeTab() {
    const step = buildingStep();
    const nextStep = BUILDING_STEPS.find((b) => b.min > state.prestige.points);
    $("prestige-building").src = `assets/img/prestige/${step.id}-256.png`;
    setText(
      $("prestige-stage"),
      `${step.name}${nextStep ? ` · 명성 ${nextStep.min}점이면 ${nextStep.name}` : " · 최고 단계"}`
    );
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
    $("sfx-volume").value = Math.round((state.settings.sfxVolume ?? 0.6) * 100);
    renderAccountInfo();
    renderBackupBox();
  }

  // 진행이 줄어든 저장이 감지되면 직전 상태가 백업된다 — 지금 진행보다 나을 때만 복구 버튼을 보여준다
  function renderBackupBox() {
    const box = $("backup-box");
    if (!box) return;
    const backup = GameBackend.getBackup ? GameBackend.getBackup() : null;
    const better = backup && (backup.lifetimeEarned || 0) > (state.lifetimeEarned || 0);
    box.hidden = !better;
    if (!better) return;
    setHtml(
      box,
      `<h4>🛟 백업 복구</h4>
       <p class="muted">이 기기에 더 많이 진행된 저장본이 남아 있어요. 지금 진행(누적 💰${formatNumber(state.lifetimeEarned)})을
       백업(누적 💰${formatNumber(backup.lifetimeEarned)})으로 되돌릴 수 있어요.</p>
       <button class="btn btn-primary btn-wide" id="restore-backup-btn">백업으로 되돌리기</button>`
    );
    $("restore-backup-btn").addEventListener("click", async () => {
      if (!window.confirm("백업 저장본으로 되돌릴까요? 지금 진행 상황은 사라집니다.")) return;
      state = mergeWithDefaults(backup);
      ensureDailyState();
      sceneDirty = true;
      await saveGame({ allowReset: true });
      toast("🛟 백업으로 되돌렸어요");
      refresh();
    });
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
        <div class="dealer-stat">트로피<b>🏆${formatNumber(state.trophies)}</b></div>
        <div class="dealer-stat">대회<b>${state.tournament.entries || 0}회 · 우승 ${state.tournament.wins || 0}</b></div>
        <div class="dealer-stat">대회 전투력<b>⚔️${formatNumber(tournamentPower())}</b></div>
        <div class="dealer-stat">오프라인 한도<b>${formatHours(offlineMaxSeconds())}</b></div>
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

    list.innerHTML = parts.join("");
    list.querySelectorAll("[data-shop]").forEach((btn) => btn.addEventListener("click", () => buyShopItem(btn.dataset.shop, btn)));
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

    const boostActive = boostIsActive("adBoost");
    const boostCooling = state.ads.boostCooldownUntil > now;
    boostBtn.disabled = boostActive || boostCooling;
    boostBtn.textContent = boostActive
      ? `🎬 수익 2배 적용중 (${formatDuration(boostActiveUntil("adBoost") - now)})`
      : boostCooling
      ? `대기 ${formatDuration(state.ads.boostCooldownUntil - now)}`
      : removed
      ? "💰 수익 2배 5분 (광고 없이)"
      : "🎬 광고보고 수익 2배";
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
    } else if (kind === "incomeBoost") {
      const b = D.boosts.adBoost;
      state.boosts.active.adBoost = Date.now() + b.durationMs;
      state.ads.boostCooldownUntil = Date.now() + D.ads.incomeBoost.cooldownMs;
      trackMission("boost"); // 광고 부스트도 "부스트 사용" 미션/퀘스트에 센다
      sceneDirty = true;
      toast(`${testPrefix}🎬 ${Math.round(b.durationMs / 60000)}분간 수익 ${b.mult}배!`);
    }
    renderAdButtons();
    refresh();
  }

  const TAB_RENDERERS = {
    tables: renderTablesTab,
    fixtures: renderFixturesTab,
    staff: renderStaffTab,
    decor: renderDecorTab,
    permanent: renderPermanentTab,
    scout: renderScoutTab,
    codex: renderCodexTab,
    tournament: renderTournamentTab,
    trophyShop: renderTrophyShopTab,
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
      occupancy: tableOccupancy(),
      tournamentWins: state.tournament.wins || 0,
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
    // 미보유여도 어떤 효과를 가진 운영진인지는 보여준다(★1 기준 수치)
    const E = D.dealerEffects;
    const equipType = E.equipByRole[def.role] || "income";
    const ownedType = ownedEffectType(dealerId);
    const equip = own ? equipEffect(dealerId) : { type: equipType, value: r.bonus * E.typeScale[equipType] };
    const owned = own ? ownedEffect(dealerId) : { type: ownedType, value: r.bonus * E.ownedScale * E.typeScale[ownedType] };
    // 특성 — 지금 편성에서 같은 특성이 몇 명인지, 다음 단계까지 몇 명 남았는지 같이 보여준다
    const counts = traitCounts();
    const traitsHtml = `
      <div class="dealer-traits">
        ${dealerTraits(dealerId)
          .map((tid) => {
            const s = traitTier(tid, counts);
            const sub = s.tier
              ? `${s.tier}단계 · ${s.def.effectLabel} +${Math.round(s.bonus * 100)}%`
              : s.next
              ? `${s.next.need - s.count}명 더 모으면 ${s.def.effectLabel} +${Math.round(s.next.bonus * 100)}%`
              : "";
            return `<span class="trait-chip ${s.tier ? "on" : ""}" style="--tc:${s.def.color}">${traitIcon(tid, 16)} ${s.def.name} <b>${s.count}</b><small>${sub}</small></span>`;
          })
          .join("")}
      </div>`;
    const effectsHtml = `
      <div class="dealer-effects">
        <div class="dealer-effect"><span class="dealer-effect-tag">보유효과</span>${effectLabel(owned)}<small>보유만 해도 적용</small></div>
        <div class="dealer-effect equip ${own && isDeployed(dealerId) ? "active" : ""}"><span class="dealer-effect-tag">장착효과</span>${effectLabel(equip)}<small>배치 중일 때 적용 · 역할 ${def.role}</small></div>
      </div>`;
    if (!own) {
      box.innerHTML = `
        <img src="${DealerPortraits.url(def.id, def.rarity)}" alt="" style="filter:brightness(.35) grayscale(1)" />
        <h3>??? <span style="color:${r.color}">${r.short}</span></h3>
        <p class="dealer-quote">아직 만나지 못한 운영진이에요.<br/>가챠로 영입해보세요!</p>
        ${traitsHtml}
        ${effectsHtml}`;
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
        <div class="dealer-stat">승급<b>${starsHtml(own.star)}</b></div>
        <div class="dealer-stat">별<b>★${own.star} / ${D.dealerStar.maxStar}</b></div>
      </div>
      ${traitsHtml}
      ${effectsHtml}
      <button class="deploy-toggle ${isDeployed(dealerId) ? "on" : ""}" id="dealer-modal-deploy-btn" style="width:100%;margin-bottom:8px;padding:8px 0;font-size:12px">${isDeployed(dealerId) ? "✅ 편성 중 (탭하면 해제)" : "🧑‍💼 편성하기"}</button>
      ${
        need === null
          ? '<div class="mission-allclear">⭐ 최고 등급까지 승급했어요!</div>'
          : `<div class="mission-allclear">조각 ${own.shards} / ${need}<div class="shard-bar" style="margin-top:6px"><i style="width:${Math.min(100, (own.shards / need) * 100)}%"></i></div></div>
             <div class="dealer-modal-actions">
               <button class="btn btn-buy" id="shard-trophy-btn" ${state.trophies >= shardTrophyCost(dealerId) ? "" : "disabled"}>🧩 조각 +1<small>🏆${shardTrophyCost(dealerId)} · 보유 ${formatNumber(state.trophies)}</small></button>
               <button class="btn btn-primary" id="star-up-btn" ${canUp ? "" : "disabled"}>★${own.star + 1} 승급하기</button>
             </div>`
      }`;
    const upBtn = $("star-up-btn");
    if (upBtn) upBtn.addEventListener("click", () => starUp(dealerId));
    const shardBtn = $("shard-trophy-btn");
    if (shardBtn) shardBtn.addEventListener("click", () => buyShardWithTrophies(dealerId));
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
    if (info.type === "tournament") return openSheet("tournament");
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
  const groupOfTab = (tab) => Object.keys(NAV_GROUPS).find((g) => NAV_GROUPS[g].tabs.some(([id]) => id === tab)) || null;

  // 세부 탭 칩은 시트를 열거나 세부 탭을 바꿀 때만 새로 만든다(주기 갱신에서 다시 만들지 않아 탭이 씹히지 않음)
  function renderSubtabs(group, tabName) {
    const wrap = $("sheet-subtabs");
    const tabs = group ? NAV_GROUPS[group].tabs : [];
    const multi = tabs.length > 1;
    wrap.hidden = !multi;
    $("sheet-title").hidden = multi;
    $("sheet-title").textContent = group ? NAV_GROUPS[group].title : STANDALONE_TITLES[tabName] || "";
    if (!multi) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = tabs
      .map(([id, label]) => `<button class="subtab ${id === tabName ? "active" : ""}" data-sub="${id}" role="tab">${label}<span class="dot"></span></button>`)
      .join("");
    wrap.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.sub)));
    const active = wrap.querySelector(".subtab.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function openSheet(tabName) {
    const group = groupOfTab(tabName);
    activeTab = tabName;
    sheetOpen = true;
    if (group) state.ui.lastSub[group] = tabName;
    document.querySelectorAll(".bottom-nav .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.group === group));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
    renderSubtabs(group, tabName);
    $("sheet-qty-row").hidden = !QTY_TABS.has(tabName);
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
    refreshDots();
  }
  function openGroup(group) {
    const tabs = NAV_GROUPS[group].tabs.map(([id]) => id);
    const last = state.ui.lastSub[group];
    openSheet(tabs.includes(last) ? last : tabs[0]);
  }
  function closeSheet() {
    sheetOpen = false;
    document.querySelectorAll(".bottom-nav .tab-btn").forEach((b) => b.classList.remove("active"));
    $("sheet-panel").classList.remove("open");
    $("sheet-panel").setAttribute("aria-hidden", "true");
    $("sheet-backdrop").classList.remove("open");
    document.body.classList.remove("sheet-open");
  }

  function setupTabs() {
    // data-group: 네비 묶음(마지막으로 본 세부 탭을 연다) / data-tab: 특정 탭 — 이미 열려 있으면 닫는다
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { group, tab } = btn.dataset;
        if (group) {
          if (sheetOpen && groupOfTab(activeTab) === group) closeSheet();
          else openGroup(group);
        } else if (tab) {
          if (sheetOpen && activeTab === tab) closeSheet();
          else openSheet(tab);
        }
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
  }

  // ============================================================
  // 저장 / 오프라인
  // ============================================================
  // 저장이 계속 실패하면(네트워크 등) 한 번은 알려준다. 진행 자체는 이 기기 로컬에도 남는다.
  let saveFailStreak = 0;
  let saveWarned = false;
  async function saveGame(options) {
    const res = await GameBackend.saveState(state, options);
    if (res && res.ok) {
      saveFailStreak = 0;
      return res;
    }
    // 불러오기가 어긋나 새 게임 상태로 덮어쓸 뻔한 경우 — 덮어쓰지 않고 새로고침을 안내한다
    if (res && res.error && String(res.error).startsWith("fresh state")) {
      if (!saveWarned) {
        saveWarned = true;
        toast("⚠️ 저장 데이터를 못 불러왔어요. 새로고침하면 진행이 돌아옵니다 (덮어쓰지 않았어요)");
      }
      return res;
    }
    saveFailStreak += 1;
    if (saveFailStreak >= 3 && !saveWarned) {
      saveWarned = true;
      toast("⚠️ 클라우드 저장이 안 되고 있어요. 네트워크를 확인해주세요 (진행은 이 기기에 저장 중)");
    }
    return res;
  }

  async function loadGameAndComputeOffline() {
    const res = await GameBackend.loadState();
    if (!(res.ok && res.state)) return;
    const loaded = res.state;
    // 패치로 전 계정 데이터를 초기화해야 할 때 D.dataResetVersion을 올린다 — 그보다 낮은 버전의 세이브는
    // 버리고 새로 시작하며, 다음 자동 저장 때 클라우드도 새 데이터로 덮어써진다(로그인 계정은 유지).
    if ((loaded.dataResetVersion || 0) < D.dataResetVersion) {
      state = defaultState();
      ensureDailyState();
      await GameBackend.saveState(state, { allowReset: true });
      setTimeout(() => toast("🔄 업데이트로 게임 데이터가 초기화됐어요. 새로 시작해요!"), 800);
      return;
    }
    state = mergeWithDefaults(loaded);
    const savedAt = loaded.savedAt || Date.now();
    const awaySec = Math.max(0, (Date.now() - savedAt) / 1000);
    // 오프라인 수익은 최대 시간(처음 2시간, 트로피 상점 "영업시간 연장"으로 증가)까지만 인정한다
    const elapsedSec = Math.min(awaySec, offlineMaxSeconds());
    if (elapsedSec <= 20) return;
    // 오프라인 동안에는 부스트가 걸리지 않은 상태로 계산한다
    const savedActive = state.boosts.active;
    state.boosts.active = {};
    const gain = incomePerSecond() * elapsedSec * offlineEfficiency();
    state.boosts.active = savedActive;
    if (gain > 0) {
      addChips(gain);
      showOfflineModal(gain, elapsedSec, awaySec);
    }
  }

  function showOfflineModal(gain, elapsedSec, awaySec) {
    const label = (sec) => (sec < 3600 ? `${Math.round(sec / 60)}분` : `${(sec / 3600).toFixed(1)}시간`);
    const capped = awaySec > elapsedSec + 60;
    $("offline-text").innerHTML =
      `${label(elapsedSec)} 동안<br/><b>💰 ${formatChips(gain)}</b><br/>` +
      `<span class="muted">오프라인 효율 ${Math.round(offlineEfficiency() * 100)}% · 최대 ${formatHours(offlineMaxSeconds())}</span>` +
      (capped
        ? `<br/><span class="offline-cap">⏰ ${label(awaySec)} 자리를 비웠지만 ${formatHours(offlineMaxSeconds())}까지만 벌었어요.<br/>🏆 트로피 상점 "영업시간 연장"으로 늘릴 수 있어요</span>`
        : "");
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
    tickTournament();
    tickDiamondBubble();
    checkProfileLevelReward();
    ensureDailyState();

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
      window.PubScene3D.onDiamondBubble = collectDiamondBubble;
    }

    await loadGameAndComputeOffline();
    ensureDailyState();
    if (window.Sfx) window.Sfx.setVolume(state.settings.sfxVolume ?? 0.6);
    applyStaticAssets();
    setupControlBar();

    // 시트 내부 액션
    $("buy-table-btn").addEventListener("click", () => buyTable());
    $("upgrade-table-btn").addEventListener("click", () => upgradeTable());
    $("expand-store-btn").addEventListener("click", () => expandStore());
    $("prestige-btn").addEventListener("click", doPrestige);
    setupPullButtons();
    // 연속 뽑기 설정
    $("auto-pull-size").addEventListener("change", (e) => {
      state.ui.autoPull.sizeIdx = Number(e.target.value);
      renderScoutTab();
    });
    $("auto-pull-stop").addEventListener("change", (e) => {
      state.ui.autoPull.stop = e.target.value;
    });
    $("auto-pull-ticket-only").addEventListener("change", (e) => {
      state.ui.autoPull.ticketOnly = e.target.checked;
      renderScoutTab();
    });
    $("auto-pull-start").addEventListener("click", startAutoPull);
    $("gacha-again").addEventListener("click", onGachaAgain);
    $("gacha-close").addEventListener("click", closeGachaModal);
    // 대회 결과 "보상 받기"(0.5초마다 다시 그려지는 영역이라 위임으로 받는다) · HUD 대회 알약 → 대회 탭
    $("tourney-active").addEventListener("click", (e) => {
      if (e.target.closest("[data-tourney-claim]")) claimTournament();
    });
    $("boost-strip").addEventListener("click", (e) => {
      if (e.target.closest(".tourney-pill")) openSheet("tournament");
    });
    $("codex-starup-all").addEventListener("click", starUpAll);
    $("codex-quick-deploy").addEventListener("click", quickDeploy);
    $("ad-free-pull-btn").addEventListener("click", () => watchAdFor("dailyFreePull"));
    $("ad-upgrade-boost-btn").addEventListener("click", () => watchAdFor("incomeBoost"));

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
    $("prestige-badge").addEventListener("click", () => (sheetOpen && activeTab === "prestige" ? closeSheet() : openSheet("prestige")));
    $("quest-claim").addEventListener("click", (e) => {
      e.stopPropagation();
      claimQuest();
    });
    $("quest-banner").addEventListener("click", goToQuest);

    // 모달 닫기
    const closers = [
      ["offline-close", "offline-modal"],
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
        if (e.target !== m) return;
        if (m.id === "gacha-modal") closeGachaModal(); // 연속 뽑기 중이면 같이 멈춘다
        else m.classList.add("hidden");
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
    $("sfx-volume").addEventListener("input", (e) => {
      state.settings.sfxVolume = Number(e.target.value) / 100;
      window.Sfx.setVolume(state.settings.sfxVolume);
    });
    // 슬라이더에서 손을 뗄 때 한 번 들려주고 저장한다
    $("sfx-volume").addEventListener("change", () => {
      sfx("buy");
      saveGame();
    });

    sceneDirty = true;
    refresh();

    lastTickAt = Date.now();
    setInterval(tick, D.tick.intervalMs);
    setInterval(() => saveGame(), D.tick.autosaveMs);
    // 모바일 사파리는 beforeunload가 안 뜨는 경우가 많아 pagehide에서도 저장한다
    window.addEventListener("beforeunload", () => saveGame());
    window.addEventListener("pagehide", () => saveGame());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveGame();
      else lastTickAt = Date.now();
    });

    // 업그레이드 버튼을 연타하다 화면이 통째로 확대되는 문제 방지
    // (iOS는 viewport의 user-scalable=no를 무시한다 — CSS touch-action + 여기서 제스처/더블탭 차단)
    ["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
    );
    // 버튼·카드는 CSS의 touch-action:manipulation이 더블탭 확대를 막는다(연타가 씹히면 안 되니 여기선 건드리지 않음).
    // 그 바깥(빈 여백 등)에서만 더블탭을 막는다 — 옛 iOS는 touch-action을 무시하기 때문.
    const TAPPABLE = "button, a, input, select, textarea, label, .btn, .item-card, .codex-card, .squad-slot, .subtab, .tab-btn";
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 320 && !(e.target.closest && e.target.closest(TAPPABLE))) e.preventDefault();
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  // 로그인 게이트(auth-gate.js)가 로그인 성공을 확인한 뒤에만 게임을 시작시킨다.
  window.HoldemGame = { start: init };
})();

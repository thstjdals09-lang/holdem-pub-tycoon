// 홀덤펍 키우기 - 메인 게임 로직
(() => {
  const D = GAME_DATA;

  // 인테리어 상점 카드용 미리보기 색상 (실제 3D 색상은 scene3d.js THEMES와 맞춰둠)
  const THEME_SWATCH_COLORS = {
    classic: "linear-gradient(135deg, #f3c988, #ffd3e6)",
    princess: "linear-gradient(135deg, #ffd9ec, #ffb3d9)",
    european: "linear-gradient(135deg, #c9a876, #7a5a3f)",
    neon: "linear-gradient(135deg, #2a1a3a, #ff2fd0)",
  };

  const defaultState = (overrides = {}) => ({
    chips: 20,
    totalEarned: 0,
    diamonds: overrides.diamonds ?? 0,
    tables: 1,
    tableLevel: 0,
    store: { expansions: 0 },
    fixtures: Object.fromEntries(D.fixtures.map((f) => [f.id, 0])),
    staff: Object.fromEntries(D.staff.map((s) => [s.id, 0])),
    dealers: overrides.dealers ?? [],
    decor: Object.fromEntries(D.decor.map((d) => [d.id, false])),
    theme: overrides.theme ?? "classic",
    ownedThemes: overrides.ownedThemes ?? ["classic"],
    giftReadyAt: overrides.giftReadyAt ?? Date.now(),
    prestige: overrides.prestige ?? { points: 0 },
    settings: { showTableIncome: true },
  });

  let state = defaultState();
  let lastTickAt = Date.now();
  let dirty = true;

  // 저장된 데이터에 새 필드(신규 시설/직원 등)가 없어도 기본값으로 채워준다.
  const mergeWithDefaults = (saved) => {
    const base = defaultState();
    // 예전 버전(칩으로 고용하는 딜러)의 세이브를 새 다이아 가챠 딜러 컬렉션으로 자연스럽게 옮겨준다.
    let dealers = base.dealers;
    if (Array.isArray(saved.dealers)) {
      dealers = saved.dealers;
    } else if (saved.staff && saved.staff.dealer > 0) {
      const commonBonus = D.gacha.rarities.find((r) => r.id === "common").bonus;
      dealers = Array.from({ length: saved.staff.dealer }, () => ({ rarity: "common", bonus: commonBonus }));
    }
    const { dealer: _oldDealerCount, ...restSavedStaff } = saved.staff || {};
    return {
      ...base,
      ...saved,
      store: { ...base.store, ...saved.store },
      fixtures: { ...base.fixtures, ...saved.fixtures },
      staff: { ...base.staff, ...restSavedStaff },
      decor: { ...base.decor, ...saved.decor },
      settings: { ...base.settings, ...saved.settings },
      ownedThemes: Array.isArray(saved.ownedThemes) ? saved.ownedThemes : base.ownedThemes,
      dealers,
    };
  };

  // ---------- 비용/수치 계산 ----------
  const costFor = (base, growth, count) => Math.ceil(base * Math.pow(growth, count));

  const tableCost = () => costFor(D.table.baseCost, D.table.costGrowth, state.tables - 1);
  const tableUpgradeCost = () => costFor(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel);
  const staffDef = (id) => D.staff.find((s) => s.id === id);
  const staffCost = (id) => {
    const def = staffDef(id);
    return costFor(def.baseCost, def.costGrowth, state.staff[id]);
  };

  const tableCapacity = () => D.store.baseCapacity + state.store.expansions * D.store.capacityPerExpansion;
  const expansionCost = () => costFor(D.store.expansionBaseCost, D.store.expansionCostGrowth, state.store.expansions);
  const fixtureDef = (id) => D.fixtures.find((f) => f.id === id);
  const fixtureCost = (id) => {
    const def = fixtureDef(id);
    return costFor(def.baseCost, def.costGrowth, state.fixtures[id]);
  };

  // 명성 포인트 N점을 얻으려면 baseRequirement * N^2 칩이 누적으로 필요 (역함수: sqrt)
  const prestigeRequirement = (forPoints = state.prestige.points + 1) =>
    Math.round(D.prestige.baseRequirement * forPoints * forPoints);

  const potentialPrestigePoints = () => {
    if (state.totalEarned < D.prestige.baseRequirement) return 0;
    return Math.floor(Math.sqrt(state.totalEarned / D.prestige.baseRequirement));
  };

  const prestigeMultiplier = (points = state.prestige.points) => 1 + points * D.prestige.pointBonus;

  const dealerBonusSum = () => state.dealers.reduce((sum, d) => sum + d.bonus, 0);

  const incomeMultiplier = () => {
    let mult = 1;
    D.staff.forEach((s) => {
      if (s.effect.type === "incomeMult") mult += s.effect.value * state.staff[s.id];
    });
    mult += dealerBonusSum();
    D.decor.forEach((d) => {
      if (state.decor[d.id]) mult += d.bonus;
    });
    mult *= prestigeMultiplier();
    return mult;
  };

  const fixtureIncome = () => {
    let income = 0;
    D.fixtures.forEach((f) => {
      if (f.incomePerLevel) income += f.incomePerLevel * state.fixtures[f.id];
    });
    return income;
  };

  // 테이블 한 개가 버는 초당 수익 (3D 씬에 테이블별로 표시됨)
  const perTableIncome = () => D.table.baseIncome * (1 + state.tableLevel * D.tableUpgrade.bonusPerLevel) * incomeMultiplier();

  const incomePerSecond = () => state.tables * perTableIncome() + fixtureIncome() * incomeMultiplier();

  const diamondPerSecond = () => {
    const vaultLevel = state.fixtures.vault || 0;
    return D.diamond.baseRatePerTableSecond * state.tables * (1 + vaultLevel * D.diamond.vaultBonusPerLevel) * prestigeMultiplier();
  };

  const offlineEfficiency = () => {
    let eff = D.offline.baseEfficiency;
    D.staff.forEach((s) => {
      if (s.effect.type === "offline") eff += s.effect.value * state.staff[s.id];
    });
    return Math.min(D.offline.maxEfficiency, eff);
  };

  // ---------- 액션 ----------
  const addChips = (amount) => {
    state.chips += amount;
    state.totalEarned += amount;
  };
  const addDiamonds = (amount) => {
    state.diamonds += amount;
  };

  const buyTable = () => {
    if (state.tables >= tableCapacity()) return;
    const cost = tableCost();
    if (state.chips < cost) return;
    state.chips -= cost;
    state.tables += 1;
    dirty = true;
    render();
    toast(`🃏 테이블 ${state.tables}번 오픈!`);
    if (window.PubScene3D) window.PubScene3D.chipBurst();
  };

  const expandStore = () => {
    const cost = expansionCost();
    if (state.chips < cost) return;
    state.chips -= cost;
    state.store.expansions += 1;
    dirty = true;
    render();
    toast(`🏗 매장을 확장했어요! 테이블 슬롯 +${D.store.capacityPerExpansion}`);
  };

  const upgradeFixture = (id) => {
    const cost = fixtureCost(id);
    if (state.chips < cost) return;
    const def = fixtureDef(id);
    state.chips -= cost;
    state.fixtures[id] += 1;
    dirty = true;
    render();
    toast(`${def.emoji} ${def.name} ${state.fixtures[id] === 1 ? "설치" : `Lv.${state.fixtures[id]}로 업그레이드`} 완료!`);
  };

  const upgradeTable = () => {
    const cost = tableUpgradeCost();
    if (state.chips < cost) return;
    state.chips -= cost;
    state.tableLevel += 1;
    dirty = true;
    render();
    toast(`테이블 리모델링! (Lv.${state.tableLevel})`);
  };

  const hireStaff = (id) => {
    const cost = staffCost(id);
    if (state.chips < cost) return;
    state.chips -= cost;
    state.staff[id] += 1;
    dirty = true;
    render();
    toast(`${staffDef(id).emoji} ${staffDef(id).name} 고용! (총 ${state.staff[id]}명)`);
  };

  const buyDecor = (id) => {
    const def = D.decor.find((d) => d.id === id);
    if (state.decor[id] || state.chips < def.cost) return;
    state.chips -= def.cost;
    state.decor[id] = true;
    dirty = true;
    render();
    toast(`${def.emoji} ${def.name} 설치 완료!`);
  };

  const themeDef = (id) => D.themes.find((t) => t.id === id);
  const buyTheme = (id) => {
    const def = themeDef(id);
    if (!def || state.ownedThemes.includes(id) || state.chips < def.cost) return;
    state.chips -= def.cost;
    state.ownedThemes.push(id);
    state.theme = id;
    dirty = true;
    render();
    toast(`${def.emoji} ${def.name} 테마 구매 완료!`);
  };
  const equipTheme = (id) => {
    if (!state.ownedThemes.includes(id) || state.theme === id) return;
    state.theme = id;
    dirty = true;
    render();
    const def = themeDef(id);
    toast(`${def.emoji} ${def.name} 테마 적용!`);
  };

  const isGiftReady = () => Date.now() >= state.giftReadyAt;
  const openGift = () => {
    if (!isGiftReady()) {
      const remainMs = state.giftReadyAt - Date.now();
      const mins = Math.ceil(remainMs / 60000);
      toast(`🎁 다음 선물까지 ${mins}분 남았어요`);
      return;
    }
    const chipGain = Math.max(10, incomePerSecond() * 60 * D.gift.chipMinutes);
    const diaGain = D.gift.diamondMin + Math.floor(Math.random() * (D.gift.diamondMax - D.gift.diamondMin + 1));
    addChips(chipGain);
    addDiamonds(diaGain);
    state.giftReadyAt = Date.now() + D.gift.cooldownMs;
    render();
    document.getElementById("event-text").textContent = `칩 ${formatChips(chipGain)}과 다이아 ${diaGain}개를 받았어요!`;
    document.getElementById("event-modal").classList.remove("hidden");
    if (window.PubScene3D) window.PubScene3D.chipBurst();
  };

  const weightedRandomRarity = () => {
    const total = D.gacha.rarities.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of D.gacha.rarities) {
      if (roll < r.weight) return r;
      roll -= r.weight;
    }
    return D.gacha.rarities[D.gacha.rarities.length - 1];
  };

  const pullGacha = () => {
    const cost = D.gacha.costDiamonds;
    if (state.diamonds < cost) return;
    state.diamonds -= cost;
    const rarity = weightedRandomRarity();
    state.dealers.push({ rarity: rarity.id, bonus: rarity.bonus });
    dirty = true;
    render();
    showGachaModal(rarity);
    if (window.PubScene3D) window.PubScene3D.chipBurst(rarity.color);
  };

  const doPrestige = () => {
    const gain = potentialPrestigePoints();
    if (gain <= state.prestige.points) return;
    if (!window.confirm(`정말 브랜드를 리뉴얼할까요?\n테이블/직원/칩이 초기화되고, 명성 포인트가 ${gain}점이 됩니다.`)) return;
    const diamondReward = D.diamond.prestigeReward * gain;
    state = defaultState({
      prestige: { points: gain },
      diamonds: state.diamonds + diamondReward,
      dealers: state.dealers,
      theme: state.theme,
      ownedThemes: state.ownedThemes,
      giftReadyAt: state.giftReadyAt,
    });
    dirty = true;
    render();
    toast(`✨ 브랜드 리뉴얼 완료! 명성 포인트 ${gain}점 · 💎+${diamondReward}`);
  };

  const resetGame = async () => {
    if (!window.confirm("정말 모든 진행 상황을 초기화할까요? 되돌릴 수 없어요.")) return;
    state = defaultState();
    await GameBackend.resetState();
    dirty = true;
    render();
    toast("초기화 완료");
  };

  // ---------- 표시용 포맷 ----------
  const numberUnits = [
    { val: 1e16, label: "경" },
    { val: 1e12, label: "조" },
    { val: 1e8, label: "억" },
    { val: 1e4, label: "만" },
  ];
  const formatNumber = (n) => {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString("ko-KR");
    for (const u of numberUnits) {
      if (n >= u.val) {
        return (n / u.val).toFixed(2).replace(/\.00$/, "") + u.label;
      }
    }
    return n.toLocaleString("ko-KR");
  };
  const formatChips = (n) => `${formatNumber(n)} 칩`;

  // 초당 수익처럼 1보다 작을 수 있는 값은 반올림해도 0으로 보이지 않게 소수 1자리 유지
  const formatRate = (n) => {
    if (n < 100) {
      return (Math.round(n * 10) / 10).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return formatNumber(n);
  };

  // ---------- 이펙트: 토스트 / 모달 ----------
  const toast = (msg) => {
    const wrap = document.getElementById("toast-wrap");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  function showGachaModal(rarity) {
    const modal = document.getElementById("gacha-modal");
    const box = document.getElementById("gacha-result-box");
    box.style.setProperty("--rarity-color", rarity.color);
    document.getElementById("gacha-result-emoji").textContent = rarity.emoji;
    document.getElementById("gacha-result-name").textContent = `${rarity.name} 딜러 획득!`;
    document.getElementById("gacha-result-bonus").textContent = `테이블 수익 +${Math.round(rarity.bonus * 100)}%`;
    modal.classList.remove("hidden");
  }

  // 3D 씬에서 테이블/시설을 탭했을 때 뜨는 업그레이드 팝업
  let popupAction = null;
  function openContextPopup({ title, bodyHtml, actionLabel, actionDisabled, onAction }) {
    document.getElementById("context-popup-title").textContent = title;
    document.getElementById("context-popup-desc").innerHTML = bodyHtml;
    const btn = document.getElementById("context-popup-action");
    btn.textContent = actionLabel;
    btn.disabled = !!actionDisabled;
    popupAction = onAction;
    document.getElementById("context-popup").classList.remove("hidden");
  }
  function closeContextPopup() {
    document.getElementById("context-popup").classList.add("hidden");
    popupAction = null;
  }
  function handleSceneTap(info) {
    if (info.type === "buyTable") {
      const capacity = tableCapacity();
      if (state.tables >= capacity) {
        toast("🏗 매장이 가득 찼어요! 매장 탭에서 확장해보세요");
        return;
      }
      openContextPopup({
        title: "🃏 새 테이블 추가",
        bodyHtml: `빈 자리에 새 홀덤 테이블을 놓을까요?<br/>예상 수익: <b>${formatChips(perTableIncome())}/초</b>`,
        actionLabel: `테이블 추가 (${formatChips(tableCost())})`,
        actionDisabled: state.chips < tableCost(),
        onAction: buyTable,
      });
    } else if (info.type === "table") {
      openContextPopup({
        title: "🃏 테이블 강화",
        bodyHtml: `이 테이블은 <b>${formatChips(perTableIncome())}/초</b>를 벌고 있어요.<br/>현재 리모델링 레벨: <b>Lv.${state.tableLevel}</b>`,
        actionLabel: `전체 테이블 강화 (${formatChips(tableUpgradeCost())})`,
        actionDisabled: state.chips < tableUpgradeCost(),
        onAction: upgradeTable,
      });
    } else if (info.type === "fixture") {
      const f = fixtureDef(info.id);
      if (!f) return;
      const cost = fixtureCost(info.id);
      const level = state.fixtures[info.id];
      openContextPopup({
        title: `${f.emoji} ${f.name}`,
        bodyHtml: `${f.desc}<br/>현재 레벨: <b>Lv.${level}</b>`,
        actionLabel: `${level === 0 ? "설치" : "업그레이드"} (${formatChips(cost)})`,
        actionDisabled: state.chips < cost,
        onAction: () => upgradeFixture(info.id),
      });
    }
  }

  // ---------- 렌더링 ----------
  function renderScene() {
    if (!window.PubScene3D) return;
    window.PubScene3D.update({
      tables: state.tables,
      capacity: tableCapacity(),
      maxShown: D.store.maxShownSlots,
      fixtures: state.fixtures,
      staff: state.staff,
      decor: state.decor,
      dealerCount: state.dealers.length,
      perTableIncome: perTableIncome(),
      showTableIncome: state.settings.showTableIncome,
      seatsMin: D.table.seatsMin,
      seatsMax: D.table.seatsMax,
      theme: state.theme,
    });
  }

  function renderHeader() {
    document.getElementById("chips-value").textContent = formatNumber(state.chips);
    document.getElementById("diamonds-value").textContent = formatNumber(state.diamonds);
    document.getElementById("income-value").textContent = `${formatRate(incomePerSecond())} / 초`;
    document.getElementById("prestige-badge").textContent = `✨ x${prestigeMultiplier().toFixed(2)}`;
    document.getElementById("event-dot").classList.toggle("show", isGiftReady());
  }

  function renderTablesTab() {
    const capacity = tableCapacity();
    document.getElementById("table-count").textContent = state.tables;
    document.getElementById("table-capacity").textContent = capacity;
    document.getElementById("table-level").textContent = state.tableLevel;
    document.getElementById("table-per-income").textContent = formatRate(perTableIncome());

    const buyBtn = document.getElementById("buy-table-btn");
    const atCapacity = state.tables >= capacity;
    const cost = tableCost();
    if (atCapacity) {
      buyBtn.querySelector("small").textContent = "매장 확장 필요";
      buyBtn.disabled = true;
    } else {
      buyBtn.querySelector("small").textContent = `${formatChips(cost)}`;
      buyBtn.disabled = state.chips < cost;
    }

    const upBtn = document.getElementById("upgrade-table-btn");
    const upCost = tableUpgradeCost();
    upBtn.querySelector("small").textContent = `${formatChips(upCost)}`;
    upBtn.disabled = state.chips < upCost;
  }

  function renderStoreTab() {
    const capacity = tableCapacity();
    document.getElementById("store-capacity").textContent = capacity;
    const expandBtn = document.getElementById("expand-store-btn");
    const expandCost = expansionCost();
    expandBtn.querySelector("small").textContent = `${formatChips(expandCost)}`;
    expandBtn.disabled = state.chips < expandCost;

    const wrap = document.getElementById("fixture-list");
    wrap.innerHTML = "";
    D.fixtures.forEach((f) => {
      const cost = fixtureCost(f.id);
      const level = state.fixtures[f.id];
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${f.emoji}</div>
        <div class="item-info">
          <div class="item-title">${f.name} <span class="muted">(Lv.${level})</span></div>
          <div class="item-desc">${f.desc}</div>
        </div>
        <button class="btn btn-buy" ${state.chips < cost ? "disabled" : ""}>${level === 0 ? "설치" : "업그레이드"}<br/><small>${formatChips(cost)}</small></button>
      `;
      card.querySelector("button").addEventListener("click", () => upgradeFixture(f.id));
      wrap.appendChild(card);
    });
  }

  function renderStaffTab() {
    const wrap = document.getElementById("staff-list");
    wrap.innerHTML = "";
    D.staff.forEach((s) => {
      const cost = staffCost(s.id);
      const owned = state.staff[s.id];
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${s.emoji}</div>
        <div class="item-info">
          <div class="item-title">${s.name} <span class="muted">(보유 ${owned}명)</span></div>
          <div class="item-desc">${s.desc}</div>
        </div>
        <button class="btn btn-buy" ${state.chips < cost ? "disabled" : ""}>고용<br/><small>${formatChips(cost)}</small></button>
      `;
      card.querySelector("button").addEventListener("click", () => hireStaff(s.id));
      wrap.appendChild(card);
    });

    const cost = D.gacha.costDiamonds;
    document.getElementById("gacha-cost").textContent = formatNumber(cost);
    document.getElementById("gacha-pull-btn").disabled = state.diamonds < cost;
    document.getElementById("dealer-count").textContent = state.dealers.length;
    document.getElementById("dealer-bonus-total").textContent = `+${Math.round(dealerBonusSum() * 100)}%`;
    const breakdown = document.getElementById("dealer-breakdown");
    breakdown.innerHTML = D.gacha.rarities
      .map((r) => {
        const count = state.dealers.filter((d) => d.rarity === r.id).length;
        return `<span class="rarity-chip" style="--rc:${r.color}">${r.emoji} ${r.name} x${count}</span>`;
      })
      .join("");
  }

  function renderDecorTab() {
    const themeWrap = document.getElementById("theme-list");
    themeWrap.innerHTML = "";
    D.themes.forEach((t) => {
      const owned = state.ownedThemes.includes(t.id);
      const equipped = state.theme === t.id;
      const card = document.createElement("div");
      card.className = "theme-card" + (equipped ? " equipped" : "");
      card.innerHTML = `
        <div class="theme-swatch" style="background:${THEME_SWATCH_COLORS[t.id] || "#ccc"}"></div>
        <div class="theme-name">${t.emoji} ${t.name}</div>
        <div class="theme-cost">${owned ? (equipped ? "적용중" : "보유중") : formatChips(t.cost)}</div>
        ${
          equipped
            ? `<button class="btn btn-owned" disabled>적용중 ✅</button>`
            : owned
            ? `<button class="btn btn-buy">적용하기</button>`
            : `<button class="btn btn-buy" ${state.chips < t.cost ? "disabled" : ""}>구매</button>`
        }
      `;
      if (!equipped) {
        card.querySelector("button").addEventListener("click", () => (owned ? equipTheme(t.id) : buyTheme(t.id)));
      }
      themeWrap.appendChild(card);
    });

    const wrap = document.getElementById("decor-list");
    wrap.innerHTML = "";
    D.decor.forEach((d) => {
      const owned = state.decor[d.id];
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-icon">${d.emoji}</div>
        <div class="item-info">
          <div class="item-title">${d.name}</div>
          <div class="item-desc">${d.desc}</div>
        </div>
        ${
          owned
            ? `<button class="btn btn-owned" disabled>설치됨 ✅</button>`
            : `<button class="btn btn-buy" ${state.chips < d.cost ? "disabled" : ""}>구매<br/><small>${formatChips(d.cost)}</small></button>`
        }
      `;
      if (!owned) card.querySelector("button").addEventListener("click", () => buyDecor(d.id));
      wrap.appendChild(card);
    });
  }

  function renderPrestigeTab() {
    document.getElementById("prestige-total-earned").textContent = formatNumber(state.totalEarned);
    document.getElementById("prestige-requirement").textContent = formatNumber(prestigeRequirement());
    const gain = potentialPrestigePoints();
    document.getElementById("prestige-gain").textContent = gain;
    document.getElementById("prestige-current-mult").textContent = `x${prestigeMultiplier().toFixed(2)}`;
    document.getElementById("prestige-next-mult").textContent = `x${prestigeMultiplier(Math.max(gain, state.prestige.points)).toFixed(2)}`;
    document.getElementById("prestige-diamond-reward").textContent = D.diamond.prestigeReward * gain;
    const btn = document.getElementById("prestige-btn");
    btn.disabled = gain <= state.prestige.points;
  }

  function renderSettingsTab() {
    document.getElementById("show-table-income-toggle").checked = state.settings.showTableIncome;
  }

  function render() {
    renderHeader();
    renderStoreTab();
    renderTablesTab();
    renderStaffTab();
    renderDecorTab();
    renderPrestigeTab();
    renderSettingsTab();
    if (dirty) {
      renderScene();
      dirty = false;
    }
  }

  // ---------- 탭 전환 / 하단 시트 ----------
  function openSheet(tabName, titleText) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
    document.getElementById("sheet-title").textContent = titleText;
    document.getElementById("sheet-panel").classList.add("open");
    document.getElementById("sheet-backdrop").classList.add("open");
  }
  function closeSheet() {
    document.getElementById("sheet-panel").classList.remove("open");
    document.getElementById("sheet-backdrop").classList.remove("open");
  }
  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const isOpen = document.getElementById("sheet-panel").classList.contains("open");
        const isSame = btn.classList.contains("active");
        if (isOpen && isSame) {
          closeSheet();
        } else {
          openSheet(btn.dataset.tab, btn.dataset.title || btn.dataset.tab);
        }
      });
    });
    document.getElementById("sheet-close-btn").addEventListener("click", closeSheet);
    document.getElementById("sheet-backdrop").addEventListener("click", closeSheet);
  }

  // ---------- 설정 탭 ----------
  function setupSettings() {
    document.getElementById("export-btn").addEventListener("click", async () => {
      await GameBackend.saveState(state);
      const code = await GameBackend.exportState();
      document.getElementById("save-code").value = code;
      toast("저장 코드를 생성했어요. 복사해서 보관하세요.");
    });
    document.getElementById("import-btn").addEventListener("click", async () => {
      const code = document.getElementById("save-code").value;
      if (!code.trim()) return toast("가져올 코드를 붙여넣어 주세요.");
      const res = await GameBackend.importState(code);
      if (res.ok) {
        state = mergeWithDefaults(res.state);
        dirty = true;
        render();
        toast("가져오기 완료!");
      } else {
        toast("코드를 확인해주세요.");
      }
    });
    document.getElementById("reset-btn").addEventListener("click", resetGame);
    document.getElementById("show-table-income-toggle").addEventListener("change", (e) => {
      state.settings.showTableIncome = e.target.checked;
      dirty = true;
      render();
    });
  }

  // ---------- 저장/오프라인 수익 ----------
  async function saveGame() {
    await GameBackend.saveState(state);
  }

  async function loadGameAndComputeOffline() {
    const res = await GameBackend.loadState();
    if (res.ok && res.state) {
      const loaded = res.state;
      state = mergeWithDefaults(loaded);
      const savedAt = loaded.savedAt || Date.now();
      const elapsedSec = Math.max(0, Math.min((Date.now() - savedAt) / 1000, D.offline.maxSeconds));
      if (elapsedSec > 20) {
        const gain = incomePerSecond() * elapsedSec * offlineEfficiency();
        const diaGain = diamondPerSecond() * elapsedSec * offlineEfficiency();
        if (gain > 0) {
          addChips(gain);
          addDiamonds(diaGain);
          showOfflineModal(gain, diaGain, elapsedSec);
        }
      }
    }
  }

  function showOfflineModal(gain, diaGain, elapsedSec) {
    const mins = Math.round(elapsedSec / 60);
    const timeLabel = mins < 60 ? `${mins}분` : `${(mins / 60).toFixed(1)}시간`;
    document.getElementById("offline-text").textContent =
      `${timeLabel} 동안 ${formatChips(gain)}` + (diaGain >= 1 ? ` · 💎${Math.floor(diaGain)}` : "") + `을 벌었어요! (효율 ${Math.round(offlineEfficiency() * 100)}%)`;
    document.getElementById("offline-modal").classList.remove("hidden");
  }

  // ---------- 메인 루프 ----------
  function tick() {
    const now = Date.now();
    const dt = (now - lastTickAt) / 1000;
    lastTickAt = now;
    addChips(incomePerSecond() * dt);
    addDiamonds(diamondPerSecond() * dt);
    render();
  }

  async function init() {
    setupTabs();
    setupSettings();
    if (window.PubScene3D) {
      window.PubScene3D.init(document.getElementById("pub-3d-container"));
      window.PubScene3D.onTap = handleSceneTap;
    }
    document.getElementById("buy-table-btn").addEventListener("click", buyTable);
    document.getElementById("upgrade-table-btn").addEventListener("click", upgradeTable);
    document.getElementById("expand-store-btn").addEventListener("click", expandStore);
    document.getElementById("prestige-btn").addEventListener("click", doPrestige);
    document.getElementById("gacha-pull-btn").addEventListener("click", pullGacha);
    document.getElementById("offline-close").addEventListener("click", () => {
      document.getElementById("offline-modal").classList.add("hidden");
    });
    document.getElementById("gacha-close").addEventListener("click", () => {
      document.getElementById("gacha-modal").classList.add("hidden");
    });
    document.getElementById("event-btn").addEventListener("click", openGift);
    document.getElementById("event-claim-btn").addEventListener("click", () => {
      document.getElementById("event-modal").classList.add("hidden");
    });
    document.getElementById("context-popup-close").addEventListener("click", closeContextPopup);
    document.getElementById("context-popup").addEventListener("click", (e) => {
      if (e.target.id === "context-popup") closeContextPopup();
    });
    document.getElementById("context-popup-action").addEventListener("click", () => {
      if (popupAction) popupAction();
      closeContextPopup();
    });

    await loadGameAndComputeOffline();
    dirty = true;
    render();

    lastTickAt = Date.now();
    setInterval(tick, D.tick.intervalMs);
    setInterval(saveGame, D.tick.autosaveMs);
    window.addEventListener("beforeunload", () => {
      GameBackend.saveState(state);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

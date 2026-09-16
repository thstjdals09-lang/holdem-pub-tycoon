// 홀덤펍 키우기 - 메인 게임 로직
(() => {
  const D = GAME_DATA;

  const defaultState = (keepPrestige) => ({
    chips: 20,
    totalEarned: 0,
    tables: 1,
    tableLevel: 0,
    store: { expansions: 0 },
    fixtures: Object.fromEntries(D.fixtures.map((f) => [f.id, 0])),
    staff: Object.fromEntries(D.staff.map((s) => [s.id, 0])),
    decor: Object.fromEntries(D.decor.map((d) => [d.id, false])),
    prestige: keepPrestige || { points: 0 },
  });

  let state = defaultState();
  let lastTickAt = Date.now();
  let dirty = true;

  // 저장된 데이터에 새 필드(신규 시설/직원 등)가 없어도 기본값으로 채워준다.
  const mergeWithDefaults = (saved) => {
    const base = defaultState();
    return {
      ...base,
      ...saved,
      store: { ...base.store, ...saved.store },
      fixtures: { ...base.fixtures, ...saved.fixtures },
      staff: { ...base.staff, ...saved.staff },
      decor: { ...base.decor, ...saved.decor },
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

  const incomeMultiplier = () => {
    let mult = 1;
    D.staff.forEach((s) => {
      if (s.effect.type === "incomeMult") mult += s.effect.value * state.staff[s.id];
    });
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

  const incomePerSecond = () => {
    const tableIncome = state.tables * D.table.baseIncome * (1 + state.tableLevel * D.tableUpgrade.bonusPerLevel);
    return (tableIncome + fixtureIncome()) * incomeMultiplier();
  };

  const clickPower = () => {
    let power = 1;
    D.staff.forEach((s) => {
      if (s.effect.type === "click") power += s.effect.value * state.staff[s.id];
    });
    const vault = fixtureDef("vault");
    if (vault) power += vault.clickPerLevel * state.fixtures.vault;
    return power * prestigeMultiplier();
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

  const buyTable = () => {
    if (state.tables >= tableCapacity()) return;
    const cost = tableCost();
    if (state.chips < cost) return;
    state.chips -= cost;
    state.tables += 1;
    dirty = true;
    render();
    const idx = state.tables - 1;
    if (idx < D.store.maxShownSlots) {
      spawnPopOnElement(document.getElementById("floor-grid").children[idx]);
    }
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
    if (id === "dealer") {
      const idx = state.staff.dealer - 1;
      if (idx >= 0 && idx < state.tables && idx < D.store.maxShownSlots) {
        spawnPopOnElement(document.getElementById("floor-grid").children[idx]);
      }
    } else if (id === "bartender") {
      const barIndex = D.fixtures.findIndex((f) => f.id === "bar");
      spawnPopOnElement(document.getElementById("fixtures-row").children[barIndex]);
    } else {
      spawnEmojiPop("pub-staff-row");
    }
  };

  const buyDecor = (id) => {
    const def = D.decor.find((d) => d.id === id);
    if (state.decor[id] || state.chips < def.cost) return;
    state.chips -= def.cost;
    state.decor[id] = true;
    dirty = true;
    render();
    spawnEmojiPop("pub-decor-row");
    toast(`${def.emoji} ${def.name} 설치 완료!`);
  };

  const manualDeal = () => {
    addChips(clickPower());
    render();
    const btn = document.getElementById("deal-btn");
    btn.classList.add("dealing");
    setTimeout(() => btn.classList.remove("dealing"), 180);
  };

  const doPrestige = () => {
    const gain = potentialPrestigePoints();
    if (gain <= state.prestige.points) return;
    if (!window.confirm(`정말 브랜드를 리뉴얼할까요?\n테이블/직원/칩이 초기화되고, 명성 포인트가 ${gain}점이 됩니다.`)) return;
    state = defaultState({ points: gain });
    dirty = true;
    render();
    toast(`✨ 브랜드 리뉴얼 완료! 명성 포인트 ${gain}점`);
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

  // ---------- 이펙트: 토스트 / 팝 애니메이션 ----------
  const toast = (msg) => {
    const wrap = document.getElementById("toast-wrap");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  const spawnPopOnElement = (el) => {
    if (!el) return;
    el.classList.remove("emoji-pop");
    void el.offsetWidth;
    el.classList.add("emoji-pop");
  };

  const spawnEmojiPop = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    spawnPopOnElement(el.lastElementChild);
  };

  // ---------- 렌더링 ----------
  const TABLE_ICONS = ["🃏", "♠️", "♥️", "♦️", "♣️"];
  const ROAM_ICONS = { server: "🍽️", marketer: "📣" };

  function renderFixtures() {
    const wrap = document.getElementById("fixtures-row");
    wrap.innerHTML = "";
    D.fixtures.forEach((f) => {
      const level = state.fixtures[f.id];
      const box = document.createElement("div");
      box.className = "fixture-box" + (level > 0 ? "" : " fixture-empty");
      const staffBadge = f.id === "bar" && state.staff.bartender > 0 ? `<span class="fixture-staff">🍹</span>` : "";
      const chipStack = f.id === "vault" && level > 0 ? `<span class="fixture-chips">${"🪙".repeat(Math.min(level, 5))}</span>` : "";
      box.innerHTML = `
        <span class="fixture-emoji">${f.emoji}</span>
        <span class="fixture-name">${f.name}${level > 0 ? ` Lv.${level}` : ""}</span>
        ${staffBadge}${chipStack}
      `;
      wrap.appendChild(box);
    });
  }

  function renderFloorGrid() {
    const grid = document.getElementById("floor-grid");
    const capacity = tableCapacity();
    const shownCapacity = Math.min(capacity, D.store.maxShownSlots);
    grid.innerHTML = "";
    for (let i = 0; i < shownCapacity; i++) {
      const cell = document.createElement("div");
      if (i < state.tables) {
        cell.className = "table-cell filled";
        const hasDealer = i < state.staff.dealer;
        cell.innerHTML = `<span class="table-icon">${TABLE_ICONS[i % TABLE_ICONS.length]}</span>${
          hasDealer ? `<span class="dealer-badge" title="딜러 배치됨">🎩</span>` : ""
        }`;
      } else {
        cell.className = "table-cell empty";
        cell.innerHTML = `<span class="table-empty-icon">➕</span>`;
      }
      grid.appendChild(cell);
    }
    const note = document.getElementById("floor-note");
    if (capacity > shownCapacity) {
      note.textContent = `+${capacity - shownCapacity}개 테이블 슬롯 더 있음`;
      note.style.display = "";
    } else if (state.tables >= capacity) {
      note.textContent = "매장이 가득 찼어요! 매장 탭에서 확장해보세요 🏗";
      note.style.display = "";
    } else {
      note.style.display = "none";
    }
  }

  function renderRoamRow() {
    const staffEl = document.getElementById("pub-staff-row");
    const roamIds = Object.keys(ROAM_ICONS);
    const total = roamIds.reduce((sum, id) => sum + state.staff[id], 0);
    const shown = Math.min(total, 16);
    staffEl.innerHTML = "";
    let count = 0;
    outer: for (const id of roamIds) {
      for (let i = 0; i < state.staff[id]; i++) {
        if (count >= shown) break outer;
        const span = document.createElement("span");
        span.textContent = ROAM_ICONS[id];
        staffEl.appendChild(span);
        count++;
      }
    }
    if (total > shown) {
      const more = document.createElement("span");
      more.style.fontSize = "14px";
      more.textContent = `+${total - shown}`;
      staffEl.appendChild(more);
    }
  }

  function renderDecorRow() {
    const decorEl = document.getElementById("pub-decor-row");
    decorEl.innerHTML = "";
    D.decor.forEach((d) => {
      if (state.decor[d.id]) {
        const span = document.createElement("span");
        span.textContent = d.emoji;
        decorEl.appendChild(span);
      }
    });
  }

  function renderScene() {
    renderFixtures();
    renderFloorGrid();
    renderRoamRow();
    renderDecorRow();
  }

  function renderHeader() {
    document.getElementById("chips-value").textContent = formatNumber(state.chips);
    document.getElementById("income-value").textContent = `${formatNumber(incomePerSecond())} / 초`;
    document.getElementById("prestige-badge").textContent = `✨ x${prestigeMultiplier().toFixed(2)}`;
    document.getElementById("click-power-label").textContent = `+${formatNumber(clickPower())} 칩`;
  }

  function renderTablesTab() {
    const capacity = tableCapacity();
    document.getElementById("table-count").textContent = state.tables;
    document.getElementById("table-capacity").textContent = capacity;
    document.getElementById("table-level").textContent = state.tableLevel;
    document.getElementById("table-base-income").textContent = D.table.baseIncome;

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
  }

  function renderDecorTab() {
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
    const btn = document.getElementById("prestige-btn");
    btn.disabled = gain <= state.prestige.points;
  }

  function render() {
    renderHeader();
    renderStoreTab();
    renderTablesTab();
    renderStaffTab();
    renderDecorTab();
    renderPrestigeTab();
    if (dirty) {
      renderScene();
      dirty = false;
    }
  }

  // ---------- 탭 전환 ----------
  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      });
    });
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
        if (gain > 0) {
          addChips(gain);
          showOfflineModal(gain, elapsedSec);
        }
      }
    }
  }

  function showOfflineModal(gain, elapsedSec) {
    const mins = Math.round(elapsedSec / 60);
    const timeLabel = mins < 60 ? `${mins}분` : `${(mins / 60).toFixed(1)}시간`;
    document.getElementById("offline-text").textContent = `${timeLabel} 동안 ${formatChips(gain)}을 벌었어요! (효율 ${Math.round(offlineEfficiency() * 100)}%)`;
    document.getElementById("offline-modal").classList.remove("hidden");
  }

  // ---------- 메인 루프 ----------
  function tick() {
    const now = Date.now();
    const dt = (now - lastTickAt) / 1000;
    lastTickAt = now;
    addChips(incomePerSecond() * dt);
    render();
  }

  async function init() {
    setupTabs();
    setupSettings();
    document.getElementById("buy-table-btn").addEventListener("click", buyTable);
    document.getElementById("upgrade-table-btn").addEventListener("click", upgradeTable);
    document.getElementById("expand-store-btn").addEventListener("click", expandStore);
    document.getElementById("deal-btn").addEventListener("click", manualDeal);
    document.getElementById("prestige-btn").addEventListener("click", doPrestige);
    document.getElementById("offline-close").addEventListener("click", () => {
      document.getElementById("offline-modal").classList.add("hidden");
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

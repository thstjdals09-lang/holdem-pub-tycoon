// 홀덤펍 키우기 - 메인 게임 로직
(() => {
  const D = GAME_DATA;

  const defaultState = (keepPrestige) => ({
    chips: 20,
    totalEarned: 0,
    tables: 1,
    tableLevel: 0,
    staff: Object.fromEntries(D.staff.map((s) => [s.id, 0])),
    decor: Object.fromEntries(D.decor.map((d) => [d.id, false])),
    prestige: keepPrestige || { points: 0 },
  });

  let state = defaultState();
  let lastTickAt = Date.now();
  let dirty = true;

  // ---------- 비용/수치 계산 ----------
  const costFor = (base, growth, count) => Math.ceil(base * Math.pow(growth, count));

  const tableCost = () => costFor(D.table.baseCost, D.table.costGrowth, state.tables - 1);
  const tableUpgradeCost = () => costFor(D.tableUpgrade.baseCost, D.tableUpgrade.costGrowth, state.tableLevel);
  const staffDef = (id) => D.staff.find((s) => s.id === id);
  const staffCost = (id) => {
    const def = staffDef(id);
    return costFor(def.baseCost, def.costGrowth, state.staff[id]);
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

  const incomePerSecond = () => {
    const base = state.tables * D.table.baseIncome * (1 + state.tableLevel * D.tableUpgrade.bonusPerLevel);
    return base * incomeMultiplier();
  };

  const clickPower = () => {
    let power = 1;
    D.staff.forEach((s) => {
      if (s.effect.type === "click") power += s.effect.value * state.staff[s.id];
    });
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
    const cost = tableCost();
    if (state.chips < cost) return;
    state.chips -= cost;
    state.tables += 1;
    dirty = true;
    spawnEmojiPop("pub-tables");
    render();
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
    spawnEmojiPop("pub-staff-row");
    render();
  };

  const buyDecor = (id) => {
    const def = D.decor.find((d) => d.id === id);
    if (state.decor[id] || state.chips < def.cost) return;
    state.chips -= def.cost;
    state.decor[id] = true;
    dirty = true;
    spawnEmojiPop("pub-decor-row");
    render();
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

  const spawnEmojiPop = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const last = el.lastElementChild;
    if (last) {
      last.classList.remove("emoji-pop");
      void last.offsetWidth;
      last.classList.add("emoji-pop");
    }
  };

  // ---------- 렌더링 ----------
  const TABLE_ICONS = ["🃏", "♠️", "♥️", "♦️", "♣️"];
  const CUSTOMER_ICONS = ["🧑", "👩", "🧔", "👨", "👵", "👴", "🧑‍🦱", "👩‍🦰"];

  function renderScene() {
    const tablesEl = document.getElementById("pub-tables");
    const staffEl = document.getElementById("pub-staff-row");
    const decorEl = document.getElementById("pub-decor-row");

    const shownTables = Math.min(state.tables, 14);
    tablesEl.innerHTML = "";
    for (let i = 0; i < shownTables; i++) {
      const span = document.createElement("span");
      span.textContent = TABLE_ICONS[i % TABLE_ICONS.length];
      tablesEl.appendChild(span);
    }
    if (state.tables > shownTables) {
      const more = document.createElement("span");
      more.style.fontSize = "14px";
      more.textContent = `+${state.tables - shownTables}`;
      tablesEl.appendChild(more);
    }

    const totalStaff = Object.values(state.staff).reduce((a, b) => a + b, 0);
    const shownStaff = Math.min(totalStaff, 16);
    staffEl.innerHTML = "";
    for (let i = 0; i < shownStaff; i++) {
      const span = document.createElement("span");
      span.textContent = CUSTOMER_ICONS[i % CUSTOMER_ICONS.length];
      staffEl.appendChild(span);
    }
    if (totalStaff > shownStaff) {
      const more = document.createElement("span");
      more.style.fontSize = "14px";
      more.textContent = `+${totalStaff - shownStaff}`;
      staffEl.appendChild(more);
    }

    decorEl.innerHTML = "";
    D.decor.forEach((d) => {
      if (state.decor[d.id]) {
        const span = document.createElement("span");
        span.textContent = d.emoji;
        decorEl.appendChild(span);
      }
    });
  }

  function renderHeader() {
    document.getElementById("chips-value").textContent = formatNumber(state.chips);
    document.getElementById("income-value").textContent = `${formatNumber(incomePerSecond())} / 초`;
    document.getElementById("prestige-badge").textContent = `✨ x${prestigeMultiplier().toFixed(2)}`;
    document.getElementById("click-power-label").textContent = `+${formatNumber(clickPower())} 칩`;
  }

  function renderTablesTab() {
    document.getElementById("table-count").textContent = state.tables;
    document.getElementById("table-level").textContent = state.tableLevel;
    document.getElementById("table-base-income").textContent = D.table.baseIncome;

    const buyBtn = document.getElementById("buy-table-btn");
    const cost = tableCost();
    buyBtn.querySelector("small").textContent = `${formatChips(cost)}`;
    buyBtn.disabled = state.chips < cost;

    const upBtn = document.getElementById("upgrade-table-btn");
    const upCost = tableUpgradeCost();
    upBtn.querySelector("small").textContent = `${formatChips(upCost)}`;
    upBtn.disabled = state.chips < upCost;
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
        state = {
          ...defaultState(),
          ...res.state,
          staff: { ...defaultState().staff, ...res.state.staff },
          decor: { ...defaultState().decor, ...res.state.decor },
        };
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
      state = { ...defaultState(), ...loaded, staff: { ...defaultState().staff, ...loaded.staff }, decor: { ...defaultState().decor, ...loaded.decor } };
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

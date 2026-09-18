// PixelMap — 매장 구조(증축 단계)와 테마 팔레트.
//
// 증축은 "같은 방이 넓어지는 것"이 아니라 구조가 바뀐다.
//   좁은 1층 → 넓은 1층 → ㄱ자 1층 → 2층 신설 → 2층 확장
// 각 단계는 해금 조건을 갖고, 조건을 채워야 다음 구조로 넘어간다.
//
// 바닥 모양은 사각형 몇 개(rects)의 합집합으로 적는다 — ㄱ자·凸자 같은 형태를
// 셀 목록으로 일일이 쓰지 않아도 되고, 벽을 자동으로 찾아 세울 수 있다.

const PixelMap = (() => {
  // ============================================================
  //  증축 단계
  //  rects: [x, y, w, h] (칸 단위, 좌상단 기준)
  //  unlock: 다음 단계로 넘어가는 조건 (game.js 상태 기준)
  // ============================================================
  const STAGES = [
    {
      id: "small",
      name: "작은 펍",
      desc: "테이블 하나로 시작하는 좁은 가게",
      floors: [{ level: 0, rects: [[0, 0, 5, 4]] }],
      unlock: null,
      next: { tables: 2, lifetimeEarned: 3000, label: "테이블 2개 · 누적 3,000 BB" },
    },
    {
      id: "wide",
      name: "넓은 펍",
      desc: "벽을 터서 홀을 넓혔다",
      floors: [{ level: 0, rects: [[0, 0, 8, 5]] }],
      unlock: { tables: 2, lifetimeEarned: 3000 },
      next: { tables: 4, prestigePoints: 1, label: "테이블 4개 · 명성 1" },
    },
    {
      id: "lshape",
      name: "ㄱ자 홀",
      desc: "옆 점포를 트고 안쪽에 별실을 만들었다",
      floors: [{ level: 0, rects: [[0, 0, 8, 5], [8, 0, 4, 3]] }],
      unlock: { tables: 4, prestigePoints: 1 },
      next: { tables: 6, prestigePoints: 5, label: "테이블 6개 · 명성 5" },
    },
    {
      id: "twofloor",
      name: "2층 신설",
      desc: "위층을 올려 VIP 라운지를 뒀다",
      floors: [
        { level: 0, rects: [[0, 0, 8, 5], [8, 0, 4, 3]] },
        { level: 1, rects: [[0, 0, 5, 4]] },
      ],
      unlock: { tables: 6, prestigePoints: 5 },
      next: { tables: 9, prestigePoints: 20, label: "테이블 9개 · 명성 20" },
    },
    {
      id: "tower",
      name: "포커 하우스",
      desc: "2층까지 넓힌 본격 홀덤 하우스",
      floors: [
        { level: 0, rects: [[0, 0, 8, 5], [8, 0, 4, 3]] },
        { level: 1, rects: [[0, 0, 8, 5]] },
      ],
      unlock: { tables: 9, prestigePoints: 20 },
      next: null,
    },
  ];

  /** 상태로 지금 열려 있는 최고 단계를 찾는다. */
  function stageFor(state) {
    let idx = 0;
    for (let i = 1; i < STAGES.length; i++) {
      if (meets(STAGES[i].unlock, state)) idx = i;
      else break;
    }
    return idx;
  }

  function meets(cond, state) {
    if (!cond) return true;
    for (const [k, v] of Object.entries(cond)) {
      if ((state[k] || 0) < v) return false;
    }
    return true;
  }

  /** 다음 단계까지 남은 조건 (UI 표시용) */
  function nextRequirement(state) {
    const s = STAGES[stageFor(state)];
    if (!s.next) return null;
    const need = [];
    for (const [k, v] of Object.entries(s.next)) {
      if (k === "label") continue;
      const have = state[k] || 0;
      if (have < v) need.push({ key: k, have, need: v });
    }
    return { label: s.next.label, need, done: need.length === 0 };
  }

  /** rects 합집합 → 셀 Set. 벽 세우기·배치에 쓴다. */
  function cellsOf(floor) {
    const set = new Set();
    for (const [x, y, w, h] of floor.rects) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set.add(`${x + i},${y + j}`);
    }
    return set;
  }

  /**
   * 벽이 필요한 자리 — 뒤쪽 두 방향(북/서)에 이웃 칸이 없으면 벽을 세운다.
   * ㄱ자처럼 꺾인 모양도 자동으로 안쪽 벽이 생긴다.
   */
  function wallsOf(floor) {
    const cells = cellsOf(floor);
    const out = [];
    for (const key of cells) {
      const [x, y] = key.split(",").map(Number);
      if (!cells.has(`${x},${y - 1}`)) out.push({ x, y, dir: "back" });
      if (!cells.has(`${x - 1},${y}`)) out.push({ x, y, dir: "left" });
    }
    return out;
  }

  // ============================================================
  //  테마 팔레트 — 도트 색은 전부 여기서 나온다.
  //  floorPattern / seat / lantern 처럼 "형태 선택"도 테마가 정한다.
  // ============================================================
  const THEMES = {
    classic: {
      name: "클래식",
      floor: "#c9a071", floorPattern: "plank",
      wallBack: "#f2dfe6", wallSide: "#f8ece1", wainscot: "#a8794e", trim: "#e2789a",
      rail: "#a87249", felt: "#2f8a5a", bar: "#a87249", barTop: "#8a5c39", barTrim: "#e2789a",
      chairLeg: "#8a6244", chairPad: "#e08aa5", pot: "#b5794f", leaf: "#5f9e50",
      wood: "#a87249", gold: "#e8b84a", accent: "#e2789a",
      chipA: "#e0574f", chipB: "#4a7fd0", chipC: "#e8b84a",
      bottles: ["#5c3a21", "#2f6b4a", "#7a2f4a", "#2f4a7a", "#c9a24a"],
      rug: "#4f7a56", signBg: "#3a2a24", signInk: "#f2e4c0", frameWood: "#8a5c39",
      lampGlow: "#ffd68f", grass: "#6faa54", arts: ["#c9a24a", "#7ea8c9", "#c98a9a", "#8aa87a"],
      shopName: "POKER PUB",
      signs: [["GOOD CARDS","GOOD PEOPLE"],["POKER LIFE"],["ALL IN"]],
      menu: ["DRINK","PLAY"],
      seat: "chair", lantern: false,
      dealer: { hair: "#3b2b20", skin: "#f2c9a0", cloth: "#f4f2ee", pants: "#3a3550", style: "short", visor: "#2f6b8a", bowtie: "#c2404a" },
      guests: [
        { hair: "#3b2b20", skin: "#f2c9a0", cloth: "#e08aa5", pants: "#4a5a7a", style: "short" },
        { hair: "#1f1a18", skin: "#e8b88c", cloth: "#7ec0e0", pants: "#3a3a4a", style: "long" },
        { hair: "#6b4a2f", skin: "#f7d6b4", cloth: "#e8c85c", pants: "#5a4a6b", style: "bun" },
        { hair: "#2b2440", skin: "#e0a87c", cloth: "#84c98a", pants: "#4a4a5a", style: "spiky" },
      ],
    },
    princess: {
      name: "공주풍",
      floor: "#f2d3e4", floorPattern: "carpet",
      wallBack: "#fce6f4", wallSide: "#fdf0f8", wainscot: "#f0c2dd", trim: "#f58ad2",
      rail: "#f0dcea", felt: "#d9629f", bar: "#faeaf4", barTop: "#e8c6dd", barTrim: "#f5c84a",
      chairLeg: "#e0c2d4", chairPad: "#f58ab5", pot: "#f2dfe8", leaf: "#8fd48a",
      wood: "#e8cfe0", gold: "#f5c84a", accent: "#f58ad2",
      chipA: "#f58ab5", chipB: "#b98ae0", chipC: "#f5c84a",
      bottles: ["#f5a8cc", "#e0c2f5", "#f7dca0", "#c2e4f5", "#fdeef5"],
      rug: "#f0b8d4", signBg: "#8a3a62", signInk: "#fdeaf4", frameWood: "#e8c86a",
      lampGlow: "#ffe6f2", grass: "#8fc47a", arts: ["#f5c84a", "#f0a8cc", "#d0b0f0", "#f7dca0"],
      shopName: "POKER PUB",
      signs: [["GOOD CARDS","GOOD PEOPLE"],["POKER LIFE"],["ROYAL"]],
      menu: ["TEA","CAKE"],
      seat: "chair", lantern: false,
      dealer: { hair: "#5a4632", skin: "#f7d6b4", cloth: "#fdf4fa", pants: "#c98ab5", style: "short", visor: "#f58ad2", bowtie: "#f5c84a" },
      guests: [
        { hair: "#8a6a4a", skin: "#f7d6b4", cloth: "#fbc2dd", pants: "#b59ad0", style: "short" },
        { hair: "#3b2b20", skin: "#f2c9a0", cloth: "#e0c2f5", pants: "#9a8ac0", style: "long" },
        { hair: "#c98a4a", skin: "#f7d6b4", cloth: "#fdeaa8", pants: "#c2a8d8", style: "bun" },
        { hair: "#2b2440", skin: "#e8b88c", cloth: "#c2e4f5", pants: "#a890c0", style: "spiky" },
      ],
    },
    european: {
      name: "유럽풍",
      floor: "#b5895c", floorPattern: "plank",
      wallBack: "#8a6a4a", wallSide: "#a3805a", wainscot: "#6b4a32", trim: "#d0a838",
      rail: "#6b4630", felt: "#2f6b45", bar: "#7a5236", barTop: "#5a3a24", barTrim: "#d0a838",
      chairLeg: "#5a3c28", chairPad: "#8f2f3a", pot: "#8a6a4a", leaf: "#3f6b45",
      wood: "#7a5236", gold: "#d0a838", accent: "#8f2f3a",
      chipA: "#8f2f3a", chipB: "#2f4a7a", chipC: "#d0a838",
      bottles: ["#4a2f1a", "#2f5a3a", "#6b2f2f", "#3a3a5a", "#c9a24a"],
      rug: "#7a3340", signBg: "#3a2a1a", signInk: "#e8d8a8", frameWood: "#c9a24a",
      lampGlow: "#ffd68f", grass: "#5f8f4a", arts: ["#6b4a32", "#3f5a45", "#5a3a2a", "#8a6a3a"],
      shopName: "POKER HOUSE",
      signs: [["GENTLEMEN","ONLY"],["POKER LIFE"],["CLASSIC"]],
      menu: ["WINE","CIGAR"],
      seat: "chair", lantern: false,
      dealer: { hair: "#1f1a18", skin: "#e8b88c", cloth: "#f0e8d8", pants: "#3a3020", style: "short", visor: "#8f2f3a", bowtie: "#d0a838" },
      guests: [
        { hair: "#1f1a18", skin: "#e8b88c", cloth: "#8f2f3a", pants: "#3a3020", style: "short" },
        { hair: "#5a4632", skin: "#f2c9a0", cloth: "#2f5a3a", pants: "#4a3a2a", style: "long" },
        { hair: "#3b2b20", skin: "#e0a87c", cloth: "#455680", pants: "#3a3020", style: "bun" },
        { hair: "#8a6a4a", skin: "#f7d6b4", cloth: "#c2a35a", pants: "#4a3a2a", style: "spiky" },
      ],
    },
    neon: {
      name: "네온 라운지",
      floor: "#332450", floorPattern: "marble",
      wallBack: "#241a3f", wallSide: "#2e2050", wainscot: "#3f2a68", trim: "#00d8f0",
      rail: "#3a2358", felt: "#5a2a8f", bar: "#2a1a44", barTop: "#1c1030", barTrim: "#00d8f0",
      chairLeg: "#2f1d4a", chairPad: "#f03fa0", pot: "#3f2a68", leaf: "#3fd8a0",
      wood: "#3a2358", gold: "#f0d84a", accent: "#f03fa0",
      chipA: "#f03fa0", chipB: "#00d8f0", chipC: "#f0d84a",
      bottles: ["#00d8f0", "#f03fa0", "#a86bff", "#5affc2", "#f0d84a"],
      rug: "#3f2a6b", signBg: "#140c26", signInk: "#00d8f0", frameWood: "#3a2358",
      lampGlow: "#00d8f0", grass: "#2a2a4a", arts: ["#f03fa0", "#00d8f0", "#a86bff", "#5affc2"],
      shopName: "NEON POKER",
      signs: [["PLAY","ALL NIGHT"],["POKER LIFE"],["VIP"]],
      menu: ["NEON","BAR"],
      seat: "chair", lantern: false,
      dealer: { hair: "#1f1a28", skin: "#e8b88c", cloth: "#2a1a44", pants: "#1c1030", style: "short", visor: "#00d8f0", bowtie: "#f03fa0" },
      guests: [
        { hair: "#1f1a28", skin: "#e8b88c", cloth: "#00d8f0", pants: "#241a3f", style: "short" },
        { hair: "#2b2440", skin: "#f2c9a0", cloth: "#f03fa0", pants: "#1c1030", style: "long" },
        { hair: "#6b4a2f", skin: "#e0a87c", cloth: "#a86bff", pants: "#241a3f", style: "bun" },
        { hair: "#1f1a18", skin: "#f7d6b4", cloth: "#5affc2", pants: "#2e2050", style: "spiky" },
      ],
    },
    japanese: {
      name: "일본풍",
      floor: "#d8d49a", floorPattern: "tatami",
      wallBack: "#f7efdc", wallSide: "#fbf5e6", wainscot: "#7a5236", trim: "#8a4a32",
      rail: "#bf9463", felt: "#2f4a78", bar: "#8a5c3a", barTop: "#6b4630", barTrim: "#c23a33",
      chairLeg: "#a87a52", chairPad: "#d98a92", pot: "#7a5236", leaf: "#4f8a4a",
      wood: "#8a5c3a", gold: "#e0a84a", accent: "#c23a33",
      chipA: "#c23a33", chipB: "#2f4a78", chipC: "#e0a84a",
      bottles: ["#f2ece0", "#2f4a78", "#2f5a50", "#c23a33", "#e0a84a"],
      rug: "#3f5a6b", signBg: "#3a2a24", signInk: "#f2ece0", frameWood: "#6b4630",
      lampGlow: "#ffd9a0", grass: "#6f9a52", arts: ["#c23a33", "#2f4a78", "#e0a84a", "#4f8a4a"],
      shopName: "POKER PUB",
      signs: [["GOOD CARDS","GOOD PEOPLE"],["POKER LIFE"],["SAKE"]],
      menu: ["SAKE","POKER"],
      seat: "zabuton", lantern: true,
      dealer: { hair: "#1f1a18", skin: "#f2c9a0", cloth: "#2f4a78", pants: "#3a3550", style: "short", visor: null, bowtie: null, apron: "#c23a33" },
      guests: [
        { hair: "#1f1a18", skin: "#f2c9a0", cloth: "#2f4a78", pants: "#3a3550", style: "short" },
        { hair: "#2b2440", skin: "#f7d6b4", cloth: "#c23a33", pants: "#4a3a3a", style: "long" },
        { hair: "#3b2b20", skin: "#e8b88c", cloth: "#f2ece0", pants: "#5a4a42", style: "bun" },
        { hair: "#1f1a18", skin: "#f2c9a0", cloth: "#2f5a50", pants: "#3a3550", style: "spiky" },
      ],
    },
  };

  return { STAGES, THEMES, stageFor, nextRequirement, cellsOf, wallsOf, meets };
})();

if (typeof window !== "undefined") window.PixelMap = PixelMap;

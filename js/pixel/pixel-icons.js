// PixelIcons — HUD에 쓰는 작은 도트 아이콘.
//
// 왜 SVG를 안 쓰나: 월드가 도트인데 HUD만 벡터면 두 그림이 따로 논다.
// 아이콘도 같은 캔버스 프리미티브(정수 사각형·다각형·타원)로 그려서
// 화면 전체가 한 가지 재료로 만들어진 것처럼 보이게 한다.
//
// 기준 크기 20×20. 캔버스에 1배로 그린 뒤 CSS에서 image-rendering: pixelated 로 키운다.
// 손으로 점을 찍지 않고 도형으로 조립하는 이유: 아이콘이 20종이라 유지보수가 더 중요하고,
// 이 크기에서는 도형 조합이 손으로 찍은 것과 구분되지 않는다.
const PixelIcons = (() => {
  const S = 20;

  const C = {
    ink: "#2a1f1a",
    gold: "#f0c04a", goldD: "#c08c28", goldL: "#ffe49a",
    red: "#c9504a", redD: "#8f3230", redL: "#e8786a",
    green: "#5aa254", greenD: "#3c7a3c", greenL: "#86c47c",
    blue: "#5f8fd9", blueD: "#3f63a8", blueL: "#93b9ea",
    purple: "#a86bb0", purpleD: "#7a4682",
    cream: "#f6e7cf", creamD: "#d8c2a0",
    silver: "#cfd6de", silverD: "#8e98a6",
    wood: "#8a5c3a", woodD: "#5e3b24",
    white: "#fffdf6",
  };

  const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const E = (ctx, cx, cy, rx, ry, c) => PixelSprites.ellipse(ctx, cx, cy, rx, ry, c);
  const P = (ctx, pts, c) => PixelArt.poly(ctx, pts, c);

  /** 테두리를 먼저 크게 깔고 안쪽을 덮는 방식 — 1px 외곽선이 균일하게 나온다. */
  function disc(ctx, cx, cy, r, fill, edge) {
    E(ctx, cx, cy, r, r, edge || C.ink);
    E(ctx, cx, cy, r - 1, r - 1, fill);
  }

  const ICONS = {
    // 기본 화폐 — BB 칩
    coin(ctx) {
      disc(ctx, 10, 11, 8, C.gold);
      E(ctx, 10, 10, 7, 7, C.goldL);
      E(ctx, 10, 11, 5, 5, C.goldD);
      E(ctx, 10, 10, 4, 4, C.gold);
      PixelFont.draw(ctx, 10, 8, "B", C.woodD, 1, "center", 1);
    },
    // 프리미엄 화폐 — 보석
    gem(ctx) {
      P(ctx, [[4, 8], [16, 8], [10, 18]], C.ink);
      P(ctx, [[5, 8], [15, 8], [10, 17]], C.purple);
      P(ctx, [[5, 8], [10, 8], [10, 17]], C.purpleD);
      P(ctx, [[4, 8], [7, 3], [13, 3], [16, 8]], C.ink);
      P(ctx, [[5, 8], [8, 4], [12, 4], [15, 8]], C.purple);
      P(ctx, [[7, 4], [12, 4], [13, 8], [8, 8]], "#c98fd0");
      R(ctx, 8, 5, 2, 2, C.white);
    },
    // 초당 수익 — 위로 향한 화살표 + 칩
    rate(ctx) {
      P(ctx, [[10, 2], [17, 9], [13, 9], [13, 14], [7, 14], [7, 9], [3, 9]], C.ink);
      P(ctx, [[10, 4], [15, 9], [12, 9], [12, 13], [8, 13], [8, 9], [5, 9]], C.green);
      P(ctx, [[10, 4], [12, 6], [12, 13], [10, 13]], C.greenL);
      disc(ctx, 14, 15, 5, C.gold);
      E(ctx, 14, 14, 3, 3, C.goldL);
    },
    trophy(ctx) {
      R(ctx, 6, 15, 8, 3, C.ink); R(ctx, 7, 16, 6, 1, C.goldD);
      R(ctx, 4, 17, 12, 3, C.ink); R(ctx, 5, 18, 10, 1, C.gold);
      R(ctx, 8, 11, 4, 5, C.ink); R(ctx, 9, 11, 2, 4, C.goldD);
      P(ctx, [[4, 2], [16, 2], [15, 9], [10, 13], [5, 9]], C.ink);
      P(ctx, [[5, 3], [15, 3], [14, 9], [10, 12], [6, 9]], C.gold);
      P(ctx, [[5, 3], [9, 3], [9, 12], [6, 9]], C.goldL);
      R(ctx, 1, 4, 3, 5, C.ink); R(ctx, 2, 5, 1, 3, C.goldD);
      R(ctx, 16, 4, 3, 5, C.ink); R(ctx, 17, 5, 1, 3, C.goldD);
    },
    // 선물
    gift(ctx) {
      R(ctx, 2, 8, 16, 11, C.ink); R(ctx, 3, 9, 14, 9, C.red);
      R(ctx, 3, 9, 14, 3, C.redL);
      R(ctx, 1, 5, 18, 4, C.ink); R(ctx, 2, 6, 16, 2, C.redL);
      R(ctx, 8, 5, 4, 14, C.ink); R(ctx, 9, 6, 2, 12, C.gold);
      P(ctx, [[9, 5], [4, 1], [2, 4], [8, 6]], C.ink);
      P(ctx, [[9, 4], [5, 2], [4, 4], [8, 5]], C.gold);
      P(ctx, [[11, 5], [16, 1], [18, 4], [12, 6]], C.ink);
      P(ctx, [[11, 4], [15, 2], [16, 4], [12, 5]], C.gold);
    },
    // 출석 — 달력
    calendar(ctx) {
      R(ctx, 2, 3, 16, 16, C.ink); R(ctx, 3, 4, 14, 14, C.cream);
      R(ctx, 3, 4, 14, 4, C.red);
      R(ctx, 5, 1, 3, 5, C.ink); R(ctx, 12, 1, 3, 5, C.ink);
      R(ctx, 6, 2, 1, 3, C.silver); R(ctx, 13, 2, 1, 3, C.silver);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        R(ctx, 5 + c * 3, 10 + r * 3, 2, 2, r === 1 && c === 2 ? C.green : C.creamD);
      }
    },
    // 미션 — 체크리스트
    mission(ctx) {
      R(ctx, 3, 2, 14, 17, C.ink); R(ctx, 4, 3, 12, 15, C.cream);
      R(ctx, 7, 1, 6, 3, C.ink); R(ctx, 8, 2, 4, 1, C.silver);
      for (let i = 0; i < 3; i++) {
        R(ctx, 6, 7 + i * 4, 3, 3, C.ink);
        R(ctx, 7, 8 + i * 4, 1, 1, i < 2 ? C.green : C.creamD);
        R(ctx, 10, 8 + i * 4, 4, 1, C.silverD);
      }
    },
    // 부스트 — 번개
    boost(ctx) {
      P(ctx, [[11, 1], [4, 11], [9, 11], [7, 19], [16, 8], [11, 8]], C.ink);
      P(ctx, [[11, 3], [6, 10], [10, 10], [8, 16], [14, 9], [10, 9]], C.gold);
      P(ctx, [[11, 3], [8, 7], [10, 7], [10, 10], [6, 10]], C.goldL);
    },
    gear(ctx) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const tx = Math.round(10 + Math.cos(a) * 7), ty = Math.round(10 + Math.sin(a) * 7);
        R(ctx, tx - 3, ty - 3, 6, 6, C.ink);
      }
      disc(ctx, 10, 10, 8, C.ink, C.ink);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const tx = Math.round(10 + Math.cos(a) * 7), ty = Math.round(10 + Math.sin(a) * 7);
        R(ctx, tx - 2, ty - 2, 4, 4, C.silver);
      }
      E(ctx, 10, 10, 7, 7, C.silver);
      E(ctx, 10, 9, 6, 6, "#e6ebf1");
      disc(ctx, 10, 10, 3, "#7d8794");
    },
    // 배속 — 겹친 삼각형
    speed(ctx) {
      P(ctx, [[1, 2], [10, 10], [1, 18]], C.ink);
      P(ctx, [[3, 5], [8, 10], [3, 15]], C.gold);
      P(ctx, [[9, 2], [18, 10], [9, 18]], C.ink);
      P(ctx, [[11, 5], [16, 10], [11, 15]], C.gold);
    },
    // 업그레이드 — 위 화살표 + 받침
    upgrade(ctx) {
      P(ctx, [[10, 1], [19, 10], [14, 10], [14, 15], [6, 15], [6, 10], [1, 10]], C.ink);
      P(ctx, [[10, 3], [17, 10], [13, 10], [13, 14], [7, 14], [7, 10], [3, 10]], C.green);
      P(ctx, [[10, 3], [13, 6], [13, 14], [10, 14]], C.greenL);
      R(ctx, 4, 16, 12, 3, C.ink); R(ctx, 5, 17, 10, 1, C.greenD);
    },
    // 운영진 — 사람 둘
    staff(ctx) {
      // 뒤쪽 사람 — 작고 살짝 위로
      disc(ctx, 14, 6, 4, C.creamD);
      P(ctx, [[8, 17], [8, 12], [11, 10], [17, 10], [20, 12], [20, 17]], C.ink);
      P(ctx, [[9, 17], [9, 13], [11, 11], [17, 11], [19, 13], [19, 17]], C.blueD);
      // 앞쪽 사람
      disc(ctx, 8, 7, 5, C.cream);
      P(ctx, [[0, 20], [0, 15], [3, 12], [13, 12], [16, 15], [16, 20]], C.ink);
      P(ctx, [[1, 20], [1, 16], [4, 13], [12, 13], [15, 16], [15, 20]], C.red);
      R(ctx, 7, 13, 2, 7, C.redD);
    },
    // 대회 — 별이 박힌 컵
    tournament(ctx) {
      R(ctx, 4, 16, 12, 4, C.ink); R(ctx, 5, 17, 10, 2, C.goldD);
      R(ctx, 8, 12, 4, 5, C.ink); R(ctx, 9, 12, 2, 4, C.gold);
      P(ctx, [[3, 1], [17, 1], [16, 8], [10, 13], [4, 8]], C.ink);
      P(ctx, [[4, 2], [16, 2], [15, 8], [10, 12], [5, 8]], C.gold);
      star(ctx, 10, 6, 4, C.white);
    },
    // 상점 — 장바구니 봉투
    shop(ctx) {
      // 손잡이
      P(ctx, [[6, 7], [6, 2], [14, 2], [14, 7]], C.ink);
      P(ctx, [[8, 7], [8, 4], [12, 4], [12, 7]], "#f6e7cf");
      // 아래로 넓어지는 봉투
      P(ctx, [[4, 6], [16, 6], [18, 19], [2, 19]], C.ink);
      P(ctx, [[5, 7], [15, 7], [17, 18], [3, 18]], C.red);
      P(ctx, [[5, 7], [15, 7], [15, 10], [5, 10]], C.redL);
      star(ctx, 10, 14, 4, C.gold);
    },
    // 퀘스트 — 깃발
    quest(ctx) {
      R(ctx, 3, 1, 3, 19, C.ink); R(ctx, 4, 2, 1, 17, C.wood);
      P(ctx, [[6, 2], [18, 5], [6, 10]], C.ink);
      P(ctx, [[7, 4], [15, 6], [7, 9]], C.gold);
      R(ctx, 1, 18, 8, 2, C.ink);
    },
    // 확장 — 벽을 미는 화살표
    expand(ctx) {
      R(ctx, 9, 2, 2, 16, C.ink);
      P(ctx, [[8, 6], [1, 10], [8, 14]], C.ink);
      P(ctx, [[7, 8], [4, 10], [7, 12]], C.gold);
      P(ctx, [[12, 6], [19, 10], [12, 14]], C.ink);
      P(ctx, [[13, 8], [16, 10], [13, 12]], C.gold);
      R(ctx, 8, 9, 4, 2, C.goldL);
    },
    // 경고 — 시스템 배너 왼쪽
    alert(ctx) {
      P(ctx, [[10, 1], [19, 18], [1, 18]], C.ink);
      P(ctx, [[10, 4], [17, 17], [3, 17]], C.gold);
      R(ctx, 9, 8, 2, 5, C.woodD);
      R(ctx, 9, 14, 2, 2, C.woodD);
    },
    star(ctx) { star(ctx, 10, 10, 9, C.gold, C.ink); },
  };

  function star(ctx, cx, cy, r, fill, edge) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push([Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr)]);
    }
    if (edge) {
      PixelArt.poly(ctx, pts.map(([x, y]) => [x + (x > cx ? 1 : -1), y + (y > cy ? 1 : -1)]), edge);
    }
    PixelArt.poly(ctx, pts, fill);
  }

  function draw(ctx, name, ox, oy) {
    const fn = ICONS[name];
    if (!fn) return false;
    ctx.save && ctx.save();
    const orig = ctx.fillRect.bind(ctx);
    // 아이콘은 (0,0) 기준으로 그려져 있으므로 오프셋을 씌운다
    ctx.fillRect = (x, y, w, h) => orig(x + ox, y + oy, w, h);
    fn(ctx);
    ctx.fillRect = orig;
    ctx.restore && ctx.restore();
    return true;
  }

  /** <canvas data-icon="coin"> 를 전부 채운다. scale은 정수여야 도트가 안 뭉갠다. */
  function mount(root, scale) {
    const k = scale || 2;
    (root || document).querySelectorAll("canvas[data-icon]").forEach((c) => {
      const name = c.dataset.icon;
      if (!ICONS[name]) { console.warn("없는 아이콘:", name); return; }
      c.width = S; c.height = S;
      c.style.width = S * k + "px";
      c.style.height = S * k + "px";
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, S, S);
      draw(ctx, name, 0, 0);
    });
  }

  return { draw, mount, names: Object.keys(ICONS), SIZE: S, COLORS: C };
})();

if (typeof window !== "undefined") window.PixelIcons = PixelIcons;

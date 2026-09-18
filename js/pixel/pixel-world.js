// PixelWorld — 플레이 화면의 "월드 레이어".
//
// 규칙 하나: 공간은 CSS 박스가 아니라 스프라이트로 그린다. HUD는 그 위에 얹기만 한다.
//
// ── 프레임을 이렇게 잡은 이유 ────────────────────────────────────────────
// 아이소 방은 어떤 모양이든 화면에서 가로:세로 = 2:1 이다.
//   폭 = (w+d)·TW/2,  높이 = (w+d)·TH/2.
// 그래서 무대 폭을 720으로 두면 펍 높이는 아무리 해도 340px 언저리고,
// 1280 세로 화면의 1/3밖에 못 채운다. 나머지는 잔디와 도로가 되어
// "모바일 경영게임"이 아니라 "아이소 맵 데모"로 보였다. 이전 판이 실패한 지점이다.
//
// 세로 질량을 만드는 수단은 세 가지뿐이고, 셋을 동시에 건다:
//   1) 무대를 640으로 좁혀 카메라를 당긴다 — 방(736)이 양옆으로 48px씩 삐져나가
//      화면 밖으로 이어지는 것처럼 보인다. 모바일 게임 카메라가 원래 그렇다.
//   2) 벽을 104 → 150으로 올린다. 벽면이 넓어져 포스터·선반·간판을 더 걸 수 있다(밀도).
//   3) 벽 위에 처마와 큰 간판을 세운다. 가게 정면처럼 읽히고 85px을 더 번다.
// 결과: 건물이 가시 영역(HUD와 퀘스트 패널 사이)의 약 88%를 차지한다.
//
// 바깥은 좁은 인도 한 줄까지만 둔다. 잔디밭과 도로는 없앴다.
//
// ── 좌표 ────────────────────────────────────────────────────────────────
//   격자점 (gx, gy) → 화면 ((gx-gy)·32, (gx+gy)·16).  타일 64×32.
//   칸 (x,y)의 네 모서리는 격자점 (x,y)~(x+1,y+1), 화면상 맨 아래 꼭짓점은 (x+1,y+1).
//   가구는 전부 "격자점" 기준. 2×2 테이블의 중심은 (x+1, y+1).
//   깊이는 (gx+gy) 오름차순으로 칠한다. z버퍼가 없으니 화가 알고리즘이다.
const PixelWorld = (() => {
  const TW = 64, TH = 32;
  const WALL_H = 150;
  const WAIN = 46;          // 징두리 높이
  const ROOM = { w: 12, d: 11 };

  const VIEW_W = 640, VIEW_H = 1138;
  const PAD_TOP = 295;      // 위 여백 — 처마와 간판이 들어갈 자리
  const OX = ROOM.d * (TW / 2) + (VIEW_W - (ROOM.w + ROOM.d) * (TW / 2)) / 2;
  const OY = WALL_H + PAD_TOP;

  const iso = (gx, gy) => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2)];

  const PAL = {
    plazaA: "#d6c6a8", plazaB: "#cbbb9c", plazaSeam: "#ab9a7d",
    streetA: "#5a4f45", streetB: "#534940",
    dark: "#241c16",
    floorA: "#cfa877", floorB: "#c39b6b", seam: "#a67f50",
    wallBack: "#f3e2d3", wallSide: "#e6d0be",
    wainBack: "#9c6c46", wainSide: "#8a5e3c",
    trim: "#c2704a", beam: "#6b4630",
    roof: "#9a3f3f", roofDark: "#7a2f31", roofLight: "#bb5555",
    ink: "#2a1f1a", glow: "#ffd68f",
  };

  // ---------------- 스프라이트 ----------------
  const SRC = {
    table: "assets/pixel/out/core_poker/02_table_standard_6player.png",
    tablePrem: "assets/pixel/out/core_poker/03_table_premium_6player.png",
    tableBig: "assets/pixel/out/core_poker/04_table_basic_8player.png",
    tableTour: "assets/pixel/out/core_poker/06_table_tournament.png",
    chair: "assets/pixel/out/core_poker/09_player_chair_basic.png",
    chairPrem: "assets/pixel/out/core_poker/10_player_chair_premium.png",
    dealerChair: "assets/pixel/out/core_poker/08_dealer_chair.png",
    chipTray: "assets/pixel/out/core_poker/11_chip_tray.png",
    chipS: "assets/pixel/out/core_poker/12_chip_stack_small.png",
    chipM: "assets/pixel/out/core_poker/13_chip_stack_medium.png",
    chipL: "assets/pixel/out/core_poker/14_chip_stack_large.png",
    cardDeck: "assets/pixel/out/core_poker/15_card_deck.png",
    shuffler: "assets/pixel/out/core_poker/17_card_shuffler.png",
    cart: "assets/pixel/out/core_poker/18_poker_supply_cart.png",
    bar: "assets/pixel/out/bar_food/20_bar_counter_medium.png",
    barSmall: "assets/pixel/out/bar_food/19_bar_counter_small.png",
    barShelf: "assets/pixel/out/bar_food/22_back_bar_shelf.png",
    stool: "assets/pixel/out/bar_food/23_bar_stool_basic.png",
    stoolPrem: "assets/pixel/out/bar_food/24_bar_stool_premium.png",
    fridge: "assets/pixel/out/bar_food/25_drink_fridge.png",
    bottles: "assets/pixel/out/bar_food/26_bottle_display.png",
    coffee: "assets/pixel/out/bar_food/27_coffee_machine.png",
    snack: "assets/pixel/out/bar_food/28_snack_counter.png",
    foodCart: "assets/pixel/out/bar_food/29_food_service_cart.png",
    tray: "assets/pixel/out/bar_food/30_drink_tray.png",

    // 사람 — 전부 키 60px로 맞춰져 있다(tools/pixel-manifest.mjs의 __character).
    dealerF: "assets/pixel/out/staff/76_staff_dealer_female.png",
    dealerM: "assets/pixel/out/staff/77_staff_dealer_male.png",
    bartender: "assets/pixel/out/staff/78_staff_bartender_male.png",
    server: "assets/pixel/out/staff/79_staff_server_female.png",
    manager: "assets/pixel/out/staff/80_staff_manager_female.png",
    sitM: "assets/pixel/out/customers/87_customer_male_sitting.png",
    sitF: "assets/pixel/out/customers/88_customer_female_sitting.png",
    hoodie: "assets/pixel/out/customers/89_customer_male_hoodie.png",
    cardigan: "assets/pixel/out/customers/90_customer_female_cardigan.png",
    drinkM: "assets/pixel/out/customers/91_customer_male_drinking.png",
    backF: "assets/pixel/out/customers/92_customer_female_back.png",
    backM: "assets/pixel/out/customers/93_customer_male_back.png",
    walkM: "assets/pixel/out/customers/94_customer_male_walking.png",
    dress: "assets/pixel/out/customers/95_customer_female_dress.png",
    watching: "assets/pixel/out/customers/96_customer_male_watching.png",
    walkF: "assets/pixel/out/customers/97_customer_female_walking.png",
    highroller: "assets/pixel/out/customers/98_customer_male_highroller.png",
    cheerF: "assets/pixel/out/customers/99_customer_female_cheer.png",
  };

  const IMG = {};

  function load(basePath) {
    const base = basePath || "";
    return Promise.all(
      Object.keys(SRC).map(
        (k) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => { IMG[k] = im; res(k); };
            im.onerror = () => { IMG[k] = null; res(k); }; // 하나 빠져도 화면은 뜬다
            im.src = base + SRC[k];
          })
      )
    );
  }
  function useImages(map) { Object.assign(IMG, map); baked = null; }

  let surfaceFactory = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  };
  function setSurfaceFactory(fn) { surfaceFactory = fn; baked = null; }

  function blit(ctx, key, cx, baseY) {
    const im = IMG[key];
    if (!im) return;
    ctx.drawImage(im, Math.round(cx - im.width / 2), Math.round(baseY - im.height));
  }

  // ---------------- 배치 ----------------
  // 테이블은 2×2(화면 폭 128px)를 차지하고 의자가 반지름 1.5까지 둘러앉는다.
  // 의자 고리의 화면 반폭 = 45.3 × R ≈ 68px, 테이블 반폭 = 61px.
  // 중심끼리 화면 x로 128px 이상 떨어뜨려야 옆 테이블 의자와 안 겹친다.
  // 세 줄을 엇갈리게 둬서 격자처럼 보이지 않게 한다.
  const TABLES = [
    { cx: 2.2,  cy: 3.6, img: "table",     seats: 5, chair: "chair" },
    { cx: 6.6,  cy: 3.6, img: "tablePrem", seats: 6, chair: "chairPrem" },
    { cx: 10.6, cy: 3.6, img: "table",     seats: 4, chair: "chair" },
    { cx: 4.4,  cy: 6.6, img: "tableBig",  seats: 6, chair: "chair" },
    { cx: 8.8,  cy: 6.6, img: "table",     seats: 5, chair: "chair" },
    { cx: 6.8,  cy: 9.6, img: "tableTour", seats: 6, chair: "chairPrem" },
    { cx: 10.8, cy: 9.4, img: "table",     seats: 4, chair: "chair" },
  ];
  const SEAT_R = 1.5;
  const SEAT_ANGLE = [-90, -45, 0, 45, 90, 135, 180, 225]; // 0번 = 딜러(북쪽)

  const BAR = { cx: 6.4, cy: 0.7 };
  const STOOLS = [4.3, 5.3, 6.3, 7.3, 8.3].map((x) => ({ cx: x, cy: 1.6 }));
  // 대기 라운지 — 앞쪽 왼편. 테이블 줄이 닿지 않는 자리다.
  const LOUNGE = { cx: 1.4, cy: 10.0, chairs: [[0.6, 9.4], [2.2, 9.4], [0.6, 10.6], [2.2, 10.6]] };

  // 바 카운터가 북쪽 벽 gx 3.7~9.1을 가린다. 벽 장식과 소품은 그 바깥에만.
  const PROPS = [
    { t: "fridge",   cx: 10.7, cy: 0.5 },
    { t: "coffee",   cx: 9.5,  cy: 0.4 },
    { t: "bottles",  cx: 2.6,  cy: 0.4 },
    { t: "snack",    cx: 1.1,  cy: 1.3 },
    { t: "barSmall", cx: 11.6, cy: 2.4 },
    { t: "shuffler", cx: 0.5,  cy: 2.6 },
    { t: "cart",     cx: 11.8, cy: 5.4 },
    { t: "foodCart", cx: 0.45, cy: 6.4 },
    { t: "tray",     cx: 11.9, cy: 7.6 },
    { t: "plant",    cx: 11.9, cy: 1.4 },
    { t: "plant",    cx: 0.25, cy: 4.2 },
    { t: "plant",    cx: 11.9, cy: 8.8 },
    { t: "plant",    cx: 0.25, cy: 8.0 },
    { t: "plant",    cx: 4.2,  cy: 10.9 },
    { t: "plant",    cx: 9.0,  cy: 10.9 },
  ];

  const LAMPS = TABLES.map((t) => ({ cx: t.cx, cy: t.cy }));

  // 바깥 — 인도 한 줄까지만. 여기를 넓히면 다시 "맵 데모"가 된다.
  const STREET_LAMPS = [[3.6, 12.6], [8.4, 12.6], [13.6, 7.4]];
  const PLANTERS = [[5.8, 12.5], [13.5, 4.6], [1.4, 12.2], [13.5, 10.2]];
  const BENCHES = [[10.6, 12.2]];

  /** 칸의 지형. 건물 밖은 인도 → 어두운 노면. 잔디는 없앴다. */
  function terrain(gx, gy) {
    if (gx >= 0 && gx < ROOM.w && gy >= 0 && gy < ROOM.d) return "floor";
    const d = Math.max(gy - ROOM.d, gx - ROOM.w, -gy - 1, -gx - 1);
    if (d >= 0 && d <= 4) return "plaza";
    if (d <= 8) return "street";
    return "dark";
  }

  // ---------------- 사람 ----------------
  // 생성 스프라이트는 색을 런타임에 못 바꾸니 다양성은 "종류 수"로 낸다.
  // 역할별 풀을 두고 자리 시드로 뽑는다 — 같은 의자엔 늘 같은 사람이 앉는다.
  const CAST = {
    dealer: ["dealerF", "dealerM"],
    seated: ["sitM", "sitF", "drinkM", "highroller", "cheerF"],
    seatedBack: ["backF", "backM"],       // 북쪽 자리 — 등이 보인다
    standing: ["hoodie", "cardigan", "dress", "watching", "manager"],
    walking: ["walkM", "walkF"],
  };

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    return (n ^ (n >>> 15)) >>> 0;
  }
  const pick = (pool, seed) => pool[hash(seed) % pool.length];

  const EMOTES = ["heart", "music", "cool", "chip", "beer"];

  /** 매장 안팎의 사람 전부. 자리는 고정, 말풍선과 걸음만 시간에 따라 변한다. */
  function buildCrowd() {
    const c = [];
    TABLES.forEach((t, ti) => {
      c.push({ gx: t.cx, gy: t.cy - SEAT_R - 0.15, sprite: CAST.dealer[ti % 2], seed: ti * 17 });
      for (let k = 1; k <= t.seats; k++) {
        const a = (SEAT_ANGLE[k] * Math.PI) / 180;
        const seed = ti * 100 + k * 7;
        const h = hash(seed);
        const back = Math.sin(a) < -0.3;
        c.push({
          gx: t.cx + Math.cos(a) * SEAT_R,
          gy: t.cy + Math.sin(a) * SEAT_R,
          sprite: back ? pick(CAST.seatedBack, seed) : pick(CAST.seated, seed),
          emote: h % 4 === 0 ? EMOTES[h % EMOTES.length] : null,
          seed,
        });
      }
      // 관전자 — 테이블 옆에 서서 구경. 홀이 비어 보이지 않게 하는 핵심이다.
      c.push({ gx: t.cx + 2.25, gy: t.cy + 0.6, sprite: pick(CAST.standing, ti * 31 + 9), seed: ti * 31 });
      if (ti % 2 === 1) {
        c.push({ gx: t.cx - 2.25, gy: t.cy + 0.9, sprite: pick(CAST.standing, ti * 53 + 4), seed: ti * 53,
                 emote: ti === 1 ? "cool" : null });
      }
    });

    LOUNGE.chairs.forEach((ch, i) => {
      if (i === 3) return; // 한 자리는 비워 둔다 — 전부 차 있으면 배치가 기계처럼 보인다
      const seed = 600 + i * 19;
      const back = ch[1] < LOUNGE.cy;
      c.push({ gx: ch[0], gy: ch[1] + 0.15, seed, emote: i === 0 ? "music" : null,
               sprite: back ? pick(CAST.seatedBack, seed) : pick(CAST.seated, seed) });
    });

    STOOLS.forEach((s, i) => {
      const seed = 900 + i * 13;
      c.push({ gx: s.cx, gy: s.cy - 0.1, sprite: pick(CAST.seated, seed), seed,
               emote: i === 1 ? "beer" : null });
    });
    c.push({ gx: BAR.cx - 1.3, gy: BAR.cy - 0.95, sprite: "bartender", seed: 777 });
    c.push({ gx: BAR.cx + 1.5, gy: BAR.cy - 0.95, sprite: "server", seed: 778 });
    // 바에서 주문 대기
    c.push({ gx: 3.5, gy: 1.9, sprite: "dress", seed: 781, emote: "beer" });
    c.push({ gx: 9.2, gy: 1.9, sprite: "hoodie", seed: 782 });

    // 홀을 도는 직원 — 쟁반은 스프라이트에 이미 들려 있다
    c.push({ gx: 5.4, gy: 5.2, sprite: "server", seed: 701,
             walk: { from: [3.0, 5.2], to: [9.4, 5.2], speed: 0.00016 } });
    c.push({ gx: 2.6, gy: 2.4, sprite: "manager", seed: 702,
             walk: { from: [2.0, 2.4], to: [9.6, 2.4], speed: 0.00011 } });
    c.push({ gx: 6.0, gy: 8.2, sprite: "server", seed: 703,
             walk: { from: [2.6, 8.2], to: [9.6, 8.2], speed: 0.00013 } });

    [
      { from: [1.3, 8.4], to: [4.2, 8.4] },
      { from: [11.4, 5.0], to: [11.4, 2.6] },
      { from: [0.5, 2.8], to: [0.5, 5.2] },
      { from: [7.2, 5.2], to: [3.4, 5.2] },
      { from: [10.2, 1.5], to: [10.2, 2.9] },
      { from: [9.6, 8.0], to: [6.2, 8.0] },
      { from: [3.0, 10.9], to: [6.0, 10.9] },
      { from: [11.2, 10.8], to: [8.6, 10.8] },
    ].forEach((r, i) => {
      const seed = 400 + i * 23;
      c.push({ gx: r.from[0], gy: r.from[1], sprite: pick(CAST.walking, seed), seed,
               walk: { from: r.from, to: r.to, speed: 0.00011 + i * 0.000022 } });
    });

    // 입구 밖 — 줄 선 손님. 매장이 잘 돌아간다는 신호라 몇 명 세워 둔다.
    [[12.8, 8.4], [13.3, 9.1], [13.1, 9.9], [12.5, 10.6]].forEach((g, i) => {
      const seed = 500 + i * 11;
      c.push({ gx: g[0], gy: g[1], sprite: pick(CAST.standing, seed), seed,
               outside: true, emote: i === 0 ? "heart" : i === 2 ? "chip" : null });
    });
    [
      { from: [0.5, 12.4], to: [6.5, 12.4] },
      { from: [10.5, 12.8], to: [5.5, 12.8] },
      { from: [13.8, 3.4], to: [13.8, 7.0] },
    ].forEach((r, i) => {
      const seed = 800 + i * 29;
      c.push({ gx: r.from[0], gy: r.from[1], sprite: pick(CAST.walking, seed), seed, outside: true,
               walk: { from: r.from, to: r.to, speed: 0.00009 + i * 0.00002 } });
    });
    return c;
  }

  let crowd = buildCrowd();

  // ---------------- 지형 ----------------
  function groundTile(ctx, gx, gy, kind) {
    const [x, y] = iso(gx + 1, gy + 1);
    const px = OX + x, py = OY + y;
    if (px < -TW || px > VIEW_W + TW || py < -TH * 2 || py > VIEW_H + TH * 2) return;
    const quad = [[px, py], [px + TW / 2, py - TH / 2], [px, py - TH], [px - TW / 2, py - TH / 2]];
    const even = ((gx + gy) & 1) === 0;
    if (kind === "dark") {
      PixelArt.poly(ctx, quad, PAL.dark);
    } else if (kind === "street") {
      PixelArt.poly(ctx, quad, even ? PAL.streetA : PAL.streetB);
    } else if (kind === "plaza") {
      PixelArt.poly(ctx, quad, even ? PAL.plazaA : PAL.plazaB);
      PixelArt.line(ctx, px - TW / 2, py - TH / 2, px, py - TH, PAL.plazaSeam);
      PixelArt.line(ctx, px, py - TH, px + TW / 2, py - TH / 2, PAL.plazaSeam);
    } else {
      PixelArt.poly(ctx, quad, even ? PAL.floorA : PAL.floorB);
      PixelArt.line(ctx, px - TW / 2, py - TH / 2, px, py - TH, PAL.seam);
      PixelArt.line(ctx, px, py - TH, px + TW / 2, py - TH / 2, PAL.seam);
      PixelArt.line(ctx, px - TW / 2 + 10, py - TH / 2 + 5, px + TW / 2 - 22, py - TH / 2 - 1, "rgba(120,84,56,0.13)");
      PixelArt.line(ctx, px - TW / 2 + 22, py - TH / 2 + 11, px + TW / 2 - 10, py - TH / 2 + 5, "rgba(120,84,56,0.13)");
    }
  }

  function drawGround(ctx) {
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 화면에 걸리는 격자만 돈다. gx, gy가 정수가 되는 (합, 차) 조합만 유효하다.
    for (let sum = -30; sum <= 64; sum++) {
      for (let diff = -14; diff <= 16; diff++) {
        if (((sum + diff) & 1) !== 0) continue;
        const gx = (sum + diff) / 2;
        const gy = (sum - diff) / 2;
        groundTile(ctx, gx, gy, terrain(gx, gy));
      }
    }
  }

  function drawWalls(ctx) {
    for (let gx = 0; gx < ROOM.w; gx++) {
      const [x, y] = iso(gx + 1, 0);
      const px = OX + x, py = OY + y;
      PixelArt.poly(ctx, [[px, py], [px - TW / 2, py - TH / 2], [px - TW / 2, py - TH / 2 - WALL_H], [px, py - WALL_H]], PAL.wallBack);
      PixelArt.poly(ctx, [[px, py], [px - TW / 2, py - TH / 2], [px - TW / 2, py - TH / 2 - WAIN], [px, py - WAIN]], PAL.wainBack);
      PixelArt.line(ctx, px, py - WAIN, px - TW / 2, py - TH / 2 - WAIN, PAL.trim);
      PixelArt.line(ctx, px, py - WAIN - 1, px - TW / 2, py - TH / 2 - WAIN - 1, PAL.trim);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H + 9], [px, py - WALL_H + 9]], PAL.beam);
    }
    for (let gy = 0; gy < ROOM.d; gy++) {
      const [x, y] = iso(0, gy + 1);
      const px = OX + x, py = OY + y;
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WALL_H], [px, py - WALL_H]], PAL.wallSide);
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WAIN], [px, py - WAIN]], PAL.wainSide);
      PixelArt.line(ctx, px, py - WAIN, px + TW / 2, py - TH / 2 - WAIN, PAL.trim);
      PixelArt.line(ctx, px, py - WAIN - 1, px + TW / 2, py - TH / 2 - WAIN - 1, PAL.trim);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H + 9], [px, py - WALL_H + 9]], PAL.beam);
    }
  }

  /**
   * 벽 위에 얹는 처마와 간판.
   * 여기서 85px쯤 벌어야 건물이 세로 화면을 채운다. 동시에 "가게 정면"으로 읽힌다.
   */
  function drawRoof(ctx) {
    const H = 26;
    const band = (ax, ay, bx, by, light) => {
      const [x1, y1] = iso(ax, ay), [x2, y2] = iso(bx, by);
      const p1 = [OX + x1, OY + y1 - WALL_H], p2 = [OX + x2, OY + y2 - WALL_H];
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] - H], [p1[0], p1[1] - H]], light ? PAL.roof : PAL.roofDark);
      PixelArt.poly(ctx, [[p1[0], p1[1] - H], [p2[0], p2[1] - H], [p2[0], p2[1] - H - 5], [p1[0], p1[1] - H - 5]], PAL.roofLight);
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] + 4], [p1[0], p1[1] + 4]], "#5e3b24");
    };
    for (let gx = 0; gx < ROOM.w; gx++) band(gx, 0, gx + 1, 0, true);
    for (let gy = 0; gy < ROOM.d; gy++) band(0, gy, 0, gy + 1, false);

    // 차양 줄무늬 — 북쪽 처마에만. 단색 띠보다 훨씬 "가게"처럼 보인다.
    for (let gx = 0; gx < ROOM.w; gx++) {
      if (gx % 2) continue;
      const [x1, y1] = iso(gx, 0), [x2, y2] = iso(gx + 1, 0);
      const p1 = [OX + x1, OY + y1 - WALL_H], p2 = [OX + x2, OY + y2 - WALL_H];
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] - H], [p1[0], p1[1] - H]], "#f0e3d4");
    }

    // 큰 간판 — 건물 화면 중심(두 벽이 만나는 모서리) 바로 위에 세운다.
    // 격자 좌표로 잡으면 한쪽으로 밀려 화면 밖으로 잘린다.
    const cx = Math.round(OX + ((ROOM.w - ROOM.d) / 2) * (TW / 2));
    const cy = Math.round(OY - WALL_H - 10);
    const w = 152, h = 46;
    PixelArt.rect(ctx, cx - w / 2 - 3, cy - h - 3, w + 6, h + 6, "#3a2a20");
    PixelArt.rect(ctx, cx - w / 2, cy - h, w, h, "#20303a");
    PixelArt.rect(ctx, cx - w / 2 + 3, cy - h + 3, w - 6, h - 6, "#1a2831");
    PixelFont.draw(ctx, cx, cy - h + 9, "HOLDEM PUB", "#ffd68f", 3, "center", 2);
    PixelFont.draw(ctx, cx, cy - h + 31, "CARDS  DRINKS  FRIENDS", "#8fb8c9", 1, "center", 1);
    for (let i = 0; i < 10; i++) PixelArt.rect(ctx, cx - w / 2 + 6 + i * 16, cy - h - 7, 3, 3, "#ffe9b0");
    // 지지대
    PixelArt.rect(ctx, cx - w / 2 + 12, cy, 4, 8, "#3a2a20");
    PixelArt.rect(ctx, cx + w / 2 - 16, cy, 4, 8, "#3a2a20");

    // 깃발 가랜드 — 처마 아래를 따라. 촘촘함과 귀여움을 동시에 번다.
    const flagCols = ["#e8626a", "#f0c04a", "#5aa254", "#5f8fd9", "#c98fd0"];
    for (let i = 0; i < ROOM.w * 2; i++) {
      const g = i / 2;
      const [x1, y1] = iso(g, 0);
      const px = OX + x1, py = OY + y1 - WALL_H + 14 + (i % 2 ? 3 : 0);
      PixelArt.poly(ctx, [[px - 4, py], [px + 4, py], [px, py + 9]], flagCols[i % flagCols.length]);
    }
    for (let i = 0; i < ROOM.d * 2; i++) {
      const g = i / 2;
      const [x1, y1] = iso(0, g);
      const px = OX + x1, py = OY + y1 - WALL_H + 14 + (i % 2 ? 3 : 0);
      PixelArt.poly(ctx, [[px - 4, py], [px + 4, py], [px, py + 9]], flagCols[(i + 2) % flagCols.length]);
    }
  }

  // ---------------- 벽 장식 ----------------
  // 벽이 150px이라 두 줄로 건다. 윗줄은 큰 것, 아랫줄은 작은 것.
  const NORTH_DECO = [
    { gx: 0.8, t: "frame", c: "#a8c4d9", row: 0 },
    { gx: 1.9, t: "lamp", row: 0 },
    { gx: 3.0, t: "sign", lines: ["GOOD CARDS", "GOOD PEOPLE"], row: 0 },
    { gx: 9.6, t: "neon", text: "POKER", row: 0 },
    { gx: 11.0, t: "lamp", row: 0 },
    { gx: 11.9, t: "dart", row: 0 },
    { gx: 1.4, t: "shelf", row: 1 },
    { gx: 4.4, t: "frame", c: "#d9a8b5", row: 1 },
    { gx: 6.2, t: "clock", row: 1 },
    { gx: 8.2, t: "frame", c: "#c9a24a", row: 1 },
    { gx: 10.4, t: "shelf", row: 1 },
  ];
  const WEST_DECO = [
    { gy: 1.5, t: "frame", c: "#d9a8b5", row: 0 },
    { gy: 2.8, t: "lamp", row: 0 },
    { gy: 4.4, t: "menu", row: 0 },
    { gy: 6.2, t: "frame", c: "#c9a24a", row: 0 },
    { gy: 7.6, t: "lamp", row: 0 },
    { gy: 9.2, t: "dart", row: 0 },
    { gy: 2.2, t: "shelf", row: 1 },
    { gy: 5.4, t: "clock", row: 1 },
    { gy: 8.4, t: "shelf", row: 1 },
  ];

  function wallLamp(ctx, px, py) {
    for (let r = 24; r > 4; r -= 4) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = PAL.glow;
      ctx.fillRect(px - r, py - r / 2 + 4, r * 2, r);
    }
    ctx.globalAlpha = 1;
    PixelArt.rect(ctx, px - 1, py - 12, 2, 8, "#6b4630");
    PixelArt.rect(ctx, px - 7, py - 4, 14, 3, "#8a5c3a");
    PixelArt.rect(ctx, px - 6, py - 1, 12, 8, PAL.glow);
    PixelArt.rect(ctx, px - 5, py + 7, 10, 2, "#ffeec4");
    PixelArt.rect(ctx, px - 7, py - 4, 14, 1, "#a87249");
  }
  function wallFrame(ctx, px, py, c) {
    PixelArt.rect(ctx, px - 13, py - 16, 26, 32, "#6b4630");
    PixelArt.rect(ctx, px - 11, py - 14, 22, 28, "#8a5c3a");
    PixelArt.rect(ctx, px - 9, py - 12, 18, 24, c);
    PixelArt.rect(ctx, px - 9, py + 4, 18, 8, PixelArt.shade(c, -0.22));
    PixelArt.rect(ctx, px - 6, py - 9, 5, 5, "#ffffff");
  }
  function wallSign(ctx, px, py, lines) {
    const w = Math.max(56, PixelFont.measure(lines[0], 1) + 14);
    const h = lines.length > 1 ? 26 : 18;
    PixelArt.rect(ctx, px - w / 2 - 2, py - h - 2, w + 4, h + 4, "#4a3226");
    PixelArt.rect(ctx, px - w / 2, py - h, w, h, "#2f2119");
    PixelFont.block(ctx, px, py - h + 6, lines, "#f2e4c0", 1, 3);
    for (let i = 0; i * 8 < w; i++) PixelArt.rect(ctx, px - w / 2 + 3 + i * 8, py - h - 5, 2, 2, "#e8b84a");
  }
  function neonSign(ctx, px, py, text) {
    const w = PixelFont.measure(text, 2) + 18;
    ctx.globalAlpha = 0.25;
    PixelArt.rect(ctx, px - w / 2 - 5, py - 26, w + 10, 32, "#e85a7a");
    ctx.globalAlpha = 1;
    PixelArt.rect(ctx, px - w / 2, py - 22, w, 24, "#2a2030");
    PixelArt.rect(ctx, px - w / 2 + 2, py - 20, w - 4, 20, "#1c1626");
    PixelFont.draw(ctx, px, py - 14, text, "#ff8fa8", 2, "center", 2);
  }
  function wallMenu(ctx, px, py) {
    PixelArt.rect(ctx, px - 16, py - 20, 32, 40, "#3a2a20");
    PixelArt.rect(ctx, px - 14, py - 18, 28, 36, "#20303a");
    PixelFont.draw(ctx, px, py - 15, "MENU", "#f2e4c0", 1, "center", 1);
    for (let i = 0; i < 5; i++) PixelArt.rect(ctx, px - 10, py - 7 + i * 5, 14 - (i % 3) * 3, 2, "rgba(232,228,208,0.6)");
  }
  function dartBoard(ctx, px, py) {
    const E = (r, c) => PixelSprites.ellipse(ctx, px, py, r, r, c);
    E(14, "#2f2a2a"); E(12, "#e8ddc4"); E(9, "#b8413f"); E(6, "#e8ddc4"); E(4, "#3f7a4a"); E(2, "#b8413f");
  }
  /** 벽 선반 — 작은 소품을 얹어 벽면 밀도를 올린다. */
  function wallShelf(ctx, px, py) {
    PixelArt.rect(ctx, px - 18, py, 36, 3, "#6b4630");
    PixelArt.rect(ctx, px - 18, py - 1, 36, 1, "#8a5c3a");
    const cols = ["#5aa254", "#e0a84a", "#c9504a", "#5f8fd9", "#c98fd0"];
    for (let i = 0; i < 5; i++) {
      const x = px - 15 + i * 7;
      const h = 7 + (i % 3) * 3;
      PixelArt.rect(ctx, x, py - h, 4, h, cols[i]);
      PixelArt.rect(ctx, x + 1, py - h - 2, 2, 2, PixelArt.shade(cols[i], -0.3));
    }
  }
  function wallClock(ctx, px, py) {
    PixelSprites.ellipse(ctx, px, py, 11, 11, "#6b4630");
    PixelSprites.ellipse(ctx, px, py, 9, 9, "#f4ecd8");
    PixelArt.rect(ctx, px - 1, py - 6, 2, 7, "#3a2a20");
    PixelArt.rect(ctx, px, py - 1, 5, 2, "#b8413f");
  }

  function drawWallDecor(ctx) {
    const rowY = [78, 26]; // 벽 아래에서 잰 높이 — 윗줄 / 아랫줄
    for (const d of NORTH_DECO) {
      const [x, y] = iso(d.gx, 0);
      const px = Math.round(OX + x - TW / 4);
      const py = Math.round(OY + y - TH / 4 - rowY[d.row]);
      if (d.t === "lamp") wallLamp(ctx, px, py);
      else if (d.t === "frame") wallFrame(ctx, px, py, d.c);
      else if (d.t === "sign") wallSign(ctx, px, py + 12, d.lines);
      else if (d.t === "neon") neonSign(ctx, px, py + 10, d.text);
      else if (d.t === "dart") dartBoard(ctx, px, py);
      else if (d.t === "shelf") wallShelf(ctx, px, py + 8);
      else if (d.t === "clock") wallClock(ctx, px, py);
    }
    for (const d of WEST_DECO) {
      const [x, y] = iso(0, d.gy);
      const px = Math.round(OX + x + TW / 4);
      const py = Math.round(OY + y - TH / 4 - rowY[d.row]);
      if (d.t === "lamp") wallLamp(ctx, px, py);
      else if (d.t === "frame") wallFrame(ctx, px, py, d.c);
      else if (d.t === "menu") wallMenu(ctx, px, py);
      else if (d.t === "dart") dartBoard(ctx, px, py);
      else if (d.t === "shelf") wallShelf(ctx, px, py + 8);
      else if (d.t === "clock") wallClock(ctx, px, py);
    }
  }

  // ---------------- 코드로 그리는 소품 ----------------
  function plant(ctx, px, py) {
    PixelArt.rect(ctx, px - 11, py - 16, 22, 16, "#a8613c");
    PixelArt.rect(ctx, px - 11, py - 16, 22, 3, "#c4794f");
    PixelArt.rect(ctx, px - 9, py - 2, 18, 3, "#8a4e30");
    PixelArt.rect(ctx, px - 1, py - 30, 3, 15, "#4f7a3a");
    const leaf = (dx, dy, w, h, c) => PixelSprites.ellipse(ctx, px + dx, py + dy, w, h, c);
    leaf(-12, -34, 11, 7, "#4f8f4a"); leaf(12, -33, 11, 7, "#4f8f4a");
    leaf(-6, -44, 10, 8, "#5aa254"); leaf(7, -43, 10, 8, "#5aa254");
    leaf(0, -50, 12, 9, "#6bb560"); leaf(-3, -40, 8, 6, "#3f7a3f");
  }
  function planter(ctx, px, py) {
    PixelArt.rect(ctx, px - 16, py - 14, 32, 14, "#9a8a72");
    PixelArt.rect(ctx, px - 16, py - 14, 32, 3, "#b4a48a");
    PixelSprites.ellipse(ctx, px - 7, py - 20, 10, 7, "#4f8f4a");
    PixelSprites.ellipse(ctx, px + 6, py - 21, 11, 8, "#5aa254");
    PixelSprites.ellipse(ctx, px, py - 26, 9, 7, "#63b85c");
    PixelArt.rect(ctx, px - 9, py - 24, 2, 2, "#e86a8a");
    PixelArt.rect(ctx, px + 7, py - 26, 2, 2, "#f0c04a");
  }
  function bench(ctx, px, py) {
    PixelSprites.ellipse(ctx, px, py, 26, 8, "rgba(20,14,10,0.22)");
    for (const dx of [-18, 14]) {
      PixelArt.rect(ctx, px + dx, py - 14, 4, 14, "#4a4a52");
      PixelArt.rect(ctx, px + dx, py - 30, 4, 16, "#4a4a52");
    }
    for (let i = 0; i < 3; i++) PixelArt.rect(ctx, px - 24, py - 18 + i * 3, 48, 2, i % 2 ? "#a8764a" : "#96683f");
    for (let i = 0; i < 3; i++) PixelArt.rect(ctx, px - 22, py - 34 + i * 5, 44, 3, i % 2 ? "#a8764a" : "#96683f");
  }
  function streetLamp(ctx, px, py) {
    PixelSprites.ellipse(ctx, px, py, 12, 5, "rgba(20,14,10,0.25)");
    PixelArt.rect(ctx, px - 4, py - 6, 8, 6, "#3a3a44");
    PixelArt.rect(ctx, px - 2, py - 74, 4, 68, "#42424e");
    PixelArt.rect(ctx, px - 2, py - 74, 2, 68, "#55555f");
    PixelArt.rect(ctx, px - 9, py - 88, 18, 6, "#3a3a44");
    PixelArt.rect(ctx, px - 7, py - 82, 14, 9, PAL.glow);
    PixelArt.rect(ctx, px - 5, py - 73, 10, 2, "#ffeec4");
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.045 * i;
      PixelSprites.ellipse(ctx, px, py - 74, 14 + i * 11, 10 + i * 8, PAL.glow);
    }
    ctx.globalAlpha = 1;
  }
  function rug(ctx, cx, cy, r, c1, c2) {
    for (let i = 0; i < 3; i++) {
      const rr = r - i * 0.22;
      PixelSprites.ellipse(ctx, cx, cy, rr * TW * 0.5, rr * TH * 0.5, i % 2 ? c2 : c1);
    }
  }
  function hangingLamp(ctx, px, py) {
    PixelArt.rect(ctx, px - 1, py - 150, 2, 78, "#3a2a20");
    PixelArt.poly(ctx, [[px - 17, py - 60], [px + 17, py - 60], [px + 9, py - 74], [px - 9, py - 74]], "#3f2f24");
    PixelArt.poly(ctx, [[px - 15, py - 61], [px + 15, py - 61], [px + 8, py - 72], [px - 8, py - 72]], "#5c4331");
    PixelArt.rect(ctx, px - 14, py - 61, 28, 3, PAL.glow);
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.05 - i * 0.006;
      ctx.fillStyle = PAL.glow;
      const w = 30 + i * 9;
      ctx.fillRect(px - w / 2, py - 58 + i * 8, w, 8);
    }
    ctx.globalAlpha = 1;
  }
  function lightPool(ctx, px, py) {
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.04 * i;
      PixelSprites.ellipse(ctx, px, py, 26 + i * 16, 13 + i * 8, PAL.glow);
    }
    ctx.globalAlpha = 1;
  }

  /** 건물 외벽 — 남/동쪽 가장자리. 동쪽 gy 8~9는 비워 입구로 쓴다. */
  function facade(ctx) {
    const H = 30;
    const face = (ax, ay, bx, by, top, side) => {
      const [x1, y1] = iso(ax, ay), [x2, y2] = iso(bx, by);
      const p1 = [OX + x1, OY + y1], p2 = [OX + x2, OY + y2];
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] + H], [p1[0], p1[1] + H]], side);
      PixelArt.poly(ctx, [[p1[0], p1[1] - 3], [p2[0], p2[1] - 3], p2, p1], top);
    };
    for (let gx = 0; gx < ROOM.w; gx++) face(gx, ROOM.d, gx + 1, ROOM.d, "#c2704a", "#8a5c3a");
    for (let gy = 0; gy < ROOM.d; gy++) {
      if (gy === 8 || gy === 9) continue;
      face(ROOM.w, gy + 1, ROOM.w, gy, "#c2704a", "#7d5133");
    }
  }

  /** 입구 — 동쪽 외벽의 빈칸 위에 문·차양. 화면 오른쪽 아래, 사람이 드나드는 쪽. */
  function entranceSign(ctx) {
    const [x, y] = iso(ROOM.w, 8.6);
    const px = Math.round(OX + x), py = Math.round(OY + y);
    PixelArt.poly(ctx, [[px, py + 4], [px, py - 48], [px + 34, py - 65], [px + 34, py - 13]], "#5e3b24");
    PixelArt.poly(ctx, [[px + 3, py], [px + 3, py - 46], [px + 31, py - 60], [px + 31, py - 14]], "#a8764a");
    PixelArt.rect(ctx, px + 24, py - 35, 3, 4, "#e8c86a");
    PixelArt.poly(ctx, [[px - 4, py - 48], [px + 38, py - 69], [px + 46, py - 57], [px + 4, py - 36]], "#8f3b3b");
    for (let i = 0; i < 4; i++) {
      const a = px - 4 + i * 10, b = py - 48 - i * 5;
      PixelArt.poly(ctx, [[a, b], [a + 5, b - 2], [a + 13, b + 10], [a + 8, b + 12]], "#f0e3d4");
    }
    PixelArt.poly(ctx, [[px + 4, py - 36], [px + 46, py - 57], [px + 46, py - 47], [px + 4, py - 26]], "#5e2828");
    PixelFont.draw(ctx, px + 25, py - 45, "OPEN", "#ffd68f", 1, "center", 1);
  }

  // ---------------- 말풍선 ----------------
  function emote(ctx, x, y, kind, t) {
    const py = Math.round(y - 12 + Math.sin(t * 0.0035) * 2);
    PixelArt.rect(ctx, x - 14, py - 20, 28, 20, PAL.ink);
    PixelArt.rect(ctx, x - 13, py - 19, 26, 18, "#fffdf6");
    PixelArt.rect(ctx, x - 3, py, 6, 4, PAL.ink);
    PixelArt.rect(ctx, x - 2, py, 4, 3, "#fffdf6");
    const C = { heart: "#e8506a", music: "#5f8fd9", cool: "#f0b43a", chip: "#4f9a6a", beer: "#e0a84a" }[kind];
    if (kind === "heart") {
      PixelArt.rect(ctx, x - 6, py - 15, 4, 3, C); PixelArt.rect(ctx, x + 2, py - 15, 4, 3, C);
      PixelArt.rect(ctx, x - 7, py - 13, 14, 4, C); PixelArt.rect(ctx, x - 5, py - 9, 10, 3, C);
      PixelArt.rect(ctx, x - 3, py - 6, 6, 2, C); PixelArt.rect(ctx, x - 1, py - 4, 2, 1, C);
    } else if (kind === "music") {
      PixelArt.rect(ctx, x + 1, py - 16, 3, 11, C);
      PixelArt.rect(ctx, x - 5, py - 7, 7, 5, C);
      PixelArt.rect(ctx, x + 1, py - 16, 8, 3, C);
      PixelArt.rect(ctx, x + 6, py - 13, 3, 4, C);
    } else if (kind === "cool") {
      PixelArt.rect(ctx, x - 9, py - 13, 18, 6, "#33323a");
      PixelArt.rect(ctx, x - 8, py - 12, 6, 4, "#5a6a80");
      PixelArt.rect(ctx, x + 2, py - 12, 6, 4, "#5a6a80");
      PixelArt.rect(ctx, x - 9, py - 7, 5, 2, "#33323a"); PixelArt.rect(ctx, x + 4, py - 7, 5, 2, "#33323a");
    } else if (kind === "chip") {
      PixelSprites.ellipse(ctx, x, py - 7, 8, 5, PixelArt.shade(C, -0.3));
      PixelSprites.ellipse(ctx, x, py - 9, 8, 5, C);
      PixelSprites.ellipse(ctx, x, py - 9, 4, 3, "#f4f0e4");
    } else {
      PixelArt.rect(ctx, x - 5, py - 16, 10, 14, "#cfe6ee");
      PixelArt.rect(ctx, x - 5, py - 11, 10, 9, C);
      PixelArt.rect(ctx, x - 5, py - 16, 10, 4, "#fffdf6");
      PixelArt.rect(ctx, x + 5, py - 12, 3, 6, "#9dbecd");
    }
  }

  // ---------------- 굽기 ----------------
  // 지면·바닥·벽·처마·벽장식·러그·조명웅덩이 — 절대 안 움직이고 항상 맨 뒤인 것들.
  // 가구를 같이 굽지 않는 이유: 테이블 뒤에 앉은 손님이 테이블보다 먼저 그려져야 한다.
  let baked = null;
  function bake() {
    const surf = surfaceFactory(VIEW_W, VIEW_H);
    const ctx = surf.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    drawGround(ctx);
    drawWalls(ctx);
    drawRoof(ctx);
    drawWallDecor(ctx);
    for (const L of LAMPS) {
      const [x, y] = iso(L.cx, L.cy);
      lightPool(ctx, OX + x, OY + y + 18);
    }
    for (const tb of TABLES) {
      const [x, y] = iso(tb.cx, tb.cy);
      rug(ctx, OX + x, OY + y + 16, 1.9, "#9a5850", "#a8645a");
    }
    {
      const [x, y] = iso(LOUNGE.cx, LOUNGE.cy);
      rug(ctx, OX + x, OY + y + 10, 1.6, "#8a6f4e", "#9a7f5c");
    }
    baked = surf;
    return surf;
  }

  // ---------------- 렌더 ----------------
  /**
   * 이 순간 이 사람이 어디에 있고 몇 px 들썩이는지.
   * 스프라이트가 한 장뿐이라 걸음은 프레임 교체가 아니라 1px 상하 흔들림으로 낸다.
   */
  function actorAt(n, t) {
    let gx = n.gx, gy = n.gy, bob = 0;
    if (n.walk) {
      const k = (Math.sin(t * n.walk.speed + (n.seed % 7)) + 1) / 2;
      gx = n.walk.from[0] + (n.walk.to[0] - n.walk.from[0]) * k;
      gy = n.walk.from[1] + (n.walk.to[1] - n.walk.from[1]) * k;
      bob = Math.floor(t / 200 + n.seed) % 2 ? -1 : 0;
    }
    return { gx, gy, bob };
  }

  /** 접지 그림자 — 생성 스프라이트엔 그림자가 없어서 여기서 깔지 않으면 인물이 뜬다. */
  function footShadow(ctx, px, py, w) {
    ctx.globalAlpha = 0.22;
    PixelSprites.ellipse(ctx, px, py - 1, w, Math.max(3, w * 0.4), "#3a2618");
    ctx.globalAlpha = 1;
  }

  function render(canvas, t) {
    t = t || 0;
    if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) {
      canvas.width = VIEW_W;
      canvas.height = VIEW_H;
    }
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (!baked) bake();
    ctx.drawImage(baked, 0, 0);

    const items = [];
    const add = (d, fn) => items.push({ d, fn });

    const drawPerson = (n) => {
      const st = actorAt(n, t);
      const [x, y] = iso(st.gx, st.gy);
      const px = Math.round(OX + x), py = Math.round(OY + y);
      const im = IMG[n.sprite];
      if (!im) return;
      footShadow(ctx, px, py, Math.round(im.width * 0.42));
      ctx.drawImage(im, px - (im.width >> 1), py + st.bob - im.height);
      if (n.emote && Math.sin(t * 0.0004 + n.seed) > 0.2) {
        emote(ctx, px, py - im.height, n.emote, t + n.seed * 97);
      }
    };

    {
      const [x, y] = iso(BAR.cx, BAR.cy);
      const bx = OX + x, by = OY + y;
      add(BAR.cx + BAR.cy - 1.6, () => blit(ctx, "barShelf", bx - 6, by - 76));
      add(BAR.cx + BAR.cy, () => blit(ctx, "bar", bx, by + 16));
    }
    for (const p of PROPS) {
      const [x, y] = iso(p.cx, p.cy);
      const px = OX + x, py = OY + y;
      add(p.cx + p.cy, () => (p.t === "plant" ? plant(ctx, px, py) : blit(ctx, p.t, px, py)));
    }
    STOOLS.forEach((s) => {
      const [x, y] = iso(s.cx, s.cy);
      add(s.cx + s.cy, () => blit(ctx, "stool", OX + x, OY + y));
    });
    LOUNGE.chairs.forEach((ch) => {
      const [x, y] = iso(ch[0], ch[1]);
      add(ch[0] + ch[1] - 0.01, () => blit(ctx, "chairPrem", OX + x, OY + y));
    });

    TABLES.forEach((tb) => {
      SEAT_ANGLE.forEach((deg, k) => {
        if (k > tb.seats) return;
        const a = (deg * Math.PI) / 180;
        const gx = tb.cx + Math.cos(a) * SEAT_R;
        const gy = tb.cy + Math.sin(a) * SEAT_R;
        const [x, y] = iso(gx, gy);
        add(gx + gy - 0.01, () => blit(ctx, k === 0 ? "dealerChair" : tb.chair, OX + x, OY + y));
      });
      const [x, y] = iso(tb.cx, tb.cy);
      add(tb.cx + tb.cy, () => {
        // 2×2 발자국의 가장 앞 꼭짓점은 중심 + (1,1) → 화면 y로 +32. 거기에 바닥을 맞춘다.
        blit(ctx, tb.img, OX + x, OY + y + 30);
        // 칩과 카드는 상판 위에 — 상판 중앙은 중심에서 30px쯤 위다
        blit(ctx, "chipTray", OX + x + 2, OY + y - 26);
        blit(ctx, "chipM", OX + x - 34, OY + y - 14);
        blit(ctx, "chipS", OX + x + 32, OY + y - 12);
        blit(ctx, "chipL", OX + x + 14, OY + y - 6);
        blit(ctx, "cardDeck", OX + x - 14, OY + y - 8);
      });
    });

    for (const n of crowd) {
      if (n.outside) continue; // 밖에 선 사람은 외벽보다 앞 — 정렬 뒤에 따로 그린다
      const st = actorAt(n, t);
      add(st.gx + st.gy + 0.02, () => drawPerson(n));
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    for (const L of LAMPS) {
      const [x, y] = iso(L.cx, L.cy);
      hangingLamp(ctx, Math.round(OX + x), Math.round(OY + y));
    }

    facade(ctx);
    entranceSign(ctx);
    const outs = [];
    PLANTERS.forEach((g) => { const [x, y] = iso(g[0], g[1]); outs.push({ d: g[0] + g[1], fn: () => planter(ctx, Math.round(OX + x), Math.round(OY + y)) }); });
    BENCHES.forEach((g) => { const [x, y] = iso(g[0], g[1]); outs.push({ d: g[0] + g[1], fn: () => bench(ctx, Math.round(OX + x), Math.round(OY + y)) }); });
    STREET_LAMPS.forEach((g) => { const [x, y] = iso(g[0], g[1]); outs.push({ d: g[0] + g[1], fn: () => streetLamp(ctx, Math.round(OX + x), Math.round(OY + y)) }); });
    for (const n of crowd) if (n.outside) outs.push({ d: n.gx + n.gy, fn: () => drawPerson(n) });
    outs.sort((a, b) => a.d - b.d);
    for (const o of outs) o.fn();

    // 따뜻한 실내광 — 전체를 한 톤으로 묶는다
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#ffb964";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    return { width: VIEW_W, height: VIEW_H };
  }

  function start(canvas, basePath) {
    return load(basePath).then(() => {
      baked = null;
      const loop = (t) => { render(canvas, t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
  }

  return {
    start, render, load, useImages, buildCrowd, bake, setSurfaceFactory,
    iso, TW, TH, ROOM, VIEW_W, VIEW_H, OX, OY, WALL_H, SRC, TABLES, PAL,
    get crowd() { return crowd; },
    set crowd(v) { crowd = v; },
  };
})();

if (typeof window !== "undefined") window.PixelWorld = PixelWorld;

// WorldK — 카이로소프트형 타일 맵.
//
// 앞선 두 월드와 계열이 다르다. 섞어 쓸 수 없어 파일을 나눴다.
//   pixel-world.js : 타일 64 · 액터 60 (1세대)
//   world-v1.js    : 타일 96 · 액터 88 (디테일 아이소)
//   world-k.js     : 타일 32 · 액터 27 (이 파일)
//
// ── 왜 타일을 32까지 내렸나 ────────────────────────────────────────────
// 앞 버전은 "3D 렌더를 축소한 것"처럼 보였다. 원인은 셋이었다:
//   오브젝트가 크고 디테일이 많다 / 벽이 높아 원근이 생긴다 / 색 단계가 많다.
// 카이로소프트류는 반대다. 오브젝트가 작고 단순한 대신 개수가 3~4배 많고,
// 벽이 낮아 거의 지도처럼 보이며, 재질당 색이 2~3개다.
// 그래서 타일을 32×16으로 내리고 에셋을 "단순 도형 + 평면 3톤"으로 새로 뽑았다.
//
// ── 화면을 채우는 방법 ─────────────────────────────────────────────────
// 아이소 방은 화면에서 언제나 가로:세로 = 2:1 이다. 즉 폭 640이면 바닥은 320이 최대다.
// 벽을 더해도 건물은 400을 못 넘는다 — 9:16 화면(1138)을 건물만으로 채우는 건 불가능하다.
// 레퍼런스도 건물은 40% 남짓이고 나머지는 외부다. 다만 그 외부가 비어 있지 않다:
// 울타리 · 나무 · 포장길 · 가로등 · 화단 · 벤치 · 줄 선 손님으로 꽉 차 있다.
// 그래서 여기서도 건물 위아래를 "내용이 있는 외부"로 채운다.
//
// 좌표: 격자점 (gx, gy) → 화면 ((gx−gy)·16, (gx+gy)·8). 깊이는 (gx+gy) 오름차순.
const WorldK = (() => {
  const S = 2;                      // 화면 배율 — 에셋 1픽셀이 화면 2×2가 된다
  const TW = 32 * S, TH = 16 * S;
  const WALL_H = 56 * S, WAIN = 18 * S;
  const ROOM = { w: 12, d: 10 };

  const VIEW_W = 640, VIEW_H = 1138;
  const PAD_TOP = 300;
  const OX = ROOM.d * (TW / 2) + (VIEW_W - (ROOM.w + ROOM.d) * (TW / 2)) / 2;
  const OY = WALL_H + PAD_TOP;

  const iso = (gx, gy) => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2)];

  const PAL = {
    floorA: "#b98b58", floorB: "#ad7f4e", seam: "#8e6238", seamLo: "#c79a68",
    wallBack: "#f0ddc6", wallSide: "#e0cbb2",
    wainBack: "#8a5c36", wainSide: "#7a4f2e",
    rail: "#5c3a20", beam: "#4a2e18",
    grassA: "#6aa04e", grassB: "#5f9446", grassC: "#79ad5a",
    pathA: "#cfc0a2", pathB: "#c4b596", pathSeam: "#a89a7e",
    ink: "#2a1f1a", glow: "#ffd68f",
  };

  // ---------------- 에셋 ----------------
  const K = "assets/pixel/out/env_k/";
  const A = "assets/actors_world/";
  const SRC = {
    table: K + "301_table.png",
    chair: K + "302_chair.png",
    bar: K + "303_bar_counter.png",
    backBar: K + "304_back_bar.png",
    stool: K + "305_stool.png",
    fridge: K + "306_fridge.png",
    plantBig: K + "307_plant_big.png",
    plantSmall: K + "308_plant_small.png",
    rug: K + "309_rug.png",
    art: K + "310_wall_art.png",
    sign: K + "311_sign.png",
    lamp: K + "312_lamp.png",
    tree: K + "313_tree.png",
    fence: K + "314_fence.png",
    streetLamp: K + "315_street_lamp.png",
    bush: K + "316_bush.png",
    bench: K + "317_bench.png",
    door: K + "318_entrance_door.png",
    board: K + "319_sandwich_board.png",
    flowerBed: K + "320_flower_bed.png",
  };
  const ACT = {
    mc_stand: "male_customer/mc_standing", mc_walk1: "male_customer/mc_walking_1",
    mc_walk2: "male_customer/mc_walking_2", mc_sit: "male_customer/mc_seated",
    mc_back: "male_customer/mc_back_view", mc_cards: "male_customer/mc_checking_cards",
    mc_chips: "male_customer/mc_placing_chips", mc_watch: "male_customer/mc_watching_table",
    mc_happy: "male_customer/mc_happy_reaction", mc_idle: "male_customer/mc_waiting_idle",
    fc_stand: "female_customer/fc_standing", fc_walk1: "female_customer/fc_walking_1",
    fc_walk2: "female_customer/fc_walking_2", fc_sit: "female_customer/fc_seated",
    fc_back: "female_customer/fc_back_view", fc_cards: "female_customer/fc_checking_cards",
    fc_chips: "female_customer/fc_placing_chips", fc_watch: "female_customer/fc_watching_table",
    fc_happy: "female_customer/fc_happy_reaction", fc_idle: "female_customer/fc_waiting_idle",
    pd_deal: "poker_dealer/pd_dealing_cards", pd_chips: "poker_dealer/pd_handling_chips",
    pd_shuffle: "poker_dealer/pd_shuffling_cards", pd_present: "poker_dealer/pd_presenting_action",
    pd_collect: "poker_dealer/pd_collecting_pots", pd_stand: "poker_dealer/pd_standing",
    sv_stand: "server/sv_standing", sv_tray: "server/sv_carrying_tray",
    sv_tray1: "server/sv_walking_with_tray_1", sv_tray2: "server/sv_walking_with_tray_2",
    sv_serve: "server/sv_serving_drink", sv_order: "server/sv_taking_order",
  };
  for (const [k, v] of Object.entries(ACT)) SRC[k] = A + v + ".png";

  const IMG = {};
  function load(base) {
    base = base || "";
    return Promise.all(Object.keys(SRC).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(k); };
      im.onerror = () => { IMG[k] = null; res(k); };
      im.src = base + SRC[k];
    })));
  }
  function useImages(m) { Object.assign(IMG, m); baked = null; }
  let surfaceFactory = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  function setSurfaceFactory(fn) { surfaceFactory = fn; baked = null; }

  function blit(ctx, key, cx, baseY, flip) {
    const im = IMG[key];
    if (!im) return;
    const w = im.width * S, h = im.height * S;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(baseY - h);
    if (!flip) {
      ctx.drawImage(im, 0, 0, im.width, im.height, x0, y0, w, h);
      return;
    }
    for (let sx = 0; sx < im.width; sx++) {
      ctx.drawImage(im, sx, 0, 1, im.height, x0 + (im.width - 1 - sx) * S, y0, S, h);
    }
  }
  /** 벽에 붙는 평면 그림을 아이소 벽 기울기에 눕힌다. dir +1 = 북쪽 벽, -1 = 서쪽 벽. */
  function blitWall(ctx, key, cx, cy, dir) {
    const im = IMG[key];
    if (!im) return;
    const w = im.width * S, h = im.height * S;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2) - Math.round((w / 4) * dir);
    for (let x = 0; x < im.width; x++) {
      ctx.drawImage(im, x, 0, 1, im.height, x0 + x * S, y0 + Math.round(x * S * 0.5 * dir), S, h);
    }
  }

  // ---------------- 배치 ----------------
  // 테이블은 2×2 발자국 = 화면 폭 128px. 의자는 반지름 2.5칸 고리.
  //   고리의 화면 반폭 = 1.6 × 32 × √2 ≈ 72px → 상판(반폭 64) 바로 바깥에 앉는다.
  // 중심끼리 화면 x로 96px 이상 떨어뜨려야 옆 테이블 의자와 안 겹친다.
  const TABLES = [
    { cx: 2, cy: 3 }, { cx: 6, cy: 3 }, { cx: 10, cy: 3 },   // x 256 / 384 / 512
    { cx: 2, cy: 8 }, { cx: 6, cy: 8 }, { cx: 10, cy: 8 },   // x  96 / 224 / 352
  ];
  const SEAT_R = 1.6;
  const SEAT_ANGLE = [-90, -40, 5, 50, 95, 140, 185, 230];

  const BAR = { cx: 6, cy: 0.5 };
  const STOOLS = [3.6, 5.0, 6.4, 7.8].map((x) => ({ cx: x, cy: 1.6 }));

  // 벽 장식 — 벽이 56px이라 윗줄 34, 아랫줄 14.
  const DECO_N = [];
  for (let g = 0.8; g < ROOM.w; g += 1.4) {
    if (g > 3 && g < 9) continue;                   // 바와 백바가 가리는 구간
    DECO_N.push({ g, h: 34, a: g % 3.2 < 1.6 ? "art" : "sign" });
  }
  const DECO_W = [];
  for (let g = 0.8; g < ROOM.d; g += 1.4) DECO_W.push({ g, h: 34, a: g % 3.6 < 1.8 ? "art" : "sign" });

  // 실내 소품 — 개수로 밀도를 만든다
  const DECOR = [];
  for (let g = 1; g < ROOM.w - 0.5; g += 2.2) DECOR.push({ a: "plantSmall", cx: g, cy: 0.4 });
  for (let g = 1; g < ROOM.d - 0.5; g += 2.2) DECOR.push({ a: "plantSmall", cx: 0.4, cy: g });
  DECOR.push(
    { a: "plantBig", cx: 0.5, cy: 0.5 }, { a: "plantBig", cx: 11.5, cy: 0.5 },
    { a: "plantBig", cx: 0.5, cy: 9.5 }, { a: "plantBig", cx: 11.5, cy: 9.5 },
    { a: "fridge", cx: 10, cy: 0.4 }, { a: "fridge", cx: 2, cy: 0.4 },
    { a: "plantSmall", cx: 11.5, cy: 3 }, { a: "plantSmall", cx: 11.5, cy: 6.5 },
    { a: "bench", cx: 4, cy: 9.6 }, { a: "bench", cx: 8, cy: 9.6 },
    { a: "plantBig", cx: 6, cy: 9.6 }, { a: "plantSmall", cx: 0.4, cy: 5.5 }
  );

  // 바깥 — 비면 "떠 있는 판"이 된다. 뒤뜰과 앞마당을 오브젝트로 채운다.
  const OUT = [];
  for (let g = -3; g <= ROOM.w + 3; g += 1.6) OUT.push({ a: "fence", cx: g, cy: -2 });
  for (let g = -1.6; g <= ROOM.d + 3; g += 1.6) OUT.push({ a: "fence", cx: -2, cy: g });
  [[-4, -3.5], [-1, -5], [3, -6], [7, -6.5], [11, -5.5], [14, -4], [15.5, -1], [-5.5, 1], [16, 3]]
    .forEach(([x, y]) => OUT.push({ a: "tree", cx: x, cy: y }));
  [[-2.5, -4], [1, -5.5], [5, -6.2], [9, -6], [13, -5], [15, -2.5], [-4.5, 3]]
    .forEach(([x, y]) => OUT.push({ a: "bush", cx: x, cy: y }));
  [[2, 12.4], [8, 12.4], [14.4, 8], [14.4, 3]]
    .forEach(([x, y]) => OUT.push({ a: "streetLamp", cx: x, cy: y }));
  [[5, 12.2], [11, 12.2], [0.4, 12.2], [14.2, 5.5]]
    .forEach(([x, y]) => OUT.push({ a: "flowerBed", cx: x, cy: y }));
  [[1, 13.6], [6.5, 13.6], [12, 13.6], [15.4, 10]]
    .forEach(([x, y]) => OUT.push({ a: "bush", cx: x, cy: y }));
  [[3.5, 14.6], [10, 14.6]].forEach(([x, y]) => OUT.push({ a: "bench", cx: x, cy: y }));
  [[-2, 8], [-3, 13], [16, 7], [17, 13], [4, 16.5], [11, 16.5], [-1, 16]]
    .forEach(([x, y]) => OUT.push({ a: "tree", cx: x, cy: y }));

  const ENTRANCE = { gx: 9, gy: ROOM.d };

  /** 칸의 지형. 건물 앞 2줄은 포장길, 나머지는 잔디. */
  function terrain(gx, gy) {
    if (gx >= 0 && gx < ROOM.w && gy >= 0 && gy < ROOM.d) return "floor";
    const d = Math.max(gy - ROOM.d, gx - ROOM.w);
    if (d >= 0 && d <= 2) return "path";
    return "grass";
  }

  // ---------------- 사람 ----------------
  const SEATED = ["mc_sit", "fc_sit", "mc_cards", "fc_cards", "mc_chips", "fc_chips", "mc_happy", "fc_happy"];
  const SEATED_BACK = ["mc_back", "fc_back"];
  const STANDING = ["mc_watch", "fc_watch", "mc_idle", "fc_idle", "mc_stand", "fc_stand"];
  const DEALING = ["pd_deal", "pd_chips", "pd_shuffle", "pd_present", "pd_collect"];
  const WALK_CYCLE = [["mc_walk1", "mc_walk2"], ["fc_walk1", "fc_walk2"]];
  const TRAY_CYCLE = ["sv_tray1", "sv_tray2"];

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3); n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    return (n ^ (n >>> 15)) >>> 0;
  }
  const pick = (pool, seed) => pool[hash(seed) % pool.length];
  const EMOTES = ["heart", "music", "cool"];

  function buildCrowd() {
    const c = [];
    TABLES.forEach((t, ti) => {
      c.push({ gx: t.cx, gy: t.cy - SEAT_R - 0.3, sprite: pick(DEALING, ti * 17 + 5), seed: ti * 17 });
      for (let k = 1; k < SEAT_ANGLE.length; k++) {
        const a = (SEAT_ANGLE[k] * Math.PI) / 180;
        const seed = ti * 100 + k * 7;
        const back = Math.sin(a) < -0.35;
        c.push({
          gx: t.cx + Math.cos(a) * SEAT_R,
          gy: t.cy + Math.sin(a) * SEAT_R,
          // 테이블 왼쪽에 앉은 사람은 오른쪽(테이블 쪽)을 본다
          flip: Math.cos(a) - Math.sin(a) < 0,
          sprite: back ? pick(SEATED_BACK, seed) : pick(SEATED, seed),
          emote: hash(seed) % 6 === 0 ? EMOTES[hash(seed) % EMOTES.length] : null,
          seed,
        });
      }
      // 관전자 — 테이블마다 둘. 개수로 밀도를 만드는 게 이 스타일의 핵심이다.
      c.push({ gx: t.cx + 3.2, gy: t.cy + 0.6, sprite: pick(STANDING, ti * 31 + 3), seed: ti * 31, flip: true });
      c.push({ gx: t.cx - 3.2, gy: t.cy + 1.0, sprite: pick(STANDING, ti * 53 + 9), seed: ti * 53 });
    });

    STOOLS.forEach((s, i) => {
      c.push({ gx: s.cx, gy: s.cy - 0.15, sprite: pick(SEATED, 900 + i * 13), seed: 900 + i * 13,
               emote: i === 1 ? "music" : null });
    });
    c.push({ gx: BAR.cx - 2.4, gy: BAR.cy - 0.8, sprite: "sv_serve", seed: 770 });
    c.push({ gx: BAR.cx + 2.4, gy: BAR.cy - 0.8, sprite: "sv_order", seed: 771 });
    c.push({ gx: 3, gy: 1.8, sprite: "mc_idle", seed: 772 });
    c.push({ gx: 9, gy: 1.8, sprite: "fc_idle", seed: 773 });

    [[2, 5.6, 10, 5.6], [10, 9.4, 2, 9.4]].forEach((r, i) => {
      c.push({ gx: r[0], gy: r[1], cycle: TRAY_CYCLE, sprite: TRAY_CYCLE[0], seed: 700 + i * 11,
               walk: { from: [r[0], r[1]], to: [r[2], r[3]], speed: 0.00013 + i * 0.00003 } });
    });
    [
      [0.6, 4, 0.6, 8], [11.4, 4, 11.4, 8], [4, 5.6, 9, 5.6],
      [9, 9.5, 4, 9.5], [4, 1, 9, 1], [6, 6.5, 6, 2],
    ].forEach((r, i) => {
      const seed = 400 + i * 23;
      const cyc = WALK_CYCLE[hash(seed) % WALK_CYCLE.length];
      c.push({ gx: r[0], gy: r[1], cycle: cyc, sprite: cyc[0], seed,
               walk: { from: [r[0], r[1]], to: [r[2], r[3]], speed: 0.0001 + i * 0.00002 } });
    });
    [[10.6, 11.2], [11.4, 12], [10.8, 12.8], [9.8, 13.4]].forEach((g, i) => {
      c.push({ gx: g[0], gy: g[1], sprite: pick(STANDING, 500 + i * 11), seed: 500 + i * 11,
               outside: true, emote: i === 0 ? "heart" : null });
    });
    [[-1, 12.6, 7, 12.6], [12, 14, 3, 14]].forEach((r, i) => {
      const seed = 800 + i * 29;
      const cyc = WALK_CYCLE[hash(seed) % WALK_CYCLE.length];
      c.push({ gx: r[0], gy: r[1], cycle: cyc, sprite: cyc[0], seed, outside: true,
               walk: { from: [r[0], r[1]], to: [r[2], r[3]], speed: 0.00008 + i * 0.00002 } });
    });
    return c;
  }
  let crowd = buildCrowd();

  // ---------------- 지형 · 벽 ----------------
  function groundTile(ctx, gx, gy) {
    const [x, y] = iso(gx + 1, gy + 1);
    const px = OX + x, py = OY + y;
    if (px < -TW || px > VIEW_W + TW || py < -TH * 2 || py > VIEW_H + TH) return;
    const kind = terrain(gx, gy);
    const even = ((gx + gy) & 1) === 0;
    const quad = [[px, py], [px + TW / 2, py - TH / 2], [px, py - TH], [px - TW / 2, py - TH / 2]];
    if (kind === "grass") {
      PixelArt.poly(ctx, quad, even ? PAL.grassA : PAL.grassB);
      if (((gx * 7 + gy * 13) & 7) === 0) PixelArt.rect(ctx, px - 3, py - TH / 2 - 2, 5, 2, PAL.grassC);
      return;
    }
    if (kind === "path") {
      PixelArt.poly(ctx, quad, even ? PAL.pathA : PAL.pathB);
      PixelArt.line(ctx, px - TW / 2, py - TH / 2, px, py - TH, PAL.pathSeam);
      PixelArt.line(ctx, px, py - TH, px + TW / 2, py - TH / 2, PAL.pathSeam);
      return;
    }
    // 바닥 — 타일 네 변을 모두 긋는다. 격자가 보여야 "짓는 게임"으로 읽힌다.
    PixelArt.poly(ctx, quad, even ? PAL.floorA : PAL.floorB);
    PixelArt.line(ctx, px - TW / 2, py - TH / 2, px, py - TH, PAL.seam);
    PixelArt.line(ctx, px, py - TH, px + TW / 2, py - TH / 2, PAL.seam);
    PixelArt.line(ctx, px + TW / 2, py - TH / 2, px, py, PAL.seamLo);
    PixelArt.line(ctx, px, py, px - TW / 2, py - TH / 2, PAL.seamLo);
  }

  function drawGround(ctx) {
    ctx.fillStyle = PAL.grassB;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let sum = -40; sum <= 110; sum++) {
      for (let diff = -24; diff <= 24; diff++) {
        if (((sum + diff) & 1) !== 0) continue;
        groundTile(ctx, (sum + diff) / 2, (sum - diff) / 2);
      }
    }
  }

  function drawWalls(ctx) {
    for (let gx = 0; gx < ROOM.w; gx++) {
      const [x, y] = iso(gx + 1, 0);
      const px = OX + x, py = OY + y;
      PixelArt.poly(ctx, [[px, py], [px - TW / 2, py - TH / 2], [px - TW / 2, py - TH / 2 - WALL_H], [px, py - WALL_H]], PAL.wallBack);
      PixelArt.poly(ctx, [[px, py], [px - TW / 2, py - TH / 2], [px - TW / 2, py - TH / 2 - WAIN], [px, py - WAIN]], PAL.wainBack);
      PixelArt.line(ctx, px, py - WAIN, px - TW / 2, py - TH / 2 - WAIN, PAL.rail);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H + 5], [px, py - WALL_H + 5]], PAL.beam);
    }
    for (let gy = 0; gy < ROOM.d; gy++) {
      const [x, y] = iso(0, gy + 1);
      const px = OX + x, py = OY + y;
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WALL_H], [px, py - WALL_H]], PAL.wallSide);
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WAIN], [px, py - WAIN]], PAL.wainSide);
      PixelArt.line(ctx, px, py - WAIN, px + TW / 2, py - TH / 2 - WAIN, PAL.rail);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H + 5], [px, py - WALL_H + 5]], PAL.beam);
    }
  }

  function facade(ctx) {
    const H = 18;
    const face = (ax, ay, bx, by, side) => {
      const [x1, y1] = iso(ax, ay), [x2, y2] = iso(bx, by);
      const p1 = [OX + x1, OY + y1], p2 = [OX + x2, OY + y2];
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] + H], [p1[0], p1[1] + H]], side);
      PixelArt.poly(ctx, [[p1[0], p1[1] - 2], [p2[0], p2[1] - 2], p2, p1], "#b0683f");
    };
    for (let gx = 0; gx < ROOM.w; gx++) {
      if (gx >= ENTRANCE.gx - 1 && gx <= ENTRANCE.gx) continue;
      face(gx, ROOM.d, gx + 1, ROOM.d, "#7a4f2e");
    }
    for (let gy = 0; gy < ROOM.d; gy++) face(ROOM.w, gy + 1, ROOM.w, gy, "#6e462a");
  }

  // ---------------- 굽기 ----------------
  let baked = null;
  function bake() {
    const surf = surfaceFactory(VIEW_W, VIEW_H);
    const ctx = surf.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    drawGround(ctx);
    drawWalls(ctx);
    for (const d of DECO_N) {
      const [x, y] = iso(d.g, 0);
      blitWall(ctx, d.a, OX + x - TW / 4, OY + y - TH / 4 - d.h, 1);
    }
    for (const d of DECO_W) {
      const [x, y] = iso(0, d.g);
      blitWall(ctx, d.a, OX + x + TW / 4, OY + y - TH / 4 - d.h, -1);
    }
    for (const t of TABLES) {
      const [x, y] = iso(t.cx, t.cy);
      blit(ctx, "rug", OX + x, OY + y + 44);
    }
    baked = surf;
    return surf;
  }

  // ---------------- 렌더 ----------------
  /**
   * 이 순간의 위치·스프라이트·바라보는 쪽.
   * flip은 "화면에서 왼쪽을 향한다"는 뜻이다. 아이소에서 화면 x가 줄어드는 방향은
   * 격자로 (gx−gy)가 줄어드는 쪽이므로, 그 부호로 판정한다.
   */
  function actorAt(n, t) {
    let gx = n.gx, gy = n.gy, bob = 0, sprite = n.sprite, flip = n.flip || false;
    if (n.walk) {
      const cycle = (Math.sin(t * n.walk.speed + (n.seed % 7)) + 1) / 2;
      gx = n.walk.from[0] + (n.walk.to[0] - n.walk.from[0]) * cycle;
      gy = n.walk.from[1] + (n.walk.to[1] - n.walk.from[1]) * cycle;
      // 왕복이라 진행 방향이 반 주기마다 뒤집힌다. 코사인 부호가 곧 진행 방향이다.
      const forward = Math.cos(t * n.walk.speed + (n.seed % 7)) > 0;
      const dx = (n.walk.to[0] - n.walk.from[0]) - (n.walk.to[1] - n.walk.from[1]);
      flip = forward ? dx < 0 : dx > 0;
      if (n.cycle) sprite = n.cycle[Math.floor(t / 240 + n.seed) % n.cycle.length];
      else bob = Math.floor(t / 200 + n.seed) % 2 ? -1 : 0;
    }
    return { gx, gy, bob, sprite, flip };
  }

  function emote(ctx, x, y, kind, t) {
    const py = Math.round(y - 6 + Math.sin(t * 0.0035));
    PixelArt.rect(ctx, x - 8, py - 12, 16, 12, PAL.ink);
    PixelArt.rect(ctx, x - 7, py - 11, 14, 10, "#fffdf6");
    PixelArt.rect(ctx, x - 2, py, 4, 3, PAL.ink);
    const C = { heart: "#e8506a", music: "#5f8fd9", cool: "#f0b43a" }[kind];
    if (kind === "heart") {
      PixelArt.rect(ctx, x - 4, py - 9, 3, 2, C); PixelArt.rect(ctx, x + 1, py - 9, 3, 2, C);
      PixelArt.rect(ctx, x - 4, py - 7, 8, 3, C); PixelArt.rect(ctx, x - 2, py - 4, 4, 2, C);
    } else if (kind === "music") {
      PixelArt.rect(ctx, x + 1, py - 10, 2, 7, C);
      PixelArt.rect(ctx, x - 3, py - 4, 4, 3, C);
      PixelArt.rect(ctx, x + 1, py - 10, 5, 2, C);
    } else {
      PixelArt.rect(ctx, x - 5, py - 8, 10, 4, "#33323a");
      PixelArt.rect(ctx, x - 4, py - 7, 3, 2, "#6a7a90");
      PixelArt.rect(ctx, x + 1, py - 7, 3, 2, "#6a7a90");
    }
  }

  function render(canvas, t) {
    t = t || 0;
    if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) { canvas.width = VIEW_W; canvas.height = VIEW_H; }
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (!baked) bake();
    ctx.drawImage(baked, 0, 0);

    const items = [];
    const add = (d, fn) => items.push({ d, fn });

    // 바깥 소품 — 건물 뒤(합이 작은 것)는 먼저, 앞은 정렬에 함께 태운다
    for (const o of OUT) {
      const [x, y] = iso(o.cx, o.cy);
      const px = Math.round(OX + x), py = Math.round(OY + y);
      if (o.cx < 0 || o.cy < 0) blit(ctx, o.a, px, py);
      else add(o.cx + o.cy + 0.01, () => blit(ctx, o.a, px, py));
    }

    {
      const [x, y] = iso(BAR.cx, BAR.cy);
      add(BAR.cx + BAR.cy - 1.6, () => blit(ctx, "backBar", OX + x, OY + y - 26));
      add(BAR.cx + BAR.cy, () => blit(ctx, "bar", OX + x, OY + y + 20));
    }
    STOOLS.forEach((s) => {
      const [x, y] = iso(s.cx, s.cy);
      add(s.cx + s.cy, () => blit(ctx, "stool", OX + x, OY + y));
    });
    for (const d of DECOR) {
      const [x, y] = iso(d.cx, d.cy);
      add(d.cx + d.cy, () => blit(ctx, d.a, OX + x, OY + y));
    }
    TABLES.forEach((tb) => {
      SEAT_ANGLE.forEach((deg, k) => {
        const a = (deg * Math.PI) / 180;
        const gx = tb.cx + Math.cos(a) * (SEAT_R + 0.3), gy = tb.cy + Math.sin(a) * (SEAT_R + 0.3);
        const [x, y] = iso(gx, gy);
        const faceLeft = Math.cos(a) < 0;
        add(gx + gy - 0.05, () => blit(ctx, "chair", OX + x, OY + y, faceLeft));
      });
      const [x, y] = iso(tb.cx, tb.cy);
      // 3×3 발자국의 앞 꼭짓점은 중심 +(1.5,1.5) → 화면 y로 +24
      add(tb.cx + tb.cy, () => blit(ctx, "table", OX + x, OY + y + 32));
    });

    const drawPerson = (n) => {
      const st = actorAt(n, t);
      const [x, y] = iso(st.gx, st.gy);
      const px = Math.round(OX + x), py = Math.round(OY + y);
      const im = IMG[st.sprite];
      if (!im) return;
      ctx.globalAlpha = 0.2;
      PixelSprites.ellipse(ctx, px, py - 2, 7 * S, 3 * S, "#2a1c12");
      ctx.globalAlpha = 1;
      blit(ctx, st.sprite, px, py + st.bob * S, st.flip);
      if (n.emote && Math.sin(t * 0.0004 + n.seed) > 0.2) emote(ctx, px, py - im.height * S, n.emote, t + n.seed * 97);
    };
    for (const n of crowd) {
      if (n.outside) continue;
      const st = actorAt(n, t);
      add(st.gx + st.gy + 0.02, () => drawPerson(n));
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    // 천장 조명 — 테이블 위
    for (const tb of TABLES) {
      const [x, y] = iso(tb.cx, tb.cy);
      const px = Math.round(OX + x), py = Math.round(OY + y) - 26;
      PixelArt.rect(ctx, px - 1, py - 48, 2, 26, "#3a2a20");
      blit(ctx, "lamp", px, py);
    }

    facade(ctx);
    {
      const [x, y] = iso(ENTRANCE.gx, ENTRANCE.gy);
      blit(ctx, "door", Math.round(OX + x), Math.round(OY + y) + 14);
      const [bx, by] = iso(ENTRANCE.gx + 2.4, ENTRANCE.gy + 1.6);
      blit(ctx, "board", Math.round(OX + bx), Math.round(OY + by));
    }
    for (const n of crowd) if (n.outside) drawPerson(n);

    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#ffb964";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    return { width: VIEW_W, height: VIEW_H };
  }

  function start(canvas, base) {
    return load(base).then(() => {
      baked = null;
      const loop = (t) => { render(canvas, t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
  }

  return { start, render, load, useImages, bake, setSurfaceFactory, buildCrowd,
           iso, TW, TH, ROOM, VIEW_W, VIEW_H, OX, OY, SRC, TABLES,
           get crowd() { return crowd; } };
})();

if (typeof window !== "undefined") window.WorldK = WorldK;

// WorldV1 — Master Actor System v1 스케일의 월드 레이어.
//
// 이전 월드(js/pixel/pixel-world.js)와 계열이 다르다. 섞어 쓸 수 없어 파일을 나눴다.
//   이전: 타일 64×32 · 액터 60px · 테이블 122px
//   v1  : 타일 96×48 · 액터 88px · 테이블 192px
//
// ── 타일과 테이블 크기를 이렇게 정한 이유 ──────────────────────────────
// 목표 레퍼런스의 테이블:액터 비율은 약 4:1이다. 그래서 한 번 테이블을 288px로 키웠다가
// 되돌렸다. 레퍼런스가 4:1인 건 그쪽 캐릭터가 격자 대비 작아서다. 액터가 88px인 이상
// 테이블을 288로 하면 640 폭에 두 개밖에 안 들어가 "촘촘한 실내"가 불가능해진다.
// 2×2 발자국(192px)이 4~5개 테이블과 그 주변 밀도를 동시에 담는 유일한 값이다.
//
// ── 배치 규칙 ──────────────────────────────────────────────────────────
//   화면 x = (gx−gy)·48,  화면 y = (gx+gy)·24
//   테이블 중심 간격 Δgx=5 → 화면 x 240px, 테이블 192 → 48px 여유
//   앞뒤 줄은 화면 y로 100px 남짓 떨어진다. 테이블 높이가 153이라 앞줄이 뒷줄 아랫부분을
//   조금 가리는데, 이건 레퍼런스에서도 그렇다 — 겹침이 곧 밀도다.
//
// 가구와 사람은 전부 생성 에셋(assets/pixel/out/env_v1, assets/actors)이다.
// 코드로 그리는 건 바닥·벽·빛처럼 "면"인 것들뿐이다.
const WorldV1 = (() => {
  const TW = 64, TH = 32;
  const WALL_H = 84, WAIN = 26;
  const ROOM = { w: 12, d: 10 };
  // 액터 원본은 64×96(Master Actor v1)이다. 월드에는 정확히 절반으로 찍는다.
  // 2:1 축소는 픽셀아트가 안 뭉개지는 유일한 배율이고, 이 크기라야
  // 테이블(128)과의 비율이 3.2:1이 되어 레퍼런스(3.7)에 붙는다.
  // 96 타일에서 액터를 원본 크기로 쓰면 테이블 4개에 방이 768px이 되어 화면에서 128px이 잘렸다.
  const ACTOR_SCALE = 0.5;

  const VIEW_W = 640, VIEW_H = 1138;
  const PAD_TOP = 230;
  const OX = ROOM.d * (TW / 2) + (VIEW_W - (ROOM.w + ROOM.d) * (TW / 2)) / 2;
  const OY = WALL_H + PAD_TOP;

  const iso = (gx, gy) => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2)];

  const PAL = {
    floorA: "#b58453", floorB: "#a97748", seam: "#8d6038", seamLo: "#c08f5e",
    wallBack: "#f2e3d2", wallSide: "#e5d2be",
    wainBack: "#8a5c38", wainSide: "#7a4f30",
    rail: "#5e3b24", beam: "#4a2f1c",
    outA: "#3a2c22", outB: "#332720",
    ink: "#2a1f1a", glow: "#ffd68f",
  };

  // ---------------- 에셋 ----------------
  const ENV = "assets/pixel/out/env_v1/";
  const ACT = "assets/actors/";
  const SRC = {
    table6: ENV + "201_table_6seat.png",
    table8: ENV + "202_table_8seat.png",
    chair: ENV + "203_chair.png",
    chairPrem: ENV + "204_chair_premium.png",
    barCounter: ENV + "205_bar_counter.png",
    backBar: ENV + "206_back_bar_shelf.png",
    stool: ENV + "207_bar_stool.png",
    rugRound: ENV + "208_rug_round.png",
    rugRunner: ENV + "209_rug_runner.png",
    wallPanel: ENV + "210_wall_panel.png",
    wallLamp: ENV + "211_wall_lamp.png",
    pendant: ENV + "212_pendant_lamp.png",
    fridge: ENV + "213_drink_fridge.png",
    plantTall: ENV + "214_plant_tall.png",
    plantSmall: ENV + "215_plant_small.png",
    plantHang: ENV + "216_plant_hanging.png",
    artLarge: ENV + "217_framed_art_large.png",
    artSmall: ENV + "218_framed_art_small.png",
    dartboard: ENV + "219_dartboard.png",
    clock: ENV + "220_wall_clock.png",
    lantern: ENV + "221_hanging_lantern.png",
    signSlat: ENV + "222_sign_wood_slat.png",
    signBulb: ENV + "223_sign_bulb_frame.png",
    neonBeer: ENV + "224_neon_beer.png",
    boardSpade: ENV + "225_chalkboard_spade.png",
    marquee: ENV + "226_entrance_marquee.png",
    door: ENV + "227_entrance_door.png",
    sandwich: ENV + "228_sandwich_board.png",
    streetLamp: ENV + "229_street_lamp.png",
    sofa: ENV + "230_lounge_sofa.png",
    loungeTable: ENV + "231_lounge_table_round.png",
    cart: ENV + "232_service_cart.png",
    safe: ENV + "233_safe_cabinet.png",
    trophy: ENV + "234_trophy_stand.png",
    coatRack: ENV + "235_coat_rack.png",
    taps: ENV + "236_beer_tap_station.png",

    // Master Actor v1 — tools/sheet-slice.mjs 가 승인 시트에서 잘라낸 원본이다.
    // 재생성하지 않는다. 포즈 이름은 actor-manifest.mjs 의 SHEET 와 1:1이다.
    mc_standing: ACT + "male_customer/mc_standing.png",
    mc_walk1: ACT + "male_customer/mc_walking_1.png",
    mc_walk2: ACT + "male_customer/mc_walking_2.png",
    mc_seated: ACT + "male_customer/mc_seated.png",
    mc_back: ACT + "male_customer/mc_back_view.png",
    mc_cards: ACT + "male_customer/mc_checking_cards.png",
    mc_chips: ACT + "male_customer/mc_placing_chips.png",
    mc_watch: ACT + "male_customer/mc_watching_table.png",
    mc_happy: ACT + "male_customer/mc_happy_reaction.png",
    mc_idle: ACT + "male_customer/mc_waiting_idle.png",
    fc_standing: ACT + "female_customer/fc_standing.png",
    fc_walk1: ACT + "female_customer/fc_walking_1.png",
    fc_walk2: ACT + "female_customer/fc_walking_2.png",
    fc_seated: ACT + "female_customer/fc_seated.png",
    fc_back: ACT + "female_customer/fc_back_view.png",
    fc_cards: ACT + "female_customer/fc_checking_cards.png",
    fc_chips: ACT + "female_customer/fc_placing_chips.png",
    fc_watch: ACT + "female_customer/fc_watching_table.png",
    fc_happy: ACT + "female_customer/fc_happy_reaction.png",
    fc_idle: ACT + "female_customer/fc_waiting_idle.png",
    pd_standing: ACT + "poker_dealer/pd_standing.png",
    pd_deal: ACT + "poker_dealer/pd_dealing_cards.png",
    pd_chips: ACT + "poker_dealer/pd_handling_chips.png",
    pd_present: ACT + "poker_dealer/pd_presenting_action.png",
    pd_shuffle: ACT + "poker_dealer/pd_shuffling_cards.png",
    pd_collect: ACT + "poker_dealer/pd_collecting_pots.png",
    sv_standing: ACT + "server/sv_standing.png",
    sv_tray: ACT + "server/sv_carrying_tray.png",
    sv_tray1: ACT + "server/sv_walking_with_tray_1.png",
    sv_tray2: ACT + "server/sv_walking_with_tray_2.png",
    sv_serve: ACT + "server/sv_serving_drink.png",
    sv_order: ACT + "server/sv_taking_order.png",
  };

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

  /** 스프라이트를 (cx, baseY)에 바닥을 맞춰 얹는다. */
  function blit(ctx, key, cx, baseY, dy) {
    const im = IMG[key];
    if (!im) return 0;
    ctx.drawImage(im, Math.round(cx - im.width / 2), Math.round(baseY - im.height + (dy || 0)));
    return im.height;
  }

  /**
   * 벽면 부착물. 액자·간판·다트판은 정면(평면)으로 생성돼 있어 그대로 얹으면
   * 벽에서 떠 보인다. 1px 폭 세로 슬라이스로 잘라 x 한 칸당 y를 0.5씩 밀어
   * 아이소 벽 기울기에 눕힌다. dir=+1 은 북쪽 벽(오른쪽으로 갈수록 내려감), -1 은 서쪽 벽.
   */
  function blitWall(ctx, key, cx, cy, dir) {
    const im = IMG[key];
    if (!im) return;
    const x0 = Math.round(cx - im.width / 2);
    const y0 = Math.round(cy - im.height / 2) - Math.round((im.width / 4) * dir);
    for (let x = 0; x < im.width; x++) {
      ctx.drawImage(im, x, 0, 1, im.height, x0 + x, y0 + Math.round(x * 0.5 * dir), 1, im.height);
    }
  }

  // ---------------- 배치 ----------------
  // 테이블은 2×2 발자국. 의자는 반지름 1.6칸 고리에 앉는다.
  //   고리의 화면 반폭 = 1.6 × 32 × √2 ≈ 72px, 테이블 반폭 64 → 의자가 상판 바로 바깥.
  // 화면 좌표로 검산한 자리다. x = (gx−gy)·48 + OX, y = (gx+gy)·24 + OY.
  //   T1 x=272 y=+72 / T2 x=488 y=+180 / T3 x=104 y=+180 / T4 x=320 y=+288
  // 테이블 반폭이 96이라 x가 104~488이면 640 화면 안에 온전히 들어온다.
  // 화면 좌표로 검산한 자리다. x = (gx−gy)·32 + 288, y = (gx+gy)·16 + 330.
  // 테이블 반폭이 64라 중심 x가 83~493이면 640 화면 안에 온전히 들어온다.
  const TABLES = [
    { cx: 1.8,  cy: 1.8,  img: "table6", seats: 6, chair: "chairPrem" },
    { cx: 6.6,  cy: 1.6,  img: "table6", seats: 5, chair: "chair" },
    { cx: 1.6,  cy: 6.6,  img: "table8", seats: 6, chair: "chair" },
    { cx: 6.4,  cy: 6.4,  img: "table6", seats: 6, chair: "chairPrem" },
    { cx: 10.4, cy: 4.0,  img: "table6", seats: 5, chair: "chair" },
    { cx: 4.0,  cy: 10.4, img: "table6", seats: 5, chair: "chair" },
  ];
  const SEAT_R = 1.6;
  const SEAT_ANGLE = [-90, -40, 5, 50, 95, 140, 185, 230]; // 0번 = 딜러(북쪽)

  const BAR = { cx: 5.4, cy: 0.3 };
  const STOOLS = [3.6, 4.6, 5.6, 6.6].map((x) => ({ cx: x, cy: 1.35 }));

  // 벽 장식 — g는 벽을 따라가는 좌표, h는 바닥에서 잰 높이.
  // 북쪽 벽 gx 2.6~7.0 은 바 카운터와 백바가 가리므로 그 구간엔 높은 것만 건다.
  const DECO_N = [
    { g: 0.6,  h: 50, a: "artLarge" },
    { g: 1.9,  h: 50, a: "dartboard" },
    { g: 2.9,  h: 50, a: "signSlat" },
    { g: 8.0,  h: 50, a: "signBulb" },
    { g: 9.6,  h: 50, a: "neonBeer" },
    { g: 10.8, h: 50, a: "boardSpade" },
    { g: 11.8, h: 50, a: "artSmall" },
    { g: 1.2,  h: 20, a: "artSmall" },
    { g: 2.4,  h: 20, a: "clock" },
    { g: 11.2, h: 20, a: "clock" },
  ];
  const DECO_W = [
    { g: 0.7,  h: 50, a: "artLarge" },
    { g: 2.2,  h: 50, a: "boardSpade" },
    { g: 4.0,  h: 50, a: "artSmall" },
    { g: 5.2,  h: 50, a: "signSlat" },
    { g: 7.0,  h: 50, a: "dartboard" },
    { g: 8.6,  h: 50, a: "artSmall" },
    { g: 9.6,  h: 50, a: "boardSpade" },
    { g: 3.0,  h: 20, a: "clock" },
    { g: 6.2,  h: 20, a: "artSmall" },
    { g: 8.0,  h: 20, a: "clock" },
  ];
  const WALL_LAMPS_N = [1.4, 3.0, 8.2, 10.4];
  const WALL_LAMPS_W = [1.4, 3.4, 5.6, 7.8, 9.4];
  // 천장 등 — 테이블 위 펜던트와 별개로 통로 위에 매단다
  const LANTERNS = [[0.8, 4.4], [11.2, 4.4], [4.4, 9.4]];
  const HANG_PLANTS = [[0.8, 2.0], [11.2, 2.0]];

  // 바닥 소품 — 벽을 따라 두르고 구석을 메운다
  const DECOR = [
    { a: "plantTall",   cx: 0.30,  cy: 0.35 },
    { a: "plantTall",   cx: 11.70, cy: 0.35 },
    { a: "plantTall",   cx: 0.30,  cy: 9.65 },
    { a: "plantTall",   cx: 11.70, cy: 9.65 },
    { a: "plantSmall",  cx: 2.20,  cy: 0.30 },
    { a: "plantSmall",  cx: 0.30,  cy: 3.40 },
    { a: "plantSmall",  cx: 0.30,  cy: 6.40 },
    { a: "plantSmall",  cx: 11.70, cy: 2.60 },
    { a: "plantSmall",  cx: 11.70, cy: 7.40 },
    { a: "plantSmall",  cx: 8.80,  cy: 9.70 },
    { a: "fridge",      cx: 9.20,  cy: 0.30 },
    { a: "taps",        cx: 7.60,  cy: 0.30 },
    { a: "trophy",      cx: 1.30,  cy: 0.30 },
    { a: "coatRack",    cx: 0.30,  cy: 8.30 },
    { a: "safe",        cx: 11.70, cy: 5.40 },
    { a: "cart",        cx: 9.40,  cy: 2.30 },
    { a: "sofa",        cx: 2.60,  cy: 9.60 },
    { a: "loungeTable", cx: 1.20,  cy: 9.60 },
  ];

  // 입구 — 남쪽 외벽 gx 6 자리. 차양·문·입간판·가로등이 한 덩어리로 "가게 앞"을 만든다.
  const ENTRANCE = { gx: 8.6, gy: ROOM.d + 0.5 };

  // ---------------- 사람 ----------------
  // 앉은 손님은 카드 보기 · 칩 놓기 · 환호 · 그냥 앉기가 섞여야 "판이 돌아간다"로 읽힌다
  const SEATED = ["mc_seated", "fc_seated", "mc_cards", "fc_cards", "mc_chips", "fc_chips", "mc_happy", "fc_happy"];
  const SEATED_BACK = ["mc_back", "fc_back"];
  const STANDING = ["mc_watch", "fc_watch", "mc_idle", "fc_idle", "mc_standing", "fc_standing"];
  const DEALING = ["pd_deal", "pd_chips", "pd_shuffle", "pd_present", "pd_collect"];
  // 걷기는 2프레임이 있으므로 시간에 따라 갈아 끼운다
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
      c.push({ gx: t.cx, gy: t.cy - SEAT_R - 0.2, sprite: pick(DEALING, ti * 17 + 5), seed: ti * 17 });
      for (let k = 1; k <= t.seats; k++) {
        const a = (SEAT_ANGLE[k] * Math.PI) / 180;
        const seed = ti * 100 + k * 7;
        const back = Math.sin(a) < -0.35;
        c.push({
          gx: t.cx + Math.cos(a) * SEAT_R,
          gy: t.cy + Math.sin(a) * SEAT_R,
          sprite: back ? pick(SEATED_BACK, seed) : pick(SEATED, seed),
          emote: hash(seed) % 5 === 0 ? EMOTES[hash(seed) % EMOTES.length] : null,
          seed,
        });
      }
      // 관전자 — 테이블 한쪽에만. 양쪽에 세웠더니 상판이 안 보일 만큼 둘러쌌다.
      c.push({ gx: t.cx + 2.6, gy: t.cy + 0.4, sprite: pick(STANDING, ti * 31 + 3), seed: ti * 31 });
    });

    STOOLS.forEach((s, i) => {
      c.push({ gx: s.cx, gy: s.cy - 0.05, sprite: pick(SEATED, 900 + i * 13), seed: 900 + i * 13,
               emote: i === 1 ? "music" : null });
    });
    c.push({ gx: BAR.cx - 1.6, gy: BAR.cy - 0.7, sprite: "sv_serve", seed: 770 });
    c.push({ gx: BAR.cx + 1.4, gy: BAR.cy - 0.7, sprite: "sv_order", seed: 771 });
    c.push({ gx: BAR.cx + 2.6, gy: BAR.cy + 1.4, sprite: "mc_idle", seed: 772 });

    c.push({ gx: 5.6, gy: 4.6, cycle: TRAY_CYCLE, sprite: TRAY_CYCLE[0], seed: 701,
             walk: { from: [2.4, 4.6], to: [9.6, 4.6], speed: 0.00015 } });
    [
      { from: [0.6, 2.4], to: [0.6, 8.0] },
      { from: [11.4, 2.4], to: [11.4, 8.0] },
      { from: [2.2, 9.4], to: [9.2, 9.4] },
      { from: [9.4, 4.6], to: [3.0, 4.6] },
      { from: [4.4, 0.9], to: [9.4, 0.9] },
    ].forEach((r, i) => {
      const seed = 400 + i * 23;
      const cycle = WALK_CYCLE[hash(seed) % WALK_CYCLE.length];
      c.push({ gx: r.from[0], gy: r.from[1], cycle, sprite: cycle[0], seed,
               walk: { from: r.from, to: r.to, speed: 0.00011 + i * 0.00002 } });
    });
    return c;
  }
  let crowd = buildCrowd();

  // ---------------- 지형 · 벽 ----------------
  function groundTile(ctx, gx, gy) {
    const [x, y] = iso(gx + 1, gy + 1);
    const px = OX + x, py = OY + y;
    if (px < -TW || px > VIEW_W + TW || py < -TH * 2 || py > VIEW_H + TH) return;
    const inside = gx >= 0 && gx < ROOM.w && gy >= 0 && gy < ROOM.d;
    const even = ((gx + gy) & 1) === 0;
    const quad = [[px, py], [px + TW / 2, py - TH / 2], [px, py - TH], [px - TW / 2, py - TH / 2]];
    if (!inside) { PixelArt.poly(ctx, quad, even ? PAL.outA : PAL.outB); return; }
    PixelArt.poly(ctx, quad, even ? PAL.floorA : PAL.floorB);
    // 타일 네 변을 모두 긋는다. 두 변만 그으면 결처럼 보이고 격자가 안 읽힌다.
    PixelArt.line(ctx, px - TW / 2, py - TH / 2, px, py - TH, PAL.seam);
    PixelArt.line(ctx, px, py - TH, px + TW / 2, py - TH / 2, PAL.seam);
    PixelArt.line(ctx, px + TW / 2, py - TH / 2, px, py, PAL.seamLo);
    PixelArt.line(ctx, px, py, px - TW / 2, py - TH / 2, PAL.seamLo);
  }

  function drawGround(ctx) {
    ctx.fillStyle = PAL.outB;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let sum = -14; sum <= 40; sum++) {
      for (let diff = -12; diff <= 12; diff++) {
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
      for (let i = 0; i < 2; i++) PixelArt.line(ctx, px, py - WAIN - i, px - TW / 2, py - TH / 2 - WAIN - i, PAL.rail);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H], [px - TW / 2, py - TH / 2 - WALL_H + 12], [px, py - WALL_H + 12]], PAL.beam);
    }
    for (let gy = 0; gy < ROOM.d; gy++) {
      const [x, y] = iso(0, gy + 1);
      const px = OX + x, py = OY + y;
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WALL_H], [px, py - WALL_H]], PAL.wallSide);
      PixelArt.poly(ctx, [[px, py], [px + TW / 2, py - TH / 2], [px + TW / 2, py - TH / 2 - WAIN], [px, py - WAIN]], PAL.wainSide);
      for (let i = 0; i < 2; i++) PixelArt.line(ctx, px, py - WAIN - i, px + TW / 2, py - TH / 2 - WAIN - i, PAL.rail);
      PixelArt.poly(ctx, [[px, py - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H], [px + TW / 2, py - TH / 2 - WALL_H + 12], [px, py - WALL_H + 12]], PAL.beam);
    }
  }

  function lightPool(ctx, px, py, r) {
    for (let i = 5; i >= 1; i--) {
      ctx.globalAlpha = 0.032 * i;
      PixelSprites.ellipse(ctx, px, py, r + i * 18, (r + i * 18) * 0.5, PAL.glow);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- 굽기 ----------------
  let baked = null;
  function bake() {
    const surf = surfaceFactory(VIEW_W, VIEW_H);
    const ctx = surf.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    drawGround(ctx);
    drawWalls(ctx);
    // 벽 장식 — 벽면에 붙는 것이라 벽과 함께 구운다.
    // 북쪽 벽은 오른쪽으로 갈수록 화면에서 내려가고(dir +1), 서쪽 벽은 그 반대(dir -1)다.
    for (const d of DECO_N) {
      const [x, y] = iso(d.g, 0);
      blitWall(ctx, d.a, OX + x - TW / 4, OY + y - TH / 4 - d.h, 1);
    }
    for (const d of DECO_W) {
      const [x, y] = iso(0, d.g);
      blitWall(ctx, d.a, OX + x + TW / 4, OY + y - TH / 4 - d.h, -1);
    }
    for (const gx of WALL_LAMPS_N) {
      const [x, y] = iso(gx, 0);
      blit(ctx, "wallLamp", OX + x - TW / 4, OY + y - TH / 4 - 46);
    }
    for (const gy of WALL_LAMPS_W) {
      const [x, y] = iso(0, gy);
      blit(ctx, "wallLamp", OX + x + TW / 4, OY + y - TH / 4 - 46);
    }
    // 러그와 조명 웅덩이 — 가구보다 아래
    for (const t of TABLES) {
      const [x, y] = iso(t.cx, t.cy);
      lightPool(ctx, OX + x, OY + y + 14, 42);
      blit(ctx, "rugRound", OX + x, OY + y + 60);
    }
    {
      const [x, y] = iso(5.6, 4.6);
      blit(ctx, "rugRunner", OX + x, OY + y + 50);
    }
    baked = surf;
    return surf;
  }

  /** 앞쪽(남·동) 가장자리를 낮은 벽으로 막아 "건물"로 읽히게 한다. */
  function facade(ctx) {
    const H = 44;
    const face = (ax, ay, bx, by, top, side) => {
      const [x1, y1] = iso(ax, ay), [x2, y2] = iso(bx, by);
      const p1 = [OX + x1, OY + y1], p2 = [OX + x2, OY + y2];
      PixelArt.poly(ctx, [p1, p2, [p2[0], p2[1] + H], [p1[0], p1[1] + H]], side);
      PixelArt.poly(ctx, [[p1[0], p1[1] - 4], [p2[0], p2[1] - 4], p2, p1], top);
    };
    for (let gx = 0; gx < ROOM.w; gx++) face(gx, ROOM.d, gx + 1, ROOM.d, "#b0683f", "#7a4f30");
    for (let gy = 0; gy < ROOM.d; gy++) face(ROOM.w, gy + 1, ROOM.w, gy, "#b0683f", "#6e462a");
  }

  // ---------------- 렌더 ----------------
  function actorAt(n, t) {
    let gx = n.gx, gy = n.gy, bob = 0, sprite = n.sprite;
    if (n.walk) {
      const k = (Math.sin(t * n.walk.speed + (n.seed % 7)) + 1) / 2;
      gx = n.walk.from[0] + (n.walk.to[0] - n.walk.from[0]) * k;
      gy = n.walk.from[1] + (n.walk.to[1] - n.walk.from[1]) * k;
      if (n.cycle) sprite = n.cycle[Math.floor(t / 230 + n.seed) % n.cycle.length];
      else bob = Math.floor(t / 190 + n.seed) % 2 ? -1 : 0;
    }
    return { gx, gy, bob, sprite };
  }

  function footShadow(ctx, px, py, w) {
    ctx.globalAlpha = 0.24;
    PixelSprites.ellipse(ctx, px, py - 2, w, Math.max(4, w * 0.42), "#2a1c12");
    ctx.globalAlpha = 1;
  }

  function emote(ctx, x, y, kind, t) {
    const py = Math.round(y - 14 + Math.sin(t * 0.0035) * 2);
    PixelArt.rect(ctx, x - 16, py - 23, 32, 23, PAL.ink);
    PixelArt.rect(ctx, x - 15, py - 22, 30, 21, "#fffdf6");
    PixelArt.rect(ctx, x - 4, py, 8, 5, PAL.ink);
    PixelArt.rect(ctx, x - 3, py, 6, 4, "#fffdf6");
    const C = { heart: "#e8506a", music: "#5f8fd9", cool: "#f0b43a" }[kind];
    if (kind === "heart") {
      PixelArt.rect(ctx, x - 7, py - 18, 5, 4, C); PixelArt.rect(ctx, x + 2, py - 18, 5, 4, C);
      PixelArt.rect(ctx, x - 8, py - 15, 16, 5, C); PixelArt.rect(ctx, x - 6, py - 10, 12, 4, C);
      PixelArt.rect(ctx, x - 4, py - 6, 8, 3, C); PixelArt.rect(ctx, x - 1, py - 3, 2, 2, C);
    } else if (kind === "music") {
      PixelArt.rect(ctx, x + 1, py - 19, 4, 13, C);
      PixelArt.rect(ctx, x - 6, py - 8, 8, 6, C);
      PixelArt.rect(ctx, x + 1, py - 19, 9, 4, C);
    } else {
      PixelArt.rect(ctx, x - 10, py - 15, 20, 7, "#33323a");
      PixelArt.rect(ctx, x - 9, py - 14, 7, 5, "#6a7a90");
      PixelArt.rect(ctx, x + 2, py - 14, 7, 5, "#6a7a90");
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

    // 바 — 뒤 선반이 카운터보다 뒤
    {
      const [x, y] = iso(BAR.cx, BAR.cy);
      add(BAR.cx + BAR.cy - 2.0, () => blit(ctx, "backBar", OX + x, OY + y - 62));
      add(BAR.cx + BAR.cy, () => blit(ctx, "barCounter", OX + x, OY + y + 30));
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
        if (k > tb.seats) return;
        const a = (deg * Math.PI) / 180;
        // 의자는 앉는 사람보다 0.3칸 바깥 = 화면에서 조금 뒤. 그래야 등받이가 사람 뒤로 선다.
        const gx = tb.cx + Math.cos(a) * (SEAT_R + 0.3), gy = tb.cy + Math.sin(a) * (SEAT_R + 0.3);
        const [x, y] = iso(gx, gy);
        add(gx + gy - 0.04, () => blit(ctx, tb.chair, OX + x, OY + y));
      });
      const [x, y] = iso(tb.cx, tb.cy);
      // 2×2 발자국의 앞 꼭짓점은 중심 +(1,1) → 화면 y로 +48
      add(tb.cx + tb.cy, () => blit(ctx, tb.img, OX + x, OY + y + 32));
    });

    const drawPerson = (n) => {
      const st = actorAt(n, t);
      const [x, y] = iso(st.gx, st.gy);
      const px = Math.round(OX + x), py = Math.round(OY + y);
      const im = IMG[st.sprite];
      if (!im) return;
      const w = Math.round(im.width * ACTOR_SCALE), h = Math.round(im.height * ACTOR_SCALE);
      footShadow(ctx, px, py, Math.round(w * 0.38));
      ctx.drawImage(im, 0, 0, im.width, im.height, px - (w >> 1), py + st.bob - h, w, h);
      if (n.emote && Math.sin(t * 0.0004 + n.seed) > 0.15) emote(ctx, px, py - h, n.emote, t + n.seed * 97);
    };
    for (const n of crowd) {
      const st = actorAt(n, t);
      add(st.gx + st.gy + 0.03, () => drawPerson(n));
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();
    facade(ctx);

    // 펜던트 조명 — 테이블 위에 매달리므로 전부 위에
    for (const tb of TABLES) {
      const [x, y] = iso(tb.cx, tb.cy);
      const px = Math.round(OX + x), py = Math.round(OY + y) - 56;
      PixelArt.rect(ctx, px - 1, py - 114, 3, 50, "#2f241c");
      blit(ctx, "pendant", px, py);
    }

    // 천장에 매달린 것들 — 전부 앞에 온다
    for (const [gx, gy] of LANTERNS) {
      const [x, y] = iso(gx, gy);
      const px = Math.round(OX + x), py = Math.round(OY + y) - 86;
      PixelArt.rect(ctx, px - 1, py - 52, 3, 52, "#2f241c");
      blit(ctx, "lantern", px, py);
    }
    for (const [gx, gy] of HANG_PLANTS) {
      const [x, y] = iso(gx, gy);
      blit(ctx, "plantHang", Math.round(OX + x), Math.round(OY + y) - 92);
    }

    // 입구 — 외벽 위에 차양·간판, 그 앞에 문과 입간판·가로등
    {
      const [x, y] = iso(ENTRANCE.gx, ENTRANCE.gy);
      const px = Math.round(OX + x), py = Math.round(OY + y);
      blit(ctx, "door", px, py + 4);
      blit(ctx, "marquee", px, py - 40);
      const [sx, sy] = iso(ENTRANCE.gx + 1.6, ENTRANCE.gy + 1.3);
      blit(ctx, "sandwich", Math.round(OX + sx), Math.round(OY + sy));
      const [lx, ly] = iso(ENTRANCE.gx - 2.6, ENTRANCE.gy + 1.6);
      blit(ctx, "streetLamp", Math.round(OX + lx), Math.round(OY + ly));
      const [px2, py2] = iso(ENTRANCE.gx + 2.6, ENTRANCE.gy + 0.6);
      blit(ctx, "plantSmall", Math.round(OX + px2), Math.round(OY + py2));
    }

    ctx.globalAlpha = 0.045;
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

if (typeof window !== "undefined") window.WorldV1 = WorldV1;

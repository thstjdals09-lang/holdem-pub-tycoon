// PubScene2D — scene3d.js를 대체하는 2D 아이소메트릭 픽셀 렌더러.
//
// 게임 로직(js/game.js)은 한 줄도 고치지 않는다. scene3d.js가 노출하던 인터페이스를
// 그대로 흉내 내고, 마지막에 window.PubScene3D 로 올린다. index-2d.html 은 script 태그만 바꾼다.
//
//   init(container)              컨테이너에 캔버스를 만든다
//   update(snapshot)             게임 상태 → 배치 (좌표·메시 없음, 순수 상태)
//   chipBurst(colorHex)          칩 튀는 연출
//   spawnDiamondBubble(lifeSec)  앉은 손님 머리 위에 보석 말풍선, 성공하면 true
//   setFloor(n) / getFloorInfo() 층 전환 — 2D는 아직 1층만이라 형태만 맞춘다
//   onTap(info) / onDiamondBubble()   게임이 꽂아 넣는 콜백
//
// ── 화면 설계 ───────────────────────────────────────────────────────────
// 아이소 방은 화면에서 항상 가로:세로 = 2:1이다. 9:16 화면을 가게로 채우려면
// 방을 화면보다 넓게 잡고 좌우 꼭짓점을 화면 밖으로 흘려보내야 한다.
// 카메라가 블록 안으로 들어온 셈이고, 그래서 테이블을 크게 보여줄 수 있다.
//
//   위(뒤)   뒷벽 두 면 — 바 카운터, 간판, 액자, 벽등
//   가운데   대표 테이블 최대 4개 (게임 보유 수에 따라 1~4) + 러그
//   아래(앞) 허리 높이 앞벽 + 정문 + 레드카펫 + 보도
//
// 배치는 알고리즘이 아니라 손으로 적는다(28차 교훈). 보유 수마다 방 크기와
// 테이블 자리를 표(PLANS)로 들고 있고, 바·소파존·입구는 방 크기에서 파생한다.
const PubScene2D = (() => {
  // ── 배율 ── 정수 배율만. 에셋이 타일 32×16 밀도라 S=2면 1픽셀이 2×2가 되어
  // 또렷하고, 축소 보간이 없어 뭉개지지 않는다.
  let S = 2;
  let TW = 64, TH = 32, WALL_H = 124, WAIN = 40, FRONT_H = 48;
  function setScale(k) {
    S = Math.max(2, Math.min(3, k));
    TW = 32 * S; TH = 16 * S;
    WALL_H = 76 * S; WAIN = 22 * S; FRONT_H = 30 * S;
  }

  // 에셋은 생성 시트 5장을 tools/sheet-cut.mjs 로 잘라 만든 것이다.
  // 시트 하나 안에서 모델이 스스로 시점·광원·외곽선을 맞추므로 낱개로 뽑을 때보다 톤이 균일하다.
  // 크기 기준: 사람 키 32px(서 있는 포즈 전부 동일), 타일 32×16, 6인 테이블 64px.
  const ENV = "assets/pixel/out/env_k2/";
  const ACT = "assets/pixel/out/actors_k/";
  const SRC = {
    // 홀
    table: ENV + "401_table_6.png", table8: ENV + "402_table_8.png",
    chair: ENV + "403_chair.png", dealerChair: ENV + "404_dealer_chair.png",
    stool: ENV + "405_stool.png", sofa: ENV + "406_sofa.png",
    armchair: ENV + "407_armchair.png", loungeTable: ENV + "408_lounge_table.png",
    rug: ENV + "409_rug_rect.png", rugRound: ENV + "410_rug_round.png",
    sideTable: ENV + "411_side_table.png", partition: ENV + "412_partition.png",
    // 바
    bar: ENV + "421_bar_straight.png", barCorner: ENV + "422_bar_corner.png",
    backBar: ENV + "423_back_bar.png", beerTap: ENV + "424_beer_tap.png",
    fridge: ENV + "425_fridge.png", sink: ENV + "426_sink.png",
    cart: ENV + "427_cart.png", coffee: ENV + "428_coffee.png",
    bottleCabinet: ENV + "429_bottle_cabinet.png", tray: ENV + "430_tray.png",
    snack: ENV + "431_snack.png", safe: ENV + "432_safe.png",
    // 장식·조명·벽
    lamp: ENV + "441_pendant.png", chandelier: ENV + "442_chandelier.png",
    sconceImg: ENV + "443_sconce.png", art: ENV + "444_art_large.png",
    artSmall: ENV + "445_art_small.png", sign: ENV + "446_menu_board.png",
    neon: ENV + "447_neon.png", dart: ENV + "448_dartboard.png",
    jukebox: ENV + "449_jukebox.png", clock: ENV + "450_clock.png",
    trophy: ENV + "451_trophy_case.png", plantBig: ENV + "452_palm.png",
    // 입구·바깥
    door: ENV + "461_door.png", doors: ENV + "461_door.png",
    board: ENV + "462_board.png", stanchion: ENV + "463_stanchion.png",
    coatRack: ENV + "464_coat_rack.png", hostDesk: ENV + "465_host_desk.png",
    streetLamp: ENV + "466_street_lamp.png", tree: ENV + "467_tree.png",
    bush: ENV + "468_bush.png", bench: ENV + "469_bench.png",
    flowerBed: ENV + "470_flower_bed.png", planter: ENV + "470_flower_bed.png",
    plantSmall: ENV + "470_flower_bed.png",
    trashBin: ENV + "471_trash_bin.png", taxi: ENV + "472_taxi.png",
  };
  // 캐스트: 손님 24종(서 있는 12 + 앉은 12) + 직원 4역(딜러·바텐더·서빙·홍보) × 3포즈.
  // 테마마다 같은 이름으로 다른 폴더에 들어 있어, 폴더만 바꾸면 복장이 통째로 갈린다.
  const POSES = {};
  for (let i = 1; i <= 12; i++) {
    const n = "p" + String(i).padStart(2, "0");
    POSES[n + "_stand"] = n + "_stand";
    POSES[n + "_sit"] = n + "_sit";
  }
  for (const k of ["pd_stand", "pd_deal", "pd_chips", "bt_stand", "bt_pour", "bt_wipe",
                   "sv_stand", "sv_tray1", "sv_tray2", "mk_stand", "mk_wave", "mk_flyer"]) POSES[k] = k;
  for (const [k, v] of Object.entries(POSES)) SRC[k] = ACT + v + ".png";

  // 테마는 바닥·벽·러그 색만 바꾼다. 가구 도트 에셋은 색을 갈아입히면 명암 관계가
  // 깨지므로 건드리지 않는다 — 분위기는 큰 면(바닥/벽/러그/조명)으로 낸다.
  const THEMES = {
    classic: {
      floorA: "#96603a", floorB: "#8b5834", seam: "#6d4224", seamHi: "#a97046",
      wall: "#bd925f", wallW: "#ab834f", wain: "#6b4526", beam: "#452a16", stud: "#a87f4c",
      rug: "#8f2f36", rugEdge: "#5f1d24", rugTrim: "#d7a444",
    },
    princess: {
      floorA: "#c48aa0", floorB: "#b87f96", seam: "#8f5b6f", seamHi: "#d9a2b6",
      wall: "#f0cdda", wallW: "#e0bbca", wain: "#9c5f77", beam: "#6d3f52", stud: "#d9adbe",
      rug: "#a9445f", rugEdge: "#722c40", rugTrim: "#f0c46a",
    },
    european: {
      floorA: "#9a8f74", floorB: "#8f8469", seam: "#6c6349", seamHi: "#b2a78a",
      wall: "#d9cbaa", wallW: "#c8ba99", wain: "#6f6450", beam: "#4a4234", stud: "#bfb193",
      rug: "#7a3140", rugEdge: "#51202b", rugTrim: "#c9a15a",
    },
    neon: {
      floorA: "#3f3c60", floorB: "#383556", seam: "#272444", seamHi: "#575180",
      wall: "#332f4e", wallW: "#2b2842", wain: "#4b3468", beam: "#1d1a30", stud: "#453f68",
      rug: "#5a2b6e", rugEdge: "#3a1a48", rugTrim: "#e2b64a",
    },
    japanese: {
      floorA: "#b08a5c", floorB: "#a37f53", seam: "#7d5c39", seamHi: "#c49b6a",
      wall: "#e8dcc0", wallW: "#d6c9ab", wain: "#7d5a3a", beam: "#50381f", stud: "#cbbb98",
      rug: "#8a3a33", rugEdge: "#5c2420", rugTrim: "#d2a95c",
    },
  };

  const PAL = {
    pavA: "#b8ac97", pavB: "#aea28d", pavSeam: "#978c78",
    roadA: "#4b4946", roadB: "#454340", roadEdge: "#6e6b66", dash: "#d8c268",
    lotA: "#5b7148", lotB: "#536840",
    brick: "#5a4133", brickHi: "#a4907a", brickLo: "#33241b", brickSeam: "#4a352a",
    leather: "#7d3b33", wood: "#6b4526",
    glow: "#ffd489", ink: "#241a15", paper: "#fff6e2",
    plate: "#f2e0bd", plateEdge: "#9a7b4a",
    gold: "#e8b44a", goldLo: "#a97c22",
  };

  // 테마마다 같은 60칸(파일명까지 동일)을 다른 폴더에 들고 있다.
  // 그래서 테마 전환 = "어느 폴더를 읽을지" 하나만 바꾸면 된다.
  const THEME_SET = {
    classic:  { env: "env_k2", act: "actors_k" },
    princess: { env: "env_princess", act: "actors_princess" },
    neon:     { env: "env_neon", act: "actors_neon" },
    european: { env: "env_european", act: "actors_european" },
    japanese: { env: "env_japanese", act: "actors_japanese" },
  };
  const SETS = {};          // 테마 이름 → { 키: Image }
  const IMG = {};           // 기본(클래식) 세트 — 테마에 빠진 게 있으면 여기서 채운다
  let loaded = false;

  function pathFor(key, set) {
    return SRC[key]
      .replace("assets/pixel/out/env_k2/", "assets/pixel/out/" + set.env + "/")
      .replace("assets/pixel/out/actors_k/", "assets/pixel/out/" + set.act + "/");
  }
  function loadSet(name) {
    if (SETS[name]) return Promise.resolve(SETS[name]);
    const set = THEME_SET[name] || THEME_SET.classic;
    const bank = {};
    SETS[name] = bank;
    return Promise.all(Object.keys(SRC).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { bank[k] = im; res(); };
      im.onerror = () => res();                       // 그 테마에 없으면 기본 세트로 떨어진다
      im.src = pathFor(k, set);
    }))).then(() => bank);
  }
  /** 현재 테마의 그림. 없으면 기본 세트. */
  function A(key) {
    const bank = SETS[theme];
    return (bank && bank[key]) || IMG[key] || null;
  }
  function loadAll() {
    return loadSet("classic").then((bank) => {
      Object.assign(IMG, bank);
      loaded = true;
    });
  }

  // ---------------- 상태 ----------------
  let canvas = null, ctx = null, host = null;
  let VW = 540, VH = 1040;
  let ROOM = { w: 12, d: 9 };
  let OX = 0, OY = 0;
  let theme = "classic";
  let snap = null, layout = null;
  let bubbles = [], chips = [], hits = [];
  let raf = 0;
  const api = { onTap: null, onDiamondBubble: null };

  const sx = (gx, gy) => OX + (gx - gy) * (TW / 2);
  const sy = (gx, gy) => OY + (gx + gy) * (TH / 2);

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3); n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    return (n ^ (n >>> 15)) >>> 0;
  }
  const pick = (pool, seed) => pool[hash(seed) % pool.length];

  // ---------------- 그리기 원시 ----------------
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const poly = (pts, c) => PixelArt.poly(ctx, pts, c);
  const line = (x0, y0, x1, y1, c) => PixelArt.line(ctx, x0, y0, x1, y1, c);

  /** 스프라이트를 바닥점 기준으로 찍는다. flip=true면 좌우 반전본(반대 축용). */
  function blit(key, cx, baseY, flip) {
    const im = A(key);
    if (!im) return null;
    const w = im.width * S, h = im.height * S;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(baseY - h);
    if (!flip) ctx.drawImage(im, 0, 0, im.width, im.height, x0, y0, w, h);
    else for (let c = 0; c < im.width; c++) {
      ctx.drawImage(im, c, 0, 1, im.height, x0 + (im.width - 1 - c) * S, y0, S, h);
    }
    return { x: x0, y: y0, w, h };
  }
  /** 평면 그림을 아이소 벽 기울기에 눕힌다. dir +1 = 북쪽 벽(gy=0), -1 = 서쪽 벽(gx=0). */
  function blitWall(key, cx, cy, dir) {
    const im = A(key);
    if (!im) return;
    const w = im.width * S, h = im.height * S;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2) - Math.round((w / 4) * dir);
    for (let x = 0; x < im.width; x++) {
      ctx.drawImage(im, x, 0, 1, im.height, x0 + x * S, y0 + Math.round(x * S * 0.5 * dir), S, h);
    }
  }
  // 311 간판은 이미 북쪽 벽 기울기로 그려져 있다 — 또 눕히면 두 배로 꺾인다.
  const PRESHEARED = { sign: 1 };
  function hangWall(key, cx, cy, dir) {
    const native = PRESHEARED[key];
    if (!native) return blitWall(key, cx, cy, dir);
    const im = A(key);
    if (im) blit(key, cx, cy + (im.height * S) / 2, native !== dir);
  }

  /** 아이소 박스. 소파·낮은 벽 같은 건 에셋보다 코드가 정확하다. */
  function isoBox(cx, cy, gw, gd, hpx, base, opt) {
    const o = opt || {};
    const f = PixelArt.faces(base);
    const g = [
      [cx + gw / 2, cy + gd / 2], [cx + gw / 2, cy - gd / 2],
      [cx - gw / 2, cy - gd / 2], [cx - gw / 2, cy + gd / 2],
    ].map((p) => [sx(p[0], p[1]), sy(p[0], p[1])]);
    const Sg = g[0], Eg = g[1], Ng = g[2], Wg = g[3];
    const up = (p) => [p[0], p[1] - hpx];
    const St = up(Sg), Et = up(Eg), Nt = up(Ng), Wt = up(Wg);
    if (hpx > 0) {
      poly([Wt, St, Sg, Wg], f.left);
      poly([St, Et, Eg, Sg], f.right);
    }
    poly([St, Et, Nt, Wt], o.top || f.top);
    line(Wt[0], Wt[1], St[0], St[1], f.edge); line(St[0], St[1], Et[0], Et[1], f.edge);
    line(Et[0], Et[1], Nt[0], Nt[1], f.edge); line(Nt[0], Nt[1], Wt[0], Wt[1], f.edge);
    if (hpx > 0) {
      line(Wg[0], Wg[1], Sg[0], Sg[1], f.edge); line(Sg[0], Sg[1], Eg[0], Eg[1], f.edge);
      line(Wt[0], Wt[1], Wg[0], Wg[1], f.edge); line(St[0], St[1], Sg[0], Sg[1], f.edge);
      line(Et[0], Et[1], Eg[0], Eg[1], f.edge);
    }
  }

  /** 바닥 러그. 테이블 아래 깔면 "구역"이 생겨 화면이 정리된다. */
  function rug(cx, cy, gw, gd, T) {
    const q = (mw, md) => [
      [cx + mw, cy + md], [cx + mw, cy - md], [cx - mw, cy - md], [cx - mw, cy + md],
    ].map((p) => [sx(p[0], p[1]), sy(p[0], p[1])]);
    poly(q(gw / 2, gd / 2), T.rugEdge);
    poly(q(gw / 2 - 0.12, gd / 2 - 0.12), T.rug);
    const t = q(gw / 2 - 0.42, gd / 2 - 0.42);
    for (let i = 0; i < 4; i++) line(t[i][0], t[i][1], t[(i + 1) % 4][0], t[(i + 1) % 4][1], T.rugTrim);
  }

  /** 따뜻한 조명 — 바닥에 번지는 빛. 겹겹이 깔아 그라데이션을 흉내 낸다. */
  function glow(px, py, r, alpha, color) {
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = (alpha * (5 - i)) / 9;
      PixelSprites.ellipse(ctx, px, py, (r * i) / 4, (r * i) / 8, color || PAL.glow);
    }
    ctx.globalAlpha = 1;
  }

  /** 벽에 붙는 글자 — 벽 기울기를 따라 글리프마다 내려/올려 찍는다. */
  function wallText(str, px, py, dir, color, scale) {
    const sc = Math.max(1, Math.round(scale));
    const step = (PixelFont.W + 1) * sc;
    const s = String(str).toUpperCase();
    const total = s.length * step - sc;
    let x = px - total / 2;
    let y = py - (dir * total) / 4;
    for (const ch of s) {
      PixelFont.draw(ctx, x, Math.round(y), ch, color, sc, "left", 1);
      x += step; y += (step / 2) * dir;
    }
  }

  // ---------------- 배치 ----------------
  // 테이블은 "대표 3~4개"만 크게 보여준다. 게임이 그 이상을 들고 있어도 화면은
  // 4개까지만 그리고, 나머지 성장은 손님 수·직원·소품·바 레벨로 드러낸다.
  const MAX_TABLES = 4;
  // 자리는 화면에서 먼저 잡고 격자로 역산했다(535×1040 기준). 아이소에서는
  // "격자에 고르게" 놓으면 화면에서는 겹친다 — 테이블 한 대가 화면 140×110을 먹는다.
  const PLANS = [
    { w: 9,  d: 9, t: [[5.6, 3.4]] },
    { w: 11, d: 11, t: [[4.9, 3.5], [8.4, 7.4]] },
    { w: 13, d: 13, t: [[5.1, 4.1], [8.7, 3.0], [7.3, 9.4]] },
    { w: 13, d: 13, t: [[5.1, 4.1], [8.7, 3.0], [7.3, 9.4], [11.1, 8.3]] },
  ];
  // 좁은 화면(≈390)은 가로로 벌린 배치가 잘린다 → 화면 세로를 따라 내려가는 한 줄로.
  // 테이블 한 대가 화면 128×106이라 세로 간격은 112칸분이 필요하다.
  const PLANS_NARROW = [
    { w: 9,  d: 9,  t: [[5.6, 3.4]] },
    { w: 11, d: 11, t: [[4.9, 3.5], [8.4, 7.4]] },
    { w: 13, d: 13, t: [[4.5, 1.5], [8.0, 5.0], [11.0, 9.0]] },
    { w: 13, d: 13, t: [[4.5, 1.5], [8.0, 5.0], [11.0, 9.0]] },
  ];
  const SEAT_ANGLE = [-90, -30, 30, 90, 150, 210];
  const SEAT_R = 1.85, SIT_R = 1.45;
  const ALL = (suffix) => Array.from({ length: 12 }, (_, i) => "p" + String(i + 1).padStart(2, "0") + suffix);
  const SEATED = ALL("_sit");
  const SEATED_BACK = ALL("_sit");
  const STANDING = ALL("_stand");
  const DEALING = ["pd_deal", "pd_stand", "pd_chips"];
  // 걷는 프레임은 따로 없다 — 서 있는 그림에 1px 위아래 흔들림만 준다(actorAt의 bob).
  const WALK = null;
  const TRAY = ["sv_tray1", "sv_tray2"];
  const BARTEND = ["bt_pour", "bt_wipe", "bt_stand"];
  const PROMO = ["mk_wave", "mk_flyer", "mk_stand"];
  const EMOTE = ["spade", "heart", "note"];

  function buildLayout(s) {
    const owned = Math.max(0, s.tables | 0);
    const capacity = Math.max(1, s.capacity | 0);
    const shown = Math.min(MAX_TABLES, Math.max(1, owned + (owned < capacity ? 1 : 0)));
    const narrow = VW < 460;
    const plan = (narrow ? PLANS_NARROW : PLANS)[shown - 1];
    ROOM = { w: plan.w, d: plan.d };

    // 방을 화면 가로에 맞춘다. 좌우 꼭짓점은 일부러 화면 밖으로 흘린다(카메라가 안쪽).
    setScale(VW >= 820 ? 3 : 2);
    OX = ROOM.d * (TW / 2) + (VW - (ROOM.w + ROOM.d) * (TW / 2)) / 2;
    OY = Math.round(VH * 0.25) + WALL_H;

    const W = ROOM.w, D = ROOM.d;
    const slots = plan.t.map((p, i) => ({ i, cx: p[0], cy: p[1], owned: i < owned }));
    // 자리를 다 채웠는데 증설 여지가 남으면 라운지 쪽에 "빈 자리" 표식을 둔다
    const expand = owned >= shown && owned < capacity ? { cx: W - 2.4, cy: D - 3.6 } : null;

    // ── 바 (서쪽 벽) ──
    const barLv = (s.fixtures && s.fixtures.bar) || 0;
    let bar = null;
    if (barLv > 0) {
      const len = D >= 12 ? 5.4 : 3.6;
      const mid = D >= 12 ? 3.4 : 2.6;
      const shelves = [];
      for (let g = mid - len / 2 + 0.7; g < mid + len / 2; g += 1.6) shelves.push(g);
      const stools = [];
      const nStool = Math.min(D >= 12 ? 4 : 3, 1 + barLv);
      for (let i = 0; i < nStool; i++) stools.push(mid - len / 2 + 0.9 + i * 1.35);
      bar = { cx: 1.45, cy: mid, len, shelves, stools, level: barLv };
    }

    // ── 소파존 (앞쪽 왼편) ──
    const booths = [];
    const boothN = 1 + Math.min(1, (s.decor && s.decor.vip) || 0);
    const spots = D < 12
      ? [[D - 3.0, D - 1.6], [D - 0.4, D - 1.5], [D - 5.4, D - 1.5]]
      : narrow ? [[7.6, 10.8], [10.2, 11.6], [5.0, 10.0]]
               : [[6.0, 11.2], [10.6, 11.4], [8.3, 9.2]];
    for (let i = 0; i < Math.min(boothN, spots.length); i++) booths.push(spots[i]);

    // ── 사람 ──
    const people = [];
    const seatsPerTable = Math.max(2, Math.round((s.seatsMin + s.seatsMax) / 2) - 1);
    const occ = Math.max(0, Math.min(1, s.occupancy || 0));
    slots.filter((x) => x.owned).forEach((t) => {
      if (s.assignedDealers && s.assignedDealers[t.i]) {
        people.push({ gx: t.cx, gy: t.cy - SIT_R - 0.35, sprite: pick(DEALING, t.i * 17 + 5), seed: t.i * 17 + 3 });
      }
      const filled = Math.max(1, Math.round(seatsPerTable * occ));
      for (let k = 1; k <= filled && k < SEAT_ANGLE.length; k++) {
        const a = (SEAT_ANGLE[k] * Math.PI) / 180;
        const seed = t.i * 100 + k * 7;
        const back = Math.sin(a) < -0.35;
        people.push({
          gx: t.cx + Math.cos(a) * SIT_R, gy: t.cy + Math.sin(a) * SIT_R,
          sprite: back ? pick(SEATED_BACK, seed) : pick(SEATED, seed),
          flip: Math.cos(a) - Math.sin(a) < 0, seat: true, seed,
          emote: hash(seed) % 5 === 0 ? pick(EMOTE, seed + 1) : null,
        });
      }
      if (occ > 0.5) {
        people.push({ gx: t.cx + SEAT_R + 0.7, gy: t.cy + 0.5, sprite: pick(STANDING, t.i * 31 + 3), seed: t.i * 31, flip: true });
      }
    });
    // 바텐더 · 바 손님
    if (bar) {
      const bt = Math.min(2, (s.staff && s.staff.bartender) || 0);
      for (let i = 0; i < bt; i++) people.push({ gx: 0.95, gy: bar.cy - 1.2 + i * 2.4, sprite: pick(BARTEND, 770 + i), seed: 770 + i });
      bar.stools.forEach((gy, i) => {
        if (hash(900 + i) % 5 === 0) return;              // 한두 자리는 비워 둔다
        const seed = 800 + i * 13;
        people.push({ gx: 2.72, gy, sprite: pick(SEATED, seed), seed, seat: true });
      });
    }
    // 서버 — 홀을 가로지른다
    const servers = Math.min(3, (s.staff && s.staff.server) || 0);
    for (let i = 0; i < servers; i++) {
      const gy = 2.2 + i * 2.4;
      people.push({ gx: 3.4, gy, cycle: TRAY, sprite: TRAY[0], seed: 700 + i * 11,
                    walk: { from: [3.4, gy], to: [Math.min(W - 1.6, gy + 7.2), gy], speed: 0.00012 + i * 0.00003 } });
    }
    // 돌아다니는 손님 — 보유 테이블이 많을수록 북적인다
    const walkers = Math.min(6, 2 + Math.round(occ * 3) + Math.max(0, owned - MAX_TABLES));
    for (let i = 0; i < walkers; i++) {
      const gy = 1.4 + ((i * 2.7) % Math.max(2, D - 2.4));
      const seed = 400 + i * 23;
      people.push({ gx: 3.0, gy, sprite: pick(STANDING, seed), seed,
                    walk: { from: [3.0, gy], to: [Math.min(W - 1.2, gy + 7.6), gy], speed: 0.00009 + i * 0.00002 } });
    }

    // ── 화분 · 소품 ──
    const props = [];
    const P = (a, cx, cy, flip) => props.push({ a, cx, cy, flip });
    P("plantBig", 7.0, 0.6); P("plantBig", 0.6, 0.6); P("plantBig", W - 0.6, D - 0.7);
    const plantLv = (s.decor && s.decor.plant) || 0;
    // 세 번째 값 = 좌우반전 여부 (세로줄에 놓는 것은 원본, 가로줄은 반전)
    const plantSpots = [[5.6, 0.6, true], [2.8, 0.6, true], [9.8, 3.4, false],
                        [7.4, D - 0.8, true], [2.6, 9.6, false], [11.4, 6.4, false]];
    for (let i = 0; i < Math.min(plantLv, plantSpots.length); i++) {
      const sp = plantSpots[i];
      P("planter", sp[0], sp[1], sp[2]);
    }
    // 냉장고는 바 끝에 붙인다(오른쪽 벽은 화면 밖이다)
    if ((s.fixtures && s.fixtures.fridge) > 0) props.push({ a: "fridge", cx: 1.3, cy: 6.9, fixture: "fridge" });

    // ── 벽 장식 ──
    const decor = s.decor || {};
    const wallN = [];
    const artN = 1 + Math.min(2, (decor.neon || 0) + (decor.dart || 0));
    for (let i = 0; i < artN; i++) {
      const g = 5.2 + i * 1.7;
      if (g < Math.min(W - 0.8, 8.2)) wallN.push({ g, a: i % 2 ? "art" : "sign" });
    }
    const wallW = [];
    if (!bar) for (let i = 0; i < 2; i++) wallW.push({ g: 2.0 + i * 2.2, a: i % 2 ? "sign" : "art" });
    else if (D >= 9) wallW.push({ g: Math.min(D - 1.2, 7.4), a: "art" });
    // 벽등 — 뒷벽을 따라. 아늑함은 대부분 여기서 나온다.
    const sconceN = [], sconceW = [];
    for (let g = 1.6; g < Math.min(W - 0.4, 8.6); g += 2.4) sconceN.push(g);
    for (let g = 1.6; g < Math.min(D - 0.4, 8.6); g += 2.4) sconceW.push(g);

    // ── 입구 · 대회 데스크 ──
    const entrance = { gx: W, gy: Math.round(D * 0.78) };
    const host = s.tournamentWins > 0 ? { cx: W - 1.1, cy: D - 1.6 } : null;

    // ── 바깥 ── 도심 블록: 좁은 보도 + 도로. 잔디는 두지 않는다.
    const out = [];
    const O = (a, cx, cy, flip) => out.push({ a, cx, cy, flip });
    const X = true;   // 가로(gx) 줄에는 좌우반전본 (에셋이 +gy 방향으로 그려져 있다)
    O("board", entrance.gx + 1.8, D + 1.4);
    for (let g = 1.2; g < W + 1; g += 3.4) O("flowerBed", g, D + 2.4, X);
    for (let g = 0.5; g < W; g += 4.6) O("streetLamp", g, D + 3.1);
    O("bench", 2.4, D + 2.9, X); O("bench", W - 2.6, D + 2.9, X);
    for (let g = -1; g < W + 3; g += 3.0) O("tree", g, D + 11.4, X);
    for (let g = 0; g < W + 2; g += 4.2) O("streetLamp", g, -5.0);
    for (let g = -1; g < W + 3; g += 2.8) O("tree", g, -11.4, X);
    for (let g = -1; g < W + 3; g += 3.6) O("bush", g + 1.2, -10.2);
    for (let g = -6; g < D + 8; g += 3.2) { O("tree", -11.4, g); O("tree", W + 11.4, g); }

    // 홍보 직원 — 가게 앞에서 전단을 돌린다 (게임의 marketer 고용 수만큼)
    const marketers = Math.min(2, (s.staff && s.staff.marketer) || 0);
    for (let i = 0; i < marketers; i++) {
      people.push({ gx: entrance.gx - 2.4 - i * 1.6, gy: D + 2.6, sprite: pick(PROMO, 880 + i), seed: 880 + i, flip: true });
    }

    // 문 앞 줄 · 보도 행인
    for (let i = 0; i < 3; i++) {
      const seed = 900 + i * 13;
      people.push({ gx: entrance.gx - 0.9 + (i % 2) * 1.6, gy: D + 1.3 + ((i / 2) | 0) * 1.2,
                    sprite: pick(STANDING, seed), seed, flip: i % 2 === 0 });
    }
    for (let i = 0; i < 3; i++) {
      const seed = 950 + i * 29;
      const gy = D + 3.3 + (i % 2) * 1.1;
      people.push({ gx: -2, gy, sprite: pick(STANDING, seed), seed,
                    walk: { from: [-2, gy], to: [W + 3, gy], speed: 0.00008 + i * 0.000015 } });
    }

    const bySum = (a, b) => (a.cx + a.cy) - (b.cx + b.cy);
    return {
      slots, expand, bar, booths, people, props, wallN, wallW, sconceN, sconceW, entrance, host,
      outBack: out.filter((o) => o.cx < 0 || o.cy < 0).sort(bySum),
      outFront: out.filter((o) => !(o.cx < 0 || o.cy < 0)),
    };
  }

  // ---------------- 지형 ----------------
  // 건물 사각형까지의 체비셰프 거리로 띠를 나눈다 → 화면에서는 동심 마름모.
  const PAV = 3, ROAD = 9, FAR = 40;
  function ringOf(gx, gy) {
    const dx = gx < 0 ? -gx : (gx >= ROOM.w ? gx - ROOM.w + 1 : 0);
    const dy = gy < 0 ? -gy : (gy >= ROOM.d ? gy - ROOM.d + 1 : 0);
    return dx > dy ? dx : dy;
  }
  function terrain(gx, gy) {
    if (gx >= 0 && gx < ROOM.w && gy >= 0 && gy < ROOM.d) return "floor";
    const r = ringOf(gx, gy);
    if (r <= PAV) return "pav";
    if (r <= ROAD) return "road";
    if (r <= FAR) return "pav";
    return "lot";
  }

  function drawGround() {
    const T = THEMES[theme] || THEMES.classic;
    R(0, 0, VW, VH, PAL.roadB);
    const maxSum = Math.ceil((VH - OY) / (TH / 2)) + 4;
    const minSum = Math.floor(-OY / (TH / 2)) - 4;
    const halfDiag = Math.ceil(VW / TW) + 3;
    for (let sum = minSum; sum <= maxSum; sum++) {
      for (let diff = -halfDiag; diff <= halfDiag; diff++) {
        if (((sum + diff) & 1) !== 0) continue;
        const gx = (sum + diff) / 2, gy = (sum - diff) / 2;
        const px = sx(gx + 1, gy + 1), py = sy(gx + 1, gy + 1);
        if (px < -TW || px > VW + TW || py < -TH * 2 || py > VH + TH) continue;
        const kind = terrain(gx, gy);
        const even = ((gx + gy) & 1) === 0;
        const quad = [[px, py], [px + TW / 2, py - TH / 2], [px, py - TH], [px - TW / 2, py - TH / 2]];
        if (kind === "floor") {
          poly(quad, even ? T.floorA : T.floorB);
          line(px - TW / 2, py - TH / 2, px, py - TH, T.seam);
          line(px, py - TH, px + TW / 2, py - TH / 2, T.seam);
          line(px + TW / 2, py - TH / 2, px, py, T.seamHi);
        } else if (kind === "pav") {
          poly(quad, even ? PAL.pavA : PAL.pavB);
          line(px - TW / 2, py - TH / 2, px, py - TH, PAL.pavSeam);
          line(px, py - TH, px + TW / 2, py - TH / 2, PAL.pavSeam);
        } else if (kind === "road") {
          poly(quad, even ? PAL.roadA : PAL.roadB);
          const r = ringOf(gx, gy);
          const dx = gx < 0 ? -gx : (gx >= ROOM.w ? gx - ROOM.w + 1 : 0);
          const dy = gy < 0 ? -gy : (gy >= ROOM.d ? gy - ROOM.d + 1 : 0);
          const alongX = dy >= dx;
          const ex = alongX ? TW / 2 : -TW / 2;
          if (r === PAV + 1 || r === ROAD) {
            line(px - ex / 2, py - TH / 2 - TH / 4, px + ex / 2, py - TH / 2 + TH / 4, PAL.roadEdge);
          }
          if (r === ((PAV + 1 + ROAD) >> 1) && (((alongX ? gx : gy) & 3) < 2)) {
            for (let k = 0; k < S; k++) {
              line(px - ex * 0.4, py - TH / 2 - TH * 0.2 + k, px + ex * 0.4, py - TH / 2 + TH * 0.2 + k, PAL.dash);
            }
          }
        } else {
          poly(quad, even ? PAL.lotA : PAL.lotB);
        }
      }
    }
  }

  /** 뒷벽 두 면 — 타일마다 찍지 않고 한 판으로 그려야 깔끔하다. */
  function drawBackWalls() {
    const T = THEMES[theme] || THEMES.classic;
    const wall = (ax, ay, bx, by, col) => {
      const A = [sx(ax, ay), sy(ax, ay)], B = [sx(bx, by), sy(bx, by)];
      const At = [A[0], A[1] - WALL_H], Bt = [B[0], B[1] - WALL_H];
      poly([A, B, Bt, At], col);
      poly([A, B, [B[0], B[1] - WAIN], [A[0], A[1] - WAIN]], T.wain);
      line(A[0], A[1] - WAIN, B[0], B[1] - WAIN, PixelArt.shade(T.wain, 0.3));
      poly([At, Bt, [B[0], B[1] - WALL_H + 5 * S], [A[0], A[1] - WALL_H + 5 * S]], T.beam);
    };
    wall(0, 0, ROOM.w, 0, T.wall);      // 북쪽(오른쪽 위)
    wall(0, 0, 0, ROOM.d, T.wallW);     // 서쪽(왼쪽 위)
    for (let g = 2; g < ROOM.w; g += 3) {
      const x = sx(g, 0), y = sy(g, 0);
      poly([[x, y], [x + 3 * S, y + 1.5 * S], [x + 3 * S, y + 1.5 * S - WALL_H], [x, y - WALL_H]], T.stud);
    }
    for (let g = 2; g < ROOM.d; g += 3) {
      const x = sx(0, g), y = sy(0, g);
      poly([[x, y], [x + 3 * S, y - 1.5 * S], [x + 3 * S, y - 1.5 * S - WALL_H], [x, y - WALL_H]], T.stud);
    }
  }

  /** 가게 간판 — 글자는 이미지가 아니라 코드로 찍는다. */
  function marquee(g, dir) {
    const bx = dir > 0 ? sx(g, 0) : sx(0, g);
    const by = (dir > 0 ? sy(g, 0) : sy(0, g)) - WALL_H + 22 * S;
    const w = 58 * S, h = 16 * S;
    const q = (mw, mh) => {
      const dy = (mw * dir) / 2;
      return [[bx - mw, by - mh - dy], [bx + mw, by - mh + dy], [bx + mw, by + mh + dy], [bx - mw, by + mh - dy]];
    };
    glow(bx, by, w * 0.55, 0.4);                       // 빛은 판 뒤에 — 판 위에 깔면 글자가 흐려진다
    poly(q(w / 2, h / 2), PAL.goldLo);
    poly(q(w / 2 - 1.2 * S, h / 2 - 1.2 * S), "#1b120d");
    wallText("HOLDEM PUB", bx + 2 * S, by + 2 * S, dir, PAL.gold, S);
    const px = bx - w / 2 + 5 * S, py = by - ((w / 2 - 5 * S) * dir) / 2;
    poly([[px, py - 5 * S], [px + 3 * S, py], [px - 3 * S, py]], PAL.gold);
    R(px - S / 2, py - S, S, 3 * S, PAL.gold);
  }

  function sconce(px, py, dir) {
    glow(px, py + 3 * S, 11 * S, 0.6);
    poly([[px - 2 * S, py], [px + 2 * S, py + dir * S], [px + 2 * S, py - 4 * S + dir * S], [px - 2 * S, py - 4 * S]], PAL.gold);
    R(px - S, py + 2 * S, 2 * S, 3 * S, PAL.goldLo);
  }

  /** 바 카운터 — 밝은 상판 + 어두운 몸통 + 금색 발레일. */
  function barCounter(cx, cy, len) {
    isoBox(cx, cy, 1.05, len, 20 * S, "#6f4526", { top: "#c28b4e" });
    const A = [sx(cx + 0.52, cy + len / 2), sy(cx + 0.52, cy + len / 2)];
    const B = [sx(cx + 0.52, cy - len / 2), sy(cx + 0.52, cy - len / 2)];
    line(A[0], A[1] - 14 * S, B[0], B[1] - 14 * S, "#8f5f33");
    line(A[0], A[1] - 5 * S, B[0], B[1] - 5 * S, PAL.gold);
    return { x: Math.min(A[0], B[0]) - 8 * S, y: Math.min(A[1], B[1]) - 14 * S,
             w: Math.abs(A[0] - B[0]) + 16 * S, h: Math.abs(A[1] - B[1]) + 22 * S };
  }

  /** 소파 — 에셋 벤치보다 덩치가 커서 라운지가 라운지답게 보인다. */
  function booth(cx, cy) {
    if (A("sofa")) blit("sofa", sx(cx, cy), sy(cx, cy));
    else isoBox(cx, cy, 1.9, 0.85, 8 * S, PAL.leather);       // 에셋이 없으면 박스로라도
    isoBox(cx + 1.45, cy + 0.35, 0.7, 0.7, 11 * S, PAL.wood); // 옆 탁자
  }

  /** 허리 높이 앞벽 — 이게 있어야 "건물 안"으로 보인다. */
  function frontWall(L, add) {
    const seg = (ax, ay, bx, by) => {
      const A = [sx(ax, ay), sy(ax, ay)], B = [sx(bx, by), sy(bx, by)];
      poly([A, B, [B[0], B[1] + FRONT_H], [A[0], A[1] + FRONT_H]], PAL.brick);
      line(A[0], A[1] + FRONT_H * 0.55, B[0], B[1] + FRONT_H * 0.55, PAL.brickSeam);
      poly([[A[0], A[1] - 4 * S], [B[0], B[1] - 4 * S], B, A], PAL.brickHi);   // 돌 갓
      line(A[0], A[1] + FRONT_H, B[0], B[1] + FRONT_H, PAL.brickLo);
    };
    const onRight = L.entrance.gx >= ROOM.w;
    for (let g = 0; g < ROOM.w; g++) {
      if (!onRight && g >= L.entrance.gx - 1 && g <= L.entrance.gx) continue;
      add(g + ROOM.d + 0.55, () => seg(g, ROOM.d, g + 1, ROOM.d));
    }
    for (let g = 0; g < ROOM.d; g++) {
      if (onRight && g >= L.entrance.gy - 1 && g <= L.entrance.gy) continue;
      add(ROOM.w + g + 0.55, () => seg(ROOM.w, g + 1, ROOM.w, g));
    }
  }

  function emote(px, py, kind, t) {
    const y = Math.round(py + Math.sin(t * 0.004) * 1.5);
    const w = 9 * S, h = 8 * S;
    R(px - w / 2 - S, y - h - S, w + 2 * S, h + 2 * S, PAL.ink);
    R(px - w / 2, y - h, w, h, PAL.paper);
    R(px - S, y, 2 * S, 2 * S, PAL.ink);
    const cx = px, cy = y - h / 2;
    if (kind === "heart") {
      R(cx - 3 * S, cy - 2 * S, 2 * S, 2 * S, "#d6465c"); R(cx + S, cy - 2 * S, 2 * S, 2 * S, "#d6465c");
      poly([[cx - 3 * S, cy], [cx + 3 * S, cy], [cx, cy + 3 * S]], "#d6465c");
    } else if (kind === "note") {
      R(cx - S, cy - 3 * S, S, 5 * S, PAL.ink); R(cx - 3 * S, cy + S, 3 * S, 2 * S, PAL.ink);
      R(cx - S, cy - 3 * S, 3 * S, S, PAL.ink);
    } else {
      poly([[cx, cy - 3 * S], [cx + 3 * S, cy + S], [cx - 3 * S, cy + S]], PAL.ink);
      R(cx - S / 2, cy, S, 3 * S, PAL.ink);
    }
  }

  function diamondBubble(px, py, t) {
    const u = S;
    const y = Math.round(py - 3 * u + Math.sin(t * 0.004) * 2);
    R(px - 6 * u, y - 9 * u, 12 * u, 9 * u, PAL.ink);
    R(px - 5.5 * u, y - 8.5 * u, 11 * u, 8 * u, PAL.paper);
    R(px - 1.5 * u, y, 3 * u, 2 * u, PAL.ink);
    poly([[px - 3 * u, y - 5 * u], [px, y - 7.5 * u], [px + 3 * u, y - 5 * u], [px, y - 1.5 * u]], "#7a4682");
    poly([[px - 3 * u, y - 5 * u], [px, y - 7.5 * u], [px + 3 * u, y - 5 * u]], "#c98fd0");
    return { x: px - 7 * u, y: y - 10 * u, w: 14 * u, h: 14 * u };
  }

  /** 빈 테이블 자리 — 누르면 테이블을 산다. */
  function emptySlot(px, py, pulse) {
    const w = TW * 1.9, h = TH * 1.9;
    poly([[px, py + h / 2], [px + w / 2, py], [px, py - h / 2], [px - w / 2, py]], PAL.plateEdge);
    poly([[px, py + h / 2 - 2 * S], [px + w / 2 - 3 * S, py], [px, py - h / 2 + 2 * S], [px - w / 2 + 3 * S, py]], PAL.plate);
    ctx.globalAlpha = 0.5 + 0.45 * Math.sin(pulse * 0.004);
    R(px - S, py - 7 * S, 2 * S, 14 * S, "#7a5a2a");
    R(px - 7 * S, py - S, 14 * S, 2 * S, "#7a5a2a");
    ctx.globalAlpha = 1;
    return { x: px - w / 2, y: py - h / 2, w, h };
  }

  function actorAt(n, t) {
    let gx = n.gx, gy = n.gy, bob = 0, sprite = n.sprite, flip = n.flip || false;
    if (n.walk) {
      const k = (Math.sin(t * n.walk.speed + (n.seed % 7)) + 1) / 2;
      gx = n.walk.from[0] + (n.walk.to[0] - n.walk.from[0]) * k;
      gy = n.walk.from[1] + (n.walk.to[1] - n.walk.from[1]) * k;
      const forward = Math.cos(t * n.walk.speed + (n.seed % 7)) > 0;
      const dx = (n.walk.to[0] - n.walk.from[0]) - (n.walk.to[1] - n.walk.from[1]);
      flip = forward ? dx < 0 : dx > 0;
      if (n.cycle) sprite = n.cycle[Math.floor(t / 240 + n.seed) % n.cycle.length];
      else bob = Math.floor(t / 200 + n.seed) % 2 ? -1 : 0;
    }
    return { gx, gy, bob, sprite, flip };
  }

  /** 초당 수익 라벨 — 게임이 준 숫자를 그대로 쓴다. */
  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "K";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  }
  function incomeTag(px, py, value) {
    const txt = compact(value);
    const sc = S;
    const tw = PixelFont.measure(txt, sc) + 8 * sc;
    const h = (PixelFont.H + 4) * sc;
    R(px - tw / 2 - sc, py - h - sc, tw + 2 * sc, h + 2 * sc, PAL.ink);
    R(px - tw / 2, py - h, tw, h, "#3b2b1f");
    R(px - tw / 2 + 2 * sc, py - h + h / 2 - sc / 2, 3 * sc, sc, PAL.gold);
    R(px - tw / 2 + 3 * sc, py - h + h / 2 - 1.5 * sc, sc, 3 * sc, PAL.gold);
    PixelFont.draw(ctx, px - tw / 2 + 6 * sc, py - h + 2 * sc, txt, PAL.gold, sc, "left", 1);
  }

  // ---------------- 프레임 ----------------
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!ctx || !loaded || !layout) return;
    const L = layout, T = THEMES[theme] || THEMES.classic;
    hits = [];
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VW, VH);

    drawGround();
    for (const o of L.outBack) blit(o.a, Math.round(sx(o.cx, o.cy)), Math.round(sy(o.cx, o.cy)), o.flip);

    drawBackWalls();
    marquee(Math.min(3.4, ROOM.w - 3), 1);
    for (const d of L.wallN) hangWall(d.a, sx(d.g, 0) - TW / 4, sy(d.g, 0) - TH / 4 - 36 * S, 1);
    for (const d of L.wallW) hangWall(d.a, sx(0, d.g) + TW / 4, sy(0, d.g) - TH / 4 - 36 * S, -1);
    for (const g of L.sconceN) sconce(sx(g, 0), sy(g, 0) - WALL_H + 28 * S, 1);
    for (const g of L.sconceW) sconce(sx(0, g), sy(0, g) - WALL_H + 28 * S, -1);

    // 바닥 데칼 — 러그 · 레드카펫
    for (const s of L.slots) if (s.owned) rug(s.cx, s.cy, 3.6, 3.6, T);
    {
      const e = L.entrance;
      const strip = (mw, ext, col) => poly([
        [e.gx - mw, e.gy + ext], [e.gx + mw, e.gy + ext], [e.gx + mw, e.gy - 2.4], [e.gx - mw, e.gy - 2.4],
      ].map((p) => [sx(p[0], p[1]), sy(p[0], p[1])]), col);
      strip(0.8, 2.2, T.rugEdge);
      strip(0.62, 2.0, T.rug);
    }

    // ---- 깊이 정렬 ----
    const items = [];
    const add = (d, fn) => items.push({ d, fn });

    for (const o of L.outFront) {
      const px = Math.round(sx(o.cx, o.cy)), py = Math.round(sy(o.cx, o.cy));
      add(o.cx + o.cy + 0.01, () => blit(o.a, px, py, o.flip));
    }
    if (L.bar) {
      for (const gy of L.bar.shelves) add(0.35 + gy - 0.5, () => blit("backBar", sx(0.35, gy), sy(0.35, gy)));
      // 카운터 에셋은 2칸짜리 모듈이라 길이만큼 이어 붙인다(테마마다 같은 자리에 다른 그림).
      {
        const n = Math.max(1, Math.round(L.bar.len / 2));
        const gy0 = L.bar.cy - (n - 1);
        for (let i = 0; i < n; i++) {
          const gy = gy0 + i * 2;
          add(L.bar.cx + gy, () => {
            const r = A("bar")
              ? blit("bar", sx(L.bar.cx, gy), sy(L.bar.cx, gy) + 4 * S, true)
              : barCounter(L.bar.cx, gy, 2);
            if (r) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "fixture", id: "bar" } });
          });
        }
      }
      for (const gy of L.bar.stools) add(2.7 + gy - 0.1, () => blit("stool", sx(2.7, gy), sy(2.7, gy)));
    }
    for (const b of L.booths) add(b[0] + b[1], () => booth(b[0], b[1]));
    for (const p of L.props) {
      const px = sx(p.cx, p.cy), py = sy(p.cx, p.cy);
      add(p.cx + p.cy, () => {
        const r = blit(p.a, px, py, p.flip);
        if (r && p.fixture) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "fixture", id: p.fixture } });
      });
    }
    for (const s of L.slots) {
      const px = sx(s.cx, s.cy), py = sy(s.cx, s.cy);
      if (!s.owned) {
        add(s.cx + s.cy, () => {
          const r = emptySlot(px, py, t);
          hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "buyTable" } });
        });
        continue;
      }
      SEAT_ANGLE.forEach((deg) => {
        const a = (deg * Math.PI) / 180;
        const gx = s.cx + Math.cos(a) * SEAT_R, gy = s.cy + Math.sin(a) * SEAT_R;
        add(gx + gy - 0.05, () => blit("chair", sx(gx, gy), sy(gx, gy), Math.cos(a) < 0));
      });
      add(s.cx + s.cy, () => {
        const r = blit("table", px, py + 16 * S);
        if (r) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "table", index: s.i } });
      });
    }
    if (L.expand) {
      const px = sx(L.expand.cx, L.expand.cy), py = sy(L.expand.cx, L.expand.cy);
      add(L.expand.cx + L.expand.cy, () => {
        const r = emptySlot(px, py, t);
        hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "buyTable" } });
      });
    }
    if (L.host) {
      const px = sx(L.host.cx, L.host.cy), py = sy(L.host.cx, L.host.cy);
      add(L.host.cx + L.host.cy, () => {
        const r = blit("board", px, py);
        if (r) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "tournament" } });
      });
    }
    for (const n of L.people) {
      const st = actorAt(n, t);
      add(st.gx + st.gy + 0.02, () => {
        const px = Math.round(sx(st.gx, st.gy)), py = Math.round(sy(st.gx, st.gy));
        ctx.globalAlpha = 0.22;
        PixelSprites.ellipse(ctx, px, py - 2, 7 * S, 3 * S, "#2a1c12");
        ctx.globalAlpha = 1;
        blit(st.sprite, px, py + st.bob * S, st.flip);
        const im = A(st.sprite);
        const headY = py - (im ? im.height * S : 32 * S);
        const b = bubbles.find((q) => q.seed === n.seed);
        if (b) {
          const r = diamondBubble(px, headY, t);
          hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "bubble", id: b.id } });
        } else if (n.emote && Math.sin(t * 0.0006 + n.seed) > 0.6) emote(px, headY, n.emote, t);
      });
    }
    frontWall(L, add);
    {
      const e = L.entrance;
      add(e.gx + e.gy + 0.6, () => blit(A("doors") ? "doors" : "door", Math.round(sx(e.gx, e.gy)), Math.round(sy(e.gx, e.gy)) + 6 * S, true));
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    // ---- 조명 · 라벨 (전부 앞에) ----
    for (const s of L.slots) {
      if (!s.owned) continue;
      const px = Math.round(sx(s.cx, s.cy)), py = Math.round(sy(s.cx, s.cy));
      glow(px, py - 6 * S, 34 * S, 0.45);
      const ly = py - 30 * S;
      R(px - S / 2, ly - 22 * S, S, 22 * S, "#3a2a20");
      blit("lamp", px, ly);
      glow(px, ly + 3 * S, 14 * S, 0.75);
    }
    if (snap && snap.showTableIncome && snap.perTableIncome > 0) {
      for (const s of L.slots) {
        if (!s.owned) continue;
        incomeTag(Math.round(sx(s.cx, s.cy)), Math.round(sy(s.cx, s.cy)) - 54 * S, snap.perTableIncome);
      }
    }

    const now = performance.now();
    chips = chips.filter((c) => now - c.t0 < 900);
    for (const c of chips) {
      const k = (now - c.t0) / 900;
      ctx.globalAlpha = 1 - k;
      PixelSprites.ellipse(ctx, c.x + c.vx * k * 60, c.y + c.vy * k * 60 + 120 * k * k, 3 * S, 2 * S, c.color);
      ctx.globalAlpha = 1;
    }
    bubbles = bubbles.filter((b) => now < b.until);
  }

  // ---------------- 공개 API ----------------
  function resize() {
    if (!canvas || !host) return;
    const r = host.getBoundingClientRect();
    VW = Math.max(240, Math.round(r.width));
    VH = Math.max(240, Math.round(r.height));
    canvas.width = VW; canvas.height = VH;
    canvas.style.width = VW + "px"; canvas.style.height = VH + "px";
    if (snap) layout = buildLayout(snap);
  }

  function init(container) {
    host = typeof container === "string" ? document.getElementById(container) : container;
    if (!host) return;
    canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;image-rendering:pixelated";
    host.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VW;
      const y = ((e.clientY - r.top) / r.height) * VH;
      for (let i = hits.length - 1; i >= 0; i--) {   // 나중에 그린 것이 위
        const h = hits[i];
        if (x < h.x || y < h.y || x > h.x + h.w || y > h.y + h.h) continue;
        if (h.info.type === "bubble") {
          bubbles = bubbles.filter((b) => b.id !== h.info.id);
          if (typeof api.onDiamondBubble === "function") api.onDiamondBubble();
        } else if (typeof api.onTap === "function") api.onTap(h.info);
        return;
      }
    });
    loadAll().then(() => { if (snap) layout = buildLayout(snap); });
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function update(s) {
    snap = s;
    theme = THEMES[s.theme] ? s.theme : "classic";
    if (loaded && !SETS[theme]) loadSet(theme);      // 처음 쓰는 테마면 그때 받아 온다
    layout = buildLayout(s);
  }

  function chipBurst(colorHex) {
    const color = colorHex || "#f0c04a";
    const t0 = performance.now();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      chips.push({ x: VW / 2, y: VH * 0.46, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 0.9 - 1.3, color, t0 });
    }
  }

  function spawnDiamondBubble(lifeSec) {
    if (!layout) return false;
    const life = lifeSec || 12;
    const seated = layout.people.filter((p) => p.seat && !bubbles.some((b) => b.seed === p.seed));
    if (!seated.length || bubbles.length >= 3) return false;
    const who = seated[(Math.random() * seated.length) | 0];
    bubbles.push({ id: Math.random().toString(36).slice(2), seed: who.seed, until: performance.now() + life * 1000 });
    return true;
  }

  let activeFloor = 1;
  function setFloor(n) { activeFloor = n === 2 ? 2 : 1; }
  function getFloorInfo() { return { active: activeFloor, unlocked: 1 }; }

  Object.assign(api, { init, update, chipBurst, spawnDiamondBubble, setFloor, getFloorInfo });
  return api;
})();

// game.js는 window.PubScene3D 만 알고 있다. 이름은 그대로 두고 알맹이만 바꾼다.
window.PubScene2D = PubScene2D;
window.PubScene3D = PubScene2D;

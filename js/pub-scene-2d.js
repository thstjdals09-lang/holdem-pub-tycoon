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

  // 에셋은 assets/pack/<테마>/ 한 곳에 모여 있고, 테마 5종이 같은 파일 이름을 쓴다.
  // 크기 규칙은 tools/pack-spec.mjs 하나가 정한다:
  //   가구 폭 = (발자국 가로칸 + 세로칸) × 16   (타일 32×16)
  //   사람 키 = 28 (앉으면 20)
  // 그래서 테마 전환은 폴더 이름만 바꾸면 되고, 배치 좌표는 테마와 무관하게 유지된다.
  const PROPS = ["table_6", "table_8", "chair", "dealer_chair", "stool", "sofa", "armchair",
    "lounge_table", "rug_rect", "rug_round", "side_table", "partition",
    "bar_straight", "bar_corner", "back_bar", "beer_tap", "fridge", "sink", "cart", "coffee",
    "bottle_cabinet", "tray", "snack", "safe",
    "pendant", "chandelier", "sconce", "art_large", "art_small", "menu_board", "neon",
    "dartboard", "jukebox", "clock", "trophy_case", "palm",
    "door", "board", "stanchion", "coat_rack", "host_desk", "street_lamp", "tree", "bush",
    "bench", "flower_bed", "trash_bin", "taxi"];
  // 사람: 앞/뒤 2장을 좌우반전해 4방향을 만든다. 걷기는 4프레임 사이클.
  const ACTORS = [
    "a_walk_f1", "a_walk_f2", "a_walk_f3", "a_walk_f4",
    "a_walk_b1", "a_walk_b2", "a_walk_b3", "a_walk_b4",
    "a_stand_f", "a_sit_f", "a_stand_b", "a_sit_b",
    "b_stand_f", "b_sit_f", "b_stand_b", "b_sit_b",
    "c_stand_f", "c_sit_f", "c_stand_b", "c_sit_b",
    "pd_stand", "pd_deal", "sv_stand", "sv_tray"];
  const SRC = {};
  for (const k of PROPS) SRC[k] = "props/" + k + ".png";
  for (const k of ACTORS) SRC[k] = "actors/" + k + ".png";

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

  const MANIFEST = {};      // 테마 → { 이름: {w,h,axis} }  (에셋이 어느 축으로 그려졌는지)
  const SETS = {};          // 테마 → { 키: Image }
  const IMG = {};           // 기본(클래식) — 테마에 빠진 게 있으면 여기서 채운다
  let loaded = false;

  function loadSet(name) {
    if (SETS[name]) return Promise.resolve(SETS[name]);
    const bank = {};
    SETS[name] = bank;
    fetch("assets/pack/" + name + "/manifest.json")
      .then((r) => r.json()).then((j) => { MANIFEST[name] = j; })
      .catch(() => {});
    return Promise.all(Object.keys(SRC).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { bank[k] = im; res(); };
      im.onerror = () => res();
      im.src = "assets/pack/" + name + "/" + SRC[k];
    }))).then(() => bank);
  }
  /** 현재 테마의 그림. 없으면 기본 세트. */
  function A(key) {
    const bank = SETS[theme];
    return (bank && bank[key]) || IMG[key] || null;
  }
  function loadAll() {
    return loadSet("classic").then((bank) => { Object.assign(IMG, bank); loaded = true; });
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

  // 카메라 — 손가락으로 끌면 화면이 따라 움직인다. 방이 화면보다 넓으므로 필수다.
  let camX = 0, camY = 0;
  const sx = (gx, gy) => OX + camX + (gx - gy) * (TW / 2);
  const sy = (gx, gy) => OY + camY + (gx + gy) * (TH / 2);
  function clampCam() {
    const halfW = (ROOM.w + ROOM.d) * (TW / 4);
    const halfH = (ROOM.w + ROOM.d) * (TH / 4);
    camX = Math.max(-halfW, Math.min(halfW, camX));
    camY = Math.max(-halfH * 0.8, Math.min(halfH * 0.8, camY));
  }

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
  /** 바닥에 놓는 물건. 그림 폭이 (발자국 가로+세로)×16 이므로,
   *  발자국의 남쪽 꼭짓점 = 중심에서 아래로 (폭/4) 만큼 내려간 지점이다.
   *  이 규칙 하나로 모든 가구가 제 칸에 정확히 앉는다 — 물건마다 보정값을 주던 걸 없앴다. */
  /** 그림이 그려진 축(매니페스트)과 놓는 축이 다르면 좌우반전한다.
   *  벽마다 가구가 제각각 방향을 보던 원인이 이것이었다 — 이제 데이터가 정한다. */
  function artAxis(key) {
    const m = MANIFEST[theme] || MANIFEST.classic;
    return (m && m[key] && m[key].axis) || "sym";
  }
  function needFlip(key, placeAxis) {
    const a = artAxis(key);
    return a !== "sym" && placeAxis && a !== placeAxis;
  }
  function blitProp(key, cx, cy, placeAxis) {
    const im = A(key);
    if (!im) return null;
    return blit(key, sx(cx, cy), sy(cx, cy) + (im.width * S) / 4, needFlip(key, placeAxis));
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
  /** 벽에 거는 그림.
   *  정면으로 그려진 것(axis=sym)은 벽 기울기에 눕히고,
   *  이미 기울어져 그려진 것은 그대로 걸되 반대쪽 벽에서는 좌우반전한다.
   *  dir +1 = 북쪽 벽(gx 방향), -1 = 서쪽 벽(gy 방향). */
  function hangWall(key, cx, cy, dir) {
    const a = artAxis(key);
    if (a === "sym") return blitWall(key, cx, cy, dir);
    const im = A(key);
    if (!im) return;
    const wantAxis = dir > 0 ? "gx" : "gy";
    blit(key, cx, cy + (im.height * S) / 2, a !== wantAxis);
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
  const WHO = ["a", "b", "c"];
  const EMOTE = ["spade", "heart", "note"];
  // 6등분하면 딜러 자리(-90)와 손님 자리가 겹친다. 손님은 5자리, -90은 딜러 몫.
  const SEAT_ANGLE = [-30, 30, 90, 150, 210];
  // 좌석은 **화면 좌표 타원**으로 잡는다. 격자에서 원을 그리면 화면에서는 대각선으로
  // 늘어난 타원이 되어, 위쪽 자리가 테이블에 파묻히고 옆자리는 너무 멀어진다.
  // 테이블 그림이 화면에서 128×96 이므로 그보다 한 바퀴 큰 타원에 앉힌다.
  const SIT_K = 0.95;                  // 사람은 의자 바로 앞 — 테이블 가장자리에 붙어야 "앉았다"로 읽힌다                  // 사람은 의자보다 조금 안쪽
  /** 좌석 타원의 화면 반지름 — 테이블 그림에서 직접 뽑는다.
   *  고정값으로 두면 테마마다 테이블 폭이 달라질 때 사람이 테이블 위에 올라간다. */
  function seatRX() {
    const im = A("table_6");
    return (im ? (im.width * S) / 2 : 64) + 9 * S;
  }
  /** 테이블 중심에서 각도 deg, 반지름 배율 k 인 자리의 격자 좌표.
   *  아이소에서는 화면 타원(가로:세로 = 2:1)이 곧 바닥의 원이다. */
  function seatAt(cx, cy, deg, k) {
    const a = (deg * Math.PI) / 180;
    const rx = seatRX() * k;
    const ox = rx * Math.cos(a), oy = (rx / 2) * Math.sin(a);
    const diff = ox / (TW / 2), sum = oy / (TH / 2);
    return [cx + (sum + diff) / 2, cy + (sum - diff) / 2];
  }

  // 앞/뒤 그림 두 장으로 아이소 4방향을 만든다.
  //   +gx(오른쪽 아래) = 앞 그대로 / +gy(왼쪽 아래) = 앞 반전
  //   -gx(왼쪽 위)    = 뒤 반전   / -gy(오른쪽 위) = 뒤 그대로
  // 이래야 "뒤로 걷는" 것처럼 안 보인다 — 진행 방향과 몸이 같은 쪽을 본다.
  function facing(hx, hy) {
    if (Math.abs(hx) >= Math.abs(hy)) {
      return hx >= 0 ? { back: false, flip: false } : { back: true, flip: true };
    }
    return hy >= 0 ? { back: false, flip: true } : { back: true, flip: false };
  }

  /** 사람 하나의 지금 그림과 방향. n.mode = sit | stand | walk | staff */
  function actorAt(n, t) {
    let gx = n.gx, gy = n.gy, hx = n.hx || 0, hy = n.hy || 1;
    if (n.walk) {
      const ph = Math.sin(t * n.walk.speed + ((hash(n.seed) % 628) / 100));
      const k = (ph + 1) / 2;
      gx = n.walk.from[0] + (n.walk.to[0] - n.walk.from[0]) * k;
      gy = n.walk.from[1] + (n.walk.to[1] - n.walk.from[1]) * k;
      const fwd = Math.cos(t * n.walk.speed + ((hash(n.seed) % 628) / 100)) > 0 ? 1 : -1;
      hx = (n.walk.to[0] - n.walk.from[0]) * fwd;
      hy = (n.walk.to[1] - n.walk.from[1]) * fwd;
    }
    const f = facing(hx, hy);
    let bob = 0;
    let sprite;
    if (n.mode === "staff") {
      // 직원도 움직여야 한다 — 딜러는 딜/대기를 번갈아, 걷는 직원은 한 픽셀 흔들린다
      sprite = n.anim ? n.anim[Math.floor(t / (n.animMs || 900) + n.seed) % n.anim.length] : n.sprite;
      if (n.walk) bob = Math.floor(t / 220 + n.seed) % 2 ? -1 : 0;
    }
    else if (n.mode === "walk") {
      const frame = Math.floor(t / 150 + n.seed) % 4;
      sprite = "a_walk_" + (f.back ? "b" : "f") + (frame + 1);
    } else {
      sprite = n.who + "_" + (n.mode === "sit" ? "sit" : "stand") + "_" + (f.back ? "b" : "f");
    }
    return { gx, gy, sprite, flip: f.flip, bob };
  }

  /** 사람이 지나가면 안 되는 곳(테이블·바·소파). 반지름은 격자 칸 단위. */
  function makeBlocks(slots, bar, booths, host) {
    const b = [];
    for (const t of slots) if (t.owned) b.push({ x: t.cx, y: t.cy, r: 2.7 });
    if (bar) { for (let g = bar.cy - bar.len / 2; g <= bar.cy + bar.len / 2; g += 1) b.push({ x: 1.6, y: g, r: 2.0 }); }
    for (const s2 of booths) b.push({ x: s2[0], y: s2[1], r: 1.7 });
    if (host) b.push({ x: host.cx, y: host.cy, r: 1.2 });
    return b;
  }
  const isBlocked = (b, x, y) => b.some((o) => (x - o.x) * (x - o.x) + (y - o.y) * (y - o.y) < o.r * o.r);
  /** 방 안에서 막히지 않은 점 하나 */
  function freeSpot(b, W, D, seed, taken) {
    for (let i = 0; i < 60; i++) {
      const x = 1.3 + (hash(seed + i * 7) % 1000) / 1000 * (W - 2.6);
      const y = 1.3 + (hash(seed + i * 13 + 3) % 1000) / 1000 * (D - 2.6);
      if (isBlocked(b, x, y)) continue;
      // 이미 자리 잡은 사람과 너무 가까우면 다시 고른다 — 사람끼리 겹치던 원인
      if (taken && taken.some((t) => (t[0] - x) ** 2 + (t[1] - y) ** 2 < 2.2 * 2.2)) continue;
      return [x, y];
    }
    return [W / 2, D / 2];
  }
  /** 두 점을 잇는 직선이 아무것도 안 뚫는 경로. 못 찾으면 null. */
  function freePath(b, W, D, seed, taken) {
    for (let k = 0; k < 14; k++) {
      const A = freeSpot(b, W, D, seed + k * 131, taken);
      const B = freeSpot(b, W, D, seed + k * 197 + 41);
      const d = Math.hypot(A[0] - B[0], A[1] - B[1]);
      if (d < 3.5) continue;
      let ok = true;
      for (let i = 1; i < 12; i++) {
        const t2 = i / 12;
        if (isBlocked(b, A[0] + (B[0] - A[0]) * t2, A[1] + (B[1] - A[1]) * t2)) { ok = false; break; }
      }
      if (ok) return { from: A, to: B };
    }
    return null;
  }

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

    // ── 입구 · 대회 데스크 (사람 배치가 이 자리를 피해야 해서 먼저 정한다) ──
    const entrance = { gx: W, gy: Math.round(D * 0.78) };
    const host = s.tournamentWins > 0 ? { cx: W - 1.1, cy: D - 1.6 } : null;

    // ── 사람 ──
    const people = [];
    const seatsPerTable = Math.max(2, Math.round((s.seatsMin + s.seatsMax) / 2) - 1);
    const occ = Math.max(0, Math.min(1, s.occupancy || 0));
    slots.filter((x) => x.owned).forEach((t) => {
      // 딜러는 테이블 북쪽에 서서 손님 쪽(+gy)을 본다
      if (s.assignedDealers && s.assignedDealers[t.i]) {
        const [dgx, dgy] = seatAt(t.cx, t.cy, -90, 1.62);   // 딜러는 테이블 뒤로 한 걸음
        people.push({ gx: dgx, gy: dgy, mode: "staff", anim: ["pd_stand", "pd_deal"], animMs: 1100,
                      hx: 0, hy: 1, seed: t.i * 17 + 3 });
      }
      const filled = Math.max(1, Math.round(seatsPerTable * occ));
      for (let k = 0; k < filled && k < SEAT_ANGLE.length; k++) {
        const deg = SEAT_ANGLE[k];
        const ang = (deg * Math.PI) / 180;
        const seed = t.i * 100 + k * 7;
        const [sgx, sgy] = seatAt(t.cx, t.cy, deg, SIT_K);
        // 앉은 사람은 반드시 테이블 쪽을 본다 — 이걸 안 하면 등지고 앉은 것처럼 보인다
        people.push({
          gx: sgx, gy: sgy,
          hx: t.cx - sgx, hy: t.cy - sgy,
          mode: "sit", who: pick(WHO, seed), seat: true, seed,
          emote: hash(seed) % 5 === 0 ? pick(EMOTE, seed + 1) : null,
        });
      }
      // 구경꾼 — 테이블 오른쪽에 서서 테이블을 본다
      if (occ > 0.5) {
        const [wgx, wgy] = seatAt(t.cx, t.cy, 0, 1.5);
        people.push({ gx: wgx, gy: wgy, mode: "stand",
                      who: pick(WHO, t.i * 31), hx: t.cx - wgx, hy: t.cy - wgy, seed: t.i * 31 });
      }
    });
    // 바텐더 — 카운터 안쪽에서 홀(+gx)을 본다 / 바 손님은 카운터 쪽을 본다
    if (bar) {
      const bt = Math.min(2, (s.staff && s.staff.bartender) || 0);
      for (let i = 0; i < bt; i++) {
        people.push({ gx: 0.85, gy: bar.cy - 1.2 + i * 2.4, mode: "staff",
                      anim: ["sv_stand", "sv_tray"], animMs: 1600, hx: 1, hy: 0, seed: 770 + i });
      }
      bar.stools.forEach((gy, i) => {
        if (hash(900 + i) % 5 === 0) return;              // 한두 자리는 비워 둔다
        const seed = 800 + i * 13;
        people.push({ gx: 2.5, gy, mode: "sit", who: pick(WHO, seed), hx: -1, hy: 0, seat: true, seed });
      });
    }
    // 서버 — 홀을 가로지른다 (쟁반 든 그림은 한 장뿐이라 방향만 맞춘다)
    const blocks = makeBlocks(slots, bar, booths, host);
    const taken = [];          // 걸어다니는 사람들의 출발점 — 서로 떨어뜨린다
    const servers = Math.min(3, (s.staff && s.staff.server) || 0);
    for (let i = 0; i < servers; i++) {
      const seed = 700 + i * 11;
      const path = freePath(blocks, W, D, seed, taken);
      if (!path) continue;
      taken.push(path.from);
      people.push({ gx: path.from[0], gy: path.from[1], mode: "staff", sprite: "sv_tray", seed,
                    walk: { ...path, speed: 0.00012 + i * 0.00003 } });
    }
    // 돌아다니는 손님 — 4프레임 보행 사이클, 진행 방향을 보고 걷는다
    // 같은 그림의 사람이 여럿 걸으면 겹칠 때 특히 눈에 띈다 — 수를 줄이고 간격을 넓힌다
    const walkers = Math.min(3, 1 + Math.round(occ * 2));
    for (let i = 0; i < walkers; i++) {
      const seed = 400 + i * 23;
      const path = freePath(blocks, W, D, seed, taken);
      if (!path) continue;
      taken.push(path.from);
      people.push({ gx: path.from[0], gy: path.from[1], mode: "walk", who: "a", seed,
                    walk: { ...path, speed: 0.00009 + i * 0.00002 } });
    }

    // ── 화분 · 소품 ──
    const props = [];
    const P = (a, cx, cy, axis) => props.push({ a, cx, cy, axis: axis || "gx" });
    P("palm", 7.0, 0.6); P("palm", 0.6, 0.6); P("palm", W - 0.6, D - 0.7);
    const plantLv = (s.decor && s.decor.plant) || 0;
    // 세 번째 값 = 좌우반전 여부 (세로줄에 놓는 것은 원본, 가로줄은 반전)
    const plantSpots = [[5.6, 0.6, "gx"], [2.8, 0.6, "gx"], [9.8, 3.4, "gy"],
                        [7.4, D - 0.8, true], [2.6, 9.6, false], [11.4, 6.4, false]];
    for (let i = 0; i < Math.min(plantLv, plantSpots.length); i++) {
      const sp = plantSpots[i];
      P("flower_bed", sp[0], sp[1], sp[2]);
    }
    // 냉장고는 바 끝에 붙인다(오른쪽 벽은 화면 밖이다)
    if ((s.fixtures && s.fixtures.fridge) > 0) props.push({ a: "fridge", cx: 1.3, cy: 6.9, fixture: "fridge" });

    // ── 벽 장식 ──
    const decor = s.decor || {};
    const wallN = [];
    const artN = 1 + Math.min(2, (decor.neon || 0) + (decor.dart || 0));
    for (let i = 0; i < artN; i++) {
      const g = 5.2 + i * 1.7;
      if (g < Math.min(W - 0.8, 8.2)) wallN.push({ g, a: i % 2 ? "art_large" : "menu_board" });
    }
    const wallW = [];
    if (!bar) for (let i = 0; i < 2; i++) wallW.push({ g: 2.0 + i * 2.2, a: i % 2 ? "menu_board" : "art_large" });
    else if (D >= 9) wallW.push({ g: Math.min(D - 1.2, 7.4), a: "art_small" });
    // 벽등 — 뒷벽을 따라. 아늑함은 대부분 여기서 나온다.
    const sconceN = [], sconceW = [];
    for (let g = 1.6; g < Math.min(W - 0.4, 8.6); g += 2.4) sconceN.push(g);
    for (let g = 1.6; g < Math.min(D - 0.4, 8.6); g += 2.4) sconceW.push(g);

    // ── 입구 · 대회 데스크 ──

    // ── 바깥 ── 도심 블록: 좁은 보도 + 도로. 잔디는 두지 않는다.
    const out = [];
    const O = (a, cx, cy, axis) => out.push({ a, cx, cy, axis: axis || "gy" });
    const X = "gx";   // 가로줄에 놓는다 — 그림 축이 다르면 blitProp 이 알아서 뒤집는다
    O("board", entrance.gx + 1.8, D + 1.4);
    for (let g = 1.2; g < W + 1; g += 3.4) O("flower_bed", g, D + 2.4, X);
    for (let g = 0.5; g < W; g += 4.6) O("street_lamp", g, D + 3.1);
    O("bench", 2.4, D + 2.9, X); O("bench", W - 2.6, D + 2.9, X);
    for (let g = -1; g < W + 3; g += 3.0) O("tree", g, D + 11.4, X);
    for (let g = 0; g < W + 2; g += 4.2) O("street_lamp", g, -5.0);
    for (let g = -1; g < W + 3; g += 2.8) O("tree", g, -11.4, X);
    for (let g = -1; g < W + 3; g += 3.6) O("bush", g + 1.2, -10.2);
    for (let g = -6; g < D + 8; g += 3.2) { O("tree", -11.4, g); O("tree", W + 11.4, g); }

    // 홍보 직원 — 가게 앞에서 전단을 돌린다 (게임의 marketer 고용 수만큼)
    const marketers = Math.min(2, (s.staff && s.staff.marketer) || 0);
    for (let i = 0; i < marketers; i++) {
      people.push({ gx: entrance.gx - 2.4 - i * 1.6, gy: D + 2.6, mode: "staff", sprite: "sv_stand",
                    hx: 0, hy: 1, seed: 880 + i });
    }

    // 문 앞 줄 · 보도 행인
    for (let i = 0; i < 3; i++) {
      const seed = 900 + i * 13;
      people.push({ gx: entrance.gx - 0.9 + (i % 2) * 1.6, gy: D + 1.3 + ((i / 2) | 0) * 1.2,
                    mode: "stand", who: pick(WHO, seed), hx: -1, hy: -1, seed });
    }
    for (let i = 0; i < 3; i++) {
      const seed = 950 + i * 29;
      const gy = D + 3.3 + (i % 2) * 1.1;
      people.push({ gx: -2, gy, mode: "walk", who: "a", seed,
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
    if (A("sofa")) blitProp("sofa", cx, cy, "gx");
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
    for (const o of L.outBack) blitProp(o.a, o.cx, o.cy, o.axis);

    drawBackWalls();
    marquee(Math.min(3.4, ROOM.w - 3), 1);
    for (const d of L.wallN) hangWall(d.a, sx(d.g, 0) - TW / 4, sy(d.g, 0) - TH / 4 - 36 * S, 1);
    for (const d of L.wallW) hangWall(d.a, sx(0, d.g) + TW / 4, sy(0, d.g) - TH / 4 - 36 * S, -1);
    for (const g of L.sconceN) sconce(sx(g, 0), sy(g, 0) - WALL_H + 28 * S, 1);
    for (const g of L.sconceW) sconce(sx(0, g), sy(0, g) - WALL_H + 28 * S, -1);

    // 바닥 데칼 — 러그 · 레드카펫
    for (const s of L.slots) if (s.owned) blitProp("rug_rect", s.cx, s.cy, "gy");
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
      add(o.cx + o.cy + 0.01, () => blitProp(o.a, o.cx, o.cy, o.axis));
    }
    if (L.bar) {
      for (const gy of L.bar.shelves) add(0.35 + gy - 0.5, () => blitProp("back_bar", 0.35, gy, "gy"));
      // 카운터 에셋은 2칸짜리 모듈이라 길이만큼 이어 붙인다(테마마다 같은 자리에 다른 그림).
      {
        const n = Math.max(1, Math.round(L.bar.len / 2));
        const gy0 = L.bar.cy - (n - 1);
        for (let i = 0; i < n; i++) {
          const gy = gy0 + i * 2;
          add(L.bar.cx + gy, () => {
            const r = A("bar_straight") ? blitProp("bar_straight", L.bar.cx, gy, "gy")
                                        : barCounter(L.bar.cx, gy, 2);
            if (r) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, info: { type: "fixture", id: "bar" } });
          });
        }
      }
      for (const gy of L.bar.stools) add(2.7 + gy - 0.1, () => blitProp("stool", 2.7, gy, "gy"));
    }
    for (const b of L.booths) add(b[0] + b[1], () => booth(b[0], b[1]));
    for (const p of L.props) {
      const px = sx(p.cx, p.cy), py = sy(p.cx, p.cy);
      add(p.cx + p.cy, () => {
        const r = blitProp(p.a, p.cx, p.cy, p.axis);
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
        const [gx, gy] = seatAt(s.cx, s.cy, deg, 1.08);
        // 의자는 앉은 사람보다 한쪽만 앞이다 — 가까운 쪽(아래)은 등받이가 사람을 가리고,
        // 먼 쪽(위)은 사람 뒤에 놓인다. 그래야 "앉아 있다"로 보인다.
        const near = Math.sin(a) > 0;
        add(gx + gy + (near ? 0.12 : -0.12), () => blitProp("chair", gx, gy));
      });
      add(s.cx + s.cy, () => {
        const r = blitProp("table_6", s.cx, s.cy, "gy");
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
        const r = blitProp("board", L.host.cx, L.host.cy, "gx");
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
      add(e.gx + e.gy + 0.6, () => blitProp("door", e.gx, e.gy, "gy"));
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
      blit("pendant", px, ly);
      glow(px, ly + 3 * S, 14 * S, 0.75);
    }
    // 테이블별 수익은 모두 같은 값이라 네 번 띄우면 화면만 어지럽다 — 한 곳에만 띄운다.
    if (snap && snap.showTableIncome && snap.perTableIncome > 0) {
      for (const s of L.slots.filter((x) => x.owned).slice(0, 1)) {
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
    // ── 손가락으로 화면 끌기 ──
    // 방이 화면보다 넓으므로 이동이 없으면 구석을 볼 수가 없다.
    // 끈 거리가 짧으면 탭으로 친다 — 그래야 테이블을 눌러도 화면이 안 흔들린다.
    let press = null;
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH];
    };
    const tapAt = (x, y) => {
      for (let i = hits.length - 1; i >= 0; i--) {   // 나중에 그린 것이 위
        const h = hits[i];
        if (x < h.x || y < h.y || x > h.x + h.w || y > h.y + h.h) continue;
        if (h.info.type === "bubble") {
          bubbles = bubbles.filter((b) => b.id !== h.info.id);
          if (typeof api.onDiamondBubble === "function") api.onDiamondBubble();
        } else if (typeof api.onTap === "function") api.onTap(h.info);
        return;
      }
    };
    canvas.addEventListener("pointerdown", (e) => {
      const [x, y] = toCanvas(e);
      press = { x, y, camX, camY, moved: false };
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!press) return;
      const [x, y] = toCanvas(e);
      const dx = x - press.x, dy = y - press.y;
      if (!press.moved && Math.abs(dx) + Math.abs(dy) > 10) press.moved = true;
      if (press.moved) { camX = press.camX + dx; camY = press.camY + dy; clampCam(); }
    });
    const release = (e) => {
      if (!press) return;
      if (!press.moved) { const [x, y] = toCanvas(e); tapAt(x, y); }
      press = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => { press = null; });
    canvas.addEventListener("pointerleave", () => { press = null; });
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

// PixelScene — 도트 매장 렌더러.
//
// 1층·2층을 한 화면에 같이 보여준다(버튼 전환 없음). 위층은 FLOOR_H만큼 올려서
// 뒤쪽에 겹쳐 그리는 "단면 다이어그램" 방식 — 키비주얼 포스터와 같은 구성이다.
//
// 그리는 순서가 전부다. 아이소메트릭은 z버퍼가 없으니 화가 알고리즘으로
// (gx + gy)가 작은 것부터 = 안쪽부터 칠한다. 층은 아래층부터.
//
// 좌표 규칙(이걸 헷갈리면 가구가 공중에 뜬다):
//   - iso(gx, gy)는 "격자 점"의 화면 좌표다. 칸(x,y)의 네 꼭짓점은 (x,y)~(x+1,y+1).
//   - 칸의 남쪽(화면 아래) 꼭짓점 = 점 (x+1, y+1).
//   - 모든 오브젝트는 배치 단계에서 자기 앵커를 "격자 점"(px, py)으로 들고 있는다.
//     칸 좌표와 점 좌표를 섞어 쓰지 않는다.
//
// 픽셀이 뭉개지지 않게 1배 오프스크린에 그린 뒤 정수배로 확대해서 올린다.

const PixelScene = (() => {
  const A = PixelArt;
  const S = PixelSprites;
  const { TW, TH } = A;
  const FLOOR_H = 46; // 층 사이 높이(px) — 위층을 이만큼 올려 그린다
  const WALL_H = 26;

  const iso = (gx, gy, level) => [((gx - gy) * TW) / 2, ((gx + gy) * TH) / 2 - level * FLOOR_H];

  function boundsOf(floors) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of floors) {
      for (const key of PixelMap.cellsOf(f)) {
        const [gx, gy] = key.split(",").map(Number);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const [x, y] = iso(gx + dx, gy + dy, f.level);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * 층 하나에 놓을 오브젝트 목록. 배치는 결정적(셀 순서 기반)이라
   * 다시 그려도 가구가 돌아다니지 않는다. 각 오브젝트는 앵커를 격자 점으로 들고 있다.
   */
  function layoutFloor(floor, theme, opts) {
    const cells = PixelMap.cellsOf(floor);
    const list = [...cells].map((k) => k.split(",").map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const used = new Set();
    const objs = [];
    const free = (x, y) => cells.has(`${x},${y}`) && !used.has(`${x},${y}`);
    const take = (x, y, w, h) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add(`${x + i},${y + j}`);
    };
    const put = (t, px, py, extra) => objs.push({ t, px, py, ...extra });

    const isUpper = floor.level > 0;
    let tablesLeft = isUpper ? Math.max(0, (opts.tables || 0) - 6) : Math.min(opts.tables || 0, 6);

    // 1) 바 카운터 — 뒷벽(y=0)을 따라 왼쪽부터. 2×1칸.
    if (!isUpper && opts.bar) {
      for (const [x, y] of list) {
        if (y !== 0 || !free(x, y) || !free(x + 1, y)) continue;
        put("bar", x + 2, y + 1);
        put("shelf", x + 2, y); // 뒷벽에 붙는 선반
        take(x, y, 2, 1);
        put("stool", x + 1.4, y + 2);
        put("stool", x + 2.4, y + 2);
        break;
      }
    }
    // 2) 트로피 거치대 — 2층이 있으면 위층 안쪽에
    if (opts.trophyStand) {
      const row = list.filter(([, y]) => y === 0);
      for (const [x, y] of row.reverse()) {
        if (free(x, y)) { put("trophy", x + 1, y + 1); take(x, y, 1, 1); break; }
      }
    }
    // 3) 오락 요소
    if (!isUpper && opts.jukebox) {
      for (const [x, y] of [...list].reverse()) {
        if (free(x, y)) { put("jukebox", x + 1, y + 1); take(x, y, 1, 1); break; }
      }
    }

    // 4) 테이블 — 2×2칸, 안쪽부터. 딜러는 북쪽, 손님은 좌우/남쪽.
    for (const [x, y] of list) {
      if (tablesLeft <= 0) break;
      if (!free(x, y) || !free(x + 1, y) || !free(x, y + 1) || !free(x + 1, y + 1)) continue;
      // 테이블은 2×2지만 3×3을 잡아둔다 — 딱 붙여 놓으면 손님·의자가 옆 테이블을 덮는다
      take(x, y, 3, 3);
      tablesLeft--;
      const cx = x + 1; // 2×2의 중심 점
      const cy = y + 1;
      put("table", cx, cy);
      put("dealer", cx, cy - 1.15);
      put("seat", cx - 1.25, cy + 0.1);
      put("seat", cx + 1.25, cy + 0.1);
      put("guest", cx - 0.55, cy + 1.2, { i: (x + y) % 4 });
      put("guest", cx + 0.55, cy + 1.2, { i: (x + y + 1) % 4 });
    }

    // 5) 남은 가장자리에 화분
    let plants = isUpper ? 2 : 3;
    for (const [x, y] of list) {
      if (plants <= 0) break;
      const edge = !cells.has(`${x + 1},${y}`) || !cells.has(`${x},${y + 1}`);
      if (edge && free(x, y)) { put("plant", x + 1, y + 1); take(x, y, 1, 1); plants--; }
    }
    return objs;
  }

  function drawObject(ctx, ox, oy, o, theme, level) {
    const [sx, sy] = iso(o.px, o.py, level);
    const x = ox + sx;
    const y = oy + sy;
    switch (o.t) {
      case "table": S.pokerTable(ctx, x, y, theme); break;
      case "bar": S.barCounter(ctx, x, y, theme); break;
      case "shelf": S.bottleShelf(ctx, x, y - WALL_H + 13, theme); break;
      case "stool": S.stool(ctx, x, y, theme); break;
      case "plant": S.plant(ctx, x, y, theme); break;
      case "trophy": S.trophyStand(ctx, x, y, theme); break;
      case "jukebox": S.jukebox(ctx, x, y, theme); break;
      case "seat":
        if (theme.seat === "zabuton") S.zabuton(ctx, x, y, theme);
        else S.chair(ctx, x, y, theme);
        break;
      case "dealer": {
        const d = theme.dealer;
        S.person(ctx, x, y, d, { visor: d.visor, bowtie: d.bowtie, apron: d.apron });
        break;
      }
      case "guest": S.person(ctx, x, y, theme.guests[o.i % theme.guests.length]); break;
      default: break;
    }
  }

  /** opts = { stageIndex, themeId, tables, bar, trophyStand, jukebox, scale } */
  function render(canvas, opts = {}) {
    const stage = PixelMap.STAGES[Math.max(0, Math.min(PixelMap.STAGES.length - 1, opts.stageIndex || 0))];
    const theme = PixelMap.THEMES[opts.themeId] || PixelMap.THEMES.classic;
    const pad = 32;
    const b = boundsOf(stage.floors);
    const w = Math.ceil(b.maxX - b.minX) + pad * 2;
    const h = Math.ceil(b.maxY - b.minY) + pad * 2 + WALL_H + 24;
    const off = A.surface(w, h);
    const ctx = off.ctx;
    const ox = -b.minX + pad;
    const oy = -b.minY + pad + WALL_H + 20;

    for (const floor of stage.floors) {
      const cells = [...PixelMap.cellsOf(floor)].map((k) => k.split(",").map(Number));
      const depth = (gx, gy) => gx + gy;
      const byDepth = [...cells].sort((p, q) => depth(p[0], p[1]) - depth(q[0], q[1]));

      // 바닥 두께 — 층이 판처럼 떠 있는 단면 느낌
      for (const [gx, gy] of byDepth) {
        const [x, y] = iso(gx + 1, gy + 1, floor.level);
        A.isoBox(ctx, ox + x, oy + y + 7, 1, 1, 7, A.shade(theme.wainscot, -0.3), { outline: false });
      }
      // 바닥 타일
      for (const [gx, gy] of byDepth) {
        const [x, y] = iso(gx + 1, gy + 1, floor.level);
        A.isoTile(ctx, ox + x, oy + y, theme.floor, theme.floorPattern);
      }
      // 벽 — 북쪽(back) 벽은 점 (x+1, y), 서쪽(left) 벽은 점 (x, y+1)이 남쪽 꼭짓점이다
      const walls = PixelMap.wallsOf(floor);
      const wallAnchor = (p) => (p.dir === "back" ? [p.x + 1, p.y] : [p.x, p.y + 1]);
      walls.sort((p, q) => {
        const a1 = wallAnchor(p);
        const b1 = wallAnchor(q);
        return a1[0] + a1[1] - (b1[0] + b1[1]);
      });
      for (const wp of walls) {
        const [gx, gy] = wallAnchor(wp);
        const [x, y] = iso(gx, gy, floor.level);
        S.wall(ctx, ox + x, oy + y, theme, wp.dir, WALL_H);
      }
      // 제등 (일본풍) — 북쪽 벽을 따라 한 칸 걸러 매단다
      if (theme.lantern) {
        for (const wp of walls) {
          if (wp.dir !== "back" || wp.x % 2 !== 0) continue;
          const [x, y] = iso(wp.x + 0.5, wp.y + 0.35, floor.level);
          S.lantern(ctx, ox + x, oy + y - WALL_H - 4, theme);
        }
      }
      // 오브젝트
      const objs = layoutFloor(floor, theme, opts).sort((p, q) => p.px + p.py - (q.px + q.py));
      for (const o of objs) drawObject(ctx, ox, oy, o, theme, floor.level);
    }

    const scale = opts.scale || 2;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const c2 = canvas.getContext("2d");
    c2.imageSmoothingEnabled = false;
    c2.clearRect(0, 0, canvas.width, canvas.height);
    c2.drawImage(off.canvas, 0, 0, w, h, 0, 0, w * scale, h * scale);
    return { width: w, height: h, scale };
  }

  return { render, iso, FLOOR_H, WALL_H, layoutFloor, boundsOf };
})();

if (typeof window !== "undefined") window.PixelScene = PixelScene;

// PixelSprites — 매장에 놓이는 도트 오브젝트들.
//
// 두 가지 방식을 섞는다.
//   1) 가구·구조물: 아이소 도형(박스/원통)을 코드로 조립. 2:1 아이소는 수식이라 손으로 찍는 것보다 정확하다.
//   2) 캐릭터: 픽셀 문자표. 얼굴·실루엣은 수식으로 안 나오고 한 점 한 점이 인상을 좌우한다.
//
// 모든 색은 팔레트 인자로 들어온다 → 테마가 팔레트만 바꾸면 딜러복·손님복·기물이 전부 따라온다.
// 기준점(ox, oy)은 오브젝트가 딛고 선 바닥의 남쪽 꼭짓점(캐릭터는 발밑 중앙).

const PixelSprites = (() => {
  const A = PixelArt;
  const { TW, TH, poly, line, rect, shade, faces } = A;

  // ============================================================
  //  타원(아이소 원) — 원형 테이블·스툴 받침에 쓴다
  // ============================================================
  function ellipse(ctx, cx, cy, rx, ry, color, rawStyle) {
    if (!color && !rawStyle) return;
    ctx.fillStyle = rawStyle || color;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const t = 1 - (y * y) / (ry * ry);
      if (t < 0) continue;
      const w = Math.floor(rx * Math.sqrt(t));
      if (w <= 0) continue;
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }

  /** 아이소 원통. 원형 테이블 상판·다리 받침의 기본. cy는 바닥 중심. */
  function cylinder(ctx, cx, cy, rx, ry, h, base) {
    const f = faces(base);
    ctx.fillStyle = f.right;
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const t = 1 - (x * x) / (rx * rx);
      if (t < 0) continue;
      const dy = ry * Math.sqrt(t);
      const y0 = Math.round(cy - h + dy);
      const y1 = Math.round(cy + dy);
      if (y1 > y0) ctx.fillRect(Math.round(cx + x), y0, 1, y1 - y0);
    }
    // 앞면 아래 모서리를 한 단 더 어둡게 — 바닥에 닿은 느낌
    ctx.fillStyle = f.edge;
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const t = 1 - (x * x) / (rx * rx);
      if (t < 0) continue;
      const dy = ry * Math.sqrt(t);
      ctx.fillRect(Math.round(cx + x), Math.round(cy + dy) - 1, 1, 1);
    }
    ellipse(ctx, cx, cy - h, rx, ry, f.top);
  }

  // ============================================================
  //  가구
  // ============================================================

  /** 홀덤 테이블 — 레이스트랙 상판 + 레일 + 펠트. (ox,oy)는 테이블이 놓인 바닥의 "중심점". */
  function pokerTable(ctx, ox, oy, pal) {
    const cx = ox;
    const cy = oy;
    const rx = 28;
    const ry = 14;
    const h = 9;
    cylinder(ctx, cx, cy, rx, ry, h, pal.rail);
    // 레일 안쪽 펠트
    ellipse(ctx, cx, cy - h, rx - 5, ry - 3, faces(pal.felt).top);
    ellipse(ctx, cx, cy - h, rx - 7, ry - 4, pal.felt);
    // 펠트 위 하이라이트 라인 (베팅 라인)
    ctx.fillStyle = shade(pal.felt, 0.22);
    for (let x = -(rx - 12); x <= rx - 12; x++) {
      const t = 1 - (x * x) / ((rx - 10) * (rx - 10));
      if (t < 0) continue;
      const dy = (ry - 6) * Math.sqrt(t);
      ctx.fillRect(Math.round(cx + x), Math.round(cy - h + dy), 1, 1);
    }
    // 카드 2장 + 칩 스택
    rect(ctx, cx - 5, cy - h - 3, 4, 3, "#fffaf2");
    rect(ctx, cx - 5, cy - h - 3, 4, 1, "#d8cdbe");
    rect(ctx, cx, cy - h - 3, 4, 3, "#fffaf2");
    rect(ctx, cx, cy - h - 3, 4, 1, "#d8cdbe");
    for (let i = 0; i < 3; i++) {
      const c = [pal.chipA, pal.chipB, pal.chipC][i];
      rect(ctx, cx + 8 + i * 4, cy - h - 4, 3, 4, c);
      rect(ctx, cx + 8 + i * 4, cy - h - 4, 3, 1, shade(c, 0.3));
    }
    // 레일 외곽선
    ctx.fillStyle = faces(pal.rail).edge;
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const t = 1 - (x * x) / (rx * rx);
      if (t < 0) continue;
      const dy = ry * Math.sqrt(t);
      ctx.fillRect(Math.round(cx + x), Math.round(cy - h - dy), 1, 1);
    }
  }

  /** 의자 — 등받이 유무를 옵션으로(테마가 좌식이면 등받이를 끈다) */
  function chair(ctx, ox, oy, pal, opt = {}) {
    A.isoBox(ctx, ox, oy, 0.5, 0.5, 7, pal.chairLeg);
    A.isoBox(ctx, ox, oy - 7, 0.6, 0.6, 3, pal.chairPad);
    if (opt.back !== false) {
      A.isoBox(ctx, ox - TW * 0.16, oy - 10 - TH * 0.16, 0.55, 0.12, 9, pal.chairPad);
    }
  }

  /** 자부동 — 좌식 방석. 등받이도 다리도 없이 바닥에 놓인 납작한 쿠션. */
  function zabuton(ctx, ox, oy, pal) {
    const c = pal.chairPad;
    const f = faces(c);
    // 옆면(두께) → 윗면 → 가운데 꼭지 순으로 얹는다
    ellipse(ctx, ox, oy - 2, 10, 5, f.edge);
    ellipse(ctx, ox, oy - 3, 10, 5, f.right);
    ellipse(ctx, ox, oy - 4, 10, 5, c);
    ellipse(ctx, ox, oy - 5, 8, 4, f.top);
    rect(ctx, ox - 1, oy - 6, 2, 1, shade(c, -0.3));
  }

  /** 제등 — 천장에 매다는 붉은 종이등. 위아래 어두운 테와 세로 살로 종이등처럼 보이게. */
  function lantern(ctx, ox, oy, pal) {
    const c = pal.accent;
    glow(ctx, ox, oy + 6, 16, pal.lampGlow || "#ffd9a0", 0.85);
    rect(ctx, ox, oy - 10, 1, 10, "#4a3a32"); // 줄
    const rx = 6;
    const h = 11;
    for (let y = 0; y < h; y++) {
      // 가운데가 부푼 실루엣
      const t = Math.sin((y / (h - 1)) * Math.PI);
      const w = Math.max(2, Math.round(rx * (0.55 + 0.45 * t)));
      const col = y < 3 ? shade(c, 0.16) : y > h - 4 ? shade(c, -0.18) : c;
      rect(ctx, ox - w, oy + y, w * 2, 1, col);
      if (y === 0 || y === h - 1) rect(ctx, ox - w, oy + y, w * 2, 1, "#3a2a24");
    }
    rect(ctx, ox - 2, oy - 1, 4, 1, "#3a2a24");
    rect(ctx, ox - 2, oy + h, 4, 1, "#3a2a24");
    rect(ctx, ox - 4, oy + 3, 1, 5, shade(c, 0.3)); // 빛 반사
    rect(ctx, ox - 1, oy + h + 1, 2, 2, pal.gold);  // 술
  }

  /** 바 스툴 */
  function stool(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 0.36, 0.36, 9, pal.chairLeg);
    cylinder(ctx, ox, oy - 9 - TH * 0.18, 7, 4, 3, pal.chairPad);
  }

  /** 바 카운터 — 2×1칸. 상판 + 병 선반 */
  function barCounter(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 2, 0.7, 14, pal.bar);
    A.isoBox(ctx, ox, oy - 14, 2.1, 0.8, 2, pal.barTop);
    // 상판 위 잔
    for (let i = 0; i < 3; i++) {
      const gx = ox - 18 + i * 14;
      const gy = oy - 16 - 5 - i * 1;
      rect(ctx, gx, gy - 4, 3, 5, "#dff0f7");
      rect(ctx, gx, gy - 4, 3, 1, "#ffffff");
    }
    // 앞면 포인트 라인
    ctx.fillStyle = pal.barTrim;
    line(ctx, ox - TW * 0.35, oy - 11, ox + TW * 0.9, oy - 11 - TH * 0.9, pal.barTrim);
  }

  /** 백바 병 선반 (벽에 붙는다) */
  function bottleShelf(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 1.8, 0.28, 2, pal.bar);
    const cols = pal.bottles || ["#5c3a21", "#2f6b4a", "#7a2f4a", "#2f4a7a", "#c9a24a"];
    for (let i = 0; i < 7; i++) {
      const c = cols[i % cols.length];
      const bx = ox - 22 + i * 7;
      const by = oy - 2 - i * 1.6;
      rect(ctx, bx, by - 9, 3, 9, c);
      rect(ctx, bx, by - 9, 1, 9, shade(c, 0.25));
      rect(ctx, bx + 1, by - 11, 1, 2, shade(c, -0.2));
    }
  }

  /** 화분 */
  function plant(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 0.4, 0.4, 6, pal.pot);
    const g = pal.leaf;
    ellipse(ctx, ox, oy - 6 - TH * 0.2 - 6, 9, 6, faces(g).top);
    ellipse(ctx, ox - 3, oy - 6 - TH * 0.2 - 4, 6, 4, g);
    ellipse(ctx, ox + 4, oy - 6 - TH * 0.2 - 8, 5, 3, shade(g, 0.2));
  }

  /** 트로피 거치대 — 유리장 안에 컵 3개 */
  function trophyStand(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 1, 0.5, 8, pal.wood);
    A.isoBox(ctx, ox, oy - 8, 1, 0.5, 20, shade(pal.wood, -0.1), {
      faces: { ...faces(pal.wood), left: "rgba(220,242,252,0.55)", right: "rgba(190,220,236,0.5)" },
    });
    for (let i = 0; i < 3; i++) {
      const sy = oy - 12 - i * 6;
      rect(ctx, ox - 12, sy, 24, 1, shade(pal.wood, -0.25));
      const cx = ox - 7 + i * 7;
      rect(ctx, cx, sy - 5, 4, 3, pal.gold);
      rect(ctx, cx + 1, sy - 2, 2, 2, shade(pal.gold, -0.2));
      rect(ctx, cx, sy - 6, 4, 1, shade(pal.gold, 0.3));
    }
  }

  /** 러그 — 테이블 아래 깔린다. 바닥이 허전하고 테이블이 떠 보이는 걸 잡아준다. */
  function rug(ctx, ox, oy, pal, gw, gd) {
    const base = pal.rug || shade(pal.floor, -0.12);
    const f = faces(base);
    const T = A.cornersTop(gw, gd, 0).map(([x, y]) => [ox + x, oy + y]);
    poly(ctx, T, f.left);
    // 안쪽 한 단 밝은 테두리 — 카이로소프트 러그의 이중 테두리
    const shrink = 0.72;
    const cx = (T[0][0] + T[2][0]) / 2;
    const cy = (T[0][1] + T[2][1]) / 2;
    poly(ctx, T.map(([x, y]) => [cx + (x - cx) * shrink, cy + (y - cy) * shrink]), f.top);
    poly(ctx, T.map(([x, y]) => [cx + (x - cx) * 0.56, cy + (y - cy) * 0.56]), base);
    for (let i = 0; i < 4; i++) line(ctx, T[i][0], T[i][1], T[(i + 1) % 4][0], T[(i + 1) % 4][1], f.edge);
  }

  /** 벽걸이 액자 — 벽면이 비면 방이 "대충 만든" 티가 제일 크게 난다. */
  function frame(ctx, ox, oy, pal, dir, art) {
    const w = 9, h = 11;
    const skew = dir === "back" ? 1 : -1;
    const dx = skew * 4;
    // 액자틀 → 그림 → 하이라이트
    for (let y = 0; y < h; y++) {
      const off = Math.round((y * dx) / h);
      rect(ctx, ox - w / 2 + off, oy - h + y, w, 1, pal.frameWood || shade(pal.wood, -0.1));
    }
    for (let y = 2; y < h - 2; y++) {
      const off = Math.round((y * dx) / h);
      rect(ctx, ox - w / 2 + 2 + off, oy - h + y, w - 4, 1, art);
    }
    rect(ctx, ox - w / 2 + 2, oy - h + 2, 2, 1, shade(art, 0.35));
  }

  /** 벽 간판 — 조명 박힌 목재 사인. lines에 실제 문구가 들어간다. */
  function wallSign(ctx, ox, oy, pal, dir, lines) {
    const txt = (lines && lines.length ? lines : ["POKER"]).slice(0, 2);
    const longest = Math.max(...txt.map((t) => PixelFont.measure(t, 1)));
    const w = Math.max(22, longest + 8);
    const h = txt.length > 1 ? 18 : 13;
    for (let y = 0; y < h; y++) {
      rect(ctx, ox - w / 2, oy - h + y, w, 1,
        y < 2 || y > h - 3 ? shade(pal.wood, -0.25) : pal.signBg || shade(pal.wood, -0.45));
    }
    PixelFont.block(ctx, ox, oy - h + 4, txt, pal.signInk || "#f2e4c0", 1, 2);
    // 전구 줄
    for (let i = 0; i * 5 < w - 4; i++) rect(ctx, ox - w / 2 + 2 + i * 5, oy - h - 1, 2, 2, pal.gold);
  }

  /** 벽 조명 — 따뜻한 빛 번짐까지 */
  function wallLamp(ctx, ox, oy, pal) {
    rect(ctx, ox - 1, oy - 9, 2, 5, shade(pal.wood, -0.3));
    const g = pal.lampGlow || "#ffd68f";
    // 빛 번짐(가장자리부터 옅게)
    ellipse(ctx, ox, oy - 1, 8, 6, "rgba(255,214,143,0.16)");
    ellipse(ctx, ox, oy - 1, 5, 4, "rgba(255,214,143,0.3)");
    rect(ctx, ox - 3, oy - 4, 6, 4, g);
    rect(ctx, ox - 4, oy, 8, 1, shade(g, -0.25));
    rect(ctx, ox - 2, oy - 4, 4, 1, "#fff6dc");
  }

  /** 정면 차양 간판 — 매장 입구(POKER PUB) */
  function marquee(ctx, ox, oy, pal, name) {
    const label = name || "POKER PUB";
    const w = Math.max(34, PixelFont.measure(label, 1) + 10);
    const h = 13;
    rect(ctx, ox - w / 2, oy - h, w, h, shade(pal.wood, -0.35));
    rect(ctx, ox - w / 2 + 2, oy - h + 2, w - 4, h - 4, pal.signBg || shade(pal.wood, -0.5));
    PixelFont.draw(ctx, ox, oy - h + 4, label, pal.signInk || "#f2e4c0", 1, "center");
    for (let i = 0; i * 6 < w; i++) rect(ctx, ox - w / 2 + 2 + i * 6, oy - h - 2, 2, 2, pal.gold);
    // 차양
    for (let y = 0; y < 5; y++) {
      const ww = w + 6 - y * 2;
      rect(ctx, ox - ww / 2, oy + y, ww, 1, y % 2 ? "#f2ece0" : pal.accent);
    }
  }

  /** 바깥 나무 / 덤불 */
  function tree(ctx, ox, oy, pal) {
    rect(ctx, ox - 2, oy - 8, 4, 8, "#7a5236");
    ellipse(ctx, ox, oy - 14, 11, 9, "#3f7a42");
    ellipse(ctx, ox - 3, oy - 16, 8, 6, "#4f9a50");
    ellipse(ctx, ox + 3, oy - 12, 7, 5, "#356b38");
  }
  function bush(ctx, ox, oy) {
    ellipse(ctx, ox, oy - 3, 8, 5, "#4f9a50");
    ellipse(ctx, ox - 3, oy - 5, 5, 4, "#63b062");
    ellipse(ctx, ox + 3, oy - 4, 4, 3, "#356b38");
  }

  /**
   * 난간 — 벽이 없는 가장자리(주로 2층 앞쪽)에 세운다.
   * axis "gx" = 칸의 남쪽 모서리(왼쪽 위로 뻗음), "gy" = 동쪽 모서리(오른쪽 위로 뻗음).
   * 기준점은 두 경우 모두 칸의 남쪽 꼭짓점.
   */
  function railing(ctx, ox, oy, pal, axis) {
    const ex = axis === "gx" ? ox - TW / 2 : ox + TW / 2;
    const ey = oy - TH / 2;
    const c = pal.gold;
    const f = faces(c);
    // 기둥 3개 (양 끝 + 가운데)
    for (const t of [0, 0.5, 1]) {
      const px = Math.round(ox + (ex - ox) * t);
      const py = Math.round(oy + (ey - oy) * t);
      rect(ctx, px - 1, py - 12, 2, 12, f.right);
      rect(ctx, px - 1, py - 13, 2, 2, f.top);
    }
    // 위·아래 가로대
    line(ctx, ox, oy - 12, ex, ey - 12, f.top);
    line(ctx, ox, oy - 11, ex, ey - 11, c);
    line(ctx, ox, oy - 6, ex, ey - 6, f.right);
  }

  /** 계단 — 층과 층을 잇는다. 2층이 그냥 떠 있는 판처럼 보이는 걸 막아준다. */
  function stairs(ctx, ox, oy, pal, steps, rise) {
    const n = steps || 7;
    const dh = (rise || 46) / n;
    for (let i = 0; i < n; i++) {
      // 아래에서 위로: 한 칸씩 뒤로(-gy = 오른쪽 위) 가면서 높아진다
      const sx = ox + (i * TW) / 2 / 2;
      const sy = oy - (i * TH) / 2 / 2 - i * dh;
      A.isoBox(ctx, sx, sy, 0.5, 0.9, Math.max(3, dh), pal.wainscot, { outline: false });
    }
  }

  /** 따뜻한 빛 번짐 — 조명 주변을 은은하게. 도트에서도 광원이 있으면 방이 아늑해진다. */
  function glow(ctx, ox, oy, r, color, strength) {
    const st = strength == null ? 1 : strength;
    // 알파를 3단으로 겹쳐 그라데이션 흉내 (도트라 단계가 보이는 편이 자연스럽다)
    const steps = [[1.0, 0.1], [0.66, 0.14], [0.36, 0.2]];
    for (const [k, a] of steps) {
      ctx.fillStyle = withAlpha(color, a * st);
      ellipse(ctx, ox, oy, Math.round(r * k), Math.round(r * k * 0.5), null, ctx.fillStyle);
    }
  }
  function withAlpha(hex, a) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /** 칠판 메뉴판 */
  function chalkboard(ctx, ox, oy, pal, dir) {
    const w = 13, h = 15;
    const skew = dir === "back" ? 1 : -1;
    for (let y = 0; y < h; y++) {
      const off = Math.round((y * skew * 4) / h);
      rect(ctx, ox - w / 2 + off, oy - h + y, w, 1, y < 2 || y > h - 3 ? shade(pal.wood, -0.2) : "#33403a");
    }
    PixelFont.block(ctx, ox, oy - h + 3, (pal.menu || ["DRINK", "PLAY"]).slice(0, 2), "#d8e8dc", 1, 1);
  }

  /** 맥주/네온 사인 — 빛 번짐 포함 */
  function beerSign(ctx, ox, oy, pal) {
    const c = pal.accent;
    glow(ctx, ox, oy - 5, 13, c, 0.9);
    rect(ctx, ox - 8, oy - 12, 16, 12, shade(pal.wood, -0.45));
    rect(ctx, ox - 6, oy - 10, 12, 8, shade(c, -0.25));
    PixelFont.draw(ctx, ox, oy - 9, "BEER", "#fff6dc", 1, "center");
  }

  /** 다트보드 (벽걸이) */
  function dartboard(ctx, ox, oy, pal) {
    ellipse(ctx, ox, oy, 9, 9, "#2f2a2a");
    ellipse(ctx, ox, oy, 8, 8, "#e8ddc4");
    ellipse(ctx, ox, oy, 6, 6, pal.accent);
    ellipse(ctx, ox, oy, 4, 4, "#e8ddc4");
    ellipse(ctx, ox, oy, 2, 2, pal.accent);
    rect(ctx, ox - 1, oy - 1, 2, 2, "#3a2f2a");
  }

  /** 주크박스 */
  function jukebox(ctx, ox, oy, pal) {
    A.isoBox(ctx, ox, oy, 0.8, 0.5, 22, pal.wood);
    rect(ctx, ox - 9, oy - 30, 18, 8, shade(pal.accent, -0.1));
    rect(ctx, ox - 8, oy - 29, 16, 6, pal.accent);
    for (let i = 0; i < 4; i++) rect(ctx, ox - 6 + i * 4, oy - 20, 2, 3, pal.gold);
  }

  /**
   * 벽 한 칸. (ox,oy)는 벽이 딛는 바닥 선의 "남쪽(화면 아래) 끝 점".
   *
   * 축 주의: isoBox의 gw는 격자 -gy 방향, gd는 격자 -gx 방향이다(둘 다 화면 위쪽).
   *   - "back"  = 칸의 북쪽 모서리. 격자 gx축을 따라 뻗는다 → gd = 1
   *   - "left"  = 칸의 서쪽 모서리. 격자 gy축을 따라 뻗는다 → gw = 1
   * 이걸 반대로 넣으면 벽이 바닥에서 떨어져 울타리처럼 흩어진다.
   */
  function wall(ctx, ox, oy, pal, dir, h) {
    const back = dir === "back";
    const gw = back ? 0.001 : 1;
    const gd = back ? 1 : 0.001;
    const base = back ? pal.wallBack : pal.wallSide;
    const f = faces(base);
    // 벽은 얇은 판이라 윗면만 살짝 밝게 두고 양 옆면은 같은 톤으로 — 두께가 도드라지면 지저분하다
    const flat = { ...f, left: f.left, right: shade(base, -0.06), top: shade(base, 0.12) };
    const g = A.isoBox(ctx, ox, oy, gw, gd, h, base, { faces: flat });

    // 벽 상단 목재 보 (윗면을 어두운 나무로 덮어 마감)
    {
      const cap = shade(pal.wainscot, -0.12);
      const capH = 3;
      const top = A.cornersTop(gw, gd, h).map(([px, py]) => [ox + px, oy + py]);
      poly(ctx, top, cap);
      const under = A.cornersTop(gw, gd, h - capH).map(([px, py]) => [ox + px, oy + py]);
      if (back) poly(ctx, [top[3], top[0], under[0], under[3]], shade(cap, -0.12));
      else poly(ctx, [top[0], top[1], under[1], under[0]], shade(cap, -0.2));
    }

    // 아래쪽 우드 패널(웨인스코팅) + 트림 — 보이는 면 위에 덧그린다
    const wy = Math.round(h * 0.4);
    const lift = (pt, dy) => [pt[0], pt[1] + dy];
    if (back) {
      // 보이는 면 = 서쪽 코너 → 남쪽 코너 (좌면)
      poly(ctx, [lift(g.W, h - wy), lift(g.S, h - wy), g.Sg, g.Wg], pal.wainscot);
      line(ctx, g.W[0], g.W[1] + h - wy, g.S[0], g.S[1] + h - wy, pal.trim);
    } else {
      // 보이는 면 = 남쪽 코너 → 동쪽 코너 (우면)
      poly(ctx, [lift(g.S, h - wy), lift(g.E, h - wy), g.Eg, g.Sg], shade(pal.wainscot, -0.08));
      line(ctx, g.S[0], g.S[1] + h - wy, g.E[0], g.E[1] + h - wy, pal.trim);
    }
  }

  // ============================================================
  //  캐릭터 — 픽셀 문자표 (14×22, 발밑 중앙 기준)
  //  O 외곽선 / h 머리 / s 피부 / S 피부그늘 / e 눈
  //  C 상의 / c 상의밝음 / P 하의 / D 신발
  // ============================================================
  const BODY = [
    "....OOOOOO....",
    "..OOhhhhhhOO..",
    ".OhhhhhhhhhhO.",
    "OhhhhhhhhhhhhO",
    "OhhsssssssshhO",
    "OhssssssssssHO",
    "OhsseSSSSesshO",
    "OhssssssssssHO",
    ".OssssssssssO.",
    ".OSSSSSSSSSSO.",
    "..OOSSSSSSOO..",
    "...OCCCCCCO...",
    "..OcCCCCCCCO..",
    "..OcCCCCCCCO..",
    "..OcCCCCCCCO..",
    "..OcCCCCCCCO..",
    "..OCCCCCCCCO..",
    "..OPPPPPPPPO..",
    "..OPPPOOPPPO..",
    "..OPPPOOPPPO..",
    "..ODDDOODDDO..",
    "..OOOOOOOOOO..",
  ];

  function drawPixels(ctx, ox, oy, rows, map) {
    const h = rows.length;
    const w = rows[0].length;
    const x0 = Math.round(ox - w / 2);
    const y0 = Math.round(oy - h);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      let x = 0;
      while (x < w) {
        const ch = row[x];
        const color = map[ch];
        if (!color) { x++; continue; }
        let run = 1;
        while (x + run < w && row[x + run] === ch) run++;
        ctx.fillStyle = color;
        ctx.fillRect(x0 + x, y0 + y, run, 1);
        x += run;
      }
    }
  }

  /**
   * 사람 한 명. look = { skin, hair, cloth, pants, shoe }
   * opt.visor / opt.bowtie / opt.apron 을 켜면 그 위에 유니폼 요소를 덧그린다.
   * (기본 몸은 언제나 같은 스프라이트 — 파트만 얹는다)
   */
  /**
   * 사람 — 손으로 찍은 스프라이트(js/pixel/pixel-people.js)로 위임한다.
   * 몸은 도형 조립으로 그릴 수 있어도 얼굴·머리 실루엣은 한 점씩 찍어야 나온다.
   */
  function person(ctx, ox, oy, look, opt = {}) {
    PixelPeople.person(ctx, ox, oy, look, opt);
  }
  /**
   * 가게 정면(파사드) — 바닥보다 아래, 건물의 바깥면이다.
   * 레퍼런스에서 화면 아래쪽에 보이는 "간판 달린 가게 앞"이 바로 이것.
   * 뒤쪽 벽(wall)과 달리 이 면은 **바깥**을 본다.
   * dir "south" = 칸의 남쪽 모서리(왼쪽 위로 뻗음), "east" = 동쪽 모서리(오른쪽 위로).
   */
  function facade(ctx, ox, oy, pal, dir, h, variant) {
    const base = pal.facade || shade(pal.wainscot, -0.05);
    const f = faces(base);
    const ex = dir === "south" ? ox - TW / 2 : ox + TW / 2;
    const ey = oy - TH / 2;
    poly(ctx, [[ox, oy], [ex, ey], [ex, ey + h], [ox, oy + h]], dir === "south" ? f.left : f.right);
    // 판벽 결
    for (let i = 5; i < h; i += 6) line(ctx, ox, oy + i, ex, ey + i, shade(base, -0.1));
    // 위쪽 마감 보
    poly(ctx, [[ox, oy], [ex, ey], [ex, ey + 3], [ox, oy + 3]], shade(base, -0.3));

    const mx = Math.round((ox + ex) / 2);
    const my = Math.round((oy + ey) / 2);
    if (variant === "window") {
      rect(ctx, mx - 5, my + 9, 10, 12, shade(base, -0.38));
      rect(ctx, mx - 4, my + 10, 8, 10, pal.lampGlow || "#ffd68f");
      rect(ctx, mx - 1, my + 10, 2, 10, shade(base, -0.32));
    } else if (variant === "lantern") {
      lantern(ctx, mx, my + 6, pal);
    } else if (variant === "board") {
      rect(ctx, mx - 6, my + 11, 12, 14, shade(pal.wood, -0.25));
      rect(ctx, mx - 5, my + 12, 10, 12, "#33403a");
      for (let r = 0; r < 3; r++) rect(ctx, mx - 3, my + 14 + r * 3, [6, 4, 7][r], 1, "#d8e8dc");
    }
  }

  return {
    ellipse, cylinder, drawPixels,
    pokerTable, chair, stool, zabuton, lantern, barCounter, bottleShelf,
    rug, frame, wallSign, wallLamp, marquee, tree, bush, glow, chalkboard, beerSign,
    railing, stairs, facade, facade,
    plant, trophyStand, dartboard, jukebox, wall, person,
    BODY,
  };
})();

if (typeof window !== "undefined") window.PixelSprites = PixelSprites;

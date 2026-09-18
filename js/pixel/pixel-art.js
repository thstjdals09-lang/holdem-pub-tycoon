// PixelArt — 도트 에셋을 코드로 그린다.
//
// 왜 코드로 그리나: 외부 도트 팩은 라이선스(재배포·출처표기)가 걸리고 톤이 제각각이다.
// 코드로 그리면 팔레트만 갈아끼워 테마별 딜러복·손님복·기물 색이 전부 따라온다.
// js/portraits.js·js/assets.js와 같은 철학이다.
//
// 레퍼런스: 카이로소프트류 2D 경영 시뮬.
//   - 2:1 아이소메트릭(타일 32×16), 정수 픽셀
//   - 오브젝트마다 팔레트 3~4단(윗면 / 좌면 / 우면 / 외곽선), 그라데이션 없음
//   - 광원은 좌상단 고정. 윗면이 제일 밝고 우면이 제일 어둡다
//   - 외곽선은 검정이 아니라 "그 색의 어두운 버전" — 검정 테두리는 장난감처럼 보인다
//
// 주의: 캔버스의 path fill은 안티에일리어싱이 걸려 도트가 뭉개진다.
//       그래서 폴리곤은 정수 좌표 스캔라인으로 직접 채운다(fillRect 1px 행).

const PixelArt = (() => {
  const TW = 32; // 타일 가로
  const TH = 16; // 타일 세로 (2:1)

  // ============================================================
  //  래스터 유틸 — 전부 정수 좌표, 안티에일리어싱 없음
  // ============================================================
  function surface(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx, w: c.width, h: c.height };
  }

  const rect = (ctx, x, y, w, h, color) => {
    if (!color || w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  /** 볼록/오목 상관없이 되는 스캔라인 폴리곤 채우기. 한 행씩 fillRect라 픽셀이 딱 떨어진다. */
  function poly(ctx, pts, color) {
    if (!color || pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    minY = Math.floor(minY);
    maxY = Math.ceil(maxY);
    ctx.fillStyle = color;
    for (let y = minY; y < maxY; y++) {
      const yc = y + 0.5; // 행의 중앙에서 교차점을 잡아야 한 줄씩 새거나 겹치지 않는다
      const xs = [];
      for (let i = 0, n = pts.length; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        if (y1 === y2) continue;
        if (yc >= Math.min(y1, y2) && yc < Math.max(y1, y2)) {
          xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      if (!xs.length) continue;
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]);
        const xb = Math.round(xs[i + 1]);
        if (xb > xa) ctx.fillRect(xa, y, xb - xa, 1);
      }
    }
  }

  /** 브레젠험 1픽셀 선 — 아이소 모서리(2:1 기울기)가 계단 없이 떨어진다. */
  function line(ctx, x0, y0, x1, y1, color) {
    if (!color) return;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    ctx.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ============================================================
  //  색 — 팔레트는 "기본색 하나"에서 면별 음영을 만들어 쓴다.
  //  테마가 기본색만 바꾸면 윗면/좌면/우면/외곽선이 전부 따라온다.
  // ============================================================
  const hexToRgb = (h) => {
    const n = typeof h === "number" ? h : parseInt(String(h).replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) =>
    "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

  /** amount > 0 밝게, < 0 어둡게. 어두울 때 살짝 채도를 남겨 탁해지지 않게 한다. */
  function shade(color, amount) {
    const [r, g, b] = hexToRgb(color);
    if (amount >= 0) {
      const t = amount;
      return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
    }
    const t = 1 + amount;
    return rgbToHex(r * t, g * t, b * t);
  }

  /** 오브젝트 하나의 면 색 세트. 카이로소프트는 면마다 단색이고 단계가 뚜렷하다. */
  function faces(base) {
    return {
      top: shade(base, 0.16),
      left: base,
      right: shade(base, -0.22),
      edge: shade(base, -0.45), // 외곽선 = 어두운 같은 색 (검정 아님)
      hi: shade(base, 0.38),
    };
  }

  // ============================================================
  //  아이소 기본 도형
  //  기준점(0,0) = 오브젝트가 딛고 선 바닥의 "남쪽 꼭짓점"
  // ============================================================
  const cornersTop = (gw, gd, h) => [
    [0, -h], // 남
    [(gw * TW) / 2, -h - (gw * TH) / 2], // 동
    [((gw - gd) * TW) / 2, -h - ((gw + gd) * TH) / 2], // 북
    [(-gd * TW) / 2, -h - (gd * TH) / 2], // 서
  ];

  /**
   * 아이소 박스. 가구 대부분이 이걸로 만들어진다.
   * gw/gd = 바닥 칸 수(소수 가능), h = 높이(px)
   */
  function isoBox(ctx, ox, oy, gw, gd, h, base, opt = {}) {
    const f = opt.faces || faces(base);
    const T = cornersTop(gw, gd, h).map(([x, y]) => [ox + x, oy + y]);
    const S = T[0], E = T[1], N = T[2], W = T[3];
    const Sg = [ox, oy];
    const Eg = [ox + (gw * TW) / 2, oy - (gw * TH) / 2];
    const Wg = [ox - (gd * TW) / 2, oy - (gd * TH) / 2];

    if (h > 0) {
      poly(ctx, [W, S, Sg, Wg], f.left);   // 좌면(남서향)
      poly(ctx, [S, E, Eg, Sg], f.right);  // 우면(남동향)
    }
    poly(ctx, [S, E, N, W], f.top);

    if (opt.outline !== false) {
      line(ctx, W[0], W[1], S[0], S[1], f.edge);
      line(ctx, S[0], S[1], E[0], E[1], f.edge);
      line(ctx, E[0], E[1], N[0], N[1], f.edge);
      line(ctx, N[0], N[1], W[0], W[1], f.edge);
      if (h > 0) {
        line(ctx, W[0], W[1], Wg[0], Wg[1], f.edge);
        line(ctx, S[0], S[1], Sg[0], Sg[1], f.edge);
        line(ctx, E[0], E[1], Eg[0], Eg[1], f.edge);
        line(ctx, Wg[0], Wg[1], Sg[0], Sg[1], f.edge);
        line(ctx, Sg[0], Sg[1], Eg[0], Eg[1], f.edge);
      }
    }
    return { T, S, E, N, W, Sg, Eg, Wg, f };
  }

  /** 바닥 타일 한 장 (다이아몬드). pattern으로 결/이음매를 넣는다. */
  function isoTile(ctx, ox, oy, base, pattern) {
    const f = faces(base);
    const S = [ox, oy];
    const E = [ox + TW / 2, oy - TH / 2];
    const N = [ox, oy - TH];
    const W = [ox - TW / 2, oy - TH / 2];
    poly(ctx, [S, E, N, W], f.left);

    if (pattern === "plank") {
      // 마루: 결 방향 선 2개
      line(ctx, W[0] + 6, W[1] + 3, E[0] - 6, E[1] + 3, shade(base, -0.1));
      line(ctx, W[0] + 6, W[1] - 3, E[0] - 6, E[1] - 3, shade(base, 0.08));
    } else if (pattern === "tatami") {
      // 다다미: 가선(진한 테두리 띠) + 촘촘한 결
      line(ctx, W[0] + 2, W[1] - 1, N[0], N[1] + 1, shade(base, -0.3));
      line(ctx, W[0] + 2, W[1] + 1, S[0], S[1] - 1, shade(base, -0.3));
      for (let i = -3; i <= 3; i++) {
        line(ctx, ox - 8 + i * 3, oy - 4 - i, ox + 2 + i * 3, oy - 9 - i, shade(base, -0.06));
      }
    } else if (pattern === "carpet") {
      // 카펫: 타일 안쪽에 한 단 밝은 사각
      poly(ctx, [
        [ox, oy - 3], [ox + TW / 2 - 6, oy - TH / 2], [ox, oy - TH + 3], [ox - TW / 2 + 6, oy - TH / 2],
      ], shade(base, 0.1));
    } else if (pattern === "marble") {
      line(ctx, W[0] + 4, W[1] - 2, N[0] - 3, N[1] + 3, shade(base, 0.2));
      line(ctx, ox + 3, oy - 10, ox + 10, oy - 6, shade(base, 0.14));
    }

    // 이음매 — 위/왼쪽만 진하게 넣으면 격자가 또렷하면서도 지저분하지 않다
    line(ctx, W[0], W[1], N[0], N[1], shade(base, -0.16));
    line(ctx, N[0], N[1], E[0], E[1], shade(base, -0.16));
  }

  return { TW, TH, surface, rect, poly, line, shade, faces, isoBox, isoTile, cornersTop };
})();

if (typeof window !== "undefined") window.PixelArt = PixelArt;

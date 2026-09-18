// PixelFont — 3×5 비트맵 폰트.
//
// 왜 필요한가: 레퍼런스의 간판에는 "GOOD CARDS GOOD PEOPLE" 같은 진짜 글자가 박혀 있다.
// 지금까지는 밝은 막대로 흉내 냈는데, 글자가 읽히느냐 아니냐가 "대충 만든 티"를 가른다.
// 캔버스 fillText는 이 크기에서 뭉개지므로 글자를 직접 찍는다.
//
// 글리프는 3열 × 5행. 행마다 "101" 같은 3자리 문자열이고 1이 찍히는 픽셀이다.
const PixelFont = (() => {
  const G = {
    A: "111101111101101", B: "110101110101110", C: "111100100100111",
    D: "110101101101110", E: "111100111100111", F: "111100111100100",
    G: "111100101101111", H: "101101111101101", I: "111010010010111",
    J: "001001001101111", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "111101101101111",
    P: "111101111100100", Q: "111101101111011", R: "111101111110101",
    S: "111100111001111", T: "111010010010010", U: "101101101101111",
    V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111",
    0: "111101101101111", 1: "010110010010111", 2: "111001111100111",
    3: "111001111001111", 4: "101101111001001", 5: "111100111001111",
    6: "111100111101111", 7: "111001001001001", 8: "111101111101111",
    9: "111101111001111",
    " ": "000000000000000", ".": "000000000000010", ",": "000000000010100",
    "!": "010010010000010", "?": "111001010000010", "-": "000000111000000",
    "'": "010010000000000", "&": "110110111101111", "/": "001001010100100",
  };
  const W = 3, H = 5;

  /** 글자 한 줄의 픽셀 폭 (자간 1) */
  function measure(str, scale = 1, tracking = 1) {
    const s = String(str).toUpperCase();
    if (!s.length) return 0;
    return (s.length * (W + tracking) - tracking) * scale;
  }

  /**
   * 글자를 찍는다. (x, y)는 좌상단. align "left" | "center".
   * scale은 정수만 — 소수배로 키우면 도트가 어긋난다.
   */
  function draw(ctx, x, y, str, color, scale = 1, align = "left", tracking = 1) {
    const s = String(str).toUpperCase();
    const sc = Math.max(1, Math.round(scale));
    let cx = Math.round(align === "center" ? x - measure(s, sc, tracking) / 2 : x);
    const cy = Math.round(y);
    ctx.fillStyle = color;
    for (const ch of s) {
      const g = G[ch];
      if (g) {
        for (let r = 0; r < H; r++) {
          for (let c = 0; c < W; c++) {
            if (g[r * W + c] === "1") ctx.fillRect(cx + c * sc, cy + r * sc, sc, sc);
          }
        }
      }
      cx += (W + tracking) * sc;
    }
    return cx;
  }

  /** 여러 줄을 가운데 정렬로. 간판용. */
  function block(ctx, cx, y, lines, color, scale = 1, lineGap = 2) {
    const sc = Math.max(1, Math.round(scale));
    let yy = Math.round(y);
    for (const ln of lines) {
      draw(ctx, cx, yy, ln, color, sc, "center");
      yy += (H + lineGap) * sc;
    }
    return yy;
  }

  return { draw, block, measure, W, H, glyphs: G };
})();

if (typeof window !== "undefined") window.PixelFont = PixelFont;

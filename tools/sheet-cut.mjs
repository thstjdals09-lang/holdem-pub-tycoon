// sheet-cut — 여러 오브젝트가 격자로 들어 있는 생성 시트 한 장을 개별 에셋으로 자른다.
//
//   node tools/sheet-cut.mjs <시트이름> [--write]
//   node tools/sheet-cut.mjs all --write
//
// 왜 한 장에 몰아서 뽑나: 오브젝트를 하나씩 뽑으면 시점·광원·외곽선 두께·팔레트가
// 조금씩 달라져서 한 화면에 모아 놓으면 따로 논다. 한 장에 12개를 같이 그리게 하면
// 모델이 그 안에서 스스로 톤을 맞춘다. 대신 자르는 일이 우리 몫이 된다.
//
// 자르는 방법: 마젠타 배경을 지우고 남은 픽셀의 연결 성분을 찾는다. 성분 하나가
// 오브젝트 하나다. 다만 부품이 떨어져 있는 것(로프 폴대 두 개, 공중에 뜬 잎)이 있어
// 가까운 성분끼리 합친 뒤, 행(y)으로 묶고 열(x)로 정렬해 "읽는 순서"를 만든다.
// 그 순서가 곧 SHEETS 표의 파일명 순서다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "assets/raw/sheets");

// 시트마다: 격자 크기와, 읽는 순서대로의 [파일명, 목표크기, 맞춤기준]
//   맞춤기준 "max" = 긴 변을 목표로 (기본), "h" = 높이를 목표로.
//   사람은 반드시 "h" 여야 한다 — 포즈마다 가로폭이 달라 긴 변으로 맞추면 키가 제각각이 된다.
// 시트 한 장 = 12칸. 칸마다 [파일명, 목표크기, 맞춤기준]이고 순서가 곧 읽는 순서다.
//   맞춤기준 "max" = 긴 변 기준(기본), "h" = 높이 기준.
//   사람은 반드시 "h" — 포즈마다 가로폭이 달라 긴 변으로 맞추면 키가 제각각이 된다.
//
// 모든 테마가 같은 60칸(5장×12)을 쓴다. 파일명도 같다. 그래서 렌더러는
// "어느 폴더를 읽을지"만 바꾸면 테마가 통째로 갈린다.
const KIND = {
  hall: [
    ["401_table_6", 64], ["402_table_8", 80], ["403_chair", 22], ["404_dealer_chair", 24],
    ["405_stool", 18], ["406_sofa", 56], ["407_armchair", 30], ["408_lounge_table", 28],
    ["409_rug_rect", 76], ["410_rug_round", 68], ["411_side_table", 24], ["412_partition", 44],
  ],
  bar: [
    ["421_bar_straight", 64], ["422_bar_corner", 64], ["423_back_bar", 40], ["424_beer_tap", 22],
    ["425_fridge", 32], ["426_sink", 26], ["427_cart", 28], ["428_coffee", 22],
    ["429_bottle_cabinet", 38], ["430_tray", 18], ["431_snack", 14], ["432_safe", 24],
  ],
  decor: [
    ["441_pendant", 20], ["442_chandelier", 34], ["443_sconce", 16], ["444_art_large", 26],
    ["445_art_small", 16], ["446_menu_board", 24], ["447_neon", 28], ["448_dartboard", 20],
    ["449_jukebox", 34], ["450_clock", 16], ["451_trophy_case", 36], ["452_palm", 40],
  ],
  outdoor: [
    ["461_door", 38], ["462_board", 24], ["463_stanchion", 20], ["464_coat_rack", 30],
    ["465_host_desk", 44], ["466_street_lamp", 48], ["467_tree", 52], ["468_bush", 18],
    ["469_bench", 24], ["470_flower_bed", 16], ["471_trash_bin", 18], ["472_taxi", 60],
  ],
  actors: [
    ["mc_stand", 32, "h"], ["mc_walk1", 32, "h"], ["mc_walk2", 32, "h"], ["mc_sit", 24, "h"],
    ["fc_stand", 32, "h"], ["fc_walk1", 32, "h"], ["fc_walk2", 32, "h"], ["fc_sit", 24, "h"],
    ["pd_stand", 32, "h"], ["pd_deal", 32, "h"], ["sv_stand", 32, "h"], ["sv_tray", 32, "h"],
  ],
};

// 캐릭터 시트 3종 — 손님 다양성(서 있는 12 + 앉은 12)과 직원 4역 × 3포즈.
// 사람은 전부 높이 기준으로 맞춘다: 서 있는 포즈 32px, 앉은 포즈 24px.
KIND.cast_stand = Array.from({ length: 12 }, (_, i) => ["p" + String(i + 1).padStart(2, "0") + "_stand", 32, "h"]);
KIND.cast_sit = Array.from({ length: 12 }, (_, i) => ["p" + String(i + 1).padStart(2, "0") + "_sit", 24, "h"]);
KIND.staff = [
  ["pd_stand", 32, "h"], ["pd_deal", 32, "h"], ["pd_chips", 32, "h"],
  ["bt_stand", 32, "h"], ["bt_pour", 32, "h"], ["bt_wipe", 32, "h"],
  ["sv_stand", 32, "h"], ["sv_tray1", 32, "h"], ["sv_tray2", 32, "h"],
  ["mk_stand", 32, "h"], ["mk_wave", 32, "h"], ["mk_flyer", 32, "h"],
];
// 포즈 시트에서는 걷기 프레임만 쓴다(나머지는 위 두 시트가 더 낫다)
KIND.pose = [
  ["mc_stand", 32, "h"], ["mc_walk1", 32, "h"], ["mc_walk2", 32, "h"], ["mc_sit", 24, "h"],
  ["fc_stand", 32, "h"], ["fc_walk1", 32, "h"], ["fc_walk2", 32, "h"], ["fc_sit", 24, "h"],
  ["old_pd_stand", 32, "h"], ["old_pd_deal", 32, "h"], ["old_sv_stand", 32, "h"], ["old_sv_tray", 32, "h"],
];

const SHEETS = {
  // 기본(클래식) — 처음 뽑은 5장은 이름이 다르다
  sheet1_hall:    { cols: 4, rows: 3, out: "env_k2",   items: KIND.hall },
  sheet2_bar:     { cols: 4, rows: 3, out: "env_k2",   items: KIND.bar },
  sheet3_decor:   { cols: 4, rows: 3, out: "env_k2",   items: KIND.decor },
  sheet4_outdoor: { cols: 4, rows: 3, out: "env_k2",   items: KIND.outdoor },
  sheet5_actors:  { cols: 4, rows: 3, out: "actors_k", items: KIND.actors },
  // 테마 4종 × 5장 — 기본에서 처음 뽑은 12칸짜리 요약본(구버전)
  theme_princess: { cols: 4, rows: 3, out: "env_princess_a", items: KIND.hall },
};
// 캐릭터는 클래식까지 5종 전부 같은 구조
for (const t of ["classic", "princess", "neon", "european", "japanese"]) {
  const act = t === "classic" ? "actors_k" : "actors_" + t;
  SHEETS["pose_" + t] = { cols: 4, rows: 3, out: act, items: KIND.pose };
  SHEETS["cast_" + t + "_stand"] = { cols: 4, rows: 3, out: act, items: KIND.cast_stand };
  SHEETS["cast_" + t + "_sit"] = { cols: 4, rows: 3, out: act, items: KIND.cast_sit };
  SHEETS["staff_" + t] = { cols: 4, rows: 3, out: act, items: KIND.staff };
}
for (const t of ["princess", "neon", "european", "japanese"]) {
  for (const k of ["hall", "bar", "decor", "outdoor"]) {
    SHEETS[`theme_${t}_${k}`] = { cols: 4, rows: 3, out: `env_${t}`, items: KIND[k] };
  }
  SHEETS[`theme_${t}_actors`] = { cols: 4, rows: 3, out: `actors_${t}`, items: KIND.actors };
}

/** 마젠타 배경 → 투명. 색상환에서 자홍 언저리이면서 채도가 높은 픽셀만 지운다. */
function keyMagenta(img) {
  const { width: w, height: h, data } = img;
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const d = mx - mn;
    if (d < 0.28 || mx < 0.3) continue;
    let hue = 0;
    if (mx === r) hue = 60 * (((g - b) / d) % 6);
    else if (mx === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
    const sat = d / mx;
    if (Math.abs(hue - 300) <= 30 && sat >= 0.35) data[o + 3] = 0;
  }
  return img;
}

/** 외곽 1px에 남은 마젠타 기운을 빼 준다(키잉 경계의 보라 테두리). */
function deFringe(img) {
  const { width: w, height: h, data } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (!data[o + 3]) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (r > 110 && b > 110 && g < Math.min(r, b) - 30) {
        const m = Math.round((r + b) / 2);
        data[o] = Math.round(r * 0.55 + m * 0.1);
        data[o + 2] = Math.round(b * 0.55 + m * 0.1);
        data[o + 1] = Math.round(g * 0.9);
      }
    }
  }
  return img;
}

/** 모델이 칸 사이에 그어 놓은 격자선을 지운다 — 이게 남으면 12개가 한 덩어리로 붙는다.
 *  판별: 이미지 가로(세로)의 70%를 넘게 이어지는 어두운 줄. 오브젝트는 그렇게 길지 않다. */
function stripGridLines(img) {
  const { width: w, height: h, data } = img;
  const dark = (o) => data[o + 3] > 40 && (data[o] + data[o + 1] + data[o + 2]) / 3 < 70;
  let killed = 0;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (dark((y * w + x) * 4)) n++;
    if (n > w * 0.7) {
      for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (dark(o)) { data[o + 3] = 0; killed++; } }
    }
  }
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (dark((y * w + x) * 4)) n++;
    if (n > h * 0.7) {
      for (let y = 0; y < h; y++) { const o = (y * w + x) * 4; if (dark(o)) { data[o + 3] = 0; killed++; } }
    }
  }
  if (killed) console.log(`  격자선 ${killed}픽셀 제거`);
  return img;
}

/** 불투명 픽셀의 연결 성분. 작은 티끌은 버린다. */
function components(img, minArea) {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || data[i * 4 + 3] < 40) continue;
    let sp = 0;
    stack[sp++] = i;
    seen[i] = 1;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
    while (sp) {
      const p = stack[--sp];
      const px = p % w, py = (p / w) | 0;
      area++;
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
      const nb = [p - 1, p + 1, p - w, p + w];
      for (let k = 0; k < 4; k++) {
        const q = nb[k];
        if (q < 0 || q >= w * h) continue;
        if (k < 2 && Math.abs((q % w) - px) !== 1) continue;   // 행 경계 건너뛰기 방지
        if (seen[q] || data[q * 4 + 3] < 40) continue;
        seen[q] = 1;
        stack[sp++] = q;
      }
    }
    if (area >= minArea) out.push({ x0, y0, x1, y1, area });
  }
  return out;
}

/** 서로 가까운 성분을 합친다 — 로프 폴대처럼 부품이 떨어져 있는 오브젝트 때문. */
function mergeNear(boxes, gap) {
  const b = boxes.slice();
  let changed = true;
  while (changed) {
    changed = false;
    outer:
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const A = b[i], B = b[j];
        const dx = Math.max(0, Math.max(A.x0 - B.x1, B.x0 - A.x1));
        const dy = Math.max(0, Math.max(A.y0 - B.y1, B.y0 - A.y1));
        if (dx <= gap && dy <= gap) {
          b[i] = {
            x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0),
            x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1),
            area: A.area + B.area,
          };
          b.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return b;
}

/** 연결 성분이 기대 개수와 다를 때의 대안: 격자를 균등 분할하고 칸마다 내용물의 경계를 잡는다.
 *  모델이 격자로 그려 놨다는 사실만 믿으면 되므로, 성분이 붙거나 흩어져도 결과가 안정적이다. */
function gridBoxes(img, cols, rows) {
  const { width: w, height: h, data } = img;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx0 = Math.floor((c * w) / cols), cx1 = Math.floor(((c + 1) * w) / cols) - 1;
      const cy0 = Math.floor((r * h) / rows), cy1 = Math.floor(((r + 1) * h) / rows) - 1;
      let x0 = cx1, y0 = cy1, x1 = cx0, y1 = cy0, area = 0;
      for (let y = cy0; y <= cy1; y++) {
        for (let x = cx0; x <= cx1; x++) {
          if (data[(y * w + x) * 4 + 3] < 40) continue;
          area++;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (area > 200) out.push({ x0, y0, x1, y1, area });
    }
  }
  return out;
}

/** 덩어리가 기대보다 많을 때: 각 덩어리를 중심점이 속한 칸에 배당하고 칸마다 합친다.
 *  격자 균등 분할과 달리 덩어리 경계를 그대로 쓰므로 칸 경계에서 잘리지 않는다. */
function cellUnion(boxes, cols, rows, w, h) {
  const cells = new Array(cols * rows).fill(null);
  for (const b of boxes) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const c = Math.min(cols - 1, Math.max(0, Math.floor((cx / w) * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor((cy / h) * rows)));
    const i = r * cols + c;
    cells[i] = cells[i]
      ? { x0: Math.min(cells[i].x0, b.x0), y0: Math.min(cells[i].y0, b.y0),
          x1: Math.max(cells[i].x1, b.x1), y1: Math.max(cells[i].y1, b.y1),
          area: cells[i].area + b.area }
      : { ...b };
  }
  return cells;
}

/** 행으로 묶고 열로 정렬해 "읽는 순서"를 만든다. */
function readingOrder(boxes, rows) {
  const byY = boxes.slice().sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const per = Math.ceil(byY.length / rows);
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = byY.slice(r * per, (r + 1) * per).sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1));
    out.push(...row);
  }
  return out;
}

function crop(img, box) {
  const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(data, y * w * 4, ((box.y0 + y) * img.width + box.x0) * 4,
                  ((box.y0 + y) * img.width + box.x0 + w) * 4);
  }
  return { width: w, height: h, data };
}

/** 알파를 고려한 박스 필터 축소. 최근접 이웃으로 줄이면 외곽선 한 줄이 통째로 날아간다. */
function shrink(img, dw, dh) {
  const { width: w, height: h, data } = img;
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * h) / dh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * w) / dw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / dw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * w + sx) * 4;
          const al = data[s + 3] / 255;
          r += data[s] * al; g += data[s + 1] * al; b += data[s + 2] * al;
          a += al; n++;
        }
      }
      const o = (y * dw + x) * 4;
      if (a < 0.0001 || a / n < 0.42) continue;   // 반투명이 남으면 작은 크기에서 테두리가 지저분하다
      out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      out[o + 3] = 255;
    }
  }
  return { width: dw, height: dh, data: out };
}

/** 중앙값 분할 색 줄이기 — 작은 크기에서 중간톤이 많으면 형태가 죽는다. */
function posterize(img, k) {
  const { width: w, height: h, data } = img;
  const px = [];
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] > 0) px.push([data[o], data[o + 1], data[o + 2]]);
  }
  if (px.length < 2) return img;
  let boxes = [px];
  while (boxes.length < k) {
    let bi = -1, bw = -1, bax = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let ax = 0; ax < 3; ax++) {
        let lo = 255, hi = 0;
        for (const p of bx) { if (p[ax] < lo) lo = p[ax]; if (p[ax] > hi) hi = p[ax]; }
        if (hi - lo > bw) { bw = hi - lo; bi = i; bax = ax; }
      }
    });
    if (bi < 0 || bw <= 0) break;
    const box = boxes[bi].slice().sort((p, q) => p[bax] - q[bax]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  const pal = boxes.filter((b) => b.length).map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)];
  });
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    if (!data[o + 3]) continue;
    let best = 0, bd = Infinity;
    for (let c = 0; c < pal.length; c++) {
      const dr = data[o] - pal[c][0], dg = data[o + 1] - pal[c][1], db = data[o + 2] - pal[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = c; }
    }
    data[o] = pal[best][0]; data[o + 1] = pal[best][1]; data[o + 2] = pal[best][2];
  }
  return img;
}

function cutSheet(name, write) {
  const outName = name;
  const spec = SHEETS[name];
  if (!spec) throw new Error(`모르는 시트: ${name}`);
  const file = join(RAW, name + ".png");
  if (!existsSync(file)) throw new Error(`원본이 없다: ${file}`);
  const img = deFringe(stripGridLines(keyMagenta(decodePng(readFileSync(file)))));
  const minArea = Math.round((img.width * img.height) / 4000);
  const want0 = spec.cols * spec.rows;
  const raw = components(img, minArea);
  // 덩어리가 기대보다 많으면(팔·쟁반이 떨어져 나온 경우) 병합 간격을 키워 가며 맞춘다.
  // 적으면 붙어 버린 것이라 간격을 키워도 소용없다 — 그때는 격자 균등 분할로 간다.
  let boxes = [];
  // 자동으로 안 맞는 시트는 GAP 환경변수로 병합 간격을 직접 준다 (예: GAP=0.02)
  if (process.env.GAP) {
    boxes = mergeNear(raw, Math.round(img.width * Number(process.env.GAP))).filter((x) => (x.x1 - x.x0) > 8 && (x.y1 - x.y0) > 8);
  } else
  for (let tryN = 0; tryN < 8; tryN++) {
    const gap = Math.round(img.width * 0.005 * Math.pow(1.45, tryN));
    const cand = mergeNear(raw, gap).filter((x) => (x.x1 - x.x0) > 8 && (x.y1 - x.y0) > 8);
    if (!boxes.length) boxes = cand;
    if (cand.length === want0) { boxes = cand; break; }   // 딱 맞는 간격만 채택
    if (cand.length < want0) break;                        // 더 키우면 붙어 버린다
    boxes = cand;
  }

  const want = spec.cols * spec.rows;
  console.log(`${name}: ${img.width}×${img.height}, 덩어리 ${boxes.length}개 (기대 ${want})`);
  if (boxes.length > want) {
    const cells = cellUnion(boxes, spec.cols, spec.rows, img.width, img.height);
    const filled = cells.filter(Boolean).length;
    console.log(`  ⚠ 성분 ${boxes.length}개 — 칸별로 합쳐 ${filled}개`);
    if (filled === want) {
      const ordered = cells;                    // 이미 칸 순서 = 읽는 순서
      return writeAll(spec, img, ordered, write, outName);
    }
    boxes = gridBoxes(img, spec.cols, spec.rows);
    console.log(`    칸 합치기 실패 — 격자 분할 ${boxes.length}개`);
  } else if (boxes.length < want) {
    console.log(`  ⚠ 성분 ${boxes.length}개 — 격자 균등 분할로 대체`);
    boxes = gridBoxes(img, spec.cols, spec.rows);
    console.log(`    격자 분할 결과 ${boxes.length}개`);
  }
  const ordered = readingOrder(boxes, spec.rows);
  return writeAll(spec, img, ordered, write, outName);
}

function writeAll(spec, img, ordered, write, outName) {
  const outDir = join(ROOT, "assets/pixel/out", spec.out);
  if (write) mkdirSync(outDir, { recursive: true });
  ordered.forEach((box, i) => {
    const item = spec.items[i];
    if (!item) return;
    const [fname, target, fit] = item;
    let piece = crop(img, box);
    const base = fit === "h" ? piece.height : Math.max(piece.width, piece.height);
    const k = target / base;
    const dw = Math.max(1, Math.round(piece.width * k));
    const dh = Math.max(1, Math.round(piece.height * k));
    piece = posterize(shrink(piece, dw, dh), 10);
    console.log(`  ${String(i + 1).padStart(2)} ${fname.padEnd(18)} ${String(box.x1 - box.x0 + 1).padStart(4)}×${String(box.y1 - box.y0 + 1).padStart(4)} → ${dw}×${dh}`);
    if (write) writeFileSync(join(outDir, fname + ".png"), encodePng(dw, dh, piece.data));
  });
  return ordered.length;
}

const arg = process.argv[2];
const write = process.argv.includes("--write");
const names = !arg || arg === "all" ? Object.keys(SHEETS) : [arg];
for (const n of names) cutSheet(n, write);
if (!write) console.log("\n(--write 를 붙여야 실제로 저장한다)");

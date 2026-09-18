// 승인된 액터 시트 한 장을 38개 스프라이트로 잘라낸다.
//
//   node tools/sheet-slice.mjs [시트경로]
//   기본값: assets/actors/_master/actor_sheet_v1.png
//
// 왜 생성이 아니라 슬라이스인가: 시트가 Source of Truth다. 다시 생성하면 아무리
// 레퍼런스를 물려도 선 굵기·색·비율이 미세하게 흘러간다. 원본을 자르면 드리프트가 0이다.
//
// 격자를 하드코딩하지 않는다. 시트 레이아웃이 조금만 달라도 전부 어긋나기 때문에,
// 잉크가 있는 곳을 x/y로 투영해 빈 줄을 경계로 삼아 행과 열을 찾아낸다.
//
// 처리 순서
//   1) 하단 설명 패널(파일명 규칙 / 캔버스 정보 / 테스트 목업)을 잘라낸다
//   2) 종이 배경(밝고 채도 낮은 픽셀)을 투명으로
//   3) y 투영으로 카테고리 4줄, x 투영으로 각 줄의 칸을 찾는다
//   4) 칸마다 라벨(얇은 글자 덩어리)을 버리고 스프라이트 덩어리만 남긴다
//   5) 64×96 캔버스에 바닥 중앙 앵커로 얹어 저장

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, makeCanvas, toPng } from "./_canvas.mjs";
import { CANVAS, CATEGORIES, SHEET } from "./actor-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] || join(ROOT, "assets/actors/_master/actor_sheet_v1.png");

if (!existsSync(src)) {
  console.error(`시트를 못 찾았다: ${src}`);
  console.error("승인된 액터 시트를 이 경로에 PNG로 저장한 뒤 다시 실행할 것.");
  process.exit(1);
}

const sheet = decodePng(readFileSync(src));
const { width: W, height: H, data } = sheet;
console.log(`시트 ${W}×${H}`);

// ---------- 1) 종이 배경 판정 ----------
// 시트 배경은 순백이 아니라 밝은 종이 질감이다. 밝기가 높고 채도가 낮으면 배경으로 본다.
// 스프라이트는 굵은 어두운 외곽선을 갖고 있어 이 기준으로 안 지워진다.
const isPaper = (o) => {
  const r = data[o], g = data[o + 1], b = data[o + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx > 200 && mx - mn < 26;
};
const inkAt = (x, y) => !isPaper((y * W + x) * 4);

// ---------- 2) 잉크 구간 나누기 ----------
function bands(lo, hi, axis, minGap, minSize, o0, o1) {
  const out = [];
  let start = -1, gap = 0;
  for (let i = lo; i <= hi; i++) {
    let ink = 0;
    if (axis === "y") { for (let x = o0; x < o1; x++) if (inkAt(x, i)) ink++; }
    else { for (let y = o0; y < o1; y++) if (inkAt(i, y)) ink++; }
    if (ink > 0) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) {
      gap++;
      if (gap >= minGap) { if (i - gap - start >= minSize) out.push([start, i - gap]); start = -1; gap = 0; }
    }
  }
  if (start >= 0 && hi - start >= minSize) out.push([start, hi]);
  return out;
}

// ---------- 3) 스프라이트 줄 고르기 ----------
// 시트는 카테고리마다 [헤더 바] → [라벨 글자] → [스프라이트] 3단이 반복된다.
// 그래서 잉크 구간을 그대로 쓰면 12개가 나온다. 스프라이트 줄만 남기는 기준은 둘이다:
//   - 높이 70~120px (헤더 22, 라벨 19, 하단 설명 패널 333과 뚜렷이 구분된다)
//   - 열 클러스터 7개 이상 (헤더는 1개, 하단 패널은 4개)
function colsIn(y0, y1) {
  return bands(0, W - 1, "x", 8, 10, y0, y1 + 1).length;
}
const allBands = bands(0, H - 1, "y", 6, 10, 0, W);
const rows = allBands.filter(([y0, y1]) => {
  const h = y1 - y0 + 1;
  return h >= 70 && h <= 120 && colsIn(y0, y1) >= 7;
});
console.log(`잉크 구간 ${allBands.length}개 중 스프라이트 줄 ${rows.length}개: ` +
  rows.map(([a2, b2]) => `${a2}~${b2}`).join(", "));

// ---------- 4) 칸에서 스프라이트만 추출 ----------
/** 칸 안의 잉크 바운딩 박스. 줄 단계에서 라벨을 이미 걸렀으므로 그대로 잡으면 된다. */
function spriteBox(cx0, cx1, cy0, cy1) {
  let x0 = cx1, y0 = cy1, x1 = cx0, y1 = cy0;
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      if (!inkAt(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < x0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * 배경을 "밝은 색이면 배경"으로 판정하면 딜러의 흰 셔츠까지 뚫린다.
 * 반대로 기준을 빡빡하게 잡으면 스프라이트 둘레에 종이색 halo가 남는다(실제로 남았다).
 * 그래서 색이 아니라 연결성으로 가른다 — 잘라낸 상자 테두리에서 밝은 픽셀을 따라
 * 안쪽으로 번져 들어간 영역만 배경이다. 옷 안쪽 흰색은 테두리와 안 이어져 살아남는다.
 */
function backgroundMask(box) {
  const { w, h } = box;
  const bg = new Uint8Array(w * h);
  const light = (lx, ly) => {
    const o = ((box.y0 + ly) * W + (box.x0 + lx)) * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > 170 && mx - mn < 46;
  };
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i] || !light(x, y)) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  return bg;
}

/**
 * 잘라낸 스프라이트를 캔버스에 바닥 중앙 앵커로 얹는다. 크기는 절대 건드리지 않는다.
 * 규격은 64×96이지만 시트에 그보다 넓은 포즈가 있다(카드 5장을 깔아 둔 classic_deal 등).
 * 그런 것만 캔버스 폭을 넓힌다 — 잘라내면 그림이 없어지고, 줄이면 다른 액터와 키가 안 맞는다.
 * 앵커(바닥 중앙)는 그대로라 배치 코드는 손댈 필요가 없다.
 */
function place(box) {
  const CW = Math.max(CANVAS.w, box.w + 2);
  const CH = Math.max(CANVAS.h, box.h + CANVAS.footMargin);
  const out = Buffer.alloc(CW * CH * 4);
  const bg = backgroundMask(box);
  const dx = Math.round((CW - box.w) / 2);
  const dy = CH - CANVAS.footMargin - box.h;
  for (let y = 0; y < box.h; y++) {
    const ty = dy + y;
    for (let x = 0; x < box.w; x++) {
      if (bg[y * box.w + x]) continue;
      const tx = dx + x;
      const s = ((box.y0 + y) * W + (box.x0 + x)) * 4;
      const o = (ty * CW + tx) * 4;
      out[o] = data[s]; out[o + 1] = data[s + 1]; out[o + 2] = data[s + 2]; out[o + 3] = 255;
    }
  }
  return { rgba: out, w: CW, h: CH };
}

// 스프라이트 줄은 위에서부터 mc → fc → pd → sv 순서다(시트 레이아웃 그대로).
const cats = Object.keys(SHEET);
if (rows.length !== cats.length) {
  console.error(`스프라이트 줄이 ${rows.length}개다. ${cats.length}개여야 한다 — 시트 레이아웃 확인.`);
  process.exit(1);
}

const made = [];
const warn = [];
rows.forEach(([ry0, ry1], ri) => {
  const cat = cats[ri];
  const actions = SHEET[cat];
  const cols = bands(0, W - 1, "x", 8, 10, ry0, ry1 + 1);
  if (cols.length !== actions.length) {
    warn.push(`${CATEGORIES[cat].label}: 칸 ${cols.length}개 발견, ${actions.length}개 필요`);
  }
  const dir = join(ROOT, "assets/actors", CATEGORIES[cat].folder);
  mkdirSync(dir, { recursive: true });
  cols.forEach(([cx0, cx1], ci) => {
    const action = actions[ci];
    if (!action) return;
    const box = spriteBox(cx0, cx1, ry0, ry1);
    if (!box || box.h < 20) { warn.push(`${cat}_${action}: 스프라이트를 못 찾음`); return; }
    const out = place(box);
    if (out.w !== CANVAS.w || out.h !== CANVAS.h) {
      warn.push(`${cat}_${action}: 원본 ${box.w}×${box.h} → 캔버스 ${out.w}×${out.h} (규격 초과분만 확장, 앵커는 동일)`);
    }
    writeFileSync(join(dir, `${cat}_${action}.png`), encodePng(out.w, out.h, out.rgba));
    made.push({ cat, action, box, out });
  });
});

console.log(`\n잘라낸 스프라이트 ${made.length}개 → assets/actors/`);
for (const cat of cats) {
  const list = made.filter((m) => m.cat === cat);
  if (!list.length) continue;
  const hs = list.map((m) => m.box.h);
  console.log(`  ${CATEGORIES[cat].folder.padEnd(16)} ${list.length}개  원본 높이 ${Math.min(...hs)}~${Math.max(...hs)}px`);
}
if (warn.length) console.log("\n⚠\n  " + warn.join("\n  "));

// 확인용 시트
const cols = 10;
const cellW = Math.max(...made.map((m) => m.out.w)) + 4;
const cellH = Math.max(...made.map((m) => m.out.h)) + 4;
const rowsN = Math.ceil(made.length / cols);
const surf = makeCanvas(cols * cellW, rowsN * cellH);
made.forEach((m, i) => {
  const cx = (i % cols) * cellW + Math.round((cellW - m.out.w) / 2);
  const cy = Math.floor(i / cols) * cellH + (cellH - m.out.h) - 2;
  surf.ctx.drawImage({ width: m.out.w, height: m.out.h, data: m.out.rgba }, cx, cy);
});
mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/sheet_slice.png"), toPng(surf, 2, [38, 32, 28]));
console.log("\n확인용 시트: tools/_preview/sheet_slice.png");

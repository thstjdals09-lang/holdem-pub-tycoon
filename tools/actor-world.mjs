// Master Actor v1(64×96) → 월드용 축소본을 굽는다.
//
//   node tools/actor-world.mjs [배율] → assets/actors_world/<카테고리>/<cat>_<action>.png
//   기본 1/3 (64×96 → 21×32)
//
// 원본 파일은 건드리지 않는다. 시트에서 잘라낸 38장이 Source of Truth이고,
// 여기서 만드는 건 "그 화면 크기 사본"이다. 배율을 바꾸려면 이 도구만 다시 돌리면 된다.
//
// 왜 그릴 때 축소하지 않고 미리 굽나:
//   매 프레임 drawImage로 1/3 축소하면 최근접 이웃이라 픽셀이 들쭉날쭉 튄다.
//   미리 한 번 줄이고 색을 평탄화해 두면 작은 크기에서도 형태가 또렷하다.
//   카이로소프트류는 캐릭터가 24~32px인데, 그 크기에서 흐린 중간톤이 남으면 죽처럼 보인다.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, makeCanvas, toPng } from "./_canvas.mjs";
import { CATEGORIES } from "./actor-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCALE = Number(process.argv[2] || 1 / 3);
const COLORS = 8;

/** 알파를 고려한 박스 필터. 최근접 이웃으로 줄이면 얼굴 한 줄이 통째로 날아간다. */
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
      if (a < 0.0001) continue;
      // 반투명이 남으면 작은 크기에서 테두리가 지저분해진다. 절반 넘게 덮이면 불투명으로 굳힌다.
      const cover = a / n;
      if (cover < 0.42) continue;
      out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      out[o + 3] = 255;
    }
  }
  return { width: dw, height: dh, data: out };
}

/** 중앙값 분할로 색을 줄인다. 작은 스프라이트에 중간톤이 많으면 형태가 죽는다. */
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
    return b.map ? [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)] : null;
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

const made = [];
for (const [cat, meta] of Object.entries(CATEGORIES)) {
  const srcDir = join(ROOT, "assets/actors", meta.folder);
  if (!existsSync(srcDir)) continue;
  const dstDir = join(ROOT, "assets/actors_world", meta.folder);
  mkdirSync(dstDir, { recursive: true });
  for (const f of readdirSync(srcDir).filter((x) => x.endsWith(".png")).sort()) {
    const img = decodePng(readFileSync(join(srcDir, f)));
    const dw = Math.max(1, Math.round(img.width * SCALE));
    const dh = Math.max(1, Math.round(img.height * SCALE));
    const small = posterize(shrink(img, dw, dh), COLORS);
    writeFileSync(join(dstDir, f), encodePng(dw, dh, small.data));
    made.push({ cat, name: basename(f, ".png"), img: small });
  }
}

console.log(`월드용 액터 ${made.length}개 → assets/actors_world/ (배율 ${SCALE.toFixed(3)}, 색 ${COLORS})`);
if (made.length) {
  const w = made[0].img.width, h = made[0].img.height;
  console.log(`  캔버스 ${w}×${h}`);
  const cols = 10, rows = Math.ceil(made.length / cols);
  const cw = Math.max(...made.map((m) => m.img.width)) + 4;
  const ch = Math.max(...made.map((m) => m.img.height)) + 4;
  const surf = makeCanvas(cols * cw, rows * ch);
  made.forEach((m, i) => {
    surf.ctx.drawImage(m.img, (i % cols) * cw + 2, Math.floor(i / cols) * ch + 2);
  });
  mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
  writeFileSync(join(ROOT, "tools/_preview/actors_world.png"), toPng(surf, 6, [38, 32, 28]));
  console.log("  확인용 시트: tools/_preview/actors_world.png");
}

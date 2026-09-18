// 생성 에셋을 "3D 렌더 축소판"에서 "카이로소프트형 평면 도트"로 바꾸는 후처리.
//
//   node tools/flatten.mjs <폴더> [색수] [--write]
//   예: node tools/flatten.mjs assets/pixel/out/env_v1 10 --write
//
// 왜 필요한가: 생성 모델은 재질마다 수십 단계의 중간톤을 깔아 준다. 그게 축소해도
// 남아서 "부드러운 3D 렌더"로 읽힌다. 카이로소프트류는 반대로 재질당 2~3톤이고
// 경계가 하드하다. 색 수를 줄이고 외곽선을 다시 세우면 같은 그림이 평면 도트가 된다.
//
// 방법
//   1) 중앙값 분할(median cut)로 이미지마다 자기 색을 N개로 줄인다.
//      고정 팔레트를 쓰지 않는 이유: 에셋마다 주조색이 달라(초록 펠트/황동/버건디)
//      공용 팔레트로 뭉개면 색이 엉킨다. 이미지별로 뽑아야 원래 색감이 산다.
//   2) 알파 경계 한 겹을 어두운 외곽선으로 덮는다. 이게 있어야 오브젝트가 바닥에서 분리된다.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, makeCanvas, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
const K = Number(process.argv[3] || 10);
const WRITE = process.argv.includes("--write");
if (!dir) {
  console.error("사용법: node tools/flatten.mjs <폴더> [색수] [--write]");
  process.exit(1);
}

/** 중앙값 분할 — 불투명 픽셀만 모아 색 공간을 가장 넓은 축으로 반복해서 가른다. */
function medianCut(pixels, k) {
  let boxes = [pixels];
  while (boxes.length < k) {
    // 가장 색폭이 넓은 상자를 고른다. 그래야 눈에 띄는 계조부터 갈린다.
    let bi = -1, bw = -1, bax = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let ax = 0; ax < 3; ax++) {
        let lo = 255, hi = 0;
        for (const p of b) { const v = p[ax]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const w = hi - lo;
        if (w > bw) { bw = w; bi = i; bax = ax; }
      }
    });
    if (bi < 0 || bw <= 0) break;
    const box = boxes[bi].slice().sort((p, q) => p[bax] - q[bax]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length).map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)];
  });
}

function flatten(img, k) {
  const { width: w, height: h, data } = img;
  const pixels = [];
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] > 128) pixels.push([data[o], data[o + 1], data[o + 2]]);
  }
  if (!pixels.length) return img;
  const pal = medianCut(pixels, k);

  const out = Buffer.from(data);
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    if (out[o + 3] <= 128) { out[o + 3] = 0; continue; }
    out[o + 3] = 255;
    let best = 0, bd = Infinity;
    for (let c = 0; c < pal.length; c++) {
      const dr = out[o] - pal[c][0], dg = out[o + 1] - pal[c][1], db = out[o + 2] - pal[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = c; }
    }
    out[o] = pal[best][0]; out[o + 1] = pal[best][1]; out[o + 2] = pal[best][2];
  }

  // 외곽선 — 투명과 맞닿은 한 겹을 어둡게. 오브젝트가 바닥에서 떨어져 보이게 하는 핵심이다.
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = out[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid[i]) continue;
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !solid[i - 1] || !solid[i + 1] || !solid[i - w] || !solid[i + w];
      if (!edge) continue;
      const o = i * 4;
      out[o] = Math.round(out[o] * 0.34);
      out[o + 1] = Math.round(out[o + 1] * 0.32);
      out[o + 2] = Math.round(out[o + 2] * 0.34);
    }
  }
  return { width: w, height: h, data: out };
}

const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".png")).sort();
const done = [];
for (const f of files) {
  const src = join(ROOT, dir, f);
  const img = decodePng(readFileSync(src));
  const flat = flatten(img, K);
  if (WRITE) writeFileSync(src, encodePng(flat.width, flat.height, flat.data));
  done.push({ name: basename(f, ".png"), before: img, after: flat });
}
console.log(`${done.length}개 평면화 (색 ${K}개)` + (WRITE ? " — 덮어씀" : " — 미리보기만"));

// 전후 비교 시트
const show = done.slice(0, 12);
const cw = Math.max(...show.map((d) => d.after.width)) + 12;
const ch = Math.max(...show.map((d) => d.after.height)) + 12;
const surf = makeCanvas(show.length * cw, ch * 2);
surf.ctx.fillStyle = "#3a2f28";
surf.ctx.fillRect(0, 0, show.length * cw, ch * 2);
show.forEach((d, i) => {
  surf.ctx.drawImage(d.before, i * cw + ((cw - d.before.width) >> 1), ch - 6 - d.before.height);
  surf.ctx.drawImage(d.after, i * cw + ((cw - d.after.width) >> 1), ch * 2 - 6 - d.after.height);
});
mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/flatten.png"), toPng(surf, 2, [46, 38, 32]));
console.log("비교 시트: tools/_preview/flatten.png (위=원본, 아래=평면화)");

// 액터 원본을 Master Actor System v1 규격(64×96, 바닥 앵커)으로 찍어낸다.
//
//   node tools/actor-pack.mjs <원본폴더> [--sheet]
//     원본폴더 : <category>_<action>.png 들이 들어 있는 폴더 (마젠타 배경)
//     --sheet  : 처리 결과를 한 장의 확인용 시트(tools/_preview/actors_v1.png)로도 뽑는다
//
// 왜 별도 도구인가: 가구는 "발자국 폭"에 맞춰 리사이즈하지만(asset-pack),
// 액터는 "서로의 키가 같아야" 한다. 기준이 달라서 파이프라인을 나눈다.
//
// 키 정규화 규칙
//   스프라이트마다 자기 높이를 88 × (포즈 계수)로 맞춘다.
//   처음엔 카테고리의 standing 배율을 전체에 곱했는데, 생성 모델이 프레임 안 크기를
//   제각각으로 잡는 바람에 원본이 작게 잡힌 포즈만 혼자 쪼그라들었다(pd_dealing_cards).
//   포즈 계수는 actor-manifest.mjs의 HEIGHT_FACTOR에 있다 — 앉으면 0.78, 팔 들면 1.12.
//   가로가 64를 넘는 포즈(쟁반, 카드 5장 깔기)는 그때만 폭 기준으로 한 번 더 줄인다.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, decodePng, encodePng, toPng } from "./_canvas.mjs";
import { CANVAS, CATEGORIES, allSprites } from "./actor-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = process.argv[2];
const wantSheet = process.argv.includes("--sheet");
if (!srcDir) {
  console.error("사용법: node tools/actor-pack.mjs <원본폴더> [--sheet]");
  process.exit(1);
}

// ---------- 마젠타 제거 ----------
// 생성 모델은 알파를 못 내주므로 단색 마젠타 위에 그리게 하고 여기서 뺀다.
// 흰/회색과 달리 마젠타는 그림 안에 거의 안 쓰여 오검출이 없다.
function keyChroma(img, hueTol = 28, satMin = 0.32) {
  const { width: w, height: h, data } = img;
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.001 || mx === 0) continue;
    if (d / mx < satMin) continue;
    let hue;
    if (mx === r) hue = 60 * (((g - b) / d) % 6);
    else if (mx === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
    const diff = Math.min(Math.abs(hue - 300), 360 - Math.abs(hue - 300));
    if (diff <= hueTol) data[o + 3] = 0;
  }
  // 경계에 남은 마젠타 프린지를 한 겹 깎는다
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      if (alpha[i - 1] && alpha[i + 1] && alpha[i - w] && alpha[i + w]) continue;
      const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2];
      if (r > 120 && b > 120 && g < Math.min(r, b) * 0.75) data[o + 3] = 0;
    }
  }
  return img;
}

function bounds(img) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** 최근접 이웃 축소 — 도트를 뭉개지 않는 유일한 방법이다. */
function resample(img, b, dw, dh) {
  const out = { width: dw, height: dh, data: Buffer.alloc(dw * dh * 4) };
  for (let y = 0; y < dh; y++) {
    const sy = b.y0 + Math.min(b.h - 1, Math.floor((y * b.h) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = b.x0 + Math.min(b.w - 1, Math.floor((x * b.w) / dw));
      const s = (sy * img.width + sx) * 4, o = (y * dw + x) * 4;
      out.data[o] = img.data[s];
      out.data[o + 1] = img.data[s + 1];
      out.data[o + 2] = img.data[s + 2];
      out.data[o + 3] = img.data[s + 3];
    }
  }
  return out;
}

/** 64×96 캔버스에 바닥 중앙 정렬로 얹는다. */
function toCanvas(sprite) {
  const { w, h, footMargin } = CANVAS;
  const out = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  const dx = Math.round((w - sprite.width) / 2);
  const dy = h - footMargin - sprite.height;
  for (let y = 0; y < sprite.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < sprite.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= w) continue;
      const s = (y * sprite.width + x) * 4, o = (ty * w + tx) * 4;
      if (sprite.data[s + 3] === 0) continue;
      out.data[o] = sprite.data[s];
      out.data[o + 1] = sprite.data[s + 1];
      out.data[o + 2] = sprite.data[s + 2];
      out.data[o + 3] = sprite.data[s + 3];
    }
  }
  return out;
}

// ---------- 처리 ----------
const TARGET_H = 88;      // 서 있는 포즈의 머리끝~발끝
const MAX_W = CANVAS.w - 2;

const wanted = allSprites();
const files = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".png"));
const byName = new Map(files.map((f) => [basename(f, ".png"), join(srcDir, f)]));

const done = [];
const missing = [];
for (const spec of wanted) {
  const src = byName.get(`${spec.cat}_${spec.action}`);
  if (!src) { missing.push(spec.file); continue; }
  const img = keyChroma(decodePng(readFileSync(src)));
  const b = bounds(img);
  if (!b) { missing.push(spec.file + " (빈 이미지)"); continue; }

  const k = (TARGET_H * spec.factor) / b.h;
  let dw = Math.max(1, Math.round(b.w * k));
  let dh = Math.max(1, Math.round(b.h * k));
  // 폭이 캔버스를 넘는 포즈만 추가로 줄인다(쟁반, 카드 5장)
  if (dw > MAX_W) {
    const k2 = MAX_W / dw;
    dw = MAX_W;
    dh = Math.max(1, Math.round(dh * k2));
  }
  if (dh > CANVAS.h - CANVAS.footMargin) {
    const k2 = (CANVAS.h - CANVAS.footMargin) / dh;
    dh = CANVAS.h - CANVAS.footMargin;
    dw = Math.max(1, Math.round(dw * k2));
  }

  const out = toCanvas(resample(img, b, dw, dh));
  const dir = join(ROOT, "assets/actors", spec.folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, spec.file), encodePng(CANVAS.w, CANVAS.h, out.data));
  done.push({ spec, dw, dh, img: out });
}

console.log(`규격화 ${done.length}/${wanted.length}개 → assets/actors/`);
for (const cat of Object.keys(CATEGORIES)) {
  const list = done.filter((d) => d.spec.cat === cat);
  if (!list.length) continue;
  const hs = list.map((d) => d.dh);
  console.log(`  ${CATEGORIES[cat].folder.padEnd(16)} ${list.length}개  높이 ${Math.min(...hs)}~${Math.max(...hs)}px`);
}
if (missing.length) console.log("  ✗ 없음: " + missing.join(", "));

if (wantSheet && done.length) {
  const cols = 10;
  const rows = Math.ceil(done.length / cols);
  const surf = makeCanvas(cols * (CANVAS.w + 4), rows * (CANVAS.h + 4));
  done.forEach((d, i) => {
    surf.ctx.drawImage(d.img, (i % cols) * (CANVAS.w + 4) + 2, Math.floor(i / cols) * (CANVAS.h + 4) + 2);
  });
  mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
  writeFileSync(join(ROOT, "tools/_preview/actors_v1.png"), toPng(surf, 2, [38, 32, 28]));
  console.log(`  시트: tools/_preview/actors_v1.png`);
}

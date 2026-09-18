// 낱개 스프라이트를 바닥선 맞춰 한 줄로 늘어놓는다 — 눈으로 비교할 때만 쓰는 도구.
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const [, , dir, list, out, scale] = process.argv;
const names = list.split(",");
const imgs = names.map((n) => { const i = decodePng(readFileSync(dir + "/" + n + ".png")); return { n, i }; });
const S = Number(scale || 4), GAP = 6;
const H = Math.max(...imgs.map((o) => o.i.height)) + 4;
const W = imgs.reduce((a, o) => a + o.i.width + GAP, GAP);
const cv = makeCanvas(W, H);
let x = GAP;
for (const o of imgs) {
  cv.ctx.drawImage({ width: o.i.width, height: o.i.height, data: o.i.data }, x, H - 2 - o.i.height);
  x += o.i.width + GAP;
}
writeFileSync(out, toPng(cv, S, [20, 16, 13]));
console.log(imgs.map((o) => `${o.n}=${o.i.width}x${o.i.height}`).join("  "));

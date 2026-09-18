import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const names = process.argv.slice(2);
const imgs = names.map((n) => decodePng(readFileSync(join(ROOT, "assets/pixel/out/env_k", n))));
const CW = Math.max(...imgs.map((i) => i.width)) + 8;
const CH = Math.max(...imgs.map((i) => i.height)) + 8;
// 원본과 좌우반전본을 위아래로
const s = makeCanvas(CW * imgs.length, CH * 2);
imgs.forEach((im, k) => {
  const ox = k * CW + 4;
  s.ctx.drawImage(im, 0, 0, im.width, im.height, ox, 4, im.width, im.height);
  for (let x = 0; x < im.width; x++) {
    s.ctx.drawImage(im, x, 0, 1, im.height, ox + (im.width - 1 - x), CH + 4, 1, im.height);
  }
});
writeFileSync(join(ROOT, "tools/_preview/zoom.png"), toPng(s, 7, [30, 28, 26]));
console.log("위=원본 / 아래=좌우반전 :", names.join(", "));

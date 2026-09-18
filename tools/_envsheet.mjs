import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets/pixel/out/env_k");
const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort();
const imgs = files.map((f) => ({ f, im: decodePng(readFileSync(join(DIR, f))) }));
const CW = 110, CH = 110, COLS = 5;
const rows = Math.ceil(imgs.length / COLS);
const s = makeCanvas(COLS * CW, rows * CH);
imgs.forEach(({ im }, i) => {
  const cx = (i % COLS) * CW + CW / 2, by = ((i / COLS) | 0) * CH + CH - 6;
  s.ctx.drawImage(im, 0, 0, im.width, im.height, Math.round(cx - im.width / 2), Math.round(by - im.height), im.width, im.height);
});
writeFileSync(join(ROOT, "tools/_preview/envsheet.png"), toPng(s, 2, [30, 28, 26]));
console.log(files.map((f, i) => `${i}(${(i / COLS) | 0},${i % COLS}) ${f}`).join("\n"));

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "./_canvas.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const im = decodePng(readFileSync(join(ROOT, "assets/pixel/out/env_k", process.argv[2])));
const row = (y) => Buffer.from(im.data.subarray(y * im.width * 4, (y + 1) * im.width * 4));
let best = { start: 0, len: 0 }, cur = { start: 0, len: 1 };
for (let y = 1; y < im.height; y++) {
  if (row(y).equals(row(y - 1))) cur.len++;
  else { if (cur.len > best.len) best = { ...cur }; cur = { start: y, len: 1 }; }
}
if (cur.len > best.len) best = { ...cur };
console.log(`${process.argv[2]} ${im.width}×${im.height}`);
console.log(`가장 긴 '완전히 같은 행' 구간: y=${best.start}..${best.start + best.len - 1} (${best.len}행)`);
// 상위 구간 몇 개 더
const runs = [];
let s = 0;
for (let y = 1; y <= im.height; y++) {
  if (y === im.height || !row(y).equals(row(y - 1))) { if (y - s >= 3) runs.push([s, y - 1, y - s]); s = y; }
}
runs.sort((a, b) => b[2] - a[2]);
console.log("3행 이상 구간:", runs.slice(0, 6).map((r) => `${r[0]}~${r[1]}(${r[2]})`).join("  "));

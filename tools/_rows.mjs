import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "./_canvas.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const im = decodePng(readFileSync(join(ROOT, "assets/pixel/out/env_k", process.argv[2])));
const key = [];
for (let y = 0; y < im.height; y++) {
  let l = -1, r = -1, n = 0;
  const cols = [];
  for (let x = 0; x < im.width; x++) {
    const o = (y * im.width + x) * 4;
    if (im.data[o + 3] > 40) { if (l < 0) l = x; r = x; n++; cols.push(im.data[o] + "," + im.data[o+1] + "," + im.data[o+2]); }
  }
  key.push(`${String(y).padStart(3)} L=${String(l).padStart(3)} R=${String(r).padStart(3)} n=${String(n).padStart(3)} ${cols.join("|").slice(0, 0)}`);
}
console.log(key.join("\n"));

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "./_canvas.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets/pixel/out/env_k");
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".png")).sort()) {
  const im = decodePng(readFileSync(join(DIR, f)));
  const top = [], bot = [];
  for (let x = 0; x < im.width; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < im.height; y++) {
      if (im.data[(y * im.width + x) * 4 + 3] > 40) { if (t < 0) t = y; b = y; }
    }
    top.push(t); bot.push(b);
  }
  const cols = top.map((t, i) => i).filter((i) => top[i] >= 0);
  if (!cols.length) { console.log(f, "empty"); continue; }
  const n = cols.length, q = Math.max(1, Math.round(n * 0.18));
  const L = cols.slice(0, q), Rr = cols.slice(-q);
  const avg = (arr, src) => arr.reduce((s, i) => s + src[i], 0) / arr.length;
  // 바닥선 기울기: 오른쪽이 더 아래면 +gx(오른쪽 아래) 축, 더 위면 +gy(왼쪽 아래) 축
  const dBot = avg(Rr, bot) - avg(L, bot);
  const dTop = avg(Rr, top) - avg(L, top);
  console.log(
    f.padEnd(26),
    `w=${String(im.width).padStart(3)} h=${String(im.height).padStart(3)}`,
    `바닥Δ=${dBot.toFixed(1).padStart(6)}`,
    `윗선Δ=${dTop.toFixed(1).padStart(6)}`,
    dBot > 2 ? "→ +gx(오른쪽아래)" : dBot < -2 ? "→ +gy(왼쪽아래)" : "→ 대칭/수평"
  );
}

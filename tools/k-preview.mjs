// v1 버티컬 슬라이스의 월드 레이어를 브라우저 없이 PNG로 뽑는다.
//   node tools/slice-preview.mjs [t] → tools/_preview/kworld.png
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, decodePng, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "js/pixel/pixel-art.js",
  "js/pixel/pixel-font.js",
  "js/pixel/pixel-people.js",
  "js/pixel/pixel-sprites.js",
  "js/pixel/world-k.js",
];
let code = "const window = undefined;\n";
for (const f of FILES) code += readFileSync(join(ROOT, f), "utf8").replace(/if \(typeof window[^\n]*\n/g, "") + "\n";
code += "return { WorldK };";
const { WorldK } = new Function(code)();

const images = {};
const miss = [];
for (const [k, p] of Object.entries(WorldK.SRC)) {
  try { images[k] = decodePng(readFileSync(join(ROOT, p))); }
  catch (e) { images[k] = null; miss.push(`${k} ← ${p}`); }
}
WorldK.useImages(images);
WorldK.setSurfaceFactory((w, h) => makeCanvas(w, h));

const n = Object.values(images).filter(Boolean).length;
console.log(`에셋 ${n}/${Object.keys(WorldK.SRC).length}개 로드`);
if (miss.length) console.log("  ✗ " + miss.join("\n  ✗ "));
console.log(`뷰 ${WorldK.VIEW_W}×${WorldK.VIEW_H} · 방 ${WorldK.ROOM.w}×${WorldK.ROOM.d} · 타일 ${WorldK.TW}×${WorldK.TH}`);
console.log(`테이블 ${images.table6 && images.table6.width}px · 액터 ${images.mc_standing && images.mc_standing.height}px`
  + ` → 비율 ${(images.table6 && images.mc_standing ? images.table6.width / 88 : 0).toFixed(2)} : 1`);
console.log(`사람 ${WorldK.crowd.length}명 · 테이블 ${WorldK.TABLES.length}개`);

const surf = makeCanvas(WorldK.VIEW_W, WorldK.VIEW_H);
WorldK.render(surf, Number(process.argv[2] || 1500));
mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/kworld.png"), toPng(surf, 1, [20, 16, 13]));
console.log("slice.png 완료");

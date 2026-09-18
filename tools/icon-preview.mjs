// HUD 아이콘 시트를 PNG로 뽑는다.  node tools/icon-preview.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "js/pixel/pixel-art.js",
  "js/pixel/pixel-font.js",
  "js/pixel/pixel-people.js",
  "js/pixel/pixel-sprites.js",
  "js/pixel/pixel-icons.js",
];
let code = "const window = undefined;\n";
for (const f of FILES) code += readFileSync(join(ROOT, f), "utf8").replace(/if \(typeof window[^\n]*\n/g, "") + "\n";
code += "return { PixelIcons };";
const { PixelIcons } = new Function(code)();

const names = PixelIcons.names;
const cols = 6;
const rows = Math.ceil(names.length / cols);
const CELL = 26;
const surf = makeCanvas(cols * CELL, rows * CELL);
names.forEach((n, i) => {
  PixelIcons.draw(surf.ctx, n, (i % cols) * CELL + 3, Math.floor(i / cols) * CELL + 3);
});

mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/icons.png"), toPng(surf, 6, [246, 231, 207]));
console.log(`icons.png  ${cols * CELL * 6}×${rows * CELL * 6}  (${names.length}종)`);
console.log(names.join(" · "));

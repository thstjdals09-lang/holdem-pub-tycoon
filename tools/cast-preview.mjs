// 생성한 캐릭터 에셋을 최종 크기로 늘어놓고, 손으로 찍은 캐릭터와 나란히 비교한다.
//
//   node tools/cast-preview.mjs  →  tools/_preview/cast.png
//
// 도트 캐릭터는 "크게 보면 멀쩡한데 게임 크기로 줄이면 뭉개지는" 일이 흔하다.
// 그래서 실제 배치 크기(1배)와 확대(4배)를 같은 시트에 함께 찍는다.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, decodePng, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "js/pixel/pixel-art.js",
  "js/pixel/pixel-font.js",
  "js/pixel/pixel-people.js",
  "js/pixel/pixel-sprites.js",
  "js/pixel/pixel-actors.js",
];
let code = "const window = undefined;\n";
for (const f of FILES) code += readFileSync(join(ROOT, f), "utf8").replace(/if \(typeof window[^\n]*\n/g, "") + "\n";
code += "return { PixelActors };";
const { PixelActors } = new Function(code)();

function loadDir(rel) {
  const dir = join(ROOT, rel);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => ({ name: f.replace(/\.png$/, ""), img: decodePng(readFileSync(join(dir, f))) }));
}

const cast = [...loadDir("assets/pixel/out/staff"), ...loadDir("assets/pixel/out/customers")];
const table = decodePng(readFileSync(join(ROOT, "assets/pixel/out/core_poker/02_table_standard_6player.png")));

console.log("생성 캐릭터 " + cast.length + "종");
for (const c of cast) console.log(`  ${c.name}  ${c.img.width}×${c.img.height}`);
console.log(`테이블 ${table.width}×${table.height} · 손으로 찍은 캐릭터 26×${PixelActors.HEIGHT.stand}`);

// ---- 시트 ----
// 1행: 생성 캐릭터 1배 (테이블 하나를 같이 두어 비율을 본다)
// 2행: 손으로 찍은 캐릭터 1배
const CELL = 46;
const W = Math.max(CELL * cast.length, table.width + 20);
const ROW1 = 70, ROW2 = 70, ROW3 = 4 * 60 + 20;
const surf = makeCanvas(W, ROW1 + ROW2 + ROW3 + 20);
const ctx = surf.ctx;

ctx.fillStyle = "#c9a071";
ctx.fillRect(0, 0, W, ROW1 + ROW2);
ctx.fillStyle = "#2c2b33";
ctx.fillRect(0, ROW1 + ROW2, W, ROW3 + 20);

// 비교용 테이블 — 캐릭터가 테이블 옆에서 어떤 크기인지가 전부다
ctx.drawImage(table, 6, ROW1 - 8 - table.height);

cast.forEach((c, i) => {
  const x = Math.round(i * CELL + (CELL - c.img.width) / 2);
  ctx.drawImage(c.img, x, ROW1 - 8 - c.img.height);
});

const LOOKS = [
  { outfit: "vest", style: "visor", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f", hair: "#2b2440", skin: "#f2c9a0", bottom: "#33303f" },
  { outfit: "vest", style: "short", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f", apron: "#8a5c3a", hair: "#3b2b20", skin: "#f2c9a0", bottom: "#33303f" },
  { outfit: "tee", style: "long", top: "#c2504a", hair: "#1f1a18", skin: "#e0a87c", bottom: "#3a3a4a" },
  { outfit: "hoodie", style: "cap", top: "#5f7fa8", capColor: "#c2504a", hair: "#3b2b20", skin: "#f7d6b4", bottom: "#2f3550" },
  { outfit: "tee", style: "twin", skirt: true, top: "#d9705a", hair: "#c98a4a", skin: "#f2c9a0", bottom: "#4a4258" },
  { outfit: "jacket", style: "spiky", top: "#6b4a3a", accent: "#e8e2d4", hair: "#2b2440", skin: "#d08e60", bottom: "#333a4a" },
  { outfit: "tee", style: "bun", top: "#e0b04a", hair: "#8a6a4a", skin: "#f7d6b4", bottom: "#4a4258" },
  { outfit: "vest", style: "pony", top: "#e8e2d4", accent: "#4f9a6a", hair: "#6b4a2f", skin: "#f2c9a0", bottom: "#2e3b46" },
];
LOOKS.forEach((look, i) => {
  PixelActors.draw(ctx, i * CELL + CELL / 2, ROW1 + ROW2 - 10, look, { pose: "stand", shadow: false });
});

// 3행: 생성 캐릭터 4배 — 줄이기 전 디테일이 어떤지
const big = cast.slice(0, 8);
big.forEach((c, i) => {
  const k = 4;
  const x = Math.round((i % 8) * (W / 8) + (W / 8 - c.img.width * k) / 2);
  ctx.drawImage(c.img, x, ROW1 + ROW2 + 10, c.img.width * k, c.img.height * k);
});

mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/cast.png"), toPng(surf, 2, [24, 22, 28]));
console.log(`cast.png  ${surf.width * 2}×${surf.height * 2}`);
console.log("1행 생성(1배)+테이블 · 2행 손그림(1배) · 3행 생성(4배)");

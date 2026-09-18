// 손으로 찍은 캐릭터 스프라이트를 PNG 시트로 뽑아 눈으로 확인한다.
//
//   node tools/sprite-preview.mjs  →  tools/_preview/actors.png
//
// 1px 어긋남은 5배로 키워도 눈에 안 보이므로 숫자로도 검사한다(아래 alignment).

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, toPng } from "./_canvas.mjs";

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

// ---------- 정렬 검사 ----------
// 모든 행은 pad()로 26폭에 가운데 정렬되므로 좌우 여백은 늘 균형이 맞는다.
// 그래서 대칭 검사로는 아무것도 못 잡는다. 실제로 눈에 보이는 어긋남은 이것이다:
//   한 배열 안에서 알맹이 폭의 홀짝이 섞이면 홀수 폭 행만 반 칸 왼쪽으로 내려앉아
//   어깨선이나 머리 옆면이 1px 들쭉날쭉해진다. 그 홀짝을 검사한다.
const TRIM = /^\.+|\.+$/g;
const coreWidth = (r) => r.replace(TRIM, "").length;

function alignment(name, rows) {
  const cores = rows.map(coreWidth).filter((n) => n > 0);
  if (!cores.length) return [];
  const even = cores.filter((n) => n % 2 === 0).length;
  const want = even >= cores.length - even ? 0 : 1;
  const bad = [];
  rows.forEach((r, i) => {
    const n = coreWidth(r);
    if (n > 0 && n % 2 !== want) {
      bad.push(`  ${name}[${i}] 알맹이 ${n}칸 — 이 배열은 ${want ? "홀" : "짝"}수여야 함 : ${r.replace(TRIM, "")}`);
    }
  });
  return bad;
}
function notFullWidth(name, rows) {
  const bad = [];
  rows.forEach((r, i) => {
    if (r.length !== 26) bad.push(`  ${name}[${i}] 폭 ${r.length} — 26이어야 함 : ${r}`);
  });
  return bad;
}

const ARRAYS = [
  ["HEAD", PixelActors.HEAD],
  ["HEAD_BACK", PixelActors.HEAD_BACK],
  ["TORSO", PixelActors.TORSO],
  ["TORSO_FRONT", PixelActors.TORSO_FRONT],
];
for (const k of Object.keys(PixelActors.HAIR)) ARRAYS.push(["HAIR." + k, PixelActors.HAIR[k]]);
const seenRows = new Set();
for (const [k, P] of Object.entries(PixelActors.POSES)) {
  for (const key of ["legs", "skirt"]) {
    if (seenRows.has(P[key])) continue;
    seenRows.add(P[key]);
    ARRAYS.push([`${k}.${key}`, P[key]]);
  }
}

const problems = [];
for (const [name, rows] of ARRAYS) {
  problems.push(...notFullWidth(name, rows));
  if (PixelActors.ASYMMETRIC.some((x) => name.endsWith(x))) continue; // 포니테일은 일부러 쏠린다
  problems.push(...alignment(name, rows));
}
console.log(problems.length ? "⚠ 정렬 문제:\n" + problems.join("\n") : `✓ 정렬 이상 없음 (배열 ${ARRAYS.length}개)`);

// ---------- 시트 ----------
// 1행 헤어 — 손님 수십 명이 서로 달라 보이는지
// 2행 의상/소품 — 역할(딜러·바텐더·손님)이 구분되는지
// 3행 포즈 — 같은 사람이 상황별로 무엇을 하는지
const BASE = { hair: "#3b2b20", skin: "#f2c9a0", top: "#4a6fa5", bottom: "#2f3550" };
const HAIR_COLORS = ["#3b2b20", "#1f1a18", "#8a6a4a", "#2b2440", "#6b4a2f", "#c98a4a", "#4a3a2a", "#5a3020", "#7a4a2a", "#2b2440", "#3b2b20"];
const TOP_COLORS = ["#4a6fa5", "#c2504a", "#e0b04a", "#4f9a6a", "#b06ba5", "#5f7fa8", "#d9705a", "#3f8f8a", "#7a6ab0", "#e8e2d4", "#f6f4ef"];

const cells = [];
PixelActors.styles.forEach((style, i) => {
  cells.push({
    row: 0, col: i,
    look: { ...BASE, style, hair: HAIR_COLORS[i % 11], top: TOP_COLORS[i % 11], capColor: "#3f5d8c" },
    opt: { pose: "stand" },
  });
});

const OUTFITS = [
  ["티셔츠", { outfit: "tee", style: "short" }],
  ["조끼", { outfit: "vest", style: "bun", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f" }],
  ["후드", { outfit: "hoodie", style: "cap", top: "#5f7fa8", capColor: "#c2504a" }],
  ["재킷", { outfit: "jacket", style: "spiky", top: "#6b4a3a", accent: "#e8e2d4" }],
  ["정장", { outfit: "suit", style: "short", top: "#3a3a4a", accent: "#e8e2d4", tie: "#b8413f" }],
  ["치마", { outfit: "tee", style: "twin", skirt: true, top: "#d9705a", bottom: "#4a4258" }],
  ["안경", { outfit: "vest", style: "bob", glasses: true, top: "#e8e2d4", accent: "#4f9a6a" }],
  ["앞치마", { outfit: "vest", style: "long", apron: "#8a5c3a", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f" }],
  ["딜러", { outfit: "vest", style: "visor", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f" }],
  ["뒷모습", { style: "long", hair: "#6b4a2f" }],
];
OUTFITS.forEach(([, look], i) => {
  cells.push({
    row: 1, col: i,
    look: { ...BASE, ...look },
    opt: { pose: "stand", back: i === OUTFITS.length - 1 },
  });
});

const POSES = [
  ["stand", {}], ["walk0", {}], ["walk1", {}], ["sit", {}],
  ["deal", { cards: true }], ["serve", { tray: true }], ["drink", { mug: true }], ["sit", { back: true }],
];
const STAFF = { ...BASE, outfit: "vest", style: "visor", top: "#f6f4ef", accent: "#3a3a46", tie: "#b8413f" };
POSES.forEach(([pose, extra], i) => {
  cells.push({ row: 2, col: i, look: STAFF, opt: { pose, ...extra } });
});

const CELL_W = 40, CELL_H = 68;
const cols = Math.max(...cells.map((c) => c.col)) + 1;
const surf = makeCanvas(CELL_W * cols, CELL_H * 3);
for (const c of cells) {
  PixelActors.draw(surf.ctx, c.col * CELL_W + CELL_W / 2, c.row * CELL_H + CELL_H - 6, c.look, { shadow: false, ...c.opt });
}

mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/actors.png"), toPng(surf, 5, [40, 44, 52]));
console.log(`actors.png  ${CELL_W * cols * 5}×${CELL_H * 3 * 5}`);
console.log("1행 헤어: " + PixelActors.styles.join(" · "));
console.log("2행 의상: " + OUTFITS.map(([n]) => n).join(" · "));
console.log("3행 포즈: " + POSES.map(([p, e]) => p + (e.back ? "(뒤)" : "")).join(" · "));
console.log("높이: " + JSON.stringify(PixelActors.HEIGHT));

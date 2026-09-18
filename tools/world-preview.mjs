// 월드 레이어를 브라우저 없이 PNG로 뽑는다.
//
//   node tools/world-preview.mjs  →  tools/_preview/world.png
//
// 게임이 쓰는 렌더 코드를 그대로 실행하므로, 여기서 멀쩡하면 브라우저에서도 멀쩡하다.
// 특히 확인해야 할 것: 가구 PNG와 손으로 찍은 사람의 크기 비율, 가림 순서, 빈 구석.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, decodePng, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// 브라우저 전역 스크립트들을 한 스코프에서 평가한다.
// (모듈이 아니라 IIFE + window 할당 형태라 이렇게 붙여야 서로를 본다)
const FILES = [
  "js/pixel/pixel-art.js",
  "js/pixel/pixel-font.js",
  "js/pixel/pixel-people.js",
  "js/pixel/pixel-sprites.js",
  "js/pixel/pixel-actors.js",
  "js/pixel/pixel-world.js",
];
let code = "const window = undefined;\n";
for (const f of FILES) code += readFileSync(join(ROOT, f), "utf8").replace(/if \(typeof window[^\n]*\n/g, "") + "\n";
code += "return { PixelArt, PixelWorld, PixelActors };";
const { PixelWorld } = new Function(code)();

// 가구 PNG를 디코드해 주입 — 브라우저의 Image 대신
const images = {};
let ok = 0, miss = [];
for (const [k, p] of Object.entries(PixelWorld.SRC)) {
  try {
    images[k] = decodePng(readFileSync(join(ROOT, p)));
    ok++;
  } catch (e) {
    images[k] = null;
    miss.push(`${k} (${p}): ${e.message}`);
  }
}
PixelWorld.useImages(images);
PixelWorld.setSurfaceFactory((w, h) => makeCanvas(w, h)); // 배경 굽기용 오프스크린
console.log(`가구 스프라이트 ${ok}/${Object.keys(PixelWorld.SRC).length}개 로드`);
if (miss.length) console.log("  ✗ " + miss.join("\n  ✗ "));

// 크기 비교표 — 사람 46px 대비 가구가 몇 배인지
const tableH = images.table ? images.table.height : 0;
console.log(`뷰 ${PixelWorld.VIEW_W}×${PixelWorld.VIEW_H} · 방 ${PixelWorld.ROOM.w}×${PixelWorld.ROOM.d}`);
console.log(`테이블 ${images.table && images.table.width}×${tableH} · 의자 ${images.chair && images.chair.width}×${images.chair && images.chair.height} · 사람 24×46`);
console.log(`손님/직원 ${PixelWorld.crowd.length}명`);

const surf = makeCanvas(PixelWorld.VIEW_W, PixelWorld.VIEW_H);
const t = Number(process.argv[2] || 1500);
PixelWorld.render(surf, t);

mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
const K = Number(process.argv[3] || 1);
writeFileSync(join(ROOT, "tools/_preview/world.png"), toPng(surf, K, [18, 20, 26]));
console.log(`world.png  ${PixelWorld.VIEW_W * K}×${PixelWorld.VIEW_H * K}`);

// pub-scene-2d.js 를 브라우저 없이 돌려 본다.
//
//   node tools/scene2d-preview.mjs [tables] [occupancy] → tools/_preview/scene2d.png
//
// game.js 가 넘기는 것과 같은 모양의 스냅샷을 만들어 update() 에 넣고 한 프레임을 찍는다.
// 실제 게임을 띄우기 전에 "배치가 계산되는가 / 에셋이 다 붙는가"를 여기서 거른다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCanvas, decodePng, toPng } from "./_canvas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABLES = Number(process.argv[2] || 6);
const OCC = Number(process.argv[3] || 0.8);
const VW = Number(process.env.PVW || 535), VH = Number(process.env.PVH || 1040);

// ---- 가짜 브라우저 ----
const surface = makeCanvas(VW, VH);
const pending = [];
const handlers = {};
const fakeCanvas = {
  style: {}, width: VW, height: VH,
  getContext: () => surface.ctx,
  appendChild() {},
  addEventListener(type, fn) { handlers[type] = fn; },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }),
};
const host = {
  appendChild() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }),
};
class FakeImage {
  constructor() { this.width = 0; this.height = 0; this.data = null; }
  set src(v) {
    const path = join(ROOT, v.split("?")[0]);
    pending.push(
      new Promise((res) => {
        try {
          const img = decodePng(readFileSync(path));
          this.width = img.width; this.height = img.height; this.data = img.data;
          if (this.onload) this.onload();
        } catch (e) {
          missing.push(v.split("?")[0]);
          if (this.onerror) this.onerror();
        }
        res();
      })
    );
  }
}
const missing = [];
let frameFn = null;
globalThis.window = {};
globalThis.document = { createElement: () => fakeCanvas, getElementById: () => host };
globalThis.Image = FakeImage;
globalThis.addEventListener = () => {};
// 매니페스트(fetch)도 로컬 파일에서 읽어 준다
globalThis.fetch = (u) => Promise.resolve({ json: () => JSON.parse(readFileSync(join(ROOT, u), "utf8")) });
globalThis.performance = { now: () => 1500 };
globalThis.requestAnimationFrame = (fn) => { frameFn = fn; return 1; };

// ---- 모듈 로드 ----
const FILES = [
  "js/pixel/pixel-art.js", "js/pixel/pixel-font.js",
  "js/pixel/pixel-people.js", "js/pixel/pixel-sprites.js",
  "js/pub-scene-2d.js",
];
let code = "";
for (const f of FILES) code += readFileSync(join(ROOT, f), "utf8") + "\n";
code += "return { PubScene2D: window.PubScene2D, PubScene3D: window.PubScene3D };";
const { PubScene3D } = new Function(code)();

if (!PubScene3D) throw new Error("window.PubScene3D 가 안 올라왔다");
for (const k of ["init", "update", "chipBurst", "spawnDiamondBubble", "setFloor", "getFloorInfo"]) {
  if (typeof PubScene3D[k] !== "function") throw new Error(`인터페이스 누락: ${k}`);
}
console.log("✓ 인터페이스 6종 확인 (init/update/chipBurst/spawnDiamondBubble/setFloor/getFloorInfo)");

// ---- game.js 가 보내는 것과 같은 스냅샷 ----
const snapshot = {
  tables: TABLES,
  _cap: 0,
  capacity: Number(process.argv[5] || 9),
  maxShown: Number(process.argv[5] || 9),
  fixtures: { bar: 2, fridge: 1 },
  staff: { bartender: 1, server: 2 },
  decor: { plant: 3, neon: 1, dart: 1, jukebox: 0, chandelier: 1, vip: 2 },
  assignedDealers: Array.from({ length: TABLES }, (_, i) => (i % 3 === 2 ? null : { id: "d" + i })),
  perTableIncome: 174,
  showTableIncome: true,
  seatsMin: 4,
  seatsMax: 8,
  theme: process.argv[4] || "classic",
  occupancy: OCC,
  tournamentWins: 1,
  stage: 1,
};

PubScene3D.onTap = (info) => console.log("  onTap:", JSON.stringify(info));
PubScene3D.onDiamondBubble = () => 5;
// 로더가 여러 단계 then으로 이어져 있어 한 번만 기다리면 마지막 단계가 아직 안 끝난다.
const settle = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.all(pending);
    await new Promise((r) => setTimeout(r, 0));
  }
};
PubScene3D.init(host);
await settle();
PubScene3D.update(snapshot);
await settle();          // 테마 세트는 update() 때 받아 오므로 한 번 더
console.log(`✓ update() 처리 — 테이블 ${TABLES}/9, 점유율 ${OCC}, 테마 ${snapshot.theme}`);
console.log("  getFloorInfo:", JSON.stringify(PubScene3D.getFloorInfo()));
console.log("  spawnDiamondBubble:", PubScene3D.spawnDiamondBubble(12));
PubScene3D.chipBurst("#f0c04a");

if (missing.length) console.log("⚠ 못 찾은 에셋 " + missing.length + "개:\n  " + missing.slice(0, 8).join("\n  "));
else console.log("✓ 에셋 전부 로드");

if (!frameFn) throw new Error("렌더 루프가 안 돈다");
frameFn(1500);

mkdirSync(join(ROOT, "tools/_preview"), { recursive: true });
writeFileSync(join(ROOT, "tools/_preview/scene2d.png"), toPng(surface, 1, [20, 16, 13]));
console.log(`✓ scene2d.png ${VW}×${VH}`);

// ---- 탭 판정 훑기: 화면을 격자로 눌러 보고 어떤 상호작용이 잡히는지 센다 ----
if (handlers.pointerdown) {
  const found = {};
  const spots = {};
  for (let y = 4; y < VH; y += 6) {
    for (let x = 4; x < VW; x += 6) {
      let hit = null;
      PubScene3D.onTap = (info) => { hit = info; };
      PubScene3D.onDiamondBubble = () => { hit = { type: "bubble" }; return 5; };
      handlers.pointerdown({ clientX: x, clientY: y, pointerId: 1 });
      if (handlers.pointerup) handlers.pointerup({ clientX: x, clientY: y, pointerId: 1 });
      if (hit) {
        const key = hit.type + (hit.type === "table" ? "#" + hit.index : hit.id ? ":" + hit.id : "");
        found[key] = (found[key] || 0) + 1;
        if (!spots[key]) spots[key] = [x, y];
      }
    }
  }
  const keys = Object.keys(found).sort();
  if (!keys.length) console.log("⚠ 눌리는 것이 하나도 없다");
  else {
    console.log("✓ 탭 판정 " + keys.length + "종");
    for (const k of keys) console.log(`    ${k.padEnd(14)} 셀 ${String(found[k]).padStart(4)}개  예: (${spots[k][0]},${spots[k][1]})`);
  }
}

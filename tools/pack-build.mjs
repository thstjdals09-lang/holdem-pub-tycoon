// pack-build — 모든 에셋을 한 규격, 한 폴더로 굽는다.
//
//   node tools/pack-build.mjs [--write]
//
//   assets/pack/<테마>/props/<이름>.png     가구 — 폭 = (발자국 가로칸 + 세로칸) × 16
//   assets/pack/<테마>/actors/<이름>.png    사람 — 키 고정 (서기 28 / 앉기 20)
//
// 왜 폴더 하나로 몰았나: 세트가 폴더 여기저기 흩어져 있으면 "이 테마의 이 물건"을
// 찾는 규칙이 코드마다 달라진다. 테마 5종이 **같은 파일 이름**을 쓰고 한 뿌리 아래
// 있으면, 렌더러는 테마 이름만 바꿔 끼우면 된다.
//
// 왜 폭을 발자국으로 정하나: 예전엔 "긴 변 몇 px"로 줬다. 그러면 그림 크기와
// 그 물건이 격자에서 차지하는 칸 수가 따로 놀아서, 배치가 맞아도 그림이 겹치거나 뜬다.
// 발자국으로 정하면 (gw+gd)×16 이 곧 화면 폭이라 격자와 그림이 항상 일치한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "./_canvas.mjs";
import {
  keyMagenta, deFringe, stripGridLines, components, mergeNear,
  cellUnion, gridBoxes, readingOrder, crop, shrink, posterize,
} from "./sheet-cut.mjs";
import { ACTOR, CAST, THEMES, widthOf, heightOf } from "./pack-spec.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "assets/raw/sheets");
const WRITE = process.argv.includes("--write");

// 기물 시트 4장의 칸 순서 → 규격 이름
const PROP_ORDER = {
  hall: ["table_6", "table_8", "chair", "dealer_chair", "stool", "sofa",
         "armchair", "lounge_table", "rug_rect", "rug_round", "side_table", "partition"],
  bar: ["bar_straight", "bar_corner", "back_bar", "beer_tap", "fridge", "sink",
        "cart", "coffee", "bottle_cabinet", "tray", "snack", "safe"],
  decor: ["pendant", "chandelier", "sconce", "art_large", "art_small", "menu_board",
          "neon", "dartboard", "jukebox", "clock", "trophy_case", "palm"],
  outdoor: ["door", "board", "stanchion", "coat_rack", "host_desk", "street_lamp",
            "tree", "bush", "bench", "flower_bed", "trash_bin", "taxi"],
};
// 테마별 원본 시트 파일명 (클래식만 초기 이름이 다르다)
const PROP_FILE = (theme, kind) =>
  theme === "classic"
    ? { hall: "sheet1_hall", bar: "sheet2_bar", decor: "sheet3_decor", outdoor: "sheet4_outdoor" }[kind]
    : `theme_${theme}_${kind}`;

/** 시트 한 장을 칸 순서대로 잘라 이미지 배열로 돌려준다. */
function pieces(file, cols, rows) {
  const img = deFringe(stripGridLines(keyMagenta(decodePng(readFileSync(file)))));
  const want = cols * rows;
  const minArea = Math.round((img.width * img.height) / 4000);
  const raw = components(img, minArea);
  let boxes = [];
  for (let t = 0; t < 8; t++) {
    const gap = Math.round(img.width * 0.005 * Math.pow(1.45, t));
    const cand = mergeNear(raw, gap).filter((b) => (b.x1 - b.x0) > 8 && (b.y1 - b.y0) > 8);
    if (!boxes.length) boxes = cand;
    if (cand.length === want) { boxes = cand; break; }
    if (cand.length < want) break;
    boxes = cand;
  }
  let ordered;
  if (boxes.length === want) ordered = readingOrder(boxes, rows);
  else if (boxes.length > want) {
    const cells = cellUnion(boxes, cols, rows, img.width, img.height);
    ordered = cells.filter(Boolean).length === want ? cells : readingOrder(gridBoxes(img, cols, rows), rows);
  } else ordered = readingOrder(gridBoxes(img, cols, rows), rows);
  return { img, boxes: ordered, n: boxes.length };
}

/** 목표 폭(또는 키)에 맞춰 줄이고 색을 평탄화한다. */
function bake(img, box, { width, height, hmax, scale }) {
  let piece = crop(img, box);
  let k = scale || (width ? width / piece.width : height / piece.height);
  // 폭으로 맞췄는데 세로가 상한을 넘으면 세로 기준으로 다시 잡는다
  if (hmax && piece.height * k > hmax) k = hmax / piece.height;
  const dw = Math.max(1, Math.round(piece.width * k));
  const dh = Math.max(1, Math.round(piece.height * k));
  return { ...posterize(shrink(piece, dw, dh), 12), w: dw, h: dh };
}

/** 바닥선 기울기로 그림이 어느 축으로 그려졌는지 잰다.
 *  오른쪽이 더 아래면 +gx(오른쪽 아래로 뻗는 물건), 더 위면 +gy. 차이가 작으면 대칭.
 *  렌더러는 이 값을 보고 반대 축에 놓을 때 좌우반전한다 — 벽 가구 방향이 제각각이던 원인. */
function axisOf(img) {
  const { width: w, height: h, data } = img;
  const bot = [];
  for (let x = 0; x < w; x++) {
    let b = -1;
    for (let y = 0; y < h; y++) if (data[(y * w + x) * 4 + 3] > 40) b = y;
    bot.push(b);
  }
  const cols = bot.map((v, i) => i).filter((i) => bot[i] >= 0);
  if (cols.length < 6) return "sym";
  const q = Math.max(1, Math.round(cols.length * 0.2));
  const avg = (arr) => arr.reduce((s2, i) => s2 + bot[i], 0) / arr.length;
  const d = avg(cols.slice(-q)) - avg(cols.slice(0, q));
  const rel = d / Math.max(1, h);
  if (rel > 0.08) return "gx";
  if (rel < -0.08) return "gy";
  return "sym";
}

let made = 0, missing = [];
for (const theme of THEMES) {
  const propDir = join(ROOT, "assets/pack", theme, "props");
  const actDir = join(ROOT, "assets/pack", theme, "actors");
  if (WRITE) { mkdirSync(propDir, { recursive: true }); mkdirSync(actDir, { recursive: true }); }
  const manifest = {};

  // ── 가구 ──
  for (const kind of Object.keys(PROP_ORDER)) {
    const file = join(RAW, PROP_FILE(theme, kind) + ".png");
    if (!existsSync(file)) { missing.push(PROP_FILE(theme, kind)); continue; }
    const { img, boxes, n } = pieces(file, 4, 3);
    PROP_ORDER[kind].forEach((name, i) => {
      if (!boxes[i]) return;
      const out = bake(img, boxes[i], { width: widthOf(name), hmax: heightOf(name) });
      manifest[name] = { w: out.w, h: out.h, axis: axisOf(out) };
      if (WRITE) writeFileSync(join(propDir, name + ".png"), encodePng(out.w, out.h, out.data));
      made++;
    });
    console.log(`  ${theme}/${kind.padEnd(8)} 성분 ${String(n).padStart(2)} → 12개`);
  }

  // ── 사람 ──
  // 칸마다 제 바운딩 박스를 28px에 맞추면 안 된다. 팔을 든 그림은 박스가 커서 몸이
  // 작아지고, 앉은 그림은 박스가 작아서 몸이 커진다 — 그래서 키가 제각각으로 보였다.
  // 시트는 한 배율로 그려져 있으니 **서 있는 칸 하나에서 배율을 구해 24칸 전부에 쓴다.**
  const castFile = join(RAW, "cast", theme + ".png");
  if (!existsSync(castFile)) { missing.push("cast/" + theme); continue; }
  const { img, boxes, n } = pieces(castFile, 4, 6);
  const refIdx = CAST.findIndex(([nm]) => nm === "a_stand_f");
  const refBox = boxes[refIdx] || boxes[0];
  const k = ACTOR.stand / (refBox.y1 - refBox.y0 + 1);
  CAST.forEach(([name], i) => {
    if (!boxes[i]) return;
    const out = bake(img, boxes[i], { scale: k });
    if (WRITE) writeFileSync(join(actDir, name + ".png"), encodePng(out.w, out.h, out.data));
    made++;
  });
  console.log(`  ${theme}/cast     성분 ${String(n).padStart(2)} → 24개 (배율 ${k.toFixed(3)} 일괄)`);
  if (WRITE) writeFileSync(join(ROOT, "assets/pack", theme, "manifest.json"), JSON.stringify(manifest, null, 1));
}

console.log(`\n${made}개 ${WRITE ? "저장" : "(--write 필요)"} — assets/pack/<테마>/{props,actors}`);
if (missing.length) console.log("원본 없음: " + missing.join(", "));

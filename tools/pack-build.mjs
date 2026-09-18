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
import { PROPS, ACTOR, CAST, THEMES, HMAX, widthOf } from "./pack-spec.mjs";

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
function bake(img, box, { width, height, hmax }) {
  let piece = crop(img, box);
  let k = width ? width / piece.width : height / piece.height;
  // 폭으로 맞췄는데 세로가 상한을 넘으면 세로 기준으로 다시 잡는다
  if (hmax && piece.height * k > hmax) k = hmax / piece.height;
  const dw = Math.max(1, Math.round(piece.width * k));
  const dh = Math.max(1, Math.round(piece.height * k));
  return { ...posterize(shrink(piece, dw, dh), 12), w: dw, h: dh };
}

let made = 0, missing = [];
for (const theme of THEMES) {
  const propDir = join(ROOT, "assets/pack", theme, "props");
  const actDir = join(ROOT, "assets/pack", theme, "actors");
  if (WRITE) { mkdirSync(propDir, { recursive: true }); mkdirSync(actDir, { recursive: true }); }

  // ── 가구 ──
  for (const kind of Object.keys(PROP_ORDER)) {
    const file = join(RAW, PROP_FILE(theme, kind) + ".png");
    if (!existsSync(file)) { missing.push(PROP_FILE(theme, kind)); continue; }
    const { img, boxes, n } = pieces(file, 4, 3);
    PROP_ORDER[kind].forEach((name, i) => {
      if (!boxes[i]) return;
      const out = bake(img, boxes[i], { width: widthOf(name), hmax: HMAX[name] });
      if (WRITE) writeFileSync(join(propDir, name + ".png"), encodePng(out.w, out.h, out.data));
      made++;
    });
    console.log(`  ${theme}/${kind.padEnd(8)} 성분 ${String(n).padStart(2)} → 12개`);
  }

  // ── 사람 ──
  const castFile = join(RAW, "cast", theme + ".png");
  if (!existsSync(castFile)) { missing.push("cast/" + theme); continue; }
  const { img, boxes, n } = pieces(castFile, 4, 6);
  CAST.forEach(([name, kindOf], i) => {
    if (!boxes[i]) return;
    const out = bake(img, boxes[i], { height: ACTOR[kindOf] });
    if (WRITE) writeFileSync(join(actDir, name + ".png"), encodePng(out.w, out.h, out.data));
    made++;
  });
  console.log(`  ${theme}/cast     성분 ${String(n).padStart(2)} → 24개`);
}

console.log(`\n${made}개 ${WRITE ? "저장" : "(--write 필요)"} — assets/pack/<테마>/{props,actors}`);
if (missing.length) console.log("원본 없음: " + missing.join(", "));

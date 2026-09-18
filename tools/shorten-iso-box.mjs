// 아이소 박스 스프라이트의 "키"만 줄인다.
//
//   node tools/shorten-iso-box.mjs <파일> <자를 행수> [--write]
//
// 왜 축소가 아니라 잘라내기인가:
//   전체를 축소하면 바닥 면적(발자국)까지 같이 줄어 격자와 안 맞고, 정수배가 아니면
//   도트가 뭉갠다. 아이소 박스는 윗면 → 수직면 → 아랫변 순서라, 좌우 실루엣이 모두
//   수직인 구간(= 수직면)에서 몇 행만 빼면 바닥 크기는 그대로 두고 높이만 낮아진다.
//   이음매는 "빼고 나서 위아래로 맞닿는 두 행"이 가장 비슷한 위치를 골라 감춘다.
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng } from "./_canvas.mjs";

const file = process.argv[2];
const N = Number(process.argv[3] || 0);
const WRITE = process.argv.includes("--write");
const im = decodePng(readFileSync(file));
const { width: w, height: h, data } = im;

const span = [];
for (let y = 0; y < h; y++) {
  let l = -1, r = -1;
  for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; }
  span.push([l, r]);
}
// 좌우가 동시에 수직인 구간 = 박스의 수직면
let lo = -1, hi = -1;
for (let y = 1; y < h; y++) {
  const a = span[y - 1], b = span[y];
  if (a[0] < 0 || b[0] < 0) continue;
  if (a[0] === b[0] && a[1] === b[1]) { if (lo < 0) lo = y - 1; hi = y; }
  else if (lo >= 0 && hi - lo >= 3) break;
  else { lo = -1; hi = -1; }
}
console.log(`${file}  ${w}×${h}  수직면 y=${lo}..${hi} (${hi - lo + 1}행)`);
if (N <= 0) process.exit(0);
if (hi - lo + 1 < N) { console.error(`수직면이 ${hi - lo + 1}행뿐이라 ${N}행은 못 자른다`); process.exit(1); }

const rowDiff = (y1, y2) => {
  let s = 0;
  for (let x = 0; x < w; x++) {
    const o1 = (y1 * w + x) * 4, o2 = (y2 * w + x) * 4;
    for (let k = 0; k < 4; k++) s += Math.abs(data[o1 + k] - data[o2 + k]);
  }
  return s / w;
};
let best = { y: lo, e: Infinity };
for (let y = lo; y + N - 1 <= hi; y++) {
  const e = y > 0 && y + N < h ? rowDiff(y - 1, y + N) : Infinity;
  if (e < best.e) best = { y, e };
}
console.log(`  ${N}행 잘라내기: y=${best.y}..${best.y + N - 1}, 이음매 오차 ${best.e.toFixed(1)}/1020`);

const nh = h - N;
const out = Buffer.alloc(w * nh * 4);
for (let y = 0, dy = 0; y < h; y++) {
  if (y >= best.y && y < best.y + N) continue;
  data.copy(out, dy * w * 4, y * w * 4, (y + 1) * w * 4);
  dy++;
}
if (WRITE) { writeFileSync(file, encodePng(w, nh, out)); console.log(`  → ${w}×${nh} 로 덮어씀`); }
else console.log("  (--write 를 붙여야 실제로 저장한다)");

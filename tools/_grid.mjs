// 테마별 같은 이름의 스프라이트를 나란히 놓고 비교한다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const [, , names, out, scale] = process.argv;
const THEMES = ["classic", "princess", "neon", "european", "japanese"];
const KEYS = names.split(",");
const S = Number(scale || 4), GAP = 6;
const cells = THEMES.map((t) => KEYS.map((k) => {
  const f = `assets/pack/${t}/props/${k}.png`;
  return existsSync(f) ? decodePng(readFileSync(f)) : null;
}));
const colW = KEYS.map((_, j) => Math.max(...cells.map((r) => (r[j] ? r[j].width : 0))) + GAP);
const rowH = cells.map((r) => Math.max(...r.map((i) => (i ? i.height : 0))) + GAP);
const cv = makeCanvas(colW.reduce((a, b) => a + b, GAP), rowH.reduce((a, b) => a + b, GAP));
let y = GAP;
cells.forEach((row, i) => {
  let x = GAP;
  row.forEach((im, j) => {
    if (im) cv.ctx.drawImage({ width: im.width, height: im.height, data: im.data }, x, y + rowH[i] - GAP - im.height);
    x += colW[j];
  });
  y += rowH[i];
});
writeFileSync(out, toPng(cv, S, [20, 16, 13]));
console.log(THEMES.join(" / ") + "  ×  " + KEYS.join(","));

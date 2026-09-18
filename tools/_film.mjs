// 여러 프레임의 같은 영역을 가로로 이어 붙인다 — 애니메이션이 실제로 도는지 본다.
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const [, , x0, y0, w, h, scale, out, ...files] = process.argv;
const X = Number(x0), Y = Number(y0), W = Number(w), H = Number(h), S = Number(scale || 4);
const cv = makeCanvas(files.length * (W + 2), H);
files.forEach((f, i) => {
  const im = decodePng(readFileSync(f));
  cv.ctx.drawImage({ width: im.width, height: im.height, data: im.data }, X, Y, W, H, i * (W + 2), 0, W, H);
});
writeFileSync(out, toPng(cv, S, [20, 16, 13]));
console.log("ok " + out);

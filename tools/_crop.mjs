// 미리보기 PNG 일부를 정수배로 확대해 잘라 낸다 — 눈으로 확인할 때만 쓰는 도구.
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const [, , src, x0, y0, w, h, scale, out] = process.argv;
const img = decodePng(readFileSync(src));
const X = Number(x0), Y = Number(y0), W = Number(w), H = Number(h), S = Number(scale || 3);
const cv = makeCanvas(W, H);
cv.ctx.drawImage({ width: img.width, height: img.height, data: img.data }, -X, -Y);
writeFileSync(out, toPng(cv, S, [20, 16, 13]));
console.log("ok " + out + " " + W * S + "×" + H * S);

import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, makeCanvas, toPng } from "./_canvas.mjs";
const [src, X, Y, W, H, Z, out] = process.argv.slice(2);
const im = decodePng(readFileSync(src));
const s = makeCanvas(Number(W), Number(H));
s.ctx.drawImage(im, Number(X), Number(Y), Number(W), Number(H), 0, 0, Number(W), Number(H));
writeFileSync(out, toPng(s, Number(Z), [20, 16, 13]));
console.log(out);

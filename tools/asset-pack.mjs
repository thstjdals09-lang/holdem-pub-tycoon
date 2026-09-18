// asset-pack — 생성된 원본 PNG를 게임에 바로 쓸 수 있는 에셋으로 가공한다.
//
//  1) 흰 배경을 테두리에서 flood fill로 지운다 (안쪽 크림색은 살린다)
//  2) 남은 그림에 딱 맞게 잘라내고 여백을 일정하게 준다
//  3) 지정한 크기로 축소(박스 필터)해서 저장한다
//
// 외부 패키지 없이 Node 내장 zlib만 쓴다 — npm install 없이 어디서든 돌아가게.
// 다루는 PNG는 8비트 RGB/RGBA 비인터레이스(이미지 생성 모델 출력)만 가정한다.
//
//   node tools/asset-pack.mjs
//   node tools/asset-pack.mjs --only prestige

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "assets", "raw");
const OUT = join(ROOT, "assets", "img");

// ============================================================
//  PNG 디코드 / 인코드
// ============================================================
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("PNG 시그니처가 아님");
  let pos = 8;
  let ihdr = null;
  const idat = [];
  let palette = null;
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("IHDR 없음");
  if (ihdr.interlace) throw new Error("인터레이스 PNG는 지원 안 함");
  // 생성 모델이 가끔 16비트 PNG를 돌려준다. 채널당 2바이트이므로 상위 바이트만 취해 8비트로 낮춘다.
  if (ihdr.bitDepth !== 8 && ihdr.bitDepth !== 16) throw new Error(`비트깊이 ${ihdr.bitDepth}는 지원 안 함`);
  const bps = ihdr.bitDepth === 16 ? 2 : 1;

  const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const ch = CHANNELS[ihdr.colorType];
  if (!ch) throw new Error(`컬러타입 ${ihdr.colorType}는 지원 안 함`);

  const raw = inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const stride = w * ch * bps;
  const lines = Buffer.alloc(h * stride);

  // 스캔라인 필터 해제
  let src = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    const row = src;
    src += stride;
    const cur = y * stride;
    for (let x = 0; x < stride; x++) {
      const bpp = ch * bps;
      const a = x >= bpp ? lines[cur + x - bpp] : 0;
      const b = y > 0 ? lines[cur - stride + x] : 0;
      const c = x >= bpp && y > 0 ? lines[cur - stride + x - bpp] : 0;
      const v = raw[row + x];
      let out;
      switch (filter) {
        case 0: out = v; break;
        case 1: out = v + a; break;
        case 2: out = v + b; break;
        case 3: out = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`알 수 없는 필터 ${filter}`);
      }
      lines[cur + x] = out & 0xff;
    }
  }

  // 무엇이 오든 RGBA로 통일
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * ch * bps, d = i * 4;
    if (ihdr.colorType === 6) {
      rgba[d] = lines[s]; rgba[d + 1] = lines[s + bps]; rgba[d + 2] = lines[s + bps * 2]; rgba[d + 3] = lines[s + bps * 3];
    } else if (ihdr.colorType === 2) {
      rgba[d] = lines[s]; rgba[d + 1] = lines[s + bps]; rgba[d + 2] = lines[s + bps * 2]; rgba[d + 3] = 255;
    } else if (ihdr.colorType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s]; rgba[d + 3] = 255;
    } else if (ihdr.colorType === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s]; rgba[d + 3] = lines[s + bps];
    } else if (ihdr.colorType === 3) {
      const p = lines[s] * 3;
      rgba[d] = palette[p]; rgba[d + 1] = palette[p + 1]; rgba[d + 2] = palette[p + 2];
      rgba[d + 3] = trns && lines[s] < trns.length ? trns[lines[s]] : 255;
    }
  }
  return { width: w, height: h, data: rgba };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * 스캔라인마다 필터 5종을 다 만들어보고 절대값 합이 가장 작은 것을 고른다(PNG 표준 권장 휴리스틱).
 * 필터 0 고정으로 두면 그라데이션 배경이 거의 안 줄어서 로딩 이미지가 3MB까지 부푼다.
 */
function filterScanlines(data, width, height) {
  const stride = width * 4;
  const BPP = 4;
  const out = Buffer.alloc(height * (stride + 1));
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];

  for (let y = 0; y < height; y++) {
    const cur = y * stride;
    const prev = cur - stride;
    for (let x = 0; x < stride; x++) {
      const v = data[cur + x];
      const a = x >= BPP ? data[cur + x - BPP] : 0;
      const b = y > 0 ? data[prev + x] : 0;
      const c = x >= BPP && y > 0 ? data[prev + x - BPP] : 0;
      cand[0][x] = v;
      cand[1][x] = (v - a) & 0xff;
      cand[2][x] = (v - b) & 0xff;
      cand[3][x] = (v - ((a + b) >> 1)) & 0xff;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      cand[4][x] = (v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      let s = 0;
      for (let x = 0; x < stride; x++) {
        const v = cand[f][x];
        s += v < 128 ? v : 256 - v; // 부호 있는 값의 크기로 본다
      }
      if (s < bestScore) { bestScore = s; best = f; }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
  }
  return out;
}

function encodePng({ width, height, data }) {
  const raw = filterScanlines(data, width, height);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ============================================================
//  이미지 연산
// ============================================================

/**
 * 테두리에서 시작하는 flood fill로 "바깥 흰 배경"만 지운다.
 * 전체 픽셀을 밝기로 자르면 그림 안쪽의 크림색 면까지 뚫려버리기 때문에,
 * 바깥과 연결된 흰 영역만 따라가는 방식이 필요하다.
 */
function keyOutBackground(img, { tolerance = 30, feather = 2, mode = "white", brightMin = 172 } = {}) {
  const { width: w, height: h, data } = img;
  // mode "white": 거의 순백만 배경으로 본다.
  // mode "pale": 밝고 채도가 낮으면 배경으로 본다. 생성 이미지의 배경은 순백이 아니라
  //   옅은 회색·베이지 비네트가 깔려 있는 경우가 많아서, 순백 기준으로는 테두리 근처에서 멈춰
  //   사각형 배경이 그대로 남는다. 그림 안쪽의 밝은 크림색 면도 조건 자체는 만족하지만
  //   flood fill이 진한 아웃라인에서 막히므로 바깥과 연결된 부분만 지워진다.
  const isPale = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (mode === "pale") {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mx >= brightMin && mx - mn <= tolerance;
    }
    return 255 - r <= tolerance && 255 - g <= tolerance && 255 - b <= tolerance;
  };
  // mode "adaptive": 이미 배경으로 판정된 이웃과 색이 비슷하면 배경으로 본다.
  // 흰색이 아니라 부드러운 그라데이션 배경을 벗길 때 쓴다 — 천천히 변하는 면은 계속 따라가고,
  // 그림의 진한 아웃라인에서 멈춘다.
  const near = (i, j) =>
    Math.abs(data[i] - data[j]) <= tolerance &&
    Math.abs(data[i + 1] - data[j + 1]) <= tolerance &&
    Math.abs(data[i + 2] - data[j + 2]) <= tolerance;

  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (p) => {
    if (mode === "adaptive" || isPale(p * 4)) stack.push(p, -1);
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }

  while (stack.length) {
    const from = stack.pop();
    const p = stack.pop();
    if (bg[p]) continue;
    if (mode === "adaptive") {
      if (from >= 0 && !near(p * 4, from * 4)) continue;
    } else if (!isPale(p * 4)) continue;
    bg[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1, p);
    if (x < w - 1) stack.push(p + 1, p);
    if (y > 0) stack.push(p - w, p);
    if (y < h - 1) stack.push(p + w, p);
  }

  // 경계를 부드럽게: 배경에 닿은 픽셀은 거리에 따라 알파를 깎는다.
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 1;
  for (let pass = 0; pass < feather; pass++) {
    const next = Float32Array.from(alpha);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (alpha[i] === 0) continue;
        const min = Math.min(alpha[i - 1], alpha[i + 1], alpha[i - w], alpha[i + w]);
        if (min < alpha[i]) next[i] = Math.min(alpha[i], min + 0.5);
      }
    }
    alpha.set(next);
  }

  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.round(alpha[i] * 255);
  return img;
}

/**
 * 크로마키 — 마젠타(#FF00FF) 배경을 지운다.
 * 도트 에셋은 생성 모델이 알파를 못 내주므로 단색 마젠타 위에 그리게 하고 여기서 뺀다.
 * 흰/회색 배경과 달리 마젠타는 그림 안에 거의 안 쓰이는 색이라 오검출이 없다.
 * 접지 그림자(어두운 마젠타)도 같은 색상(hue)이라 함께 지워진다 — 게임에서는 그림자를 따로 그린다.
 */
function keyChroma(img, { hueTol = 26, satMin = 0.35 } = {}) {
  const { width: w, height: h, data } = img;
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const d = mx - mn;
    if (d < 0.001) continue;
    const sat = mx === 0 ? 0 : d / mx;
    if (sat < satMin) continue;
    let hue;
    if (mx === r) hue = 60 * (((g - b) / d) % 6);
    else if (mx === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
    // 마젠타 = 300도
    const diff = Math.min(Math.abs(hue - 300), 360 - Math.abs(hue - 300));
    if (diff <= hueTol) data[o + 3] = 0;
  }
  // 경계에 남은 마젠타 테두리(프린지)를 한 겹 깎는다
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      const edge = !alpha[i - 1] || !alpha[i + 1] || !alpha[i - w] || !alpha[i + w];
      if (!edge) continue;
      const o = i * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (r > 120 && b > 120 && g < Math.min(r, b) * 0.75) data[o + 3] = 0;
    }
  }
  return img;
}

/**
 * 알파 블리드 — 투명 픽셀의 RGB를 이웃한 불투명 색으로 물들인다.
 * 크로마키를 하면 투명 픽셀에 마젠타 RGB가 그대로 남는다. 알파를 존중하는 엔진에선 문제없지만
 *  (1) 알파를 무시하는 뷰어에서 배경이 마젠타로 보이고
 *  (2) 확대/축소 때 보간이 켜져 있으면 가장자리에 마젠타 테두리가 번진다.
 * 가장자리 색을 바깥으로 퍼뜨리고, 그래도 안 닿은 곳은 완전히 0으로 비운다.
 */
function bleedAlpha(img, passes = 2) {
  const { width: w, height: h, data } = img;
  for (let pass = 0; pass < passes; pass++) {
    const src = Uint8ClampedArray.from(data);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] !== 0) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = (ny * w + nx) * 4;
          if (src[j + 3] === 0) continue;
          r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
        }
        if (!n) continue;
        data[i] = r / n; data[i + 1] = g / n; data[i + 2] = b / n; // 알파는 0 그대로
      }
    }
  }
  // 블리드가 안 닿은 투명 영역은 완전히 비운다 (마젠타 잔상 제거)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] !== 0) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (r > 120 && b > 120 && g < Math.min(r, b) * 0.8) { data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; }
  }
  return img;
}

/** 알파가 있는 영역에 딱 맞게 자르고, 짧은 변 기준 비율만큼 여백을 준다. */
function trim(img, { marginRatio = 0.04, square = true } = {}) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img; // 전부 투명 — 원본 그대로

  let cw = x1 - x0 + 1;
  let chh = y1 - y0 + 1;
  if (square) {
    const side = Math.max(cw, chh);
    x0 -= Math.floor((side - cw) / 2);
    y0 -= Math.floor((side - chh) / 2);
    cw = chh = side;
  }
  const m = Math.round(Math.max(cw, chh) * marginRatio);
  x0 -= m; y0 -= m; cw += m * 2; chh += m * 2;

  const out = new Uint8ClampedArray(cw * chh * 4);
  for (let y = 0; y < chh; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < cw; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= w) continue;
      const s = (sy * w + sx) * 4, d = (y * cw + x) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { width: cw, height: chh, data: out };
}

/** 사각형으로 잘라내기 (비율 지정). x/y/w/h는 0~1 비율. */
function crop(img, fx, fy, fw, fh) {
  const x0 = Math.round(img.width * fx), y0 = Math.round(img.height * fy);
  const cw = Math.round(img.width * fw), chh = Math.round(img.height * fh);
  const out = new Uint8ClampedArray(cw * chh * 4);
  for (let y = 0; y < chh; y++) {
    for (let x = 0; x < cw; x++) {
      const s = ((y0 + y) * img.width + (x0 + x)) * 4, d = (y * cw + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
  }
  return { width: cw, height: chh, data: out };
}

/** 박스 필터 축소. 알파를 곱해 평균 내야 투명 가장자리에 검은 테두리가 안 생긴다. */
function resize(img, nw, nh) {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const s = (yy * w + xx) * 4;
          const al = data[s + 3] / 255;
          r += data[s] * al; g += data[s + 1] * al; b += data[s + 2] * al;
          a += data[s + 3];
          n++;
        }
      }
      const d = (y * nw + x) * 4;
      const aAvg = a / n;
      const wgt = aAvg > 0 ? n * (aAvg / 255) : 1;
      out[d] = r / wgt; out[d + 1] = g / wgt; out[d + 2] = b / wgt; out[d + 3] = aAvg;
    }
  }
  return { width: nw, height: nh, data: out };
}

// ============================================================
//  파이프라인
// ============================================================
const save = (img, rel) => {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(img));
  const kb = (existsSync(path) ? readFileSync(path).length : 0) / 1024;
  console.log(`  ✓ ${rel}  ${img.width}x${img.height}  ${kb.toFixed(0)}KB`);
};

// 원본 파일명 → 출력 정의
const JOBS = [
  // 프레스티지 건물: 배경 투명 + 정사각 트림 + 두 사이즈
  { group: "prestige", raw: "prestige-1-pub.png",     out: "prestige/pub",     key: true, mode: "pale", tolerance: 42, sizes: [256, 128] },
  { group: "prestige", raw: "prestige-2-club.png",    out: "prestige/club",    key: true, mode: "pale", tolerance: 42, sizes: [256, 128] },
  { group: "prestige", raw: "prestige-3-premium.png", out: "prestige/premium", key: true, mode: "pale", tolerance: 42, sizes: [256, 128] },
  { group: "prestige", raw: "prestige-4-empire.png",  out: "prestige/empire",  key: true, mode: "pale", tolerance: 42, sizes: [256, 128] },

  // 대회 트로피: 배경 투명 + 정사각 트림
  { group: "trophy", raw: "trophy-1-local.png",    out: "trophy/local",    key: true, mode: "pale", tolerance: 42, sizes: [192, 96] },
  { group: "trophy", raw: "trophy-2-city.png",     out: "trophy/city",     key: true, mode: "pale", tolerance: 42, sizes: [192, 96] },
  { group: "trophy", raw: "trophy-3-national.png", out: "trophy/national", key: true, mode: "pale", tolerance: 42, sizes: [192, 96] },
  { group: "trophy", raw: "trophy-4-asia.png",     out: "trophy/asia",     key: true, mode: "pale", tolerance: 42, sizes: [192, 96] },
  { group: "trophy", raw: "trophy-5-world.png",    out: "trophy/world",    key: true, mode: "pale", tolerance: 42, sizes: [192, 96] },

  // 브랜드
  { group: "brand", raw: "app-icon.png", out: "brand/app-icon", key: false, crop: [0.1, 0.1, 0.8, 0.8], sizes: [512, 192, 180, 32] },
  // 로딩 키아트는 핑크 그라데이션 배경을 벗겨 디오라마만 남긴다 —
  // 배경은 CSS 그라데이션이 대신하면 어떤 화면 비율에도 맞고, 2MB → 200KB대로 줄어든다.
  { group: "brand", raw: "loading-key-art.png", out: "brand/loading-pub", key: true, mode: "adaptive", tolerance: 10, square: false, sizes: [720, 360] },

  // 인테리어 테마 썸네일
  { group: "theme", raw: "theme-classic.png",  out: "theme/classic",  key: false, sizes: [256] },
  { group: "theme", raw: "theme-princess.png", out: "theme/princess", key: false, sizes: [256] },
  { group: "theme", raw: "theme-european.png", out: "theme/european", key: false, sizes: [256] },
  { group: "theme", raw: "theme-neon.png",     out: "theme/neon",     key: false, sizes: [256] },
  { group: "theme", raw: "theme-japanese.png", out: "theme/japanese", key: false, sizes: [256] },
];

// ---- 도트 에셋 일괄 모드 ----
// node tools/asset-pack.mjs --pixel <원본폴더> <출력폴더> [최대변]
// 마젠타 배경을 빼고 잘라낸 뒤 파일명을 그대로 유지해 저장한다.
const pixIdx = process.argv.indexOf("--pixel");
if (pixIdx > -1) {
  const srcDir = process.argv[pixIdx + 1];
  const outDir = process.argv[pixIdx + 2];
  const maxSide = Number(process.argv[pixIdx + 3] || 0);
  if (!srcDir || !outDir) {
    console.error("사용법: --pixel <원본폴더> <출력폴더> [최대변]");
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".png"));
  let ok = 0;
  for (const f of files) {
    try {
      let img = decodePng(readFileSync(join(srcDir, f)));
      img = keyChroma(img);
      img = trim(img, { marginRatio: 0.04, square: false });
      img = bleedAlpha(img, 2);
      if (maxSide && Math.max(img.width, img.height) > maxSide) {
        const k = maxSide / Math.max(img.width, img.height);
        img = resize(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
      }
      const dst = join(outDir, f);
      writeFileSync(dst, encodePng(img));
      console.log(`  ✓ ${f}  ${img.width}x${img.height}  ${(readFileSync(dst).length / 1024).toFixed(0)}KB`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }
  console.log(`\n도트 에셋 ${ok}/${files.length}개 처리`);
  process.exit(0);
}

const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

if (!existsSync(RAW)) {
  console.error(`원본 폴더가 없습니다: ${RAW}\n생성한 PNG를 여기에 넣고 다시 실행하세요.`);
  process.exit(1);
}

console.log(`원본: ${RAW}\n출력: ${OUT}\n`);
let done = 0, skipped = 0;

for (const job of JOBS) {
  if (only && job.group !== only) continue;
  const src = join(RAW, job.raw);
  if (!existsSync(src)) { skipped++; continue; }
  console.log(`${job.raw}`);
  try {
    let img = decodePng(readFileSync(src));
    // job.crop = [x, y, w, h] (0~1 비율). 생성 모델이 자꾸 넣는 바깥 테두리를 확실하게 잘라낸다.
    if (job.crop) img = crop(img, ...job.crop);
    if (job.key) {
      img = keyOutBackground(img, { tolerance: job.tolerance ?? 30, mode: job.mode ?? "white", brightMin: job.brightMin });
      img = trim(img, { marginRatio: 0.05, square: job.square !== false });
    }
    for (const size of job.sizes) {
      const ratio = img.height / img.width;
      const out = resize(img, size, Math.round(size * ratio));
      save(out, `${job.out}${job.sizes.length > 1 ? `-${size}` : ""}.png`);
    }
    done++;
  } catch (e) {
    console.error(`  ✗ 실패: ${e.message}`);
  }
}

console.log(`\n완료 ${done}개${skipped ? ` · 원본 없어 건너뜀 ${skipped}개` : ""}`);
if (skipped) {
  console.log(`(${RAW} 안의 파일: ${readdirSync(RAW).join(", ") || "없음"})`);
}

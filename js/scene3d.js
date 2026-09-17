// PubScene3D: 홀덤펍을 귀여운 카툰(셀셰이딩) 스타일 3D 씬으로 렌더링한다.
// game.js(클래식 스크립트)가 window.PubScene3D를 통해 이 모듈과 통신한다.
//
// 화면 설계 메모
//  - 안개(Fog)를 쓰지 않는다. 직교(Orthographic) 아이소메트릭 카메라는 씬 전체가 비슷한
//    깊이에 놓이기 때문에 Fog를 걸면 매장 안쪽 절반이 통째로 하얗게 날아간다.
//    공간감은 Fog 대신 하늘 그라디언트 + 그림자로 낸다.
//  - 세로로 긴 모바일 화면에서도 테이블이 충분히 크게 보이도록 프러스텀을 가로 기준으로 맞추고,
//    대신 드래그로 매장 안을 둘러볼 수 있게 팬(pan)을 허용한다 (각도는 고정).
//  - 매장 슬롯이 늘어나면 바닥/벽이 실제로 함께 넓어진다.
//
// 매장 구성 (실제 홀덤펍 배치를 따름)
//    뒷벽   : 바 카운터 + 백바 주류 선반 + 냉장고 + 칩 케이지(금고)
//    좌측벽 : 라운지 부스 소파 + 러그 + 화분
//    우측벽 : 다트보드 + 주크박스 + TV
//    중앙   : 홀덤 테이블(레이스트랙형) 격자, 각 테이블 위 펜던트 조명
//    앞쪽   : 출입문 + 매트
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const COLORS = {
  floorBase: 0xf3c988,
  wallBack: 0xffd3e6,
  wallSide: 0xffe6d5,
  wallTrim: 0xff8fab,
  rail: 0x7a4a33, // 테이블 레일(가죽)
  railTrim: 0x5e3624,
  tableLeg: 0x5e4433,
  chair: 0x8a5a3d,
  chairPad: 0xc9506b,
  emptySlot: 0xffc85c,
  bar: 0xb97a4a,
  barTop: 0x8a5334,
  barTrim: 0xff8fab,
  stool: 0xc9506b,
  fridge: 0xf3fdff,
  fridgeDoor: 0x9fe3f2,
  vault: 0x4a4a68,
  vaultTrim: 0xffc85c,
  chip: 0xffc85c,
  chipRed: 0xe4574f,
  chipBlue: 0x5b8fe0,
  card: 0xfffdf7,
  bartenderShirt: 0xffffff,
  bartenderAccent: 0xff8fab,
  serverShirt: 0xffb677,
  marketerShirt: 0x6fc1ff,
  skin: 0xffd9b3,
  outline: 0x3a2a30,
  lightWarm: 0xffcf7a,
  lightPink: 0xff9ec2,
  wood: 0x9a6b45,
  sofa: 0x7a4a6b,
};

// 딜러 등급별 정장/포인트 색 — 도감 등급이 매장 안에서도 바로 보이게 한다.
const DEALER_RARITY_LOOK = {
  common: { suit: 0x5b5b6b, accent: 0xb9b9c6 },
  rare: { suit: 0x2f4a7a, accent: 0x4fa3ff },
  epic: { suit: 0x4a2f6b, accent: 0xc86bff },
  legendary: { suit: 0x6b4a10, accent: 0xffc83c },
  mythic: { suit: 0x7a1a5c, accent: 0xff5fd0 },
  // "staff" = 이름 붙은 운영진이 배치 안 된 테이블을 채우는 기본 운영진(보너스 없음, 시각적 필러 전용)
  staff: { suit: 0x4a4a52, accent: 0x8a8a92 },
};

const CUSTOMER_SHIRT_COLORS = [0xff8fab, 0xffc85c, 0x7bc67e, 0x6fc1ff, 0xd98cff, 0xffa8a8, 0xffe08a];
const COIN_POP_INTERVAL = 2.6;

// 레이스트랙 테이블 규격 (실제 홀덤 테이블 비율 ≒ 2.1m x 1.1m)
const TABLE_HALF_LEN = 1.45;
const TABLE_RADIUS = 0.8;
const TABLE_TOP_Y = 0.62;
const SEAT_OUT = 0.5; // 레일 바깥으로 의자가 떨어진 거리
const DEALER_OUT = 0.62;

// 타원 테이블 + 의자 + "사람이 지나갈 통로"까지 고려한 격자 간격.
// 테이블+의자 폭이 약 4.3이라 간격을 그보다 1 이상 넉넉히 둬야 손님이 사이로 지나갈 수 있다.
const SPACING_X = 5.4;
const SPACING_Z = 4.4;
const MAX_COLS = 3;

// 손님이 통과하지 못하는 영역 (XZ 평면의 타원). update()에서 다시 채운다.
let obstacles = [];

const ROOM_CENTER_Z = -1;
const ROOM_MIN_W = 17;
const ROOM_MIN_D = 16;
const WALL_H = 7;

const THEMES = {
  classic: {
    floor: 0xf3c988,
    floorPattern: "plank",
    wallBack: 0xffd3e6,
    wallSide: 0xffe6d5,
    trim: 0xff8fab,
    sky: ["#fff3e4", "#ffd9c2"],
    felt: [0x2f8a5a, 0x2a7ba0, 0x8a3a5a, 0x2f6b8a, 0x7a5aa0, 0x2f8a7a],
  },
  princess: {
    floor: 0xffd9ec,
    floorPattern: "tile",
    wallBack: 0xffe6f5,
    wallSide: 0xfff0fa,
    trim: 0xff8fd8,
    sky: ["#fff6fb", "#ffdcef"],
    felt: [0xd9578f, 0xc76bb5, 0xe07aa8, 0xa86bd9, 0xd98fc4, 0xc95a9a],
  },
  european: {
    floor: 0xc9a876,
    floorPattern: "plank",
    wallBack: 0x7a5a3f,
    wallSide: 0x9a7a54,
    trim: 0xd4af37,
    sky: ["#f0e2c6", "#cbae80"],
    felt: [0x2a5a3a, 0x6b3a2a, 0x3a4a6b, 0x5a3a5a, 0x6b5a2a, 0x2a4a4a],
  },
  neon: {
    floor: 0x2a1a3a,
    floorPattern: "tile",
    wallBack: 0x1a1030,
    wallSide: 0x231640,
    trim: 0x00e5ff,
    sky: ["#3a2560", "#140c26"],
    felt: [0x7a1a6b, 0x1a5a7a, 0x6b1a3a, 0x3a1a7a, 0x1a6b5a, 0x7a3a1a],
  },
};

let scene, camera, renderer, controls, container, clock;
let groups = {};
let bursts = [];
let customers = [];
let activitySpots = [];
let spawnTimer = 1.2;
let ready = false;
// 홀덤 테이블 좌석이 차는 목표 비율 — game.js가 방문객 수로 계산해서 넘겨준다
let tableOccupancy = 0.5;
let prefilled = false;
// 💎 말풍선 (테이블에 앉은 손님 머리 위) — game.js가 spawnDiamondBubble()로 띄우고, 터치하면 onDiamondBubble()로 알린다
let bubbles = [];
let bubbleTexture = null;
let deskSign = null;

// 손님 수 상한 — 사람 1명이 메시 8개 남짓이라 휴대폰 성능을 생각해 코어 수로 나눈다
const LOW_END = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 3;
const MAX_CUSTOMERS = LOW_END ? 72 : 128;
const OTHER_CUSTOMER_TARGET = 7; // 바·소파·다트·주크박스에 있는 손님 목표 수
const MAX_BUBBLES = 3;
let toonGradient, feltTexture;
let outlineMat;
let raycaster;
let pointerStart = null;
let currentTheme = null;
let currentPerTableIncome = 0;
let showCoinPops = true;
let floorMesh, floorMat, backWallMat, sideWallMat, backTrimMat;
let backWallMesh, leftWallMesh, rightWallMesh, backTrimMesh, stringLightsGroup, doorGroup;

let roomW = 0;
let roomD = 0;
const entrancePos = new THREE.Vector3(0, 0, 8); // 손님이 드나드는 출입문 앞 위치

const ISO_OFFSET = new THREE.Vector3(14, 13.5, 14);
const BASE_HALF_H = 9.5;
const MIN_HALF_W = 6.4;
let frustumHalfHeight = BASE_HALF_H;

// ============================================================
// 헬퍼: 재질 / 텍스처 / 외곽선
// ============================================================
function makeToonGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ["#6b6b78", "#a9a9b8", "#e2e2ea", "#ffffff"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function toonMat(color, extra) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient, ...extra });
}

function makeSkyTexture(topColor, bottomColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 펠트 상판 무늬(베팅 라인 + 딜러 영역).
// ExtrudeGeometry의 UV는 다루기 까다로워서, 마킹은 펠트 바로 위에 얹는
// 얇은 평면(투명 배경 PNG)으로 그린다. 그래야 펠트 색을 뭘로 바꿔도 라인이 그대로 보인다.
function makeFeltTexture() {
  const W = 512;
  const H = 282; // 2.9 : 1.6 비율
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 안쪽 베팅 라인 (레이스트랙 모양) — 어두운 테두리를 먼저 깔아 대비를 준다
  const inset = 52;
  const r = H / 2 - inset;
  const ring = () => {
    ctx.beginPath();
    ctx.moveTo(inset + r, inset);
    ctx.lineTo(W - inset - r, inset);
    ctx.arc(W - inset - r, H / 2, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(inset + r, H - inset);
    ctx.arc(inset + r, H / 2, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.stroke();
  };
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 15;
  ring();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 7;
  ring();

  // 가운데 로고
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "bold 46px 'Jua', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HOLD'EM", W / 2, H / 2 - 4);
  ctx.font = "bold 22px 'Jua', sans-serif";
  ctx.fillText("♠ ♥ ♦ ♣", W / 2, H / 2 + 32);

  // 딜러 영역 반원 라인.
  // 평면을 눕히면 캔버스 위쪽(y=0)이 월드 -Z(딜러 방향)가 되므로 위쪽에 그린다.
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(W / 2, inset - 8, 48, 0, Math.PI);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFloorTexture(pattern) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(60,40,30,0.28)";
  ctx.lineWidth = 3;

  if (pattern === "tile") {
    const cells = 6;
    for (let ry = 0; ry < cells; ry++) {
      for (let rx = 0; rx < cells; rx++) {
        if ((rx + ry) % 2 === 0) {
          ctx.fillStyle = "rgba(0,0,0,0.05)";
          ctx.fillRect((size / cells) * rx, (size / cells) * ry, size / cells, size / cells);
        }
      }
    }
    ctx.strokeStyle = "rgba(60,40,30,0.18)";
    for (let i = 0; i <= cells; i++) {
      const p = (size / cells) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  } else {
    const rows = 5;
    for (let r = 0; r <= rows; r++) {
      const y = (size / rows) * r;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const y0 = (size / rows) * r;
      const offset = r % 2 === 0 ? 0 : size / 3;
      for (let x = -size; x < size * 2; x += size / 1.5) {
        const xx = x + offset;
        ctx.beginPath();
        ctx.moveTo(xx, y0);
        ctx.lineTo(xx, y0 + size / rows);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function withOutline(mesh, scale = 1.06) {
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(scale);
  mesh.add(outline);
  return mesh;
}

function meshWO(geometry, color, scale) {
  const m = new THREE.Mesh(geometry, toonMat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return withOutline(m, scale);
}

function plain(geometry, color, extra) {
  const m = new THREE.Mesh(geometry, toonMat(color, extra));
  m.castShadow = true;
  return m;
}

// ============================================================
// 레이스트랙(스타디움) 기하 헬퍼 — 홀덤 테이블의 기본 형태
// ============================================================
function stadiumShape(halfLen, radius) {
  const a = Math.max(0.001, halfLen - radius);
  const s = new THREE.Shape();
  s.moveTo(-a, -radius);
  s.lineTo(a, -radius);
  s.absarc(a, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-a, radius);
  s.absarc(-a, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  s.closePath();
  return s;
}

const stadiumPerimeter = (a, r) => 2 * Math.PI * r + 4 * a;

// 둘레 위의 거리 s에 해당하는 점과 바깥 방향 법선
function stadiumPointAt(s, a, r) {
  const arc = Math.PI * r;
  const straight = 2 * a;
  const P = 2 * arc + 2 * straight;
  s = ((s % P) + P) % P;

  if (s < arc) {
    // 오른쪽 반원: -90° → +90°
    const ang = -Math.PI / 2 + s / r;
    return { x: a + Math.cos(ang) * r, z: Math.sin(ang) * r, nx: Math.cos(ang), nz: Math.sin(ang) };
  }
  s -= arc;
  if (s < straight) {
    // 위쪽 직선: (a, r) → (-a, r)
    return { x: a - s, z: r, nx: 0, nz: 1 };
  }
  s -= straight;
  if (s < arc) {
    // 왼쪽 반원: 90° → 270°
    const ang = Math.PI / 2 + s / r;
    return { x: -a + Math.cos(ang) * r, z: Math.sin(ang) * r, nx: Math.cos(ang), nz: Math.sin(ang) };
  }
  s -= arc;
  // 아래쪽 직선: (-a, -r) → (a, -r)
  return { x: -a + s, z: -r, nx: 0, nz: -1 };
}

// 아래쪽 직선 한가운데 = 딜러석
const dealerArcPos = (a, r) => Math.PI * r + 2 * a + Math.PI * r + a;

// ============================================================
// 캐릭터
// 머리카락과 표정은 "머리 텍스처 한 장"에 전부 그려 넣는다.
// 눈·볼터치·앞머리를 따로 메시로 만들면 손님 한 명당 메시가 10개 넘게 늘어나
// 모바일에서 드로우콜이 감당이 안 된다. 구(sphere) UV에 직접 그리면 메시 1개로 끝난다.
//   u = 0.25 → 얼굴 정면(+Z), u = 0.75 → 뒤통수, v = 1 → 정수리
// ============================================================
const personGeo = {
  head: new THREE.SphereGeometry(0.29, 18, 14),
  torso: new THREE.CapsuleGeometry(0.23, 0.22, 4, 10),
  torsoSit: new THREE.CapsuleGeometry(0.23, 0.14, 4, 10),
  hips: new THREE.CylinderGeometry(0.235, 0.19, 0.36, 12),
  thigh: new RoundedBoxGeometry(0.19, 0.16, 0.42, 2, 0.06),
  arm: new THREE.CapsuleGeometry(0.068, 0.24, 3, 6),
  vest: new THREE.CapsuleGeometry(0.245, 0.14, 4, 10),
  // theta -90°~+90° 구간 = 앞쪽(+Z) 반원. 이게 모자 챙이 된다.
  capBrim: new THREE.CylinderGeometry(0.3, 0.3, 0.035, 14, 1, false, -Math.PI / 2, Math.PI),
  capCrown: new THREE.SphereGeometry(0.295, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  visorBand: new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14),
  bowKnot: new THREE.SphereGeometry(0.035, 8, 8),
  bowWing: new RoundedBoxGeometry(0.09, 0.07, 0.04, 1, 0.02),
  bun: new THREE.SphereGeometry(0.13, 10, 10),
};

const HEAD_TEX = new Map();

// 머리 텍스처: 머리카락 라인 + 눈/볼터치/입
function headTexture(skinHex, hairHex, style) {
  const key = `${skinHex}|${hairHex}|${style}`;
  if (HEAD_TEX.has(key)) return HEAD_TEX.get(key);

  const W = 256;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const FACE_X = 64; // u = 0.25

  g.fillStyle = skinHex;
  g.fillRect(0, 0, W, H);

  // ---- 머리카락 ----
  // 옆/뒤는 길게, 얼굴 쪽은 이마가 보이도록 짧게 (컬럼 단위로 헤어라인을 그린다)
  const sideExtra = { short: 8, spiky: 6, bob: 34, long: 64, ponytail: 12, bun: 8 }[style] ?? 8;
  const base = 40;
  g.fillStyle = hairHex;
  for (let px = 0; px < W; px++) {
    const d = Math.min(Math.abs(px - FACE_X), Math.abs(px - FACE_X - W), Math.abs(px - FACE_X + W));
    const faceness = Math.max(0, 1 - d / 36);
    let hb = base + sideExtra * (1 - faceness) - 9 * faceness;
    if (style === "spiky") hb += Math.sin(px * 0.55) * 7;
    g.fillRect(px, 0, 1, Math.max(6, hb));
  }
  if (style === "ponytail") {
    // 뒤통수(u=0.75)에 묶은 머리
    g.beginPath();
    g.ellipse(192, 66, 22, 34, 0, 0, Math.PI * 2);
    g.fill();
  }

  // ---- 표정 ----
  const eyeY = 70;
  const eyeDX = 17;
  g.fillStyle = "#3a2a30";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(FACE_X + s * eyeDX, eyeY, 8, 10.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#ffffff";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(FACE_X + s * eyeDX + 3, eyeY - 3.5, 3, 3.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 볼터치
  g.fillStyle = "rgba(255,140,175,0.5)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(FACE_X + s * 31, eyeY + 13, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 입
  g.strokeStyle = "#3a2a30";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.arc(FACE_X, eyeY + 15, 8, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  HEAD_TEX.set(key, tex);
  return tex;
}

const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// 손님 외형 팔레트 (셔츠 / 바지 / 머리색 / 헤어스타일)
const HAIR_COLORS = [0x3b2b20, 0x1f1a18, 0x6b4a2f, 0x8a6a4a, 0xc98a4a, 0x5a4632, 0x2b2440];
const PANTS_COLORS = [0x4a5a7a, 0x3a3a4a, 0x6b5a4a, 0x2f4a5a, 0x5a4a6b, 0x7a5a5a];
const DEALER_HAIR = [0x2b2440, 0x3b2b20, 0x1f1a18, 0x6b4a2f, 0xc98a4a];
const DEALER_STYLES = ["short", "ponytail", "bob", "spiky", "bun"];
const HAIR_STYLES = ["short", "bob", "long", "ponytail", "spiky", "bun"];

function randomCustomerLook() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return {
    shirt: pick(CUSTOMER_SHIRT_COLORS),
    pants: pick(PANTS_COLORS),
    hair: pick(HAIR_COLORS),
    style: pick(HAIR_STYLES),
  };
}

// 캐릭터 조립.
//   shirt/pants/hair/style : 외형
//   seated                 : 의자에 앉은 자세 (허벅지가 앞으로 나온다)
//   vest / bowtie / hat    : 딜러·바텐더 같은 유니폼 요소
//   armsOnTable            : 딜러가 테이블 위로 팔을 뻗은 자세
function makePersonMesh(opts = {}) {
  const {
    shirt = 0xff8fab,
    pants = 0x4a5a7a,
    hair = 0x3b2b20,
    skin = COLORS.skin,
    style = "short",
    seated = false,
    vest = null,
    bowtie = null,
    hat = null, // null | "cap" | "visor"
    hatColor = 0x2a2436,
    armsOnTable = false,
  } = opts;

  const group = new THREE.Group();
  const headMat = toonMat(0xffffff, { map: headTexture(hex(skin), hex(hair), style) });

  // 앉은 자세는 의자 좌면(y≈0.45) 위에 몸이 올라간다
  const hipY = seated ? 0.52 : 0.18;
  const torsoGeo = seated ? personGeo.torsoSit : personGeo.torso;
  const torsoY = seated ? 0.86 : 0.7;
  const headY = seated ? 1.35 : 1.19;

  if (seated) {
    for (const s of [-1, 1]) {
      const thigh = plain(personGeo.thigh, pants);
      thigh.position.set(s * 0.13, 0.5, 0.2);
      group.add(thigh);
    }
  } else {
    const hips = plain(personGeo.hips, pants);
    hips.position.y = hipY;
    group.add(hips);
  }

  const torso = meshWO(torsoGeo, shirt, 1.07);
  torso.position.y = torsoY;
  group.add(torso);

  if (vest !== null) {
    const v = plain(personGeo.vest, vest);
    v.position.y = torsoY - 0.05;
    group.add(v);
  }

  const head = meshWO(personGeo.head, 0xffffff, 1.06);
  head.material = headMat;
  head.position.y = headY;
  group.add(head);

  if (style === "bun") {
    const bun = plain(personGeo.bun, hair);
    bun.position.set(0, headY + 0.24, -0.08);
    group.add(bun);
  }

  // 팔
  const armY = seated ? torsoY + 0.02 : torsoY - 0.02;
  for (const s of [-1, 1]) {
    const arm = plain(personGeo.arm, shirt);
    if (armsOnTable) {
      arm.position.set(s * 0.26, armY, 0.24);
      arm.rotation.x = Math.PI / 2.3;
    } else {
      arm.position.set(s * 0.29, armY, 0.02);
      arm.rotation.z = s * -0.18;
    }
    group.add(arm);
  }

  if (bowtie !== null) {
    const knot = plain(personGeo.bowKnot, bowtie);
    knot.position.set(0, headY - 0.26, 0.2);
    group.add(knot);
    for (const s of [-1, 1]) {
      const wing = plain(personGeo.bowWing, bowtie);
      wing.position.set(s * 0.07, headY - 0.26, 0.19);
      wing.rotation.z = s * 0.35;
      group.add(wing);
    }
  }

  if (hat === "cap") {
    const crown = plain(personGeo.capCrown, hatColor);
    crown.position.y = headY + 0.03;
    const brim = plain(personGeo.capBrim, hatColor);
    brim.position.set(0, headY + 0.04, 0.02);
    brim.scale.set(1, 1, 1.25);
    group.add(crown, brim);
  } else if (hat === "visor") {
    const band = plain(personGeo.visorBand, hatColor);
    band.position.y = headY + 0.12;
    const brim = plain(personGeo.capBrim, hatColor);
    brim.position.set(0, headY + 0.11, 0.02);
    brim.scale.set(1, 1, 1.15);
    group.add(band, brim);
  }

  return group;
}

// ============================================================
// 가구
// ============================================================
const furnGeo = {
  chairSeat: new RoundedBoxGeometry(0.5, 0.1, 0.5, 2, 0.05),
  chairBack: new RoundedBoxGeometry(0.5, 0.46, 0.1, 2, 0.05),
  chairPost: new THREE.CylinderGeometry(0.06, 0.07, 0.42, 8),
  stoolTop: new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14),
  stoolPost: new THREE.CylinderGeometry(0.05, 0.07, 0.62, 8),
  stoolFoot: new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12),
  chipStack: new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12),
  card: new RoundedBoxGeometry(0.16, 0.012, 0.22, 1, 0.02),
  bottle: new THREE.CylinderGeometry(0.06, 0.08, 0.34, 8),
  glass: new THREE.CylinderGeometry(0.06, 0.05, 0.16, 8),
};

function buildChair(padColor) {
  const g = new THREE.Group();
  const seat = plain(furnGeo.chairSeat, padColor);
  seat.position.y = 0.45;
  const back = plain(furnGeo.chairBack, padColor);
  back.position.set(0, 0.7, -0.2);
  const post = plain(furnGeo.chairPost, COLORS.chair);
  post.position.y = 0.21;
  const foot = plain(furnGeo.stoolFoot, COLORS.chair);
  foot.position.y = 0.02;
  g.add(seat, back, post, foot);
  return g;
}

function buildBarStool() {
  const g = new THREE.Group();
  const top = plain(furnGeo.stoolTop, COLORS.stool);
  top.position.y = 0.68;
  const post = plain(furnGeo.stoolPost, 0x6b6b78);
  post.position.y = 0.34;
  const foot = plain(furnGeo.stoolFoot, 0x6b6b78);
  foot.position.y = 0.03;
  g.add(top, post, foot);
  return g;
}

function buildSofa(width) {
  const g = new THREE.Group();
  const seat = meshWO(new RoundedBoxGeometry(width, 0.42, 0.85, 3, 0.12), COLORS.sofa, 1.03);
  seat.position.y = 0.26;
  const back = meshWO(new RoundedBoxGeometry(width, 0.7, 0.24, 3, 0.1), COLORS.sofa, 1.04);
  back.position.set(0, 0.68, -0.33);
  g.add(seat, back);
  for (const sx of [-width / 2 + 0.12, width / 2 - 0.12]) {
    const arm = plain(new RoundedBoxGeometry(0.22, 0.28, 0.85, 2, 0.08), COLORS.sofa);
    arm.position.set(sx, 0.58, 0);
    g.add(arm);
  }
  return g;
}

function buildLowTable() {
  const g = new THREE.Group();
  const top = meshWO(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), COLORS.wood, 1.05);
  top.position.y = 0.44;
  const post = plain(new THREE.CylinderGeometry(0.07, 0.11, 0.44, 8), COLORS.tableLeg);
  post.position.y = 0.22;
  g.add(top, post);
  return g;
}

function buildRug(w, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

// 테이블 위 펜던트 조명 — 펍 분위기의 핵심
function buildPendantLamp() {
  const g = new THREE.Group();
  const cord = plain(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), 0x3a2a30);
  cord.position.y = 3.35;
  const shade = meshWO(new THREE.ConeGeometry(0.4, 0.34, 14, 1, true), 0x2f3550, 1.05);
  shade.position.y = 2.5;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshBasicMaterial({ color: COLORS.lightWarm })
  );
  bulb.position.y = 2.36;
  g.add(cord, shade, bulb);
  return g;
}

function buildBottleShelf(level) {
  const g = new THREE.Group();
  const board = meshWO(new RoundedBoxGeometry(3.4, 0.12, 0.34, 2, 0.05), COLORS.wood, 1.03);
  board.position.y = 0;
  const board2 = meshWO(new RoundedBoxGeometry(3.4, 0.12, 0.34, 2, 0.05), COLORS.wood, 1.03);
  board2.position.y = 0.72;
  g.add(board, board2);
  const bottleColors = [0x5c3a21, 0x2f6b4a, 0x7a2f4a, 0x2f4a7a, 0xc9a24a];
  const count = Math.min(6 + level * 2, 18);
  for (let i = 0; i < count; i++) {
    const shelf = i % 2;
    const idx = Math.floor(i / 2);
    const b = plain(furnGeo.bottle, bottleColors[i % bottleColors.length]);
    b.position.set(-1.55 + idx * 0.36, (shelf ? 0.72 : 0) + 0.23, 0);
    g.add(b);
  }
  return g;
}

function buildDoor() {
  const g = new THREE.Group();
  const frame = meshWO(new RoundedBoxGeometry(1.9, 2.5, 0.16, 2, 0.06), COLORS.wood, 1.03);
  frame.position.y = 1.25;
  const panel = plain(new RoundedBoxGeometry(1.55, 2.15, 0.1, 2, 0.05), 0x3f2f3a);
  panel.position.set(0, 1.25, 0.06);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe9c9, transparent: true, opacity: 0.55 })
  );
  glass.position.set(0, 1.7, 0.13);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.3),
    new THREE.MeshBasicMaterial({ color: COLORS.lightPink })
  );
  sign.position.set(0, 2.72, 0.1);
  g.add(frame, panel, glass, sign);
  return g;
}

function buildWallArt(color) {
  const g = new THREE.Group();
  const frame = plain(new RoundedBoxGeometry(0.9, 0.7, 0.07, 2, 0.03), COLORS.wood);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.48), new THREE.MeshBasicMaterial({ color }));
  art.position.z = 0.05;
  g.add(frame, art);
  return g;
}

function buildTV() {
  const g = new THREE.Group();
  const body = plain(new RoundedBoxGeometry(1.7, 1.0, 0.1, 2, 0.04), 0x2a2436);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.82),
    new THREE.MeshBasicMaterial({ color: 0x3fa8c9 })
  );
  screen.position.z = 0.06;
  g.add(body, screen);
  return g;
}

function buildPlant() {
  const g = new THREE.Group();
  const pot = meshWO(new THREE.CylinderGeometry(0.28, 0.2, 0.38, 12), 0xc98a52, 1.08);
  pot.position.y = 0.19;
  const leaves = meshWO(new THREE.SphereGeometry(0.42, 12, 12), 0x6bbf6e, 1.06);
  leaves.position.y = 0.72;
  leaves.scale.y = 1.15;
  g.add(pot, leaves);
  return g;
}

function buildNeon() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.8, 0.1, 3, 0.12), toonMat(0x3a2436));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ color: 0xff6fa5 }));
  glow.position.z = 0.06;
  g.add(board, glow);
  return g;
}

function buildDartboard() {
  const g = new THREE.Group();
  const outer = meshWO(new THREE.CircleGeometry(0.48, 20), 0xfff1de, 1.05);
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 20), toonMat(0xd94848));
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.2, 20), toonMat(0xfff1de));
  const bull = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), toonMat(0xd94848));
  [ring1, ring2, bull].forEach((m) => (m.position.z = 0.02));
  g.add(outer, ring1, ring2, bull);
  return g;
}

function buildJukebox() {
  const g = new THREE.Group();
  const body = meshWO(new RoundedBoxGeometry(0.8, 1.25, 0.55, 3, 0.14), 0xffcf6b, 1.05);
  body.position.y = 0.62;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), new THREE.MeshBasicMaterial({ color: 0xff8fab }));
  screen.position.set(0, 0.86, 0.29);
  const base = plain(new RoundedBoxGeometry(0.9, 0.12, 0.6, 2, 0.04), 0x8a5334);
  base.position.y = 0.06;
  g.add(body, screen, base);
  return g;
}

function buildChandelier() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 20), toonMat(COLORS.emptySlot));
  ring.rotation.x = Math.PI / 2;
  const bulbs = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: COLORS.lightWarm }));
    bulb.position.set(Math.cos(a) * 0.4, -0.05, Math.sin(a) * 0.4);
    bulbs.add(bulb);
  }
  const light = new THREE.PointLight(0xffe9b0, 0.7, 5);
  g.add(ring, bulbs, light);
  return g;
}

function buildVip() {
  const g = new THREE.Group();
  const curtain = meshWO(new RoundedBoxGeometry(1.4, 1.9, 0.14, 3, 0.15), 0x8a2b4a, 1.05);
  curtain.position.y = 0.95;
  const trim = plain(new THREE.BoxGeometry(1.4, 0.12, 0.16), COLORS.emptySlot);
  trim.position.y = 1.85;
  const rope = plain(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), COLORS.emptySlot);
  rope.rotation.z = Math.PI / 2;
  rope.position.set(0, 0.7, 0.55);
  g.add(curtain, trim, rope);
  return g;
}

// 장식품은 레벨이 오를수록 개수가 늘어난다 (무한 업그레이드가 눈에 보이도록).
// 대회 우승 트로피(접수대 카운터 위)
const trophyGeo = {
  cup: new THREE.CylinderGeometry(0.12, 0.06, 0.18, 10),
  stem: new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6),
  base: new THREE.BoxGeometry(0.16, 0.05, 0.16),
};
function buildTrophyCup() {
  const g = new THREE.Group();
  const cup = plain(trophyGeo.cup, 0xffc21a);
  cup.position.y = 0.22;
  const stem = plain(trophyGeo.stem, 0xffc21a);
  stem.position.y = 0.09;
  const base = plain(trophyGeo.base, 0x8a5a2b);
  base.position.y = 0.02;
  g.add(cup, stem, base);
  return g;
}

function placeDecorRow(builder, level, originX, y, z, stepX, maxShown) {
  const group = new THREE.Group();
  const count = Math.min(level, maxShown);
  for (let i = 0; i < count; i++) {
    const mesh = builder();
    mesh.position.set(originX + i * stepX, mesh.position.y + y, z);
    mesh.scale.setScalar(1 + Math.min(level, 20) * 0.012);
    group.add(mesh);
  }
  return group;
}

// ============================================================
// 홀덤 테이블 (레이스트랙 + 딜러석)
// ============================================================
function buildHoldemTable({ index, dealer, feltColor, seatCount }) {
  const g = new THREE.Group();
  g.userData = { type: "table", index, coinTimer: (index % 7) * (COIN_POP_INTERVAL / 7) };

  const HL = TABLE_HALF_LEN;
  const R = TABLE_RADIUS;
  const a = HL - R;

  // 레일(가죽 테두리) — 안쪽을 뚫은 "링"으로 뽑아야 한다.
  // 구멍 없이 뽑으면 속이 꽉 찬 덩어리가 되어 펠트 상판을 통째로 덮어버린다.
  const railShape = stadiumShape(HL + 0.16, R + 0.16);
  railShape.holes.push(stadiumShape(HL, R));
  const railGeo = new THREE.ExtrudeGeometry(railShape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 2,
    curveSegments: 18,
  });
  railGeo.rotateX(-Math.PI / 2);
  const rail = meshWO(railGeo, COLORS.rail, 1.01);
  rail.position.y = TABLE_TOP_Y - 0.18;

  // 펠트 상판 — 레일 윗면보다 살짝 낮게 앉혀서 실제 테이블처럼 움푹 들어가 보이게
  const feltShape = stadiumShape(HL, R);
  const feltGeo = new THREE.ExtrudeGeometry(feltShape, {
    depth: 0.3,
    bevelEnabled: false,
    curveSegments: 18,
  });
  feltGeo.rotateX(-Math.PI / 2);
  const felt = new THREE.Mesh(feltGeo, toonMat(feltColor));
  felt.position.y = TABLE_TOP_Y - 0.18;
  felt.receiveShadow = true;

  // 베팅 라인/로고 — 펠트 바로 위에 얹는 투명 평면
  const marks = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HL, 2 * R),
    new THREE.MeshBasicMaterial({ map: feltTexture, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  marks.rotation.x = -Math.PI / 2;
  marks.position.y = TABLE_TOP_Y + 0.121;
  marks.renderOrder = 1;

  // 다리 / 받침
  const post = plain(new THREE.CylinderGeometry(0.16, 0.22, 0.46, 12), COLORS.tableLeg);
  post.position.y = 0.23;
  const foot = meshWO(new THREE.CylinderGeometry(0.55, 0.62, 0.09, 16), COLORS.tableLeg, 1.05);
  foot.position.y = 0.045;

  g.add(foot, post, rail, felt, marks);

  // 펠트 윗면(= 받침 높이 + 두께) 바로 위에 카드/칩을 올린다
  const topY = TABLE_TOP_Y + 0.13;

  // 커뮤니티 카드 5장
  for (let i = 0; i < 5; i++) {
    const card = plain(furnGeo.card, COLORS.card);
    card.position.set(-0.4 + i * 0.2, topY, 0.06);
    g.add(card);
  }
  // 팟(가운데 칩 더미)
  for (let i = 0; i < 3; i++) {
    const chip = plain(furnGeo.chipStack, i === 1 ? COLORS.chipRed : COLORS.chip);
    chip.scale.y = 0.5 + Math.random() * 0.6;
    chip.position.set(-0.16 + i * 0.16, topY + 0.05, -0.34);
    g.add(chip);
  }

  // ---------- 딜러석 ----------
  const dealerS = dealerArcPos(a, R);
  const dp = stadiumPointAt(dealerS, a, R);
  const dealerPos = new THREE.Vector3(dp.x + dp.nx * DEALER_OUT, 0, dp.z + dp.nz * DEALER_OUT);
  const dealerFacing = Math.atan2(-dp.nx, -dp.nz);

  // 딜러 칩 트레이 (딜러 앞 펠트 위)
  const tray = plain(new RoundedBoxGeometry(0.9, 0.1, 0.24, 2, 0.03), 0x2f2a33);
  tray.position.set(0, topY, -R + 0.3);
  g.add(tray);
  for (let i = 0; i < 5; i++) {
    const c = plain(furnGeo.chipStack, [COLORS.chip, COLORS.chipRed, COLORS.chipBlue][i % 3]);
    c.scale.y = 0.8;
    c.position.set(-0.32 + i * 0.16, topY + 0.13, -R + 0.3);
    g.add(c);
  }
  // 카드 슈
  const shoe = plain(new RoundedBoxGeometry(0.26, 0.16, 0.3, 2, 0.04), 0x3a2f4a);
  shoe.position.set(0.72, topY + 0.06, -R + 0.32);
  g.add(shoe);

  // 딜러 의자 + 앉아 있는 딜러
  const dealerChair = buildChair(0x4a3a4a);
  dealerChair.position.copy(dealerPos);
  dealerChair.rotation.y = dealerFacing;
  g.add(dealerChair);

  if (dealer) {
    const look = DEALER_RARITY_LOOK[dealer.rarity] || DEALER_RARITY_LOOK.common;
    // 딜러 유니폼: 흰 셔츠 + 등급색 조끼 + 보타이 + 딜러 바이저
    const person = makePersonMesh({
      shirt: 0xfdfdfd,
      pants: look.suit,
      vest: look.suit,
      bowtie: look.accent,
      hat: "visor",
      hatColor: look.accent,
      hair: DEALER_HAIR[index % DEALER_HAIR.length],
      style: DEALER_STYLES[index % DEALER_STYLES.length],
      seated: true,
      armsOnTable: true,
    });
    person.position.copy(dealerPos);
    person.rotation.y = dealerFacing;
    person.scale.setScalar(0.94);
    g.add(person);
    if (dealer.rarity === "legendary" || dealer.rarity === "epic" || dealer.rarity === "mythic") {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.66, 24),
        new THREE.MeshBasicMaterial({ color: look.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(dealerPos.x, 0.03, dealerPos.z);
      g.add(halo);
    }
  }

  // ---------- 플레이어석 ----------
  // 딜러 주변 구간을 비워두고 나머지 둘레에 의자를 고르게 배치한다.
  const P = stadiumPerimeter(a, R);
  const gap = 1.7; // 딜러 좌우로 비워둘 둘레 길이
  const span = P - gap;
  const seats = [];
  for (let i = 0; i < seatCount; i++) {
    const s = dealerS + gap / 2 + (span * (i + 0.5)) / seatCount;
    const p = stadiumPointAt(s, a, R);
    const sx = p.x + p.nx * SEAT_OUT;
    const sz = p.z + p.nz * SEAT_OUT;
    const rot = Math.atan2(-p.nx, -p.nz);
    const chair = buildChair(COLORS.chairPad);
    chair.position.set(sx, 0, sz);
    chair.rotation.y = rot;
    g.add(chair);

    // 각 자리 앞에 홀 카드 2장
    const hx = p.x * 0.74;
    const hz = p.z * 0.74;
    for (let c = 0; c < 2; c++) {
      const card = plain(furnGeo.card, COLORS.card);
      card.position.set(hx + (c - 0.5) * 0.12, topY, hz);
      card.rotation.y = rot;
      g.add(card);
    }
    seats.push({ x: sx, z: sz, rot });
  }
  g.userData.seats = seats;
  return g;
}

function buildEmptySlot() {
  const g = new THREE.Group();
  g.userData = { type: "buyTable" };
  const shape = stadiumShape(TABLE_HALF_LEN, TABLE_RADIUS);
  const pts = shape.getPoints(48);
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0.03, p.y)));
  const line = new THREE.LineLoop(geo, new THREE.LineDashedMaterial({ color: COLORS.emptySlot, dashSize: 0.22, gapSize: 0.16 }));
  line.computeLineDistances();
  g.add(line);

  const plusMat = new THREE.MeshBasicMaterial({ color: COLORS.emptySlot, transparent: true, opacity: 0.9 });
  const plusA = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.14), plusMat);
  const plusB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.62), plusMat);
  plusA.position.y = plusB.position.y = 0.05;
  // 아이소메트릭 화면에서 X자가 아니라 +자로 보이도록 45° 돌려둔다
  const plusWrap = new THREE.Group();
  plusWrap.rotation.y = Math.PI / 4;
  plusWrap.add(plusA, plusB);
  g.add(plusWrap);

  // 레이캐스트가 잘 맞도록 보이지 않는 판을 깔아둔다
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_HALF_LEN * 2, TABLE_RADIUS * 2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.rotation.x = -Math.PI / 2;
  hit.position.y = 0.02;
  g.add(hit);
  return g;
}

function gridPosition(i, cols, rows) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * SPACING_X;
  const z = (row - (rows - 1) / 2) * SPACING_Z + ROOM_CENTER_Z;
  return [x, z];
}

// ============================================================
// 매장 골격
// ============================================================
function rebuildStringLights() {
  if (stringLightsGroup) scene.remove(stringLightsGroup);
  stringLightsGroup = new THREE.Group();
  const count = Math.max(7, Math.round(roomW / 2.2));
  const zBack = ROOM_CENTER_Z - roomD / 2;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = (t - 0.5) * (roomW - 2);
    const sag = Math.sin(t * Math.PI) * 0.5;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? COLORS.lightWarm : COLORS.lightPink })
    );
    bulb.position.set(x, 6.1 - sag, zBack + 0.1);
    stringLightsGroup.add(bulb);
  }
  scene.add(stringLightsGroup);
}

function applyRoomSize(w, d) {
  if (w === roomW && d === roomD) return;
  roomW = w;
  roomD = d;
  const zBack = ROOM_CENTER_Z - d / 2;
  const zFront = ROOM_CENTER_Z + d / 2;
  // 출입문 위치는 아래에서 함께 정한다

  floorMesh.geometry.dispose();
  floorMesh.geometry = new THREE.PlaneGeometry(w, d);
  floorMesh.position.set(0, 0, ROOM_CENTER_Z);
  floorMat.map.repeat.set(w / 4.6, d / 4.4);

  backWallMesh.geometry.dispose();
  backWallMesh.geometry = new THREE.PlaneGeometry(w, WALL_H);
  backWallMesh.position.set(0, WALL_H / 2, zBack);

  backTrimMesh.geometry.dispose();
  backTrimMesh.geometry = new THREE.BoxGeometry(w, 0.3, 0.05);
  backTrimMesh.position.set(0, 1.3, zBack + 0.03);

  const sideGeo = new THREE.PlaneGeometry(d, WALL_H);
  leftWallMesh.geometry.dispose();
  leftWallMesh.geometry = sideGeo;
  leftWallMesh.position.set(-w / 2, WALL_H / 2, ROOM_CENTER_Z);
  rightWallMesh.geometry = sideGeo;
  rightWallMesh.position.set(w / 2, WALL_H / 2, ROOM_CENTER_Z);

  // 출입문 — 좌측벽 앞쪽.
  // 앞쪽(카메라 쪽)에 세우면 큰 판때기가 매장을 가려버리므로 보이는 벽에 붙인다.
  if (!doorGroup) {
    doorGroup = buildDoor();
    scene.add(doorGroup);
  }
  entrancePos.set(-w / 2 + 1.5, 0, zFront - 1.8);
  doorGroup.position.set(-w / 2 + 0.12, 0, entrancePos.z);
  doorGroup.rotation.y = Math.PI / 2;

  rebuildStringLights();
}

export function init(containerEl) {
  container = containerEl;
  if (!container) return;
  try {
    toonGradient = makeToonGradient();
    feltTexture = makeFeltTexture();
    outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
    raycaster = new THREE.Raycaster();

    scene = new THREE.Scene();
    scene.background = makeSkyTexture(THEMES.classic.sky[0], THEMES.classic.sky[1]);
    // Fog 없음 — 직교 카메라에서는 매장 안쪽이 통째로 날아가버린다.

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const isoTarget = new THREE.Vector3(0, 0, ROOM_CENTER_Z);
    camera.position.copy(isoTarget).add(ISO_OFFSET);
    applyFrustum(width / height);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.panSpeed = 1.1;
    controls.minZoom = 0.6;
    controls.maxZoom = 2.4;
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.target.copy(isoTarget);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xfff0e0, 0xd9a35f, 0.9));
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.0);
    sun.position.set(6, 14, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 48;
    sun.shadow.bias = -0.002;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffd7ea, 0.3);
    fill.position.set(-6, 6, -4);
    scene.add(fill);

    floorMat = toonMat(COLORS.floorBase, { map: makeFloorTexture("plank") });
    floorMat.userData.pattern = "plank";
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    backWallMat = toonMat(COLORS.wallBack);
    backWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backWallMat);
    backWallMesh.receiveShadow = true;
    scene.add(backWallMesh);

    backTrimMat = toonMat(COLORS.wallTrim);
    backTrimMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), backTrimMat);
    scene.add(backTrimMesh);

    sideWallMat = toonMat(COLORS.wallSide);
    leftWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sideWallMat);
    leftWallMesh.rotation.y = Math.PI / 2;
    leftWallMesh.receiveShadow = true;
    rightWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sideWallMat);
    rightWallMesh.rotation.y = -Math.PI / 2;
    rightWallMesh.receiveShadow = true;
    scene.add(leftWallMesh, rightWallMesh);

    applyRoomSize(ROOM_MIN_W, ROOM_MIN_D);

    groups = {
      tables: new THREE.Group(),
      fixtures: new THREE.Group(),
      staff: new THREE.Group(),
      decor: new THREE.Group(),
      bursts: new THREE.Group(),
      customers: new THREE.Group(),
      bubbles: new THREE.Group(),
    };
    scene.add(groups.tables, groups.fixtures, groups.staff, groups.decor, groups.bursts, groups.customers, groups.bubbles);

    clock = new THREE.Clock();
    ready = true;
    window.addEventListener("resize", onResize);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    animate();
  } catch (err) {
    console.error("[PubScene3D] init failed", err);
    container.innerHTML =
      '<div style="padding:24px;text-align:center;color:#9b8b7f;font-size:13px;">이 브라우저는 3D 매장 화면을 지원하지 않아요.<br/>게임 진행에는 문제없어요!</div>';
  }
}

function applyTheme(themeId) {
  const t = THEMES[themeId] || THEMES.classic;
  if (themeId === currentTheme) return;
  currentTheme = themeId;
  floorMat.color.set(t.floor);
  if (floorMat.userData.pattern !== t.floorPattern) {
    const repeat = floorMat.map.repeat.clone();
    floorMat.map = makeFloorTexture(t.floorPattern);
    floorMat.map.repeat.copy(repeat);
    floorMat.needsUpdate = true;
    floorMat.userData.pattern = t.floorPattern;
  }
  backWallMat.color.set(t.wallBack);
  sideWallMat.color.set(t.wallSide);
  backTrimMat.color.set(t.trim);
  if (scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = makeSkyTexture(t.sky[0], t.sky[1]);
}

function applyFrustum(aspect) {
  frustumHalfHeight = Math.max(BASE_HALF_H, MIN_HALF_W / Math.max(aspect, 0.2));
  camera.left = -frustumHalfHeight * aspect;
  camera.right = frustumHalfHeight * aspect;
  camera.top = frustumHalfHeight;
  camera.bottom = -frustumHalfHeight;
  camera.updateProjectionMatrix();
}

function onResize() {
  if (!ready || !container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  applyFrustum(width / height);
  renderer.setSize(width, height);
}

function clearGroup(group) {
  while (group.children.length) group.remove(group.children[0]);
}

function findTaggedAncestor(obj) {
  let cur = obj;
  while (cur && !(cur.userData && cur.userData.type)) cur = cur.parent;
  return cur;
}

function onPointerDown(e) {
  pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
}

function onPointerUp(e) {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  const moved = Math.hypot(dx, dy);
  const elapsed = performance.now() - pointerStart.t;
  pointerStart = null;
  if (moved > 10 || elapsed > 500) return;

  // 💎 말풍선이 먼저 — 작아서 누르기 어려우니 화면 거리로 넉넉하게 판정한다
  const bubble = pickBubble(e.clientX, e.clientY);
  if (bubble) {
    collectBubble(bubble);
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([groups.tables, groups.fixtures], true);
  if (!hits.length) return;
  const target = findTaggedAncestor(hits[0].object);
  if (!target || !window.PubScene3D || typeof window.PubScene3D.onTap !== "function") return;

  const { type, index, id } = target.userData;
  if (type === "table") window.PubScene3D.onTap({ type: "table", index });
  else if (type === "buyTable") window.PubScene3D.onTap({ type: "buyTable" });
  else if (type === "fixture") window.PubScene3D.onTap({ type: "fixture", id });
  else if (type === "tournamentDesk") window.PubScene3D.onTap({ type: "tournament" });
}

// ============================================================
// 씬 갱신
// ============================================================
export function update(snapshot) {
  if (!ready) return;
  const {
    tables,
    capacity,
    maxShown,
    fixtures,
    staff,
    decor,
    assignedDealers = [],
    perTableIncome = 0,
    showTableIncome = true,
    seatsMin = 4,
    seatsMax = 8,
    theme = "classic",
    occupancy = 0.5,
    tournamentWins = 0,
  } = snapshot;

  applyTheme(theme);
  tableOccupancy = occupancy;
  currentPerTableIncome = perTableIncome;
  showCoinPops = showTableIncome;
  const feltPalette = (THEMES[theme] || THEMES.classic).felt;

  const shownCapacity = Math.min(capacity, maxShown);
  const obstacleList = [];
  const cols = Math.min(MAX_COLS, Math.max(1, Math.ceil(Math.sqrt(shownCapacity * 0.8))));
  const rows = Math.ceil(shownCapacity / cols);

  // 테이블 격자 + 바/라운지 공간까지 들어가도록 매장을 넓힌다
  applyRoomSize(
    Math.max(ROOM_MIN_W, cols * SPACING_X + 7),
    Math.max(ROOM_MIN_D, rows * SPACING_Z + 8)
  );

  const zBack = ROOM_CENTER_Z - roomD / 2;
  const zFront = ROOM_CENTER_Z + roomD / 2;
  const halfW = roomW / 2;
  const zWall = zBack + 1.1;

  // ---------- 테이블 ----------
  clearGroup(groups.tables);
  const spots = [];
  for (let i = 0; i < shownCapacity; i++) {
    const [x, z] = gridPosition(i, cols, rows);
    if (i < tables) {
      const seatCount = seatsMin + ((i * 2654435761) >>> 0) % Math.max(1, seatsMax - seatsMin + 1);
      const obj = buildHoldemTable({
        index: i,
        dealer: assignedDealers[i] || null,
        feltColor: feltPalette[i % feltPalette.length],
        seatCount,
      });
      obj.position.set(x, 0, z);
      groups.tables.add(obj);

      // 펜던트 조명
      const lamp = buildPendantLamp();
      lamp.position.set(x, 0, z);
      groups.tables.add(lamp);

      // 테이블 + 의자 범위는 손님이 통과할 수 없다
      obstacleList.push({
        id: `tbl${i}`,
        x,
        z,
        rx: TABLE_HALF_LEN + 0.16 + SEAT_OUT + 0.15,
        rz: TABLE_RADIUS + 0.16 + SEAT_OUT + 0.15,
      });

      obj.userData.seats.forEach((s, si) => {
        spots.push({
          id: `t${i}s${si}`,
          type: "poker",
          tableIndex: i, // 손님 배치 우선순위 계산용(안쪽 테이블=인덱스가 작은 쪽부터 채움)
          x: x + s.x,
          z: z + s.z,
          rot: s.rot,
          seated: true,
          duration: [35, 80], // 포커는 한 번 앉으면 오래 친다 — 짧으면 좌석이 금방 비어 테이블이 휑해 보인다
          ignore: `tbl${i}`, // 자기 자리로 가려면 자기 테이블은 통과해야 한다
        });
      });
    } else {
      const obj = buildEmptySlot();
      obj.position.set(x, 0, z);
      groups.tables.add(obj);
    }
  }

  // ---------- 시설 (뒷벽을 따라 배치) ----------
  clearGroup(groups.fixtures);

  // 바 카운터 + 스툴 + 백바 선반
  const barX = -halfW + 3.0;
  const barLevel = fixtures.bar || 0;
  const barGroup = new THREE.Group();
  barGroup.userData = { type: "fixture", id: "bar" };
  const barBody = meshWO(new RoundedBoxGeometry(3.6, 1.05, 0.7, 3, 0.1), COLORS.bar, 1.03);
  barBody.position.set(barX, 0.52, zWall + 0.5);
  const barTop = plain(new RoundedBoxGeometry(3.9, 0.12, 0.92, 2, 0.05), COLORS.barTop);
  barTop.position.set(barX, 1.1, zWall + 0.5);
  const barLight = plain(new THREE.BoxGeometry(3.6, 0.06, 0.06), COLORS.barTrim);
  barLight.position.set(barX, 0.95, zWall + 0.87);
  barGroup.add(barBody, barTop, barLight);
  // 카운터 위 잔/병
  for (let i = 0; i < Math.min(2 + barLevel, 7); i++) {
    const glass = plain(furnGeo.glass, 0xdfe9f0);
    glass.position.set(barX - 1.5 + i * 0.44, 1.24, zWall + 0.35);
    barGroup.add(glass);
  }
  groups.fixtures.add(barGroup);

  const shelf = buildBottleShelf(barLevel);
  shelf.position.set(barX, 1.55, zBack + 0.2);
  groups.fixtures.add(shelf);

  if (staff.bartender > 0) {
    const bartender = makePersonMesh({ shirt: 0xffffff, pants: 0x3a3a4a, vest: 0x4a3a52, bowtie: COLORS.bartenderAccent, hair: 0x3b2b20, style: "short" });
    bartender.position.set(barX, 0, zWall - 0.35);
    bartender.rotation.y = Math.PI;
    bartender.userData.bobPhase = 0.5;
    groups.fixtures.add(bartender);
  }

  // 바 스툴 — 손님이 앉아서 한잔 하는 자리
  const stoolCount = 5;
  for (let i = 0; i < stoolCount; i++) {
    const sx = barX - 1.6 + i * 0.8;
    const sz = zWall + 1.5;
    const stool = buildBarStool();
    stool.position.set(sx, 0, sz);
    groups.fixtures.add(stool);
    spots.push({ id: `bar${i}`, type: "bar", x: sx, z: sz, rot: Math.PI, seated: true, sitY: 0.24, duration: [12, 24], ignore: "bar" });
  }

  // 냉장고
  const fridgeX = barX + 3.0;
  const fridgeGroup = new THREE.Group();
  fridgeGroup.userData = { type: "fixture", id: "fridge" };
  const fridge = meshWO(new RoundedBoxGeometry(0.9, 1.6, 0.75, 3, 0.1), COLORS.fridge, 1.04);
  fridge.position.set(fridgeX, 0.8, zWall);
  const fridgeDoor = plain(new THREE.BoxGeometry(0.62, 1.2, 0.05), COLORS.fridgeDoor);
  fridgeDoor.position.set(fridgeX, 0.85, zWall + 0.39);
  fridgeGroup.add(fridge, fridgeDoor);
  groups.fixtures.add(fridgeGroup);
  const fridgeLevel = fixtures.fridge || 0;
  if (fridgeLevel > 0) {
    const light = new THREE.PointLight(0xbdeeff, Math.min(fridgeLevel, 6) * 0.15, 2.8);
    light.position.set(fridgeX, 1.5, zWall + 0.5);
    groups.fixtures.add(light);
  }

  // 칩 케이지 = 대회 접수대 — 실제 펍의 캐셔 자리. 탭하면 대회 탭이 열리고, 우승할 때마다 카운터에 트로피가 늘어난다.
  // (예전 "다이아 금고" 자리. 금고 업그레이드는 삭제됨)
  const vaultX = halfW - 2.4;
  const vaultGroup = new THREE.Group();
  vaultGroup.userData = { type: "tournamentDesk" };
  const counter = meshWO(new RoundedBoxGeometry(2.0, 1.0, 0.7, 3, 0.08), COLORS.wood, 1.03);
  counter.position.set(vaultX, 0.5, zWall + 0.4);
  const cage = plain(new RoundedBoxGeometry(1.9, 1.0, 0.1, 2, 0.04), 0x8a8a9a);
  cage.position.set(vaultX, 1.6, zWall + 0.4);
  const safe = meshWO(new RoundedBoxGeometry(0.9, 0.9, 0.7, 3, 0.08), COLORS.vault, 1.04);
  safe.position.set(vaultX, 0.45, zWall - 0.4);
  const dial = plain(new THREE.TorusGeometry(0.12, 0.028, 8, 16), COLORS.vaultTrim);
  dial.position.set(vaultX, 0.5, zWall - 0.04);
  vaultGroup.add(counter, cage, safe, dial);
  for (let i = 0; i < 3; i++) {
    const chip = plain(furnGeo.chipStack, [COLORS.chip, COLORS.chipRed, COLORS.chipBlue][i % 3]);
    chip.position.set(vaultX - 0.75 + i * 0.3, 1.12, zWall + 0.25);
    vaultGroup.add(chip);
  }
  for (let i = 0; i < Math.min(tournamentWins, 5); i++) {
    const cup = buildTrophyCup();
    cup.position.set(vaultX + 0.1 + (i % 3) * 0.32, 1.02, zWall + 0.42 - Math.floor(i / 3) * 0.3);
    vaultGroup.add(cup);
  }
  if (!deskSign) {
    deskSign = makeTextSprite("🏆 대회 접수", "#b07800");
    deskSign.scale.multiplyScalar(0.8);
  }
  deskSign.position.set(vaultX, 2.55, zWall + 0.4);
  vaultGroup.add(deskSign);
  groups.fixtures.add(vaultGroup);

  // ---------- 라운지 (좌측벽) ----------
  const loungeZ = ROOM_CENTER_Z + roomD / 2 - 4.5;
  const sofa = buildSofa(2.6);
  sofa.position.set(-halfW + 1.1, 0, loungeZ);
  sofa.rotation.y = Math.PI / 2;
  groups.fixtures.add(sofa);
  const lowTable = buildLowTable();
  lowTable.position.set(-halfW + 2.4, 0, loungeZ);
  groups.fixtures.add(lowTable);
  groups.fixtures.add(buildRug(3.4, 3.0, 0x8a4a5a).translateX(-halfW + 2.0).translateZ(loungeZ));
  for (let i = 0; i < 3; i++) {
    spots.push({
      id: `sofa${i}`,
      type: "sofa",
      x: -halfW + 1.35,
      z: loungeZ - 0.85 + i * 0.85,
      rot: Math.PI / 2,
      seated: true,
      sitY: 0,
      duration: [14, 26],
    });
  }

  // 벽 장식은 카메라를 마주보는 벽(좌측벽 / 뒷벽)에만 건다.
  // 우측벽·앞쪽은 시점상 뒷면이 보이므로 아무것도 걸지 않는다.
  for (let i = 0; i < 2; i++) {
    const art = buildWallArt([0xff8fab, 0x6fc1ff][i]);
    art.position.set(-halfW + 0.08, 3.0, ROOM_CENTER_Z - 1.5 + i * 2.4);
    art.rotation.y = Math.PI / 2;
    groups.fixtures.add(art);
  }
  // TV — 뒷벽 오른쪽(캐셔 위)
  const tv = buildTV();
  tv.position.set(vaultX - 3.2, 3.2, zBack + 0.1);
  groups.fixtures.add(tv);

  // ---------- 돌아다니는 직원 ----------
  clearGroup(groups.staff);
  const roamDefs = [
    { id: "server", color: COLORS.serverShirt },
    { id: "marketer", color: COLORS.marketerShirt },
  ];
  let idx = 0;
  roamDefs.forEach((r) => {
    const count = Math.min(staff[r.id] || 0, 8);
    for (let i = 0; i < count; i++) {
      const person = makePersonMesh({ shirt: r.color, pants: 0x3a3a4a, hair: HAIR_COLORS[idx % HAIR_COLORS.length], style: HAIR_STYLES[idx % HAIR_STYLES.length], hat: r.id === "marketer" ? "cap" : null, hatColor: r.color });
      const angle = (idx / 9) * Math.PI * 2;
      person.position.set(Math.cos(angle) * (halfW - 1.6), 0, ROOM_CENTER_Z + roomD / 2 - 3.2 + Math.sin(angle) * 1.6);
      person.rotation.y = angle;
      person.userData.bobPhase = idx;
      groups.staff.add(person);
      idx++;
    }
  });

  // ---------- 장식품 (레벨이 오를수록 개수가 늘어난다) ----------
  clearGroup(groups.decor);
  const lv = (id) => decor[id] || 0;

  if (lv("plant")) {
    groups.decor.add(placeDecorRow(buildPlant, lv("plant"), -halfW + 0.9, 0, zFront - 2.2, 0, 1));
    if (lv("plant") > 1)
      groups.decor.add(placeDecorRow(buildPlant, lv("plant") - 1, halfW - 0.9, 0, zFront - 2.2 - 1.1, -0.1, 5));
  }
  if (lv("neon")) groups.decor.add(placeDecorRow(buildNeon, lv("neon"), -2.6, 3.4, zBack + 0.12, 2.6, 3));

  // 다트보드 — 좌측벽(카메라를 마주보는 면). 손님이 던지러 오는 자리도 함께 만든다.
  if (lv("dart")) {
    const dartZ = ROOM_CENTER_Z - 2.6;
    for (let i = 0; i < Math.min(lv("dart"), 3); i++) {
      const board = buildDartboard();
      board.position.set(-halfW + 0.1, 1.75, dartZ + i * 1.6);
      board.rotation.y = Math.PI / 2;
      groups.decor.add(board);
      spots.push({
        id: `dart${i}`,
        type: "dart",
        x: -halfW + 2.5,
        z: dartZ + i * 1.6,
        rot: -Math.PI / 2,
        seated: false,
        duration: [9, 16],
        aim: { x: -halfW + 0.25, y: 1.75, z: dartZ + i * 1.6 },
      });
    }
  }
  // 주크박스 — 뒷벽, 바 옆(실제 펍처럼). 손님이 노래를 고르러 온다.
  if (lv("jukebox")) {
    const jx = fridgeX + 2.1;
    const jz = zBack + 0.75;
    const juke = buildJukebox();
    juke.position.set(jx, 0, jz);
    groups.decor.add(juke);
    spots.push({ id: "juke0", type: "jukebox", x: jx, z: jz + 1.3, rot: Math.PI, seated: false, duration: [8, 14] });
    if (lv("jukebox") > 1) {
      const j2 = buildJukebox();
      j2.position.set(jx + 1.35, 0, jz);
      j2.scale.setScalar(0.9);
      groups.decor.add(j2);
    }
  }
  if (lv("chandelier")) groups.decor.add(placeDecorRow(buildChandelier, lv("chandelier"), -3, 5.2, ROOM_CENTER_Z, 3, 3));
  if (lv("vip")) {
    const vip = buildVip();
    vip.position.set(-halfW + 1.0, 0, zBack + 2.6);
    vip.rotation.y = Math.PI / 2;
    groups.decor.add(vip);
  }

  // 바 카운터·캐셔 카운터도 통과 불가 영역
  obstacleList.push({ id: "bar", x: barX, z: zWall + 0.5, rx: 2.3, rz: 1.0 });
  obstacleList.push({ id: "cash", x: vaultX, z: zWall + 0.4, rx: 1.4, rz: 0.9 });
  obstacles = obstacleList;

  // 업그레이드/구매 등으로 매장을 다시 그려도 손님은 지우지 않는다 — 같은 id의 새 자리로 옮겨 붙이고,
  // 자리가 없어졌으면(좌석 수 변경 등) 자연스럽게 걸어 나가게 한다.
  activitySpots = spots.map((s) => ({ ...s, taken: false }));
  const spotById = new Map(activitySpots.map((s) => [s.id, s]));
  customers.forEach((c) => {
    if (c.phase === "leave") return;
    const next = spotById.get(c.spot.id);
    if (!next || next.taken) {
      if (c.phase === "act") endActivity(c);
      c.phase = "leave";
      c.target = c.entryPos;
      return;
    }
    next.taken = true;
    const moved = Math.abs(next.x - c.spot.x) > 0.01 || Math.abs(next.z - c.spot.z) > 0.01;
    c.spot = next;
    c.target = new THREE.Vector3(next.x, 0, next.z);
    if (c.phase === "act" && moved) {
      // 매장 크기가 바뀌어 자리 좌표가 움직였으면 앉아 있던 손님도 같이 옮기고 소품을 다시 놓는다
      endActivity(c);
      c.mesh.position.set(next.x, 0, next.z);
      startActivity(c);
    }
  });

  // 처음 매장을 그릴 때는 손님이 한 명씩 걸어 들어올 때까지 텅 비어 보이지 않게, 목표 인원 대부분을 이미 앉혀둔다
  if (!prefilled) {
    prefilled = true;
    const { poker, other } = customerTargets();
    for (let i = 0; i < Math.round(poker * 0.85); i++) spawnCustomer("poker", true);
    for (let i = 0; i < Math.round(other * 0.5); i++) spawnCustomer("other", true);
  }

  const note = document.getElementById("floor-note");
  if (note) {
    if (capacity > shownCapacity) {
      note.textContent = `+${capacity - shownCapacity}개 슬롯 더 있음`;
      note.hidden = false;
    } else if (tables >= capacity) {
      note.textContent = capacity >= maxShown ? "🎉 테이블을 최대로 채웠어요!" : "매장이 가득 찼어요! 🏗 확장해보세요";
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
}

// ============================================================
// 손님 — 들어와서 기물을 실제로 사용하고 나간다
// ============================================================
const ACTIVITY_LABEL = { poker: "♠", bar: "🍺", dart: "🎯", jukebox: "♪", sofa: "💬" };

// 손님 목표 인원 — 홀덤 테이블은 전체 좌석 × 착석 비율(방문객이 많을수록 큼), 나머지 기물은 소수만
function customerTargets() {
  let pokerSeats = 0;
  activitySpots.forEach((s) => {
    if (s.type === "poker") pokerSeats++;
  });
  const other = Math.min(activitySpots.length - pokerSeats, OTHER_CUSTOMER_TARGET);
  const poker = Math.min(Math.round(pokerSeats * tableOccupancy), MAX_CUSTOMERS - other);
  return { poker, other };
}

// 목표보다 모자란 쪽으로 손님을 들여보낸다. 테이블이 많이 비어 있으면 빠르게 연달아 들어온다.
function updateSpawning(dt) {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  const { poker, other } = customerTargets();
  let pokerNow = 0;
  let otherNow = 0;
  customers.forEach((c) => {
    if (c.phase === "leave") return;
    if (c.spot.type === "poker") pokerNow++;
    else otherNow++;
  });
  const pokerGap = poker - pokerNow;
  const otherGap = other - otherNow;
  if (pokerGap <= 0 && otherGap <= 0) {
    spawnTimer = 0.8;
    return;
  }
  const goPoker = otherGap <= 0 || (pokerGap > 0 && Math.random() < pokerGap / (pokerGap + otherGap * 2));
  spawnCustomer(goPoker ? "poker" : "other");
  spawnTimer = goPoker && pokerGap > 3 ? 0.2 + Math.random() * 0.3 : 0.9 + Math.random() * 1.4;
}

// kind: "poker"(홀덤 테이블) | "other"(바/소파/다트/주크박스). seatNow면 걸어 들어오지 않고 바로 자리에 앉힌다.
function spawnCustomer(kind, seatNow = false) {
  const free = activitySpots.filter((s) => !s.taken && (kind === "poker" ? s.type === "poker" : s.type !== "poker"));
  if (!free.length) return;

  // 홀덤 테이블은 안쪽(인덱스가 작은, 입구에서 먼) 테이블부터 채운다 — 손님이 여러 테이블에 듬성듬성
  // 흩어지는 대신 안쪽 테이블이 꽉 차야 다음 테이블로 넘어간다.
  let spot = free[Math.floor(Math.random() * free.length)];
  if (kind === "poker") {
    const innermostIndex = free.reduce((m, s) => Math.min(m, s.tableIndex), Infinity);
    const innermostSeats = free.filter((s) => s.tableIndex === innermostIndex);
    spot = innermostSeats[Math.floor(Math.random() * innermostSeats.length)];
  }
  spot.taken = true;

  const look = randomCustomerLook();
  const standing = makePersonMesh(look);
  const seated = makePersonMesh({ ...look, seated: true });
  seated.visible = false;
  const wrap = new THREE.Group();
  wrap.add(standing, seated);
  wrap.scale.setScalar(0.82 + Math.random() * 0.14);
  // 손님은 수가 많아서 그림자를 끈다(그림자 패스가 두 배로 무거워짐). 발밑은 테이블·의자 그림자로 충분하다.
  wrap.traverse((o) => {
    o.castShadow = false;
  });

  const entryPos = new THREE.Vector3(entrancePos.x + (Math.random() - 0.5) * 1.2, 0, entrancePos.z + (Math.random() - 0.5) * 1.2);
  wrap.position.copy(seatNow ? new THREE.Vector3(spot.x, 0, spot.z) : entryPos);
  groups.customers.add(wrap);

  const [dMin, dMax] = spot.duration;
  const c = {
    mesh: wrap,
    standing,
    seated,
    spot,
    phase: seatNow ? "act" : "enter",
    target: new THREE.Vector3(spot.x, 0, spot.z),
    entryPos,
    // 미리 앉혀둔 손님은 남은 시간을 흩어놔야 한꺼번에 일어나지 않는다
    timer: seatNow ? Math.random() * dMax : dMin + Math.random() * (dMax - dMin),
    bobPhase: Math.random() * 10,
    actTimer: 1 + Math.random() * 2,
    props: [],
    bubble: null,
  };
  customers.push(c);
  if (seatNow) startActivity(c);
}

// 자리에 도착했을 때 그 기물에 맞는 소품을 놓는다
function startActivity(c) {
  const { spot, mesh } = c;
  if (spot.seated) {
    c.standing.visible = false;
    c.seated.visible = true;
    mesh.position.y = spot.sitY || 0;
  }
  mesh.rotation.y = spot.rot;

  if (spot.type === "bar") {
    const glass = plain(furnGeo.glass, 0xffd98a);
    glass.position.set(spot.x, 1.24, spot.z - 0.75);
    groups.customers.add(glass);
    c.props.push(glass);
  } else if (spot.type === "sofa") {
    const glass = plain(furnGeo.glass, 0xffb3d9);
    glass.position.set(spot.x + 1.1, 0.52, spot.z);
    groups.customers.add(glass);
    c.props.push(glass);
  }
}

function endActivity(c) {
  c.props.forEach((p) => groups.customers.remove(p));
  c.props = [];
  if (c.spot.seated) {
    c.standing.visible = true;
    c.seated.visible = false;
    c.mesh.position.y = 0;
  }
}

// 활동 중에 주기적으로 터지는 작은 연출 (다트 던지기 / 음표 / 건배)
function activityEffect(c) {
  const { spot } = c;
  if (spot.type === "dart" && spot.aim) {
    const dart = plain(new THREE.ConeGeometry(0.045, 0.28, 6), 0xd94848);
    dart.position.set(spot.x, 1.45, spot.z);
    dart.rotation.z = -Math.PI / 2;
    groups.bursts.add(dart);
    bursts.push({
      obj: dart,
      life: 0.5,
      kind: "dart",
      from: dart.position.clone(),
      to: new THREE.Vector3(spot.aim.x, spot.aim.y, spot.aim.z),
      t: 0,
    });
  } else if (spot.type === "jukebox" || spot.type === "sofa") {
    const note = makeTextSprite(spot.type === "jukebox" ? "♪" : "♥", spot.type === "jukebox" ? "#7c3aff" : "#ff5c8a");
    note.position.set(spot.x + (Math.random() - 0.5) * 0.4, 1.5, spot.z);
    note.material.transparent = true;
    groups.bursts.add(note);
    bursts.push({ obj: note, life: 1.2, kind: "float", vy: 0.8, spin: 0 });
  } else if (spot.type === "bar") {
    const note = makeTextSprite("🍻", "#ffb43c");
    note.position.set(spot.x, 1.6, spot.z);
    note.material.transparent = true;
    groups.bursts.add(note);
    bursts.push({ obj: note, life: 1.0, kind: "float", vy: 0.6, spin: 0 });
  }
}

// 장애물(테이블/카운터)을 피해 돌아가도록 진행 방향을 꺾는다.
// 반발력만 주면 장애물 정면에서 제자리걸음을 하므로, 접선 방향 성분을 함께 더해
// "옆으로 돌아서 지나가는" 움직임을 만든다.
const _steer = new THREE.Vector3();
function steerAround(pos, desired, ignoreId) {
  _steer.copy(desired);
  let pushed = false;
  for (const ob of obstacles) {
    if (ob.id === ignoreId) continue;
    const dx = (pos.x - ob.x) / ob.rx;
    const dz = (pos.z - ob.z) / ob.rz;
    const d = Math.hypot(dx, dz);
    if (d >= 1.5 || d === 0) continue;
    const push = (1.5 - d) / 1.5;
    const nx = dx / d;
    const nz = dz / d;
    _steer.x += nx * push * 2.4; // 바깥으로 밀어내기
    _steer.z += nz * push * 2.4;
    const tx = -nz; // 접선 방향으로 돌아가기
    const tz = nx;
    const side = desired.x * tx + desired.z * tz >= 0 ? 1 : -1;
    _steer.x += tx * side * push * 2.0;
    _steer.z += tz * side * push * 2.0;
    pushed = true;
  }
  if (!pushed || _steer.lengthSq() < 1e-6) return desired;
  return _steer.normalize();
}

// 그래도 파고들었으면 타원 밖으로 밀어낸다 (테이블을 뚫고 지나가지 않도록)
function pushOutOfObstacles(pos, ignoreId) {
  for (const ob of obstacles) {
    if (ob.id === ignoreId) continue;
    const dx = (pos.x - ob.x) / ob.rx;
    const dz = (pos.z - ob.z) / ob.rz;
    const d = Math.hypot(dx, dz);
    if (d > 0 && d < 1) {
      pos.x = ob.x + (dx / d) * ob.rx;
      pos.z = ob.z + (dz / d) * ob.rz;
    }
  }
}

function updateCustomers(dt, t) {
  updateSpawning(dt);

  const walkSpeed = 2.4;
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i];
    const m = c.mesh;

    if (c.phase === "enter" || c.phase === "leave") {
      const dir = new THREE.Vector3().subVectors(c.target, m.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 0.18) {
        if (c.phase === "enter") {
          c.phase = "act";
          startActivity(c);
        } else {
          groups.customers.remove(m);
          customers.splice(i, 1);
          continue;
        }
      } else {
        dir.normalize();
        const move = steerAround(m.position, dir, c.spot.ignore);
        m.position.addScaledVector(move, Math.min(walkSpeed * dt, dist));
        pushOutOfObstacles(m.position, c.spot.ignore);
        m.rotation.y = Math.atan2(move.x, move.z);
      }
      m.position.y = Math.abs(Math.sin(t * 7 + c.bobPhase)) * 0.06;
    } else if (c.phase === "act") {
      c.timer -= dt;
      c.actTimer -= dt;
      if (c.actTimer <= 0) {
        activityEffect(c);
        c.actTimer = 2.5 + Math.random() * 3;
      }
      // 앉아 있는 손님은 살짝 흔들, 서 있는 손님은 제자리 걸음
      const base = c.spot.seated ? c.spot.sitY || 0 : 0;
      m.position.y = base + Math.sin(t * 2.2 + c.bobPhase) * 0.02;
      // 말풍선을 띄운 손님은 말풍선이 사라질 때까지 자리를 지킨다
      if (c.timer <= 0 && !c.bubble) {
        endActivity(c);
        c.spot.taken = false;
        c.phase = "leave";
        c.target = c.entryPos;
      }
    }
  }
}

// ============================================================
// 이펙트
// ============================================================
function makeTextSprite(text, color = "#ff5c8a") {
  const fontSize = 54;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `bold ${fontSize}px "Gowun Dodum", sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 22;
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = Math.ceil(fontSize * 1.7);
  ctx.font = `bold ${fontSize}px "Gowun Dodum", sans-serif`;
  const r = canvas.height / 2;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
  ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
  ctx.arcTo(0, canvas.height, 0, 0, r);
  ctx.arcTo(0, 0, canvas.width, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.0068;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// ============================================================
// 💎 다이아 말풍선
// ============================================================
function getBubbleTexture() {
  if (bubbleTexture) return bubbleTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  ctx.lineJoin = "round";
  // 말풍선 몸통 + 꼬리
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3a2a30";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(38, 8);
  ctx.arcTo(120, 8, 120, 104, 30);
  ctx.arcTo(120, 104, 8, 104, 30);
  ctx.lineTo(78, 104);
  ctx.lineTo(64, 134);
  ctx.lineTo(50, 104);
  ctx.arcTo(8, 104, 8, 8, 30);
  ctx.arcTo(8, 8, 120, 8, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 다이아(HUD 아이콘과 같은 모양을 도형으로 — 이모지는 기기마다 모양이 달라서 안 씀)
  const P = (x, y) => [30 + x * 1.7, 22 + y * 1.7];
  const poly = (pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.lineWidth = 4;
  poly([[12, 5], [28, 5], [36, 15], [20, 35], [4, 15]], "#62d0f0");
  ctx.stroke();
  poly([[16, 15], [20, 5], [24, 15]], "#a8ecff");
  ctx.beginPath();
  ctx.moveTo(...P(4, 15));
  ctx.lineTo(...P(36, 15));
  ctx.moveTo(...P(16, 15));
  ctx.lineTo(...P(20, 35));
  ctx.lineTo(...P(24, 15));
  ctx.moveTo(...P(16, 15));
  ctx.lineTo(...P(20, 5));
  ctx.lineTo(...P(24, 15));
  ctx.stroke();
  bubbleTexture = new THREE.CanvasTexture(canvas);
  bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  return bubbleTexture;
}

// 화면에 보이는(HUD·시트에 안 가린) 위치인지 — 보이는 손님에게 우선 띄운다
function isOnScreen(pos) {
  const v = pos.clone().project(camera);
  const bottom = document.body.classList.contains("sheet-open") ? 0.2 : -0.55;
  return Math.abs(v.x) < 0.8 && v.y > bottom && v.y < 0.6;
}

export function spawnDiamondBubble(lifeSec = 12) {
  if (!ready || bubbles.length >= MAX_BUBBLES) return false;
  const seated = customers.filter((c) => c.phase === "act" && c.spot.type === "poker" && !c.bubble);
  if (!seated.length) return false;
  const visible = seated.filter((c) => isOnScreen(c.mesh.position));
  const pool = visible.length ? visible : seated;
  const c = pool[Math.floor(Math.random() * pool.length)];
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getBubbleTexture(), depthTest: false, transparent: true }));
  sprite.scale.set(1.0, 1.125, 1);
  sprite.renderOrder = 998;
  const baseY = 2.35;
  sprite.position.set(c.mesh.position.x, baseY, c.mesh.position.z);
  groups.bubbles.add(sprite);
  const b = { sprite, customer: c, life: lifeSec, age: 0, baseY };
  c.bubble = b;
  bubbles.push(b);
  return true;
}

function removeBubble(b) {
  groups.bubbles.remove(b.sprite);
  b.sprite.material.dispose();
  if (b.customer.bubble === b) b.customer.bubble = null;
  bubbles = bubbles.filter((x) => x !== b);
}

// 탭 위치에서 가장 가까운 말풍선(화면 거리 기준, 말풍선 크기보다 조금 넉넉하게)
function pickBubble(clientX, clientY) {
  if (!bubbles.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const pxPerUnit = (rect.height * camera.zoom) / (camera.top - camera.bottom);
  const radius = Math.max(34, pxPerUnit * 0.8);
  let best = null;
  let bestD = radius;
  bubbles.forEach((b) => {
    const v = b.sprite.position.clone().project(camera);
    const sx = rect.left + ((v.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - v.y) / 2) * rect.height;
    const d = Math.hypot(sx - clientX, sy - clientY);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  });
  return best;
}

function collectBubble(b) {
  const pos = b.sprite.position.clone();
  removeBubble(b);
  const amount = typeof window.PubScene3D.onDiamondBubble === "function" ? window.PubScene3D.onDiamondBubble() : 0;
  for (let i = 0; i < 6; i++) {
    const gem = new THREE.Mesh(furnGeo.chipStack, toonMat(0x62d0f0, { transparent: true }));
    gem.scale.set(0.8, 0.3, 0.8);
    gem.position.set(pos.x + (Math.random() - 0.5) * 0.7, pos.y - 0.2, pos.z + (Math.random() - 0.5) * 0.7);
    groups.bursts.add(gem);
    bursts.push({ obj: gem, life: 0.8, kind: "float", vy: 1.6 + Math.random(), spin: (Math.random() - 0.5) * 8 });
  }
  if (amount) {
    const label = makeTextSprite(`💎+${amount}`, "#1f8fc0");
    label.position.set(pos.x, pos.y + 0.3, pos.z);
    groups.bursts.add(label);
    bursts.push({ obj: label, life: 1.3, kind: "float", vy: 0.8, spin: 0 });
  }
}

function updateBubbles(dt, t) {
  for (const b of [...bubbles]) {
    b.life -= dt;
    b.age += dt;
    // 손님이 자리를 떠났거나(매장 재배치 등) 시간이 다 되면 사라진다
    if (b.life <= 0 || b.customer.phase !== "act") {
      removeBubble(b);
      continue;
    }
    const pop = Math.min(1, b.age / 0.25); // 처음 뜰 때 톡 튀어나오게
    const pulse = 1 + Math.sin(t * 5) * 0.05;
    b.sprite.scale.set(1.0 * pop * pulse, 1.125 * pop * pulse, 1);
    b.sprite.position.set(b.customer.mesh.position.x, b.baseY + Math.sin(t * 3 + b.age) * 0.08, b.customer.mesh.position.z);
    b.sprite.material.opacity = Math.min(1, b.life / 1.5);
  }
}

export function chipBurst(colorHex) {
  if (!ready) return;
  const color = colorHex || COLORS.chip;
  const cx = controls.target.x;
  const cz = controls.target.z;
  for (let i = 0; i < 8; i++) {
    const chip = new THREE.Mesh(furnGeo.chipStack, toonMat(color, { transparent: true }));
    chip.scale.y = 0.4;
    chip.position.set(cx + (Math.random() - 0.5) * 2, 0.6, cz + (Math.random() - 0.5) * 2);
    groups.bursts.add(chip);
    bursts.push({ obj: chip, life: 0.85, kind: "float", vy: 1.7 + Math.random(), spin: (Math.random() - 0.5) * 6 });
  }
}

function formatCoinAmount(n) {
  if (n < 10) return (Math.round(n * 10) / 10).toFixed(1);
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "만";
  return Math.round(n).toLocaleString("ko-KR");
}

function spawnTableCoin(tablePos, amount) {
  for (let i = 0; i < 2; i++) {
    const coin = new THREE.Mesh(furnGeo.chipStack, toonMat(COLORS.chip, { transparent: true }));
    coin.scale.y = 0.4;
    coin.position.set(tablePos.x + (Math.random() - 0.5) * 0.8, 0.95, tablePos.z + (Math.random() - 0.5) * 0.5);
    groups.bursts.add(coin);
    bursts.push({ obj: coin, life: 0.9, kind: "float", vy: 1.4 + Math.random() * 0.4, spin: 5 + Math.random() * 3 });
  }
  const label = makeTextSprite(`+${formatCoinAmount(amount)}`);
  label.material.transparent = true;
  label.position.set(tablePos.x, 2.0, tablePos.z);
  groups.bursts.add(label);
  bursts.push({ obj: label, life: 1.2, kind: "float", vy: 0.75, spin: 0 });
}

function updateTableCoins(dt) {
  if (!showCoinPops || currentPerTableIncome <= 0) return;
  groups.tables.children.forEach((tableObj) => {
    if (tableObj.userData.type !== "table") return;
    tableObj.userData.coinTimer -= dt;
    if (tableObj.userData.coinTimer <= 0) {
      spawnTableCoin(tableObj.position, currentPerTableIncome * COIN_POP_INTERVAL);
      tableObj.userData.coinTimer = COIN_POP_INTERVAL + (Math.random() - 0.5) * 0.6;
    }
  });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    if (b.kind === "dart") {
      b.t = Math.min(1, b.t + dt * 2.6);
      b.obj.position.lerpVectors(b.from, b.to, b.t);
      b.obj.position.y += Math.sin(b.t * Math.PI) * 0.18;
    } else {
      b.obj.position.y += b.vy * dt;
      b.vy -= dt * 3;
      b.obj.rotation.y += b.spin * dt;
    }
    if (b.obj.material) {
      b.obj.material.transparent = true;
      b.obj.material.opacity = Math.max(0, Math.min(1, b.life));
    }
    if (b.life <= 0) {
      groups.bursts.remove(b.obj);
      bursts.splice(i, 1);
    }
  }
}

function clampCameraTarget() {
  const marginX = Math.max(1, roomW / 2 - 2);
  const marginZ = Math.max(1, roomD / 2 - 2);
  const t = controls.target;
  t.x = Math.min(marginX, Math.max(-marginX, t.x));
  t.y = 0;
  t.z = Math.min(ROOM_CENTER_Z + marginZ, Math.max(ROOM_CENTER_Z - marginZ, t.z));
  camera.position.copy(t).add(ISO_OFFSET);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  groups.staff.children.forEach((p) => {
    p.position.y = Math.sin(t * 2 + (p.userData.bobPhase || 0)) * 0.05 + 0.02;
  });
  groups.fixtures.children.forEach((p) => {
    if (p.userData && p.userData.bobPhase !== undefined) {
      p.position.y = Math.sin(t * 2 + p.userData.bobPhase) * 0.04;
    }
  });

  updateCustomers(dt, t);
  updateBubbles(dt, t);
  updateTableCoins(dt);
  updateBursts(dt);

  controls.update();
  clampCameraTarget();
  renderer.render(scene, camera);
}

window.PubScene3D = { init, update, chipBurst, spawnDiamondBubble };

// 개발용 점검 훅: 손님이 테이블/카운터 안으로 파고들었는지 실측한다.
window.__pubDebug = () => {
  if (!ready) return { ready: false };
  let inside = 0;
  customers.forEach((c) => {
    for (const ob of obstacles) {
      if (ob.id === c.spot.ignore) continue;
      const dx = (c.mesh.position.x - ob.x) / ob.rx;
      const dz = (c.mesh.position.z - ob.z) / ob.rz;
      if (Math.hypot(dx, dz) < 0.95) {
        inside++;
        break;
      }
    }
  });
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    ready: true,
    customers: customers.length,
    // 테이블에 앉아 있는 손님 / 테이블 좌석 / 목표
    pokerSeated: customers.filter((c) => c.phase === "act" && c.spot.type === "poker").length,
    pokerSeats: activitySpots.filter((s) => s.type === "poker").length,
    targets: customerTargets(),
    // 말풍선의 화면 좌표(터치 테스트용)
    bubbles: bubbles.map((b) => {
      const v = b.sprite.position.clone().project(camera);
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    }),
    insideObstacles: inside,
    spots: activitySpots.length,
    obstacles: obstacles.length,
    meshes: scene ? scene.children.reduce((n, g) => n + (g.children ? g.children.length : 0), 0) : 0,
  };
};

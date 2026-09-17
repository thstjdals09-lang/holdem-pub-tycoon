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
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 사이트 CSS 팔레트(--accent, --accent-2, --green 등)와 통일한 3D 색상
const COLORS = {
  floorBase: 0xf3c988,
  floorLine: 0xdba55f,
  wallBack: 0xffd3e6,
  wallSide: 0xffe6d5,
  wallTrim: 0xff8fab,
  tableRim: 0xb97a4a,
  tableLeg: 0x7a5233,
  emptySlot: 0xffc85c,
  bar: 0xb97a4a,
  barTrim: 0xff8fab,
  fridge: 0xf3fdff,
  fridgeDoor: 0x9fe3f2,
  vault: 0x4a4a68,
  vaultTrim: 0xffc85c,
  chip: 0xffc85c,
  dealerSuit: 0x36395c,
  dealerAccent: 0xff8fab,
  bartenderShirt: 0xffffff,
  bartenderAccent: 0xff8fab,
  serverShirt: 0xffb677,
  marketerShirt: 0x6fc1ff,
  skin: 0xffd9b3,
  outline: 0x3a2a30,
  lightWarm: 0xffcf7a,
  lightPink: 0xff9ec2,
};

// 딜러 등급별 정장/포인트 색 — 도감 등급이 매장 안에서도 바로 보이게 한다.
const DEALER_RARITY_LOOK = {
  common: { suit: 0x5b5b6b, accent: 0xb9b9c6 },
  rare: { suit: 0x2f4a7a, accent: 0x4fa3ff },
  epic: { suit: 0x4a2f6b, accent: 0xc86bff },
  legendary: { suit: 0x6b4a10, accent: 0xffc83c },
};

const CUSTOMER_SHIRT_COLORS = [0xff8fab, 0xffc85c, 0x7bc67e, 0x6fc1ff, 0xd98cff, 0xffa8a8, 0xffe08a];
const seatGeo = new THREE.CapsuleGeometry(0.15, 0.24, 2, 6);
const COIN_POP_INTERVAL = 2.6;

const TABLE_SPACING = 3.7;
const ROOM_CENTER_Z = -1; // 매장 바닥의 중심 z
const ROOM_MIN_W = 16;
const ROOM_MIN_D = 15;
const WALL_H = 7;

// 인테리어 테마: 바닥/벽/테이블 색상 + 바닥 무늬 + 하늘 그라디언트를 통째로 바꾼다.
const THEMES = {
  classic: {
    floor: 0xf3c988,
    floorPattern: "plank",
    wallBack: 0xffd3e6,
    wallSide: 0xffe6d5,
    trim: 0xff8fab,
    sky: ["#fff3e4", "#ffd9c2"],
    felt: [0x7bc67e, 0xff9ec2, 0x6fc1ff, 0xffc85c, 0xd0a0ff, 0x8fe0c8],
  },
  princess: {
    floor: 0xffd9ec,
    floorPattern: "tile",
    wallBack: 0xffe6f5,
    wallSide: 0xfff0fa,
    trim: 0xff8fd8,
    sky: ["#fff6fb", "#ffdcef"],
    felt: [0xff9ec2, 0xffc4e0, 0xffe08a, 0xd9a8ff, 0xffb3d9, 0xfcd7ff],
  },
  european: {
    floor: 0xc9a876,
    floorPattern: "plank",
    wallBack: 0x7a5a3f,
    wallSide: 0x9a7a54,
    trim: 0xd4af37,
    sky: ["#f0e2c6", "#cbae80"],
    felt: [0x6b3f2a, 0x8a5a3b, 0x4a6741, 0x5a4a7a, 0x7a3a3a, 0x8a6a2a],
  },
  neon: {
    floor: 0x2a1a3a,
    floorPattern: "tile",
    wallBack: 0x1a1030,
    wallSide: 0x231640,
    trim: 0x00e5ff,
    sky: ["#3a2560", "#140c26"],
    felt: [0xff2fd0, 0x00e5ff, 0xffe600, 0x7c3aff, 0x2fffb0, 0xff5050],
  },
};

let scene, camera, renderer, controls, container, clock;
let groups = {};
let bursts = [];
let customers = [];
let tableSlots = [];
let spawnTimer = 1.5;
let ready = false;
let toonGradient;
let outlineMat;
let seatMaterials = [];
let raycaster;
let pointerStart = null;
let currentTheme = null;
let currentPerTableIncome = 0;
let showCoinPops = true;
let floorMesh, floorMat, backWallMat, sideWallMat, backTrimMat;
let backWallMesh, leftWallMesh, rightWallMesh, backTrimMesh, stringLightsGroup;

// 매장 크기 (확장에 따라 커진다)
let roomW = 0;
let roomD = 0;
let entranceZ = 8;

// 고정 45°/35° 아이소메트릭 오프셋 — 카메라는 항상 target + 이 벡터에 놓인다.
const ISO_OFFSET = new THREE.Vector3(14, 13.5, 14);
const BASE_HALF_H = 9.5; // 기본 세로 프러스텀 (테이블이 시원하게 보이는 크기)
const MIN_HALF_W = 6.4; // 세로 화면에서도 최소한 이만큼의 가로 폭은 보이게
let frustumHalfHeight = BASE_HALF_H;

// ---------- 헬퍼: 카툰 재질 / 텍스처 / 아웃라인 ----------
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

// Fog 대신 공간감을 주는 배경 그라디언트
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

// 도형을 살짝 확대한 뒤집힌(backface) 검정 껍질을 덧씌워 카툰 외곽선을 만든다.
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

const sharedGeo = {
  tableTop: new THREE.CylinderGeometry(0.95, 0.95, 0.14, 28),
  tableRim: new THREE.TorusGeometry(0.95, 0.1, 10, 28),
  tableLeg: new THREE.CylinderGeometry(0.12, 0.18, 0.5, 10),
  tableBase: new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16),
  emptyRing: new THREE.RingGeometry(0.76, 0.98, 28),
  emptyPlus: new THREE.BoxGeometry(0.46, 0.04, 0.12),
  chip: new THREE.CylinderGeometry(0.26, 0.26, 0.07, 16),
  bottle: new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8),
};

function makePersonMesh(shirtColor, accentColor, withHat) {
  const group = new THREE.Group();
  const body = meshWO(new THREE.CapsuleGeometry(0.27, 0.42, 4, 8), shirtColor, 1.08);
  body.position.y = 0.5;
  const head = meshWO(new THREE.SphereGeometry(0.28, 14, 14), COLORS.skin, 1.07);
  head.position.y = 1.05;
  group.add(body, head);
  if (accentColor) {
    const accent = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 16), toonMat(accentColor));
    accent.rotation.x = Math.PI / 2;
    accent.position.y = 0.68;
    group.add(accent);
  }
  if (withHat) {
    const hat = meshWO(new THREE.ConeGeometry(0.2, 0.24, 12), 0x2a2436, 1.08);
    hat.position.y = 1.32;
    group.add(hat);
  }
  return group;
}

// 테이블 인덱스마다 결정론적으로 4~8명 사이 좌석 수를 정한다 (같은 테이블은 항상 같은 좌석 수).
function seatCountFor(index, seatsMin, seatsMax) {
  const range = Math.max(1, seatsMax - seatsMin + 1);
  const hash = (index * 2654435761) >>> 0;
  return seatsMin + (hash % range);
}

function makeTextSprite(text) {
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
  ctx.fillStyle = "#ff5c8a";
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

function buildTable({ index, dealer, feltColor, seatCount }) {
  const g = new THREE.Group();
  g.userData = { type: "table", index, coinTimer: (index % 7) * (COIN_POP_INTERVAL / 7) };
  const base = new THREE.Mesh(sharedGeo.tableBase, toonMat(COLORS.tableLeg));
  base.position.y = 0.03;
  base.castShadow = base.receiveShadow = true;
  const leg = new THREE.Mesh(sharedGeo.tableLeg, toonMat(COLORS.tableLeg));
  leg.position.y = 0.3;
  leg.castShadow = true;
  const top = meshWO(sharedGeo.tableTop, feltColor, 1.05);
  top.position.y = 0.58;
  const rim = new THREE.Mesh(sharedGeo.tableRim, toonMat(COLORS.tableRim));
  rim.position.y = 0.58;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  g.add(base, leg, top, rim);

  const hasDealer = !!dealer;
  if (hasDealer) {
    const look = DEALER_RARITY_LOOK[dealer.rarity] || DEALER_RARITY_LOOK.common;
    const person = makePersonMesh(look.suit, look.accent, true);
    person.position.set(1.35, 0, 0);
    person.rotation.y = -Math.PI / 2.4;
    person.scale.setScalar(0.82);
    g.add(person);
    // 전설 딜러는 발치에 은은한 빛을 깔아 한눈에 구분되게 한다
    if (dealer.rarity === "legendary" || dealer.rarity === "epic") {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: look.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(1.35, 0.03, 0);
      g.add(halo);
    }
  }

  // 테이블 하나에 4~8명이 둘러앉은 모습 (딜러 자리는 비워둠)
  const ringRadius = 1.4;
  for (let s = 0; s < seatCount; s++) {
    const angle = (s / seatCount) * Math.PI * 2 + Math.PI / seatCount;
    if (hasDealer && Math.cos(angle) > 0.6 && Math.abs(Math.sin(angle)) < 0.5) continue; // 딜러 쪽 자리 비우기
    const mat = seatMaterials.length ? seatMaterials[(index + s) % seatMaterials.length] : undefined;
    const seat = new THREE.Mesh(seatGeo, mat || toonMat(CUSTOMER_SHIRT_COLORS[s % CUSTOMER_SHIRT_COLORS.length]));
    const sx = Math.cos(angle) * ringRadius;
    const sz = Math.sin(angle) * ringRadius;
    seat.position.set(sx, 0.13, sz);
    seat.rotation.y = Math.atan2(-sx, -sz);
    seat.castShadow = true;
    g.add(seat);
  }

  return g;
}

function buildEmptySlot() {
  const g = new THREE.Group();
  g.userData = { type: "buyTable" };
  const ring = new THREE.Mesh(
    sharedGeo.emptyRing,
    new THREE.MeshBasicMaterial({ color: COLORS.emptySlot, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  const plusMat = new THREE.MeshBasicMaterial({ color: COLORS.emptySlot, transparent: true, opacity: 0.85 });
  const plusA = new THREE.Mesh(sharedGeo.emptyPlus, plusMat);
  const plusB = new THREE.Mesh(sharedGeo.emptyPlus, plusMat);
  plusB.rotation.y = Math.PI / 2;
  plusA.position.y = plusB.position.y = 0.05;
  g.add(plusA, plusB);
  return g;
}

// 테이블 격자를 매장 중앙에 맞춰 배치한다 (행/열 모두 가운데 정렬).
function gridPosition(i, cols, rows, spacing) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * spacing;
  const z = (row - (rows - 1) / 2) * spacing + ROOM_CENTER_Z;
  return [x, z];
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
  const body = meshWO(new RoundedBoxGeometry(0.7, 1.1, 0.5, 3, 0.1), 0xffcf6b, 1.06);
  body.position.y = 0.55;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff1de }));
  screen.position.set(0, 0.75, 0.26);
  g.add(body, screen);
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
  const curtain = meshWO(new RoundedBoxGeometry(1.3, 1.9, 0.14, 3, 0.15), 0x8a2b4a, 1.05);
  curtain.position.y = 0.95;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.16), toonMat(COLORS.emptySlot));
  trim.position.y = 1.85;
  g.add(curtain, trim);
  return g;
}

// 장식품은 레벨이 오를수록 개수가 늘어난다 (무한 업그레이드가 눈에 보이도록).
function placeDecorRow(builder, level, originX, y, z, stepX, maxShown) {
  const group = new THREE.Group();
  const count = Math.min(level, maxShown);
  for (let i = 0; i < count; i++) {
    const mesh = builder();
    mesh.position.set(originX + i * stepX, mesh.position.y + y, z);
    // 레벨이 높을수록 아주 살짝 커진다
    mesh.scale.setScalar(1 + Math.min(level, 20) * 0.012);
    group.add(mesh);
  }
  return group;
}

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

// 매장 크기(바닥/벽/전구)를 다시 만든다. 슬롯이 늘어나면 실제로 매장이 넓어진다.
function applyRoomSize(w, d) {
  if (w === roomW && d === roomD) return;
  roomW = w;
  roomD = d;
  const zBack = ROOM_CENTER_Z - d / 2;
  const zFront = ROOM_CENTER_Z + d / 2;
  entranceZ = zFront - 1.2;

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

  rebuildStringLights();
}

export function init(containerEl) {
  container = containerEl;
  if (!container) return;
  try {
    toonGradient = makeToonGradient();
    outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
    seatMaterials = CUSTOMER_SHIRT_COLORS.map((c) => toonMat(c));
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
    controls.enableRotate = false; // 고정 아이소메트릭 시점
    controls.enablePan = true; // 대신 드래그로 매장 안을 둘러본다
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
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 46;
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
    };
    scene.add(groups.tables, groups.fixtures, groups.staff, groups.decor, groups.bursts, groups.customers);

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

// 세로로 긴 화면에서는 가로 폭 기준으로 프러스텀을 키워서 매장이 잘려 보이지 않게 한다.
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
  if (moved > 10 || elapsed > 500) return; // 드래그/핀치는 탭으로 취급하지 않음

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
}

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
  } = snapshot;

  applyTheme(theme);
  currentPerTableIncome = perTableIncome;
  showCoinPops = showTableIncome;
  const feltPalette = (THEMES[theme] || THEMES.classic).felt;

  const shownCapacity = Math.min(capacity, maxShown);
  // 세로 화면 기준으로 4열까지만 가로로 늘어놓고, 나머지는 안쪽으로 줄을 늘린다.
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(shownCapacity))));
  const rows = Math.ceil(shownCapacity / cols);

  // 테이블 격자가 다 들어가도록 매장을 넓힌다 (통로 + 시설 공간 여유 포함)
  applyRoomSize(
    Math.max(ROOM_MIN_W, cols * TABLE_SPACING + 5),
    Math.max(ROOM_MIN_D, rows * TABLE_SPACING + 6)
  );

  const zBack = ROOM_CENTER_Z - roomD / 2;
  const halfW = roomW / 2;

  clearGroup(groups.tables);
  const newTableSlots = [];
  for (let i = 0; i < shownCapacity; i++) {
    const [x, z] = gridPosition(i, cols, rows, TABLE_SPACING);
    const dealer = i < tables ? assignedDealers[i] : null;
    const obj =
      i < tables
        ? buildTable({
            index: i,
            dealer,
            feltColor: feltPalette[i % feltPalette.length],
            seatCount: seatCountFor(i, seatsMin, seatsMax),
          })
        : buildEmptySlot();
    obj.position.x = x;
    obj.position.z = z;
    groups.tables.add(obj);
    if (i < tables) newTableSlots.push({ x, z, hasDealer: !!dealer });
  }
  tableSlots = newTableSlots;
  clearGroup(groups.customers);
  customers = [];

  // ---------- 시설 (뒷벽을 따라 배치) ----------
  clearGroup(groups.fixtures);
  const zWall = zBack + 1.2;
  const barX = -halfW + 3.2;
  const barGroup = new THREE.Group();
  barGroup.userData = { type: "fixture", id: "bar" };
  const bar = meshWO(new RoundedBoxGeometry(3.2, 0.9, 0.6, 3, 0.1), COLORS.bar, 1.04);
  bar.position.set(barX, 0.45, zWall);
  const barTrim = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.12, 0.62), toonMat(COLORS.barTrim));
  barTrim.position.set(barX, 0.85, zWall);
  barGroup.add(bar, barTrim);
  const barLevel = fixtures.bar || 0;
  for (let i = 0; i < Math.min(barLevel, 8); i++) {
    const bottle = new THREE.Mesh(sharedGeo.bottle, toonMat(i % 2 ? 0x5c3a21 : 0x2f6b4a));
    bottle.position.set(barX - 1.2 + i * 0.3, 1.1, zWall);
    bottle.castShadow = true;
    barGroup.add(bottle);
  }
  groups.fixtures.add(barGroup);
  if (staff.bartender > 0) {
    const bartender = makePersonMesh(COLORS.bartenderShirt, COLORS.bartenderAccent, false);
    bartender.position.set(barX, 0, zWall - 0.9);
    groups.fixtures.add(bartender);
  }

  const fridgeX = barX + 3.4;
  const fridgeGroup = new THREE.Group();
  fridgeGroup.userData = { type: "fixture", id: "fridge" };
  const fridge = meshWO(new RoundedBoxGeometry(0.8, 1.2, 0.7, 3, 0.1), COLORS.fridge, 1.05);
  fridge.position.set(fridgeX, 0.6, zWall);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.05), toonMat(COLORS.fridgeDoor));
  fridgeDoor.position.set(fridgeX, 0.65, zWall + 0.36);
  fridgeGroup.add(fridge, fridgeDoor);
  groups.fixtures.add(fridgeGroup);
  const fridgeLevel = fixtures.fridge || 0;
  if (fridgeLevel > 0) {
    const light = new THREE.PointLight(0xbdeeff, Math.min(fridgeLevel, 6) * 0.15, 2.5);
    light.position.set(fridgeX, 1.3, zWall);
    groups.fixtures.add(light);
  }

  const vaultX = halfW - 2.6;
  const vaultGroup = new THREE.Group();
  vaultGroup.userData = { type: "fixture", id: "vault" };
  const vault = meshWO(new RoundedBoxGeometry(0.9, 0.9, 0.8, 3, 0.08), COLORS.vault, 1.05);
  vault.position.set(vaultX, 0.45, zWall);
  const vaultRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), toonMat(COLORS.vaultTrim));
  vaultRing.position.set(vaultX, 0.5, zWall + 0.41);
  vaultGroup.add(vault, vaultRing);
  const vaultLevel = fixtures.vault || 0;
  for (let i = 0; i < Math.min(vaultLevel, 10); i++) {
    const chip = new THREE.Mesh(sharedGeo.chip, toonMat(COLORS.chip));
    chip.position.set(vaultX + (i % 2) * 0.5, 0.93 + Math.floor(i / 2) * 0.075, zWall + 0.6);
    chip.castShadow = true;
    vaultGroup.add(chip);
  }
  groups.fixtures.add(vaultGroup);

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
      const person = makePersonMesh(r.color, null, false);
      const angle = (idx / 10) * Math.PI * 2;
      person.position.set(Math.cos(angle) * (halfW - 1.5), 0, entranceZ - 2 + Math.sin(angle) * 1.8);
      person.userData.bobPhase = idx;
      groups.staff.add(person);
      idx++;
    }
  });

  // ---------- 장식품 (레벨이 오를수록 개수가 늘어난다) ----------
  clearGroup(groups.decor);
  const lv = (id) => decor[id] || 0;
  if (lv("plant")) groups.decor.add(placeDecorRow(buildPlant, lv("plant"), -halfW + 1, 0, ROOM_CENTER_Z - 2, 0, 1));
  if (lv("plant") > 1) groups.decor.add(placeDecorRow(buildPlant, lv("plant") - 1, -halfW + 1, 0, ROOM_CENTER_Z + 1.6, 0.9, 5));
  if (lv("neon")) groups.decor.add(placeDecorRow(buildNeon, lv("neon"), -2.5, 3.1, zBack + 0.12, 2.5, 3));
  if (lv("dart")) groups.decor.add(placeDecorRow(buildDartboard, lv("dart"), halfW - 3, 1.6, zBack + 0.12, -1.3, 4));
  if (lv("jukebox")) groups.decor.add(placeDecorRow(buildJukebox, lv("jukebox"), halfW - 1.2, 0, ROOM_CENTER_Z - 1, 0, 1));
  if (lv("chandelier")) groups.decor.add(placeDecorRow(buildChandelier, lv("chandelier"), -3, 5.2, ROOM_CENTER_Z, 3, 3));
  if (lv("vip")) groups.decor.add(placeDecorRow(buildVip, lv("vip"), -halfW + 1.2, 0, ROOM_CENTER_Z - 5, 0, 1));

  const note = document.getElementById("floor-note");
  if (note) {
    if (capacity > shownCapacity) {
      note.textContent = `+${capacity - shownCapacity}개 슬롯 더 있음`;
      note.hidden = false;
    } else if (tables >= capacity) {
      note.textContent = "매장이 가득 찼어요! 🏗 확장해보세요";
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
}

function spawnCustomer() {
  if (tableSlots.length === 0) return;
  const maxCustomers = Math.min(tableSlots.length * 2, 14);
  if (customers.length >= maxCustomers) return;

  const table = tableSlots[Math.floor(Math.random() * tableSlots.length)];
  const color = CUSTOMER_SHIRT_COLORS[Math.floor(Math.random() * CUSTOMER_SHIRT_COLORS.length)];
  const mesh = makePersonMesh(color, null, false);
  mesh.scale.setScalar(0.78 + Math.random() * 0.14);

  const entryX = (Math.random() - 0.5) * Math.min(10, roomW - 4);
  const entryPos = new THREE.Vector3(entryX, 0, entranceZ);
  mesh.position.copy(entryPos);

  const seatOffset = table.hasDealer ? -1.4 : 1.25;
  const seat = new THREE.Vector3(table.x + seatOffset, 0, table.z);

  groups.customers.add(mesh);
  customers.push({
    mesh,
    phase: "enter",
    target: seat,
    entryPos,
    sitTimer: 3 + Math.random() * 3,
    bobPhase: Math.random() * 10,
  });
}

function updateCustomers(dt, t) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnCustomer();
    spawnTimer = 1.4 + Math.random() * 2.2;
  }

  const walkSpeed = 2.4;
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i];
    const m = c.mesh;
    if (c.phase === "enter" || c.phase === "leave") {
      const dir = new THREE.Vector3().subVectors(c.target, m.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 0.15) {
        if (c.phase === "enter") {
          c.phase = "sit";
        } else {
          groups.customers.remove(m);
          customers.splice(i, 1);
          continue;
        }
      } else {
        dir.normalize();
        m.position.addScaledVector(dir, Math.min(walkSpeed * dt, dist));
        m.rotation.y = Math.atan2(dir.x, dir.z);
      }
      m.position.y = Math.abs(Math.sin(t * 7 + c.bobPhase)) * 0.06;
    } else if (c.phase === "sit") {
      c.sitTimer -= dt;
      m.position.y = 0;
      if (c.sitTimer <= 0) {
        c.phase = "leave";
        c.target = c.entryPos;
      }
    }
  }
}

export function chipBurst(colorHex) {
  if (!ready) return;
  const color = colorHex || COLORS.chip;
  const cx = controls.target.x;
  const cz = controls.target.z;
  for (let i = 0; i < 8; i++) {
    const mat = toonMat(color, { transparent: true });
    const chip = new THREE.Mesh(sharedGeo.chip, mat);
    chip.position.set(cx + (Math.random() - 0.5) * 2, 0.6, cz + (Math.random() - 0.5) * 2);
    chip.userData.life = 0.85;
    chip.userData.vy = 1.7 + Math.random();
    chip.userData.spin = (Math.random() - 0.5) * 6;
    groups.bursts.add(chip);
    bursts.push(chip);
  }
}

// 테이블 위에서 동전이 튀어오르며 벌어들인 금액을 보여주는 이펙트
function formatCoinAmount(n) {
  if (n < 10) return (Math.round(n * 10) / 10).toFixed(1);
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "만";
  return Math.round(n).toLocaleString("ko-KR");
}

function spawnTableCoin(tablePos, amount) {
  for (let i = 0; i < 2; i++) {
    const coin = new THREE.Mesh(sharedGeo.chip, toonMat(COLORS.chip, { transparent: true }));
    coin.position.set(tablePos.x + (Math.random() - 0.5) * 0.5, 0.75, tablePos.z + (Math.random() - 0.5) * 0.5);
    coin.userData.life = 0.9;
    coin.userData.vy = 1.4 + Math.random() * 0.4;
    coin.userData.spin = 5 + Math.random() * 3;
    groups.bursts.add(coin);
    bursts.push(coin);
  }
  const label = makeTextSprite(`+${formatCoinAmount(amount)}`);
  label.material.transparent = true;
  label.position.set(tablePos.x, 1.85, tablePos.z);
  label.userData.life = 1.2;
  label.userData.vy = 0.75;
  label.userData.spin = 0;
  groups.bursts.add(label);
  bursts.push(label);
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

// 드래그로 매장 밖까지 나가버리지 않도록 시점을 매장 안으로 가둔다.
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

  updateCustomers(dt, t);
  updateTableCoins(dt);

  for (let i = bursts.length - 1; i >= 0; i--) {
    const c = bursts[i];
    c.userData.life -= dt;
    c.position.y += c.userData.vy * dt;
    c.userData.vy -= dt * 3;
    c.rotation.y += c.userData.spin * dt;
    c.material.opacity = Math.max(0, c.userData.life);
    if (c.userData.life <= 0) {
      groups.bursts.remove(c);
      bursts.splice(i, 1);
    }
  }

  controls.update();
  clampCameraTarget();
  renderer.render(scene, camera);
}

window.PubScene3D = { init, update, chipBurst };

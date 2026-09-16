// PubScene3D: 홀덤펍을 귀여운 카툰(셀셰이딩) 스타일 3D 씬으로 렌더링한다.
// game.js(클래식 스크립트)가 window.PubScene3D를 통해 이 모듈과 통신한다.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 사이트 CSS 팔레트(--accent, --accent-2, --green 등)와 통일한 3D 색상
const COLORS = {
  sky: 0xffe3d1,
  fog: 0xffe3d1,
  floorBase: 0xf3c988,
  floorLine: 0xdba55f,
  wallBack: 0xffd3e6,
  wallSide: 0xffe6d5,
  wallTrim: 0xff8fab,
  tableFelt: 0x7bc67e,
  tableFeltDark: 0x5fa663,
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

const TABLE_FELT_COLORS = [0x7bc67e, 0xff9ec2, 0x6fc1ff, 0xffc85c, 0xd0a0ff, 0x8fe0c8];
const CUSTOMER_SHIRT_COLORS = [0xff8fab, 0xffc85c, 0x7bc67e, 0x6fc1ff, 0xd98cff, 0xffa8a8, 0xffe08a];
const ENTRANCE_Z = 6.2;

let scene, camera, renderer, controls, container, clock;
let groups = {};
let bursts = [];
let customers = [];
let tableSlots = [];
let spawnTimer = 1.5;
let ready = false;
let toonGradient;
let outlineMat;
let frustumHalfHeight = 9.6;

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

function makeFloorTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3c988";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(184,124,66,0.4)";
  ctx.lineWidth = 3;
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 3.5);
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
  tableTop: new THREE.CylinderGeometry(0.72, 0.72, 0.14, 24),
  tableRim: new THREE.TorusGeometry(0.72, 0.09, 10, 24),
  tableLeg: new THREE.CylinderGeometry(0.1, 0.16, 0.5, 10),
  tableBase: new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16),
  emptyRing: new THREE.RingGeometry(0.5, 0.7, 28),
  emptyPlus: new THREE.BoxGeometry(0.3, 0.04, 0.08),
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

function buildTable(hasDealer, feltColor) {
  const g = new THREE.Group();
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
  if (hasDealer) {
    const dealer = makePersonMesh(COLORS.dealerSuit, COLORS.dealerAccent, true);
    dealer.position.set(1.05, 0, 0);
    dealer.rotation.y = -Math.PI / 2.4;
    dealer.scale.setScalar(0.82);
    g.add(dealer);
  }
  return g;
}

function buildEmptySlot() {
  const g = new THREE.Group();
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

function gridPosition(i, cols, spacing) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * spacing;
  const z = row * spacing - 1.5;
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
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 0.8, 0.1, 3, 0.12),
    toonMat(0x3a2436)
  );
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff6fa5 })
  );
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
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xfff1de })
  );
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
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.lightWarm })
    );
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

function buildStringLights() {
  const g = new THREE.Group();
  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = (t - 0.5) * 18;
    const sag = Math.sin(t * Math.PI) * 0.4;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? COLORS.lightWarm : COLORS.lightPink })
    );
    bulb.position.set(x, 5.6 - sag, -7.85);
    g.add(bulb);
  }
  return g;
}

export function init(containerEl) {
  container = containerEl;
  if (!container) return;
  try {
    toonGradient = makeToonGradient();
    outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.fog, 18, 34);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    // 고정된 45°/35° 대각선 앵글 - 카이로소프트류 타이쿤 게임의 아이소메트릭 시점
    const isoOffset = new THREE.Vector3(14, 13.5, 14);
    const isoTarget = new THREE.Vector3(0, 0, -1);
    camera.position.copy(isoTarget).add(isoOffset);
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
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableRotate = false; // 고정 아이소메트릭 시점 - 회전 대신 확대/축소만 허용
    controls.minZoom = 0.65;
    controls.maxZoom = 1.8;
    controls.target.copy(isoTarget);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xfff0e0, 0xd9a35f, 0.85));
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.0);
    sun.position.set(6, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.bias = -0.002;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffd7ea, 0.25);
    fill.position.set(-6, 6, -4);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 14),
      toonMat(COLORS.floorBase, { map: makeFloorTexture() })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -1;
    floor.receiveShadow = true;
    scene.add(floor);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), toonMat(COLORS.wallBack));
    backWall.position.set(0, 3, -8);
    backWall.receiveShadow = true;
    scene.add(backWall);
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.05), toonMat(COLORS.wallTrim));
    backTrim.position.set(0, 1.1, -7.97);
    scene.add(backTrim);

    const sideWallGeo = new THREE.PlaneGeometry(14, 6);
    const sideWallMat = toonMat(COLORS.wallSide);
    const leftWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-10, 3, -1);
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(10, 3, -1);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    scene.add(buildStringLights());

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
    animate();
  } catch (err) {
    console.error("[PubScene3D] init failed", err);
    container.innerHTML =
      '<div style="padding:24px;text-align:center;color:#9b8b7f;font-size:13px;">이 브라우저는 3D 미리보기를 지원하지 않아요.<br/>게임 진행에는 문제없어요!</div>';
  }
}

function applyFrustum(aspect) {
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

export function update(snapshot) {
  if (!ready) return;
  const { tables, capacity, maxShown, fixtures, staff, decor } = snapshot;

  clearGroup(groups.tables);
  const shownCapacity = Math.min(capacity, maxShown);
  const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(shownCapacity * 1.6))));
  const newTableSlots = [];
  for (let i = 0; i < shownCapacity; i++) {
    const [x, z] = gridPosition(i, cols, 1.9);
    const hasDealer = i < staff.dealer;
    const obj = i < tables ? buildTable(hasDealer, TABLE_FELT_COLORS[i % TABLE_FELT_COLORS.length]) : buildEmptySlot();
    obj.position.x = x;
    obj.position.z = z;
    groups.tables.add(obj);
    if (i < tables) newTableSlots.push({ x, z, hasDealer });
  }
  tableSlots = newTableSlots;
  clearGroup(groups.customers);
  customers = [];

  clearGroup(groups.fixtures);
  const bar = meshWO(new RoundedBoxGeometry(3.2, 0.9, 0.6, 3, 0.1), COLORS.bar, 1.04);
  bar.position.set(-6.2, 0.45, -6.8);
  const barTrim = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.12, 0.62), toonMat(COLORS.barTrim));
  barTrim.position.set(-6.2, 0.85, -6.8);
  groups.fixtures.add(bar, barTrim);
  const barLevel = fixtures.bar || 0;
  for (let i = 0; i < Math.min(barLevel, 5); i++) {
    const bottle = new THREE.Mesh(sharedGeo.bottle, toonMat(0x5c3a21));
    bottle.position.set(-7.3 + i * 0.28, 1.1, -6.8);
    bottle.castShadow = true;
    groups.fixtures.add(bottle);
  }
  if (staff.bartender > 0) {
    const bartender = makePersonMesh(COLORS.bartenderShirt, COLORS.bartenderAccent, false);
    bartender.position.set(-6.2, 0, -7.6);
    groups.fixtures.add(bartender);
  }

  const fridge = meshWO(new RoundedBoxGeometry(0.8, 1.2, 0.7, 3, 0.1), COLORS.fridge, 1.05);
  fridge.position.set(-3.6, 0.6, -7.2);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.05), toonMat(COLORS.fridgeDoor));
  fridgeDoor.position.set(-3.6, 0.65, -6.84);
  groups.fixtures.add(fridge, fridgeDoor);
  const fridgeLevel = fixtures.fridge || 0;
  if (fridgeLevel > 0) {
    const light = new THREE.PointLight(0xbdeeff, Math.min(fridgeLevel, 5) * 0.15, 2.5);
    light.position.set(-3.6, 1.3, -7.2);
    groups.fixtures.add(light);
  }

  const vault = meshWO(new RoundedBoxGeometry(0.9, 0.9, 0.8, 3, 0.08), COLORS.vault, 1.05);
  vault.position.set(6.2, 0.45, -7.2);
  const vaultRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), toonMat(COLORS.vaultTrim));
  vaultRing.position.set(6.2, 0.5, -6.79);
  groups.fixtures.add(vault, vaultRing);
  const vaultLevel = fixtures.vault || 0;
  for (let i = 0; i < Math.min(vaultLevel, 6); i++) {
    const chip = new THREE.Mesh(sharedGeo.chip, toonMat(COLORS.chip));
    chip.position.set(6.2, 0.93 + i * 0.075, -6.6);
    chip.castShadow = true;
    groups.fixtures.add(chip);
  }

  clearGroup(groups.staff);
  const roamDefs = [
    { id: "server", color: COLORS.serverShirt },
    { id: "marketer", color: COLORS.marketerShirt },
  ];
  let idx = 0;
  roamDefs.forEach((r) => {
    const count = Math.min(staff[r.id] || 0, 6);
    for (let i = 0; i < count; i++) {
      const person = makePersonMesh(r.color, null, false);
      const angle = (idx / 12) * Math.PI * 2;
      person.position.set(Math.cos(angle) * 8, 0, 2.5 + Math.sin(angle) * 1.5);
      person.userData.bobPhase = idx;
      groups.staff.add(person);
      idx++;
    }
  });

  clearGroup(groups.decor);
  const place = (mesh, x, y, z) => {
    mesh.position.set(x, mesh.position.y + y, z);
    groups.decor.add(mesh);
  };
  if (decor.plant) place(buildPlant(), -8.5, 0, -2);
  if (decor.neon) place(buildNeon(), 0, 2.6, -7.9);
  if (decor.dart) place(buildDartboard(), 8.5, 1.6, -7.9);
  if (decor.jukebox) place(buildJukebox(), 8.5, 0, -4);
  if (decor.chandelier) place(buildChandelier(), 0, 4.2, -2);
  if (decor.vip) place(buildVip(), -8.5, 0, -6);

  const note = document.getElementById("floor-note");
  if (note) {
    if (capacity > shownCapacity) {
      note.textContent = `+${capacity - shownCapacity}개 테이블 슬롯 더 있음`;
      note.style.display = "";
    } else if (tables >= capacity) {
      note.textContent = "매장이 가득 찼어요! 매장 탭에서 확장해보세요 🏗";
      note.style.display = "";
    } else {
      note.style.display = "none";
    }
  }
}

function spawnCustomer() {
  if (tableSlots.length === 0) return;
  const maxCustomers = Math.min(tableSlots.length * 2, 10);
  if (customers.length >= maxCustomers) return;

  const table = tableSlots[Math.floor(Math.random() * tableSlots.length)];
  const color = CUSTOMER_SHIRT_COLORS[Math.floor(Math.random() * CUSTOMER_SHIRT_COLORS.length)];
  const mesh = makePersonMesh(color, null, false);
  mesh.scale.setScalar(0.78 + Math.random() * 0.14);

  const entryX = (Math.random() - 0.5) * 6;
  const entryPos = new THREE.Vector3(entryX, 0, ENTRANCE_Z);
  mesh.position.copy(entryPos);

  const seatOffset = table.hasDealer ? -1.05 : 0.95;
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

export function chipBurst() {
  if (!ready) return;
  for (let i = 0; i < 6; i++) {
    const mat = toonMat(COLORS.chip, { transparent: true });
    const chip = new THREE.Mesh(sharedGeo.chip, mat);
    chip.position.set((Math.random() - 0.5) * 1.5, 0.6, 1.5 + (Math.random() - 0.5) * 1.5);
    chip.userData.life = 0.8;
    chip.userData.vy = 1.7 + Math.random();
    chip.userData.spin = (Math.random() - 0.5) * 6;
    groups.bursts.add(chip);
    bursts.push(chip);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  groups.staff.children.forEach((p) => {
    p.position.y = Math.sin(t * 2 + (p.userData.bobPhase || 0)) * 0.05 + 0.02;
  });

  updateCustomers(dt, t);

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
  renderer.render(scene, camera);
}

window.PubScene3D = { init, update, chipBurst };

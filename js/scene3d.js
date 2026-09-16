// PubScene3D: 홀덤펍을 3D로 렌더링하는 모듈.
// game.js(클래식 스크립트)가 window.PubScene3D를 통해 이 모듈과 통신한다.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLORS = {
  floor: 0xd9a86c,
  wallBack: 0xffd9e8,
  wallSide: 0xffe3ce,
  tableFelt: 0x3f9a5c,
  tableLeg: 0x6b4a34,
  emptySlot: 0xe0c290,
  bar: 0x8a5a3b,
  fridge: 0xdff3ff,
  vault: 0x5a5a6a,
  chip: 0xffc94d,
  dealerSuit: 0x2b2b3a,
  bartenderShirt: 0xffffff,
  serverShirt: 0xf2b26b,
  marketerShirt: 0x5cb1ff,
  skin: 0xffd8b0,
};

let scene, camera, renderer, controls, container, clock;
let groups = {};
let bursts = [];
let ready = false;

const sharedGeo = {
  tableTop: new THREE.CylinderGeometry(0.75, 0.75, 0.12, 20),
  tableLeg: new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8),
  emptyRing: new THREE.RingGeometry(0.55, 0.75, 24),
  chip: new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16),
  bottle: new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8),
  barBox: new THREE.BoxGeometry(3.2, 0.9, 0.6),
  fridgeBox: new THREE.BoxGeometry(0.8, 1.2, 0.7),
  vaultBox: new THREE.BoxGeometry(0.9, 0.9, 0.8),
};

function makePersonMesh(shirtColor, withHat) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.5, 4, 8),
    new THREE.MeshLambertMaterial({ color: shirtColor })
  );
  body.position.y = 0.55;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshLambertMaterial({ color: COLORS.skin })
  );
  head.position.y = 1.05;
  group.add(body, head);
  if (withHat) {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.22, 12),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    hat.position.y = 1.28;
    group.add(hat);
  }
  return group;
}

function buildTable(hasDealer) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(sharedGeo.tableTop, new THREE.MeshLambertMaterial({ color: COLORS.tableFelt }));
  top.position.y = 0.55;
  const leg = new THREE.Mesh(sharedGeo.tableLeg, new THREE.MeshLambertMaterial({ color: COLORS.tableLeg }));
  leg.position.y = 0.27;
  g.add(top, leg);
  if (hasDealer) {
    const dealer = makePersonMesh(COLORS.dealerSuit, true);
    dealer.position.set(0.9, 0, 0);
    dealer.scale.setScalar(0.85);
    g.add(dealer);
  }
  return g;
}

function buildEmptySlot() {
  const ring = new THREE.Mesh(
    sharedGeo.emptyRing,
    new THREE.MeshBasicMaterial({ color: COLORS.emptySlot, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
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
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0xa5643a }));
  pot.position.y = 0.2;
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshLambertMaterial({ color: 0x5fae5f }));
  leaves.position.y = 0.75;
  g.add(pot, leaves);
  return g;
}

function buildNeon() {
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ color: 0xff6fa5 }));
}

function buildDartboard() {
  return new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshLambertMaterial({ color: 0xd94848 }));
}

function buildJukebox() {
  return new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), new THREE.MeshLambertMaterial({ color: 0xffcf6b }));
}

function buildChandelier() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 16), new THREE.MeshLambertMaterial({ color: 0xffe08a }));
  ring.rotation.x = Math.PI / 2;
  const light = new THREE.PointLight(0xffe9b0, 0.6, 5);
  g.add(ring, light);
  return g;
}

function buildVip() {
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.15), new THREE.MeshLambertMaterial({ color: 0x8a2b4a }));
  curtain.position.y = 1;
  return curtain;
}

export function init(containerEl) {
  container = containerEl;
  if (!container) return;
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfff1de);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 300;
    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 10, 15);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 22;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, -1);
    controls.update();

    scene.add(new THREE.AmbientLight(0xfff4e6, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 6);
    scene.add(dir);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshLambertMaterial({ color: COLORS.floor }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -1;
    scene.add(floor);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), new THREE.MeshLambertMaterial({ color: COLORS.wallBack }));
    backWall.position.set(0, 3, -8);
    scene.add(backWall);

    const sideWallGeo = new THREE.PlaneGeometry(14, 6);
    const sideWallMat = new THREE.MeshLambertMaterial({ color: COLORS.wallSide });
    const leftWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-10, 3, -1);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(10, 3, -1);
    scene.add(rightWall);

    groups = {
      tables: new THREE.Group(),
      fixtures: new THREE.Group(),
      staff: new THREE.Group(),
      decor: new THREE.Group(),
      bursts: new THREE.Group(),
    };
    scene.add(groups.tables, groups.fixtures, groups.staff, groups.decor, groups.bursts);

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

function onResize() {
  if (!ready || !container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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
  for (let i = 0; i < shownCapacity; i++) {
    const [x, z] = gridPosition(i, cols, 1.9);
    const obj = i < tables ? buildTable(i < staff.dealer) : buildEmptySlot();
    obj.position.x = x;
    obj.position.z = z;
    groups.tables.add(obj);
  }

  clearGroup(groups.fixtures);
  const bar = new THREE.Mesh(sharedGeo.barBox, new THREE.MeshLambertMaterial({ color: COLORS.bar }));
  bar.position.set(-6.2, 0.45, -6.8);
  groups.fixtures.add(bar);
  const barLevel = fixtures.bar || 0;
  for (let i = 0; i < Math.min(barLevel, 5); i++) {
    const bottle = new THREE.Mesh(sharedGeo.bottle, new THREE.MeshLambertMaterial({ color: 0x5c3a21 }));
    bottle.position.set(-7.3 + i * 0.28, 1.1, -6.8);
    groups.fixtures.add(bottle);
  }
  if (staff.bartender > 0) {
    const bartender = makePersonMesh(COLORS.bartenderShirt, false);
    bartender.position.set(-6.2, 0, -7.6);
    groups.fixtures.add(bartender);
  }

  const fridge = new THREE.Mesh(sharedGeo.fridgeBox, new THREE.MeshLambertMaterial({ color: COLORS.fridge }));
  fridge.position.set(-3.6, 0.6, -7.2);
  groups.fixtures.add(fridge);
  const fridgeLevel = fixtures.fridge || 0;
  if (fridgeLevel > 0) {
    const light = new THREE.PointLight(0xbdeeff, Math.min(fridgeLevel, 5) * 0.15, 2);
    light.position.set(-3.6, 1.3, -7.2);
    groups.fixtures.add(light);
  }

  const vault = new THREE.Mesh(sharedGeo.vaultBox, new THREE.MeshLambertMaterial({ color: COLORS.vault }));
  vault.position.set(6.2, 0.45, -7.2);
  groups.fixtures.add(vault);
  const vaultLevel = fixtures.vault || 0;
  for (let i = 0; i < Math.min(vaultLevel, 6); i++) {
    const chip = new THREE.Mesh(sharedGeo.chip, new THREE.MeshLambertMaterial({ color: COLORS.chip }));
    chip.position.set(6.2, 0.93 + i * 0.07, -6.6);
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
      const person = makePersonMesh(r.color, false);
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
  if (decor.jukebox) place(buildJukebox(), 8.5, 0.55, -4);
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

export function chipBurst() {
  if (!ready) return;
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.chip, transparent: true });
    const chip = new THREE.Mesh(sharedGeo.chip, mat);
    chip.position.set((Math.random() - 0.5) * 1.5, 0.6, 1.5 + (Math.random() - 0.5) * 1.5);
    chip.userData.life = 0.8;
    chip.userData.vy = 1.6 + Math.random();
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

  for (let i = bursts.length - 1; i >= 0; i--) {
    const c = bursts[i];
    c.userData.life -= dt;
    c.position.y += c.userData.vy * dt;
    c.userData.vy -= dt * 3;
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

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';

// 3つのレーン（タワー）の定義。左から 百・十・一
// （100のプレートが入るようタワーは太め・間隔広め）
export const LANES = [
  { x: -5.6, value: 100, label: '百', color: 0xf59e0b },
  { x: 0, value: 10, label: '十', color: 0x10b981 },
  { x: 5.6, value: 1, label: '一', color: 0x3b82f6 },
];

export const TOWER_HEIGHT = 7;
export const TOWER_RADIUS = 2.5;
export const SPAWN_Y = 40; // はるか上空から降ってくる
export const BIN_X = 8.8;  // ゴミ箱（シュレッダー）の位置（±）

const font = new FontLoader().parse(helvetikerBold);

// 光る台座の上にフローティングする立体数字
function createPedestal(lane) {
  const group = new THREE.Group();
  group.position.set(lane.x, 0, 4.6);

  // 光る円盤（台座）
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.55, 0.28, 32),
    new THREE.MeshStandardMaterial({
      color: lane.color,
      roughness: 0.3,
      emissive: lane.color,
      emissiveIntensity: 0.55,
    })
  );
  disc.position.y = 0.14;
  group.add(disc);

  // 円盤のまわりで脈打つ光のリング
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.07, 10, 40),
    new THREE.MeshBasicMaterial({
      color: lane.color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);

  // 立体数字（100 / 10 / 1）
  const geo = new TextGeometry(String(lane.value), {
    font,
    size: 0.95,
    depth: 0.28,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, 0, -(bb.max.z + bb.min.z) / 2);
  const number = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      emissive: lane.color,
      emissiveIntensity: 0.35,
    })
  );
  number.position.y = 0.9;
  group.add(number);

  return { group, number, ring, baseY: 0.9, phase: Math.random() * Math.PI * 2 };
}

// ゴミ箱ラベルのスプライト
function makeBinLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 56px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2e1065';
  ctx.strokeText('ゴミばこ', 128, 48);
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText('ゴミばこ', 128, 48);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sprite.scale.set(2.6, 1.0, 1);
  return sprite;
}

// ブラックホール風のゴミ箱（不要ブロックを吸い込むシュレッダー）
function createBin(x) {
  const group = new THREE.Group();
  group.position.set(x, 0, 2.5);

  // 暗い台座
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.7, 0.3, 32),
    new THREE.MeshStandardMaterial({
      color: 0x2e1065,
      roughness: 0.4,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.25,
    })
  );
  disc.position.y = 0.15;
  group.add(disc);

  // まんなかの「黒い穴」
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 32),
    new THREE.MeshBasicMaterial({ color: 0x0b0416 })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.31;
  group.add(hole);

  // 吸い込みの光（紫の脈打つリング）
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.09, 10, 40),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  group.add(ring);

  // ラベル
  const label = makeBinLabel();
  label.position.y = 1.6;
  group.add(label);

  return { group, ring, label, phase: x > 0 ? Math.PI : 0 };
}

// タワーを作る。揺らす演出のためレーンごとに Group にまとめて返す
export function createTowers(scene) {
  const towerGroups = [];
  const pedestals = [];

  for (const lane of LANES) {
    const group = new THREE.Group();
    group.position.x = lane.x;
    group.userData.baseX = lane.x;

    // 透明な円柱タワー
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, TOWER_HEIGHT, 32, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: lane.color,
        transparent: true,
        opacity: 0.16,
        roughness: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    body.position.y = TOWER_HEIGHT / 2;
    group.add(body);

    // タワー上部のリング（入り口の目印）
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(TOWER_RADIUS, 0.09, 12, 48),
      new THREE.MeshStandardMaterial({ color: lane.color, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TOWER_HEIGHT;
    group.add(rim);

    // 土台
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS + 0.4, TOWER_RADIUS + 0.6, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: lane.color, roughness: 0.5 })
    );
    base.position.y = 0.15;
    group.add(base);

    scene.add(group);
    towerGroups.push(group);

    // 手前の光る台座＋フローティング数字
    const pedestal = createPedestal(lane);
    scene.add(pedestal.group);
    pedestals.push(pedestal);
  }

  // 両はしのゴミ箱（ブラックホール風シュレッダー）
  const bins = [];
  for (const x of [-BIN_X, BIN_X]) {
    const bin = createBin(x);
    scene.add(bin.group);
    bins.push(bin);
  }

  // 地面（一人称視点なので地平線まで広く）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0xd9f0d0, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 雲（高度感の目印。落下ブロックが雲を突き抜けて降りてくる）
  // 陰影を付けず常に白く見せる（ライティングだと灰色の雨雲に見えてしまう）
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.4, 12, 10), cloudMat);
      puff.position.set((j - puffs / 2) * 2.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(
      (Math.random() - 0.5) * 70,
      22 + Math.random() * 12,
      -25 + Math.random() * 20
    );
    scene.add(cloud);
  }

  // 台座・ゴミ箱のアニメーション（数字の浮遊、リングの脈動、吸い込みの渦）
  function tick(time) {
    for (const p of pedestals) {
      p.number.position.y = p.baseY + Math.sin(time * 1.8 + p.phase) * 0.18;
      p.number.rotation.y = Math.sin(time * 0.9 + p.phase) * 0.25;
      p.ring.material.opacity = 0.45 + 0.3 * Math.sin(time * 3 + p.phase);
      const s = 1 + 0.05 * Math.sin(time * 3 + p.phase);
      p.ring.scale.set(s, s, 1);
    }
    for (const bin of bins) {
      // 吸い込まれるように縮んで戻るリング
      const k = 1 - ((time * 0.7 + bin.phase) % 1) * 0.35;
      bin.ring.scale.set(k, k, 1);
      bin.ring.material.opacity = 0.3 + 0.5 * k;
      bin.label.position.y = 1.6 + Math.sin(time * 2 + bin.phase) * 0.12;
    }
  }

  return { towerGroups, tick };
}

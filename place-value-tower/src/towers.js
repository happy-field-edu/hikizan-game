import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';

// 3つのレーン（タワー）の定義。左から 百・十・一
// （100のプレートが入るようタワーは太め・間隔広め）
export const LANES = [
  { x: -5.6, value: 100, label: '百のくらい', kana: 'ひゃく の くらい', color: 0xf59e0b },
  { x: 0, value: 10, label: '十のくらい', kana: 'じゅう の くらい', color: 0x10b981 },
  { x: 5.6, value: 1, label: '一のくらい', kana: 'いち の くらい', color: 0x3b82f6 },
];

export const TOWER_HEIGHT = 7;
export const TOWER_RADIUS = 2.5;
export const SPAWN_Y = 40; // はるか上空から降ってくる
export const BIN_X = 11.6; // ゴミ箱の初期位置（±）。画面幅に応じて main.js が端へ再配置する
export const BIN_Z = 2.5;  // ゴミ箱の奥行き位置

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
  ctx.strokeText('すてる', 128, 38);
  ctx.strokeText('ばしょ', 128, 76);
  ctx.fillStyle = '#f5d0fe';
  ctx.fillText('すてる', 128, 38);
  ctx.fillText('ばしょ', 128, 76);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sprite.scale.set(2.6, 1.0, 1);
  return sprite;
}

// 中心へ渦巻くブラックホールのテクスチャ（回転アニメで吸い込み感を出す）
function makeSwirlTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // 中心の闇 → 紫 → ネオンピンクのグラデーション
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 128);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.24, '#05020c');
  grad.addColorStop(0.48, '#33106b');
  grad.addColorStop(0.74, '#7c3aed');
  grad.addColorStop(0.9, '#e879f9');
  grad.addColorStop(1, '#22d3ee');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // 渦の腕（明るい筋と暗い筋を4本ずつ）
  for (let arm = 0; arm < 4; arm++) {
    for (const [color, width, offset] of [
      ['rgba(255,190,255,0.85)', 6, 0],
      ['rgba(34,211,238,0.55)', 4, 0.25],
      ['rgba(10,0,30,0.62)', 9, 0.58],
    ]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.04) {
        const r = 10 + t * 112;
        const a = arm * ((Math.PI * 2) / 4) + offset + t * Math.PI * 2.7;
        const px = 128 + Math.cos(a) * r;
        const py = 128 + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.center.set(0.5, 0.5); // 回転アニメ用
  return tex;
}

// ネオンのハロー（ふわっと広がる光）
function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(236,72,153,0.55)');
  grad.addColorStop(0.5, 'rgba(124,58,237,0.3)');
  grad.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createOrbitDust() {
  const count = 90;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.8 + Math.random() * 1.55;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.16;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xf0abfc,
      size: 0.075,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  return dust;
}

// ブラックホール風のゴミ箱（不要ブロックを吸い込むシュレッダー）
function createBin(x) {
  const group = new THREE.Group();
  group.position.set(x, 0, BIN_Z);

  // 渦の面はプレイヤー側に傾けて、低い視点からでも吸い込み口が見えるようにする
  const face = new THREE.Group();
  face.rotation.x = 0.55; // 上面（渦）がカメラ側を向くように傾ける
  face.position.y = 0.55;
  group.add(face);

  // 暗い台座
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.25, 32),
    new THREE.MeshStandardMaterial({
      color: 0x140322,
      roughness: 0.4,
      emissive: 0x9333ea,
      emissiveIntensity: 0.35,
    })
  );
  disc.position.y = 0;
  face.add(disc);

  // 地面ににじむネオンのハロー
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 32),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  group.add(halo);

  // 渦巻く吸い込み口（テクスチャをゆっくり回転させる）
  const swirlTex = makeSwirlTexture();
  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 32),
    new THREE.MeshBasicMaterial({ map: swirlTex })
  );
  swirl.rotation.x = -Math.PI / 2;
  swirl.position.y = 0.16;
  face.add(swirl);

  // 二重のネオンリング（ピンクと紫が交互に吸い込まれるように収縮）
  const makeRing = (radius, tube, color, y) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    face.add(ring);
    return ring;
  };
  const ring1 = makeRing(1.6, 0.07, 0xff2fb3, 0.24);
  const ring2 = makeRing(1.25, 0.055, 0x8b5cf6, 0.3);
  const ring3 = makeRing(1.95, 0.045, 0x22d3ee, 0.2);
  ring3.rotation.z = 0.6;

  const dust = createOrbitDust();
  dust.position.y = 0.32;
  face.add(dust);

  // ラベル
  const label = makeBinLabel();
  label.position.x = x < 0 ? 1.05 : -1.05;
  label.position.y = 1.7;
  group.add(label);

  return { group, swirlTex, ring1, ring2, ring3, dust, label, phase: x > 0 ? Math.PI : 0 };
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
      // 渦がゆっくり回転して吸い込まれそうに見える
      bin.swirlTex.rotation = -time * 1.6;
      // 二重のネオンリングが交互に中心へ吸い込まれるように収縮
      const k1 = 1 - ((time * 0.8 + bin.phase) % 1);
      bin.ring1.scale.set(0.7 + 0.45 * k1, 0.7 + 0.45 * k1, 1);
      bin.ring1.material.opacity = 0.15 + 0.65 * k1;
      const k2 = 1 - ((time * 0.8 + 0.5 + bin.phase) % 1);
      bin.ring2.scale.set(0.7 + 0.45 * k2, 0.7 + 0.45 * k2, 1);
      bin.ring2.material.opacity = 0.15 + 0.65 * k2;
      bin.ring3.rotation.z = time * 0.7 + bin.phase;
      bin.ring3.material.opacity = 0.35 + 0.35 * Math.sin(time * 2.4 + bin.phase);
      bin.dust.rotation.y = -time * 1.9 + bin.phase;
      bin.dust.rotation.z = Math.sin(time * 1.2 + bin.phase) * 0.25;
      bin.label.position.y = 1.7 + Math.sin(time * 2 + bin.phase) * 0.12;
    }
  }

  return { towerGroups, bins, tick };
}

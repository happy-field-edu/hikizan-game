import * as THREE from 'three';

export const BLOCK_COLORS = { 100: 0xf59e0b, 10: 0x10b981, 1: 0x3b82f6 };

// 数字ラベル（スプライト）を作る
function makeLabelSprite(text, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 88px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
  ctx.strokeText(text, 128, 68);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 68);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false })
  );
  sprite.scale.set(2.2, 1.1, 1);
  return sprite;
}

// 「1」: 小さな立方体
function buildOne(group) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshStandardMaterial({
      color: BLOCK_COLORS[1], roughness: 0.35,
      emissive: BLOCK_COLORS[1], emissiveIntensity: 0.12,
    })
  );
  group.add(mesh);
  return 0.55 / 2;
}

// 「10」: 1のキューブが縦に10個カチッと繋がった棒（節目の線入り）
const ROD_LEN = 4.2;
const ROD_W = 0.4;
function buildTen(group) {
  const mat = new THREE.MeshStandardMaterial({
    color: BLOCK_COLORS[10], roughness: 0.35,
    emissive: BLOCK_COLORS[10], emissiveIntensity: 0.12,
  });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(ROD_W, ROD_LEN, ROD_W), mat));
  // 10個のキューブの継ぎ目（濃い色の薄い帯を9本）
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.5 });
  const seamGeo = new THREE.BoxGeometry(ROD_W + 0.02, 0.035, ROD_W + 0.02);
  for (let i = 1; i < 10; i++) {
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.position.y = -ROD_LEN / 2 + (ROD_LEN / 10) * i;
    group.add(seam);
  }
  return ROD_LEN / 2;
}

// 「100」: 10の棒が10本合体した、10×10マスの平たいプレート
const PLATE_W = 3.4;
const PLATE_H = 0.34;

function gridTexture(cells, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c2710c';
  ctx.lineWidth = 5;
  for (let i = 0; i <= cells; i++) {
    const x = (w / cells) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    if (h > 100) { // 正方形の面だけ横線も引く（側面は縦線のみ）
      const y = (h / cells) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function buildHundred(group) {
  const topMat = new THREE.MeshStandardMaterial({ map: gridTexture(10, 512, 512), roughness: 0.4 });
  const sideMat = new THREE.MeshStandardMaterial({ map: gridTexture(10, 512, 64), roughness: 0.4 });
  // BoxGeometry の面の順序: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_W),
    [sideMat, sideMat, topMat, topMat, sideMat, sideMat]
  );
  group.add(mesh);
  return PLATE_H / 2;
}

// 落下ブロック（本体メッシュ群 + 数字ラベル）を作る
export function createBlock(value) {
  const group = new THREE.Group();
  const halfH = value === 100 ? buildHundred(group) : value === 10 ? buildTen(group) : buildOne(group);

  const label = makeLabelSprite(String(value), BLOCK_COLORS[value]);
  label.position.y = halfH + 0.9;
  group.add(label);

  group.userData.value = value;
  group.userData.halfH = halfH;
  group.userData.label = label;
  return group;
}

// ブロックのリソースを解放して scene から除去する
export function removeBlock(scene, block) {
  block.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
  scene.remove(block);
}

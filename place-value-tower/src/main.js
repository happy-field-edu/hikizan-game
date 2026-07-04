import * as THREE from 'three';
import { createTowers, BIN_Z } from './towers.js';
import { Effects } from './effects.js';
import { Monster } from './monster.js';
import { Game, setBinsX } from './game.js';

// --- シーン・カメラ・レンダラー ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 60, 200);

// 平地に立つ一人称視点: 目線の高さから、少し空を見上げるアングル
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 300);
const cameraBase = new THREE.Vector3(0, 1.7, 18.5);

// 縦長画面では左右のタワー・台座が切れないよう視野角を広げる
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1.05 ? Math.min(80, 62 / aspect * 0.95) : 62;
  camera.updateProjectionMatrix();
}
fitCamera();
camera.position.copy(cameraBase);
camera.lookAt(0, 9, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- ライト ---
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(6, 12, 8);
scene.add(sun);

// --- タワー・エフェクト・ゲーム ---
const { towerGroups, bins, tick: tickPedestals } = createTowers(scene);
const effects = new Effects(scene, towerGroups);
const monster = new Monster(scene);
const game = new Game(scene, effects, monster);

// ゴミ箱（ブラックホール）を、いま見えている画面のいちばん端に配置する
// （タワーから離して誤操作を防ぐ。横長画面ほど遠くへ）
function layoutBins() {
  const dist = cameraBase.z - BIN_Z;
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * camera.aspect;
  const binX = Math.min(14.2, Math.max(10.8, halfW - 1.05));
  bins[0].group.position.x = -binX;
  bins[1].group.position.x = binX;
  setBinsX(binX);
}
layoutBins();
window.__game = game; // デバッグ・動作確認用
window.__fx = effects;
window.__monster = monster;
window.__render = () => renderer.render(scene, camera); // rAF停止中でも描画確認できるように

// --- 操作: 左右矢印キー ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') game.moveLane(-1);
  if (e.key === 'ArrowRight') game.moveLane(1);
});

// --- 操作: ドラッグ（画面を横5分割: 両はしは「すてゾーン」） ---
let dragging = false;
function pointerToSlot(clientX) {
  const ratio = clientX / window.innerWidth;
  return Math.min(4, Math.max(0, Math.floor(ratio * 5)));
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  game.setSlot(pointerToSlot(e.clientX));
});
window.addEventListener('pointermove', (e) => {
  if (dragging) game.setSlot(pointerToSlot(e.clientX));
});
window.addEventListener('pointerup', () => (dragging = false));

// --- リサイズ ---
window.addEventListener('resize', () => {
  fitCamera();
  layoutBins();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- メインループ ---
const clock = new THREE.Clock();
const shakeOffset = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  game.update(dt);
  monster.update(dt);
  tickPedestals(clock.elapsedTime);
  effects.update(dt, shakeOffset);
  camera.position.copy(cameraBase).add(shakeOffset);

  renderer.render(scene, camera);
}
animate();

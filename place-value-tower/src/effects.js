import * as THREE from 'three';
import { removeBlock } from './blocks.js';
import { BIN_Z } from './towers.js';

const CONFETTI_COLORS = [0xf43f5e, 0xf59e0b, 0xfde047, 0x22c55e, 0x3b82f6, 0xa855f7, 0xffffff];
const STAR_COLORS = [0xffd700, 0xfff59d, 0xffffff, 0x80deea, 0xf48fb1, 0xffab40];
const TOWER_SHAKE_TIME = 0.9;

// キラキラ用の星形ジオメトリ
function makeStarGeometry() {
  const shape = new THREE.Shape();
  const outer = 0.3;
  const inner = 0.13;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

// ミス演出（赤フラッシュ・タワーシェイク・煙）と
// 紙吹雪・星・ブロック爆発パーティクルの管理
export class Effects {
  constructor(scene, towerGroups) {
    this.scene = scene;
    this.towerGroups = towerGroups;
    this.bursts = [];        // 紙吹雪・星（InstancedMesh）
    this.smokes = [];        // 煙パーティクル
    this.flying = [];        // 爆発で吹き飛ぶブロック
    this.streams = [];       // モンスターへ飛ぶ光の粒子
    this.shreds = [];        // ゴミ箱に吸い込まれ中のブロック
    this.towerShakes = [0, 0, 0];
    this.shake = 0;          // カメラシェイク
    this.flashEl = document.getElementById('flash');
    this._dummy = new THREE.Object3D();
    this._smokeGeo = new THREE.SphereGeometry(0.32, 10, 8);
  }

  // 画面が赤く光るミスエフェクト
  miss() {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth; // アニメーションを再トリガー
    this.flashEl.classList.add('on');
    this.shake = 0.35;
  }

  // 「0」の位に落としたときのひっかけミス: タワーが激しく揺れて火花と煙が出る
  trapMiss(laneIdx) {
    this.miss();
    this.shake = 0.55;
    this.towerShakes[laneIdx] = TOWER_SHAKE_TIME;
    this.smokeBurst(laneIdx);
    this.sparkBurst(laneIdx);
  }

  // 火花（タワー上部からバチバチッと飛び散る）
  sparkBurst(laneIdx) {
    const x = this.towerGroups[laneIdx].userData.baseX;
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this._spawnBurst(geo, 55, [0xffe066, 0xffaa33, 0xff5533, 0xffffff], 'spark',
      new THREE.Vector3(x, 6.8, 0.6), 0.8);
  }

  // 煙パーティクル（タワーの根元からモクモク）
  smokeBurst(laneIdx) {
    const x = this.towerGroups[laneIdx].userData.baseX;
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0x9e9e9e : 0x757575,
        transparent: true,
        opacity: 0.75,
      });
      const mesh = new THREE.Mesh(this._smokeGeo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 3,
        0.5 + Math.random() * 2,
        0.8 + Math.random() * 1.2
      );
      mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      this.scene.add(mesh);
      this.smokes.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.2 + Math.random() * 2, (Math.random() - 0.5) * 1),
        life: 0,
      });
    }
  }

  // ゴミ箱がブロックを吸い込むシュレッダー演出
  // （クルクル回りながら縮んで穴に落ち、紫の火花が散る）
  shred(block, binX) {
    this.shreds.push({
      mesh: block,
      from: block.position.clone(),
      to: new THREE.Vector3(binX, 0.6, BIN_Z),
      t: 0,
      dur: 0.45,
    });
  }

  _finishShred(s) {
    removeBlock(this.scene, s.mesh);
    this._spawnBurst(
      new THREE.BoxGeometry(0.14, 0.14, 0.14), 30,
      [0xa78bfa, 0x7c3aed, 0xd8b4fe, 0xffffff], 'spark',
      new THREE.Vector3(s.to.x, 0.9, s.to.z), 0.6
    );
  }

  // すてゾーンにブロックを捨てたときの土ぼこり（ポイッ）
  discardPoof(x) {
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xe2e8f0 : 0xcbd5e1,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(this._smokeGeo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 1.6,
        0.3 + Math.random() * 0.6,
        0.5 + Math.random() * 0.8
      );
      mesh.scale.setScalar(0.4 + Math.random() * 0.5);
      this.scene.add(mesh);
      this.smokes.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 1),
        life: 0,
      });
    }
  }

  // 紙吹雪バースト
  confettiBurst(origin = new THREE.Vector3(0, 9, 2), count = 200) {
    const geo = new THREE.PlaneGeometry(0.32, 0.18);
    this._spawnBurst(geo, count, CONFETTI_COLORS, 'confetti', origin, 3.0);
  }

  // キラキラ星バースト（クリア演出）: 画面全体に舞い散る
  starBurst(origin = new THREE.Vector3(0, 8, 1), count = 240) {
    const geo = makeStarGeometry();
    this._spawnBurst(geo, count, STAR_COLORS, 'star', origin, 3.8);
  }

  _spawnBurst(geo, count, colors, kind, origin, maxLife) {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    if (kind === 'spark') {
      mat.blending = THREE.AdditiveBlending;
      mat.depthWrite = false;
    }
    const mesh = new THREE.InstancedMesh(geo, mat, count);

    const spread = kind === 'spark' ? 0.6 : 5;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const power =
        kind === 'star' ? 3 + Math.random() * 9 :
        kind === 'spark' ? 5 + Math.random() * 9 :
        2 + Math.random() * 6;
      particles.push({
        pos: origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * spread, Math.random() * (kind === 'spark' ? 0.5 : 2), (Math.random() - 0.5) * 2)),
        vel: new THREE.Vector3(
          Math.cos(angle) * power,
          (kind === 'spark' ? 1 : 4) + Math.random() * 7,
          Math.sin(angle) * power * 0.6),
        rot: new THREE.Euler(
          Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
        phase: Math.random() * Math.PI * 2, // 星のまたたき用
      });
      mesh.setColorAt(i, new THREE.Color(colors[Math.floor(Math.random() * colors.length)]));
    }
    mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.bursts.push({ mesh, particles, life: 0, maxLife, kind });
  }

  // クリア時: タワーからモンスターへ光の粒子がシュシュシュッと飛んでいく
  energyStream(to, count = 90) {
    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff176,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);

    const particles = [];
    for (let i = 0; i < count; i++) {
      const laneX = this.towerGroups[i % 3].userData.baseX;
      const start = new THREE.Vector3(
        laneX + (Math.random() - 0.5) * 1.6,
        0.5 + Math.random() * 6,
        (Math.random() - 0.5) * 1
      );
      const mid = new THREE.Vector3(
        (start.x + to.x) / 2 + (Math.random() - 0.5) * 3,
        Math.max(start.y, to.y) + 3 + Math.random() * 2.5,
        (start.z + to.z) / 2 + 2
      );
      particles.push({ start, mid, delay: i * 0.014, dur: 0.85 });
    }
    this.scene.add(mesh);
    this.streams.push({ mesh, particles, to: to.clone(), life: 0, maxLife: count * 0.014 + 0.9 });
  }

  // クリア時: タワーにたまっていたブロックを上空へパシャーンと弾き飛ばす
  blockExplosion(blocks) {
    for (const b of blocks) {
      this.flying.push({
        mesh: b,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          10 + Math.random() * 7,
          (Math.random() - 0.5) * 6),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        life: 0,
      });
    }
    this.shake = 0.5;
  }

  // 毎フレーム呼ぶ。カメラに適用すべきシェイクオフセットを shakeOffset に書き込む
  update(dt, shakeOffset) {
    // カメラシェイク
    this.shake = Math.max(0, this.shake - dt * 1.2);
    shakeOffset.set(
      (Math.random() - 0.5) * this.shake,
      (Math.random() - 0.5) * this.shake,
      0
    );

    // タワーシェイク（0のひっかけミス）
    for (let i = 0; i < this.towerGroups.length; i++) {
      if (this.towerShakes[i] <= 0) continue;
      this.towerShakes[i] = Math.max(0, this.towerShakes[i] - dt);
      const s = this.towerShakes[i];
      const k = s / TOWER_SHAKE_TIME;
      const g = this.towerGroups[i];
      g.position.x = g.userData.baseX + Math.sin(s * 45) * 0.25 * k;
      g.rotation.z = Math.sin(s * 38) * 0.07 * k;
    }

    // 煙
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const p = this.smokes[i];
      p.life += dt;
      if (p.life > 1.2) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.smokes.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.addScalar(dt * 2.2);
      p.mesh.material.opacity = 0.75 * (1 - p.life / 1.2);
    }

    // ゴミ箱への吸い込み
    for (let i = this.shreds.length - 1; i >= 0; i--) {
      const s = this.shreds[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.mesh.position.lerpVectors(s.from, s.to, k * k); // 加速しながら吸い込まれる
      s.mesh.rotation.y += dt * 18;
      s.mesh.scale.setScalar(Math.max(0.02, 1 - k));
      if (k >= 1) {
        this._finishShred(s);
        this.shreds.splice(i, 1);
      }
    }

    // 爆発で飛ぶブロック
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const p = this.flying[i];
      p.life += dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;
      if (p.life > 3.2 || p.mesh.position.y < -3) {
        removeBlock(this.scene, p.mesh);
        this.flying.splice(i, 1);
      }
    }

    // モンスターへ飛ぶ光の粒子（2次ベジェ曲線に沿ってシュッと飛ぶ）
    for (let si = this.streams.length - 1; si >= 0; si--) {
      const st = this.streams[si];
      st.life += dt;
      if (st.life > st.maxLife) {
        this.scene.remove(st.mesh);
        st.mesh.geometry.dispose();
        st.mesh.material.dispose();
        this.streams.splice(si, 1);
        continue;
      }
      st.particles.forEach((p, i) => {
        const t = Math.min(1, Math.max(0, (st.life - p.delay) / p.dur));
        this._dummy.position.set(0, -100, 0); // 画面外（未出発・到着済み）
        this._dummy.scale.setScalar(0.001);
        if (t > 0 && t < 1) {
          const u = 1 - t;
          this._dummy.position.set(
            u * u * p.start.x + 2 * u * t * p.mid.x + t * t * st.to.x,
            u * u * p.start.y + 2 * u * t * p.mid.y + t * t * st.to.y,
            u * u * p.start.z + 2 * u * t * p.mid.z + t * t * st.to.z
          );
          this._dummy.scale.setScalar(0.8 + 0.6 * Math.sin(t * Math.PI));
        }
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.updateMatrix();
        st.mesh.setMatrixAt(i, this._dummy.matrix);
      });
      st.mesh.instanceMatrix.needsUpdate = true;
    }

    // 紙吹雪・星
    for (let bi = this.bursts.length - 1; bi >= 0; bi--) {
      const burst = this.bursts[bi];
      burst.life += dt;

      if (burst.life > burst.maxLife) {
        this.scene.remove(burst.mesh);
        burst.mesh.geometry.dispose();
        burst.mesh.material.dispose();
        this.bursts.splice(bi, 1);
        continue;
      }

      const isStar = burst.kind === 'star';
      const isSpark = burst.kind === 'spark';
      const gravity = isStar ? 2.2 : isSpark ? 13 : 4.5;
      const drag = isStar ? 0.3 : isSpark ? 0.4 : 0.6;
      const sparkShrink = isSpark ? Math.max(0.15, 1 - burst.life / burst.maxLife) : 1;

      burst.particles.forEach((p, i) => {
        p.vel.y -= gravity * dt;
        p.vel.multiplyScalar(1 - dt * drag);
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.rotVel.x * dt;
        p.rot.y += p.rotVel.y * dt;
        p.rot.z += p.rotVel.z * dt;

        this._dummy.position.copy(p.pos);
        this._dummy.rotation.copy(p.rot);
        // 星はまたたき、火花は燃え尽きるように小さくなる
        const s = isStar ? 0.8 + 0.5 * Math.abs(Math.sin(burst.life * 12 + p.phase)) : sparkShrink;
        this._dummy.scale.setScalar(s);
        this._dummy.updateMatrix();
        burst.mesh.setMatrixAt(i, this._dummy.matrix);
      });
      burst.mesh.instanceMatrix.needsUpdate = true;
      burst.mesh.material.opacity = Math.min(1, (burst.maxLife - burst.life) / 0.8);
    }
  }
}

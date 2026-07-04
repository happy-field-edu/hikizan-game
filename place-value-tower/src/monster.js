import * as THREE from 'three';

// 進化するたびに変わる体の色（青 → 緑 → 紫 → 金 → ピンク → 水色 → …繰り返し）
const LEVEL_COLORS = [0x60a5fa, 0x4ade80, 0xc084fc, 0xfbbf24, 0xf472b6, 0x67e8f9];
export const GAUGE_MAX = 3;   // 3問クリアで進化
const SAVE_KEY = 'pvt-monster';

const HAPPY_TIME = 2.4;
const DIZZY_TIME = 2.4;
const POPUP_TIME = 2.6;

// 満腹度に応じた巨大化: ゲージ満タンで +45%、クリアの瞬間はさらに「ドーン！」
const GROWTH_MAX = 0.45;
const MEGA_FACTOR = 1.35;

// 吹き出し・ゲージの見た目サイズ（ワールド座標で一定に保つ）
const BUBBLE_W = 8.06, BUBBLE_H = 4.55, BUBBLE_Y = 4.68;
const FULLNESS_W = 7.4, FULLNESS_H = 3.47, FULLNESS_Y = -4.15;

// ゴムのように「ボヨヨン！」と弾むイージング
function elasticOut(k) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  return Math.pow(2, -10 * k) * Math.sin(((k - 0.075) * 2 * Math.PI) / 0.3) + 1;
}

// 位ごとの色（吹き出しの数字用。UIと同じ配色）
const DIGIT_COLORS = ['#f59e0b', '#10b981', '#3b82f6'];

function digitColor(numDigits, i) {
  const placeFromRight = numDigits - 1 - i;
  return DIGIT_COLORS[2 - Math.min(2, placeFromRight)];
}

// 吹き出し「ほしいパワー: 〇〇〇」のテクスチャを描く
// rush = true のときは警告っぽく赤くなる（ラッシュタイム）
function drawBubble(n, rush = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // 吹き出し本体
  ctx.fillStyle = rush ? 'rgba(255,241,242,0.97)' : 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = rush ? '#ef4444' : '#fbbf24';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(20, 16, 600, 264, 48);
  ctx.fill();
  ctx.stroke();
  // しっぽ（下向き三角）
  ctx.beginPath();
  ctx.moveTo(270, 276);
  ctx.lineTo(370, 276);
  ctx.lineTo(320, 352);
  ctx.closePath();
  ctx.fill();

  // ラベル
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 56px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.fillStyle = rush ? '#dc2626' : '#d97706';
  ctx.fillText(rush ? '⚡ラッシュ！ いそいで！⚡' : 'ほしいパワー', 320, 72);

  // 数字（位ごとに色分け・大きく。ラッシュ中は赤）
  const text = String(n);
  ctx.font = 'bold 168px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'left';
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = 320 - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillStyle = rush ? '#dc2626' : digitColor(text.length, i);
    ctx.fillText(ch, x, 186);
    x += widths[i];
  });

  return new THREE.CanvasTexture(canvas);
}

// セリフ吹き出し（ナイススルー！などの褒めことば）
function drawSay(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(240,253,244,0.97)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(20, 40, 600, 216, 48);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(270, 252);
  ctx.lineTo(370, 252);
  ctx.lineTo(320, 330);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = text.length > 7 ? 72 : 92;
  ctx.font = `bold ${size}px "Hiragino Maru Gothic ProN", sans-serif`;
  ctx.fillStyle = '#15803d';
  ctx.fillText(text, 320, 150);

  return new THREE.CanvasTexture(canvas);
}

// モンスターのすぐ下の「いまの ごうけい」＋まんぷくゲージ（大きく一目でわかる常時表示）
function drawFullness(sum, target) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  const over = sum > target;

  // 背景パネル（タワー越しでもくっきり読めるように）
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.strokeStyle = over ? '#ef4444' : '#fbbf24';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(16, 8, 608, 284, 44);
  ctx.fill();
  ctx.stroke();

  // ラベル
  ctx.font = 'bold 46px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('いまの ごうけい', 320, 36);
  ctx.fillStyle = over ? '#dc2626' : '#92400e';
  ctx.fillText('いまの ごうけい', 320, 36);

  // 合計の数字（位ごとの色分け・特大。いれすぎは赤）
  const text = String(sum);
  ctx.font = 'bold 150px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'left';
  ctx.lineWidth = 24;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = 320 - total / 2;
  [...text].forEach((ch, i) => {
    ctx.strokeText(ch, x, 132);
    ctx.fillStyle = over ? '#dc2626' : digitColor(text.length, i);
    ctx.fillText(ch, x, 132);
    x += widths[i];
  });

  // まんぷくゲージ（ターゲットに近づくほど満タン）
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(40, 226, 560, 52, 26);
  ctx.fill();
  const ratio = Math.min(1, sum / target);
  if (ratio > 0 || over) {
    const w = over ? 560 : Math.max(52, 560 * ratio);
    const grad = ctx.createLinearGradient(40, 0, 40 + w, 0);
    if (over) {
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(1, '#b91c1c');
    } else {
      grad.addColorStop(0, '#fde047');
      grad.addColorStop(1, '#f97316');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(46, 232, w - 12 > 0 ? w - 12 : 40, 40, 20);
    ctx.fill();
  }
  // 10%ごとの目盛り
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 10; i++) {
    const tx = 40 + 56 * i;
    ctx.beginPath();
    ctx.moveTo(tx, 232);
    ctx.lineTo(tx, 272);
    ctx.stroke();
  }
  // パーセント表示
  ctx.font = 'bold 44px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'right';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#ffffff';
  const pct = `${Math.min(999, Math.round((sum / target) * 100))}%`;
  ctx.strokeText(pct, 600, 196);
  ctx.fillStyle = over ? '#dc2626' : '#b45309';
  ctx.fillText(pct, 600, 196);

  return new THREE.CanvasTexture(canvas);
}

// レベルアップ・進化ポップアップのテクスチャ
function drawPopup() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  ctx.font = 'bold 84px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('レベルアップ！', 320, 80);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('レベルアップ！', 320, 80);

  ctx.font = 'bold 110px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.lineWidth = 26;
  ctx.strokeText('✨ しんか！ ✨', 320, 205);
  ctx.fillStyle = '#e11d48';
  ctx.fillText('✨ しんか！ ✨', 320, 205);

  return new THREE.CanvasTexture(canvas);
}

// お腹をすかせたちびモンスター。タワーの奥・上空にふわふわ浮いている
export class Monster {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.baseY = 11.4; // タワー（高さ7）よりしっかり上に浮かぶ
    this.group.position.set(0, this.baseY, -10);
    scene.add(this.group);

    this.time = 0;
    this.happyT = -1;   // 大喜びアニメーションの経過時間（-1 = 停止中）
    this.dizzyT = -1;   // 気絶（フラフラ）アニメーション（-1 = 停止中）
    this.popup = null;  // レベルアップポップアップ
    this.rushMode = false;
    this.targetN = 0;
    this.sayTimer = 0;  // セリフ吹き出しの残り時間

    // セーブデータ（レベル・満腹度）を読み込み
    let save = { level: 1, gauge: 0 };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) save = { ...save, ...JSON.parse(raw) };
    } catch { /* 保存なしでも動く */ }
    this.level = save.level;
    this.gauge = save.gauge;

    this.colorable = []; // 進化で色が変わるパーツ
    this.buildBody();
    // 保存されていたレベルぶんのパーツを復元
    for (let lv = 2; lv <= this.level; lv++) this.addEvolutionPart(lv);
    this.applyColor();

    // スケール管理: baseScale（レベル依存の基本サイズ）＋ 満腹度による巨大化
    this.baseScale = this.levelScale();
    this.scaleTarget = this.baseScale;
    this.scaleAnim = null; // { from, to, t, dur }
    this.group.scale.setScalar(this.baseScale);

    // 吹き出し
    // depthTest は有効のまま: 手前を落ちるブロックが吹き出しに隠れないように
    this.bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: drawBubble(0) })
    );
    this.bubble.scale.set(6.2, 3.5, 1);
    this.bubble.position.y = 3.6;
    this.group.add(this.bubble);

    // まんぷくゲージ（モンスターのすぐ下）
    this.fullness = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: drawFullness(0, 100) })
    );
    this.fullness.scale.set(FULLNESS_W, FULLNESS_H, 1);
    this.fullness.position.y = FULLNESS_Y;
    this.group.add(this.fullness);
  }

  buildBody() {
    const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const add = (geo, material, x, y, z) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };

    const bodyMat = mat(LEVEL_COLORS[0]);
    this.colorable.push(bodyMat);

    // からだ（+z がカメラ側＝正面）
    add(new THREE.SphereGeometry(1.4, 24, 20), bodyMat, 0, 0, 0);
    // おなか
    const belly = add(new THREE.SphereGeometry(0.95, 20, 16), mat(0xfff7e0), 0, -0.25, 0.6);
    belly.scale.set(1, 0.95, 0.7);
    // 目
    add(new THREE.SphereGeometry(0.28, 12, 10), mat(0xffffff), -0.5, 0.4, 1.12);
    add(new THREE.SphereGeometry(0.28, 12, 10), mat(0xffffff), 0.5, 0.4, 1.12);
    add(new THREE.SphereGeometry(0.13, 10, 8), mat(0x1e293b), -0.5, 0.4, 1.36);
    add(new THREE.SphereGeometry(0.13, 10, 8), mat(0x1e293b), 0.5, 0.4, 1.36);
    // ほっぺ
    const cheekMat = mat(0xf9a8d4);
    add(new THREE.SphereGeometry(0.16, 10, 8), cheekMat, -0.88, -0.02, 1.05).scale.z = 0.5;
    add(new THREE.SphereGeometry(0.16, 10, 8), cheekMat, 0.88, -0.02, 1.05).scale.z = 0.5;
    // にっこり口（下向きの半円）
    const smile = add(
      new THREE.TorusGeometry(0.24, 0.05, 8, 16, Math.PI),
      mat(0x7c2d12), 0, -0.18, 1.3
    );
    smile.rotation.z = Math.PI;
    // あし
    const footMat = mat(LEVEL_COLORS[0]);
    this.colorable.push(footMat);
    add(new THREE.SphereGeometry(0.36, 12, 10), footMat, -0.55, -1.32, 0.25).scale.set(1, 0.6, 1.25);
    add(new THREE.SphereGeometry(0.36, 12, 10), footMat, 0.55, -1.32, 0.25).scale.set(1, 0.6, 1.25);
    // おてて
    add(new THREE.SphereGeometry(0.3, 12, 10), footMat, -1.32, -0.15, 0.25);
    add(new THREE.SphereGeometry(0.3, 12, 10), footMat, 1.32, -0.15, 0.25);
  }

  // 進化ごとにパーツが増える（Lv2: 耳、Lv3: つの、Lv4: 王冠、Lv5+: 色だけ変化）
  addEvolutionPart(level) {
    const gold = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, roughness: 0.3, metalness: 0.4,
      emissive: 0xfbbf24, emissiveIntensity: 0.15,
    });
    if (level === 2) {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 12), this.colorableMat());
        ear.position.set(side * 0.75, 1.35, 0);
        ear.rotation.z = -side * 0.35;
        this.group.add(ear);
      }
    } else if (level === 3) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 12), gold);
      horn.position.set(0, 1.65, 0);
      this.group.add(horn);
    } else if (level === 4) {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.1, 10, 24), gold);
      crown.position.set(0, 1.5, 0);
      crown.rotation.x = Math.PI / 2;
      this.group.add(crown);
    }
  }

  colorableMat() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.colorable.push(m);
    return m;
  }

  applyColor() {
    const color = LEVEL_COLORS[(this.level - 1) % LEVEL_COLORS.length];
    for (const m of this.colorable) m.color.setHex(color);
  }

  // レベルに応じた基本サイズ
  levelScale() {
    return 1.3 * Math.pow(1.08, this.level - 1);
  }

  // 「ボヨヨン！」と弾みながら指定サイズへ
  growTo(target, dur = 0.7) {
    if (Math.abs(target - this.scaleTarget) < 0.001) return;
    this.scaleTarget = target;
    this.scaleAnim = { from: this.group.scale.x, to: target, t: 0, dur };
  }

  // クリアの瞬間の「ドーン！」巨大化（次の問題で初期サイズに戻る）
  megaGrow() {
    this.growTo(this.baseScale * (1 + GROWTH_MAX) * MEGA_FACTOR, 0.9);
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ level: this.level, gauge: this.gauge }));
    } catch { /* 保存できなくても動く */ }
  }

  // 吹き出しのおねだりパワー（ターゲットの数）を更新
  setTarget(n) {
    this.targetN = n;
    this.sayTimer = 0; // セリフ表示中でも即ターゲット表示に戻す
    this.bubble.material.map?.dispose();
    this.bubble.material.map = drawBubble(n, this.rushMode);
    this.bubble.material.needsUpdate = true;
  }

  // 吹き出しに一時的にセリフを表示（時間がたつとターゲット表示に戻る）
  say(text, dur = 1.7) {
    this.bubble.material.map?.dispose();
    this.bubble.material.map = drawSay(text);
    this.bubble.material.needsUpdate = true;
    this.sayTimer = dur;
  }

  // ラッシュタイムの表示切り替え（吹き出しが赤くなる）
  setRush(on) {
    if (this.rushMode === on) return;
    this.rushMode = on;
    this.setTarget(this.targetN);
  }

  // まんぷくゲージ（いまの合計 / ターゲット）を更新。
  // 満腹度が増えるたびにモンスターがボヨヨンと少しずつ大きくなる
  setFullness(sum, target) {
    this.fullness.material.map?.dispose();
    this.fullness.material.map = drawFullness(sum, target);
    this.fullness.material.needsUpdate = true;

    const ratio = Math.min(1, sum / target);
    this.growTo(this.baseScale * (1 + GROWTH_MAX * ratio));
  }

  // 入れすぎ！ フラフラと目をまわす
  dizzy() {
    this.dizzyT = 0;
    this.happyT = -1;
  }

  // エネルギーの到着位置（光の粒子の飛び先）
  headPos() {
    return this.group.position.clone().add(new THREE.Vector3(0, 0.3, 0.5));
  }

  // 大喜びアクション（ピョンピョン跳ねてクルクル回る）
  happy() {
    this.happyT = 0;
  }

  // 1問クリア → 満腹度+1。ゲージ満タンなら進化して true を返す
  feed() {
    this.gauge += 1;
    if (this.gauge >= GAUGE_MAX) {
      this.gauge = 0;
      this.level += 1;
      this.addEvolutionPart(this.level);
      this.applyColor();
      // 進化の瞬間はさらにドーン！（次の問題で新レベルの基本サイズに戻る）
      this.baseScale = this.levelScale();
      this.growTo(this.baseScale * (1 + GROWTH_MAX) * MEGA_FACTOR * 1.1, 0.9);
      this.showPopup();
      this.happy();
      this.save();
      return true;
    }
    this.save();
    return false;
  }

  // 「レベルアップ！ しんか！」の3Dポップアップ
  showPopup() {
    if (this.popup) {
      this.scene.remove(this.popup.sprite);
      this.popup.sprite.material.map.dispose();
      this.popup.sprite.material.dispose();
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: drawPopup(), depthTest: false, transparent: true })
    );
    sprite.position.copy(this.group.position).add(new THREE.Vector3(0, 3.6, 2));
    sprite.scale.set(0.1, 0.05, 1);
    this.scene.add(sprite);
    this.popup = { sprite, t: 0 };
  }

  update(dt) {
    this.time += dt;

    // ふわふわ待機モーション
    let y = this.baseY + Math.sin(this.time * 1.6) * 0.25;
    let rotY = Math.sin(this.time * 0.7) * 0.12;
    let rotZ = 0;

    // 大喜び: ピョンピョン + クルクル
    if (this.happyT >= 0) {
      this.happyT += dt;
      const k = this.happyT / HAPPY_TIME;
      if (k >= 1) {
        this.happyT = -1;
      } else {
        y += Math.abs(Math.sin(this.happyT * 7)) * 1.3 * (1 - k * 0.5);
        rotY = this.happyT * 6 * Math.PI * Math.max(0, 1 - k); // だんだん減速して回る
      }
    }

    // 気絶: フラフラ左右にかたむいて、ずーんと沈む
    if (this.dizzyT >= 0) {
      this.dizzyT += dt;
      const k = this.dizzyT / DIZZY_TIME;
      if (k >= 1) {
        this.dizzyT = -1;
      } else {
        rotZ = Math.sin(this.dizzyT * 8) * 0.4 * (1 - k);
        rotY = Math.sin(this.dizzyT * 3) * 0.5;
        y -= 0.8 * Math.sin(Math.min(1, k * 1.4) * Math.PI);
      }
    }

    this.group.position.y = y;
    this.group.rotation.y = rotY;
    this.group.rotation.z = rotZ;

    // 巨大化アニメーション（ボヨヨン！）
    if (this.scaleAnim) {
      const a = this.scaleAnim;
      a.t += dt;
      const k = a.t / a.dur;
      if (k >= 1) {
        this.group.scale.setScalar(a.to);
        this.scaleAnim = null;
      } else {
        this.group.scale.setScalar(a.from + (a.to - a.from) * elasticOut(k));
      }
    }

    // 吹き出しとゲージは、モンスターが大きくなっても見た目サイズ一定に保つ
    // （吹き出しは頭にかぶらないよう、体の大きさぶんだけ上へ）
    const inv = 1 / this.group.scale.x;
    this.bubble.scale.set(BUBBLE_W * inv, BUBBLE_H * inv, 1);
    this.bubble.position.y = 1.5 + 3.4 * inv;
    this.fullness.scale.set(FULLNESS_W * inv, FULLNESS_H * inv, 1);
    this.fullness.position.y = FULLNESS_Y * inv;

    // セリフの表示時間が終わったらターゲット表示に戻す
    if (this.sayTimer > 0) {
      this.sayTimer -= dt;
      if (this.sayTimer <= 0) this.setTarget(this.targetN);
    }

    // ラッシュ中は吹き出しが赤く点滅する
    this.bubble.material.opacity = this.rushMode && this.sayTimer <= 0
      ? 0.7 + 0.3 * Math.sin(this.time * 12)
      : 1;

    // ポップアップ: ポンッと出て、ふわっと上がって消える
    if (this.popup) {
      this.popup.t += dt;
      const t = this.popup.t;
      const pop = Math.min(1, t / 0.35);
      const s = pop * (1 + 0.15 * Math.sin(Math.min(1, t / 0.35) * Math.PI));
      this.popup.sprite.scale.set(7.4 * s, 3.5 * s, 1);
      this.popup.sprite.position.y = this.group.position.y + 3.6 + t * 0.6;
      this.popup.sprite.material.opacity = Math.min(1, (POPUP_TIME - t) / 0.6);
      if (t > POPUP_TIME) {
        this.scene.remove(this.popup.sprite);
        this.popup.sprite.material.map.dispose();
        this.popup.sprite.material.dispose();
        this.popup = null;
      }
    }
  }
}

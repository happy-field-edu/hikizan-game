import * as THREE from 'three';
import { LANES, TOWER_HEIGHT, SPAWN_Y, BIN_X } from './towers.js';
import { createBlock, removeBlock } from './blocks.js';
import { GAUGE_MAX } from './monster.js';
import * as ui from './ui.js';

// はるか上空では速く落ち、タワーに近づくとゆっくりになる
const FALL_SPEED_HIGH = 11;
const FALL_SPEED_LOW = 2.4;
const SLOW_DOWN_Y = 16; // この高さから減速し始める
const SPAWN_DELAY = 0.7;

// ラッシュタイム: 同じ種類のブロックが連続で素早く降ってくる
const RUSH_CHANCE = 0.16;
const RUSH_COUNT = 3;
const RUSH_SPAWN_DELAY = 0.25;
const RUSH_SPEED = 1.55;

// 合計がターゲットに近づくほど速くなる（最大 +50%）
const PROGRESS_SPEEDUP = 0.5;

// 操作スロット: まんなか3つがタワー、両はしは「ゴミ箱（ブラックホール）」
const SLOTS = [
  { x: -BIN_X, tower: null },
  { x: -5.6, tower: 0 },
  { x: 0, tower: 1 },
  { x: 5.6, tower: 2 },
  { x: BIN_X, tower: null },
];

// 画面幅に合わせてゴミ箱スロットの位置を更新する（main.js が呼ぶ）
export function setBinsX(x) {
  SLOTS[0].x = -x;
  SLOTS[SLOTS.length - 1].x = x;
}
export const SLOT_COUNT = SLOTS.length;

const DISCARD_Y = 1.35; // ゴミ箱の吸い込みが始まる高さ

// 上手に捨てたときのモンスターの褒めことば
const PRAISES = ['ナイススルー！', 'えらい！', 'いいはんだん！', 'すてるの じょうず！'];

// 合体（ガッチャンコ）アニメーションの各フェーズの長さ（秒）
const GATHER_TIME = 0.6;
const POP_TIME = 0.28;
const FLY_TIME = 1.0;

const LANE_OF = { 100: 0, 10: 1, 1: 2 };

const ease = (k) => k * k * (3 - 2 * k);

// タワーの真上に出す「その位の現在値」（例: 十の位に4本なら 40）
function drawTowerValue(value, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const color = '#' + colorHex.toString(16).padStart(6, '0');

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(12, 12, 296, 136, 34);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 92px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(value), 160, 86);

  return new THREE.CanvasTexture(canvas);
}

// タワー内での積み上げ位置。1の立方体は「5こずつ2列」で最大10こ入る
function stackTransform(value, idx, laneX) {
  if (value === 100) return { pos: [laneX, 0.42 + idx * 0.42, 0], rotZ: 0 };
  if (value === 10) return { pos: [laneX, 0.52 + idx * 0.46, 0], rotZ: Math.PI / 2 };
  const col = idx < 5 ? -0.5 : 0.5;
  return { pos: [laneX + col, 0.5 + (idx % 5) * 0.62, 0], rotZ: 0 };
}

export class Game {
  constructor(scene, effects, monster) {
    this.scene = scene;
    this.effects = effects;
    this.monster = monster;
    ui.setGauge(monster.gauge, GAUGE_MAX);
    ui.setLevel(monster.level);
    this.stacks = [[], [], []]; // タワーごとの積まれたブロック
    this.block = null;          // 落下中のブロック
    this.merge = null;          // 進行中の合体アニメーション
    this.slotIdx = 2;
    this.status = 'playing';    // playing | merging | overflow | clear
    this.timer = 0.8;
    this.rushLeft = 0;          // 残りのラッシュブロック数
    this.rushType = 1;

    // 各タワーの真上の「その位の現在値」表示
    this.towerValues = LANES.map((lane) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: drawTowerValue(0, lane.color) })
      );
      sprite.scale.set(2.7, 1.35, 1);
      sprite.position.set(lane.x, TOWER_HEIGHT + 1.5, 1.5);
      scene.add(sprite);
      return sprite;
    });

    this.newProblem();
  }

  // タワー上の現在値表示を更新（例: 十の位に4本 → 40）
  updateTowerValues() {
    LANES.forEach((lane, i) => {
      const sprite = this.towerValues[i];
      sprite.material.map?.dispose();
      sprite.material.map = drawTowerValue(this.counts[lane.value] * lane.value, lane.color);
      sprite.material.needsUpdate = true;
    });
  }

  // いまの合計（タワー内の物理ブロック数から計算。繰り上がりでも不変）
  get sum() {
    return this.counts[100] * 100 + this.counts[10] * 10 + this.counts[1];
  }

  // ターゲットへの近さ 0〜1（満腹度・スピードアップに使う）
  get progress() {
    return Math.min(1, this.sum / this.target);
  }

  // 新しい問題を作る。十・一の位はランダムで「0」になる（ひっかけ問題）。
  // 各位は最大5に抑えて1問のブロック数が多くなりすぎないようにしている
  newProblem() {
    for (const stack of this.stacks) {
      for (const b of stack) removeBlock(this.scene, b);
    }
    this.stacks = [[], [], []];
    if (this.block) {
      removeBlock(this.scene, this.block);
      this.block = null;
    }
    this.merge = null;
    this.rushLeft = 0;

    const h = 1 + Math.floor(Math.random() * 5);
    let t = Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * 5);
    let o = Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * 5);
    // 「0」のひっかけ問題が必ず定期的に出るように: 2問連続で0なしなら強制的に0を入れる
    if ((this.noZeroStreak ?? 0) >= 2 && t !== 0 && o !== 0) {
      if (Math.random() < 0.5) t = 0;
      else o = 0;
    }
    this.noZeroStreak = t === 0 || o === 0 ? 0 : (this.noZeroStreak ?? 0) + 1;
    this.digits = { 100: h, 10: t, 1: o };
    this.counts = { 100: 0, 10: 0, 1: 0 };
    this.target = h * 100 + t * 10 + o;
    this.status = 'playing';
    this.timer = 0.8;

    ui.setMessage('おなじ かずに しよう！');
    this.monster.setRush(false);
    this.monster.setTarget(this.target); // ターゲットはモンスターの吹き出しに表示
    this.monster.setFullness(0, this.target);
    this.updateTowerValues();
  }

  // 次に降らせるブロックの種類。まだ足りない種類が出やすいが、
  // たまに「いらないブロック」（0の位・もう足りている位）も混ざる → すてゾーンで捨てる判断
  // そのブロックが「いま必要か」（0の位でなく、まだ足りず、入れても超えない）
  isUseful(v) {
    return this.digits[v] > 0 && this.counts[v] < this.digits[v] && this.sum + v <= this.target;
  }

  // 重み付き抽選: 必要なブロックが出やすく（無理ゲー防止）、
  // いらないブロック（0の位・もう足りている位）は低確率＆連発をほぼ止める
  pickValue() {
    let total = 0;
    const entries = [100, 10, 1].map((v) => {
      let w = this.isUseful(v) ? 6 : 1;
      if (!this.isUseful(v) && v === this.lastValue && (this.lastRepeat ?? 0) >= 1) w = 0.15;
      total += w;
      return [v, w];
    });
    let r = Math.random() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return 1;
  }

  spawn() {
    let value;
    if (this.rushLeft > 0) {
      value = this.rushType; // ラッシュ中は同じ種類が連続
    } else if (Math.random() < RUSH_CHANCE) {
      // 50%で「くりあがりミッション」: 1の立方体が大量に降ってくる
      const onesMission = this.digits[1] > 0 && Math.random() < 0.5;
      if (onesMission) {
        this.rushLeft = 6;
        this.rushType = 1;
        ui.setMessage('⚡ ミッション！「1」ラッシュ！ 10こで くりあがり！ ⚡', 'miss');
      } else {
        this.rushLeft = RUSH_COUNT;
        this.rushType = this.pickValue();
        ui.setMessage('⚡ ラッシュタイム！！ ⚡', 'miss');
      }
      value = this.rushType;
      this.monster.setRush(true); // 吹き出しが赤く点滅する
    } else {
      value = this.pickValue();
    }

    // 同じ種類の連発を検知するための記録（ラッシュ中は意図的な連続なので除外）
    if (this.rushLeft === 0) {
      this.lastRepeat = value === this.lastValue ? (this.lastRepeat ?? 0) + 1 : 0;
      this.lastValue = value;
    }

    this.slotIdx = 2;
    const block = createBlock(value);
    block.userData.rush = this.rushLeft > 0;
    block.position.set(SLOTS[2].x, SPAWN_Y, 0);
    this.scene.add(block);
    this.block = block;
  }

  moveLane(dir) {
    if (!this.block) return;
    this.slotIdx = Math.min(SLOTS.length - 1, Math.max(0, this.slotIdx + dir));
  }

  setSlot(idx) {
    if (!this.block) return;
    this.slotIdx = Math.min(SLOTS.length - 1, Math.max(0, idx));
  }

  update(dt) {
    if (this.status === 'merging') {
      this.updateMerge(dt);
      return;
    }
    if (this.status !== 'playing') return;

    if (!this.block) {
      this.timer -= dt;
      if (this.timer <= 0) this.spawn();
      return;
    }

    const b = this.block;
    b.position.x += (SLOTS[this.slotIdx].x - b.position.x) * Math.min(1, dt * 8);
    // 高度に応じた落下速度 ×（ターゲットに近いほど速い）×（ラッシュ補正）
    const t = Math.min(1, Math.max(0, (b.position.y - TOWER_HEIGHT) / (SLOW_DOWN_Y - TOWER_HEIGHT)));
    let speed = FALL_SPEED_LOW + (FALL_SPEED_HIGH - FALL_SPEED_LOW) * t;
    speed *= 1 + PROGRESS_SPEEDUP * this.progress;
    if (b.userData.rush) speed *= RUSH_SPEED;
    b.position.y -= speed * dt;
    b.rotation.y += dt * 0.8;

    const bottom = b.position.y - b.userData.halfH;
    if (SLOTS[this.slotIdx].tower !== null) {
      if (bottom <= TOWER_HEIGHT) this.resolve(); // タワー突入で判定
    } else if (bottom <= DISCARD_Y) {
      this.discard(); // すてゾーンは地面まで落ちてポイッ
    }
  }

  // ラッシュブロックが処理されたら残数を減らす
  finishRushBlock(b) {
    if (!b.userData.rush) return;
    this.rushLeft -= 1;
    if (this.rushLeft <= 0) this.monster.setRush(false);
  }

  nextDelay() {
    return this.rushLeft > 0 ? RUSH_SPAWN_DELAY : SPAWN_DELAY;
  }

  // ゴミ箱に捨てた: シュレッダーに吸い込まれて消える（ペナルティなし）
  discard() {
    const b = this.block;
    this.block = null;
    const wasUseless = !this.isUseful(b.userData.value);
    this.finishRushBlock(b);
    this.timer = this.nextDelay();

    b.userData.label.visible = false;
    const binX = SLOTS[this.slotIdx].x;
    this.effects.shred(b, binX);

    if (wasUseless) {
      // いらないブロックを上手にスルー → モンスターが褒めてくれる
      this.monster.say(PRAISES[Math.floor(Math.random() * PRAISES.length)]);
      ui.setMessage('ナイススルー！ いらないブロックは ポイッ！', 'good');
    } else {
      ui.setMessage('あっ、それ ひつようだったかも…', 'miss');
    }
  }

  // タワー突入時の判定
  resolve() {
    const b = this.block;
    this.block = null;
    this.finishRushBlock(b);
    this.timer = this.nextDelay();

    const towerIdx = SLOTS[this.slotIdx].tower;
    const laneValue = LANES[towerIdx].value;

    if (this.digits[laneValue] === 0) {
      // 「0」の位のひっかけ: タワーが激しく揺れて煙が出る
      removeBlock(this.scene, b);
      this.effects.trapMiss(towerIdx);
      ui.setMessage('そこは「0」！ なにも いれられないよ！', 'miss');
    } else if (laneValue !== b.userData.value) {
      removeBlock(this.scene, b);
      this.effects.miss();
      ui.setMessage('あれれ？ ちがう くらいだよ', 'miss');
    } else {
      this.place(b, towerIdx);
    }
  }

  // 正しいタワーに積む（入れすぎるとオーバーフロー！）
  place(b, towerIdx) {
    const v = b.userData.value;
    const lane = LANES[towerIdx];
    const st = stackTransform(v, this.counts[v], lane.x);

    b.rotation.set(0, 0, st.rotZ);
    b.position.set(...st.pos);
    b.scale.setScalar(1);
    b.userData.label.visible = false;
    this.stacks[towerIdx].push(b);
    this.counts[v] += 1;

    this.monster.setFullness(this.sum, this.target);
    this.updateTowerValues();

    if (this.sum > this.target) {
      this.overflow(); // 入れすぎ！
    } else if (this.counts[v] >= 10) {
      this.startMerge(v); // 10こたまった → ガッチャンコ！
    } else if (this.sum === this.target) {
      this.clear();
    } else {
      ui.setMessage('いいね！', 'good');
    }
  }

  // オーバーフロー: モンスターが目をまわし、タワーが空になって同じ問題をやり直し
  overflow() {
    this.status = 'overflow';
    this.rushLeft = 0;
    this.monster.setRush(false);
    ui.setMessage('ああっ！ いれすぎ！ めが まわる〜', 'miss');

    this.effects.miss();
    this.effects.shake = 0.7;
    this.monster.dizzy();

    const all = this.stacks.flat();
    this.stacks = [[], [], []];
    this.effects.blockExplosion(all);

    setTimeout(() => {
      this.counts = { 100: 0, 10: 0, 1: 0 };
      this.monster.setFullness(0, this.target);
      this.updateTowerValues();
      this.status = 'playing';
      this.timer = 0.9;
      ui.setMessage('もういちど ちょうせん！');
    }, 2800);
  }

  // 繰り上がり合体アニメーション開始（v: 1 なら 1×10→10、10 なら 10×10→100）
  startMerge(v) {
    const fromLane = LANE_OF[v];
    const blocks = this.stacks[fromLane].splice(0, 10);
    this.merge = {
      v,
      phase: 'gather',
      t: 0,
      blocks,
      fromX: LANES[fromLane].x,
      toX: LANES[LANE_OF[v * 10]].x,
      starts: blocks.map((b) => b.position.clone()),
      // 縦一列（1の場合）／ぎゅっと一山（10の場合）に集まる位置
      gathers: blocks.map((_, i) =>
        new THREE.Vector3(LANES[fromLane].x, 0.55 + i * (v === 1 ? 0.42 : 0.1), 0)),
    };
    this.status = 'merging';
    ui.setMessage('ガッチャンコ…！', 'good');
  }

  updateMerge(dt) {
    const m = this.merge;
    m.t += dt;

    if (m.phase === 'gather') {
      // 10このブロックが縦一列にぎゅっと集まる
      const k = ease(Math.min(1, m.t / GATHER_TIME));
      m.blocks.forEach((b, i) => {
        b.position.lerpVectors(m.starts[i], m.gathers[i], k);
        b.scale.setScalar(1 - 0.25 * k);
      });
      if (m.t >= GATHER_TIME) {
        for (const b of m.blocks) removeBlock(this.scene, b);
        this.counts[m.v] -= 10;
        this.updateTowerValues();
        const big = createBlock(m.v * 10);
        big.position.set(m.fromX, 2.1, 0);
        big.scale.setScalar(0.2);
        this.scene.add(big);
        m.big = big;
        m.phase = 'pop';
        m.t = 0;
        ui.setMessage(`ガッチャンコ！ ${m.v} が 10こで ${m.v * 10} に へんしん！`, 'good');
      }
    } else if (m.phase === 'pop') {
      // 変身したブロックがポンッと出現
      const k = ease(Math.min(1, m.t / POP_TIME));
      m.big.scale.setScalar(0.2 + (1.15 - 0.2) * k);
      if (m.t >= POP_TIME) {
        m.phase = 'fly';
        m.t = 0;
        m.flyFrom = m.big.position.clone();
        const st = stackTransform(m.v * 10, this.counts[m.v * 10], m.toX);
        m.flyTo = new THREE.Vector3(...st.pos);
        m.endRotZ = st.rotZ;
      }
    } else if (m.phase === 'fly') {
      // 大きな弧を描いてとなりの位のタワーへワープ
      const k = ease(Math.min(1, m.t / FLY_TIME));
      m.big.position.lerpVectors(m.flyFrom, m.flyTo, k);
      m.big.position.y += Math.sin(k * Math.PI) * 8;
      m.big.scale.setScalar(1.15 - 0.15 * k);
      m.big.rotation.z = m.endRotZ * k;
      if (m.t >= FLY_TIME) this.finishMerge();
    }
  }

  finishMerge() {
    const m = this.merge;
    m.big.position.copy(m.flyTo);
    m.big.rotation.set(0, 0, m.endRotZ);
    m.big.scale.setScalar(1);
    m.big.userData.label.visible = false;

    const toLane = LANE_OF[m.v * 10];
    this.stacks[toLane].push(m.big);
    this.counts[m.v * 10] += 1;
    const v10 = m.v * 10;
    this.merge = null;

    this.monster.setFullness(this.sum, this.target);
    this.updateTowerValues();

    if (v10 !== 100 && this.counts[v10] >= 10) {
      this.startMerge(v10); // 連鎖繰り上がり（十 → 百）
    } else if (this.sum === this.target) {
      this.clear();
    } else {
      this.status = 'playing';
      this.timer = 0.5;
      ui.setMessage('くりあがり せいこう！', 'good');
    }
  }

  // クリア: ブロックがパシャーンと弾け飛び、エネルギーがモンスターへ飛んで
  // 満腹度が上がる（満タンでレベルアップ・進化）
  clear() {
    this.status = 'clear';
    this.monster.setRush(false);
    this.monster.megaGrow(); // ドーン！と巨大化（次の問題で初期サイズに戻る）
    ui.setMessage('🎉 パシャーン！ だいせいこう！ 🎉', 'clear');
    const all = this.stacks.flat();
    this.stacks = [[], [], []];
    this.effects.blockExplosion(all);
    this.effects.starBurst();
    this.effects.confettiBurst();

    // タワーからモンスターへ光の粒子がシュシュシュッ
    setTimeout(() => {
      this.effects.energyStream(this.monster.headPos());
      ui.setMessage('エネルギー きゅうしゅう〜！', 'good');
    }, 800);

    // モンスターが食べて大喜び。満タンなら進化！
    setTimeout(() => {
      this.monster.happy();
      const evolved = this.monster.feed();
      ui.setGauge(this.monster.gauge, GAUGE_MAX);
      ui.setLevel(this.monster.level);
      if (evolved) {
        this.effects.starBurst(this.monster.group.position.clone(), 140);
        ui.setMessage('✨ レベルアップ！ しんか！ ✨', 'clear');
      } else {
        ui.setMessage('モンスターが おおよろこび！', 'clear');
      }
    }, 1900);

    setTimeout(() => this.newProblem(), 6200);
  }
}

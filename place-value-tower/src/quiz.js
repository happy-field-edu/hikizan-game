// テストに出る形式のボーナスクイズ（クリア2回ごとに出題）
// - tens:    「10を24こ あつめた数は？」（10のあつまり）
// - line:    数直線のめもりを読む
// - compare: 「367 ＜ 3□7」の□に入る数字をぜんぶ選ぶ（答えは1つとは限らない）

const PRAISES = ['せいかい！！ すごい！', 'せいかい！ てんさい！', 'せいかい！ やったね！'];

const rand = (n) => Math.floor(Math.random() * n);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Quiz {
  constructor() {
    this.root = document.getElementById('quiz');
    this.qEl = document.getElementById('quiz-q');
    this.subEl = document.getElementById('quiz-sub');
    this.canvas = document.getElementById('quiz-canvas');
    this.answersEl = document.getElementById('quiz-answers');
    this.confirmBtn = document.getElementById('quiz-confirm');
    this.feedbackEl = document.getElementById('quiz-feedback');
    this.typeIdx = 0;
    this.active = false;
    this.confirmBtn.addEventListener('click', () => this.judgeCompare());
  }

  // クイズを表示する。タイプは tens → line → compare の順にローテーション
  show(onFinish, forceType) {
    this.onFinish = onFinish;
    this.active = true;
    this.selected = new Set();
    this.qEl.innerHTML = '';
    this.subEl.textContent = '';
    this.answersEl.innerHTML = '';
    this.feedbackEl.textContent = '';
    this.feedbackEl.className = '';
    this.canvas.style.display = 'none';
    this.confirmBtn.style.display = 'none';

    const types = ['tens', 'line', 'compare'];
    const type = forceType ?? types[this.typeIdx++ % types.length];
    this.type = type;
    if (type === 'tens') this.buildTens();
    else if (type === 'line') this.buildLine();
    else this.buildCompare();

    this.root.classList.add('shown');
  }

  close(correct) {
    if (!this.active) return; // 二重クローズ（＝報酬の二重付与）を防ぐ
    this.active = false;
    this.root.classList.remove('shown');
    this.onFinish?.(correct);
  }

  // ---- 選択肢ボタン（1つ選ぶタイプ） ----
  buildChoices(values, correct, format = (v) => String(v)) {
    this.correct = correct;
    for (const v of values) {
      const btn = document.createElement('button');
      btn.className = 'quiz-btn';
      btn.textContent = format(v);
      btn.dataset.value = String(v);
      btn.addEventListener('click', () => {
        if (this.judged) return;
        this.judged = true;
        const ok = v === correct;
        for (const b of this.answersEl.children) {
          b.disabled = true;
          if (b.dataset.value === String(correct)) b.classList.add('correct');
        }
        if (!ok) btn.classList.add('wrong');
        this.feedbackEl.textContent = ok
          ? PRAISES[rand(PRAISES.length)]
          : `ざんねん！ こたえは ${format(correct)} だよ`;
        this.feedbackEl.className = ok ? 'good' : 'bad';
        setTimeout(() => this.close(ok), ok ? 1300 : 2000);
      });
      this.answersEl.appendChild(btn);
    }
    this.judged = false;
  }

  // ---- タイプ1: 10のあつまり ----
  buildTens() {
    if (Math.random() < 0.5) {
      // 「10を Nこ あつめた かずは？」（N は 12〜39 で繰り上がりを意識）
      const n = 12 + rand(28);
      const answer = n * 10;
      const options = shuffle([...new Set([answer, n, answer - 10, answer + 10])]);
      this.qEl.textContent = `10を ${n}こ あつめた かずは？`;
      this.buildChoices(options, answer);
    } else {
      // 「M は、10を なんこ あつめた かず？」
      const n = 12 + rand(28);
      const m = n * 10;
      const options = shuffle([...new Set([n, n - 1, n + 1, m])]);
      this.qEl.textContent = `${m}は、10を なんこ あつめた かず？`;
      this.buildChoices(options, n, (v) => `${v}こ`);
    }
  }

  // ---- タイプ2: 数直線 ----
  buildLine() {
    let start, end, minor, labelStep, value, options;
    if (Math.random() < 0.5) {
      // 0〜450 / めもり10
      start = 0; end = 450; minor = 10; labelStep = 100;
      do value = 10 * (1 + rand(44)); while (value % 100 === 0);
      options = [value, value - 10, value + 10, value + 100 <= end ? value + 100 : value - 100];
    } else {
      // 950〜1000 / めもり1（1000ちかくの数）
      start = 950; end = 1000; minor = 1; labelStep = 10;
      do value = 951 + rand(49); while (value % 10 === 0);
      options = [value, value - 1, value + 1, value + 10 <= end ? value + 10 : value - 10];
    }
    this.qEl.textContent = '⬆ の めもりが あらわす かずは？';
    this.drawNumberLine(start, end, minor, labelStep, value);
    this.canvas.style.display = 'block';
    this.buildChoices(shuffle([...new Set(options)]), value);
  }

  drawNumberLine(start, end, minor, labelStep, value) {
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width;   // 1200 (表示は1/2)
    const H = this.canvas.height;  // 240
    ctx.clearRect(0, 0, W, H);
    const left = 70, right = W - 70, y = 120;
    const x = (v) => left + ((v - start) / (end - start)) * (right - left);

    // 本線
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(left - 20, y);
    ctx.lineTo(right + 20, y);
    ctx.stroke();

    // めもり
    for (let v = start; v <= end; v += minor) {
      const big = v % labelStep === 0;
      ctx.lineWidth = big ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(x(v), y);
      ctx.lineTo(x(v), y - (big ? 42 : 24));
      ctx.stroke();
      if (big) {
        ctx.font = 'bold 34px "Hiragino Maru Gothic ProN", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(String(v), x(v), y - 56);
      }
    }

    // 矢印（テストと同じく下から⬆）
    const ax = x(value);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(ax, y + 14);
    ctx.lineTo(ax - 20, y + 52);
    ctx.lineTo(ax + 20, y + 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(ax - 7, y + 48, 14, 40);
  }

  // ---- タイプ3: 大小くらべ（□に入る数字をぜんぶ選ぶ） ----
  buildCompare() {
    // L ＜ h□o2 の形（hは同じ百の位）。答えが1〜9こになるまで作り直す
    let h, t, o, o2, valid;
    do {
      h = 1 + rand(9);
      t = rand(10);
      o = rand(10);
      o2 = Math.random() < 0.5 ? o : rand(10); // ときどき一の位が同じ「ひっかけ」
      valid = [];
      for (let d = 0; d <= 9; d++) {
        if (d * 10 + o2 > t * 10 + o) valid.push(d);
      }
    } while (valid.length === 0 || valid.length === 10);
    const L = h * 100 + t * 10 + o;
    this.validSet = new Set(valid);

    this.qEl.innerHTML =
      `<span class="cmp">${L}</span> ＜ <span class="cmp">${h}<span class="hole">□</span>${o2}</span>`;
    this.subEl.textContent = '□に あてはまる すうじを ぜんぶ えらんでね（1つだけとは かぎらないよ！）';

    for (let d = 0; d <= 9; d++) {
      const btn = document.createElement('button');
      btn.className = 'quiz-btn small';
      btn.textContent = String(d);
      btn.dataset.value = String(d);
      btn.addEventListener('click', () => {
        if (this.judged) return;
        if (this.selected.has(d)) {
          this.selected.delete(d);
          btn.classList.remove('sel');
        } else {
          this.selected.add(d);
          btn.classList.add('sel');
        }
      });
      this.answersEl.appendChild(btn);
    }
    this.confirmBtn.style.display = 'inline-block';
    this.judged = false;
  }

  judgeCompare() {
    if (this.type !== 'compare' || this.judged || !this.active) return;
    this.judged = true;
    const ok =
      this.selected.size === this.validSet.size &&
      [...this.selected].every((d) => this.validSet.has(d));
    for (const b of this.answersEl.children) {
      const d = Number(b.dataset.value);
      b.disabled = true;
      if (this.validSet.has(d)) b.classList.add('correct');
      else if (this.selected.has(d)) b.classList.add('wrong');
    }
    this.confirmBtn.style.display = 'none';
    const answerText = [...this.validSet].sort((a, b) => a - b).join('・');
    this.feedbackEl.textContent = ok
      ? PRAISES[rand(PRAISES.length)]
      : `ざんねん！ こたえは ${answerText} だよ`;
    this.feedbackEl.className = ok ? 'good' : 'bad';
    setTimeout(() => this.close(ok), ok ? 1300 : 2400);
  }
}

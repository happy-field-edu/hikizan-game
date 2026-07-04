const messageEl = document.getElementById('message');
const gaugeFillEl = document.getElementById('gauge-fill');
const levelEl = document.getElementById('level');

export function setGauge(value, max) {
  gaugeFillEl.style.width = `${Math.min(100, (value / max) * 100)}%`;
}

export function setLevel(n) {
  levelEl.textContent = `Lv.${n}`;
}

export function setMessage(text, cls = '') {
  messageEl.textContent = text;
  messageEl.className = cls;
  // ポップアニメーションを再トリガー
  void messageEl.offsetWidth;
  messageEl.classList.add('pop');
}

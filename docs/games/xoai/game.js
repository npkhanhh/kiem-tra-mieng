const STRINGS = {
  fallen: 'XOÀI RỤNG RỒI!',
  next: 'Gọi tiếp',
  chant: 'LĂNG BA VÍ BỘ!',
  heave: 'HẦY-A!',
  thud: 'BỊCH!',
  hurry: 'Anh Bèo chọc lẹ lên!',
  start: '🥭 Bắt đầu!',
  again: '🥭 Chơi lượt mới!',
  empty: 'Hết người rồi',
  players: 'Người chơi',
  total: n => `${n} bạn`,
  modeNum: 'Dùng số thứ tự',
  modeName: 'Dùng tên',
  numCount: 'Số học sinh',
  namesHint: 'Mỗi dòng một tên, có thể dán cả danh sách lớp.',
  noRepeat: 'Bạn đã được gọi thì nghỉ lượt sau',
  history: 'Đã được gọi',
  historyEmpty: 'Chưa có ai.',
  regrow: 'Làm lại từ đầu',
  left: (n, total) => `Còn ${n}/${total} bạn chưa được gọi`,
  allCalled: 'Mọi bạn đều đã được gọi. Bấm "Làm lại từ đầu".',
};

const SVGNS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'kiem-tra-mieng:class';
const POLE_BASE = { x: 300, y: 690 };
const POLE_REST = { x: 560, y: 330 };
const PLATE = { x: 760, y: 790 };
const CANOPY = { cx: 960, cy: 300, rx: 520, ry: 230 };

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const easeOut = t => 1 - (1 - t) ** 3;
const easeIn = t => t * t;
const lerp = (a, b, t) => a + (b - a) * t;

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function tween(ms, fn, ease = t => t) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const frame = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

const state = loadState();

function loadState() {
  const fallback = {
    mode: 'num',
    numCount: 20,
    names: [],
    perRound: 1,
    noRepeat: true,
    called: [],
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORE_KEY)) };
  } catch {
    return fallback;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {}
}

function players() {
  if (state.mode === 'num') return Array.from({ length: state.numCount }, (_, i) => String(i + 1));
  return [...new Set(state.names)];
}

function pool() {
  const all = players();
  return state.noRepeat ? all.filter(n => !state.called.includes(n)) : all;
}

// Sound

let audio;
let muted = false;

function ctx() {
  audio ??= new AudioContext();
  return audio;
}

function tone(freq, dur, { type = 'sine', vol = 0.15, to = freq, delay = 0 } = {}) {
  if (muted) return;
  const a = ctx();
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function whoosh(dur = 0.35) {
  if (muted) return;
  const a = ctx();
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, a.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2500, a.currentTime + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.25, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

const sfx = {
  tick: () => tone(1100, 0.05, { type: 'square', vol: 0.04 }),
  jab: () => tone(260, 0.12, { type: 'triangle', vol: 0.2, to: 120 }),
  fall: () => tone(900, 0.6, { type: 'sine', vol: 0.08, to: 200 }),
  thud: () => {
    tone(150, 0.3, { vol: 0.6, to: 45 });
    whoosh(0.15);
  },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.11 })),
};

// Scene

function drawCanopy() {
  const g = $('canopy');
  const rand = seeded(7);
  const layers = [
    { color: '#2f6b2a', count: 46, r: [70, 110], dx: 0, dy: 0, spread: 1 },
    { color: '#3f8f35', count: 40, r: [50, 85], dx: -10, dy: -14, spread: 0.92 },
    { color: '#5cad45', count: 30, r: [26, 50], dx: -22, dy: -28, spread: 0.85 },
  ];
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * layer.spread;
      svg('circle', {
        cx: CANOPY.cx + Math.cos(a) * d * (CANOPY.rx + 20) + layer.dx,
        cy: CANOPY.cy + Math.sin(a) * d * (CANOPY.ry + 10) + layer.dy,
        r: lerp(layer.r[0], layer.r[1], rand()),
        fill: layer.color,
      }, g);
    }
  }
}

function drawSpeckles() {
  const g = $('speckles');
  const rand = seeded(3);
  for (let i = 0; i < 70; i++) {
    const x = lerp(700, 820, rand());
    const top = 784 + Math.abs(x - 760) * 0.55;
    svg('circle', {
      cx: x,
      cy: lerp(top + 4, 822, rand()),
      r: lerp(1.2, 3, rand()),
      fill: rand() < 0.5 ? '#b3361a' : '#f7a26b',
    }, g);
  }
}

function canopySlots(count) {
  const rand = seeded(11);
  for (let s = 1; s >= 0.45; s -= 0.05) {
    const sx = 112 * s;
    const sy = 104 * s;
    const slots = [];
    let row = 0;
    for (let y = CANOPY.cy - CANOPY.ry + 40 * s; y < CANOPY.cy + CANOPY.ry - 20; y += sy, row++) {
      for (let x = CANOPY.cx - CANOPY.rx + (row % 2) * sx / 2; x < CANOPY.cx + CANOPY.rx; x += sx) {
        const nx = (x - CANOPY.cx) / CANOPY.rx;
        const ny = (y - CANOPY.cy) / CANOPY.ry;
        if (nx * nx + ny * ny < 0.9) slots.push({ x: x + (rand() - 0.5) * 14 * s, y: y + (rand() - 0.5) * 12 * s });
      }
    }
    if (slots.length >= count) {
      const picked = Array.from({ length: count }, (_, i) => slots[Math.floor(i * slots.length / count)]);
      return { slots: picked, scale: s };
    }
  }
  throw new Error('Too many names for the tree');
}

function makeMango(name) {
  const g = svg('g', { class: 'mango' });
  const body = svg('g', { class: 'body' }, g);
  svg('path', { d: 'M2 -34 Q5 -44 0 -50', stroke: '#5d4026', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' }, body);
  svg('path', { d: 'M2 -44 C14 -58 32 -52 36 -44 C24 -36 10 -38 2 -44Z', fill: '#4caf50' }, body);
  svg('path', {
    d: 'M2 -34 C24 -34 32 -10 29 10 C26 30 10 38 -6 37 C-22 35 -30 18 -29 0 C-28 -20 -16 -34 2 -34Z',
    fill: 'url(#mango)',
    stroke: '#d08a00',
    'stroke-width': 1.5,
  }, body);
  svg('ellipse', { cx: 14, cy: -22, rx: 12, ry: 7, fill: '#9ccc3c', opacity: 0.45, transform: 'rotate(30 14 -22)' }, body);
  for (const x of [-9, 9]) {
    svg('ellipse', { cx: x, cy: -2, rx: 4, ry: 5.5, fill: '#3b2410' }, body);
    svg('circle', { cx: x + 1.4, cy: -4.2, r: 1.6, fill: '#fff' }, body);
    svg('circle', { cx: x * 1.9, cy: 9, r: 5, fill: '#ff8a80', opacity: 0.6 }, body);
  }
  svg('path', { class: 'happy', d: 'M-6 9 Q0 15 6 9', stroke: '#3b2410', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, body);
  svg('ellipse', { class: 'scared', cx: 0, cy: 12, rx: 4, ry: 5, fill: '#3b2410' }, body);

  const label = svg('g', { class: 'label' });
  const rect = svg('rect', { y: 42, height: 22, rx: 7 }, label);
  const text = svg('text', { y: 58, 'text-anchor': 'middle' }, label);
  return { g, label, rect, text, name, x: 0, y: 0, s: 1, r: 0 };
}

function place(m) {
  m.g.setAttribute('transform', `translate(${m.x} ${m.y}) rotate(${m.r}) scale(${m.s})`);
  m.label.setAttribute('transform', `translate(${m.x} ${m.y}) scale(${m.s})`);
}

function sizeLabel(m, maxWidth = Infinity) {
  let text = m.name;
  m.text.textContent = text;
  while (m.text.getComputedTextLength() > maxWidth && text.length > 1) {
    text = text.slice(0, -1);
    m.text.textContent = text.trimEnd() + '…';
  }
  const w = m.text.getComputedTextLength() + 16;
  m.rect.setAttribute('x', -w / 2);
  m.rect.setAttribute('width', w);
}

let mangoes = [];

function renderTree() {
  const layer = $('tree-mangoes');
  const labels = $('tree-labels');
  layer.replaceChildren();
  labels.replaceChildren();
  $('fallen').replaceChildren();
  const all = players();
  const { slots, scale } = canopySlots(all.length);
  const waiting = new Set(pool());
  mangoes = all.map((name, i) => {
    const m = makeMango(name);
    Object.assign(m, slots[i], { s: scale });
    m.g.querySelector('.body').style.animationDelay = `${-Math.random() * 3}s`;
    place(m);
    m.onTree = waiting.has(name);
    if (m.onTree) {
      layer.appendChild(m.g);
      labels.appendChild(m.label);
      sizeLabel(m, 100);
    }
    return m;
  });
  updateUI();
}

function updateUI() {
  const all = players();
  const left = pool().length;
  $('counter').textContent = state.noRepeat ? STRINGS.left(left, all.length) : STRINGS.total(all.length);
  $('total').textContent = STRINGS.total(all.length);
  const shake = $('shake');
  shake.textContent = !left ? STRINGS.empty : state.called.length ? STRINGS.again : STRINGS.start;
  shake.disabled = busy || !left;
  const history = $('history');
  history.replaceChildren(...state.called.slice().reverse().map(n => Object.assign(document.createElement('li'), { textContent: n })));
  history.reversed = true;
  history.start = state.called.length;
}

// Pole and kids

const pole = { x: POLE_REST.x, y: POLE_REST.y };

function drawPole() {
  const dx = pole.x - POLE_BASE.x;
  const dy = pole.y - POLE_BASE.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const line = $('pole');
  line.setAttribute('x1', POLE_BASE.x);
  line.setAttribute('y1', POLE_BASE.y);
  line.setAttribute('x2', pole.x);
  line.setAttribute('y2', pole.y);
  const h1 = { x: POLE_BASE.x + ux * 70, y: POLE_BASE.y + uy * 70 };
  const h2 = { x: POLE_BASE.x + ux * 130, y: POLE_BASE.y + uy * 130 };
  $('arm1').setAttribute('d', `M316 600 Q300 640 ${h1.x} ${h1.y}`);
  $('arm2').setAttribute('d', `M346 600 Q360 600 ${h2.x} ${h2.y}`);
}

function movePole(to, ms, ease = easeOut) {
  const from = { ...pole };
  return tween(ms, t => {
    pole.x = lerp(from.x, to.x, t);
    pole.y = lerp(from.y, to.y, t);
    drawPole();
  }, ease);
}

function say(x, y, text, ms = 1800) {
  const g = svg('g', { class: 'bubble' }, $('bubbles'));
  const rect = svg('rect', { rx: 18, height: 46 }, g);
  svg('path', { d: `M${x - 10} ${y - 2} L${x} ${y + 22} L${x + 14} ${y - 2}Z` }, g);
  const t = svg('text', { x, y: y - 14, 'text-anchor': 'middle' }, g);
  t.textContent = text;
  const w = t.getComputedTextLength() + 36;
  rect.setAttribute('x', x - w / 2);
  rect.setAttribute('y', y - 46);
  rect.setAttribute('width', w);
  setTimeout(() => g.remove(), ms);
}

async function shout(text, x = 800, y = 420, ms = 900) {
  const el = $('shout');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.textContent = text;
  el.classList.remove('pop');
  void el.getBBox();
  el.classList.add('pop');
  await sleep(ms * 0.6);
}

function splash(x, y) {
  const layer = $('particles');
  const bits = Array.from({ length: 26 }, () => ({
    node: svg('circle', { r: 2 + Math.random() * 3, fill: Math.random() < 0.5 ? '#e5602b' : '#b3361a' }, layer),
    vx: (Math.random() - 0.5) * 520,
    vy: -200 - Math.random() * 300,
  }));
  tween(700, t => {
    const s = t * 0.7;
    for (const b of bits) {
      b.node.setAttribute('cx', x + b.vx * s);
      b.node.setAttribute('cy', y + b.vy * s + 900 * s * s);
      b.node.setAttribute('opacity', 1 - t);
    }
  }).then(() => bits.forEach(b => b.node.remove()));
}

// Round

let busy = false;

function pick(count) {
  const onTree = mangoes.filter(m => m.onTree);
  const picks = [];
  for (let i = 0; i < Math.min(count, onTree.length); i++) {
    picks.push(onTree.splice(randomInt(onTree.length), 1)[0]);
  }
  return picks;
}

async function roll(target) {
  const onTree = mangoes.filter(m => m.onTree);
  const steps = 16;
  let last;
  for (let i = 0; i < steps; i++) {
    const m = i === steps - 1 ? target : onTree.filter(c => c !== last)[randomInt(Math.max(1, onTree.length - 1))] || target;
    last?.g.classList.remove('hot');
    m.g.classList.add('hot');
    last = m;
    sfx.tick();
    const delay = lerp(70, 360, (i / steps) ** 2);
    await movePole({ x: m.x - 40, y: m.y + 40 }, delay * 0.9);
    await sleep(delay * 0.1);
  }
}

async function jab(m) {
  $('beo-mouth').setAttribute('d', 'M322 566 Q331 584 340 566Z');
  const hit = { x: m.x - 8, y: m.y + 8 };
  const back = { x: m.x - 70, y: m.y + 70 };
  for (let i = 0; i < 3; i++) {
    await movePole(back, 140);
    sfx.jab();
    await movePole(hit, 90, easeIn);
  }
  $('beo-mouth').setAttribute('d', 'M322 568 Q331 576 340 568');
}

async function drop(m, slot, total) {
  m.onTree = false;
  $('fallen').append(m.g, m.label);
  m.g.classList.remove('hot');
  m.g.classList.add('fallen');
  m.label.classList.add('fallen');
  m.label.setAttribute('opacity', 0);
  const from = { x: m.x, y: m.y, s: m.s };
  const to = { x: PLATE.x + (slot - (total - 1) / 2) * 125, y: PLATE.y - slot * 4, s: 1.35 };
  const spin = (randomInt(2) ? 1 : -1) * (300 + randomInt(120));
  movePole(POLE_REST, 500);
  sfx.fall();
  await tween(650, t => {
    m.x = lerp(from.x, to.x, t);
    m.y = lerp(from.y, to.y, easeIn(t));
    m.s = lerp(from.s, to.s, t);
    m.r = spin * t;
    place(m);
  });
  m.r = 0;
  sfx.thud();
  splash(to.x, to.y + 20);
  shout(STRINGS.thud, to.x, to.y - 70, 700);
  await tween(260, t => {
    const k = Math.sin(t * Math.PI);
    m.g.setAttribute('transform', `translate(${m.x} ${m.y + k * 8}) scale(${m.s * (1 + k * 0.18)} ${m.s * (1 - k * 0.18)})`);
  });
  place(m);
  sizeLabel(m);
  m.label.removeAttribute('opacity');
}

async function round() {
  if (busy) return;
  if (!pool().length) {
    toast(STRINGS.allCalled);
    return;
  }
  busy = true;
  $('shake').disabled = true;
  ctx().resume();

  const old = [...$('fallen').children];
  if (old.length) {
    await tween(250, t => old.forEach(n => n.setAttribute('opacity', 1 - t)));
    renderTree();
  }

  const picks = pick(state.perRound);
  say(600, 590, STRINGS.hurry, 2200);
  for (const [i, m] of picks.entries()) {
    await roll(m);
    await shout(STRINGS.chant);
    await sleep(250);
    shout(STRINGS.heave);
    await jab(m);
    await drop(m, i, picks.length);
    await sleep(350);
  }

  state.called.push(...picks.map(m => m.name));
  saveState();
  updateUI();
  $('redkid').classList.add('cheer');
  $('beo').classList.add('cheer');
  sfx.fanfare();
  showResult(picks.map(m => m.name));
}

function showResult(names) {
  const box = $('result-names');
  box.replaceChildren(...names.map(n => Object.assign(document.createElement('div'), { textContent: n })));
  $('result').hidden = false;
  $('next').focus();
}

function closeResult() {
  $('result').hidden = true;
  $('redkid').classList.remove('cheer');
  $('beo').classList.remove('cheer');
  busy = false;
  updateUI();
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3000);
}

// Settings

function showMode() {
  for (const r of document.querySelectorAll('input[name=mode]')) r.checked = r.value === state.mode;
  for (const r of document.querySelectorAll('input[name=per-round]')) r.checked = Number(r.value) === state.perRound;
  $('num-box').hidden = state.mode !== 'num';
  $('name-box').hidden = state.mode !== 'name';
  $('num-range').value = state.numCount;
  $('num-out').textContent = state.numCount;
}

function openSettings() {
  if (busy) return;
  $('names').value = state.names.join('\n');
  $('no-repeat').checked = state.noRepeat;
  showMode();
  $('settings').showModal();
}

function changed() {
  saveState();
  showMode();
  renderTree();
}

function regrow() {
  state.called = [];
  changed();
}

function bindSettings() {
  for (const r of document.querySelectorAll('input[name=mode]')) {
    r.addEventListener('change', () => {
      state.mode = r.value;
      state.called = [];
      changed();
    });
  }
  for (const r of document.querySelectorAll('input[name=per-round]')) {
    r.addEventListener('change', () => {
      state.perRound = Number(r.value);
      changed();
    });
  }
  $('num-range').addEventListener('input', e => {
    state.numCount = Number(e.target.value);
    changed();
  });
  $('names').addEventListener('input', e => {
    state.names = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
    changed();
  });
  $('no-repeat').addEventListener('change', e => {
    state.noRepeat = e.target.checked;
    changed();
  });
  $('regrow').addEventListener('click', regrow);
  $('close-settings').addEventListener('click', () => $('settings').close());
}

// Start

for (const node of document.querySelectorAll('[data-s]')) node.textContent = STRINGS[node.dataset.s];
$('history').dataset.empty = STRINGS.historyEmpty;

drawCanopy();
drawSpeckles();
drawPole();
bindSettings();

$('shake').addEventListener('click', round);
$('next').addEventListener('click', closeResult);
$('open-settings').addEventListener('click', openSettings);
$('mute').addEventListener('click', () => {
  muted = !muted;
  $('mute').textContent = muted ? '🔇' : '🔊';
});
document.addEventListener('keydown', e => {
  if ($('settings').open) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!$('result').hidden) closeResult();
    else round();
  }
});

document.fonts.ready.then(renderTree);

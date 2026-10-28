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
const PLATE = { x: 360, y: 782 };
const CANOPY = { cx: 1085, cy: 250, rx: 495, ry: 170 };
const GROUND_Y = 845;
const BEO_REST_X = 640;
// Hand positions are pixels in the Bèo images as cropped by build-art.sh.
const BEO = {
  k: 340 / 1169,
  foot: { x: 576, y: 1169 },
  hands: {
    ready: [{ x: 857, y: 198 }, { x: 944, y: 21 }],
    poke: [{ x: 1037, y: 213 }, { x: 1105, y: 35 }],
  },
};
const POLE = { length: 2103, shaft: 60, thick: 16, back: 60 };

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
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

function canopySlots(count) {
  const rand = seeded(11);
  for (let s = 1; s >= 0.45; s -= 0.05) {
    const sx = 108 * s;
    const sy = 112 * s;
    const slots = [];
    let row = 0;
    for (let y = CANOPY.cy - CANOPY.ry + 30 * s; y < CANOPY.cy + CANOPY.ry; y += sy, row++) {
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
  for (const face of ['happy', 'scared']) {
    svg('image', { class: face, href: `art/mango-${face}.webp`, x: -23.8, y: -49.8, width: 56.4, height: 80 }, body);
  }

  const label = svg('g', { class: 'label' });
  const rect = svg('rect', { y: 34, height: 22, rx: 7 }, label);
  const text = svg('text', { y: 50, 'text-anchor': 'middle' }, label);
  return { g, label, rect, text, name, x: 0, y: 0, s: 1, r: 0, labelDy: 0 };
}

function place(m) {
  m.g.setAttribute('transform', `translate(${m.x} ${m.y}) rotate(${m.r}) scale(${m.s})`);
  m.label.setAttribute('transform', `translate(${m.x} ${m.y + m.labelDy * m.s}) scale(${m.s})`);
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

const beo = { x: BEO_REST_X, y: GROUND_Y, pose: 'ready', reach: 130 };

function grip(pose) {
  const [low, high] = BEO.hands[pose].map(p => ({ x: (p.x - BEO.foot.x) * BEO.k, y: (p.y - BEO.foot.y) * BEO.k }));
  const len = Math.hypot(high.x - low.x, high.y - low.y);
  return { low, d: { x: (high.x - low.x) / len, y: (high.y - low.y) / len } };
}

function drawBeo() {
  const { low, d } = grip(beo.pose);
  const angle = Math.atan2(d.y, d.x) * 180 / Math.PI;
  const sx = (POLE.back + beo.reach) / POLE.length;
  const sy = POLE.thick / POLE.shaft;
  $('pole').setAttribute('transform', `translate(${low.x - d.x * POLE.back} ${low.y - d.y * POLE.back}) rotate(${angle}) scale(${sx} ${sy})`);
  $('beo').setAttribute('transform', `translate(${beo.x} ${beo.y})`);
  $('beo').classList.toggle('poking', beo.pose === 'poke');
}

function aim(m) {
  const { low, d } = grip('poke');
  const reach = (m.y - GROUND_Y - low.y) / d.y;
  return { x: m.x - d.x * reach - low.x, reach };
}

function walkTo(spot) {
  const from = { x: beo.x, reach: beo.reach };
  const ms = 300 + Math.abs(spot.x - from.x) * 0.6;
  const steps = Math.max(1, Math.round(ms / 180));
  return tween(ms, t => {
    beo.x = lerp(from.x, spot.x, t);
    beo.y = GROUND_Y - Math.abs(Math.sin(t * Math.PI * steps)) * 12;
    beo.reach = lerp(from.reach, spot.reach, t);
    drawBeo();
  });
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
    await sleep(lerp(70, 360, (i / steps) ** 2));
  }
}

async function jab() {
  for (let i = 0; i < 3; i++) {
    beo.pose = 'poke';
    drawBeo();
    sfx.jab();
    await sleep(150);
    if (i === 2) break;
    beo.pose = 'ready';
    drawBeo();
    await sleep(200);
  }
}

async function drop(m, slot, total) {
  m.onTree = false;
  $('fallen').append(m.g, m.label);
  m.g.classList.remove('hot');
  m.g.classList.add('fallen');
  m.label.classList.add('fallen');
  m.label.setAttribute('opacity', 0);
  const from = { x: m.x, y: m.y, s: m.s };
  const to = { x: PLATE.x + (slot - (total - 1) / 2) * 80, y: PLATE.y - slot * 4, s: 1.35 };
  m.labelDy = slot % 2 ? -110 : 0;
  const spin = (randomInt(2) ? 1 : -1) * (300 + randomInt(120));
  setTimeout(() => {
    beo.pose = 'ready';
    drawBeo();
  }, 250);
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
  sizeLabel(m, 115);
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
  say(170, 500, STRINGS.hurry, 3500);
  for (const [i, m] of picks.entries()) {
    await roll(m);
    await walkTo(aim(m));
    await shout(STRINGS.chant);
    await sleep(250);
    shout(STRINGS.heave);
    await jab();
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

drawBeo();
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

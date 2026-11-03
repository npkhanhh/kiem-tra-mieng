const STRINGS = {
  fallen: 'XOÀI RỤNG RỒI!',
  next: 'Gọi tiếp',
  chant: 'LĂNG BA VÍ BỘ!',
  heave: 'HẦY-A!',
  thud: 'BỊCH!',
  hurry: 'Anh Bèo chọc lẹ lên!',
  huh: '?',
  what: '?!',
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
const ROW_HEIGHT = 112;
const PLAIN_CHANCE = 0.3;
// Wind blows in 3 of the 7 twist rounds, so in 3 of 10 rounds.
const WIND_CHANCE = 3 / 7;
const WIND_DROP_CHANCE = 0.6;
const BIRD_CHANCE = 0.15;
const AGAIN_CHANCE = 1 / 3;
const JUICE = ['#e5602b', '#b3361a'];
const LEAVES = ['#4f7f2a', '#7aa63a'];
const STARS = ['#fff59d', '#ffffff', '#ffd23f'];

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

const sounds = {};

function loadSounds() {
  for (const name of ['tick', 'knock', 'shake', 'rustle', 'swoosh', 'thud', 'bump', 'chime', 'wind']) {
    fetch(`sfx/${name}.mp3`)
      .then(res => res.arrayBuffer())
      .then(data => ctx().decodeAudioData(data))
      .then(buffer => (sounds[name] = buffer));
  }
}

function play(name, vol = 1) {
  if (muted || !sounds[name]) return;
  const a = ctx();
  const src = a.createBufferSource();
  src.buffer = sounds[name];
  const gain = a.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(a.destination);
  src.start();
}

// Scene

function canopySlots(count) {
  const rand = seeded(11);
  for (let s = 1; s >= 0.45; s -= 0.05) {
    const sx = 108 * s;
    const sy = ROW_HEIGHT * s;
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
    m.home = { ...slots[i], s: scale };
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

function beoSays(text, ms = 1200) {
  say(beo.x - 60, GROUND_Y - 365, text, ms);
}

async function shout(text, x = 800, y = 420, ms = 900, el = $('shout')) {
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.textContent = text;
  el.classList.remove('pop');
  void el.getBBox();
  el.classList.add('pop');
  await sleep(ms * 0.6);
}

function splash(x, y, colors = JUICE) {
  const layer = $('particles');
  const bits = Array.from({ length: 26 }, () => ({
    node: svg('circle', { r: 2 + Math.random() * 3, fill: colors[randomInt(colors.length)] }, layer),
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

// b is at least half a row below a, and sideways at most twice the drop.
function fallsOnto(a, b) {
  const drop = b.y - a.y;
  return drop > ROW_HEIGHT / 2 * a.s && Math.abs(b.x - a.x) <= 2 * drop;
}

const orders = list => list.length < 2 ? [list] : list.flatMap(m => orders(list.filter(o => o !== m)).map(rest => [m, ...rest]));

// All picks in a chain if they line up, else two of them, else undefined.
function findChain(picks) {
  const all = orders(picks);
  const full = all.filter(([a, b, c]) => b && fallsOnto(a, b) && (!c || c.y - b.y > -ROW_HEIGHT / 2 * b.s));
  const pairs = all.filter(([a, b]) => b && fallsOnto(a, b)).map(o => o.slice(0, 2));
  const found = full.length ? full : pairs;
  return found[Math.floor(Math.random() * found.length)];
}

function pick(count, skip = []) {
  const onTree = mangoes.filter(m => m.onTree && !skip.includes(m));
  const picks = [];
  for (let i = 0; i < Math.min(count, onTree.length); i++) {
    picks.push(onTree.splice(randomInt(onTree.length), 1)[0]);
  }
  return picks;
}

async function roll(target, steps) {
  const onTree = mangoes.filter(m => m.onTree);
  let last;
  for (let i = 0; i < steps; i++) {
    const m = i === steps - 1 ? target : onTree.filter(c => c !== last)[randomInt(Math.max(1, onTree.length - 1))] || target;
    last?.g.classList.remove('hot');
    m.g.classList.add('hot');
    last = m;
    play('tick', 0.5);
    await sleep(lerp(70, 360, (i / steps) ** 2));
  }
}

async function jab() {
  for (let i = 0; i < 3; i++) {
    beo.pose = 'poke';
    drawBeo();
    play('knock');
    await sleep(150);
    if (i === 2) break;
    beo.pose = 'ready';
    drawBeo();
    await sleep(200);
  }
}

// wind is null, 'blow' (a gust, then the poke) or 'drop' (Bèo aims at another mango and the gust takes m: the caller drops m).
async function attempt(m, steps, chant, wind) {
  const target = wind === 'drop' ? pick(1, [m])[0] ?? m : m;
  await roll(target, steps);
  await walkTo(aim(target));
  if (chant) {
    await shout(STRINGS.chant);
    await sleep(250);
  }
  if (wind) {
    gust();
    await sleep(900);
    if (wind === 'drop') {
      target.g.classList.remove('hot');
      beoSays(STRINGS.what, 1500);
      return;
    }
    await sleep(1400);
    beoSays(STRINGS.huh);
  }
  shout(STRINGS.heave);
  await jab();
}

// Leaves blow across the scene and the mangoes on the tree swing.
async function gust() {
  play('wind');
  const swinging = mangoes.filter(m => m.onTree);
  swinging.forEach(m => m.g.classList.add('gust'));
  const bits = Array.from({ length: 60 }, (_, i) => {
    const streak = i % 3 === 0;
    return {
      node: streak
        ? svg('rect', { x: -100, y: -2, width: 200, height: 4, rx: 2, fill: '#fff' }, $('particles'))
        : svg('ellipse', { rx: 16, ry: 6, fill: LEAVES[randomInt(LEAVES.length)], stroke: '#2f4f16', 'stroke-width': 1.5 }, $('particles')),
      streak,
      y: 40 + Math.random() * 600,
      delay: Math.random(),
      speed: (streak ? 1.6 : 1) + Math.random() * 0.6,
      phase: Math.random() * 6,
    };
  });
  await tween(2500, t => {
    for (const b of bits) {
      const p = t * 2 - b.delay;
      const x = -100 + p * 1700 * b.speed;
      const y = b.y + Math.sin(p * 9 + b.phase) * (b.streak ? 10 : 30);
      b.node.setAttribute('transform', `translate(${x} ${y})` + (b.streak ? '' : ` rotate(${p * 720})`));
      b.node.setAttribute('opacity', Math.min(b.streak ? 0.6 : 1, (1 - t) * 5));
    }
  });
  bits.forEach(b => b.node.remove());
  swinging.forEach(m => m.g.classList.remove('gust'));
}

function relax(ms) {
  setTimeout(() => {
    beo.pose = 'ready';
    drawBeo();
  }, ms);
}

async function resist(m) {
  relax(150);
  play('shake');
  splash(m.x, m.y, LEAVES);
  m.g.classList.add('wobble');
  await sleep(800);
  m.g.classList.remove('wobble', 'hot');
}

// The target is poked among the decoys, which all hold on. Poked last, it falls; poked earlier, it falls by itself after the last poke.
async function fakeOut(target, decoys, wind) {
  const pokes = [...decoys];
  pokes.splice(randomInt(pokes.length + 1), 0, target);
  for (const [i, m] of pokes.entries()) {
    await attempt(m, i ? 8 : 16, !i, i ? null : wind);
    if (m === target && i === pokes.length - 1) return;
    await resist(m);
    if (i === 0) {
      beoSays(STRINGS.huh);
      await sleep(600);
    } else if (i < pokes.length - 1) {
      say(170, 500, STRINGS.hurry, 2000);
      await sleep(700);
    }
  }
  await sleep(300);
  target.g.classList.add('loose');
  play('rustle');
  beoSays(STRINGS.what, 1500);
  await sleep(700);
  target.g.classList.remove('loose');
}

// m is poked, falls onto the target and catches in the branches. The caller drops the target.
async function snag(m, target, wind) {
  await attempt(m, 16, true, wind);
  await fling(m, target);
  bump(target);
  resist(m);
  beoSays(STRINGS.what, 1500);
  await sleep(250);
}

// A snag when a mango that was not picked hangs above m, else a fake-out with 1 or 2 decoys.
function twist(m, picks, wind) {
  const above = mangoes.filter(o => o.onTree && !picks.includes(o) && fallsOnto(o, m));
  if (above.length && randomInt(2)) return snag(above[randomInt(above.length)], m, wind);
  const decoys = pick(1 + randomInt(2), picks);
  if (decoys.length) return fakeOut(m, decoys, wind);
  return attempt(m, 16, true, wind);
}

function detach(m) {
  m.onTree = false;
  $('fallen').append(m.g, m.label);
  m.g.classList.remove('hot');
  m.g.classList.add('fallen');
  m.label.classList.add('fallen');
  m.label.setAttribute('opacity', 0);
}

// Flies m in an arc onto the side of target that faces it.
async function fling(m, target) {
  relax(250);
  play('swoosh');
  const from = { x: m.x, y: m.y };
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const gap = 60 * target.s / Math.hypot(dx, dy);
  const to = { x: target.x - dx * gap, y: target.y - dy * gap };
  const peak = Math.min(from.y, to.y) - 90;
  const spin = dx < 0 ? -360 : 360;
  await tween(350 + Math.hypot(dx, dy) * 0.5, t => {
    m.x = lerp(from.x, to.x, t);
    m.y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * peak + t * t * to.y;
    m.r = spin * t;
    place(m);
  });
  m.r = 0;
  place(m);
}

function bump(m, count) {
  play('bump');
  splash(m.x, m.y, STARS);
  if (count) shout(`×${count}!`, m.x, m.y - 70 * m.s, 900, $('combo'));
}

// One poke knocks the first mango onto the next, which falls onto the one after.
async function domino(chain, slot, total, wind) {
  await attempt(chain[0], 16, true, wind);
  const falls = [];
  for (const [i, m] of chain.entries()) {
    const next = chain[i + 1];
    if (next) {
      detach(m);
      await fling(m, next);
      bump(next, i + 2);
    }
    falls.push(drop(m, slot + i, total));
  }
  await Promise.all(falls);
  await sleep(350);
}

async function drop(m, slot, total) {
  detach(m);
  const from = { x: m.x, y: m.y, s: m.s };
  const to = { x: PLATE.x + (slot - (total - 1) / 2) * 80, y: PLATE.y - slot * 4, s: 1.35 };
  m.labelDy = slot % 2 ? -110 : 0;
  const spin = (randomInt(2) ? 1 : -1) * (300 + randomInt(120));
  relax(250);
  play('swoosh');
  await tween(650, t => {
    m.x = lerp(from.x, to.x, t);
    m.y = lerp(from.y, to.y, easeIn(t));
    m.s = lerp(from.s, to.s, t);
    m.r = spin * t;
    place(m);
  });
  m.r = 0;
  play('thud');
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

// Pokes m, with a stuck-mango or fake-out twist when twisted, and drops it onto the plate.
async function fall(m, slot, total, twisted, wind, picks) {
  if (twisted && wind !== 'drop') await twist(m, picks, wind);
  else await attempt(m, 16, true, wind);
  await drop(m, slot, total);
  await sleep(350);
}

const blowOrDrop = () => Math.random() < WIND_DROP_CHANCE ? 'drop' : 'blow';

// Bird

const bird = { x: 0, y: 0 };
const hang = s => 45 * s;

function drawBird() {
  $('bird').setAttribute('transform', `translate(${bird.x} ${bird.y})`);
}

// Flies the bird to (x, y) on a curve sag pixels below the straight line. A carried mango m hangs from its feet and shrinks to its tree size.
function fly(x, y, ms, sag, m) {
  const from = { x: bird.x, y: bird.y, s: m?.s };
  $('bird').firstElementChild.setAttribute('transform', x < from.x ? 'scale(-1 1)' : '');
  return tween(ms, t => {
    bird.x = lerp(from.x, x, t);
    bird.y = lerp(from.y, y, t) + Math.sin(t * Math.PI) * sag;
    drawBird();
    if (!m) return;
    m.s = lerp(from.s, m.home.s, t);
    m.x = bird.x;
    m.y = bird.y + hang(m.s);
    place(m);
  });
}

// A bird swoops down to the plate, takes m and hangs it back on its branch.
async function rescue(m) {
  Object.assign(bird, { x: 1750, y: -120 });
  drawBird();
  $('bird').toggleAttribute('hidden', false);
  play('swoosh');
  await fly(m.x, m.y - hang(m.s), 1100, 150);
  m.label.setAttribute('opacity', 0);
  m.g.classList.remove('fallen');
  beoSays(STRINGS.what, 1500);
  await sleep(300);
  play('swoosh');
  await fly(m.home.x, m.home.y - hang(m.home.s), 1300, -120, m);
  m.onTree = true;
  m.labelDy = 0;
  $('tree-mangoes').append(m.g);
  $('tree-labels').append(m.label);
  m.label.classList.remove('fallen');
  m.label.removeAttribute('opacity');
  sizeLabel(m, 100);
  place(m);
  play('rustle');
  await fly(1750, -150, 900, 0);
  $('bird').toggleAttribute('hidden', true);
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
  const plain = Math.random() < PLAIN_CHANCE;
  const chain = plain ? undefined : findChain(picks);
  const groups = picks.filter(m => !chain?.includes(m)).map(m => [m]);
  if (chain) groups.splice(randomInt(2) ? groups.length : 0, 0, chain);
  const order = groups.flat();
  const windAt = !plain && Math.random() < WIND_CHANCE ? randomInt(groups.length) : -1;
  const wind = blowOrDrop();
  // Without a chain, the first mango that the wind does not drop gets a twist.
  const twistAt = chain || plain ? -1 : groups.findIndex((_, i) => i !== windAt || wind !== 'drop');
  let birdReady = !plain;
  say(170, 500, STRINGS.hurry, 3500);
  for (const [i, group] of groups.entries()) {
    const slot = order.indexOf(group[0]);
    const gusting = i === windAt ? wind : null;
    if (group.length > 1) await domino(group, slot, order.length, gusting);
    else await fall(group[0], slot, order.length, i === twistAt, gusting, picks);
    const saved = birdReady && group.find(() => Math.random() < BIRD_CHANCE);
    if (!saved) continue;
    birdReady = false;
    await rescue(saved);
    // A new pick falls in place of the saved mango. Sometimes it is the saved mango again.
    const [other] = pick(1, picks);
    const spare = other && Math.random() >= AGAIN_CHANCE ? other : saved;
    if (spare !== saved) picks.push(spare);
    order[order.indexOf(saved)] = spare;
    await fall(spare, slot + group.indexOf(saved), order.length, true, Math.random() < WIND_CHANCE ? blowOrDrop() : null, picks);
  }

  state.called.push(...order.map(m => m.name));
  saveState();
  updateUI();
  $('redkid').classList.add('cheer');
  $('beo').classList.add('cheer');
  play('chime');
  showResult(order.map(m => m.name));
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
loadSounds();

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

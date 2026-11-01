import { generate, pathBetween, normalizeWord, validPuzzle, SHAPES } from './engine.js';

// Word Search: setup screen (theme, word count, clock) → play screen (grid fills the width, word list below).
const $ = (id) => document.getElementById(id);
const KEY = 'jerm747-word-search-topics-v2';          // same key as before, so saved puzzles carry over
const PREFS = 'jerm747-word-search-setup-v1';
const LEVEL = { 15: 'Easy', 30: 'Medium', 60: 'Hard' };
const TIME_LIMIT = { 15: 300, 30: 600, 60: 1200 };     // seconds for Timed mode
const COLORS = ['#ffd278', '#6fe3cf', '#ff9ec8', '#a7a3ff', '#ffb27a', '#8fe388', '#7cc7ff', '#f6a3ff'];

let topics = [], state = null, letters = [];
let anchor = null, start = null, current = [], pointer = null, dragged = false, hintCell = null, hintTimer = 0, tick = 0;
let picked = new Set();

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const save = () => { if (state) store.set(KEY, state); };
const finished = () => state && (state.found.length === state.words.length || state.ended);
const say = (t) => { $('status').textContent = t; };

/* ---------------- Setup ---------------- */
function choice(name) { return document.querySelector(`[name="${name}"]:checked`)?.value; }
function topic() { return topics.find((t) => t.id === choice('theme')) || topics[0]; }

function buildSetup() {
  const prefs = store.get(PREFS) || {};
  $('themes').replaceChildren(...topics.map((t, i) => {
    const label = document.createElement('label');
    label.className = 'theme';
    const sample = shuffle(t.words).slice(0, 3).join(' · ');
    label.innerHTML = `<input type="radio" name="theme" value="${t.id}"><b></b><span></span>`;
    label.querySelector('b').textContent = t.title;
    label.querySelector('span').textContent = sample;
    label.querySelector('input').checked = prefs.theme ? prefs.theme === t.id : i === 0;
    return label;
  }));
  if (prefs.count) document.querySelector(`[name="count"][value="${prefs.count}"]`)?.click();
  if (prefs.clock) document.querySelector(`[name="clock"][value="${prefs.clock}"]`)?.click();
  for (const el of document.querySelectorAll('[name="theme"],[name="count"],[name="clock"]')) el.addEventListener('change', syncSetup);
  syncSetup();
  $('start-btn').disabled = false;
}

function syncSetup() {
  const count = +choice('count');
  $('timed-note').textContent = `${TIME_LIMIT[count] / 60} minutes`;
  for (const w of [...picked]) if (!topic().words.includes(w)) picked.delete(w);
  fillPicker();
  $('setup-error').textContent = '';
}

function fillPicker() {
  const count = +choice('count');
  $('picker').replaceChildren(...topic().words.map((w) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.value = w; input.checked = picked.has(w);
    input.onchange = () => { input.checked ? picked.add(w) : picked.delete(w); countPicked(); };
    label.append(input, w);
    return label;
  }));
  countPicked();
  function countPicked() { $('picked-count').textContent = `${picked.size} of ${count} chosen. Leave this closed to get a random set.`; }
}
$('clear-picked').onclick = () => { picked.clear(); fillPicker(); };
$('fill-picked').onclick = () => {
  const count = +choice('count');
  picked = new Set([...picked].slice(0, count));
  for (const w of shuffle(topic().words.filter((w) => !picked.has(w)))) { if (picked.size >= count) break; picked.add(w); }
  fillPicker();
};

$('setup-form').onsubmit = (e) => {
  e.preventDefault();
  const t = topic(), count = +choice('count'), timed = choice('clock') === 'timed';
  const custom = $('own-words').open && picked.size > 0;
  if (custom && picked.size !== count) { $('setup-error').textContent = `Pick exactly ${count} words, or use "Fill the rest randomly".`; return; }
  const words = custom ? [...picked] : shuffle(t.words).slice(0, count);
  store.set(PREFS, { theme: t.id, count, clock: timed ? 'timed' : 'untimed' });
  newPuzzle(words, t, timed);
};

function newPuzzle(words, t, timed) {
  try {
    // Phones held upright get a tall grid (bigger letters); everything else gets a square one.
    const tall = matchMedia('(orientation: portrait) and (max-width: 700px)').matches;
    const g = generate(words, Math.random, (tall ? SHAPES.tall : SHAPES.square)[words.length]);
    state = { ...g, words: [...words], topicId: t.id, title: t.title, timed, limit: timed ? TIME_LIMIT[words.length] : 0, ended: false };
    save(); play();
  } catch { $('setup-error').textContent = 'Those words could not fit together. Try again or pick a different set.'; }
}

function showSetup() {
  stopClock();
  $('play').hidden = true; $('setup').hidden = false;
  const resumable = state && !finished();
  $('resume').hidden = !resumable;
  if (resumable) {
    $('resume-title').textContent = `Continue ${state.title}`;
    $('resume-detail').textContent = `${state.found.length}/${state.words.length} found · ${state.timed ? fmt(state.limit - state.elapsed) + ' left' : fmt(state.elapsed)}`;
  }
  scrollTo(0, 0);
}
$('resume-btn').onclick = () => play();

/* ---------------- Play ---------------- */
function play() {
  letters = state.words.map(normalizeWord);
  $('setup').hidden = true; $('play').hidden = false;
  $('play-title').textContent = state.title;
  $('play-sub').textContent = `${state.words.length} words · ${LEVEL[state.words.length]}${state.timed ? ' · Timed' : ''}`;
  $('clock-label').textContent = state.timed ? 'Left' : 'Time';
  const n = state.n, rows = state.rows ?? n, grid = $('grid');
  $('play').style.setProperty('--cols', n); $('play').style.setProperty('--rows', rows);
  grid.replaceChildren(...state.cells.map((ch, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cell'; b.textContent = ch; b.dataset.p = i; b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute('aria-label', `${ch}, row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`);
    return b;
  }));
  $('marks').setAttribute('viewBox', `0 0 ${n} ${rows}`);
  sizeCells();
  $('word-list').replaceChildren(...state.words.map((w) => { const li = document.createElement('li'); li.textContent = w; return li; }));
  hintCell = null; clearSel(); refresh(); clock();
  say(finished() ? '' : 'Drag across a word, or tap its first and last letters.');
  scrollTo(0, 0);
  if (!finished()) startClock();
}

function line(path, cls, color) {
  const n = state.n, a = path[0], b = path.at(-1);
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', (a % n) + 0.5); el.setAttribute('y1', Math.floor(a / n) + 0.5);
  el.setAttribute('x2', (b % n) + 0.5); el.setAttribute('y2', Math.floor(b / n) + 0.5);
  el.setAttribute('class', 'mark ' + cls); el.setAttribute('stroke-width', '0.78');
  if (color) el.setAttribute('stroke', color);
  return el;
}
function refresh() {
  const marks = $('marks'), got = new Set(), sel = new Set(current);
  marks.replaceChildren();
  state.found.forEach((i, k) => { marks.append(line(state.placements[i], 'found', COLORS[i % COLORS.length])); state.placements[i].forEach((p) => got.add(p)); });
  if (current.length) marks.append(line(current, 'sel'));
  [...$('grid').children].forEach((el, i) => { el.classList.toggle('on', sel.has(i)); el.classList.toggle('got', got.has(i) && !sel.has(i)); el.classList.toggle('hint', i === hintCell); });
  const done = state.found.length, total = state.words.length;
  $('found-count').textContent = `${done} / ${total}`;
  $('meter').style.width = `${(done / total) * 100}%`;
  [...$('word-list').children].forEach((li, i) => {
    const f = state.found.includes(i);
    li.classList.toggle('done', f); li.style.setProperty('--c', COLORS[i % COLORS.length]);
    li.setAttribute('aria-label', `${state.words[i]}, ${f ? 'found' : 'not found yet'}`);
  });
  $('hint-btn').disabled = finished();
}
function clearSel() { start = null; anchor = null; current = []; if (state) refresh(); }

function finish(path) {
  const text = path.map((p) => state.cells[p]).join(''), rev = [...text].reverse().join('');
  const i = letters.findIndex((w, k) => (w === text || w === rev) && !state.found.includes(k));
  const already = letters.findIndex((w) => w === text || w === rev);
  if (i >= 0) {
    state.found.push(i);
    state.placements[i] = text === letters[i] ? path : [...path].reverse();
    hintCell = null; clearTimeout(hintTimer);
    say(`Found ${state.words[i]}!`);
    navigator.vibrate?.(18);
    const li = $('word-list').children[i]; li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
    save();
  } else say(already >= 0 ? `${state.words[already]} is already found.` : 'Not a word on the list. Try another line.');
  clearSel();
  if (state.found.length === state.words.length) complete();
}

// Snap any drag to the nearest of the eight directions so slightly-off swipes still work on phones.
function snapPath(a, b) {
  const n = state.n, rows = state.rows ?? n, ar = Math.floor(a / n), ac = a % n;
  const dr = Math.floor(b / n) - ar, dc = (b % n) - ac;
  if (!dr && !dc) return [a];
  const ang = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)) * (Math.PI / 4);
  const sr = Math.round(Math.sin(ang)), sc = Math.round(Math.cos(ang));
  let len = Math.max(Math.abs(dr), Math.abs(dc));
  while (len > 0 && (ar + sr * len < 0 || ar + sr * len >= rows || ac + sc * len < 0 || ac + sc * len >= n)) len--;
  return pathBetween(a, (ar + sr * len) * n + ac + sc * len, n);
}
function cellAt(e) {
  const r = $('grid').getBoundingClientRect(), n = state.n, rows = state.rows ?? n;
  const c = Math.floor(((e.clientX - r.left) / r.width) * n), row = Math.floor(((e.clientY - r.top) / r.height) * rows);
  return c < 0 || row < 0 || c >= n || row >= rows ? null : row * n + c;
}
const board = $('board');
board.addEventListener('pointerdown', (e) => {
  if (!state || finished() || pointer !== null || e.button > 0) return;
  const p = cellAt(e); if (p === null) return;
  e.preventDefault(); pointer = e.pointerId; anchor = p; dragged = false; board.setPointerCapture(pointer);
  if (start === null) { current = [p]; refresh(); }
});
board.addEventListener('pointermove', (e) => {
  if (e.pointerId !== pointer) return;
  const p = cellAt(e); if (p === null || p === anchor) return;
  dragged = true; current = snapPath(anchor, p); refresh();
});
board.addEventListener('pointerup', (e) => {
  if (e.pointerId !== pointer) return;
  pointer = null;
  const p = cellAt(e);
  if (dragged) { if (current.length > 1) finish(current); else clearSel(); return; }
  if (p === null) { clearSel(); return; }
  if (start === null) { start = p; current = [p]; refresh(); say('First letter picked. Now tap the last letter.'); }
  else if (p === start) { clearSel(); say('Selection cleared.'); }
  else { const path = pathBetween(start, p, state.n); if (path.length) finish(path); else { clearSel(); say('Words run in straight lines: across, down or diagonal.'); } }
});
board.addEventListener('pointercancel', () => { pointer = null; clearSel(); });

$('grid').addEventListener('keydown', (e) => {
  const p = +e.target.dataset.p; if (!Number.isInteger(p) || finished()) return;
  const n = state.n, mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) {
    e.preventDefault();
    const r = Math.floor(p / n) + mv[0], c = (p % n) + mv[1];
    if (r < 0 || c < 0 || r >= (state.rows ?? n) || c >= n) return;
    const q = r * n + c, cells = $('grid').children;
    e.target.tabIndex = -1; cells[q].tabIndex = 0; cells[q].focus();
    if (start !== null) { current = pathBetween(start, q, n); refresh(); }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (start === null) { start = p; current = [p]; refresh(); say('First letter picked. Move to the last letter and press Enter.'); }
    else { const path = pathBetween(start, p, n); path.length > 1 ? finish(path) : clearSel(); }
  } else if (e.key === 'Escape' && start !== null) { e.preventDefault(); e.stopPropagation(); clearSel(); say('Selection cleared.'); }
});

$('hint-btn').onclick = () => {
  const left = letters.map((_, i) => i).filter((i) => !state.found.includes(i));
  if (!left.length) return;
  const i = left[Math.floor(Math.random() * left.length)];
  hintCell = state.placements[i][0]; refresh();
  say(`Hint: ${state.words[i]} starts at the glowing letter.`);
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintCell = null; refresh(); }, 6000);
};

// Letter size follows the real cell size (works in every layout, including side-by-side landscape).
function sizeCells() {
  if (!state) return;
  const w = $('grid').getBoundingClientRect().width;
  if (w) $('play').style.setProperty('--cell', `${w / state.n}px`);
}
new ResizeObserver(sizeCells).observe($('board'));

/* ---------------- Clock ---------------- */
function clock() {
  const shown = state.timed ? state.limit - state.elapsed : state.elapsed;
  $('clock-value').textContent = fmt(shown);
  $('clock').classList.toggle('low', state.timed && shown <= 30 && !finished());
}
function startClock() {
  stopClock();
  tick = setInterval(() => {
    if (document.hidden || $('menu').open || $('done').open || finished()) return;
    state.elapsed++; clock();
    if (state.timed && state.elapsed >= state.limit) timeUp();
    else if (state.elapsed % 5 === 0) save();
  }, 1000);
}
function stopClock() { clearInterval(tick); }

/* ---------------- End of puzzle ---------------- */
function complete() {
  stopClock(); save(); refresh();
  $('done-eyebrow').textContent = 'PUZZLE COMPLETE';
  $('done-title').textContent = 'You found them all!';
  $('done-detail').textContent = `${state.title} · ${state.words.length} words · ${state.timed ? `${fmt(state.limit - state.elapsed)} to spare` : `in ${fmt(state.elapsed)}`}.`;
  $('done-keep').hidden = true;
  setTimeout(() => $('done').showModal(), 450);
}
function timeUp() {
  state.ended = true; stopClock(); save(); clock(); refresh();
  $('done-eyebrow').textContent = "TIME'S UP";
  $('done-title').textContent = `${state.found.length} of ${state.words.length} found`;
  $('done-detail').textContent = 'Keep looking without the clock, or start fresh.';
  $('done-keep').hidden = false;
  $('done').showModal();
}
$('done-keep').onclick = () => { state.ended = false; state.timed = false; state.limit = 0; save(); $('done').close(); play(); };
$('done-again').onclick = () => { $('done').close(); const t = topics.find((x) => x.id === state.topicId) || topics[0]; newPuzzle(shuffle(t.words).slice(0, state.words.length), t, choiceTimed()); };
function choiceTimed() { return (store.get(PREFS) || {}).clock === 'timed'; }
$('done-new').onclick = () => { $('done').close(); showSetup(); };

/* ---------------- Menu ---------------- */
$('menu-btn').onclick = () => $('menu').showModal();
$('menu-resume').onclick = () => $('menu').close();
$('menu-new').onclick = () => { $('menu').close(); save(); showSetup(); };
$('menu-shuffle').onclick = () => { $('menu').close(); const t = topics.find((x) => x.id === state.topicId) || topics[0]; newPuzzle(state.words, t, state.timed); };
$('menu-restart').onclick = () => { $('menu').close(); state.found = []; state.elapsed = 0; state.ended = false; save(); play(); };
for (const d of ['menu', 'done']) $(d).addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------------- Start ---------------- */
async function init() {
  try {
    const data = await (await fetch('./topics.json')).json();
    topics = data.topics
      .map((t) => ({ ...t, words: [...new Map(t.words.map((w) => [normalizeWord(w), w.toUpperCase().trim()])).values()] }))
      .filter((t) => t.words.length >= 15 && t.words.every((w) => normalizeWord(w).length >= 2 && normalizeWord(w).length <= 24));
    const saved = store.get(KEY);
    if (validPuzzle(saved)) state = { timed: false, limit: 0, ended: false, ...saved };
    buildSetup();
    showSetup();
  } catch {
    $('setup-error').textContent = 'Themes could not load. Refresh the page to try again.';
  }
}
addEventListener('pagehide', save);
init();

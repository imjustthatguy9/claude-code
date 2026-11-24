// ---------------------------------------------------------------------------
// Fun Party Games: players, Imposter, Who Has the Bomb?, $20 Draft.
// ---------------------------------------------------------------------------
'use strict';

const MAX_PLAYERS = 12;
const COVER_COLORS = ['#9b6bff', '#ff7eb6', '#4b9dff', '#2fbf71', '#ff9f40', '#ff5a78', '#25b9d1', '#e8a317'];

// ---- Helpers -----------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randIn = ([lo, hi]) => lo + Math.random() * (hi - lo);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const img = (key, cls = '', extra = '') => `<img class="px ${cls}" src="${sprURL(key)}" alt="" draggable="false" ${extra}>`;

const store = {
  get(k, d) { try { const v = localStorage.getItem('fpg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fpg.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

// ---- State -------------------------------------------------------------------
function cleanPlayers(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(p => p && typeof p === 'object').slice(0, MAX_PLAYERS).map(p => ({
    id: String(p.id || uid()),
    name: String(p.name || '').slice(0, 14),
    char: CHARS[p.char] ? p.char : pick(Object.keys(CHARS)),
  }));
}
const S = {
  players: cleanPlayers(store.get('players', [])),
  muted: !!store.get('muted', false),
  imp: Object.assign({ sets: SETS.map(s => s.id), count: 1, hint: true }, store.get('imp', {})),
  bomb: Object.assign({ packs: BOMB_PACKS.map(p => p.id), fuse: 'normal' }, store.get('bomb', {})),
  draft: Object.assign({ picks: 3, set: 'snacks' }, store.get('draft', {})),
  booms: {},       // bomb losses this session, by player id
  recent: [],      // recent imposter words, to avoid repeats
};
S.imp.sets = S.imp.sets.filter(id => SETS.some(s => s.id === id));
S.bomb.packs = S.bomb.packs.filter(id => BOMB_PACKS.some(p => p.id === id));
const savePlayers = () => store.set('players', S.players);
const saveCfg = () => { store.set('imp', S.imp); store.set('bomb', S.bomb); store.set('draft', S.draft); };
const nm = p => (p.name || '').trim() || `Player ${S.players.indexOf(p) + 1}`;
const byId = id => S.players.find(p => p.id === id);

// ---- Sound (tiny chiptune synth) ----------------------------------------------
const sfx = (() => {
  let ctx = null, noiseBuf = null;
  function ac() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      try { ctx = new A(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(f, d, { type = 'square', v = 0.07, to, at = 0 } = {}) {
    if (S.muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, v, from, to) {
    if (S.muted) return;
    const c = ac(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(t); s.stop(t + d);
  }
  const notes = (fs, step, o = {}) => fs.forEach((f, i) => tone(f, step * 1.7, Object.assign({}, o, { at: i * step })));
  return {
    unlock: ac,
    click: () => tone(560, 0.05, { v: 0.035 }),
    pop: () => tone(420, 0.12, { to: 940, v: 0.06 }),
    beep: f => tone(f, 0.08, { v: 0.09 }),
    fuse: () => noise(0.6, 0.18, 7000, 1500),
    boom: () => { noise(2.2, 0.9, 2600, 40); tone(150, 1.1, { type: 'sawtooth', to: 28, v: 0.22 }); },
    coin: () => notes([988, 1319], 0.07, { v: 0.06 }),
    pass: () => tone(320, 0.16, { to: 170, v: 0.06, type: 'triangle' }),
    sold: () => notes([523, 659, 784, 1047], 0.08, { v: 0.06 }),
    sad: () => notes([392, 330, 262], 0.14, { v: 0.05, type: 'triangle' }),
    fanfare: () => notes([392, 523, 659, 784, 659, 1047], 0.1, { v: 0.06 }),
    drum: () => noise(0.07, 0.3, 1800, 300),
    err: () => tone(170, 0.18, { v: 0.05 }),
  };
})();
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* unsupported */ } };

// ---- Particles (confetti + explosions) ----------------------------------------
const fx = (() => {
  const c = $('#fx'), x = c.getContext('2d');
  let P = [], raf = 0, dpr = 1;
  function size() { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
  size(); addEventListener('resize', size);
  function step() {
    x.clearRect(0, 0, c.width, c.height);
    P = P.filter(p => --p.life > 0 && p.y < innerHeight + 40);
    for (const p of P) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy;
      x.globalAlpha = Math.min(1, p.life / 25);
      x.fillStyle = p.c;
      x.fillRect(Math.round(p.x) * dpr, Math.round(p.y) * dpr, p.s * dpr, p.s * dpr);
    }
    x.globalAlpha = 1;
    raf = P.length ? requestAnimationFrame(step) : 0;
  }
  const add = list => { P.push(...list); if (!raf) raf = requestAnimationFrame(step); };
  return {
    confetti() {
      const cols = [PAL.r, PAL.y, PAL.b, PAL.e, PAL.p, PAL.m, PAL.o, PAL.c];
      add(Array.from({ length: 140 }, () => ({
        x: Math.random() * innerWidth, y: -10 - Math.random() * innerHeight * 0.6,
        vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2.5, g: 0.04, drag: 0.995,
        s: pick([6, 8, 10]), c: pick(cols), life: 260 + rnd(120),
      })));
    },
    explode(cx, cy) {
      const cols = [PAL.y, PAL.y, PAL.o, PAL.o, PAL.r, PAL.w, PAL.G, PAL.k];
      add(Array.from({ length: 220 }, () => {
        const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 15;
        return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, g: 0.28, drag: 0.955, s: pick([6, 8, 10, 12, 16]), c: pick(cols), life: 50 + rnd(70) };
      }));
    },
    clear() { P = []; },
  };
})();

// ---- Rendering + events ---------------------------------------------------------
const app = $('#app'), modalRoot = $('#modal'), toastRoot = $('#toasts');
let ACT = {}, MACT = {}, timers = [];
let R = null;       // current Imposter round
let B = null;       // current Bomb round
let D = null;       // current Draft

function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
function render(html, actions = {}, { keepScroll = false } = {}) {
  timers.forEach(clearTimeout); timers = [];
  closeModal();
  const y = window.scrollY;
  app.innerHTML = html;
  ACT = actions;
  window.scrollTo(0, keepScroll ? y : 0);
  if (actions.back && history.state !== 'fpg') { try { history.pushState('fpg', ''); } catch (e) { /* file:// on some browsers */ } }
}
const GLOBAL = {
  mute(el) {
    S.muted = !S.muted; store.set('muted', S.muted);
    document.querySelectorAll('[data-a="mute"]').forEach(b => { b.innerHTML = muteIcon(); b.setAttribute('aria-label', S.muted ? 'Sound off' : 'Sound on'); });
    if (!S.muted) sfx.pop();
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const inModal = !!el.closest('#modal');
  const fn = (inModal ? MACT : ACT)[el.dataset.a] || GLOBAL[el.dataset.a];
  if (!fn) return;
  if (el.dataset.a !== 'mute') sfx.click();
  fn(el, e);
});
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
document.addEventListener('input', e => {
  if (e.target.matches('.pname')) {
    const p = S.players[+e.target.dataset.i];
    if (p) { p.name = e.target.value.slice(0, 14); savePlayers(); }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.pname')) e.target.blur();
});
window.addEventListener('popstate', () => {
  if (modalRoot.classList.contains('open')) { closeModal(); history.pushState('fpg', ''); return; }
  if (ACT.back) ACT.back();
});

function modal(html, actions = {}) {
  MACT = Object.assign({ close: closeModal }, actions);
  modalRoot.innerHTML = `<div class="scrim" data-a="close"></div><div class="sheet box">${html}</div>`;
  modalRoot.classList.add('open');
}
function closeModal() { modalRoot.classList.remove('open'); modalRoot.innerHTML = ''; MACT = {}; }
function confirmBox(text, yes, onYes) {
  modal(`<p class="m-text">${text}</p>
    <div class="row2"><button class="btn" style="--c:#fff" data-a="close">Keep playing</button>
    <button class="btn" style="--c:var(--red);--t:#fff" data-a="yes">${yes}</button></div>`,
  { yes() { closeModal(); onYes(); } });
}
function toast(msg, ms = 2000) {
  const t = document.createElement('div');
  t.className = 'toast box';
  t.innerHTML = msg;
  toastRoot.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

const ICON_BACK = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 1h1v1H4zM3 2h1v1H3zM2 3h5v2H2zM3 5h1v1H3zM4 6h1v1H4z"/></svg>';
function muteIcon() {
  const spk = 'M1 3h1v2H1zM2 3h1v2H2zM3 2h1v4H3zM4 1h1v6H4z';
  const on = 'M6 2h1v1H6zM6 5h1v1H6zM7 3h1v2H7z';
  const off = 'M6 2h1v1H6zM8 2h1v1H8zM7 3h1v1H7zM6 4h1v1H6zM8 4h1v1H8z';
  return `<svg viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${spk} ${S.muted ? off : on}"/></svg>`;
}
const muteBtn = () => `<button class="ibtn" data-a="mute" aria-label="${S.muted ? 'Sound off' : 'Sound on'}">${muteIcon()}</button>`;
function bar(title, { back = true, extra = '' } = {}) {
  return `<header class="bar">
    ${back ? `<button class="ibtn" data-a="back" aria-label="Back">${ICON_BACK}</button>` : '<span class="ibtn ghost"></span>'}
    <h1>${title}</h1>${extra}${muteBtn()}</header>`;
}
const chip = (action, key, label, icon, on) =>
  `<button class="chip ${on ? 'on' : ''}" data-a="${action}" data-k="${key}"><img class="px" src="${sprURL(icon)}" alt=""><span>${esc(label)}</span></button>`;
const toggle = (action, on) => `<button class="tog ${on ? 'on' : ''}" data-a="${action}" role="switch" aria-checked="${on}"><span class="tog-knob"></span><span class="tog-on">ON</span><span class="tog-off">OFF</span></button>`;
const toggleIn = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); };
const avatarChip = (p, cls = '') => `<span class="mini ${cls}">${img(p.char)}<span>${esc(nm(p))}</span></span>`;

// ---- Home ------------------------------------------------------------------------
function logoHTML() {
  const colors = ['#ff5a78', '#ff9f40', '#ffd93d', '#2fbf71', '#4b9dff', '#9b6bff', '#ff7eb6'];
  let i = 0;
  return ['FUN', 'PARTY', 'GAMES'].map(w => `<div class="logo-word">${[...w].map(ch =>
    `<span style="--c:${colors[i % colors.length]};--d:${(i++) * 0.08}s">${ch}</span>`).join('')}</div>`).join('');
}
function home() {
  const ps = S.players;
  const parade = ps.length ? ps.slice(0, 7).map(p => p.char) : shuffle(Object.keys(CHARS)).slice(0, 6);
  const tile = (a, name, src, desc, min, color) => `
    <button class="tile box" data-a="${a}" style="--c:${color}">
      <span class="tile-art"><img class="px" src="${src}" alt=""></span>
      <span class="tile-text"><span class="tile-name">${name}</span><span class="tile-desc">${desc}</span>
      <span class="tile-min ${ps.length < min ? 'warn' : ''}">${min}+ players</span></span>
      <span class="tile-go">▶</span>
    </button>`;
  render(`<div class="screen home">
    <div class="home-top">${muteBtn()}</div>
    <div class="logo" role="heading" aria-level="1" aria-label="Fun Party Games">${logoHTML()}</div>
    <div class="parade">${parade.map((c, i) => img(c, 'hop', `style="animation-delay:${i * 0.15}s"`)).join('')}</div>
    <button class="pcard box" data-a="players">
      <span class="pcard-head"><span class="label">Players</span><span class="count">${ps.length}</span><span class="edit">Edit ▸</span></span>
      <span class="pcard-body">${ps.length ? ps.map(p => avatarChip(p)).join('') : '<span class="empty">Tap here to add your crew!</span>'}</span>
    </button>
    <div class="games">
      ${tile('imp', 'Imposter', sprURL('spy'), 'Pass the phone. One of you is faking it.', 3, 'var(--purple)')}
      ${tile('bomb', 'Who Has the Bomb?', sprURL(bombRows(true)), 'Name one and pass it on before it blows!', 2, 'var(--red)')}
      ${tile('draft', '$20 Draft', sprURL('coin'), 'Bid, pass and build the best team.', 2, 'var(--green)')}
    </div>
    <p class="foot">Best played passing one phone around ♥</p>
  </div>`, {
    players: playersScreen,
    imp: () => needPlayers(3, impSetup),
    bomb: () => needPlayers(2, bombSetup),
    draft: () => needPlayers(2, draftSetup),
  });
}
function needPlayers(n, fn) {
  if (S.players.length >= n) return fn();
  sfx.err();
  playersScreen();
  toast(`Add at least <b>${n} players</b> to play!`);
}

// ---- Players -----------------------------------------------------------------------
function addPlayer() {
  const used = new Set(S.players.map(p => p.char));
  const free = shuffle(Object.keys(CHARS)).filter(k => !used.has(k));
  S.players.push({ id: uid(), name: '', char: free[0] || pick(Object.keys(CHARS)) });
  savePlayers();
}
function playersScreen() {
  const ps = S.players;
  render(`<div class="screen">
    ${bar('Players')}
    <p class="sub center">Add everyone who's playing.<br>Tap a character to change it.</p>
    <div class="plist">${ps.map((p, i) => `
      <div class="prow box">
        <button class="ava-btn" data-a="char" data-i="${i}" aria-label="Change character for ${esc(nm(p))}">${img(p.char)}<span class="swap">✎</span></button>
        <input class="pname" data-i="${i}" value="${esc(p.name)}" placeholder="Player ${i + 1}" maxlength="14" autocomplete="off" autocapitalize="words" enterkeyhint="done" aria-label="Name">
        <button class="xbtn" data-a="del" data-i="${i}" aria-label="Remove ${esc(nm(p))}">✕</button>
      </div>`).join('')}
    </div>
    ${ps.length < MAX_PLAYERS
      ? `<button class="btn add" style="--c:var(--blue);--t:#fff" data-a="add">+ Add player</button>`
      : `<p class="sub center">That's a full party! (${MAX_PLAYERS} max)</p>`}
    ${ps.length ? '' : `<div class="empty-hero">${img('ghost', 'hop')}<p>It's quiet in here…</p></div>`}
    <div class="dock"><button class="btn big" style="--c:var(--green)" data-a="back">Done</button></div>
  </div>`, {
    back: home,
    add() {
      addPlayer(); playersScreen();
      const inputs = document.querySelectorAll('.pname');
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.scrollIntoView({ block: 'center' }); }
    },
    del(el) { S.players.splice(+el.dataset.i, 1); savePlayers(); playersScreen(); },
    char(el) { charPicker(+el.dataset.i); },
  });
}
function charPicker(i) {
  const p = S.players[i];
  const usedBy = {};
  S.players.forEach(q => { if (q !== p) usedBy[q.char] = nm(q); });
  modal(`<h2 class="m-title">Pick a character</h2>
    <div class="cgrid">${Object.entries(CHARS).map(([k, c]) => `
      <button class="cpick ${k === p.char ? 'on' : ''} ${usedBy[k] ? 'used' : ''}" data-a="pick" data-k="${k}">
        ${img(k)}<span>${c.name}</span>${usedBy[k] ? `<em>${esc(usedBy[k])}</em>` : ''}</button>`).join('')}
    </div>`, {
    pick(el) { p.char = el.dataset.k; savePlayers(); closeModal(); playersScreen(); },
  });
}

// ---- Imposter -----------------------------------------------------------------------
function impSetup() {
  const n = S.players.length, maxImp = Math.max(1, Math.floor((n - 1) / 2));
  if (S.imp.count > maxImp) S.imp.count = maxImp;
  render(`<div class="screen">
    ${bar('Imposter')}
    <section class="panel box"><h2>Word sets</h2>
      <div class="chips">${SETS.map(s => chip('set', s.id, s.name, s.icon, S.imp.sets.includes(s.id))).join('')}</div>
    </section>
    <section class="panel box"><h2>Imposters</h2>
      <div class="seg">${[1, 2, 3].map(k => `<button class="segb ${S.imp.count === k ? 'on' : ''}" data-a="count" data-k="${k}" ${k > maxImp ? 'disabled' : ''}>${k}</button>`).join('')}</div>
      ${maxImp < 3 ? `<p class="tiny">More players unlock more imposters.</p>` : ''}
    </section>
    <section class="panel box row-between"><div><h2>Imposter hint</h2><p class="tiny">The imposter sees a one-word clue and the category.</p></div>${toggle('hint', S.imp.hint)}</section>
    <section class="panel box how"><h2>How to play</h2><ol>
      <li>Pass the phone. Pull up your card to secretly see the word, then let go.</li>
      <li>Everyone gets the same word, except the imposter!</li>
      <li>Go around and each say one word about it. Not too obvious…</li>
      <li>Vote on who's faking, then hit <b>Reveal</b>.</li></ol></section>
    <div class="dock"><button class="btn big" style="--c:var(--purple);--t:#fff" data-a="go">Deal the cards ▶</button></div>
  </div>`, {
    back: home,
    set(el) { toggleIn(S.imp.sets, el.dataset.k); saveCfg(); el.classList.toggle('on'); },
    count(el) { S.imp.count = +el.dataset.k; saveCfg(); document.querySelectorAll('.segb').forEach(b => b.classList.toggle('on', b === el)); },
    hint(el) { S.imp.hint = !S.imp.hint; saveCfg(); el.classList.toggle('on', S.imp.hint); el.setAttribute('aria-checked', S.imp.hint); },
    go() { if (!S.imp.sets.length) { sfx.err(); return toast('Pick at least one word set'); } impStart(); },
  });
}
function impStart() {
  const pool = ALL_ITEMS.filter(it => S.imp.sets.includes(it.set));
  let choices = pool.filter(it => !S.recent.includes(it.name));
  if (!choices.length) { S.recent = []; choices = pool; }
  const word = pick(choices);
  S.recent.push(word.name); if (S.recent.length > 40) S.recent.shift();
  const imps = new Set(shuffle(S.players).slice(0, S.imp.count).map(p => p.id));
  R = { word, imps, i: 0, starter: pick(S.players), hint: S.imp.hint };
  impPass();
}
const quitImp = () => confirmBox('Quit this round?', 'Quit', impSetup);
function impPass() {
  const p = S.players[R.i], isImp = R.imps.has(p.id), last = R.i === S.players.length - 1;
  const secret = isImp
    ? `<div class="sec">${img('spy', 'sec-art wobble')}
        <div class="sec-imp">You are the<br><b>IMPOSTER!</b></div>
        ${R.hint
          ? `<div class="hint box">Hint: <b>${esc(R.word.hint)}</b></div><div class="sec-small">Category: ${esc(R.word.setName)}</div>`
          : `<div class="sec-small">No hint this time. Bluff well!</div>`}
        <div class="sec-small">Blend in. Don't get caught!</div></div>`
    : `<div class="sec"><div class="sec-small">The secret word is</div>
        ${img(R.word.icon, 'sec-art')}
        <div class="sec-word">${esc(R.word.name)}</div>
        <div class="sec-small">Category: ${esc(R.word.setName)}</div></div>`;
  render(`<div class="screen imp-pass">
    ${bar('Imposter', { extra: `<span class="step">${R.i + 1}/${S.players.length}</span>` })}
    <p class="pass-to">Pass the phone to <b>${esc(nm(p))}</b></p>
    <div class="peek">
      <div class="secret box ${isImp ? 'is-imp' : ''}">${secret}</div>
      <div class="cover box" id="cover" style="--c:${COVER_COLORS[R.i % COVER_COLORS.length]}">
        <div class="cover-stripes"></div>
        ${img(p.char, 'cover-ava')}
        <div class="cover-name">${esc(nm(p))}</div>
        <div class="cover-tip"><span class="arrows"><i></i><i></i><i></i></span>Pull up to peek<small>Let go to hide it</small></div>
      </div>
    </div>
    <div class="dock"><button class="btn big" id="nextBtn" style="--c:var(--green)" data-a="next" disabled>
      ${last ? 'Everyone has looked ▶' : 'Got it! Next player ▶'}</button>
      <p class="tiny center" id="nextTip">Peek at your card first</p></div>
  </div>`, {
    back: quitImp,
    next() { if (last) impDiscuss(); else { R.i++; impPass(); } },
  });
  setupCover($('#cover'), () => { $('#nextBtn').disabled = false; $('#nextTip').textContent = 'Hide the screen and pass it on!'; });
}
function setupCover(el, onPeek) {
  let startY = null, dy = 0, h = 0, peeked = false;
  el.addEventListener('pointerdown', e => {
    startY = e.clientY; h = el.offsetHeight;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    el.style.transition = 'none';
    el.classList.add('grab');
  });
  el.addEventListener('pointermove', e => {
    if (startY == null) return;
    dy = Math.max(-h * 0.94, Math.min(0, e.clientY - startY));
    el.style.transform = `translateY(${dy}px)`;
    if (!peeked && -dy > h * 0.45) { peeked = true; sfx.pop(); vibrate(15); onPeek(); }
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    el.classList.remove('grab');
    el.style.transition = 'transform .28s cubic-bezier(.25,.8,.35,1)';
    el.style.transform = 'translateY(0)';
    dy = 0;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}
function impDiscuss() {
  render(`<div class="screen">
    ${bar('Imposter')}
    <div class="hero">
      <h2 class="big-title">Everyone's in!</h2>
      <div class="starter box">${img(R.starter.char, 'hop')}<div><span class="tiny">First to talk</span><b>${esc(nm(R.starter))}</b></div></div>
      <p class="sub center">Go around the circle. Everyone says <b>one word</b> about the secret. Then point at who you think is the imposter!</p>
      <div class="crowd">${S.players.map((p, i) => `<span class="mini">${img(p.char, 'hop', `style="animation-delay:${i * 0.1}s"`)}<span>${esc(nm(p))}</span></span>`).join('')}</div>
    </div>
    <div class="dock"><button class="btn big reveal-btn" style="--c:var(--red);--t:#fff" data-a="reveal">${img('spy')} Reveal imposter</button></div>
  </div>`, { back: quitImp, reveal: impSuspense });
}
function impSuspense() {
  render(`<div class="screen suspense"><div class="drum-text">The imposter ${R.imps.size > 1 ? 'are' : 'is'}<span class="dots"><i>.</i><i>.</i><i>.</i></span></div>${img('question', 'big-q wobble')}</div>`, {});
  for (let i = 0; i < 16; i++) later(sfx.drum, i * 95);
  later(impReveal, 1700);
}
function impReveal() {
  const imps = S.players.filter(p => R.imps.has(p.id));
  render(`<div class="screen">
    ${bar('Imposter')}
    <div class="reveal">
      <p class="kicker">The imposter${imps.length > 1 ? 's were' : ' was'}…</p>
      <div class="imps">${imps.map(p => `<div class="imp-card box pop">${img(p.char, 'shake-slow')}<b>${esc(nm(p))}</b></div>`).join('')}</div>
      <div class="word-card box"><span class="tiny">The secret word was</span>${img(R.word.icon)}<b>${esc(R.word.name)}</b>
        ${R.hint ? `<span class="tiny">Imposter hint: ${esc(R.word.hint)}</span>` : ''}</div>
    </div>
    <div class="dock row2"><button class="btn" data-a="home" style="--c:#fff">Home</button>
      <button class="btn" style="--c:var(--purple);--t:#fff" data-a="again">Play again</button></div>
  </div>`, { back: impSetup, home, again: impStart });
  sfx.fanfare(); fx.confetti();
}

// ---- Who Has the Bomb? -----------------------------------------------------------------
const FUSES = {
  short: [[4, 8], [5, 9], [3, 7]],
  normal: [[7, 14], [9, 16], [4, 11]],
  long: [[12, 20], [14, 24], [6, 15]],
};
let bombDeck = [], bombDeckKey = '';
function drawCat() {
  const key = S.bomb.packs.join();
  if (!bombDeck.length || key !== bombDeckKey) {
    bombDeckKey = key;
    bombDeck = shuffle(BOMB_PACKS.filter(p => S.bomb.packs.includes(p.id)).flatMap(p => p.cats.map(([t, i]) => ({ t, i, pack: p.name }))));
  }
  return bombDeck.pop();
}
const catHTML = c => `${img(c.i, 'cat-art')}<div class="cat-text"><span class="tiny">${esc(c.pack)} · Name something in…</span><b>${esc(c.t)}</b></div>`;
let wakeLock = null;
async function keepAwake() { try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; } }
function letSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

function bombSetup() {
  render(`<div class="screen">
    ${bar('Who Has the Bomb?')}
    <section class="panel box"><h2>Category packs</h2>
      <div class="chips">${BOMB_PACKS.map(p => chip('pack', p.id, p.name, p.icon, S.bomb.packs.includes(p.id))).join('')}</div>
    </section>
    <section class="panel box"><h2>Fuse length</h2>
      <div class="seg">${['short', 'normal', 'long'].map(k => `<button class="segb ${S.bomb.fuse === k ? 'on' : ''}" data-a="fuse" data-k="${k}">${k}</button>`).join('')}</div>
      <p class="tiny">The exact moment it blows is always random.</p>
    </section>
    <section class="panel box how"><h2>How to play</h2><ol>
      <li>The starter lights the fuse and names something in the category.</li>
      <li>Pass the phone to the next person. They name something new, and pass again!</li>
      <li>The bomb sits quietly… then blinks red and beeps… then beeps <b>fast</b>…</li>
      <li><b>BOOM!</b> Whoever is holding it loses the round.</li></ol></section>
    <div class="dock"><button class="btn big" style="--c:var(--red);--t:#fff" data-a="go">Let's go ▶</button></div>
  </div>`, {
    back: home,
    pack(el) { toggleIn(S.bomb.packs, el.dataset.k); saveCfg(); el.classList.toggle('on'); },
    fuse(el) { S.bomb.fuse = el.dataset.k; saveCfg(); document.querySelectorAll('.segb').forEach(b => b.classList.toggle('on', b === el)); },
    go() { if (!S.bomb.packs.length) { sfx.err(); return toast('Pick at least one pack'); } bombNew(); },
  });
}
function bombNew() {
  B = { starter: pick(S.players), cat: drawCat(), live: false };
  bombReady();
}
const SPARK_A = ['..y..', '.yoy.', 'yowoy', '.yoy.', '..y..'];
const SPARK_B = ['y...y', '.yoy.', '.owo.', '.yoy.', 'y...y'];
function bombReady() {
  render(`<div class="screen bomb-screen">
    ${bar('Who Has the Bomb?')}
    <div class="cat box" id="cat">${catHTML(B.cat)}</div>
    <div class="starter-line" id="starter">${img(B.starter.char, 'hop')}<span><b>${esc(nm(B.starter))}</b> starts!</span></div>
    <div class="bomb-stage">
      <div class="bomb-wrap idle" id="bomb">
        <img class="px bomb-img" id="bombImg" src="${sprURL(bombRows(false))}" alt="Bomb" draggable="false">
        <span class="spark" id="spark" hidden><img class="px a" src="${sprURL(SPARK_A)}" alt=""><img class="px b" src="${sprURL(SPARK_B)}" alt=""></span>
      </div>
      <div class="bomb-shadow"></div>
    </div>
    <p class="status" id="status">Light the fuse, say your answer, and pass!</p>
    <div class="dock row2" id="dock"><button class="btn" data-a="newcat" style="--c:#fff">↻ New category</button>
      <button class="btn" style="--c:var(--orange)" data-a="light">Light fuse!</button></div>
  </div>`, {
    back() { if (B.live) confirmBox('Stop the bomb and leave?', 'Leave', () => { bombStop(); bombSetup(); }); else bombSetup(); },
    newcat() { B.cat = drawCat(); $('#cat').innerHTML = catHTML(B.cat); sfx.pop(); },
    light: bombLight,
    stop() { confirmBox('Defuse the bomb? (Nobody loses)', 'Defuse', () => { bombStop(); bombReady(); }); },
  });
}
function bombStop() { B.live = false; timers.forEach(clearTimeout); timers = []; letSleep(); }
function bombLight() {
  sfx.unlock(); sfx.fuse(); vibrate(30);
  const f = FUSES[S.bomb.fuse] || FUSES.normal;
  const t1 = randIn(f[0]) * 1000, t2 = t1 + randIn(f[1]) * 1000, t3 = t2 + randIn(f[2]) * 1000;
  const start = performance.now();
  B.live = true; B.t = [t1, t2, t3];
  keepAwake();
  $('#dock').innerHTML = '<button class="btn quiet" data-a="stop" style="--c:#fff">■ Defuse</button>';
  $('#starter').innerHTML = `${img(B.starter.char)}<span><b>${esc(nm(B.starter))}</b>: say one and pass it!</span>`;
  $('#spark').hidden = false;
  const bomb = $('#bomb'), pic = $('#bombImg'), status = $('#status');
  const dark = sprURL(bombRows(false)), lit = sprURL(bombRows(true));
  let on = false, stage = 0;
  const say = ['', 'Tick… tock… pass it on!', 'It\'s beeping! Keep passing!', 'HURRY!!!'];
  (function tick() {
    if (!B.live) return;
    const t = performance.now() - start;
    if (t >= t3) return bombBoom();
    const s = t < t1 ? 1 : t < t2 ? 2 : 3;
    if (s !== stage) { stage = s; status.textContent = say[s]; status.className = 'status st' + s; bomb.className = 'bomb-wrap live s' + s; }
    if (s === 1) { later(tick, Math.min(t1 - t, 500)); return; }
    on = !on;
    pic.src = on ? lit : dark;
    let gap;
    if (s === 2) { gap = 450; if (on) sfx.beep(880); }
    else { const k = (t - t2) / (t3 - t2); gap = Math.max(60, 200 - 140 * k); if (on) { sfx.beep(1320); vibrate(20); } }
    later(tick, gap);
  })();
}
function bombBoom() {
  B.live = false; letSleep();
  sfx.boom(); vibrate([400, 80, 300]);
  const r = $('#bomb').getBoundingClientRect();
  fx.explode(r.left + r.width * 0.48, r.top + r.height * 0.58);
  $('#bomb').classList.add('gone');
  $('.bomb-shadow').classList.add('gone');
  $('#status').innerHTML = '<span class="boom-word">BOOM!</span>';
  $('#status').className = 'status boom';
  $('#dock').innerHTML = '';
  document.body.classList.add('shake', 'flash');
  later(() => document.body.classList.remove('flash'), 500);
  later(() => { document.body.classList.remove('shake'); bombWho(); }, 1500);
}
function bombWho() {
  render(`<div class="screen">
    ${bar('BOOM!')}
    <div class="hero">
      <div class="boom-art">${img(bombRows(true), 'wobble')}</div>
      <h2 class="big-title">Who was holding it?</h2>
      <div class="cat box small">${catHTML(B.cat)}</div>
      <div class="who-grid">${S.players.map((p, i) => `<button class="who box" data-a="loser" data-i="${i}">${img(p.char)}<span>${esc(nm(p))}</span></button>`).join('')}</div>
    </div>
    <div class="dock"><button class="btn quiet" style="--c:#fff" data-a="skip">Skip, nobody</button></div>
  </div>`, {
    back: bombSetup,
    loser(el) { const p = S.players[+el.dataset.i]; S.booms[p.id] = (S.booms[p.id] || 0) + 1; sfx.sad(); bombResult(p); },
    skip() { bombResult(null); },
  });
}
function bombResult(loser) {
  const rows = S.players.map(p => ({ p, n: S.booms[p.id] || 0 })).sort((a, b) => a.n - b.n);
  render(`<div class="screen">
    ${bar('Who Has the Bomb?')}
    <div class="hero">
      ${loser ? `<div class="loser">${img(loser.char, 'charred')}<div class="soot"></div></div>
        <h2 class="big-title">${esc(nm(loser))} got blown up!</h2>` : '<h2 class="big-title">Phew! Nobody got hurt.</h2>'}
      <div class="board box"><h2>Boom board</h2>
        ${rows.map(({ p, n }) => `<div class="brow ${loser && p.id === loser.id ? 'hot' : ''}">${img(p.char)}<span class="bname">${esc(nm(p))}</span>
          <span class="bombs">${n ? Array.from({ length: Math.min(n, 8) }, () => img(bombRows(false))).join('') + (n > 8 ? `<b>+${n - 8}</b>` : '') : '<span class="tiny">safe so far</span>'}</span></div>`).join('')}
        <button class="link" data-a="reset">Reset board</button>
      </div>
    </div>
    <div class="dock row2"><button class="btn" data-a="home" style="--c:#fff">Home</button>
      <button class="btn" style="--c:var(--red);--t:#fff" data-a="next">Next round ▶</button></div>
  </div>`, {
    back: bombSetup, home, next: bombNew,
    reset() { S.booms = {}; bombResult(null); },
  });
}

// ---- $20 Draft ------------------------------------------------------------------------
const BUDGET = 20;
function draftSetup() {
  const sets = [...SETS.map(s => [s.id, s.name, s.icon]), ['mix', 'Mix it up', 'question']];
  render(`<div class="screen">
    ${bar('$20 Draft')}
    <section class="panel box"><h2>Picks per player</h2>
      <div class="seg big">${[3, 5].map(k => `<button class="segb ${S.draft.picks === k ? 'on' : ''}" data-a="picks" data-k="${k}">${k} picks</button>`).join('')}</div>
    </section>
    <section class="panel box"><h2>What are we drafting?</h2>
      <div class="chips">${sets.map(([id, name, icon]) => chip('set', id, name, icon, S.draft.set === id)).join('')}</div>
    </section>
    <section class="panel box how"><h2>How to play</h2><ol>
      <li>Everyone starts with <b>$${BUDGET}</b>. Items come up one at a time.</li>
      <li>Going around from a random player, <b>bid higher</b> or <b>pass</b>. Passing means you're out for that item.</li>
      <li>Can't top the bid? You're skipped. Last bidder standing wins it!</li>
      <li>You must keep $1 for every empty slot, so spend wisely. Compare teams at the end!</li></ol></section>
    <div class="dock"><button class="btn big" style="--c:var(--green)" data-a="go">Start the draft ▶</button></div>
  </div>`, {
    back: home,
    picks(el) { S.draft.picks = +el.dataset.k; saveCfg(); document.querySelectorAll('.segb').forEach(b => b.classList.toggle('on', b === el)); },
    set(el) { S.draft.set = el.dataset.k; saveCfg(); document.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === el)); },
    go: draftStart,
  });
}
function draftStart() {
  const mine = S.draft.set === 'mix' ? ALL_ITEMS : ALL_ITEMS.filter(i => i.set === S.draft.set);
  D = {
    picks: S.draft.picks, money: {}, team: {}, n: 0, lot: null, crown: null,
    pool: shuffle(mine), reserve: shuffle(ALL_ITEMS.filter(i => !mine.includes(i))), unsold: [],
  };
  S.players.forEach(p => { D.money[p.id] = BUDGET; D.team[p.id] = []; });
  draftNextLot();
}
const needs = p => D.picks - D.team[p.id].length;
const maxBid = p => D.money[p.id] - (needs(p) - 1);
const minBid = () => (D.lot.holder ? D.lot.bid + 1 : 1);
const canAct = p => needs(p) > 0 && maxBid(p) >= minBid();
function draftNextLot() {
  if (S.players.every(p => needs(p) <= 0)) return draftResults();
  if (!D.pool.length) {
    if (D.reserve.length) { D.pool = D.reserve.splice(0, 6); toast('Bonus items from other sets!'); }
    else if (D.unsold.length) { D.pool = shuffle(D.unsold); D.unsold = []; }
    else D.pool = shuffle(ALL_ITEMS);
  }
  const item = D.pool.pop();
  D.n++;
  const starter = pick(S.players.filter(p => needs(p) > 0));
  D.lot = { item, bid: 0, holder: null, out: new Set(S.players.filter(p => needs(p) <= 0).map(p => p.id)), turn: starter.id, amt: 1, done: false, fresh: true };
  sfx.pop();
  draftScreen();
}
function slotsHTML(p) {
  return Array.from({ length: D.picks }, (_, i) => `<i class="${i < D.team[p.id].length ? 'f' : ''}"></i>`).join('');
}
function draftScreen() {
  const L = D.lot, cur = byId(L.turn), holder = L.holder && byId(L.holder);
  const allFull = S.players.every(p => needs(p) <= 0);
  const wallets = S.players.map(p => {
    const full = needs(p) <= 0;
    const cls = [!L.done && p.id === L.turn ? 'turn' : '', L.out.has(p.id) && !full ? 'out' : '', full ? 'full' : '', p.id === L.holder ? 'lead' : ''].join(' ');
    return `<div class="wallet ${cls}">${img(p.char)}<span class="w-name">${esc(nm(p))}</span><span class="w-money">$${D.money[p.id]}</span><span class="slots">${slotsHTML(p)}</span></div>`;
  }).join('');
  const bidline = holder
    ? `<div class="bidline">Top bid <b class="bid">$${L.bid}</b> ${img(holder.char)} <b>${esc(nm(holder))}</b></div>`
    : `<div class="bidline none">No bids yet · opening bid $1</div>`;
  let lower;
  if (!L.done) {
    const mx = maxBid(cur);
    lower = `<div class="turn box">
      <div class="turn-who">${img(cur.char, 'hop')}<div><b>${esc(nm(cur))}'s turn</b><span class="tiny">Has $${D.money[cur.id]} · can bid up to $${mx}</span></div></div>
      <div class="stepper">
        <button class="sbtn" data-a="minus" aria-label="Lower bid">−</button>
        <div class="amt">$<span id="amt">${L.amt}</span></div>
        <button class="sbtn" data-a="plus" aria-label="Raise bid">+</button>
        <button class="sbtn maxb" data-a="max">MAX</button>
      </div>
      <div class="row2"><button class="btn" data-a="pass" style="--c:#fff">Pass</button>
        <button class="btn" data-a="bid" id="bidBtn" style="--c:var(--green)">Bid $${L.amt}</button></div>
    </div>`;
  } else {
    lower = `<div class="sold-banner box ${holder ? '' : 'nope'}">
      <div class="stamp">${holder ? 'SOLD!' : 'NO TAKERS'}</div>
      ${holder ? `<div class="sold-to">${img(holder.char, 'hop')}<span>to <b>${esc(nm(holder))}</b> for <b class="bid">$${L.bid}</b></span></div>` : '<p class="tiny">Nobody wanted it. It might come back later!</p>'}
    </div>
    <div class="dock"><button class="btn big" style="--c:var(--green)" data-a="nextLot">${allFull ? 'See the teams ▶' : 'Next item ▶'}</button></div>`;
  }
  render(`<div class="screen draft">
    ${bar('$20 Draft', { extra: `<span class="step">#${D.n}</span>` })}
    <div class="wallets">${wallets}</div>
    <div class="lot box ${L.fresh ? 'enter' : ''}">
      <span class="lot-set">${esc(L.item.setName)}</span>
      <div class="lot-art">${img(L.item.icon, L.fresh ? 'pop' : '')}</div>
      <div class="lot-name">${esc(L.item.name)}</div>
    </div>
    ${bidline}
    ${lower}
  </div>`, {
    back() { confirmBox('Quit the draft? Teams will be lost.', 'Quit', draftSetup); },
    minus() { setAmt(L.amt - 1); },
    plus() { setAmt(L.amt + 1); },
    max() { setAmt(maxBid(cur)); },
    pass() { draftAct('pass'); },
    bid() { draftAct('bid'); },
    nextLot: draftNextLot,
  }, { keepScroll: !L.fresh });
  L.fresh = false;
  const turnEl = $('.wallet.turn');
  if (turnEl) turnEl.scrollIntoView({ block: 'nearest', inline: 'center' });
  function setAmt(v) {
    L.amt = Math.max(minBid(), Math.min(maxBid(cur), v));
    $('#amt').textContent = L.amt;
    $('#bidBtn').textContent = `Bid $${L.amt}`;
  }
}
function draftAct(kind) {
  const L = D.lot, p = byId(L.turn);
  if (kind === 'bid') {
    if (L.amt < minBid() || L.amt > maxBid(p)) return;
    L.bid = L.amt; L.holder = p.id; sfx.coin();
  } else {
    L.out.add(p.id); sfx.pass();
  }
  const ps = S.players, from = ps.indexOf(p), skipped = [];
  for (let k = 1; k <= ps.length; k++) {
    const q = ps[(from + k) % ps.length];
    if (L.out.has(q.id) || q.id === L.holder) continue;
    if (!canAct(q)) { L.out.add(q.id); skipped.push(q); continue; }
    L.turn = q.id; L.amt = minBid();
    if (skipped.length) toast(`${skipped.map(s => `<b>${esc(nm(s))}</b>`).join(', ')} can't top $${L.bid}, skipped!`);
    return draftScreen();
  }
  if (skipped.length) toast(`${skipped.map(s => `<b>${esc(nm(s))}</b>`).join(', ')} can't top $${L.bid}, skipped!`);
  // Nobody left who can act: the lot is over.
  L.done = true;
  if (L.holder) {
    D.money[L.holder] -= L.bid;
    D.team[L.holder].push(Object.assign({ price: L.bid }, L.item));
  } else {
    D.unsold.push(L.item);
  }
  draftScreen();
  if (L.holder) sfx.sold(); else sfx.sad();
}
function draftResults(view) {
  view = view || 'teams';
  const ps = S.players;
  const spent = p => BUDGET - D.money[p.id];
  const teams = ps.map(p => `
    <div class="team box ${D.crown === p.id ? 'crowned' : ''}">
      <div class="team-head">${img(p.char)}<div><b>${esc(nm(p))}</b><span class="tiny">Spent $${spent(p)} · $${D.money[p.id]} left</span></div>
        <button class="crown-btn ${D.crown === p.id ? 'on' : ''}" data-a="crown" data-id="${p.id}" aria-label="Crown ${esc(nm(p))}">${img('crown')}</button></div>
      <div class="team-items">${D.team[p.id].map(it => `<div class="titem">${img(it.icon)}<span>${esc(it.name)}</span><b>$${it.price}</b></div>`).join('')}</div>
    </div>`).join('');
  const side = `<div class="side-wrap"><table class="side">
    <thead><tr><th></th>${ps.map(p => `<th>${img(p.char)}<span>${esc(nm(p))}</span></th>`).join('')}</tr></thead>
    <tbody>${Array.from({ length: D.picks }, (_, i) => `<tr><td class="pickno">${i + 1}</td>${ps.map(p => {
      const it = D.team[p.id][i];
      return `<td>${it ? `${img(it.icon)}<span>${esc(it.name)}</span><b>$${it.price}</b>` : ''}</td>`;
    }).join('')}</tr>`).join('')}
    <tr class="tot"><td>$</td>${ps.map(p => `<td>$${spent(p)} spent</td>`).join('')}</tr></tbody></table></div>`;
  render(`<div class="screen">
    ${bar('Draft Results')}
    <h2 class="big-title center">Draft complete!</h2>
    <p class="sub center">Who built the best team? Argue it out, then tap ${img('crown', 'inline')} to crown a winner.</p>
    <div class="tabs"><button class="tab ${view === 'teams' ? 'on' : ''}" data-a="teams">Teams</button><button class="tab ${view === 'side' ? 'on' : ''}" data-a="side">Side by side</button></div>
    ${view === 'teams' ? `<div class="teams">${teams}</div>` : side}
    <div class="dock row2"><button class="btn" data-a="home" style="--c:#fff">Home</button>
      <button class="btn" style="--c:var(--green)" data-a="again">New draft ▶</button></div>
  </div>`, {
    back: draftSetup, home, again: draftSetup,
    teams() { draftResults('teams'); },
    side() { draftResults('side'); },
    crown(el) {
      D.crown = D.crown === el.dataset.id ? null : el.dataset.id;
      if (D.crown) { sfx.fanfare(); fx.confetti(); }
      draftResults(view);
    },
  }, { keepScroll: !!D.celebrated });
  if (!D.celebrated) { D.celebrated = true; sfx.fanfare(); fx.confetti(); }
}

// ---- Boot -----------------------------------------------------------------------------
home();

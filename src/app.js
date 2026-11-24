document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // The untouched page source, captured before anything changes the DOM, so
  // the admin can download a copy of this file with new prompts inside.
  const PRISTINE = '<!doctype html>\n' + document.documentElement.outerHTML;

  // ------------------------------------------------------------------ setup
  const E = window.NichionEngine;
  const DATA = JSON.parse(document.getElementById('nichion-data').textContent);
  const game = new E.Game(DATA, E.makeStorage('nichion_save_v1'));
  const $ = (s, r = document) => r.querySelector(s);
  const screenEl = $('#screen');
  const ocean = new Ocean($('#ocean'));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const EMOJI = { plankton: '🦠', clever: '🐙', schooler: '🐟', rare: '🐢', deepcut: '🏮', nichion: '🦁', miss: '⌛' };
  const BLURB = {
    plankton: 'Everyone thought of it.',
    clever: 'A little too obvious-clever.',
    schooler: 'Swimming with the pack.',
    rare: 'Not many go this deep.',
    deepcut: 'A true deep cut.',
    nichion: 'You found the Nichion!',
  };

  let S = null;          // game state
  let tiers = [], tierBy = {};
  let resetAt = 0;
  let busy = false;
  let view = 'title';

  function load() {
    S = game.state();
    tiers = S.tiers;
    tierBy = Object.fromEntries(tiers.map(t => [t.key, t]));
    resetAt = Date.now() + S.resetInMs;
    return S;
  }

  const depthSoFar = () => S.play.guesses.reduce((s, g) => s + g.depth, 0);
  const tierColor = k => `var(--t-${k || 'miss'})`;
  const fmtDate = (d, opts = { weekday: 'long', month: 'short', day: 'numeric' }) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });

  // ---------------------------------------------------------- screen system
  function show(node, name) {
    view = name;
    stopTimer();
    hideTip();
    const olds = [...screenEl.children];
    for (const old of olds) {
      if (!old.classList.contains('leaving')) { old.classList.add('leaving'); setTimeout(() => old.remove(), 200); }
    }
    if (olds.length) node.style.animationDelay = '120ms';
    screenEl.appendChild(node);
    $('#topbar').classList.toggle('hide-logo', name === 'title');
    $('#depth-gauge').classList.toggle('show', name === 'game');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show ' + kind;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = kind; }, 2600);
  }

  // ---------------------------------------------------------------- tooltip
  const tip = $('#tip');
  function showTip(target) {
    tip.innerHTML = target.getAttribute('data-tip');
    tip.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(10, Math.min(innerWidth - tw - 10, x));
    let y = r.top - th - 12;
    if (y < 8) y = r.bottom + 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    document.querySelectorAll('.chart g.on').forEach(g => g.classList.remove('on'));
    if (target.matches('.chart g')) target.classList.add('on');
  }
  function hideTip() { tip.hidden = true; document.querySelectorAll('.chart g.on').forEach(g => g.classList.remove('on')); }
  document.addEventListener('pointerover', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('pointerout', e => { const t = e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', e => { const t = e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) showTip(t); });
  document.addEventListener('focusout', hideTip);
  addEventListener('scroll', hideTip, { passive: true });

  // ------------------------------------------------------------------ modal
  function modal(inner, { onClose } = {}) {
    const root = $('#modal-root');
    const back = h(`<div class="modal-backdrop"><div class="modal px-box" role="dialog" aria-modal="true">
      <button class="icon-btn close" aria-label="Close"><svg viewBox="0 0 12 12" width="18" height="18" shape-rendering="crispEdges"><path fill="currentColor" d="M1 1h2v1h1v1h1v1h2V3h1V2h1V1h2v2h-1v1H9v1H8v2h1v1h1v1h1v2H9v-1H8v-1H7V9H5v1H4v1H3v1H1v-2h1V9h1V8h1V6H3V5H2V4H1z"/></svg></button>
    </div></div>`);
    const box = back.firstElementChild;
    box.append(inner);
    const prevFocus = document.activeElement;
    const close = () => {
      back.classList.add('closing');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { back.remove(); prevFocus?.focus?.(); onClose?.(); }, 150);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', e => { if (e.target === back) close(); });
    box.querySelector('.close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    root.append(back);
    (box.querySelector('[data-autofocus]') || box.querySelector('.close')).focus();
    return close;
  }

  function helpModal() {
    const node = h(`<div>
      <h2>HOW TO DIVE</h2>
      <p>Every day there are up to <b>five prompts</b>, and you get <b>25 seconds</b> for each.</p>
      <p>Type answers until you hit one that’s on the board. Common answers keep you in the shallows; <b>rarer answers sink you deeper</b> and score more. Run out of time and you stay put.</p>
      <div class="tier-legend" style="margin:16px 0"></div>
      <p>Small typos are forgiven — the sonar auto-corrects answers that are close.</p>
      <p>Come back tomorrow to see <b>yesterday’s full answer sheet</b>, and keep your streak alive.</p>
      <button class="btn wide" data-autofocus>GOT IT</button>
      <button class="admin-link" data-admin>Admin: edit prompts</button>
    </div>`);
    node.querySelector('.tier-legend').append(...tierLegend());
    const close = modal(node);
    node.querySelector('.btn').addEventListener('click', close);
    node.querySelector('[data-admin]').addEventListener('click', () => { close(); setTimeout(openAdmin, 180); });
  }

  function noPromptsModal() {
    const node = h(`<div class="calm">
      <div class="art"></div>
      <h2>THE OCEAN IS CALM</h2>
      <p>No prompts have been set for today, so there’s no dive.</p>
      <p>Check back tomorrow${S.hasYesterday ? ' — or look over yesterday’s answers' : ''}.</p>
      <div class="title-actions">
        ${S.hasYesterday ? '<button class="btn blue wide" data-y>YESTERDAY</button>' : ''}
        <button class="btn wide" data-autofocus data-ok>OKAY</button>
      </div>
    </div>`);
    node.querySelector('.art').append(Sprites.img('jelly', 6));
    const close = modal(node);
    node.querySelector('[data-ok]').addEventListener('click', close);
    node.querySelector('[data-y]')?.addEventListener('click', () => { close(); renderYesterday(); });
  }

  function tierLegend() {
    return tiers.map(t => {
      const c = h(`<div class="tier-chip" style="--tc:${tierColor(t.key)}"><span class="tn">${esc(t.name)}</span><span class="td">${t.depth}M · ${t.points}PTS</span></div>`);
      c.prepend(Sprites.img(t.key, 3));
      return c;
    });
  }

  /** "Come back tomorrow" card: today's full answer sheet unlocks at midnight. */
  function comeBackCard(compact = false) {
    const p = S.play;
    const gotTop = p.guesses.some(g => g.tier === 'nichion');
    const line = gotTop
      ? 'You found a Nichion today. Come back tomorrow to see the rest of the best guesses: every Nichion and Deep Cut answer, revealed.'
      : 'Come back tomorrow to see today’s best guesses: every Nichion and Deep Cut answer, plus the whole board, revealed.';
    const card = h(`<div class="comeback ${compact ? 'compact' : ''}">
      <div class="comeback-art"></div>
      <div>
        <div class="comeback-title">COME BACK TOMORROW</div>
        <p>${compact ? 'See today’s best guesses when the answers unlock.' : line}</p>
        <div class="comeback-time">Unlocks in <b data-cd>--:--:--</b></div>
      </div>
    </div>`);
    card.querySelector('.comeback-art').append(Sprites.img('nichion', compact ? 2 : 3));
    return card;
  }

  function statsRow() {
    const st = S.stats;
    return h(`<div class="stats">
      <div class="stat hot"><b>${st.streak}</b><span>Streak</span></div>
      <div class="stat"><b>${st.bestStreak}</b><span>Best streak</span></div>
      <div class="stat"><b>${st.played}</b><span>Dives</span></div>
      <div class="stat"><b>${st.bestScore}</b><span>Best score</span></div>
    </div>`);
  }

  // ------------------------------------------------------------------ title
  function renderTitle() {
    ocean.setMode('surface');
    const p = S.play;
    const letters = 'NICHION'.split('').map((c, i) => `<span style="animation-delay:${-i * 0.14}s">${c}</span>`).join('');
    let status = '';
    if (S.clockProblem) status = `Your device’s date looks earlier than a day you already played (${esc(fmtDate(S.clockProblem, { month: 'short', day: 'numeric' }))}). Fix the clock to dive.`;
    else if (!p.total) status = 'No prompts today — the water’s still.';
    else if (p.done) status = `Today’s dive is done: <b>${p.score} pts</b>.`;
    else if (p.guesses.length) status = `Dive in progress — prompt <b>${p.current + 1}</b> of ${p.total}.`;
    else status = `<b>${p.total}</b> prompt${p.total === 1 ? '' : 's'} today · 25 seconds each.`;

    const node = h(`<section class="screen title">
      <h1 class="logo" aria-label="Nichion">${letters}</h1>
      <p class="tagline">How deep can you go?</p>
      <div class="title-date">${esc(fmtDate(S.today).toUpperCase())}</div>
      <div class="title-spacer"></div>
      <div class="title-panel px-box">
        <p class="title-status">${status}</p>
        <div class="title-actions">
          <button class="btn wide" data-play>${p.done ? 'SEE RESULTS' : p.guesses.length ? 'RESUME DIVE' : 'DIVE IN'} <span class="arrow">▸</span></button>
          <button class="btn blue wide" data-y>YESTERDAY’S DEPTHS</button>
        </div>
        <div></div>
      </div>
    </section>`);
    node.querySelector('.title-panel > div:last-child').replaceWith(statsRow());
    if (p.done) { node.querySelector('.title-actions').after(comeBackCard(true)); }
    if (!S.persistent) node.querySelector('.title-status').after(h('<p class="warn-line">This browser isn’t saving progress (private mode?). Your streak won’t be kept.</p>'));
    node.querySelector('[data-play]').addEventListener('click', () => {
      load();
      if (S.clockProblem) return toast('Your device clock looks wrong — set it to today’s date.', 'error');
      if (!S.play.total) return noPromptsModal();
      if (S.play.done) return renderResults();
      renderGame();
    });
    node.querySelector('[data-y]').addEventListener('click', renderYesterday);
    show(node, 'title');
    if (p.done) startCountdown(node);
  }

  // ------------------------------------------------------------------- game
  function hud() {
    const p = S.play;
    const node = h(`<div class="hud px-box dim">
      <div class="hud-side">DEPTH<b data-depth>${depthSoFar()}m</b></div>
      <div class="pips-wrap">
        <div class="pips" role="list" aria-label="Prompts"></div>
        <div class="pip-label" data-pl></div>
      </div>
      <div class="hud-side right">SCORE<b data-score>${p.score}</b></div>
    </div>`);
    updateHud(node);
    return node;
  }

  function updateHud(node, { pop = -1 } = {}) {
    const p = S.play;
    const pips = node.querySelector('.pips');
    pips.innerHTML = '';
    for (let i = 0; i < p.total; i++) {
      const g = p.guesses[i];
      const pip = h(`<div class="pip" role="listitem"></div>`);
      if (g) {
        pip.classList.add('done');
        if (!g.tier) pip.classList.add('miss');
        pip.style.setProperty('--tc', tierColor(g.tier));
        pip.setAttribute('aria-label', `Prompt ${i + 1}: ${g.tier ? tierBy[g.tier].name : 'time ran out'}`);
        pip.dataset.tip = g.tier ? `<b>P${i + 1}</b> “${esc(g.guess)}” · ${esc(tierBy[g.tier].name)}` : `<b>P${i + 1}</b> Time ran out`;
        if (i === pop) pip.classList.add('pop');
      } else {
        if (i === p.current) pip.classList.add('current');
        pip.setAttribute('aria-label', `Prompt ${i + 1}${i === p.current ? ' (current)' : ''}`);
      }
      pips.append(pip);
    }
    const on = p.current == null ? p.total : p.current + 1;
    node.querySelector('[data-pl]').textContent = `PROMPT ${Math.min(on, p.total)} OF ${p.total}`;
    updateGauge();
  }

  function updateGauge() {
    const g = $('#depth-gauge');
    const max = Math.max(100, S.play.total * 100);
    const d = depthSoFar();
    if (!g.dataset.built || +g.dataset.max !== max) {
      g.innerHTML = '<div class="fill"></div>';
      for (let m = 0; m <= max; m += 100) g.append(h(`<div class="tick" style="top:${(m / max) * 100}%">${m}m</div>`));
      g.append(h('<div class="marker"><span></span></div>'));
      g.dataset.built = 1; g.dataset.max = max;
    }
    g.querySelector('.fill').style.height = (d / max) * 100 + '%';
    const mk = g.querySelector('.marker');
    mk.style.top = `calc(${(d / max) * 100}% - 2px)`;
    mk.querySelector('span').textContent = d + 'm';
  }

  function bump(el, text) {
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  function renderGame() {
    const p = S.play;
    if (!p.total) return noPromptsModal();
    if (p.done) return renderResults();
    ocean.setMode('dive');
    ocean.setDepth(depthSoFar(), { burst: false });

    const node = h(`<section class="screen game"></section>`);
    const hudEl = hud();
    node.append(hudEl, h('<div class="window"></div>'));
    const card = h(`<section class="card px-box"></section>`);
    node.append(card);
    show(node, 'game');
    promptCard(card, hudEl);
  }

  let timerId = 0;
  const stopTimer = () => { clearInterval(timerId); timerId = 0; };

  function promptCard(card, hudEl) {
    stopTimer();
    const p = S.play;
    const i = p.current;
    const prompt = p.prompts[i];
    let deadline;
    try { deadline = game.start({ date: S.today, index: i }); }
    catch (err) { load(); return err.code === 'out_of_order' ? renderGame() : renderTitle(); }
    const LIMIT = E.TIME_LIMIT_MS;

    card.innerHTML = '';
    card.append(h(`<div>
      <div class="kicker"><span>PROMPT ${i + 1} / ${p.total}</span><span class="timer-num" data-num aria-hidden="true">25</span></div>
      <div class="timer" role="timer" aria-label="Time left"><i data-bar></i></div>
      <h2 class="prompt-text" id="prompt-text">${esc(prompt.text)}</h2>
      <form class="guess-form" autocomplete="off" novalidate>
        <label class="sr-only" for="guess">Your answer</label>
        <input class="field" id="guess" name="guess" maxlength="60" placeholder="Your answer…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="prompt-text nope">
        <button class="btn" type="submit">DIVE</button>
      </form>
      <div class="tries" data-tries>
        <p class="nope" id="nope" role="status" aria-live="assertive"></p>
        <div class="miss-chips" data-chips></div>
      </div>
      <p class="hint"><span>Not on the board? Keep trying until time runs out.</span><span><kbd>ENTER</kbd></span></p>
    </div>`));
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = 'screen-in 380ms both';
    const form = card.querySelector('form');
    const input = card.querySelector('input');
    const btn = form.querySelector('button');
    const bar = card.querySelector('[data-bar]'), num = card.querySelector('[data-num]'), timerEl = card.querySelector('.timer');
    const nope = card.querySelector('.nope'), chips = card.querySelector('[data-chips]');
    const renderChips = list => { chips.innerHTML = ''; list.forEach(m => chips.append(h(`<span class="miss-chip">✗ ${esc(m)}</span>`))); };
    renderChips(p.misses || []);
    setTimeout(() => input.focus({ preventScroll: true }), 60);

    // Countdown (wall-clock based, so reloading or switching tabs doesn't pause it).
    let lastSec = null;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      bar.style.width = (left / LIMIT) * 100 + '%';
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) {
        num.textContent = sec;
        lastSec = sec;
        timerEl.classList.toggle('low', sec <= 5);
        num.classList.toggle('low', sec <= 5);
        if (sec <= 5 && sec > 0) { num.classList.remove('tick'); void num.offsetWidth; num.classList.add('tick'); }
      }
      if (left <= 0) {
        stopTimer();
        try {
          const rec = game.timeUp({ date: S.today, index: i });
          load();
          revealResult(card, hudEl, rec);
        } catch (err) {
          if (err.code === 'not_yet') { timerId = setInterval(tick, 100); return; }
          load(); renderGame();
        }
      }
    };
    tick();
    timerId = setInterval(tick, 100);

    const shake = () => { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy || !timerId) return;
      const guess = input.value.trim();
      if (!guess) { shake(); input.focus(); return; }
      busy = true;
      try {
        const result = game.guess({ date: S.today, index: i, guess });
        if (result.invalid) {
          shake();
          nope.textContent = result.repeat ? `You already tried “${result.guess}”.`
            : result.ambiguous ? `“${result.guess}” is close to more than one answer — be more specific!`
            : `“${result.guess}” isn’t on the board — try again!`;
          nope.classList.remove('show'); void nope.offsetWidth; nope.classList.add('show');
          renderChips(result.misses);
          input.value = '';
          input.focus();
          return;
        }
        stopTimer();
        load();
        revealResult(card, hudEl, result);
      } catch (err) {
        stopTimer();
        if (err.code === 'day_changed') { toast('A new day has begun — reloading…'); await sleep(900); load(); return renderTitle(); }
        if (err.code === 'clock') { load(); return renderTitle(); }
        if (err.code === 'out_of_order' || err.code === 'done') { load(); return renderGame(); }
        toast(err.message, 'error');
        timerId = setInterval(tick, 100);
        input.focus();
      } finally { busy = false; }
    });
  }

  function revealResult(card, hudEl, r) {
    const p = S.play;
    const t = r.tier ? tierBy[r.tier] : null;
    const last = p.done;
    const form = card.querySelector('form');
    const hint = card.querySelector('.hint');
    card.querySelector('[data-tries]')?.remove();
    const timer = card.querySelector('.timer');
    if (timer) { timer.classList.add('done'); if (r.timedOut) timer.querySelector('i').style.width = '0%'; }
    const tries = r.misses && r.misses.length ? `<div class="result-tries">${r.misses.length} miss${r.misses.length === 1 ? '' : 'es'} first: ${r.misses.slice(0, 4).map(esc).join(', ')}${r.misses.length > 4 ? '…' : ''}</div>` : '';
    const res = h(`<div class="result ${t ? '' : 'miss'} ${r.tier === 'nichion' ? 'big' : ''}" style="--tc:${tierColor(r.tier)}">
      <div class="result-art"></div>
      <div>
        <div class="result-tier">${t ? esc(t.name).toUpperCase() : 'TIME’S UP'}</div>
        <div class="result-gain">${t ? `<span class="pts">+${t.points} PTS</span><span>↓ ${t.depth}M</span>` : '<span>+0 PTS</span><span>STAY PUT</span>'}</div>
        <div class="result-guess">${t ? `${esc(BLURB[r.tier])}<br><q>${esc(r.matched)}</q>` : 'The clock ran out before you found an answer.'}</div>
        ${r.desc ? `<div class="result-desc">${esc(r.desc)}</div>` : ''}
        ${tries}
        ${r.corrected ? `<div class="autocorrect" title="Close enough!">✎ auto-corrected from “${esc(r.guess)}”</div>` : ''}
      </div>
      <div class="result-actions"><button class="btn wide" data-next>${last ? 'SEE RESULTS' : 'NEXT PROMPT'} <span class="arrow">▸</span></button></div>
    </div>`);
    res.querySelector('.result-art').append(t ? Sprites.img(r.tier, r.tier === 'nichion' ? 4 : r.tier === 'plankton' || r.tier === 'schooler' ? 6 : 5) : Sprites.img('hourglass', 6));
    form.replaceWith(res);
    hint.remove();

    // Dive!
    ocean.setDepth(depthSoFar());
    if (r.tier === 'nichion') { ocean.celebrate('#ffcf3f'); const f = h('<div class="flash"></div>'); document.body.append(f); setTimeout(() => f.remove(), 800); }
    else if (r.tier === 'deepcut') ocean.celebrate('#fff3a0');
    bump(hudEl.querySelector('[data-depth]'), depthSoFar() + 'm');
    bump(hudEl.querySelector('[data-score]'), p.score);
    updateHud(hudEl, { pop: r.index });

    const next = res.querySelector('[data-next]');
    setTimeout(() => next.focus({ preventScroll: true }), 50);
    next.addEventListener('click', () => {
      if (last) return renderResults();
      promptCard(card, hudEl);
      updateHud(hudEl);
    });
  }

  // ---------------------------------------------------------------- results
  const RANKS = [
    [0, 'Puddle Paddler'], [0.15, 'Reef Wader'], [0.3, 'Kelp Climber'],
    [0.45, 'Trench Diver'], [0.6, 'Abyss Walker'], [0.75, 'Leviathan Hunter'], [0.9, 'Nichion Tamer'],
  ];

  function renderResults() {
    const p = S.play;
    ocean.setMode('dive');
    ocean.setDepth(depthSoFar(), { burst: false });
    const max = p.total * 100;
    const frac = max ? p.score / max : 0;
    const rank = RANKS.filter(([f]) => frac >= f).pop()[1];

    const node = h(`<section class="screen results">
      <div class="score-panel px-box">
        <div class="kicker">DIVE COMPLETE · ${esc(fmtDate(S.today, { month: 'short', day: 'numeric' }).toUpperCase())}</div>
        <div class="rank">${esc(rank)}</div>
        <div class="big-score"><span data-count>0</span><small>PTS</small></div>
        <div class="score-sub">↓ ${depthSoFar()}M DEEP · MAX ${max}</div>
        ${p.total < 5 ? `<p class="footnote">(out of ${p.total} question${p.total === 1 ? '' : 's'} today)</p>` : ''}
        <div class="share-row">
          <button class="btn small" data-share>SHARE</button>
          <button class="btn small blue" data-y>YESTERDAY</button>
        </div>
        <div class="countdown">Next dive in<b data-cd>--:--:--</b></div>
      </div>
      <div class="section px-box"></div>
      <div class="section px-box">
        <h3>POINTS PER PROMPT</h3><p class="sub">Each guess, by how rare it was.</p>
        <div data-bars></div>
      </div>
      <div class="section px-box">
        <h3>DIVE PROFILE</h3><p class="sub">Your depth after each prompt.</p>
        <div data-profile></div>
      </div>
      <div class="section px-box">
        <h3>YOUR GUESSES</h3><p class="sub">What you said, and where it landed.</p>
        <ul class="guess-list"></ul>
      </div>
    </section>`);

    const statsSec = node.querySelectorAll('.section')[0];
    statsSec.append(h('<h3 style="margin-bottom:12px">YOUR STATS</h3>'), statsRow(), comeBackCard());

    node.querySelector('[data-bars]').append(Charts.bars(p.guesses, p.total, tiers));
    node.querySelector('[data-profile]').append(Charts.profile(p.guesses, p.total, tiers));

    const list = node.querySelector('.guess-list');
    p.guesses.forEach((g, i) => {
      const t = tierBy[g.tier];
      const row = h(`<li class="guess-row" style="--tc:${tierColor(g.tier)};animation-delay:${200 + i * 80}ms">
        <div></div>
        <div><div class="q">P${i + 1} · ${esc(g.prompt)}</div><div class="a">${g.timedOut ? '<span class="muted">Time ran out</span>' : esc(g.guess)}${g.corrected && g.matched ? ` <small>→ ${esc(g.matched)}</small>` : ''}</div>${g.desc ? `<div class="desc">${esc(g.desc)}</div>` : ''}${g.misses && g.misses.length ? `<div class="q">${g.misses.length} miss${g.misses.length === 1 ? '' : 'es'} first</div>` : ''}</div>
        <div class="p">+${g.points}<small>${t ? esc(t.name).toUpperCase() : 'TIME’S UP'}</small></div>
      </li>`);
      row.firstElementChild.replaceWith(Sprites.img(t ? g.tier : 'hourglass', 3));
      list.append(row);
    });

    node.querySelector('[data-share]').addEventListener('click', share);
    node.querySelector('[data-y]').addEventListener('click', renderYesterday);
    show(node, 'results');

    // Count-up.
    const el = node.querySelector('[data-count]');
    const start = performance.now(), dur = Math.min(1600, 400 + p.score * 4);
    const tick = now => {
      const f = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(p.score * (1 - Math.pow(1 - f, 3)));
      if (f < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    startCountdown(node);
  }

  /** Ticks every [data-cd] inside `scope` down to the next local midnight. */
  function startCountdown(scope) {
    clearInterval(startCountdown._i);
    const els = [...scope.querySelectorAll('[data-cd]')];
    const upd = async () => {
      if (!scope.isConnected) return clearInterval(startCountdown._i);
      const ms = resetAt - Date.now();
      if (ms <= 0) {
        clearInterval(startCountdown._i);
        load();
        toast('A new dive is ready!');
        return renderTitle();
      }
      const s = Math.floor(ms / 1000);
      const txt = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
      els.forEach(el => { el.textContent = txt; });
    };
    upd();
    startCountdown._i = setInterval(upd, 1000);
  }

  async function share() {
    const p = S.play;
    const text = [
      `NICHION · ${fmtDate(S.today, { month: 'short', day: 'numeric' })}`,
      p.guesses.map(g => EMOJI[g.tier || 'miss']).join(''),
      `↓${depthSoFar()}m · ${p.score} pts${p.total < 5 ? ` (out of ${p.total})` : ''}`,
      location.origin,
    ].join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Copied to clipboard!'); }
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Couldn’t copy — try again.', 'error');
    }
  }

  // -------------------------------------------------------------- yesterday
  async function renderYesterday() {
    const loading = h('<section class="screen"><div class="loading">SONAR<span>…</span></div></section>');
    show(loading, 'yesterday');
    await sleep(250);
    if (view !== 'yesterday') return;
    const Y = game.yesterday();

    const node = h(`<section class="screen yesterday">
      <div class="y-head px-box">
        <div class="kicker">YESTERDAY’S DEPTHS</div>
        <h2>${esc(fmtDate(Y.date).toUpperCase())}</h2>
        <button class="btn small ghost" data-back>◂ BACK</button>
      </div>
    </section>`);
    node.querySelector('[data-back]').addEventListener('click', () => (S.play.done ? renderResults() : renderTitle()));

    if (!Y.prompts.length) {
      const empty = h(`<div class="section px-box calm"><div class="art"></div><p class="empty">No prompts were set yesterday.</p></div>`);
      empty.querySelector('.art').append(Sprites.img('jelly', 5));
      node.append(empty);
    }

    for (const pr of Y.prompts) {
      const g = Y.guesses.find(x => x.index === pr.index);
      const gt = g?.tier ? tierBy[g.tier] : null;
      const sec = h(`<div class="section px-box y-prompt" style="--tc:${tierColor(g?.tier)}">
        <div class="kicker">PROMPT ${pr.index + 1}</div>
        <h4>${esc(pr.text)}</h4>
        ${g ? (gt ? `<p class="y-you">You said <b>“${esc(g.guess)}”</b> — ${esc(gt.name)}, +${g.points}</p>` : '<p class="y-you">Your time ran out on this one.</p>') : '<p class="y-you">You didn’t answer this one.</p>'}
        <div class="y-tiers"></div>
      </div>`);
      const wrap = sec.querySelector('.y-tiers');
      // Deepest first: the good stuff at the top.
      for (const tt of [...pr.tiers].reverse()) {
        const t = tierBy[tt.key];
        const row = h(`<div class="y-tier" style="--tc:${tierColor(t.key)}">
          <div></div>
          <div><div class="tn">${esc(t.name).toUpperCase()} <span>· ${t.depth}M · ${t.points}PTS</span></div><div class="chips"></div></div>
        </div>`);
        row.firstElementChild.replaceWith(Sprites.img(t.key, 3));
        const chips = row.querySelector('.chips');
        const LIMIT = 12;
        const mk = (a, k) => {
          const d = tt.descs && tt.descs[k];
          return h(`<span class="chip ${d ? 'has-desc' : ''} ${g && g.matched === a && g.tier === t.key ? 'you' : ''}">${esc(a)}${d ? `<small>${esc(d)}</small>` : ''}</span>`);
        };
        if (!tt.answers.length) chips.append(h('<span class="empty">—</span>'));
        tt.answers.slice(0, LIMIT).forEach((a, k) => chips.append(mk(a, k)));
        if (tt.answers.length > LIMIT) {
          const more = h(`<button class="chip more">+${tt.answers.length - LIMIT} more</button>`);
          more.addEventListener('click', () => { more.replaceWith(...tt.answers.slice(LIMIT).map((a, k) => mk(a, LIMIT + k))); });
          chips.append(more);
        }
        wrap.append(row);
      }
      node.append(sec);
    }
    show(node, 'yesterday');
  }

  // ------------------------------------------------------------------ admin
  function openAdmin() {
    NichionAdmin.open({ data: DATA, pristine: PRISTINE, onExit: () => { load(); renderTitle(); } });
  }
  addEventListener('hashchange', () => { if (location.hash === '#admin' && !document.getElementById('admin-root')) openAdmin(); });

  // ------------------------------------------------------------------- boot
  $('#btn-home').addEventListener('click', () => { if (S) renderTitle(); });
  $('#btn-help').addEventListener('click', () => { if (S) helpModal(); });
  $('#btn-yesterday').addEventListener('click', () => { if (S) renderYesterday(); });

  // Coming back to a tab left open overnight: refresh so it's the new day.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !S || busy) return;
    if (Date.now() >= resetAt) { load(); renderTitle(); toast('A new dive is ready!'); }
  });

  (async function boot() {
    show(h('<section class="screen"><div class="loading">DIVING<span>…</span></div></section>'), 'loading');
    try {
      load();
      ocean.setDepth(depthSoFar(), { burst: false });
      renderTitle();
      if (location.hash === '#admin') return openAdmin();
      let seen = false;
      try { seen = localStorage.getItem('nichion_seen_help') === '1'; localStorage.setItem('nichion_seen_help', '1'); } catch {}
      if (!seen) setTimeout(helpModal, 500);
    } catch (e) {
      screenEl.innerHTML = '';
      console.error(e);
      show(h(`<section class="screen"><div class="loading">NO SIGNAL — ${esc(e.message)}</div></section>`), 'error');
    }
  })();
});

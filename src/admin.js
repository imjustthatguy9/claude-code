// Nichion admin: edit prompts/answers for any day, then download a new copy
// of this same HTML file with those prompts baked in (scrambled).
(function () {
  'use strict';

  const E = window.NichionEngine;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const BOOK_KEY = 'nichion_admin_book_v1';
  const SESSION_KEY = 'nichion_admin_session';
  const tiers = E.TIERS;
  const MAXP = E.MAX_PROMPTS;

  let root, DATA, PRISTINE, onExit;
  let book = null;          // { salt, admin:{salt,hash}|null, days:{date: prompts}, fileStamp, dirty, savedAt }
  let month = null, selected = null;
  let draft = null, saved = '';
  const today = () => E.localDate();

  function toast(msg, kind = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = kind), 2600);
  }
  const fmt = (d, o = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });
  const dirty = () => draft && JSON.stringify(draft) !== saved;
  const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
  const count = d => (book.days[d] || []).length;
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- the book
  function bookFromFile() {
    const days = {};
    for (const d of Object.keys(DATA.days || {})) days[d] = E.decodeDay(DATA.salt, d, DATA.days[d]);
    return { salt: DATA.salt, admin: DATA.admin || null, days, fileStamp: DATA.stamp, dirty: false };
  }
  function storeBook() { try { localStorage.setItem(BOOK_KEY, JSON.stringify(book)); } catch {} }
  function loadStoredBook() { try { return JSON.parse(localStorage.getItem(BOOK_KEY) || 'null'); } catch { return null; } }

  async function chooseBook() {
    const stored = loadStoredBook();
    if (stored && stored.fileStamp === DATA.stamp) { book = stored; return; }
    if (stored && stored.dirty) {
      const keep = confirm(`This browser has admin edits that were never downloaded into a game file${stored.savedAt ? ` (last saved ${new Date(stored.savedAt).toLocaleString()})` : ''}.\n\nOK = keep working on those edits\nCancel = load the prompts from this file instead`);
      if (keep) { book = stored; return; }
    }
    book = bookFromFile();
    storeBook();
  }

  // -------------------------------------------------------------- download
  function buildFile() {
    const stamp = randomId();
    const days = {};
    for (const [d, prompts] of Object.entries(book.days)) if (prompts.length) days[d] = E.encodeDay(book.salt, d, prompts);
    const data = { v: 1, stamp, salt: book.salt, admin: book.admin, days };
    const json = JSON.stringify(data);
    const re = new RegExp('(<script id="nichion-' + 'data" type="application/json">)[\\s\\S]*?(</' + 'script>)');
    return { stamp, html: PRISTINE.replace(re, (_, a, b) => a + json + b) };
  }

  function download() {
    if (dirty() && !confirm('The day you are editing has unsaved changes. Download without them?')) return;
    const { stamp, html } = buildFile();
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nichion.html';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    book.fileStamp = stamp; book.dirty = false; storeBook();
    renderTop();
    toast('Downloaded nichion.html — share that file with players');
  }

  // ------------------------------------------------------------------ login
  function renderLogin(msg = '') {
    const setup = !book.admin;
    root.innerHTML = '';
    const node = h(`<div class="login px-box">
      <div class="art"></div>
      <h1>${setup ? 'SET ADMIN PASSWORD' : 'ADMIN DOCK'}</h1>
      <p>${setup ? 'Pick a password. It gets saved into the game file you download, so only you can edit prompts.' : 'Set future prompts and answers.'}</p>
      <form>
        <label class="sr-only" for="pw">Admin password</label>
        <input class="field" id="pw" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" placeholder="Password" required>
        ${setup ? '<label class="sr-only" for="pw2">Repeat password</label><input class="field" id="pw2" type="password" autocomplete="new-password" placeholder="Repeat password" required>' : ''}
        <button class="btn wide" type="submit">${setup ? 'SET PASSWORD' : 'LOG IN'}</button>
        <button class="btn wide ghost" type="button" data-back>◂ BACK TO GAME</button>
        <p class="err" role="alert">${esc(msg)}</p>
      </form>
    </div>`);
    node.querySelector('.art').append(Sprites.img('nichion', 4));
    root.append(node);
    const input = node.querySelector('#pw');
    input.focus();
    node.querySelector('[data-back]').addEventListener('click', exit);
    node.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const err = node.querySelector('.err');
      if (setup) {
        const pw2 = node.querySelector('#pw2').value;
        if (input.value.length < 4) { err.textContent = 'Use at least 4 characters.'; return; }
        if (input.value !== pw2) { err.textContent = 'Passwords don’t match.'; return; }
        const salt = randomId();
        book.admin = { salt, hash: E.sha256(salt + '|' + input.value) };
        book.dirty = true; storeBook();
      } else if (E.sha256(book.admin.salt + '|' + input.value) !== book.admin.hash) {
        // Small delay to make guessing slower.
        err.textContent = '…';
        setTimeout(() => { err.textContent = 'Wrong password.'; input.select(); }, 600);
        return;
      }
      try { sessionStorage.setItem(SESSION_KEY, book.admin.hash); } catch {}
      renderShell();
    });
  }

  function loggedIn() { try { return !!book.admin && sessionStorage.getItem(SESSION_KEY) === book.admin.hash; } catch { return false; } }

  // ------------------------------------------------------------------ shell
  function renderShell() {
    root.innerHTML = '';
    const top = h('<header class="a-top"></header>');
    const grid = h(`<div class="a-grid"><aside class="cal px-box"></aside><section id="editor"></section></div>`);
    root.append(top, grid);
    renderTop();
    month = today().slice(0, 7);
    let d = E.addDays(today(), 1);
    for (let i = 0; i < 60 && count(d) >= MAXP; i++) d = E.addDays(d, 1);
    selectDay(d, true);
  }

  function renderTop() {
    const top = root.querySelector('.a-top');
    if (!top) return;
    top.innerHTML = '';
    top.append(h(`<div class="a-brand"><h1>NICHION</h1><span class="badge">ADMIN</span></div>`),
      h(`<div class="a-actions">
        <button class="btn small ghost" data-exit>◂ GAME</button>
        <button class="btn small ghost" data-more>MORE ▾</button>
        <button class="btn small ${book.dirty ? '' : 'blue'}" data-dl>⬇ DOWNLOAD GAME FILE</button>
      </div>`));
    top.querySelector('.a-brand').prepend(Sprites.img('nichion', 2));
    if (book.dirty) top.append(h(`<div class="publish-note">Saved here in this browser — <b>download the game file</b> and share it so players get your changes.</div>`));
    top.querySelector('[data-exit]').addEventListener('click', exit);
    top.querySelector('[data-dl]').addEventListener('click', download);
    top.querySelector('[data-more]').addEventListener('click', moreMenu);
  }

  function moreMenu() {
    const box = h(`<div class="modal-backdrop"><div class="modal px-box" role="dialog" aria-modal="true" aria-label="More admin tools">
      <h2>ADMIN TOOLS</h2>
      <div class="title-actions">
        <button class="btn wide ghost" data-a="export">BACK UP PROMPTS (.JSON)</button>
        <label class="btn wide ghost" tabindex="0">RESTORE / IMPORT .JSON<input type="file" accept="application/json,.json" hidden></label>
        <button class="btn wide ghost" data-a="pw">CHANGE PASSWORD</button>
        <button class="btn wide ghost" data-a="reset">RESET MY OWN PLAYS (TESTING)</button>
        <button class="btn wide ghost" data-a="discard">DISCARD EDITS · RELOAD FROM FILE</button>
        <button class="btn wide ghost" data-a="logout">LOG OUT</button>
        <button class="btn wide" data-a="close">CLOSE</button>
      </div>
    </div></div>`);
    document.body.append(box);
    const close = () => box.remove();
    box.addEventListener('click', e => { if (e.target === box) close(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    box.querySelector('[data-a="close"]').focus();
    const file = box.querySelector('input[type=file]');
    file.parentElement.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const json = JSON.parse(await f.text());
        const days = json.days || {};
        const n = Object.keys(days).filter(E.isDate).length;
        if (!confirm(`Import ${n} day(s)? Days in the file replace the same days here.`)) return;
        for (const [d, v] of Object.entries(days)) if (E.isDate(d)) book.days[d] = E.cleanPrompts(Array.isArray(v) ? v : v.prompts);
        book.dirty = true; book.savedAt = Date.now(); storeBook();
        close(); toast(`Imported ${n} day(s)`); renderTop(); selectDay(selected, true);
      } catch (e) { toast('That file isn’t a Nichion backup.', 'error'); }
    });
    box.querySelector('[data-a="export"]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), days: book.days }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nichion-prompts-${today()}.json`;
      document.body.append(a); a.click(); a.remove(); close();
    });
    box.querySelector('[data-a="pw"]').addEventListener('click', () => {
      const pw = prompt('New admin password (at least 4 characters):');
      if (pw == null) return;
      if (pw.length < 4) return toast('Too short — use at least 4 characters.', 'error');
      if (prompt('Type it again:') !== pw) return toast('Passwords didn’t match.', 'error');
      const salt = randomId();
      book.admin = { salt, hash: E.sha256(salt + '|' + pw) };
      book.dirty = true; storeBook();
      try { sessionStorage.setItem(SESSION_KEY, book.admin.hash); } catch {}
      close(); renderTop(); toast('Password changed — download the game file to keep it');
    });
    box.querySelector('[data-a="reset"]').addEventListener('click', () => {
      if (!confirm('Erase YOUR plays and streak in this browser? (Players are not affected.)')) return;
      try { localStorage.removeItem('nichion_save_v1'); } catch {}
      close(); toast('Your plays were reset — go back to the game to play again');
    });
    box.querySelector('[data-a="discard"]').addEventListener('click', () => {
      if (!confirm('Throw away every edit not yet downloaded, and reload prompts from this file?')) return;
      book = bookFromFile(); storeBook(); draft = null;
      close(); renderTop(); selectDay(selected, true);
    });
    box.querySelector('[data-a="logout"]').addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      close(); draft = null; renderLogin('Logged out.');
    });
  }

  // --------------------------------------------------------------- calendar
  function renderCalendar() {
    const cal = root.querySelector('.cal');
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const start = E.addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
    const t = today();
    cal.innerHTML = '';
    const head = h(`<div class="cal-head">
      <button class="icon-btn" aria-label="Previous month" data-prev>◂</button>
      <b>${esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase())}</b>
      <button class="icon-btn" aria-label="Next month" data-next>▸</button>
    </div>`);
    head.querySelector('[data-prev]').addEventListener('click', () => shiftMonth(-1));
    head.querySelector('[data-next]').addEventListener('click', () => shiftMonth(1));
    const grid = h('<div class="cal-grid"></div>');
    for (const d of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) grid.append(h(`<div class="cal-dow">${d}</div>`));
    for (let i = 0; i < 42; i++) {
      const d = E.addDays(start, i);
      const n = count(d);
      const cls = ['cal-day'];
      if (d.slice(0, 7) !== month) cls.push('out');
      if (d < t) cls.push('past');
      if (d === t) cls.push('today');
      if (d === selected) cls.push('sel');
      if (n >= MAXP) cls.push('full');
      const dots = Array.from({ length: MAXP }, (_, k) => `<i class="${k < n ? '' : 'off'}"></i>`).join('');
      const b = h(`<button class="${cls.join(' ')}" aria-label="${esc(fmt(d))}: ${n} prompt${n === 1 ? '' : 's'}${d === t ? ' (today)' : ''}"><span>${+d.slice(8)}</span><span class="dots">${dots}</span></button>`);
      b.addEventListener('click', () => selectDay(d));
      grid.append(b);
    }
    cal.append(head, grid);
    const missing = [];
    for (let i = 0; i < 7; i++) { const d = E.addDays(t, i); if (!count(d)) missing.push(d); }
    cal.append(h(`<div class="cal-legend">
      <span><i style="background:var(--t-nichion)"></i>Full day (${MAXP} prompts)</span>
      <span><i style="background:var(--t-plankton)"></i>Some prompts set</span>
      <span><i style="box-shadow:inset 0 0 0 3px var(--accent)"></i>Today · days start at each player’s local midnight</span>
    </div>`));
    cal.append(h(`<div class="cal-upcoming"><h4>NEXT 7 DAYS</h4><p>${missing.length
      ? `<b>${missing.length}</b> day${missing.length === 1 ? '' : 's'} with no prompts: ${missing.map(d => esc(fmt(d, { month: 'short', day: 'numeric' }))).join(', ')}`
      : '<b class="ok">All set.</b> Every day this week has prompts.'}</p></div>`));
  }

  function shiftMonth(n) {
    const [y, m] = month.split('-').map(Number);
    month = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    renderCalendar();
  }

  function selectDay(d, force = false) {
    if (!force && d !== selected && dirty() && !confirm('You have unsaved changes on this day. Discard them?')) return;
    selected = d;
    month = d.slice(0, 7);
    renderCalendar();
    draft = (book.days[d] || []).map(p => ({
      text: p.text,
      answers: Object.fromEntries(tiers.map(t => [t.key, (p.answers[t.key] || []).join('\n')])),
    }));
    saved = JSON.stringify(draft);
    renderEditor();
  }

  // ----------------------------------------------------------------- editor
  const blankPrompt = () => ({ text: '', answers: Object.fromEntries(tiers.map(t => [t.key, ''])) });

  function renderEditor() {
    const ed = root.querySelector('#editor');
    ed.innerHTML = '';
    const t = today();
    const isToday = selected === t, isPast = selected < t;
    const head = h(`<div class="ed-head px-box">
      <div>
        <h2>${esc(fmt(selected).toUpperCase())}</h2>
        <div class="ed-meta">
          <span class="tag ${isToday ? 'live' : isPast ? 'past' : 'future'}">${isToday ? 'TODAY' : isPast ? 'PAST' : 'UPCOMING'}</span>
          <span>${draft.length}/${MAXP} prompts</span>
          <span class="tag dirty" data-dirty hidden>UNSAVED</span>
        </div>
      </div>
      <div class="ed-save">
        <button class="btn small ghost" data-revert>REVERT</button>
        <button class="btn small" data-save>SAVE DAY</button>
      </div>
    </div>`);
    head.querySelector('[data-save]').addEventListener('click', save);
    head.querySelector('[data-revert]').addEventListener('click', () => { draft = JSON.parse(saved); renderEditor(); });
    ed.append(head);

    if (isToday || isPast) {
      ed.append(h(`<div class="help px-box dim">${isToday
        ? '<b>This is today.</b> Players who already played keep their scores; changes only reach players once they open the new game file.'
        : 'This day is in the past. Players see it under “Yesterday’s depths” the day after it runs.'}</div>`));
    }
    if (!draft.length) {
      const e = h(`<div class="empty-day px-box"><div class="art"></div><p>No prompts for this day yet — players will see “the ocean is calm”.</p></div>`);
      e.querySelector('.art').append(Sprites.img('jelly', 5));
      ed.append(e);
    }
    draft.forEach((p, i) => ed.append(promptCard(p, i)));
    if (draft.length < MAXP) {
      const add = h(`<div class="add-row"><button class="btn blue">+ ADD PROMPT ${draft.length + 1}</button></div>`);
      add.querySelector('button').addEventListener('click', () => {
        draft.push(blankPrompt());
        renderEditor();
        const cards = ed.querySelectorAll('.ptext');
        cards[cards.length - 1]?.focus();
      });
      ed.append(add);
    }
    ed.append(h(`<div class="help px-box dim">
      <b>How it works</b>
      <ul>
        <li>One answer per line. Extra accepted spellings go after a bar: <code>New York City | NYC | Big Apple</code>. Players see the first one.</li>
        <li>Capitals, punctuation, accents, “the/a/an” and simple plurals are ignored. Small typos are auto-corrected (none for 1–3 letters, 1 for 4–5, 2 for 6–9, 3 for 10+).</li>
        <li>Anything not listed scores 0. A day with fewer than ${MAXP} prompts still works; the score page notes “(out of N questions today)”.</li>
        <li><b>Save Day</b> keeps your edits in this browser. <b>Download game file</b> makes a new <code>nichion.html</code> with everything inside it; share that file.</li>
      </ul>
    </div>`));
    markDirty();
  }

  function promptCard(p, i) {
    const card = h(`<article class="pcard px-box">
      <div class="pcard-head">
        <span class="num">PROMPT ${i + 1}</span>
        <div class="tools">
          <button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn" data-down aria-label="Move down" ${i === draft.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="icon-btn del" data-del aria-label="Delete prompt">✕ DELETE</button>
        </div>
      </div>
      <label class="sr-only" for="pt${i}">Prompt ${i + 1} text</label>
      <input class="field ptext" id="pt${i}" maxlength="200" placeholder="e.g. Name a fruit">
      <div class="tiers"></div>
      <div class="tester">
        <div class="kicker">TEST A GUESS</div>
        <input class="field" placeholder="Type a guess to see where it lands…" aria-label="Test a guess for prompt ${i + 1}">
        <div class="out" aria-live="polite"></div>
      </div>
    </article>`);
    const ptext = card.querySelector('.ptext');
    ptext.value = p.text;
    ptext.addEventListener('input', () => { p.text = ptext.value; markDirty(); });
    card.querySelector('[data-up]').addEventListener('click', () => { [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; renderEditor(); });
    card.querySelector('[data-down]').addEventListener('click', () => { [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; renderEditor(); });
    card.querySelector('[data-del]').addEventListener('click', () => {
      const has = p.text || Object.values(p.answers).some(Boolean);
      if (has && !confirm(`Delete prompt ${i + 1}${p.text ? ` (“${p.text}”)` : ''}?`)) return;
      draft.splice(i, 1); renderEditor();
    });

    const tin = card.querySelector('.tester input'), out = card.querySelector('.tester .out');
    const runTest = () => {
      if (!tin.value.trim()) { out.textContent = ''; return; }
      const answers = Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')]));
      const m = E.matchGuess(tin.value, answers);
      if (!m) { out.style.removeProperty('--tc'); out.innerHTML = '🫧 <b>No catch</b> — 0 pts'; return; }
      const t = E.TIER_BY_KEY[m.tier];
      out.style.setProperty('--tc', `var(--t-${m.tier})`);
      out.innerHTML = `<b>${esc(t.name)}</b> · +${t.points} — matches “${esc(m.display)}”${m.corrected ? ` <i>(auto-corrected, ${m.distance} typo${m.distance === 1 ? '' : 's'})</i>` : ''}`;
    };
    tin.addEventListener('input', runTest);

    const tiersEl = card.querySelector('.tiers');
    for (const t of tiers) {
      const id = `ta${i}-${t.key}`;
      const box = h(`<div class="tbox" style="--tc:var(--t-${t.key})">
        <label for="${id}"><b>${esc(t.name.toUpperCase())}<br>${t.depth}M · ${t.points}PTS</b><small data-count></small></label>
        <textarea id="${id}" spellcheck="false" placeholder="One answer per line"></textarea>
        <div class="warn" data-warn></div>
      </div>`);
      box.querySelector('label').prepend(Sprites.img(t.key, 2));
      const ta = box.querySelector('textarea');
      ta.value = p.answers[t.key] || '';
      const cnt = () => { const n = lines(ta.value).length; box.querySelector('[data-count]').textContent = n ? `${n} answer${n === 1 ? '' : 's'}` : 'empty'; };
      cnt();
      ta.addEventListener('input', () => { p.answers[t.key] = ta.value; cnt(); markDirty(); checkDupes(card, p, i); runTest(); });
      tiersEl.append(box);
    }
    checkDupes(card, p, i);
    return card;
  }

  function checkDupes(card, p, i) {
    const answers = Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')]));
    const warn = {};
    for (const d of E.findDuplicates(answers)) (warn[d.tiers[1]] ||= []).push(`“${d.spelling}” is also in ${E.TIER_BY_KEY[d.tiers[0]].name}`);
    for (const t of tiers) {
      const el = card.querySelector(`#ta${i}-${t.key}`)?.parentElement.querySelector('[data-warn]');
      if (el) el.textContent = (warn[t.key] || []).join('; ');
    }
  }

  function markDirty() {
    const tag = root.querySelector('[data-dirty]');
    if (tag) tag.hidden = !dirty();
  }

  function save() {
    const prompts = draft.map(p => ({
      text: p.text.trim(),
      answers: Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')])),
    }));
    const missingText = prompts.findIndex(p => !p.text && tiers.some(t => p.answers[t.key].length));
    if (missingText >= 0) { toast(`Prompt ${missingText + 1} needs text`, 'error'); root.querySelector('#pt' + missingText)?.focus(); return; }
    const noAnswers = prompts.findIndex(p => p.text && !tiers.some(t => p.answers[t.key].length));
    if (noAnswers >= 0 && !confirm(`Prompt ${noAnswers + 1} has no answers — every guess would score 0. Save anyway?`)) return;
    const clean = E.cleanPrompts(prompts);
    if (clean.length) book.days[selected] = clean; else delete book.days[selected];
    book.dirty = true; book.savedAt = Date.now();
    storeBook();
    const dups = clean.reduce((n, pr) => n + E.findDuplicates(pr.answers).length, 0);
    toast(dups ? `Saved — ${dups} answer(s) listed in two tiers` : 'Saved ✓ — download the game file when you’re done', dups ? 'error' : '');
    selectDay(selected, true);
    renderTop();
  }

  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && draft && root.isConnected) { e.preventDefault(); save(); }
  }
  function onUnload(e) { if (dirty() || book?.dirty) { e.preventDefault(); e.returnValue = ''; } }

  function exit() {
    if (dirty() && !confirm('Leave without saving this day?')) return;
    document.removeEventListener('keydown', onKey);
    removeEventListener('beforeunload', onUnload);
    root.remove();
    document.body.classList.remove('admin-open');
    if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
    onExit && onExit();
  }

  /** Open the admin panel over the game. */
  async function open(opts) {
    DATA = opts.data; PRISTINE = opts.pristine; onExit = opts.onExit;
    root = document.createElement('div');
    root.id = 'admin-root';
    document.body.append(root);
    document.body.classList.add('admin-open');
    document.addEventListener('keydown', onKey);
    addEventListener('beforeunload', onUnload);
    await chooseBook();
    if (loggedIn()) renderShell(); else renderLogin();
  }

  window.NichionAdmin = { open };
})();

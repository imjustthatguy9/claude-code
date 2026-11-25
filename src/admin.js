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

  let root, DATA, PRISTINE, onExit;
  let book = null;          // { salt, admin:{salt,hash}|null, days:{date: prompts}, fileStamp, dirty, savedAt }
  let month = null, selected = null;
  let libFilter = 'past', libQuery = '';
  let draft = null, saved = '';
  const today = () => E.localDate();
  const perDay = () => E.perDayOf(book);

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
    return { salt: DATA.salt, admin: DATA.admin || null, perDay: E.perDayOf(DATA), days, fileStamp: DATA.stamp, dirty: false };
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
    const data = { v: 1, stamp, salt: book.salt, admin: book.admin, perDay: perDay(), days };
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
    const grid = h(`<div class="a-grid"><div class="a-side"><aside class="cal px-box"></aside><aside class="lib px-box" aria-label="Past prompts"></aside></div><section id="editor"></section></div>`);
    root.append(top, grid);
    renderTop();
    month = today().slice(0, 7);
    let d = E.addDays(today(), 1);
    for (let i = 0; i < 60 && count(d) >= perDay(); i++) d = E.addDays(d, 1);
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
        <label class="perday-row">PROMPTS PER DAY
          <select data-perday>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === perDay() ? 'selected' : ''}>${n}${n === E.DEFAULT_PER_DAY ? ' (default)' : ''}</option>`).join('')}</select>
        </label>
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
    box.querySelector('[data-perday]').addEventListener('change', e => {
      book.perDay = Number(e.target.value);
      book.dirty = true; storeBook();
      renderTop(); renderCalendar(); renderEditor();
      toast(`A full day is now ${book.perDay} prompt${book.perDay === 1 ? '' : 's'} — download the game file to apply it`);
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
      if (n >= perDay()) cls.push('full');
      const dots = Array.from({ length: perDay() }, (_, k) => `<i class="${k < n ? '' : 'off'}"></i>`).join('');
      const b = h(`<button class="${cls.join(' ')}" aria-label="${esc(fmt(d))}: ${n} prompt${n === 1 ? '' : 's'}${d === t ? ' (today)' : ''}"><span>${+d.slice(8)}</span><span class="dots">${dots}</span></button>`);
      b.addEventListener('click', () => selectDay(d));
      grid.append(b);
    }
    cal.append(head, grid);
    const missing = [];
    for (let i = 0; i < 7; i++) { const d = E.addDays(t, i); if (!count(d)) missing.push(d); }
    cal.append(h(`<div class="cal-legend">
      <span><i style="background:var(--t-nichion)"></i>Full day (${perDay()} prompts)</span>
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
          <span>${draft.length}/${perDay()} prompts</span>
          <span class="tag dirty" data-dirty hidden>UNSAVED</span>
        </div>
      </div>
      <div class="ed-save">
        <button class="btn small ghost" data-revert>REVERT</button>
        <button class="btn small" data-save>SAVE DAY</button>
      </div>
    </div>`);
    head.querySelector('[data-save]').addEventListener('click', save);
    if (lastCleanup && lastCleanup.date !== selected) lastCleanup = null;
    head.querySelector('[data-revert]').addEventListener('click', () => { draft = JSON.parse(saved); renderEditor(); });
    ed.append(head);

    if (draft.length > perDay()) {
      ed.append(h(`<div class="help px-box dim">This day has <b>${draft.length}</b> prompts — more than the ${perDay()}-per-day setting. Players will still get all ${draft.length}; delete some to match the others.</div>`));
    }
    if (lastCleanup) {
      const note = h(`<div class="cleanup-note px-box dim" role="status">
        <div class="cleanup-head"><b>✂ CLEANED UP ${lastCleanup.items.length} DUPLICATE${lastCleanup.items.length === 1 ? '' : 'S'}</b><button class="icon-btn" aria-label="Dismiss">✕</button></div>
        <ul>${collapse(lastCleanup.items.map(it => `P${it.prompt + 1}\u0000${it.text}`)).map(x => { const [pp, rest] = x.split('\u0000'); return `<li><span>${pp}</span>${esc(rest)}</li>`; }).join('')}</ul>
      </div>`);
      note.querySelector('button').addEventListener('click', () => { lastCleanup = null; note.remove(); });
      ed.append(note);
    }
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
    if (draft.length < perDay()) {
      const add = h(`<div class="add-row"><button class="btn blue" data-add>+ ADD PROMPT ${draft.length + 1}</button><button class="btn ghost" data-addtext>📝 PASTE AS TEXT</button></div>`);
      add.querySelector('[data-add]').addEventListener('click', () => {
        draft.push(blankPrompt());
        renderEditor();
        const cards = ed.querySelectorAll('.ptext');
        cards[cards.length - 1]?.focus();
      });
      add.querySelector('[data-addtext]').addEventListener('click', () => pasteTextModal(draft.length));
      ed.append(add);
    }
    ed.append(h(`<div class="help px-box dim">
      <b>How it works</b>
      <ul>
        <li>One answer per line. Extra accepted spellings go after a bar: <code>New York City | NYC | Big Apple</code>. Players see the first one.</li>
        <li>Capitals, punctuation, accents, “the/a/an” and simple plurals are ignored. Small typos are auto-corrected (none for 1–3 letters, 1 for 4–5, 2 for 6–9, 3 for 10+). A guess that <b>contains</b> one answer with only a little extra (“red fox”, “the planet mars”) also counts. Auto-correct only happens when the guess is close to <b>exactly one</b> answer; if it’s close to two (“Irak” → Iraq or Iran?), the player is asked to be more specific.</li>
        <li><b>📝 Paste as text:</b> question on the first line, a blank line, then answer groups deepest first (Nichion, Deep Cut, Rare, Schooler, Too Clever, Plankton), with a blank line between groups. Pasting that straight into a question box works too.</li>
        <li><b>Duplicates are cleaned up for you.</b> If the same answer (or a near-identical spelling, plural or typo) is in more than one tier, the deepest tier keeps it and the others are removed when you save.</li>
        <li><b>Descriptions:</b> add <code>*(…)</code> after a Nichion or Too Clever answer, like <code>cat *(feline friend)</code>. Players see it when they land that answer and on the next day’s answer sheet.</li>
        <li>Anything not listed scores 0. A day with fewer than ${perDay()} prompts still works; the score page notes “(out of N questions today)”.</li>
        <li><b>Save Day</b> keeps your edits in this browser. <b>Download game file</b> makes a new <code>nichion.html</code> with everything inside it; share that file.</li>
      </ul>
    </div>`));
    markDirty();
    renderSideLibrary();
  }

  function promptCard(p, i) {
    const card = h(`<article class="pcard px-box">
      <div class="pcard-head">
        <span class="num">PROMPT ${i + 1}</span>
        <div class="tools">
          <button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn" data-down aria-label="Move down" ${i === draft.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="icon-btn" data-text aria-label="Paste prompt ${i + 1} as text">📝 TEXT</button>
          <button class="icon-btn" data-past aria-label="Paste a past prompt into prompt ${i + 1}">📋 PAST</button>
          <button class="icon-btn del" data-del aria-label="Delete prompt">✕ DELETE</button>
        </div>
      </div>
      <label class="sr-only" for="pt${i}">Prompt ${i + 1} text</label>
      <input class="field ptext" id="pt${i}" maxlength="200" placeholder="e.g. Name a fruit">
      <div class="dup-bar" data-dupbar hidden>
        <span>✂ <b data-dupcount></b> across the tiers — the copy in the deepest tier is kept, the rest are removed when you save.</span>
        <button class="btn small ghost" data-dupfix>REMOVE NOW</button>
      </div>
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
    // Pasting a whole question block (question, blank line, answers…) fills the card.
    ptext.addEventListener('paste', e => {
      const raw = e.clipboardData && e.clipboardData.getData('text');
      if (!raw || !/\n\s*\n/.test(raw.trim())) return;
      e.preventDefault();
      const qs = E.parseQuestionText(raw);
      if (qs.length === 1 && !qs[0].warnings.length) applyParsed(qs, i);
      else pasteTextModal(i, raw);
    });
    card.querySelector('[data-past]').addEventListener('click', () => libraryModal(i));
    card.querySelector('[data-text]').addEventListener('click', () => pasteTextModal(i));
    card.querySelector('[data-dupfix]').addEventListener('click', () => removeDupesNow(i));
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
      const { match: m, ambiguous } = E.matchDetailed(tin.value, answers);
      if (!m && ambiguous) { out.style.removeProperty('--tc'); out.innerHTML = `🤔 <b>Too close to call</b> — near ${ambiguous.map(a => `“${esc(a)}”`).join(' and ')}, so it isn’t auto-corrected. Players are told to be more specific.`; return; }
      if (!m) { out.style.removeProperty('--tc'); out.innerHTML = '🫧 <b>No catch</b> — 0 pts'; return; }
      const t = E.TIER_BY_KEY[m.tier];
      out.style.setProperty('--tc', `var(--t-${m.tier})`);
      out.innerHTML = `<b>${esc(t.name)}</b> · +${t.points} — matches “${esc(m.display)}”${m.contained ? ' <i>(auto-corrected — the guess contains the answer)</i>' : m.corrected ? ` <i>(auto-corrected, ${m.distance} typo${m.distance === 1 ? '' : 's'})</i>` : ''}${m.desc ? `<br><span class="tester-desc">💬 ${esc(m.desc)}</span>` : ''}`;
    };
    tin.addEventListener('input', runTest);

    const tiersEl = card.querySelector('.tiers');
    for (const t of tiers) {
      const id = `ta${i}-${t.key}`;
      const box = h(`<div class="tbox" style="--tc:var(--t-${t.key})">
        <label for="${id}"><b>${esc(t.name.toUpperCase())}<br>${t.depth}M · ${t.points}PTS</b><small data-count></small></label>
        <textarea id="${id}" spellcheck="false" placeholder="${E.DESC_TIERS.includes(t.key) ? 'One answer per line&#10;cat *(feline friend) adds a description' : 'One answer per line'}"></textarea>
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

  // Live duplicate check for one prompt card: per-tier notes plus a bar with
  // a "remove now" button. Saving does the same cleanup automatically.
  function checkDupes(card, p, i) {
    const answers = Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')]));
    const { removed } = E.dedupeAnswers(answers);
    const warn = {};
    for (const r of removed) {
      (warn[r.tier] ||= []).push(r.tier === r.keptTier
        ? `“${r.spelling}” is listed twice`
        : `“${r.spelling}” ≈ “${r.keptAs}” in ${E.TIER_BY_KEY[r.keptTier].name}`);
    }
    for (const t of tiers) {
      const el = card.querySelector(`#ta${i}-${t.key}`)?.parentElement.querySelector('[data-warn]');
      let msg = warn[t.key] ? '✂ ' + collapse(warn[t.key]).join('; ') + ' — will be removed' : '';
      if (!E.DESC_TIERS.includes(t.key)) {
        const n = answers[t.key].filter(a => E.DESC_RE.test(a)).length;
        if (n) msg += (msg ? ' · ' : '') + `💬 ${n} description${n === 1 ? '' : 's'} here won’t be shown (only Nichion and Too Clever show them)`;
      }
      if (el) el.textContent = msg;
    }
    const bar = card.querySelector('[data-dupbar]');
    if (bar) {
      bar.hidden = !removed.length;
      bar.querySelector('[data-dupcount]').textContent = `${removed.length} duplicate${removed.length === 1 ? '' : 's'}`;
    }
  }

  /** ["a","a","b"] → ["a ×2","b"] */
  function collapse(list) {
    const counts = new Map();
    for (const x of list) counts.set(x, (counts.get(x) || 0) + 1);
    return [...counts].map(([x, n]) => (n > 1 ? `${x} ×${n}` : x));
  }

  function removeDupesNow(i) {
    const p = draft[i];
    const answers = Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')]));
    const { answers: clean, removed } = E.dedupeAnswers(answers);
    if (!removed.length) return;
    p.answers = Object.fromEntries(tiers.map(t => [t.key, clean[t.key].join('\n')]));
    renderEditor();
    const card = root.querySelectorAll('.pcard')[i];
    if (card) { card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1200); }
    toast(`Removed ${removed.length} duplicate${removed.length === 1 ? '' : 's'} — kept the deepest copy`);
  }


  // ---------------------------------------------------------- past prompts
  // Every saved prompt from other days, searchable, ready to paste into the
  // day being edited.
  function libraryItems() {
    const t = today();
    const q = E.normalize(libQuery);
    const out = [];
    for (const [date, prompts] of Object.entries(book.days)) {
      if (date === selected) continue;
      if (libFilter === 'past' && date >= t) continue;
      if (libFilter === 'upcoming' && date < t) continue;
      prompts.forEach((p, idx) => {
        if (q) {
          const hay = E.normalize([p.text, ...tiers.flatMap(x => p.answers[x.key] || [])].join(' '));
          if (!hay.includes(q)) return;
        }
        out.push({ date, idx, p });
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.idx - b.idx);
  }

  /** Builds the library UI. `target` = a prompt index to paste into, or null (sidebar). */
  function buildLibrary(target, onPasted) {
    const node = h(`<div class="lib-wrap">
      <div class="lib-head">
        <h3>PAST PROMPTS</h3>
        <span class="lib-count" data-count></span>
      </div>
      <input class="field lib-search" type="search" placeholder="Search prompts or answers…" aria-label="Search past prompts">
      <div class="lib-filters" role="radiogroup" aria-label="Which days">
        ${[['past', 'PAST'], ['upcoming', 'UPCOMING'], ['all', 'ALL']].map(([k, l]) => `<button class="lib-filter" role="radio" data-f="${k}">${l}</button>`).join('')}
      </div>
      <div class="lib-list" data-list></div>
    </div>`);
    const search = node.querySelector('.lib-search');
    search.value = libQuery;
    const list = node.querySelector('[data-list]');
    const paint = () => {
      node.querySelectorAll('.lib-filter').forEach(b => { const on = b.dataset.f === libFilter; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      const items = libraryItems();
      node.querySelector('[data-count]').textContent = `${items.length}`;
      list.innerHTML = '';
      if (!items.length) {
        list.append(h(`<p class="lib-empty">${libQuery ? 'Nothing matches that search.' : libFilter === 'past' ? 'No past prompts yet — earlier days you fill in will show up here.' : 'No prompts here yet.'}</p>`));
        return;
      }
      for (const it of items.slice(0, 200)) list.append(libraryItem(it, target, onPasted));
    };
    let timer;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { libQuery = search.value; paint(); }, 120); });
    node.querySelectorAll('.lib-filter').forEach(b => b.addEventListener('click', () => { libFilter = b.dataset.f; paint(); }));
    paint();
    return node;
  }

  function libraryItem({ date, idx, p }, target, onPasted) {
    const counts = tiers.map(t => (p.answers[t.key] || []).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const item = h(`<details class="lib-item">
      <summary>
        <span class="lib-date">${esc(fmt(date, { month: 'short', day: 'numeric', year: date.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }).toUpperCase())} · P${idx + 1}</span>
        <span class="lib-text">${esc(p.text)}</span>
        <span class="lib-dots" title="${total} answers">${tiers.map((t, k) => `<i style="--tc:var(--t-${t.key})" class="${counts[k] ? '' : 'off'}"></i>`).join('')}</span>
      </summary>
      <div class="lib-body">
        <div class="lib-tiers"></div>
        <div class="lib-actions"></div>
      </div>
    </details>`);
    const tl = item.querySelector('.lib-tiers');
    for (const t of [...tiers].reverse()) {
      const ans = (p.answers[t.key] || []).map(E.parseAnswer).filter(Boolean)
        .map(a => (a.desc && E.DESC_TIERS.includes(t.key) ? `${a.display} (${a.desc})` : a.display));
      tl.append(h(`<div class="lib-tier" style="--tc:var(--t-${t.key})"><b>${esc(t.name.toUpperCase())}</b><span>${ans.length ? esc(ans.join(', ')) : '—'}</span></div>`));
    }
    const acts = item.querySelector('.lib-actions');
    const btn = (label, cls, fn) => { const b = h(`<button class="btn small ${cls}">${label}</button>`); b.addEventListener('click', fn); acts.append(b); };
    if (target != null) {
      btn(`PASTE INTO PROMPT ${target + 1}`, '', () => paste(p, target, date, onPasted));
    } else {
      draft.forEach((_, k) => btn(`INTO P${k + 1}`, 'ghost', () => paste(p, k, date, onPasted)));
      if (draft.length < perDay()) btn('+ NEW PROMPT', '', () => paste(p, draft.length, date, onPasted));
    }
    return item;
  }

  function paste(p, target, fromDate, onPasted) {
    const existing = draft[target];
    const hasContent = existing && (existing.text.trim() || Object.values(existing.answers).some(v => v.trim()));
    if (hasContent && !confirm(`Replace prompt ${target + 1}${existing.text ? ` (“${existing.text}”)` : ''} with “${p.text}”?`)) return;
    draft[target] = {
      text: p.text,
      answers: Object.fromEntries(tiers.map(t => [t.key, (p.answers[t.key] || []).join('\n')])),
    };
    onPasted && onPasted();
    renderEditor();
    const card = root.querySelectorAll('.pcard')[target];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 1200);
    }
    toast(`Pasted from ${fmt(fromDate, { month: 'short', day: 'numeric' })} — press Save Day to keep it`);
  }

  function renderSideLibrary() {
    const side = root.querySelector('.lib');
    if (!side) return;
    const keepFocus = document.activeElement && side.contains(document.activeElement) && document.activeElement.matches('.lib-search');
    const pos = keepFocus ? document.activeElement.selectionStart : null;
    const openKeys = [...side.querySelectorAll('.lib-item[open] .lib-date')].map(e => e.textContent);
    side.innerHTML = '';
    side.append(buildLibrary(null));
    side.querySelectorAll('.lib-item').forEach(d => { if (openKeys.includes(d.querySelector('.lib-date').textContent)) d.open = true; });
    if (keepFocus) { const s = side.querySelector('.lib-search'); s.focus(); s.setSelectionRange(pos, pos); }
  }

  function libraryModal(target) {
    const back = h(`<div class="modal-backdrop"><div class="modal px-box lib-modal" role="dialog" aria-modal="true" aria-label="Paste a past prompt">
      <button class="icon-btn close" aria-label="Close">✕</button>
    </div></div>`);
    const box = back.firstElementChild;
    const close = () => { back.remove(); document.removeEventListener('keydown', onEsc, true); };
    const onEsc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    box.append(h(`<p class="lib-intro">Pick a past prompt to copy into <b>prompt ${target + 1}</b>. Its text and every answer get pasted; you can edit them after.</p>`));
    box.append(buildLibrary(target, close));
    box.querySelector('.close').addEventListener('click', close);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onEsc, true);
    document.body.append(back);
    box.querySelector('.lib-search').focus();
  }

  // ------------------------------------------------------------ text paste
  const EXAMPLE = 'Name an animal\n\nfox\n\ncat\nmouse\nsnail\n\ndog\ncricket\nant';

  /** Put parsed questions into the day, starting at slot `start`. Returns false if cancelled. */
  function applyParsed(qs, start) {
    const room = perDay() - start;
    const use = qs.slice(0, Math.max(0, room));
    if (!use.length) { toast(`This day already has ${perDay()} prompts`, 'error'); return false; }
    const overwrite = use.map((_, k) => start + k).filter(k => {
      const d = draft[k];
      return d && (d.text.trim() || Object.values(d.answers).some(v => v.trim()));
    });
    if (overwrite.length && !confirm(`Replace prompt${overwrite.length === 1 ? '' : 's'} ${overwrite.map(k => k + 1).join(', ')} with the pasted text?`)) return false;
    use.forEach((q, k) => {
      draft[start + k] = { text: q.text, answers: Object.fromEntries(tiers.map(t => [t.key, q.answers[t.key].join('\n')])) };
    });
    renderEditor();
    const cards = root.querySelectorAll('.pcard');
    cards[start]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    use.forEach((_, k) => { const c = cards[start + k]; if (c) { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200); } });
    toast(`Filled ${use.length} prompt${use.length === 1 ? '' : 's'} — press Save Day to keep ${use.length === 1 ? 'it' : 'them'}`);
    return true;
  }

  function pasteTextModal(start, initial = '') {
    const back = h(`<div class="modal-backdrop"><div class="modal px-box paste-modal" role="dialog" aria-modal="true" aria-labelledby="paste-h">
      <button class="icon-btn close" aria-label="Close">✕</button>
      <h2 id="paste-h">PASTE AS TEXT</h2>
      <div class="fmt">
        <pre class="fmt-example" aria-label="Example"></pre>
        <ul>
          <li><b>First line</b> is the question, then a <b>blank line</b>.</li>
          <li>Then answer groups, one answer per line, with a blank line between groups, <b>deepest first</b>:
            <span class="fmt-order">${E.TEXT_ORDER.map(k => `<i style="--tc:var(--t-${k})">${esc(E.TIER_BY_KEY[k].name)}</i>`).join('<span>→</span>')}</span></li>
          <li>Put <code>[]</code> on its own line for a tier with nothing in it. Stop early to leave the shallow tiers empty.</li>
          <li><code>cat *(feline friend)</code> adds a description, shown to players for <b>Nichion</b> and <b>Too Clever</b> answers.</li>
          <li><code>NYC | New York City</code> adds extra spellings. A <code>---</code> line starts another question.</li>
        </ul>
      </div>
      <label class="sr-only" for="paste-ta">Question text</label>
      <textarea id="paste-ta" class="paste-area" spellcheck="false" placeholder="Paste or type here…"></textarea>
      <div class="paste-preview" aria-live="polite"></div>
      <div class="paste-actions">
        <button class="btn ghost" data-example>USE EXAMPLE</button>
        <button class="btn" data-apply disabled>FILL</button>
      </div>
    </div></div>`);
    const box = back.firstElementChild;
    box.querySelector('.fmt-example').textContent = EXAMPLE;
    const ta = box.querySelector('textarea'), prev = box.querySelector('.paste-preview'), apply = box.querySelector('[data-apply]');
    let parsed = [];
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !apply.disabled) { e.preventDefault(); apply.click(); }
    };
    const paint = () => {
      parsed = E.parseQuestionText(ta.value).filter(q => q.text);
      prev.innerHTML = '';
      const room = perDay() - start;
      parsed.forEach((q, k) => {
        const slot = start + k;
        const fits = k < room;
        const card = h(`<div class="pv ${fits ? '' : 'off'}">
          <div class="pv-head"><span class="pv-slot">${fits ? (slot < draft.length ? `→ PROMPT ${slot + 1}` : `→ NEW PROMPT ${slot + 1}`) : 'WON’T FIT'}</span><b>${esc(q.text)}</b></div>
          <div class="pv-tiers"></div>
        </div>`);
        const tl = card.querySelector('.pv-tiers');
        for (const key of E.TEXT_ORDER) {
          const list = q.answers[key];
          const t = E.TIER_BY_KEY[key];
          const showDesc = E.DESC_TIERS.includes(key);
          tl.append(h(`<div class="pv-tier ${list.length ? '' : 'empty'}" style="--tc:var(--t-${key})"><b>${esc(t.name.toUpperCase())}</b><span>${list.length ? list.map(a => { const pa = E.parseAnswer(a); return `<em>${esc(pa?.display || a)}${pa?.desc && showDesc ? `<small>${esc(pa.desc)}</small>` : ''}</em>`; }).join('') : '—'}</span></div>`));
        }
        for (const w of q.warnings) card.append(h(`<p class="pv-warn">⚠ ${esc(w)}</p>`));
        for (const n of q.notes || []) card.append(h(`<p class="pv-note">✂ ${esc(n)}</p>`));
        prev.append(card);
      });
      if (parsed.length > room) prev.append(h(`<p class="pv-warn">⚠ A day holds ${perDay()} prompts — only the first ${Math.max(0, room)} will be used.</p>`));
      const n = Math.min(parsed.length, Math.max(0, room));
      apply.disabled = !n;
      apply.textContent = !n ? 'FILL' : n === 1 ? (start < draft.length ? `FILL PROMPT ${start + 1}` : 'ADD AS NEW PROMPT') : `FILL PROMPTS ${start + 1}–${start + n}`;
    };
    ta.addEventListener('input', paint);
    box.querySelector('[data-example]').addEventListener('click', () => { ta.value = EXAMPLE; paint(); ta.focus(); });
    apply.addEventListener('click', () => { if (applyParsed(parsed, start)) close(); });
    box.querySelector('.close').addEventListener('click', close);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(back);
    // Pre-fill with what's already in that slot, so it can be edited as text too.
    ta.value = initial || (draft[start] && draft[start].text ? E.promptToText({ text: draft[start].text, answers: Object.fromEntries(tiers.map(t => [t.key, lines(draft[start].answers[t.key] || '')])) }) : '');
    paint();
    ta.focus();
  }

  function markDirty() {
    const tag = root.querySelector('[data-dirty]');
    if (tag) tag.hidden = !dirty();
  }

  let lastCleanup = null;   // { date, items: [{ prompt, text }] } shown after a save

  function save() {
    const prompts = draft.map(p => ({
      text: p.text.trim(),
      answers: Object.fromEntries(tiers.map(t => [t.key, lines(p.answers[t.key] || '')])),
    }));
    const missingText = prompts.findIndex(p => !p.text && tiers.some(t => p.answers[t.key].length));
    if (missingText >= 0) { toast(`Prompt ${missingText + 1} needs text`, 'error'); root.querySelector('#pt' + missingText)?.focus(); return; }
    const noAnswers = prompts.findIndex(p => p.text && !tiers.some(t => p.answers[t.key].length));
    if (noAnswers >= 0 && !confirm(`Prompt ${noAnswers + 1} has no answers — every guess would score 0. Save anyway?`)) return;
    // Duplicates / near-duplicates: keep the deepest copy, drop the rest.
    const items = [];
    prompts.forEach((p, k) => {
      const { answers, removed } = E.dedupeAnswers(p.answers);
      p.answers = answers;
      for (const r of removed) items.push({ prompt: k, text: E.describeRemoval(r) });
    });
    const clean = E.cleanPrompts(prompts);
    if (clean.length) book.days[selected] = clean; else delete book.days[selected];
    book.dirty = true; book.savedAt = Date.now();
    storeBook();
    lastCleanup = items.length ? { date: selected, items } : null;
    toast(items.length
      ? `Saved — removed ${items.length} duplicate${items.length === 1 ? '' : 's'} (kept the deepest)`
      : 'Saved ✓ — download the game file when you’re done');
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

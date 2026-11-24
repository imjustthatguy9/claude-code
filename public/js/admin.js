(function () {
  'use strict';

  const root = document.getElementById('admin');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  let session = null;       // { today, tz, tiers, maxPrompts }
  let days = {};            // date -> { count, players }
  let month = null;         // 'YYYY-MM'
  let selected = null;      // 'YYYY-MM-DD'
  let draft = null;         // [{ text, answers: { tier: "multi\nline" } }]
  let saved = '';           // JSON of last saved draft
  let dayPlayers = 0;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      ...opts,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status, code: data.error });
    return data;
  }

  function toast(msg, kind = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = kind), 2600);
  }

  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const fmt = (d, o = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });
  const dirty = () => draft && JSON.stringify(draft) !== saved;

  // ------------------------------------------------------------------ login
  function renderLogin(msg = '') {
    root.innerHTML = '';
    const node = h(`<div class="login px-box">
      <div class="art"></div>
      <h1>ADMIN DOCK</h1>
      <p>Set tomorrow’s prompts and answers.</p>
      <form>
        <label class="sr-only" for="pw">Admin password</label>
        <input class="field" id="pw" type="password" autocomplete="current-password" placeholder="Password" required>
        <button class="btn wide" type="submit">LOG IN</button>
        <p class="err" role="alert">${esc(msg)}</p>
      </form>
    </div>`);
    node.querySelector('.art').append(Sprites.img('mansellion', 4));
    root.append(node);
    const input = node.querySelector('input');
    input.focus();
    node.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('/api/admin/login', { method: 'POST', body: { password: input.value } });
        boot();
      } catch (err) {
        node.querySelector('.err').textContent = err.message;
        input.select();
      }
    });
  }

  // ------------------------------------------------------------------- main
  async function boot() {
    try { session = await api('/api/admin/session'); }
    catch (e) { return renderLogin(e.status === 401 ? '' : e.message); }
    await refreshDays();
    month = session.today.slice(0, 7);
    // Default to the first upcoming day without a full set of prompts.
    let d = addDays(session.today, 1);
    for (let i = 0; i < 60 && (days[d]?.count || 0) >= session.maxPrompts; i++) d = addDays(d, 1);
    renderShell();
    await selectDay(d);
  }

  async function refreshDays() {
    const r = await api('/api/admin/days');
    days = Object.fromEntries(r.days.map(d => [d.date, d]));
    session.today = r.today;
  }

  function renderShell() {
    root.innerHTML = '';
    const top = h(`<header class="a-top">
      <div class="a-brand"><h1>MANSELLION</h1><span class="badge">ADMIN</span></div>
      <div class="a-actions">
        <a class="btn small ghost" href="/" target="_blank" rel="noopener">VIEW GAME</a>
        <button class="btn small ghost" data-export>EXPORT</button>
        <label class="btn small ghost" tabindex="0">IMPORT<input type="file" accept="application/json" hidden data-import></label>
        <button class="btn small ghost" data-logout>LOG OUT</button>
      </div>
    </header>`);
    top.querySelector('.a-brand').prepend(Sprites.img('mansellion', 2));
    top.querySelector('[data-logout]').addEventListener('click', async () => {
      if (dirty() && !confirm('Discard unsaved changes?')) return;
      await api('/api/admin/logout', { method: 'POST', body: {} });
      draft = null; renderLogin('Logged out.');
    });
    top.querySelector('[data-export]').addEventListener('click', () => { location.href = '/api/admin/export'; });
    const imp = top.querySelector('[data-import]');
    imp.parentElement.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imp.click(); } });
    imp.addEventListener('change', async () => {
      const f = imp.files[0]; imp.value = '';
      if (!f) return;
      try {
        const json = JSON.parse(await f.text());
        if (!confirm(`Import ${Object.keys(json.days || {}).length} day(s)? Days in the file replace the same days here.`)) return;
        const r = await api('/api/admin/import', { method: 'POST', body: json });
        toast(`Imported ${r.imported} day(s)`);
        await refreshDays(); renderCalendar(); await selectDay(selected, true);
      } catch (e) { toast(e.message || 'Import failed', 'error'); }
    });

    const grid = h(`<div class="a-grid"><aside class="cal px-box"></aside><section id="editor"></section></div>`);
    root.append(top, grid);
    renderCalendar();
  }

  function renderCalendar() {
    const cal = root.querySelector('.cal');
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const start = addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
    cal.innerHTML = '';
    const head = h(`<div class="cal-head">
      <button class="icon-btn" aria-label="Previous month" data-prev>◂</button>
      <b>${esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase())}</b>
      <button class="icon-btn" aria-label="Next month" data-next>▸</button>
    </div>`);
    head.querySelector('[data-prev]').addEventListener('click', () => { shiftMonth(-1); });
    head.querySelector('[data-next]').addEventListener('click', () => { shiftMonth(1); });
    const grid = h('<div class="cal-grid"></div>');
    for (const d of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) grid.append(h(`<div class="cal-dow">${d}</div>`));
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const info = days[d];
      const n = info?.count || 0;
      const cls = ['cal-day'];
      if (d.slice(0, 7) !== month) cls.push('out');
      if (d < session.today) cls.push('past');
      if (d === session.today) cls.push('today');
      if (d === selected) cls.push('sel');
      if (n >= session.maxPrompts) cls.push('full');
      const dots = Array.from({ length: session.maxPrompts }, (_, k) => `<i class="${k < n ? '' : 'off'}"></i>`).join('');
      const b = h(`<button class="${cls.join(' ')}" aria-label="${esc(fmt(d))}: ${n} prompt${n === 1 ? '' : 's'}${d === session.today ? ' (today)' : ''}"><span>${+d.slice(8)}</span><span class="dots">${dots}</span></button>`);
      b.addEventListener('click', () => selectDay(d));
      grid.append(b);
    }
    cal.append(head, grid);

    // Upcoming coverage: how many of the next 7 days are fully set.
    let missing = [];
    for (let i = 0; i < 7; i++) { const d = addDays(session.today, i); if ((days[d]?.count || 0) === 0) missing.push(d); }
    cal.append(h(`<div class="cal-legend">
      <span><i style="background:var(--t-mansellion)"></i>Full day (${session.maxPrompts} prompts)</span>
      <span><i style="background:var(--t-plankton)"></i>Some prompts set</span>
      <span><i style="box-shadow:inset 0 0 0 3px var(--accent)"></i>Today (live) · ${esc(session.tz)}</span>
    </div>`));
    cal.append(h(`<div class="cal-upcoming"><h4>NEXT 7 DAYS</h4><p>${missing.length
      ? `<b>${missing.length}</b> day${missing.length === 1 ? '' : 's'} with no prompts: ${missing.map(d => esc(fmt(d, { month: 'short', day: 'numeric' }))).join(', ')}`
      : '<b class="ok">All set.</b> Every day this week has prompts.'}</p></div>`));
  }

  function shiftMonth(n) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    month = d.toISOString().slice(0, 7);
    renderCalendar();
  }

  async function selectDay(d, force = false) {
    if (!force && d !== selected && dirty() && !confirm('You have unsaved changes. Discard them?')) return;
    selected = d;
    month = d.slice(0, 7);
    renderCalendar();
    const r = await api('/api/admin/day/' + d);
    dayPlayers = r.players;
    draft = r.prompts.map(p => ({
      text: p.text,
      answers: Object.fromEntries(session.tiers.map(t => [t.key, (p.answers[t.key] || []).join('\n')])),
    }));
    saved = JSON.stringify(draft);
    renderEditor();
  }

  // ----------------------------------------------------------------- editor
  const blankPrompt = () => ({ text: '', answers: Object.fromEntries(session.tiers.map(t => [t.key, ''])) });
  const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

  function renderEditor() {
    const ed = document.getElementById('editor');
    ed.innerHTML = '';
    const isToday = selected === session.today, isPast = selected < session.today;
    const head = h(`<div class="ed-head px-box">
      <div>
        <h2>${esc(fmt(selected).toUpperCase())}</h2>
        <div class="ed-meta">
          <span class="tag ${isToday ? 'live' : isPast ? 'past' : 'future'}">${isToday ? 'LIVE TODAY' : isPast ? 'PAST' : 'UPCOMING'}</span>
          <span>${draft.length}/${session.maxPrompts} prompts</span>
          ${dayPlayers ? `<span>· ${dayPlayers} player${dayPlayers === 1 ? '' : 's'} dove</span>` : ''}
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
        ? '<b>Today is live.</b> Players who already answered keep the score they got; edits only affect guesses from now on.'
        : 'This day is in the past. It shows up as “Yesterday’s depths” the day after it runs; edits change that answer sheet.'}</div>`));
    }

    if (!draft.length) {
      const e = h(`<div class="empty-day px-box"><div class="art"></div><p>No prompts for this day yet — players will see “the ocean is calm”.</p></div>`);
      e.querySelector('.art').append(Sprites.img('jelly', 5));
      ed.append(e);
    }

    draft.forEach((p, i) => ed.append(promptCard(p, i)));

    if (draft.length < session.maxPrompts) {
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
      <b>Answer format</b>
      <ul>
        <li>One answer per line. Add other accepted spellings after a bar: <code>New York City | NYC | Big Apple</code> — players see the first one.</li>
        <li>Capitals, punctuation, accents, “the/a/an” and simple plurals are ignored. Small typos are auto-corrected (none for 1–3 letters, 1 for 4–5, 2 for 6–9, 3 for 10+).</li>
        <li>Anything not listed in a tier scores 0 and the player stays put.</li>
        <li>Days with fewer than ${session.maxPrompts} prompts still work; the score page notes “(out of N questions today)”.</li>
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
      <input class="field ptext" id="pt${i}" maxlength="200" placeholder="e.g. Name a fruit" value="${esc(p.text)}">
      <div class="tiers"></div>
      <div class="tester">
        <div class="kicker">TEST A GUESS</div>
        <input class="field" placeholder="Type a guess to see where it lands…" aria-label="Test a guess for prompt ${i + 1}">
        <div class="out" aria-live="polite"></div>
      </div>
    </article>`);

    card.querySelector('.ptext').addEventListener('input', e => { p.text = e.target.value; markDirty(); });
    card.querySelector('[data-up]').addEventListener('click', () => { [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; renderEditor(); });
    card.querySelector('[data-down]').addEventListener('click', () => { [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; renderEditor(); });
    card.querySelector('[data-del]').addEventListener('click', () => {
      const has = p.text || Object.values(p.answers).some(Boolean);
      if (has && !confirm(`Delete prompt ${i + 1}${p.text ? ` (“${p.text}”)` : ''}?`)) return;
      draft.splice(i, 1); renderEditor();
    });

    const tiersEl = card.querySelector('.tiers');
    for (const t of session.tiers) {
      const id = `ta${i}-${t.key}`;
      const box = h(`<div class="tbox" style="--tc:var(--t-${t.key})">
        <label for="${id}"><b>${esc(t.name.toUpperCase())}<br>${t.depth}M · ${t.points}PTS</b><small data-count></small></label>
        <textarea id="${id}" spellcheck="false" placeholder="One answer per line"></textarea>
        <div class="warn" data-warn></div>
      </div>`);
      box.querySelector('label').prepend(Sprites.img(t.key, 2));
      const ta = box.querySelector('textarea');
      ta.value = p.answers[t.key] || '';
      const count = () => { const n = lines(ta.value).length; box.querySelector('[data-count]').textContent = n ? `${n} answer${n === 1 ? '' : 's'}` : 'empty'; };
      count();
      ta.addEventListener('input', () => { p.answers[t.key] = ta.value; count(); markDirty(); checkDupes(card, p); runTest(); });
      tiersEl.append(box);
    }
    checkDupes(card, p);

    const tin = card.querySelector('.tester input'), out = card.querySelector('.tester .out');
    let timer;
    const runTest = () => {
      clearTimeout(timer);
      if (!tin.value.trim()) { out.textContent = ''; return; }
      timer = setTimeout(async () => {
        try {
          const answers = Object.fromEntries(session.tiers.map(t => [t.key, lines(p.answers[t.key] || '')]));
          const r = await api('/api/admin/test', { method: 'POST', body: { guess: tin.value, answers } });
          const m = r.match;
          if (!m) { out.style.removeProperty('--tc'); out.innerHTML = '🫧 <b>No catch</b> — 0 pts'; return; }
          const t = session.tiers.find(x => x.key === m.tier);
          out.style.setProperty('--tc', `var(--t-${m.tier})`);
          out.innerHTML = `<b>${esc(t.name)}</b> · +${t.points} — matches “${esc(m.display)}”${m.corrected ? ` <i>(auto-corrected, ${m.distance} typo${m.distance === 1 ? '' : 's'})</i>` : ''}`;
        } catch (e) { out.textContent = e.message; }
      }, 180);
    };
    tin.addEventListener('input', runTest);
    return card;
  }

  // Client-side duplicate hint: the same spelling in two tiers is ambiguous.
  function norm(s) {
    return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an) /, '').replace(/ /g, '');
  }
  function checkDupes(card, p) {
    const seen = new Map();
    const warn = {};
    for (const t of session.tiers) {
      for (const line of lines(p.answers[t.key] || '')) {
        for (const sp of line.split('|').map(s => s.trim()).filter(Boolean)) {
          const k = norm(sp);
          if (!k) continue;
          if (seen.has(k) && seen.get(k) !== t.key) (warn[t.key] ||= []).push(`“${sp}” is also in ${session.tiers.find(x => x.key === seen.get(k)).name}`);
          else if (!seen.has(k)) seen.set(k, t.key);
        }
      }
    }
    for (const t of session.tiers) {
      const el = card.querySelector(`#ta${draft.indexOf(p)}-${t.key}`)?.parentElement.querySelector('[data-warn]');
      if (el) el.textContent = (warn[t.key] || []).join('; ');
    }
  }

  function markDirty() {
    const tag = document.querySelector('[data-dirty]');
    if (tag) tag.hidden = !dirty();
  }

  async function save() {
    const prompts = draft.map(p => ({
      text: p.text.trim(),
      answers: Object.fromEntries(session.tiers.map(t => [t.key, lines(p.answers[t.key] || '')])),
    }));
    const missingText = prompts.findIndex(p => !p.text && session.tiers.some(t => p.answers[t.key].length));
    if (missingText >= 0) { toast(`Prompt ${missingText + 1} needs text`, 'error'); document.getElementById('pt' + missingText)?.focus(); return; }
    const noAnswers = prompts.findIndex(p => p.text && !session.tiers.some(t => p.answers[t.key].length));
    if (noAnswers >= 0 && !confirm(`Prompt ${noAnswers + 1} has no answers — every guess would score 0. Save anyway?`)) return;
    if (selected === session.today && dayPlayers && !confirm(`${dayPlayers} player(s) already dove today. Save changes to the live day?`)) return;
    try {
      const r = await api('/api/admin/day/' + selected, { method: 'PUT', body: { prompts } });
      draft = r.prompts.map(p => ({ text: p.text, answers: Object.fromEntries(session.tiers.map(t => [t.key, (p.answers[t.key] || []).join('\n')])) }));
      saved = JSON.stringify(draft);
      toast(r.warnings.length ? `Saved — ${r.warnings.length} duplicate answer(s) across tiers` : 'Saved ✓', r.warnings.length ? 'error' : '');
      await refreshDays();
      renderCalendar();
      renderEditor();
    } catch (e) { toast(e.message, 'error'); }
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && draft) { e.preventDefault(); save(); }
  });
  addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  boot();
})();

// Nichion game engine: tiers, answer matching (auto-correct), day handling,
// the scrambled answer store, and the player's saved progress.
// Runs in the browser and in Node (for tests and the build script).
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ tiers
  const TIERS = [
    { key: 'plankton', name: 'Plankton',   depth: 10,  points: 10  },
    { key: 'clever',   name: 'Too Clever', depth: 15,  points: 15  },
    { key: 'schooler', name: 'Schooler',   depth: 30,  points: 30  },
    { key: 'rare',     name: 'Rare',       depth: 60,  points: 60  },
    { key: 'deepcut',  name: 'Deep Cut',   depth: 85,  points: 85  },
    { key: 'nichion',  name: 'Nichion',    depth: 100, points: 100 },
  ];
  const TIER_BY_KEY = Object.fromEntries(TIERS.map(t => [t.key, t]));
  const MAX_PROMPTS = 5;
  const MAX_GUESS_LEN = 60;
  const TIME_LIMIT_MS = 25000;   // per prompt
  const GRACE_MS = 750;          // a guess typed in the last instant still counts
  const MAX_MISSES = 60;

  // --------------------------------------------------------------- matching
  // Admin answer lines: "New York City | NYC | Big Apple" — first is shown.
  function parseAnswer(line) {
    const spellings = String(line).split('|').map(s => s.trim()).filter(Boolean);
    return spellings.length ? { display: spellings[0], spellings } : null;
  }

  function normalize(s) {
    return String(s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/^(the|a|an)\s+/, '')
      .replace(/\s+/g, ' ');
  }

  function singularize(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
    if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function keys(s) {
    const n = normalize(s);
    const out = new Set([n.replace(/ /g, ''), n.split(' ').map(singularize).join('')]);
    return [...out].filter(Boolean);
  }

  // Levenshtein + adjacent transpositions, with an early exit past `cap`.
  function editDistance(a, b, cap = Infinity) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > cap) return cap + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  // Typos forgiven by answer length: 1–3 exact, 4–5 one, 6–9 two, 10+ three.
  const allowedTypos = len => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3);

  /** Best match for a guess: exact beats fuzzy; on a tie the deeper tier wins. */
  function matchGuess(guess, answers) {
    const gKeys = keys(guess);
    if (!gKeys.length) return null;
    let best = null;
    for (let t = TIERS.length - 1; t >= 0; t--) {
      const tier = TIERS[t];
      for (const line of (answers && answers[tier.key]) || []) {
        const ans = parseAnswer(line);
        if (!ans) continue;
        for (const spelling of ans.spellings) {
          for (const ak of keys(spelling)) {
            const cap = allowedTypos(ak.length);
            for (const gk of gKeys) {
              const d = editDistance(gk, ak, cap);
              if (d <= cap && (!best || d < best.distance)) {
                best = { tier: tier.key, display: ans.display, corrected: d > 0, distance: d };
              }
            }
          }
        }
      }
      if (best && best.distance === 0) return best;
    }
    return best;
  }

  // ------------------------------------------------------------- dedupe
  // Two spellings are the "same answer" when they normalise to the same key
  // (case, punctuation, accents, the/a/an, plurals), or are a near-miss typo
  // of a longish word. Stricter than in-game auto-correct on purpose, so
  // different answers like "Iran"/"Iraq" are never merged.
  function nearDuplicate(aKeys, bKeys) {
    for (const a of aKeys) {
      for (const b of bKeys) {
        if (a === b) return true;
        const len = Math.min(a.length, b.length);
        if (len < 6) continue;
        const d = editDistance(a, b, 2);
        if (d <= 1 || (len >= 10 && d <= 2)) return true;
      }
    }
    return false;
  }

  /**
   * Remove duplicate / near-duplicate answers, keeping the one in the deepest
   * tier (and the first one within a tier). Works per spelling, so a matching
   * alias is dropped without losing the rest of its line.
   * @returns {{ answers: Record<string,string[]>, removed: {spelling, tier, keptTier, keptAs, exact}[] }}
   */
  function dedupeAnswers(answers) {
    const kept = [];          // { keys, tier, display }
    const removed = [];
    const out = Object.fromEntries(TIERS.map(t => [t.key, []]));
    for (let t = TIERS.length - 1; t >= 0; t--) {
      const tier = TIERS[t].key;
      for (const line of (answers && answers[tier]) || []) {
        const ans = parseAnswer(line);
        if (!ans) continue;
        const keepSpellings = [];
        const lineKept = [];
        for (const sp of ans.spellings) {
          const k = keys(sp);
          if (!k.length) continue;
          const hit = kept.find(e => nearDuplicate(e.keys, k)) || lineKept.find(e => nearDuplicate(e.keys, k) && e.self);
          if (hit && !hit.self) {
            removed.push({ spelling: sp, tier, keptTier: hit.tier, keptAs: hit.display, exact: hit.keys.some(x => k.includes(x)) });
            continue;
          }
          if (hit && hit.self) continue;             // same spelling twice on one line: drop silently
          keepSpellings.push(sp);
          lineKept.push({ keys: k, self: true });
        }
        if (!keepSpellings.length) continue;
        const display = keepSpellings[0];
        for (const e of lineKept) kept.push({ keys: e.keys, tier, display });
        out[tier].push(keepSpellings.join(' | '));
      }
    }
    return { answers: out, removed };
  }

  /** Back-compat: list of what dedupeAnswers would remove. */
  function findDuplicates(answers) {
    return dedupeAnswers(answers).removed.map(r => ({ spelling: r.spelling, tiers: [r.keptTier, r.tier], keptAs: r.keptAs }));
  }

  function describeRemoval(r) {
    const same = r.tier === r.keptTier;
    return same
      ? `“${r.spelling}” was listed twice in ${TIER_BY_KEY[r.tier].name}`
      : `“${r.spelling}” removed from ${TIER_BY_KEY[r.tier].name} — kept as “${r.keptAs}” in ${TIER_BY_KEY[r.keptTier].name}`;
  }

  // ------------------------------------------------------------------- days
  // A day is the player's own local calendar day.
  const pad = n => String(n).padStart(2, '0');
  const localDate = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  function addDays(date, n) {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function msUntilMidnight(now = new Date()) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.max(1000, next - now);
  }
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

  // ------------------------------------------------------------------ codec
  // Prompts and answers are stored scrambled (XOR with a per-day keystream,
  // then base64) so they can't be read by viewing the page source.
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h || 1;
  }
  function keystream(seed, n) {
    let x = seed >>> 0;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = x & 255; }
    return out;
  }
  function toB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(b64) { const s = atob(b64); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }

  function encodeDay(salt, date, prompts) {
    const bytes = new TextEncoder().encode(JSON.stringify(prompts));
    const ks = keystream(fnv1a(salt + '|' + date), bytes.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
    return { n: prompts.length, d: toB64(bytes) };
  }
  function decodeDay(salt, date, entry) {
    if (!entry || !entry.d) return [];
    const bytes = fromB64(entry.d);
    const ks = keystream(fnv1a(salt + '|' + date), bytes.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return []; }
  }

  /** Clean admin input into the stored prompt shape. */
  function cleanPrompts(input) {
    const out = [];
    for (const p of (input || []).slice(0, MAX_PROMPTS)) {
      const text = String((p && p.text) || '').trim().slice(0, 200);
      const answers = {};
      let count = 0;
      for (const t of TIERS) {
        const raw = p && p.answers && p.answers[t.key];
        const list = Array.isArray(raw) ? raw : String(raw || '').split('\n');
        answers[t.key] = list.map(s => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 300);
        count += answers[t.key].length;
      }
      if (text || count) out.push({ text, answers: dedupeAnswers(answers).answers });
    }
    return out;
  }

  // ------------------------------------------------------------ text import
  // Quick paste format for admins:
  //
  //   Name an animal          ← first line: the question
  //                           ← blank line
  //   fox                     ← Nichion answers
  //                           ← blank line
  //   cat                     ← Deep Cut answers
  //   mouse
  //                           ← …then Rare, Schooler, Too Clever, Plankton
  //
  // A group that is just "[]" (or "-" / "none") leaves that tier empty. A line of
  // three or more dashes ("---") starts another question.
  const TEXT_ORDER = TIERS.map(t => t.key).reverse();   // nichion → plankton
  const EMPTY_GROUP = /^(\[\s*\]|-|—|–|none|\(none\)|n\/a|empty)$/i;
  const EMPTY_MARK = /^\[\s*\]$/;

  function cleanLine(line) {
    return line.replace(/^\s*(?:[-*•·]\s+|\d+[.)]\s+)/, '').trim();
  }

  function parseQuestionText(raw) {
    const chunks = String(raw || '').replace(/\r\n?/g, '\n').split(/^\s*-{3,}\s*$/m);
    const out = [];
    for (const chunk of chunks) {
      const lines = chunk.split('\n').map(l => l.replace(/\s+$/, ''));
      while (lines.length && !lines[0].trim()) lines.shift();
      if (!lines.length) continue;
      const text = cleanLine(lines.shift()).replace(/^(q|question)\s*[:.]\s*/i, '');
      // Group the rest by blank lines.
      const groups = [];
      let cur = null;
      for (const l of lines) {
        if (!l.trim()) { cur = null; continue; }
        if (!cur) groups.push(cur = []);
        cur.push(cleanLine(l));
      }
      const answers = Object.fromEntries(TIERS.map(t => [t.key, []]));
      const warnings = [];
      groups.forEach((g, i) => {
        if (i >= TEXT_ORDER.length) return;
        if (g.length === 1 && EMPTY_GROUP.test(g[0])) return;
        answers[TEXT_ORDER[i]] = g.filter(a => a && !EMPTY_MARK.test(a));   // a stray [] is never an answer
      });
      if (groups.length > TEXT_ORDER.length) {
        warnings.push(`${groups.length - TEXT_ORDER.length} extra group${groups.length - TEXT_ORDER.length === 1 ? '' : 's'} after Plankton ignored`);
      }
      if (!groups.length) warnings.push('No answers found — put a blank line after the question, then the answers');
      const dd = dedupeAnswers(answers);
      const notes = dd.removed.map(describeRemoval);
      out.push({ text, answers: dd.answers, warnings, notes });
    }
    return out;
  }

  /** Turn a prompt back into the paste format (used for "copy as text"). */
  function promptToText(p) {
    const groups = TEXT_ORDER.map(k => (p.answers[k] || []).filter(Boolean));
    while (groups.length && !groups[groups.length - 1].length) groups.pop();
    return [p.text, ...groups.map(g => (g.length ? g.join('\n') : '[]'))].join('\n\n');
  }


  // Small pure-JS SHA-256 (crypto.subtle isn't available on every file:// page).
  function sha256(msg) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const bytes = new TextEncoder().encode(msg);
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes); buf[len] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(total - 4, (len * 8) >>> 0); view.setUint32(total - 8, Math.floor(len / 0x20000000));
    const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  // ---------------------------------------------------------------- storage
  function makeStorage(key) {
    let mem = null;
    return {
      persistent: (() => { try { localStorage.setItem('__nichion', '1'); localStorage.removeItem('__nichion'); return true; } catch { return false; } })(),
      get() {
        try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch {}
        return mem;
      },
      set(v) { mem = v; try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
    };
  }

  // ------------------------------------------------------------------- game
  class GuessError extends Error { constructor(code, message) { super(message); this.code = code; } }

  class Game {
    /** @param data {salt, days:{date:{n,d}}}  @param storage {get,set}  @param now () => Date */
    constructor(data, storage, now = () => new Date()) {
      this.data = data; this.storage = storage; this.now = now;
      this.save = storage.get() || { plays: {}, maxSeen: null };
      this.save.plays = this.save.plays || {};
    }
    today() { return localDate(this.now()); }
    count(date) { return (this.data.days[date] && this.data.days[date].n) || 0; }
    prompts(date) { return decodeDay(this.data.salt, date, this.data.days[date]); }
    persist() { this.storage.set(this.save); }

    /** True when the device clock is earlier than a day this browser has already seen. */
    clockProblem() {
      const t = this.today();
      if (!this.save.maxSeen || t > this.save.maxSeen) { this.save.maxSeen = t; this.persist(); }
      return t < this.save.maxSeen ? this.save.maxSeen : null;
    }

    play(date) { return this.save.plays[date] || { guesses: [] }; }
    isComplete(date) { const n = this.count(date); return n > 0 && this.play(date).guesses.length >= n; }

    publicPlay(date) {
      const total = this.count(date);
      const play = this.play(date);
      const answered = play.guesses.length;
      const done = total > 0 && answered >= total;
      let prompts = [];
      if (total) {
        const all = this.prompts(date);
        for (let i = 0; i < total && i <= answered; i++) prompts.push({ index: i, text: (play.guesses[i] && play.guesses[i].prompt) || all[i].text });
      }
      const started = play.started && play.started[answered];
      return {
        date, total, done, prompts,
        current: done ? null : answered,
        deadline: !done && started ? started + TIME_LIMIT_MS : null,
        misses: (!done && play.misses && play.misses[answered]) || [],
        score: play.guesses.reduce((s, g) => s + g.points, 0),
        maxScore: total * 100,
        guesses: play.guesses.slice(),
      };
    }

    _todayPlay(date) {
      const today = this.today();
      if (this.clockProblem()) throw new GuessError('clock', 'Your device clock looks like it went backwards.');
      if (date !== today) throw new GuessError('day_changed', 'A new day has started — reload to dive again.');
      const prompts = this.prompts(today);
      if (!prompts.length) throw new GuessError('no_prompts', 'There are no prompts today.');
      const play = this.save.plays[today] || (this.save.plays[today] = { guesses: [] });
      play.started = play.started || {};
      play.misses = play.misses || {};
      if (play.guesses.length >= prompts.length) throw new GuessError('done', 'You already finished today’s dive.');
      return { play, prompts };
    }

    _expired(play, index, slack = GRACE_MS) {
      const s = play.started && play.started[index];
      if (!s) return false;
      const now = +this.now();
      // Turning the clock back mid-prompt also ends it.
      return now > s + TIME_LIMIT_MS + slack || now < s - 2000;
    }

    _record(play, prompts, index, fields) {
      const rec = {
        index, prompt: prompts[index].text, guess: '', tier: null, matched: null, corrected: false,
        points: 0, depth: 0, timedOut: false, misses: (play.misses[index] || []).slice(), ...fields,
      };
      play.guesses.push(rec);
      this.persist();
      return rec;
    }

    /** Start (or resume) the 25-second clock for a prompt. Returns the deadline (ms). */
    start({ date, index }) {
      const { play } = this._todayPlay(date);
      if (index !== play.guesses.length) throw new GuessError('out_of_order', 'That prompt was already answered.');
      if (!play.started[index]) { play.started[index] = +this.now(); this.persist(); }
      return play.started[index] + TIME_LIMIT_MS;
    }

    /** Ends today's current prompt with 0 points if its time has run out. */
    expireIfNeeded() {
      const today = this.today();
      const play = this.save.plays[today];
      if (!play || !play.started) return null;
      const index = play.guesses.length;
      if (index >= this.count(today) || !this._expired(play, index)) return null;
      return this._record(play, this.prompts(today), index, { timedOut: true });
    }

    /** Called by the UI when the countdown hits zero. */
    timeUp({ date, index }) {
      const { play, prompts } = this._todayPlay(date);
      if (index !== play.guesses.length) throw new GuessError('out_of_order', 'That prompt was already answered.');
      if (!this._expired(play, index, -GRACE_MS)) throw new GuessError('not_yet', 'There’s still time left.');
      return this._record(play, prompts, index, { timedOut: true });
    }

    /**
     * Try an answer. Not on the board → { invalid: true } and the prompt stays
     * open (until the time runs out). On the board → the prompt is scored.
     */
    guess({ date, index, guess }) {
      const { play, prompts } = this._todayPlay(date);
      if (index !== play.guesses.length) throw new GuessError('out_of_order', 'That prompt was already answered.');
      const text = typeof guess === 'string' ? guess.trim().replace(/\s+/g, ' ') : '';
      if (!text) throw new GuessError('empty', 'Type an answer first.');
      if (text.length > MAX_GUESS_LEN) throw new GuessError('too_long', `Keep it under ${MAX_GUESS_LEN} characters.`);
      if (!play.started[index]) play.started[index] = +this.now();
      if (this._expired(play, index)) return this._record(play, prompts, index, { timedOut: true });

      const m = matchGuess(text, prompts[index].answers);
      if (!m) {
        const misses = play.misses[index] || (play.misses[index] = []);
        const repeat = misses.some(x => normalize(x) === normalize(text));
        if (!repeat && misses.length < MAX_MISSES) misses.push(text);
        this.persist();
        return { invalid: true, repeat, index, guess: text, misses: misses.slice() };
      }
      const tier = TIER_BY_KEY[m.tier];
      return this._record(play, prompts, index, {
        guess: text, tier: tier.key, matched: m.display, corrected: m.corrected,
        points: tier.points, depth: tier.depth,
      });
    }

    /** Completed-day streaks; days with no prompts are skipped, today only counts once done. */
    stats() {
      const today = this.today();
      const dates = Object.keys(this.save.plays).filter(d => d <= today).sort();
      const done = dates.filter(d => this.isComplete(d));
      const scores = done.map(d => this.play(d).guesses.reduce((s, g) => s + g.points, 0));
      let run = 0, best = 0;
      if (dates.length) {
        for (let d = dates[0], i = 0; d <= today && i < 4000; d = addDays(d, 1), i++) {
          if (!this.count(d)) continue;
          if (this.isComplete(d)) { run++; best = Math.max(best, run); }
          else if (d !== today) run = 0;
        }
      }
      return { played: done.length, streak: run, bestStreak: best, bestScore: scores.length ? Math.max(...scores) : 0 };
    }

    state() {
      const today = this.today();
      if (!this.clockProblem()) this.expireIfNeeded();
      return {
        today,
        clockProblem: this.clockProblem(),
        resetInMs: msUntilMidnight(this.now()),
        tiers: TIERS,
        play: this.publicPlay(today),
        stats: this.stats(),
        hasYesterday: this.count(addDays(today, -1)) > 0,
        persistent: this.storage.persistent !== false,
      };
    }

    yesterday() {
      const y = addDays(this.today(), -1);
      return {
        date: y,
        prompts: this.prompts(y).map((p, i) => ({
          index: i, text: p.text,
          tiers: TIERS.map(t => ({ key: t.key, answers: (p.answers[t.key] || []).map(parseAnswer).filter(Boolean).map(a => a.display) })),
        })),
        guesses: this.play(y).guesses,
      };
    }
  }

  const api = {
    TIERS, TIER_BY_KEY, MAX_PROMPTS, TIME_LIMIT_MS, normalize, keys, editDistance, allowedTypos, matchGuess, parseAnswer,
    findDuplicates, dedupeAnswers, describeRemoval, nearDuplicate, singularize, localDate, addDays, isDate, encodeDay, decodeDay, cleanPrompts, sha256,
    makeStorage, Game, GuessError, parseQuestionText, promptToText, TEXT_ORDER,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NichionEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);

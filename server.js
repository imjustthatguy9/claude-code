'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { TIERS, TIER_KEYS, MAX_PROMPTS_PER_DAY } = require('./lib/tiers');
const { Store } = require('./lib/store');
const { matchGuess, findDuplicates } = require('./lib/match');
const { isDate, todayIn, addDays, msUntilNextDay, validTimeZone } = require('./lib/days');
const game = require('./lib/game');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const TZ = process.env.GAME_TZ || 'America/New_York';
if (!validTimeZone(TZ)) { console.error(`GAME_TZ "${TZ}" is not a valid IANA time zone`); process.exit(1); }
const PUBLIC_DIR = path.join(__dirname, 'public');
const SECURE_COOKIES = process.env.SECURE_COOKIES === '1';

fs.mkdirSync(DATA_DIR, { recursive: true });

function readOrCreate(file, make) {
  const p = path.join(DATA_DIR, file);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  const v = make();
  fs.writeFileSync(p, v + '\n', { mode: 0o600 });
  return v;
}

const SECRET = process.env.SESSION_SECRET || readOrCreate('secret.key', () => crypto.randomBytes(32).toString('hex'));
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let generatedPassword = false;
if (!ADMIN_PASSWORD) {
  const file = path.join(DATA_DIR, 'admin-password.txt');
  generatedPassword = !fs.existsSync(file);
  ADMIN_PASSWORD = readOrCreate('admin-password.txt', () => crypto.randomBytes(9).toString('base64url'));
}

const store = new Store(path.join(DATA_DIR, 'db.json'));
const today = () => todayIn(TZ, nowOverride());
// Tests can pin the clock with MANSELLION_NOW; never set it in production.
function nowOverride() { return process.env.MANSELLION_NOW ? new Date(process.env.MANSELLION_NOW) : new Date(); }

// ---------------------------------------------------------------------------
// Signed cookies
// ---------------------------------------------------------------------------
const sign = v => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function unsign(s) {
  if (typeof s !== 'string') return null;
  const i = s.lastIndexOf('.');
  if (i < 1) return null;
  const v = s.slice(0, i);
  const a = Buffer.from(sign(v)), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null;
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name, value, { maxAge, sameSite = 'Lax' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${sameSite}`;
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  if (SECURE_COOKIES) c += '; Secure';
  return c;
}

const PLAYER_COOKIE = 'msl_pid';
const ADMIN_COOKIE = 'msl_admin';
const ADMIN_TTL_S = 12 * 3600;

function playerId(req, res) {
  const id = unsign(parseCookies(req)[PLAYER_COOKIE]);
  if (id && /^[A-Za-z0-9_-]{16,40}$/.test(id)) return id;
  const fresh = crypto.randomBytes(16).toString('base64url');
  res.setHeader('Set-Cookie', cookie(PLAYER_COOKIE, sign(fresh), { maxAge: 5 * 365 * 86400 }));
  return fresh;
}

function isAdmin(req) {
  const v = unsign(parseCookies(req)[ADMIN_COOKIE]);
  if (!v) return false;
  const [tag, exp] = v.split(':');
  return tag === 'admin' && Number(exp) > Date.now();
}

function passwordOk(given) {
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(given), h(ADMIN_PASSWORD));
}

// Brute-force guard for the admin login: 8 failures per 10 minutes per IP.
const loginFailures = new Map();
function loginBlocked(ip) {
  const now = Date.now();
  const list = (loginFailures.get(ip) || []).filter(t => now - t < 10 * 60e3);
  loginFailures.set(ip, list);
  return list.length >= 8;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

const fail = (res, status, error, message) => send(res, status, { error, message });

function readJson(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const type = req.headers['content-type'] || '';
    // Requiring JSON forces a CORS preflight on cross-site requests (CSRF guard).
    if (!type.startsWith('application/json')) return reject(Object.assign(new Error('Expected JSON'), { status: 415 }));
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Bad JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
  const file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return fail(res, 403, 'forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return fail(res, 404, 'not_found');
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Validation for admin-submitted days
// ---------------------------------------------------------------------------
function cleanPrompts(input) {
  if (!Array.isArray(input)) throw Object.assign(new Error('prompts must be a list'), { status: 400 });
  if (input.length > MAX_PROMPTS_PER_DAY) throw Object.assign(new Error(`At most ${MAX_PROMPTS_PER_DAY} prompts per day`), { status: 400 });
  const out = [];
  for (const [i, p] of input.entries()) {
    const text = String(p?.text ?? '').trim().slice(0, 200);
    const answers = {};
    let count = 0;
    for (const k of TIER_KEYS) {
      const raw = Array.isArray(p?.answers?.[k]) ? p.answers[k] : String(p?.answers?.[k] ?? '').split('\n');
      answers[k] = raw.map(s => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 300);
      count += answers[k].length;
    }
    if (!text && !count) continue; // blank card: ignore
    if (!text) throw Object.assign(new Error(`Prompt ${i + 1} needs text`), { status: 400 });
    out.push({ text, answers });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  // ---- player ----
  if (p === '/api/state' && m === 'GET') {
    const pid = playerId(req, res);
    const d = today();
    const player = store.player(pid);
    return send(res, 200, {
      today: d,
      tz: TZ,
      resetInMs: msUntilNextDay(TZ, nowOverride()),
      tiers: TIERS,
      play: game.publicPlay(store, player, d),
      stats: game.stats(store, player, d),
      hasYesterday: store.promptsFor(addDays(d, -1)).length > 0,
    });
  }

  if (p === '/api/guess' && m === 'POST') {
    const pid = playerId(req, res);
    const body = await readJson(req, 4096);
    const d = today();
    try {
      const result = game.submitGuess(store, pid, { date: body.date, index: body.index, guess: body.guess }, d);
      const player = store.player(pid);
      return send(res, 200, { result, play: game.publicPlay(store, player, d), stats: game.stats(store, player, d) });
    } catch (e) {
      if (e instanceof game.GuessError) return fail(res, e.status, e.code, e.message);
      throw e;
    }
  }

  if (p === '/api/yesterday' && m === 'GET') {
    const pid = playerId(req, res);
    const y = addDays(today(), -1);
    const player = store.player(pid);
    const play = player?.plays?.[y];
    return send(res, 200, {
      date: y,
      prompts: game.answerSheet(store, y),
      guesses: (play?.guesses || []).map(g => ({ index: g.index, guess: g.guess, tier: g.tier, matched: g.display, points: g.points })),
    });
  }

  // ---- admin ----
  if (p === '/api/admin/login' && m === 'POST') {
    const ip = req.socket.remoteAddress || '?';
    if (loginBlocked(ip)) return fail(res, 429, 'rate_limited', 'Too many attempts. Try again in a few minutes.');
    const body = await readJson(req, 4096);
    if (!passwordOk(body.password || '')) {
      loginFailures.get(ip).push(Date.now());
      return fail(res, 401, 'bad_password', 'Wrong password.');
    }
    loginFailures.delete(ip);
    const token = sign(`admin:${Date.now() + ADMIN_TTL_S * 1000}`);
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(ADMIN_COOKIE, token, { maxAge: ADMIN_TTL_S, sameSite: 'Strict' }) });
  }

  if (p === '/api/admin/logout' && m === 'POST') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(ADMIN_COOKIE, '', { maxAge: 0, sameSite: 'Strict' }) });
  }

  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return fail(res, 401, 'unauthorized', 'Log in as admin.');

    if (p === '/api/admin/session' && m === 'GET') {
      return send(res, 200, { ok: true, today: today(), tz: TZ, tiers: TIERS, maxPrompts: MAX_PROMPTS_PER_DAY });
    }

    if (p === '/api/admin/days' && m === 'GET') {
      const days = Object.entries(store.data.days).map(([date, d]) => ({
        date, count: d.prompts.length, players: store.playersWhoPlayed(date), updatedAt: d.updatedAt,
      })).sort((a, b) => a.date.localeCompare(b.date));
      return send(res, 200, { today: today(), days });
    }

    const dm = p.match(/^\/api\/admin\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (dm) {
      const date = dm[1];
      if (!isDate(date)) return fail(res, 400, 'bad_date', 'Invalid date.');
      if (m === 'GET') {
        return send(res, 200, { date, today: today(), prompts: store.promptsFor(date), players: store.playersWhoPlayed(date) });
      }
      if (m === 'PUT') {
        const body = await readJson(req);
        const prompts = cleanPrompts(body.prompts);
        store.setDay(date, prompts);
        return send(res, 200, {
          ok: true, date, prompts,
          warnings: prompts.flatMap((pr, i) => findDuplicates(pr.answers).map(d => ({ prompt: i, ...d }))),
        });
      }
    }

    if (p === '/api/admin/test' && m === 'POST') {
      const body = await readJson(req, 64 * 1024);
      const answers = {};
      for (const k of TIER_KEYS) answers[k] = Array.isArray(body.answers?.[k]) ? body.answers[k].map(String) : [];
      return send(res, 200, { match: matchGuess(String(body.guess || ''), answers) });
    }

    if (p === '/api/admin/export' && m === 'GET') {
      return send(res, 200, { version: 1, exportedAt: new Date().toISOString(), days: store.data.days }, {
        'Content-Disposition': `attachment; filename="mansellion-prompts-${today()}.json"`,
      });
    }

    if (p === '/api/admin/import' && m === 'POST') {
      const body = await readJson(req, 8 * 1024 * 1024);
      const days = body.days && typeof body.days === 'object' ? body.days : null;
      if (!days) return fail(res, 400, 'bad_import', 'Expected { "days": { "YYYY-MM-DD": { "prompts": [...] } } }');
      let n = 0;
      for (const [date, d] of Object.entries(days)) {
        if (!isDate(date)) continue;
        store.setDay(date, cleanPrompts(d.prompts || []));
        n++;
      }
      return send(res, 200, { ok: true, imported: n });
    }
  }

  return fail(res, 404, 'not_found', 'No such endpoint.');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method_not_allowed');
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e.status) return fail(res, e.status, 'bad_request', e.message);
    console.error(e);
    return fail(res, 500, 'server_error', 'Something went wrong.');
  }
});

function shutdown() { try { store.flush(); } finally { process.exit(0); } }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  🌊 MANSELLION is diving on http://localhost:${PORT}`);
    console.log(`     admin:  http://localhost:${PORT}/admin`);
    console.log(`     day:    ${today()} (${TZ})`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`     admin password ${generatedPassword ? '(generated)' : ''}: stored in ${path.join(DATA_DIR, 'admin-password.txt')}`);
      if (generatedPassword) console.log(`     → ${ADMIN_PASSWORD}`);
    }
    console.log('');
  });
}

module.exports = { server, store };

'use strict';
// End-to-end checks of the server's anti-cheat rules, against a real process
// with a pinned clock and a throwaway data directory.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const TODAY = '2026-03-10';
let proc, dir;

const day = (n, extra = {}) => ({ prompts: Array.from({ length: n }, (_, i) => ({
  text: `Prompt ${i + 1}`,
  answers: { plankton: ['Apple'], clever: [], schooler: ['Grape'], rare: [], deepcut: [], mansellion: ['Durian'], ...extra },
})) });

function client() {
  let jar = '';
  return async (p, opts = {}) => {
    const res = await fetch(BASE + p, {
      method: opts.method || 'GET',
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(jar ? { Cookie: jar } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) jar = [jar, sc.split(';')[0]].filter(Boolean).join('; ');
    return { status: res.status, body: await res.json() };
  };
}

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msl-'));
  proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT, DATA_DIR: dir, ADMIN_PASSWORD: 'pw', GAME_TZ: 'UTC', MANSELLION_NOW: `${TODAY}T12:00:00Z` },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/state'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const admin = client();
  assert.equal((await admin('/api/admin/login', { method: 'POST', body: { password: 'pw' } })).status, 200);
  for (const [d, n] of [['2026-03-09', 2], [TODAY, 3], ['2026-03-11', 5]]) {
    assert.equal((await admin('/api/admin/day/' + d, { method: 'PUT', body: day(n) })).status, 200);
  }
});
test.after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('state shows only the current prompt and never answers', async () => {
  const c = client();
  const { body } = await c('/api/state');
  assert.equal(body.today, TODAY);
  assert.equal(body.play.total, 3);
  assert.equal(body.play.prompts.length, 1);
  assert.ok(!JSON.stringify(body).includes('Durian'));
});

test('one guess per prompt, in order, scored on the server', async () => {
  const c = client();
  await c('/api/state');
  let r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 0, guess: 'duriam' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.tier, 'mansellion');
  assert.equal(r.body.result.corrected, true);
  r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 0, guess: 'apple' } });
  assert.equal(r.status, 409, 're-guessing is refused');
  r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 2, guess: 'apple' } });
  assert.equal(r.status, 409, 'skipping ahead is refused');
  r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 1, guess: 'nope' } });
  assert.equal(r.body.result.points, 0);
  r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 2, guess: 'grape' } });
  assert.equal(r.body.play.done, true);
  assert.equal(r.body.play.score, 130);
  assert.equal(r.body.stats.streak, 1);
  r = await c('/api/guess', { method: 'POST', body: { date: TODAY, index: 3, guess: 'apple' } });
  assert.equal(r.status, 409);
});

test('cannot play another day by sending a different date', async () => {
  const c = client();
  const r = await c('/api/guess', { method: 'POST', body: { date: '2026-03-11', index: 0, guess: 'apple' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'day_changed');
});

test('yesterday reveals the answer sheet; tomorrow is admin-only', async () => {
  const c = client();
  const y = await c('/api/yesterday');
  assert.equal(y.body.date, '2026-03-09');
  assert.equal(y.body.prompts.length, 2);
  assert.deepEqual(y.body.prompts[0].tiers.find(t => t.key === 'mansellion').answers, ['Durian']);
  assert.equal((await c('/api/admin/day/2026-03-11')).status, 401);
});

test('admin needs the password; player cookies cannot be forged', async () => {
  const c = client();
  assert.equal((await c('/api/admin/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  const res = await fetch(BASE + '/api/admin/days', { headers: { Cookie: 'msl_admin=admin:99999999999999.fake' } });
  assert.equal(res.status, 401);
  const forged = await fetch(BASE + '/api/state', { headers: { Cookie: 'msl_pid=someoneelse.fake' } });
  assert.ok(forged.headers.get('set-cookie'), 'a bad signature gets a fresh player id');
});

test('rejects more than 5 prompts and non-JSON writes', async () => {
  const admin = client();
  await admin('/api/admin/login', { method: 'POST', body: { password: 'pw' } });
  assert.equal((await admin('/api/admin/day/2026-03-12', { method: 'PUT', body: day(6) })).status, 400);
  const res = await fetch(BASE + '/api/guess', { method: 'POST', body: 'date=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 415);
});

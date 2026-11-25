'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine');

const day = (n) => Array.from({ length: n }, (_, i) => ({
  text: `Prompt ${i + 1}`,
  answers: { plankton: ['Apple'], clever: [], schooler: ['Grape'], rare: [], deepcut: [], nichion: ['Durian'] },
}));
const memStore = () => { let v = null; return { get: () => v && JSON.parse(JSON.stringify(v)), set: x => { v = JSON.parse(JSON.stringify(x)); } }; };
function make(days, store = memStore()) {
  const salt = 'test-salt';
  const data = { salt, days: Object.fromEntries(Object.entries(days).map(([d, n]) => [d, E.encodeDay(salt, d, day(n))])) };
  let now = new Date(2026, 2, 10, 12);
  const g = new E.Game(data, store, () => now);
  return { g, data, store, at: d => { const [y, m, dd] = d.split('-').map(Number); now = new Date(y, m - 1, dd, 12); } };
}

test('scrambled data round-trips and hides answers', () => {
  const enc = E.encodeDay('s', '2026-03-10', day(2));
  assert.equal(enc.n, 2);
  assert.ok(!enc.d.includes('Durian') && !Buffer.from(enc.d, 'base64').toString('latin1').includes('Durian'));
  assert.deepEqual(E.decodeDay('s', '2026-03-10', enc), day(2));
  assert.notDeepEqual(E.decodeDay('s', '2026-03-11', enc), day(2), 'wrong date = garbage');
});

test('state only reveals the current prompt', () => {
  const { g } = make({ '2026-03-10': 3 });
  const s = g.state();
  assert.equal(s.today, '2026-03-10');
  assert.equal(s.play.total, 3);
  assert.equal(s.play.prompts.length, 1);
  assert.ok(!JSON.stringify(s).includes('Durian'));
});

test('wrong answers are rejected without ending the prompt', () => {
  const { g, store } = make({ '2026-03-10': 3 });
  const D = '2026-03-10';
  let r = g.guess({ date: D, index: 0, guess: 'banana' });
  assert.equal(r.invalid, true);
  assert.deepEqual(r.misses, ['banana']);
  r = g.guess({ date: D, index: 0, guess: 'BANANA' });
  assert.equal(r.repeat, true, 'same miss twice is flagged, not stored twice');
  assert.equal(r.misses.length, 1);
  const hit = g.guess({ date: D, index: 0, guess: 'duriam' });
  assert.equal(hit.tier, 'nichion');
  assert.deepEqual(hit.misses, ['banana']);
  assert.throws(() => g.guess({ date: D, index: 0, guess: 'apple' }), { code: 'out_of_order' });
  assert.throws(() => g.guess({ date: D, index: 2, guess: 'apple' }), { code: 'out_of_order' });
  assert.throws(() => g.guess({ date: '2026-03-11', index: 1, guess: 'apple' }), { code: 'day_changed' });
  g.guess({ date: D, index: 1, guess: 'apple' });
  g.guess({ date: D, index: 2, guess: 'grapes' });
  assert.throws(() => g.guess({ date: D, index: 3, guess: 'apple' }), { code: 'done' });
  const again = new E.Game(g.data, store, g.now);   // page reload
  const s = again.state();
  assert.equal(s.play.done, true);
  assert.equal(s.play.score, 140);
  assert.equal(s.stats.streak, 1);
});

test('25-second limit per prompt, and reloading does not pause it', () => {
  const store = memStore();
  const salt = 's', D = '2026-03-10';
  const data = { salt, days: { [D]: E.encodeDay(salt, D, day(2)) } };
  let t = new Date(2026, 2, 10, 12).getTime();
  const g = new E.Game(data, store, () => new Date(t));
  const deadline = g.start({ date: D, index: 0 });
  assert.equal(deadline - t, 25000);
  t += 10000;
  assert.throws(() => g.timeUp({ date: D, index: 0 }), { code: 'not_yet' });
  g.guess({ date: D, index: 0, guess: 'kiwi' });           // miss, still open
  t += 16000;                                              // 26s in
  const late = g.guess({ date: D, index: 0, guess: 'apple' });
  assert.equal(late.timedOut, true, 'a right answer after time is up does not count');
  assert.equal(late.points, 0);
  assert.deepEqual(late.misses, ['kiwi']);
  // Next prompt: start it, "reload" 30s later — it has expired on its own.
  g.start({ date: D, index: 1 });
  t += 30000;
  const reloaded = new E.Game(data, store, () => new Date(t));
  const s = reloaded.state();
  assert.equal(s.play.done, true);
  assert.equal(s.play.guesses[1].timedOut, true);
  // Restarting the clock for an already-started prompt keeps the original deadline.
  const st = memStore();
  let t2 = new Date(2026, 2, 10, 12).getTime();
  const g2 = new E.Game(data, st, () => new Date(t2));
  const d1 = g2.start({ date: D, index: 0 });
  t2 += 5000;
  assert.equal(new E.Game(data, st, () => new Date(t2)).start({ date: D, index: 0 }), d1);
});

test('turning the clock back is detected', () => {
  const t = make({ '2026-03-09': 1, '2026-03-10': 1 });
  t.g.state();                // seen 03-10
  t.at('2026-03-09');
  assert.equal(t.g.state().clockProblem, '2026-03-10');
  assert.throws(() => t.g.guess({ date: '2026-03-09', index: 0, guess: 'apple' }), { code: 'clock' });
});

test('streaks skip empty days and survive an unplayed today', () => {
  const t = make({ '2026-03-01': 1, '2026-03-02': 1, '2026-03-04': 1, '2026-03-05': 1 });
  for (const d of ['2026-03-01', '2026-03-02', '2026-03-04']) { t.at(d); t.g.guess({ date: d, index: 0, guess: 'apple' }); }
  t.at('2026-03-05');
  assert.deepEqual([t.g.stats().streak, t.g.stats().bestStreak], [3, 3]);
  t.at('2026-03-06');
  assert.equal(t.g.stats().streak, 0, 'missed 03-05');
  assert.equal(t.g.stats().bestStreak, 3);
});

test('yesterday reveals the full sheet', () => {
  const t = make({ '2026-03-09': 2 });
  const y = t.g.yesterday();
  assert.equal(y.prompts.length, 2);
  assert.deepEqual(y.prompts[0].tiers.find(x => x.key === 'nichion').answers, ['Durian']);
});

test('sha256 matches known vectors', () => {
  assert.equal(E.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(E.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('a day is 3 prompts by default; the file can change it', () => {
  assert.equal(E.DEFAULT_PER_DAY, 3);
  assert.equal(E.perDayOf({}), 3);
  assert.equal(E.perDayOf({ perDay: 5 }), 5);
  assert.equal(E.perDayOf({ perDay: 9 }), 5, 'never more than 5');
  const { g } = make({ '2026-03-10': 2 });
  assert.equal(g.state().perDay, 3);
});

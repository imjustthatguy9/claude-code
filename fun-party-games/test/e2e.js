'use strict';
// End-to-end run through every screen of fun-party-games.html on an emulated
// phone, with assertions on the game rules. Screenshots go to the folder given
// as the first argument (default: ./screenshots).
//   node build.js && node test/e2e.js [outDir]
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { chromium, devices } = require('playwright');

const FILE = 'file://' + path.join(__dirname, '..', 'fun-party-games.html');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'screenshots'));
fs.mkdirSync(OUT, { recursive: true });

const NAMES = ['Maya', 'Leo', 'Priya', 'Sam', 'Jordan'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async name => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  📸', name); };
  const tap = sel => page.locator(sel).first().click();
  const step = msg => console.log('•', msg);

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---- Home + players ----
  step('home');
  await shot('01-home-empty');
  step('needs players: tapping a game opens the players screen');
  await tap('[data-a="imp"]');
  assert.ok(await page.locator('.pname').count() === 0, 'players screen with nobody yet');
  for (const n of NAMES) {
    await tap('[data-a="add"]');
    await page.keyboard.type(n);
  }
  assert.strictEqual(await page.locator('.prow').count(), NAMES.length);
  await page.locator('.pname').last().blur();
  await shot('02-players');
  step('character picker');
  await tap('.ava-btn');
  assert.strictEqual(await page.locator('.cpick').count(), 21, '21 characters');
  await shot('03-character-picker');
  await page.locator('.cpick[data-k="frog"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fpg.players')));
  assert.deepStrictEqual(saved.map(p => p.name), NAMES, 'names saved');
  assert.strictEqual(saved[0].char, 'frog', 'character saved');
  await tap('[data-a="back"]');
  await shot('04-home-players');

  // ---- Imposter ----
  step('imposter setup');
  await tap('[data-a="imp"]');
  assert.strictEqual(await page.locator('.chip').count(), 16, '16 word sets');
  assert.strictEqual(await page.locator('.chip.on').count(), 16, 'all sets on by default');
  await tap('[data-a="impNone"]');
  assert.strictEqual(await page.locator('.chip.on').count(), 0, 'None turns every set off');
  await page.locator('.chip[data-k="ocean"]').click();
  await page.locator('.chip[data-k="sweets"]').click();
  await page.locator('.chip[data-k="loot"]').click();
  assert.strictEqual(await page.locator('#pickCount').innerText(), '3', 'several sets can be picked at once');
  await shot('05b-imposter-pick-several');
  await tap('[data-a="impAll"]');
  assert.strictEqual(await page.locator('.chip.on').count(), 16, 'All turns every set on');
  await tap('.tog');           // hint off
  await tap('.tog');           // hint back on
  await shot('05-imposter-setup');
  await tap('[data-a="go"]');
  const roles = [];
  for (let i = 0; i < NAMES.length; i++) {
    assert.ok(await page.locator('#nextBtn').isDisabled(), 'next is locked until you peek');
    if (i === 0) await shot('06-imposter-card-covered');
    const box = await page.locator('#cover').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height - 40;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(x, y - (box.height * 0.8) * k / 8);
    const isImp = await page.locator('.secret.is-imp').count() > 0;
    roles.push(isImp);
    if (isImp && !roles.slice(0, -1).includes(true)) await shot('08-imposter-peek-imposter');
    if (!isImp && !roles.slice(0, -1).includes(false)) await shot('07-imposter-peek-word');
    await page.mouse.up();
    await page.waitForTimeout(350);
    const t = await page.locator('#cover').evaluate(el => getComputedStyle(el).transform);
    assert.ok(t === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t), 'card drops back down on release: ' + t);
    assert.ok(!(await page.locator('#nextBtn').isDisabled()), 'next unlocked after peeking');
    await tap('#nextBtn');
  }
  assert.strictEqual(roles.filter(Boolean).length, 1, 'exactly one imposter');
  await shot('09-imposter-discuss');
  await tap('[data-a="reveal"]');
  await page.waitForTimeout(250);
  await shot('10-imposter-suspense');
  await page.waitForSelector('.imp-card', { timeout: 4000 });
  await page.waitForTimeout(900);
  const impName = await page.locator('.imp-card b').innerText();
  assert.strictEqual(impName, NAMES[roles.indexOf(true)], 'reveal shows the right imposter');
  await shot('11-imposter-reveal');
  await tap('[data-a="home"]');

  // ---- Who Has the Bomb? ----
  step('bomb');
  await tap('[data-a="bomb"]');
  assert.strictEqual(await page.locator('.chip').count(), 16, '16 bomb packs');
  await tap('[data-a="bombNone"]');
  for (const k of ['animals', 'fantasy', 'tricky']) await page.locator(`.chip[data-k="${k}"]`).click();
  await shot('12-bomb-setup');
  assert.deepStrictEqual(await page.evaluate(() => S.bomb.packs), ['animals', 'fantasy', 'tricky']);
  await tap('[data-a="go"]');
  const cat1 = await page.locator('#cat b').innerText();
  await tap('[data-a="newcat"]');
  const cat2 = await page.locator('#cat b').innerText();
  assert.notStrictEqual(cat1, cat2, 'new category changes it');
  const packsSeen = await page.evaluate(() => { const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(drawCat().pack); return [...seen].sort(); });
  assert.deepStrictEqual(packsSeen, ['Animal Kingdom', 'Fantasy & Magic', 'Tricky Words'], 'categories come from every picked pack: ' + packsSeen);
  await shot('13-bomb-ready');
  // Speed the fuse up for the test: 1.2s quiet, 1.4s blinking, 1.2s fast.
  await page.evaluate(() => { FUSES.normal = [[1.2, 1.2], [1.4, 1.4], [1.2, 1.2]]; });
  await tap('[data-a="light"]');
  await page.waitForTimeout(500);
  assert.ok(await page.locator('#bomb.s1').count(), 'stage 1: dormant');
  await shot('14-bomb-stage1-dormant');
  await page.waitForTimeout(900);
  assert.ok(await page.locator('#bomb.s2').count(), 'stage 2: blinking');
  await page.waitForFunction(() => /data:image/.test(document.querySelector('#bombImg').src) && document.querySelector('#bombImg').src !== sprURL(bombRows(false)));
  await page.screenshot({ path: path.join(OUT, '15-bomb-stage2-blinking.png') }); console.log('  📸 15-bomb-stage2-blinking');
  await page.waitForSelector('#bomb.s3', { timeout: 3000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, '16-bomb-stage3-fast.png') }); console.log('  📸 16-bomb-stage3-fast');
  await page.waitForSelector('.boom-word', { timeout: 3000 });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, '17-bomb-boom.png') }); console.log('  📸 17-bomb-boom');
  await page.waitForSelector('.who-grid', { timeout: 3000 });
  await shot('18-bomb-who');
  await page.locator('.who').nth(2).click();
  assert.ok((await page.locator('.big-title').innerText()).toUpperCase().includes(NAMES[2].toUpperCase()), 'loser named');
  await shot('19-bomb-result');
  await tap('[data-a="next"]');
  assert.ok(await page.locator('#bomb.idle').count(), 'next round ready');
  await tap('[data-a="back"]');
  await tap('[data-a="back"]');

  // ---- $20 Draft ----
  step('draft');
  await tap('[data-a="draft"]');
  await tap('[data-a="picks"][data-k="3"]');
  await tap('[data-a="set"][data-k="pets"]');
  await shot('20-draft-setup');
  await tap('[data-a="go"]');
  await shot('21-draft-first-turn');
  // Opening bid, then a raise, then everyone else passes.
  await tap('[data-a="plus"]'); await tap('[data-a="plus"]');
  await tap('[data-a="bid"]');
  const st = await page.evaluate(() => ({ bid: D.lot.bid, holder: D.lot.holder, turn: D.lot.turn }));
  assert.strictEqual(st.bid, 3, 'bid of $3 placed');
  await tap('[data-a="max"]');
  assert.strictEqual(await page.locator('#amt').innerText(), '20', 'you can bid all $20 (no money saved for empty slots)');
  await shot('22-draft-raise');
  await tap('[data-a="bid"]');
  let guard = 0;
  while (!(await page.locator('.sold-banner').count()) && guard++ < 20) await tap('[data-a="pass"]');
  await shot('23-draft-sold');
  // Play the rest with a simple strategy: random bid or pass.
  guard = 0;
  let freebieShot = false;
  while (!(await page.locator('.teams').count()) && guard++ < 400) {
    if (!freebieShot && await page.locator('.stamp.free').count()) { freebieShot = true; await shot('23b-draft-freebie'); }
    if (await page.locator('[data-a="nextLot"]').count()) { await tap('[data-a="nextLot"]'); continue; }
    if (Math.random() < 0.45) { await tap('[data-a="plus"]'); await tap('[data-a="bid"]'); }
    else await tap('[data-a="pass"]');
  }
  assert.ok(await page.locator('.teams').count(), 'draft finished');
  assert.ok(await page.evaluate(() => D.freebies >= 2), 'the player who spent $20 got leftovers for free');
  assert.ok(freebieShot, 'a FREEBIE! screen was shown');
  const result = await page.evaluate(() => S.players.map(p => ({ n: D.team[p.id].length, money: D.money[p.id], spent: D.team[p.id].reduce((a, i) => a + i.price, 0) })));
  for (const r of result) {
    assert.strictEqual(r.n, 3, 'every team has 3 picks');
    assert.ok(r.money >= 0, 'nobody goes broke');
    assert.strictEqual(r.spent + r.money, 20, 'money adds up');
  }
  await page.waitForTimeout(1500);
  await shot('24-draft-results-teams');
  await page.locator('.crown-btn').nth(1).click();
  await page.waitForTimeout(1800);
  await shot('25-draft-crowned');
  await tap('[data-a="side"]');
  await shot('26-draft-side-by-side');

  // ---- Draft rules stress test (direct, 400 random drafts) ----
  step('draft rules stress test');
  const stress = await page.evaluate(() => {
    const fails = [];
    const realRender = render, realToast = toast;
    render = () => {}; toast = () => {};   // pure rules check: skip the DOM
    for (let run = 0; run < 400; run++) {
      S.draft.picks = run % 2 ? 5 : 3;
      S.draft.set = pick([...SETS.map(s => s.id), 'mix']);
      draftStart();
      let steps = 0;
      while (D.lot && steps++ < 5000) {
        if (S.players.every(p => needs(p) <= 0)) break;
        if (D.lot.done) { draftNextLot(); continue; }
        const p = byId(D.lot.turn);
        if (!canAct(p)) { fails.push('turn given to a player who cannot act'); break; }
        if (maxBid(p) !== D.money[p.id]) { fails.push('max bid is not all your money'); break; }
        if (Math.random() < 0.5) { D.lot.amt = Math.random() < 0.15 ? maxBid(p) : minBid() + rnd(Math.max(1, maxBid(p) - minBid() + 1)); draftAct('bid'); }
        else draftAct('pass');
      }
      for (const p of S.players) {
        if (D.team[p.id].length !== D.picks) fails.push(`run ${run}: ${p.name} has ${D.team[p.id].length}/${D.picks}`);
        if (D.money[p.id] < 0) fails.push(`run ${run}: negative money`);
      }
    }
    render = realRender; toast = realToast;
    return fails.slice(0, 5);
  });
  assert.deepStrictEqual(stress, [], 'draft stress: ' + stress.join('; '));

  // ---- Imposter with 2 imposters + no hint, sanity ----
  const two = await page.evaluate(() => {
    S.imp.count = 2; S.imp.hint = false; impStart();
    return { imps: R.imps.size, hint: R.hint };
  });
  assert.deepStrictEqual(two, { imps: 2, hint: false });

  assert.deepStrictEqual(errors, [], 'no page errors');
  console.log('\n✅ All checks passed. Screenshots in', OUT);
  await browser.close();
})().catch(async e => { console.error('\n❌', e.message); process.exit(1); });

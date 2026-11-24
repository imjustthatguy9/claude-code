'use strict';
// Checks the installable/offline setup: serve the folder over http://localhost,
// open the game once, go offline, and make sure it still opens and plays.
//   node build.js && node test/offline.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  console.log('• first visit (online)');
  await page.goto(base + 'fun-party-games.html');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 })
    .catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 }); });
  const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
  assert.strictEqual(manifest.display, 'standalone');
  assert.ok(await page.locator('link[rel="apple-touch-icon"]').count(), 'has a Home Screen icon');

  console.log('• no connection');
  server.close();
  await ctx.setOffline(true);
  for (const url of ['fun-party-games.html', '', 'fun-party-games.html?source=homescreen']) {
    await page.goto(base + url);
    await page.waitForSelector('.logo', { timeout: 5000 });
  }
  assert.ok(await page.locator('.tile').count() === 3, 'home screen with the 3 games shows offline');
  assert.ok(await page.evaluate(() => document.fonts.check("16px 'Press Start 2P'")), 'pixel fonts are there offline');
  // Play a little offline: add players and start a bomb round.
  await page.locator('[data-a="players"]').click();
  for (const n of ['Ava', 'Ben', 'Cal']) { await page.locator('[data-a="add"]').click(); await page.keyboard.type(n); }
  await page.locator('[data-a="back"]').first().click();
  await page.locator('[data-a="bomb"]').click();
  await page.locator('[data-a="go"]').click();
  await page.locator('[data-a="light"]').click();
  await page.waitForSelector('.bomb-live', { timeout: 3000 });
  const icon = await page.evaluate(() => fetch('icons/icon-180.png').then(r => r.ok));
  assert.ok(icon, 'icons come from the offline copy');

  assert.deepStrictEqual(errors, [], 'no page errors');
  console.log('\n✅ Works offline after one online visit.');
  await browser.close();
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });

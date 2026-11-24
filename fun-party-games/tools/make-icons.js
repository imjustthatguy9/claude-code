'use strict';
// Draws the home-screen icons (icons/*.png) from the game's pixel art.
//   node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const art = ['art.js', 'art-more.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: art });
  for (const size of [180, 192, 512]) {
    const data = await page.evaluate(size => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      // pastel sky with a dotted floor
      const g = x.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#ffe8f2'); g.addColorStop(1, '#fff3e2');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      const u = size / 32;  // one "art pixel" on a 32-grid
      x.fillStyle = '#f7d9b8';
      for (let gy = 2; gy < 32; gy += 4) for (let gx = 2; gx < 32; gx += 4) x.fillRect(gx * u, gy * u, u * 0.7, u * 0.7);
      const draw = (rows, ox, oy, scale) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return;
        x.fillStyle = PAL[ch];
        x.fillRect(Math.round((ox + i * scale) * u), Math.round((oy + j * scale) * u), Math.ceil(scale * u), Math.ceil(scale * u));
      }));
      draw(bombRows(true), 4, 3, 1);                                  // bomb, 24px tall on the 32 grid
      draw(['..y..', '.yoy.', 'yowoy', '.yoy.', '..y..'], 23, 1, 1);    // spark
      return c.toDataURL('image/png').split(',')[1];
    }, size);
    fs.writeFileSync(path.join(ROOT, 'icons', `icon-${size}.png`), Buffer.from(data, 'base64'));
    console.log('icons/icon-' + size + '.png');
  }
  await browser.close();
})();

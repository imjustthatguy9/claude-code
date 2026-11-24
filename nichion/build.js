'use strict';
// Builds the single, self-contained nichion.html from src/.
//   node build.js            → nichion.html with the sample prompts
//   node build.js --empty    → nichion.html with no prompts at all
const fs = require('fs');
const path = require('path');
const E = require('./src/engine');

const SRC = path.join(__dirname, 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const fonts = [
  ['Press Start 2P', 'PressStart2P.woff2', '400'],
  ['Pixelify Sans', 'PixelifySans.woff2', '400 700'],
].map(([family, file, weight]) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', file)).toString('base64')}) format('woff2');}`
).join('\n');

const salt = 'nichion-sample';
const sample = process.argv.includes('--empty') ? {} : JSON.parse(read('sample-days.json'));
const days = {};
const known = new Set(E.TIERS.map(t => t.key));
for (const [date, prompts] of Object.entries(sample)) {
  for (const p of prompts) for (const k of Object.keys(p.answers || {})) {
    if (!known.has(k)) throw new Error(`${date} "${p.text}": unknown tier "${k}" (expected ${[...known].join(', ')})`);
  }
}
for (const [date, prompts] of Object.entries(sample)) days[date] = E.encodeDay(salt, date, E.cleanPrompts(prompts));
const data = JSON.stringify({ v: 1, stamp: 'built-' + Date.now().toString(36), salt, admin: null, days });

const js = ['engine.js', 'sprites.js', 'ocean.js', 'charts.js', 'admin.js', 'app.js'].map(read).join('\n');
const css = read('style.css') + '\n' + read('admin.css');
for (const [name, text] of [['js', js], ['data', data]]) {
  if (/<\/script/i.test(text)) throw new Error(`${name} contains "</script" — it would break the inline <script>`);
}

const html = read('index.html')
  .replace('/*FAVICON*/', () => 'data:image/svg+xml,' + encodeURIComponent(read('favicon.svg').trim()))
  .replace('/*DATA*/', () => data)
  .replace('/*FONTS*/', () => fonts)
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);

fs.writeFileSync(path.join(__dirname, 'nichion.html'), html);
console.log(`nichion.html written (${(html.length / 1024).toFixed(0)} KB, ${Object.keys(days).length} sample days)`);

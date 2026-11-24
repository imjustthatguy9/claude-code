'use strict';
// Builds the single, self-contained fun-party-games.html from src/.
//   node build.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const fonts = [
  ['Press Start 2P', 'PressStart2P.woff2', '400'],
  ['Pixelify Sans', 'PixelifySans.woff2', '400 700'],
].map(([family, file, weight]) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', file)).toString('base64')}) format('woff2');}`
).join('\n') +
  // Pixelify Sans draws 2 and 5 like S and 8, so numbers (and $ +) use Press Start 2P,
  // scaled down to sit nicely in body text.
  `\n@font-face{font-family:'PFG Digits';font-style:normal;font-weight:400 700;font-display:swap;size-adjust:64%;` +
  `unicode-range:U+0024,U+002B,U+0030-0039;` +
  `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', 'PressStart2P.woff2')).toString('base64')}) format('woff2');}`;

// Favicon: the lit bomb sprite, as crisp SVG rects.
const art = new Function(read('art.js') + '\nreturn { PAL, bombRows };')();
const rects = [];
art.bombRows(true).forEach((row, y) => [...row].forEach((ch, x) => {
  if (ch !== '.') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${art.PAL[ch]}"/>`);
}));
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects.join('')}</svg>`;

const js = ['art.js', 'art-more.js', 'data.js', 'app.js'].map(read).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS contains "</script" and would break the inline <script>');

const html = read('index.html')
  .replace('/*FAVICON*/', () => 'data:image/svg+xml,' + encodeURIComponent(favicon))
  .replace('/*FONTS*/', () => fonts)
  .replace('/*CSS*/', () => read('style.css'))
  .replace('/*JS*/', () => js);

fs.writeFileSync(path.join(__dirname, 'fun-party-games.html'), html);
console.log(`fun-party-games.html written (${(html.length / 1024).toFixed(0)} KB)`);

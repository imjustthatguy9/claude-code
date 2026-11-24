// Hand-placed pixel sprites. Each sprite is a list of rows; every character is
// one pixel looked up in that sprite's palette ('.' = transparent).
(function () {
  'use strict';

  const K = '#0b1426'; // shared ink
  const W = '#ffffff';

  const SPRITES = {
    // --- Tier 1: a round little copepod with antennae -----------------------
    plankton: {
      pal: { g: '#2f7d4a', G: '#8be07a', h: '#d8ffb0', w: W, k: K, l: '#bff5a8' },
      rows: [
        '.l.......l.',
        '..l.....l..',
        '...ggggg...',
        '..gGGGGGg..',
        '.gGhGGGGGg.',
        '.gGwwGwwGg.',
        '.gGwkGwkGg.',
        '.gGGGGGGGg.',
        '..gGGkGGg..',
        '...ggggg...',
        '..g.g.g.g..',
      ],
    },

    // --- Tier 2: an octopus who is, frankly, too clever (glasses) -----------
    clever: {
      pal: { t: '#13727f', T: '#2fc4d6', h: '#a8f3fa', k: K, w: '#dffcff', p: '#ff8fb1' },
      rows: [
        '....ttttt....',
        '..ttTTTTTtt..',
        '.tTTThhTTTTt.',
        '.tTThTTTTTTt.',
        'tTTTTTTTTTTTt',
        'tkkkkTTTkkkkt',
        'tkwwkkkkkwwkt',
        'tkwkkTTTkwkkt',
        'tTkkpTTTpkkTt',
        '.tTTTTkTTTTt.',
        '.tTTTTTTTTTt.',
        'tT.tT.tT.tTt.',
        'tT.tT..T.tT.t',
        '.t..tT.tT..t.',
        '..t..t..t..t.',
      ],
    },

    // --- Tier 3: one member of a school -------------------------------------
    schooler: {
      pal: { d: '#1d3c94', B: '#3b6cf0', l: '#9fc0ff', w: W, k: K },
      rows: [
        '.....dd....',
        '.d..dBBdd..',
        'dBddBBBBBd.',
        'dBBBBlBBwkd',
        'dBBBBBlBBBd',
        'dBddBBBBBd.',
        '.d..dBBdd..',
        '.....dd....',
      ],
    },

    // --- Tier 4: a rare violet sea turtle -----------------------------------
    rare: {
      pal: { o: '#5a2d8f', P: '#c07bff', p: '#8f4fd6', q: '#e4c4ff', s: '#3f9a7a', S: '#7fd6b0', w: W, k: K },
      rows: [
        '......ooooo........',
        '....ooPPPPPoo......',
        '...oPPqPPPqPPo.....',
        '..oPPqpPPPpqPPo.SS.',
        '.oPPPpPqqqPpPPPoSSS',
        '.oPPqPPpPpPPqPPSwkS',
        'SoPPPPqPPPqPPPPoSSS',
        'SSoopppppppppooSS..',
        '.SS..SS....SS..S...',
        '..S...SS....SS.....',
      ],
    },

    // --- Tier 5: anglerfish, the deep cut -----------------------------------
    deepcut: {
      pal: { r: '#8a1f3a', R: '#ff5c7a', m: '#c93a5a', y: '#fff3a0', Y: '#ffd84a', w: W, k: K, t: '#ffe9ef' },
      rows: [
        '.........yy.......',
        '........yYYy......',
        '........yYYy......',
        '.........yy.......',
        '.........r........',
        '..........r.......',
        '.....rrrrrrr......',
        '...rrRRRRRRRrr....',
        '..rRRRRRRRwwRRr..r',
        '.rRRmRRRRRwkRRRrrR',
        'rRRRRRRRRRRRRRRRRr',
        'rRRmRRRRtrtrtrtrRr',
        'rRRRRRRRRrtrtrtrr.',
        '.rRRRmRRRRRRRRrrrR',
        '..rRRRRRRRRRRr...r',
        '...rrrRRRrrrr.....',
        '......rr..........',
      ],
    },

    // --- Tier 6: THE NICHION — a deep-sea lion with a glowing mane --------
    nichion: {
      pal: { o: '#9a4a12', O: '#ff9a3c', m: '#ffb84d', g: '#b88412', G: '#ffcf3f', h: '#fff2b0', w: W, k: K, n: '#5a2a0a', f: '#ff6a3c' },
      rows: [
        '.....o..o.o..o......',
        '...o.oOooOoOOo.o....',
        '..oOOOmOOmOOmOOo....',
        '.oOmOOOOOOOOOOmOo...',
        'oOOOOgggggggOOOOOo..',
        'oOmOgGGGGGGGgOOmOo..',
        '.oOgGhGGGGGhGgOOo...',
        'oOOgGwkGGGwkGgOOOo.f',
        'oOmgGGGGnGGGGgmOOoff',
        '.oOgGGGnnnGGGgOOo.ff',
        'oOOOgGGGGGGGgOOOOoff',
        '.oOmOgGknkGgOOmOOGGf',
        '..oOOOgggggOOOOgGGG.',
        '...oOOOOOOOOOogGGG..',
        '....ooOoOOoOoggGG...',
        '......o..o..ogg.....',
      ],
    },

    // --- The player's little bathysphere-sub --------------------------------
    sub: {
      pal: { y: '#c98a14', Y: '#ffd23f', h: '#fff2a8', k: K, c: '#7fe3ff', C: '#2f9fd8', g: '#5a6b7a', G: '#9aa9b6', r: '#ff5c5c' },
      rows: [
        '.......gg.......',
        '.......Gg.......',
        '......yYYy......',
        '...yyYYYYYYyy...',
        '..yYhYYYYYYYYy.g',
        '.yYhYYkkkYYYYYyG',
        'yYYYYkcCckYYYYYG',
        'yYYYYkcccrYYYYyG',
        'yYYYYYkkkYYYYYy.',
        '.yYYYYYYYYYYYy..',
        '..yyYYYYYYYyy...',
        '....yyyyyyy.....',
      ],
    },

    jelly: {
      pal: { j: '#ff9ad5', J: '#ffd0ee', h: W, d: '#c45a9a' },
      rows: [
        '..jjjjj..',
        '.jJJJJJj.',
        'jJhJJJJJj',
        'jJJJJJJJj',
        'djdjdjdjd',
        '.j.d.j.d.',
        '.d.j.d.j.',
        'j..d..j..',
        '.d..j..d.',
        '..j...j..',
      ],
    },

    smallfish: {
      pal: { o: '#ff9a3c', O: '#ffcf7a', k: K },
      rows: [
        'o..oo..',
        'ooOOOo.',
        'oOOOOko',
        'ooOOOo.',
        'o..oo..',
      ],
    },

    tinyfish: {
      pal: { b: '#7fe3ff', B: '#c8f6ff', k: K },
      rows: [
        'b.bb.',
        'bBBkb',
        'b.bb.',
      ],
    },

    chest: {
      pal: { b: '#6b3a12', B: '#a8662a', y: '#ffd23f', Y: '#fff2a8', k: '#2a1606' },
      rows: [
        '..bbbbbbbbbb..',
        '.bBBBBBBBBBBb.',
        'bByyyyyyyyyyBb',
        'kkkkkkYykkkkkk',
        'bBBBBByyBBBBBb',
        'bBBBBBBBBBBBBb',
        'bBByBBBBBByBBb',
        'kkkkkkkkkkkkkk',
      ],
    },

    bubble: {
      pal: { b: '#c8f6ff', w: W },
      rows: [
        '.bb.',
        'bw.b',
        'b..b',
        '.bb.',
      ],
    },
  };

  // Normalise row widths so a typo in a sprite can never break rendering.
  for (const s of Object.values(SPRITES)) {
    s.w = Math.max(...s.rows.map(r => r.length));
    s.h = s.rows.length;
    s.rows = s.rows.map(r => r.padEnd(s.w, '.'));
  }

  /** Draw a sprite onto a 2D context at integer pixel coordinates. */
  function draw(ctx, name, x, y, { flip = false, scale = 1, alpha = 1, tint = null } = {}) {
    const s = SPRITES[name];
    if (!s) return;
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * alpha;
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < s.h; r++) {
      const row = s.rows[r];
      for (let c = 0; c < s.w; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = tint || s.pal[ch] || '#f0f';
        const cx = flip ? s.w - 1 - c : c;
        ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
      }
    }
    ctx.globalAlpha = prevA;
  }

  const urlCache = new Map();
  /** A crisp data: URL of a sprite at an integer scale, for <img> use in the UI. */
  function dataURL(name, scale = 4, opts = {}) {
    const key = name + '|' + scale + '|' + JSON.stringify(opts);
    if (urlCache.has(key)) return urlCache.get(key);
    const s = SPRITES[name];
    const c = document.createElement('canvas');
    c.width = s.w * scale; c.height = s.h * scale;
    draw(c.getContext('2d'), name, 0, 0, { ...opts, scale });
    const url = c.toDataURL('image/png');
    urlCache.set(key, url);
    return url;
  }

  function img(name, scale = 4, cls = '') {
    const s = SPRITES[name];
    const el = document.createElement('img');
    el.src = dataURL(name, scale);
    el.width = s.w * scale; el.height = s.h * scale;
    el.alt = '';
    el.className = 'sprite ' + cls;
    el.draggable = false;
    return el;
  }

  window.Sprites = { SPRITES, draw, dataURL, img };
})();

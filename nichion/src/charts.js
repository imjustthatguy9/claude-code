// Pixel-styled SVG charts for the results screen. Single series each, so the
// chart title names it and there's no legend box; each mark carries a hover /
// focus tooltip (data-tip) and the guess list below acts as the table view.
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function tipFor(g, tier, extra = '') {
    const said = g.timedOut || !tier ? 'Time ran out' : `“${esc(g.guess)}” → ${esc(tier.name)}`;
    return `<b>P${g.index + 1}</b> ${esc(g.prompt)}<br>${said}<br>+${g.points} pts · ↓${g.depth}m${extra}`;
  }

  /** Points per prompt: one bar per guess, 0–100 scale. */
  function bars(guesses, total, tiers) {
    const byKey = Object.fromEntries(tiers.map(t => [t.key, t]));
    const W = 320, H = 170, L = 30, R = 6, T = 18, B = 26;
    const max = 100;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'shape-rendering': 'crispEdges',
      'aria-label': 'Points per prompt: ' + guesses.map(g => `prompt ${g.index + 1}, ${g.points} points`).join('; ') });
    const y = v => T + (H - T - B) * (1 - v / max);
    for (const v of [0, 25, 50, 75, 100]) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }, svg);
      if (v % 50 === 0) el('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, svg).textContent = v;
    }
    const slots = Math.max(total, guesses.length, 1);
    const slotW = (W - L - R) / slots;
    const bw = Math.min(40, Math.round(slotW * 0.56));
    guesses.forEach((g, i) => {
      const t = byKey[g.tier];
      const cx = L + slotW * (i + 0.5);
      const x = Math.round(cx - bw / 2);
      const grp = el('g', { tabindex: 0, 'data-tip': tipFor(g, t) }, svg);
      el('rect', { class: 'hit', x: L + slotW * i, y: T, width: slotW, height: H - T - B }, grp);
      if (g.points > 0) {
        const top = Math.round(y(g.points));
        el('rect', { class: 'bar', x, y: top, width: bw, height: y(0) - top, fill: `var(--t-${g.tier})`, style: `animation-delay:${i * 110}ms` }, grp);
        // Pixel highlight on the left edge of each bar.
        el('rect', { class: 'bar', x, y: top, width: 4, height: y(0) - top, fill: 'rgba(255,255,255,.28)', style: `animation-delay:${i * 110}ms` }, grp);
        el('text', { x: cx, y: top - 6, 'text-anchor': 'middle', class: 'val' }, grp).textContent = g.points;
      } else {
        el('rect', { x, y: y(0) - 4, width: bw, height: 4, fill: 'var(--t-miss)' }, grp);
        el('text', { x: cx, y: y(0) - 10, 'text-anchor': 'middle', class: 'val' }, grp).textContent = '0';
      }
      el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, grp).textContent = 'P' + (i + 1);
    });
    return svg;
  }

  /** Dive profile: cumulative depth after each prompt, drawn downward like a dive computer log. */
  function profile(guesses, total, tiers) {
    const byKey = Object.fromEntries(tiers.map(t => [t.key, t]));
    const W = 320, H = 190, L = 40, R = 14, T = 12, B = 24;
    const maxDepth = Math.max(100, total * 100);
    const steps = Math.max(total, guesses.length, 1);
    const x = i => L + (W - L - R) * (i / steps);
    const y = m => T + (H - T - B) * (m / maxDepth);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': 'Dive profile: ' + guesses.map((g, i) => `after prompt ${i + 1}, ${guesses.slice(0, i + 1).reduce((s, q) => s + q.depth, 0)} metres`).join('; ') });
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: 'abyss', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': '#2390cc' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#030818' }, grad);

    const ticks = maxDepth <= 200 ? 50 : 100;
    for (let m = 0; m <= maxDepth; m += ticks) {
      el('line', { x1: L, x2: W - R, y1: y(m), y2: y(m), class: m === 0 ? 'axis' : 'grid', 'shape-rendering': 'crispEdges' }, svg);
      el('text', { x: L - 6, y: y(m) + 3, 'text-anchor': 'end' }, svg).textContent = m + 'm';
    }
    for (let i = 1; i <= steps; i++) {
      el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = 'P' + i;
    }

    const pts = [[x(0), y(0)]];
    let d = 0;
    guesses.forEach((g, i) => { d += g.depth; pts.push([x(i + 1), y(d)]); });
    // Area between the surface and the dive line.
    el('path', { class: 'area', d: `M${pts.map(p => p.join(',')).join(' L')} L${pts[pts.length - 1][0]},${y(0)} Z` }, svg);
    const line = el('polyline', { class: 'line', points: pts.map(p => p.join(',')).join(' ') }, svg);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    line.style.setProperty('--len', Math.ceil(len));

    // The sub starts at the surface.
    el('rect', { x: x(0) - 4, y: y(0) - 4, width: 8, height: 8, fill: '#ffd23f', class: 'dot' }, svg);
    d = 0;
    guesses.forEach((g, i) => {
      d += g.depth;
      const t = byKey[g.tier];
      const grp = el('g', { tabindex: 0, 'data-tip': tipFor(g, t, `<br>Total depth ${d}m`) }, svg);
      el('rect', { class: 'hit', x: x(i + 1) - 16, y: y(d) - 16, width: 32, height: 32 }, grp);
      el('rect', { class: 'dot', x: x(i + 1) - 5, y: y(d) - 5, width: 10, height: 10,
        fill: g.tier ? `var(--t-${g.tier})` : 'var(--t-miss)', style: `animation-delay:${400 + i * 220}ms` }, grp);
      if (i === guesses.length - 1) {
        const lbl = el('text', { x: x(i + 1) - 8, y: y(d) + 20, 'text-anchor': 'end', class: 'val', style: 'animation: dot-in 300ms 1.4s both' }, grp);
        lbl.textContent = d + 'm';
      }
    });
    return svg;
  }

  window.Charts = { bars, profile };
})();

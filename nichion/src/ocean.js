// The living background: a low-resolution canvas scaled up with nearest-neighbour
// filtering. World space is in "art pixels"; METRE px per metre of depth.
(function () {
  'use strict';

  const METRE = 3;            // art pixels per metre
  const SKY = 70;             // art pixels of sky above the waterline
  const MAX_DEPTH = 500;      // 5 × 100m
  const FLOOR_M = 512;        // where the sand starts
  const WORLD_H = SKY + (FLOOR_M + 40) * METRE;

  // Depth bands, surface → abyss. Rendered as hard steps with ordered dithering
  // between neighbours, like a limited-palette pixel game.
  const BANDS = [
    [0,   '#8be9ff'], [12,  '#56cdf0'], [35,  '#34aee0'], [65,  '#2390cc'],
    [100, '#1c74b4'], [140, '#195b9a'], [185, '#164781'], [235, '#123668'],
    [290, '#0e2852'], [345, '#0b1d3f'], [400, '#08142f'], [455, '#050d22'], [500, '#030818'],
  ];
  const SKY_BANDS = [[0, '#ffd9a8'], [18, '#ffc1b0'], [36, '#c9b8f0'], [52, '#9fd4ff']];

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  class Ocean {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bg = document.createElement('canvas');
      this.camY = 0; this.camV = 0;
      this.depth = 0;                 // metres the sub is at
      this.subY = this.worldY(-2);    // sub's drawn world-y (smoothed)
      this.mode = 'surface';          // 'surface' | 'dive'
      this.t = 0;
      this.bubbles = []; this.snow = []; this.sparkles = [];
      this.critters = [];
      this.resize();
      addEventListener('resize', () => this.resize());
      this.last = performance.now();
      requestAnimationFrame(ts => this.frame(ts));
    }

    worldY(m) { return SKY + m * METRE; }

    resize() {
      const dpr = 1;
      const vw = innerWidth, vh = innerHeight;
      this.scale = Math.max(2, Math.round(Math.min(vh / 230, vw / 150)));
      this.W = Math.ceil(vw / this.scale);
      this.H = Math.ceil(vh / this.scale);
      this.canvas.width = this.W * dpr;
      this.canvas.height = this.H * dpr;
      this.canvas.style.width = this.W * this.scale + 'px';
      this.canvas.style.height = this.H * this.scale + 'px';
      this.ctx.imageSmoothingEnabled = false;
      this.paintBackground();
      this.populate();
    }

    paintBackground() {
      const W = this.W, H = WORLD_H;
      this.bg.width = W; this.bg.height = H;
      const bctx = this.bg.getContext('2d');
      const img = bctx.createImageData(W, H);
      const d = img.data;
      const sky = SKY_BANDS.map(([y, c]) => [y, hex(c)]);
      const sea = BANDS.map(([m, c]) => [this.worldY(m), hex(c)]);
      const pick = (bands, y) => {
        let i = 0;
        while (i < bands.length - 1 && bands[i + 1][0] <= y) i++;
        const a = bands[i], b = bands[Math.min(i + 1, bands.length - 1)];
        const span = Math.max(1, b[0] - a[0]);
        const f = a === b ? 0 : (y - a[0]) / span;
        return [a[1], b[1], f];
      };
      for (let y = 0; y < H; y++) {
        const [c0, c1, f] = y < SKY ? pick(sky, y) : pick(sea, y);
        // Only dither the last 35% of each band, so bands stay readable as steps.
        const ff = Math.max(0, (f - 0.65) / 0.35);
        for (let x = 0; x < W; x++) {
          const c = ff > BAYER[(y & 3) * 4 + (x & 3)] ? c1 : c0;
          const o = (y * W + x) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);

      // Distant sun on the horizon.
      bctx.fillStyle = '#fff4d6';
      const sx = Math.round(W * 0.78), sy = SKY - 22;
      for (let r = 9; r >= 0; r--) {
        const w = Math.round(Math.sqrt(81 - r * r));
        bctx.fillRect(sx - w, sy - r, w * 2, 1);
        bctx.fillRect(sx - w, sy + r, w * 2, 1);
      }
      // A couple of pixel clouds.
      bctx.fillStyle = '#fff7ee';
      for (const [cx, cy, s] of [[0.18, 14, 1], [0.5, 26, 0.8], [0.9, 10, 0.7]]) {
        const x = Math.round(W * cx), w = Math.round(22 * s);
        bctx.fillRect(x, cy, w, 3); bctx.fillRect(x + 4, cy - 2, w - 10, 2); bctx.fillRect(x + 8, cy - 4, Math.max(3, w - 18), 2);
      }

      // Seafloor: sand, rocks, kelp, a chest.
      const floorY = this.worldY(FLOOR_M);
      const sand = ['#3a3048', '#2c2438', '#463a52'];
      for (let x = 0; x < W; x++) {
        const h = Math.round(3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19 + 1));
        for (let y = floorY + h; y < H; y++) {
          bctx.fillStyle = sand[(x * 7 + y * 3) % 11 === 0 ? 2 : (y - floorY - h) < 2 ? 2 : (x + y) % 9 === 0 ? 1 : 0];
          bctx.fillRect(x, y, 1, 1);
        }
      }
      for (let i = 0; i < Math.ceil(W / 40); i++) {
        const rx = Math.round((i * 47 + 13) % W), ry = floorY - 2;
        bctx.fillStyle = '#1e1a2c';
        bctx.fillRect(rx, ry - 4, 10, 6); bctx.fillRect(rx + 2, ry - 7, 6, 3);
        bctx.fillStyle = '#2d2840'; bctx.fillRect(rx + 2, ry - 6, 3, 2);
      }
      Sprites.draw(bctx, 'chest', Math.round(W * 0.62), floorY - 6);
    }

    populate() {
      const W = this.W;
      this.critters = [];
      const add = (sprite, mMin, mMax, n, speed, extra = {}) => {
        for (let i = 0; i < n; i++) {
          this.critters.push({
            sprite, x: rand(0, W), y: this.worldY(rand(mMin, mMax)), baseY: 0,
            vx: rand(speed * 0.6, speed) * (Math.random() < 0.5 ? -1 : 1),
            phase: rand(0, 6.28), ...extra,
          });
        }
      };
      // Shallow schools.
      for (let s = 0; s < 3; s++) {
        const y = this.worldY(rand(8, 90)), x = rand(0, W), dir = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < 6; i++) {
          this.critters.push({ sprite: 'tinyfish', x: x + i * 7 * -dir + rand(-2, 2), y: y + rand(-6, 6), vx: 9 * dir, phase: i });
        }
      }
      add('smallfish', 20, 160, 4, 7);
      add('schooler', 60, 220, 3, 6);
      add('jelly', 120, 330, 4, 1.5, { jelly: true });
      add('rare', 180, 300, 1, 4);
      add('clever', 240, 360, 1, 2);
      add('deepcut', 300, 490, 3, 3, { glow: true });
      add('jelly', 340, 470, 2, 1, { jelly: true });
      add('plankton', 5, 200, 6, 1, { tiny: true });
      for (const c of this.critters) c.baseY = c.y;

      this.snow = Array.from({ length: Math.round(W * 0.6) }, () => ({ x: rand(0, W), y: rand(SKY, WORLD_H), v: rand(1, 3) }));
    }

    /** Move the sub (and camera) to a depth in metres. */
    setDepth(m, { burst = true } = {}) {
      const prev = this.depth;
      this.depth = Math.max(0, Math.min(MAX_DEPTH, m));
      if (burst && this.depth > prev) this.burst(20);
    }

    setMode(mode) { this.mode = mode; }

    burst(n = 14, color) {
      for (let i = 0; i < n; i++) {
        this.bubbles.push({ x: this.W / 2 + rand(-8, 8), y: this.subY + rand(-4, 8), v: rand(10, 26), r: Math.random() < 0.3 ? 2 : 1, life: rand(1.5, 3) });
      }
    }

    celebrate(color = '#ffcf3f') {
      for (let i = 0; i < 40; i++) {
        const a = rand(0, Math.PI * 2), s = rand(10, 40);
        this.sparkles.push({ x: this.W / 2, y: this.subY + 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1.4), color });
      }
    }

    frame(ts) {
      const dt = Math.min(0.05, (ts - this.last) / 1000);
      this.last = ts;
      this.t += reduce.matches ? dt * 0.2 : dt;
      this.update(dt);
      this.render();
      requestAnimationFrame(t => this.frame(t));
    }

    update(dt) {
      const H = this.H, W = this.W;
      // Sub target: at the waterline on the title screen, otherwise at current depth.
      const target = this.mode === 'surface' ? SKY - 6 : this.worldY(this.depth) - 6;
      const k = reduce.matches ? 1 : Math.min(1, dt * 2.2);
      this.subY += (target - this.subY) * k;
      // Camera keeps the sub around 30% down the screen (higher on short screens).
      const anchor = this.mode === 'surface' ? 0.42 : (H < 260 ? 0.22 : 0.27);
      const camTarget = Math.max(0, Math.min(WORLD_H - H, this.subY - H * anchor));
      this.camY += (camTarget - this.camY) * (reduce.matches ? 1 : Math.min(1, dt * 2.6));

      for (const c of this.critters) {
        c.x += c.vx * dt;
        c.y = c.baseY + Math.sin(this.t * (c.jelly ? 1.2 : 2) + c.phase) * (c.jelly ? 5 : 2);
        const sw = Sprites.SPRITES[c.sprite].w;
        if (c.vx > 0 && c.x > W + 4) c.x = -sw - 4;
        if (c.vx < 0 && c.x < -sw - 4) c.x = W + 4;
      }
      for (const b of this.bubbles) { b.y -= b.v * dt; b.x += Math.sin(this.t * 4 + b.y) * 0.15; b.life -= dt; }
      this.bubbles = this.bubbles.filter(b => b.life > 0 && b.y > SKY);
      // Ambient bubbles from the sub while underwater.
      if (this.mode === 'dive' && Math.random() < dt * 2.5) {
        this.bubbles.push({ x: this.W / 2 + rand(-6, 6), y: this.subY, v: rand(8, 16), r: 1, life: 3 });
      }
      for (const s of this.snow) { s.y += s.v * dt; s.x += Math.sin(this.t + s.y * 0.05) * 0.05; if (s.y > WORLD_H) s.y = SKY; }
      for (const s of this.sparkles) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94; s.life -= dt; }
      this.sparkles = this.sparkles.filter(s => s.life > 0);
    }

    render() {
      const ctx = this.ctx, W = this.W, H = this.H;
      const cy = Math.round(this.camY);
      ctx.drawImage(this.bg, 0, cy, W, H, 0, 0, W, H);

      const sy = y => Math.round(y - cy);
      const visible = (y, h = 20) => y - cy > -h && y - cy < H + h;

      // Light shafts near the surface.
      const shaftFade = 1 - Math.min(1, cy / (METRE * 120));
      if (shaftFade > 0) {
        ctx.save();
        ctx.globalAlpha = 0.10 * shaftFade;
        ctx.fillStyle = '#e8fbff';
        for (let i = 0; i < 5; i++) {
          const x0 = ((i * 53 + this.t * 3) % (W + 80)) - 40;
          const wob = Math.sin(this.t * 0.7 + i) * 4;
          ctx.beginPath();
          ctx.moveTo(x0 + wob, sy(SKY));
          ctx.lineTo(x0 + 10 + wob, sy(SKY));
          ctx.lineTo(x0 + 50, sy(SKY + 220));
          ctx.lineTo(x0 + 26, sy(SKY + 220));
          ctx.fill();
        }
        ctx.restore();
      }

      // Marine snow (more visible deeper).
      ctx.fillStyle = '#cfe8ff';
      for (const s of this.snow) {
        if (!visible(s.y, 2)) continue;
        const deep = (s.y - SKY) / (WORLD_H - SKY);
        if (deep > 0.45 && s.v > 2.6) {
          // Bioluminescent specks that blink in the deep.
          ctx.fillStyle = '#7fe3ff';
          ctx.globalAlpha = Math.max(0, Math.sin(this.t * 2 + s.x)) * 0.9;
          ctx.fillRect(Math.round(s.x), sy(s.y), 1, 1);
          ctx.fillStyle = '#cfe8ff';
          continue;
        }
        ctx.globalAlpha = 0.15 + deep * 0.5;
        ctx.fillRect(Math.round(s.x), sy(s.y), 1, 1);
      }
      ctx.globalAlpha = 1;

      // Critters.
      for (const c of this.critters) {
        if (!visible(c.y, 30)) continue;
        const deep = (c.y - SKY) / (WORLD_H - SKY);
        if (c.glow) {
          // Lure glow first so it sits behind the body.
          const s = Sprites.SPRITES[c.sprite];
          const lx = Math.round(c.x) + (c.vx > 0 ? 9 : s.w - 11), ly = sy(c.y) + 1;
          ctx.globalAlpha = 0.18 + 0.1 * Math.sin(this.t * 3 + c.phase);
          ctx.fillStyle = '#fff3a0';
          ctx.fillRect(lx - 4, ly - 2, 10, 6); ctx.fillRect(lx - 2, ly - 4, 6, 10);
          ctx.globalAlpha = 1;
        }
        Sprites.draw(ctx, c.sprite, c.x, sy(c.y), { flip: c.vx < 0, alpha: c.tiny ? 0.55 : Math.max(0.35, 0.95 - deep * 0.5) });
      }

      // Waterline: animated wave crest.
      const wl = sy(SKY);
      if (wl > -4 && wl < H + 4) {
        for (let x = 0; x < W; x++) {
          const h = Math.round(Math.sin(x * 0.12 + this.t * 2) * 1.5 + Math.sin(x * 0.05 - this.t) * 1);
          ctx.fillStyle = '#e9fbff'; ctx.fillRect(x, wl + h - 1, 1, 1);
          ctx.fillStyle = '#9feaff'; ctx.fillRect(x, wl + h, 1, 2);
        }
      }

      // Depth darkness + sub headlight.
      const subScreenY = sy(this.subY);
      const darkness = Math.min(0.55, Math.max(0, (this.subY - SKY) / (METRE * MAX_DEPTH)) * 0.6);
      if (darkness > 0.02) {
        ctx.fillStyle = `rgba(0,3,12,${darkness})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.depth > 150 && this.mode === 'dive') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Three nested cones = a stepped, pixel-style falloff.
        const a = Math.min(0.07, (this.depth - 150) / 1800);
        ctx.fillStyle = '#fff2a8';
        for (const [len, spread] of [[56, 22], [40, 15], [24, 9]]) {
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.moveTo(W / 2 + 8, subScreenY + 1);
          ctx.lineTo(W / 2 + 8 + len, subScreenY + 1 + spread);
          ctx.lineTo(W / 2 + 8 + len, subScreenY + 1 - spread * 0.7);
          ctx.fill();
        }
        ctx.restore();
      }

      // Bubbles.
      for (const b of this.bubbles) {
        const y = sy(b.y);
        ctx.globalAlpha = Math.min(1, b.life);
        ctx.fillStyle = '#d6f8ff';
        if (b.r === 1) ctx.fillRect(Math.round(b.x), y, 1, 1);
        else { ctx.fillRect(Math.round(b.x), y, 2, 1); ctx.fillRect(Math.round(b.x) - 1, y + 1, 1, 1); ctx.fillRect(Math.round(b.x) + 2, y + 1, 1, 1); ctx.fillRect(Math.round(b.x), y + 2, 2, 1); }
      }
      ctx.globalAlpha = 1;

      // The sub, with a little bob and a tether line to the surface.
      const bob = Math.round(Math.sin(this.t * 2.2) * 1.5);
      const sxp = Math.round(W / 2 - 8);
      if (this.mode === 'dive') {
        ctx.fillStyle = 'rgba(220,240,255,0.35)';
        for (let y = Math.max(0, wl); y < subScreenY + bob; y += 3) ctx.fillRect(Math.round(W / 2), y, 1, 2);
      }
      Sprites.draw(ctx, 'sub', sxp, subScreenY - 6 + bob);

      for (const s of this.sparkles) {
        ctx.globalAlpha = Math.min(1, s.life * 1.5);
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(s.x), sy(s.y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  window.Ocean = Ocean;
  window.Ocean.MAX_DEPTH = MAX_DEPTH;
})();

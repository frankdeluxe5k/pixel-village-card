// Sky colours, tints, clouds and cached glow sprites.
import { hexToRgb } from '../core/color.js';
import { mulberry32 } from '../core/math.js';
import { mk } from '../core/pixels.js';

// Final sky colours, and the light tint multiplied over the world for each phase.
export const SKY = {
  day:   ['#3f84d8', '#aedcf6'],
  dawn:  ['#4a5aa8', '#ffc08a'],
  dusk:  ['#3a3278', '#ff8a5c'],
  night: ['#0a1030', '#26326c'],
};
export const TINT = { day: null, dawn: '#f4d4c8', dusk: '#dca8b4', night: '#5262a8' };
export const OVERCAST_TINT = '#bcc2cc';

// Puffy cumulus: a row of overlapping domes on a flat base, lit from the upper left
// and shaded in clean bands (no dithering) for a smooth look.
export function makeCloud(w, seed, pal) {
  const rnd = mulberry32(seed);
  const n = 3 + Math.round(w / 22), cl = [];
  let maxR = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, r = w * (0.17 + rnd() * 0.07) * (1.15 - Math.abs(u - 0.5) * 1.1);
    cl.push({ x: 2 + u * w, r });
    maxR = Math.max(maxR, r);
  }
  const h = Math.round(maxR * 1.6) + 6, cw = Math.round(w + maxR) + 4, base = h - 3, ox = Math.round(maxR / 2);
  for (const k of cl) { k.x += ox; k.y = base - k.r * (0.55 + rnd() * 0.3); }
  const c = mk(cw, h), g = c.getContext('2d'), im = g.createImageData(cw, h), d = im.data;
  const cols = pal.map(hexToRgb);
  for (let y = 0; y <= base; y++) {
    for (let x = 0; x < cw; x++) {
      let v = -1, edge = false;
      for (const k of cl) {
        const nx = (x - k.x) / k.r, ny = (y - k.y) / k.r, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const vv = 0.62 - 0.5 * (nx * 0.45 + ny * 0.9) - d2 * 0.12;
        if (vv > v) { v = vv; edge = d2 > 0.8 && ny > 0.3; }
      }
      if (v < 0) continue;
      const fromBase = base - y;
      let lvl = v > 0.86 ? 3 : v > 0.56 ? 2 : v > 0.3 ? 1 : 0;
      if (fromBase < 3) lvl = 0;
      else if (fromBase < 6) lvl = Math.min(lvl, 1);
      if (edge && lvl > 1) lvl = 1;
      const col = cols[lvl], i = (y * cw + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Soft radial glows, drawn once per (radius, colour) and stamped with globalAlpha.
export const glowCache = new Map();
export function glowSprite(r, rgb) {
  let m = glowCache.get(rgb); // by colour, then radius: no key string per call
  if (!m) glowCache.set(rgb, (m = new Map()));
  let c = m.get(r);
  if (!c) {
    c = mk(r * 2, r * 2);
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    m.set(r, c);
  }
  return c;
}

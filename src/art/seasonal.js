// Seasonal props: raked leaf piles in fall and the kids' snowman.
import { hash2 } from '../core/noise.js';
import { P, ellipse, line, mk, outline } from '../core/pixels.js';

// A raked pile of fall leaves, n = 1..3 (bigger each time someone rakes).
export function makeLeafPile(n, seed) {
  const rx = 4 + n * 3, ry = 1 + n * 1.5, w = rx * 2 + 6, h = Math.ceil(ry * 2) + 5, c = mk(w, h), g = c.getContext('2d');
  const cx = w >> 1, by = h - 3, cols = ['#5a2a10', '#8a4a18', '#a86a14', '#c0501c', '#d8a020', '#ecc038'];
  for (let y = Math.floor(by - ry * 2); y <= by; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - by) / (ry * 2), d = nx * nx + ny * ny + (hash2(x, y, seed + 5) - 0.5) * 0.35;
      if (ny > 0 || d > 1) continue;
      const lit = 0.55 - nx * 0.35 - ny * 0.25 - (d > 0.7 ? 0.25 : 0) + (hash2(y, x, seed + 9) - 0.5) * 0.7;
      P(g, x, y, 1, 1, cols[Math.max(0, Math.min(5, Math.floor(lit * 6)))]);
    }
  }
  for (let k = 0; k < n * 4; k++) P(g, cx + Math.round((hash2(k, 1, seed) - 0.5) * rx * 2.6), by + 1 - Math.round(hash2(k, 2, seed) * 2), 1, 1, cols[2 + (k % 3)]); // strays
  outline(c, '#4a2410');
  return { cv: c, ax: cx, by };
}

// The kids' snowman: base, then body, then a head with coal eyes, a carrot nose, stick arms and a scarf.
export function makeSnowman(n) {
  const c = mk(30, 34), g = c.getContext('2d'), cx = 15, by = 31;
  const ball = (y, r) => {
    ellipse(g, cx, y, r, r * 0.9, '#a8b8d4'); ellipse(g, cx - 1, y - 1, r - 1, r * 0.9 - 1, '#dce6f4');
    ellipse(g, cx - 2, y - 2, Math.max(1, r - 3), Math.max(1, r * 0.9 - 3), '#ffffff');
  };
  ball(by - 6, 7);
  if (n >= 2) ball(by - 16, 5);
  if (n >= 3) {
    line(g, cx - 5, by - 17, cx - 11, by - 22, '#5a3a22', 1); line(g, cx + 5, by - 17, cx + 10, by - 21, '#5a3a22', 1);
    P(g, cx - 12, by - 23, 1, 1, '#5a3a22'); P(g, cx + 10, by - 22, 1, 1, '#5a3a22');
    ball(by - 24, 3.6);
    P(g, cx - 5, by - 21, 10, 2, '#c83a3a'); P(g, cx + 2, by - 19, 2, 4, '#c83a3a'); P(g, cx - 5, by - 21, 10, 1, '#e86a5a');
    P(g, cx - 2, by - 26, 1, 1, '#22222a'); P(g, cx + 1, by - 26, 1, 1, '#22222a');
    P(g, cx, by - 25, 3, 1, '#f08a28');
    for (const y of [by - 15, by - 12]) P(g, cx, y, 1, 1, '#22222a');
  }
  outline(c, '#5a6a8a');
  return { cv: c, ax: cx, by };
}

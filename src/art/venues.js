// Amphitheater, screen and film, café, back farm.
import { drawText } from './text.js';
import { mixHex, ramp } from '../core/color.js';
import { RH } from '../core/constants.js';
import { mulberry32 } from '../core/math.js';
import { bayer, hash2 } from '../core/noise.js';
import { P, disc, ellipse, line, mk, outline, tpl } from '../core/pixels.js';
import { AMPHI, CART, FARM, PATIO, SCREEN_Q, stairY } from '../world/layout.js';

/* ---------- amphitheater ---------- */

// Low grassy terraces with fieldstone faces and log benches, painted straight onto the
// ground (no outline) so they sit in the meadow rather than on top of it.
export function drawAmphitheater(g, snow) {
  const st = ramp('#8e8a84'), bark = ramp('#6a4428'), wood = ramp('#c09060');
  const turf = snow ? ['#d4e0ee', '#e8f0f8', '#ffffff'] : ['#5a9e40', '#70b44c', '#88c85c'];
  const stamps = [];
  AMPHI.tiers.forEach((rx, t) => {
    const ry = rx * AMPHI.squash;
    for (let a = AMPHI.a0; a <= AMPHI.a1; a += 1.5) {
      const r = (a * Math.PI) / 180;
      stamps.push({ x: Math.round(AMPHI.x + rx * Math.cos(r)), y: Math.round(AMPHI.y + ry * Math.sin(r)), i: stamps.length });
    }
  });
  stamps.sort((p, q) => p.y - q.y);
  for (const { x, y } of stamps) {
    for (let yy = y - 10; y - yy > 5; yy++) for (let xx = x - 3; xx <= x + 3; xx++) P(g, xx, yy, 1, 1, turf[(xx + yy) % 3 ? 1 : (yy < y - 8 ? 2 : 0)]);
    P(g, x - 3, y - 5, 7, 5, st.m); P(g, x - 3, y - 5, 7, 1, st.l); P(g, x - 3, y - 1, 7, 1, st.d);
    if ((x + y) % 5 === 0) P(g, x, y - 4, 1, 3, st.d);
  }
  for (const { x, y, i } of stamps) {
    if (i % 7 === 0) continue;
    P(g, x - 3, y - 9, 7, 2, bark.m); P(g, x - 3, y - 9, 7, 1, wood.m);
    if (snow) P(g, x - 3, y - 10, 7, 1, '#ffffff');
  }
  const tuft = snow ? ['#b8c8dc', '#ffffff'] : ['#3a7a2c', '#9ad86a'];
  for (const { x, y, i } of stamps) {
    if (i % 4) continue;
    tpl(g, ['.l.l.', 'lmlml'], x - 2, y - 2, { l: tuft[1], m: tuft[0] });
  }
  for (const [lx, ly] of amphiLanterns()) {
    P(g, lx - 1, ly + 3, 2, 14, bark.m); P(g, lx - 1, ly + 3, 1, 14, bark.l);
    P(g, lx - 1, ly - 1, 5, 2, bark.d);
    P(g, lx + 1, ly + 2, 4, 5, '#2a2a34'); P(g, lx + 2, ly + 3, 2, 3, '#a08048');
  }
}

export function amphiLanterns() {
  return [AMPHI.a0 - 7, AMPHI.a1 + 5].map((deg) => {
    const t = (deg * Math.PI) / 180, rx = AMPHI.tiers[AMPHI.tiers.length - 1] + 4;
    return [Math.round(AMPHI.x + rx * Math.cos(t)), Math.round(AMPHI.y + rx * AMPHI.squash * Math.sin(t)) - 17];
  });
}
export const AMPHI_LANTERNS = amphiLanterns();

// Rustic screen at the left of the scene: a slanted panel turned toward the seats, on a low deck.
// All diagonals follow stairY so the pixel steps are even.
export function makeStage(snow) {
  const ox = -8, oy = 262, c = mk(84, 100), g = c.getContext('2d'), Q = SCREEN_Q;
  const X = (x) => x - ox, Y = (y) => y - oy;
  const bark = ramp('#6a4428'), plank = ramp('#9a7a58'), deck = ramp('#a88a64'), st = ramp('#8a8680'), roof = ramp('#8a5a34');
  const topAt = (x) => stairY(x, Q.ltop), botAt = (x) => stairY(x, Q.lbot);
  // deck: a parallelogram whose back edge runs under the panel and whose sides step forward 2:1
  const x0 = Q.lx - 6, x1 = Q.rx + 6, depth = 10, back = (x) => stairY(x, Q.lbot + 3);
  for (let x = x0; x <= x1 + depth; x++) {
    const top = x <= x1 ? back(x) : back(x1) + Math.floor((x - x1) / 2);
    const bot = x >= x0 + depth ? back(x - depth) + depth / 2 : back(x0) + Math.floor((x - x0) / 2);
    if (bot <= top) continue;
    P(g, X(x), Y(top), 1, bot - top, snow ? '#e8eef6' : deck.l);
    for (let k = 1; k < 3; k++) { const y = top + Math.round(((bot - top) * k) / 3); P(g, X(x), Y(y), 1, 1, deck.m); }
    // front face and fieldstone footing below the front edge
    if (x >= x0 + depth - 1 || x === x0) {
      P(g, X(x), Y(bot), 1, 3, deck.d);
      P(g, X(x), Y(bot + 3), 1, 4, (x + Math.floor(bot / 1)) % 7 === 0 ? st.d : st.m);
      P(g, X(x), Y(bot + 3), 1, 1, st.l);
    }
    if (x > x1) { P(g, X(x), Y(bot), 1, 3, st.d); P(g, X(x), Y(bot + 3), 1, 4, st.o); }
  }
  // plank backing inside the panel
  for (let x = Q.lx; x <= Q.rx; x++) {
    const t = topAt(x), b = botAt(x);
    P(g, X(x), Y(t), 1, b - t, x % 4 === 0 ? plank.d : x % 4 === 1 ? plank.l : plank.m);
    if ((x - Q.lx) % 10 === 4) P(g, X(x), Y(t + 22), 3, 1, plank.o);
  }
  // posts: the far one behind, the near one in front wrapped in ivy
  P(g, X(Q.rx + 1), Y(Q.rtop - 6), 3, Q.rbot - Q.rtop + 10, bark.m); P(g, X(Q.rx + 3), Y(Q.rtop - 6), 1, Q.rbot - Q.rtop + 10, bark.d);
  P(g, X(Q.lx - 4), Y(Q.ltop - 7), 4, Q.lbot - Q.ltop + 11, bark.m); P(g, X(Q.lx - 4), Y(Q.ltop - 7), 1, Q.lbot - Q.ltop + 11, bark.l);
  for (let y = Q.ltop - 3; y < Q.lbot; y += 6) P(g, X(Q.lx - 3 + ((y >> 2) % 2)), Y(y), 1, 3, bark.o);
  if (!snow) for (let y = Q.ltop + 18; y < Q.lbot + 2; y += 3) P(g, X(Q.lx - 3 + Math.round(Math.sin(y * 0.5))), Y(y), 2, 2, y % 2 ? '#3a8a3a' : '#5aaa48');
  // log beam with a shingled cap, stepping exactly with the panel
  for (let x = Q.lx - 6; x <= Q.rx + 5; x++) {
    const y = topAt(x) - 3;
    P(g, X(x), Y(y), 1, 3, bark.m); P(g, X(x), Y(y), 1, 1, bark.l); P(g, X(x), Y(y + 2), 1, 1, bark.d);
    for (let k = 1; k <= 4; k++) {
      const col = snow && k > 2 ? '#f4f8ff' : k === 4 ? roof.l : (Math.floor((x - Q.lx) / 6) + k) % 2 && (x - Q.lx) % 6 === 0 ? roof.o : roof.m;
      P(g, X(x), Y(y - k), 1, 1, col);
    }
  }
  P(g, X(Q.lx - 7), Y(topAt(Q.lx - 7) - 3), 2, 3, '#d8b07a');
  // the rolled-up canvas under the beam
  for (let x = Q.lx; x <= Q.rx; x++) { const y = topAt(x); P(g, X(x), Y(y), 1, 1, '#f8f2e2'); P(g, X(x), Y(y + 1), 1, 1, '#d8ccb0'); }
  if (!snow) {
    const fx = Q.rx + 4, fy = back(Q.rx + 4) + 2;
    P(g, X(fx), Y(fy - 4), 6, 4, '#a85a3a'); P(g, X(fx), Y(fy - 4), 6, 1, '#c87a52');
    tpl(g, ['g.g.g', '.ggg.', 'gGgGg'], X(fx), Y(fy - 7), { g: '#3a8a3a', G: '#6ac050' });
  }
  if (!snow) {
    const px = x0 + depth - 3, py = back(x0) + depth / 2;
    P(g, X(px), Y(py - 6), 7, 5, '#b0603e'); P(g, X(px), Y(py - 6), 7, 1, '#c87a52');
    for (let k = 0; k < 4; k++) P(g, X(px + k * 2), Y(py - 9 + (k % 2)), 2, 2, k % 2 ? '#f0d040' : '#e85a6a');
  }
  outline(c);
  return { cv: c, x: ox, y: oy };
}

export function drawBackFarm(g, snow, season) {
  const CAB = ['.ggg.', 'gGHGg', 'gGGGd', '.ddd.'];
  const CAR = ['H.H', '.g.', '.o.'];
  for (let k = 0; k < 5; k++) {
    const yb = FARM.y0 + 6 * k + 3;
    for (let cx = FARM.x0 + 4 + (k % 2) * 4; cx < FARM.x1 - 3; cx += 8) {
      if (snow) { P(g, cx - 2, yb - 1, 4, 1, '#ffffff'); continue; }
      if (k === 0) {
        P(g, cx, yb - 9, 1, 9, '#3a8a30'); P(g, cx + 1, yb - 5, 2, 1, '#5aaa40');
        P(g, cx - 1, yb - 12, 3, 3, '#f8c830'); P(g, cx, yb - 11, 1, 1, '#7a4a20'); P(g, cx - 2, yb - 11, 1, 1, '#f8c830'); P(g, cx + 2, yb - 11, 1, 1, '#f8c830');
      } else if (k % 2) tpl(g, CAB, cx - 2, yb - 3, { G: '#5cb040', H: '#b0e878', g: '#3a8030', d: '#265a24' });
      else tpl(g, CAR, cx - 1, yb - 2, { H: '#8ad860', g: '#3a8a30', o: '#e07a28' });
    }
  }
}

export function drawBackFence(g, snow) {
  const wd = ramp('#8a6038'), y = FARM.y1 + 2;
  for (const ry of [y, y + 3]) { P(g, FARM.x0 - 2, ry, FARM.x1 - FARM.x0 + 4, 1, wd.m); }
  for (let x = FARM.x0 - 2; x <= FARM.x1 + 2; x += 9) { P(g, x, y - 3, 2, 8, wd.m); P(g, x, y - 3, 1, 8, wd.l); if (snow) P(g, x, y - 4, 2, 1, '#ffffff'); }
}

export function drawScarecrow(g, x, by, snow) {
  P(g, x - 1, by - 22, 2, 22, '#7a5030');
  P(g, x - 8, by - 17, 16, 2, '#7a5030');
  P(g, x - 4, by - 18, 8, 8, '#c04a3a'); P(g, x - 4, by - 18, 2, 8, '#d86a5a'); P(g, x - 2, by - 14, 2, 2, '#e0b040');
  P(g, x - 10, by - 17, 2, 3, '#e8d070'); P(g, x + 8, by - 17, 2, 3, '#e8d070');
  disc(g, x, by - 22, 3, '#d8c090'); P(g, x - 1, by - 23, 1, 1, '#3a2418'); P(g, x + 1, by - 23, 1, 1, '#3a2418');
  P(g, x - 5, by - 25, 11, 2, '#e0bc5c'); P(g, x - 3, by - 28, 7, 3, '#e0bc5c'); P(g, x - 3, by - 26, 7, 1, '#c83a2a');
  if (snow) P(g, x - 5, by - 29, 11, 2, '#ffffff');
}

/* ---------- café ---------- */

// Terracotta brick patio under the café tables.
export function drawPatio(g, snow) {
  const { x0, x1, y0 } = PATIO;
  const br = [ramp(snow ? '#c8b4b0' : '#b0603e'), ramp(snow ? '#d0bcb8' : '#c0704a'), ramp(snow ? '#c4aca4' : '#a4583a')];
  const mortar = snow ? '#e8eef6' : '#7a5a44';
  P(g, x0, y0, x1 - x0, RH - y0, mortar);
  for (let y = y0 + 1, row = 0; y < RH; y += 4, row++) {
    for (let x = x0 - (row % 2) * 4; x < x1; x += 8) {
      const a = Math.max(x, x0), b = Math.min(x + 7, x1);
      const r = br[Math.floor(hash2(x, row, 61) * 3)];
      if (b - a < 2) continue;
      P(g, a, y, b - a, 3, r.m); P(g, a, y, b - a, 1, r.l); P(g, b - 1, y + 1, 1, 2, r.d);
    }
  }
  P(g, x0 - 2, y0 - 2, x1 - x0 + 4, 2, snow ? '#ffffff' : '#8a8690');
  P(g, x0 - 2, y0 - 2, 2, RH - y0 + 2, snow ? '#ffffff' : '#8a8690');
  P(g, x1, y0 - 2, 2, RH - y0 + 2, snow ? '#ffffff' : '#8a8690');
}

export function drawCoffeeCart(g, snow) {
  const { x, by } = CART, wd = ramp('#8a5a30'), body = ramp('#f0e2c0'), trim = ramp('#2f8a8a'), chrome = ramp('#a8b0bc');
  // awning poles and striped scalloped awning
  P(g, x - 21, by - 46, 2, 30, '#5a5a66'); P(g, x + 19, by - 46, 2, 30, '#5a5a66');
  for (let r = 0; r < 8; r++) {
    for (let i = x - 26; i < x + 26; i++) {
      const stripe = Math.floor((i - x + 26) / 5) % 2;
      P(g, i, by - 54 + r, 1, 1, stripe ? (r < 2 ? '#fff8ec' : '#f0e6d6') : (r < 2 ? '#e86a5a' : '#d04a40'));
    }
  }
  for (let i = 0; i < 10; i++) {
    const sx = x - 26 + i * 5 + 2, col = i % 2 ? '#f0e6d6' : '#d04a40';
    P(g, sx - 2, by - 46, 5, 1, col); P(g, sx - 1, by - 45, 3, 1, col);
  }
  P(g, x - 27, by - 55, 54, 1, '#5a3a30');
  // espresso machine, cups and a bean jar on the counter
  P(g, x - 4, by - 33, 11, 9, chrome.m); P(g, x - 4, by - 33, 11, 1, chrome.h); P(g, x + 6, by - 33, 1, 9, chrome.d);
  P(g, x - 2, by - 30, 2, 2, '#e04040'); P(g, x + 2, by - 30, 2, 2, '#40c070'); P(g, x, by - 27, 3, 2, '#3a3a46');
  P(g, x - 14, by - 27, 3, 3, '#ffffff'); P(g, x - 10, by - 27, 3, 3, '#ffffff'); P(g, x - 12, by - 30, 3, 3, '#ffffff');
  P(g, x + 11, by - 30, 5, 6, '#c8e4f0'); P(g, x + 12, by - 27, 3, 3, '#6a3a1a'); P(g, x + 11, by - 31, 5, 1, '#8a5a30');
  // counter and cart body
  P(g, x - 24, by - 24, 48, 3, wd.l); P(g, x - 24, by - 22, 48, 1, wd.d);
  P(g, x - 22, by - 21, 44, 14, body.m); P(g, x - 22, by - 21, 44, 1, body.h); P(g, x + 19, by - 21, 3, 14, body.d);
  P(g, x - 22, by - 9, 44, 2, trim.m); P(g, x - 22, by - 19, 44, 1, trim.l);
  // coffee cup emblem
  P(g, x - 4, by - 17, 7, 5, '#6a3a1a'); P(g, x + 3, by - 16, 2, 3, '#6a3a1a'); P(g, x - 5, by - 12, 9, 1, '#6a3a1a');
  P(g, x - 3, by - 20, 1, 2, '#c8b8a0'); P(g, x, by - 21, 1, 3, '#c8b8a0');
  // spoked wheels
  for (const wx of [x - 13, x + 13]) {
    disc(g, wx, by - 5, 5, wd.o); disc(g, wx, by - 5, 4, wd.m); disc(g, wx, by - 5, 2, wd.d);
    P(g, wx - 4, by - 5, 9, 1, wd.l); P(g, wx, by - 9, 1, 9, wd.l); P(g, wx, by - 5, 1, 1, '#3a3a46');
  }
  if (snow) P(g, x - 27, by - 57, 54, 2, '#ffffff');
}

export function drawMenuBoard(g, x, by, snow) {
  const wd = ramp('#8a5a30');
  line(g, x - 6, by, x - 3, by - 16, wd.m, 2); line(g, x + 6, by, x + 3, by - 16, wd.d, 2);
  P(g, x - 5, by - 15, 11, 12, wd.m); P(g, x - 4, by - 14, 9, 10, '#2a4a3a');
  P(g, x - 3, by - 13, 6, 1, '#f0f0e0'); P(g, x - 3, by - 11, 4, 1, '#e8d080'); P(g, x - 3, by - 9, 7, 1, '#f0f0e0'); P(g, x - 3, by - 7, 5, 1, '#f0a0a0');
  if (snow) P(g, x - 5, by - 16, 11, 1, '#ffffff');
}

export function drawStool(g, x, y) {
  P(g, x - 3, y - 5, 7, 2, '#c04a3a'); P(g, x - 3, y - 5, 7, 1, '#e06a5a');
  line(g, x - 2, y - 3, x - 3, y, '#3a3a46'); line(g, x + 2, y - 3, x + 3, y, '#3a3a46');
}

// Bistro table under a striped umbrella; drawn in front of the people sitting at it.
export function makeCafeTable(color) {
  const c = mk(42, 52), g = c.getContext('2d'), ax = 21, by = 49, st = ramp(color);
  P(g, ax - 1, by - 42, 2, 34, '#8a8e98'); P(g, ax - 1, by - 42, 1, 34, '#c8ccd4');
  for (let r = 0; r < 8; r++) {
    const half = 6 + Math.round(r * 1.9);
    for (let x = -half; x <= half; x++) {
      const seg = Math.floor(((x / half) + 1) * 3) % 2;
      const shade = x > half * 0.4 ? 'd' : r < 2 ? 'l' : 'm';
      P(g, ax + x, by - 46 + r, 1, 1, seg ? (shade === 'd' ? '#d8d0c4' : '#fbf6ee') : st[shade]);
    }
  }
  for (let i = 0; i < 6; i++) {
    const sx = ax - 18 + i * 6 + 3, col = i % 2 ? '#fbf6ee' : st.m;
    P(g, sx - 3, by - 38, 6, 1, col); P(g, sx - 2, by - 37, 4, 1, col);
  }
  P(g, ax - 1, by - 48, 2, 2, '#8a8e98');
  P(g, ax - 1, by - 8, 2, 7, '#3a3a46');
  ellipse(g, ax, by - 1, 4, 1, '#3a3a46');
  ellipse(g, ax, by - 9, 9, 2, '#d8d2c8'); ellipse(g, ax, by - 10, 9, 1, '#f6f2ea');
  outline(c);
  return { cv: c, ax, by };
}

// The "BACK SOON!" card hung on the amphitheater screen while everyone's away. It's exactly the screen's
// size (one card column per screen column), so the letters slant with the screen without losing pixels.
export const SIGN_W = SCREEN_Q.rx - SCREEN_Q.lx - 3, SIGN_H = SCREEN_Q.lbot - SCREEN_Q.ltop - 8;
export function makeSignCard() {
  const c = mk(SIGN_W, SIGN_H), g = c.getContext('2d'), pa = ramp('#efe2c2'), w = SIGN_W, h = SIGN_H;
  P(g, 2, 3, w - 4, h - 6, pa.m); P(g, 2, 3, w - 4, 1, pa.h); P(g, 2, h - 4, w - 4, 1, pa.d);
  P(g, 2, 3, 1, h - 6, pa.l); P(g, w - 3, 3, 1, h - 6, pa.d);
  P(g, 4, 2, 5, 3, '#d8cc9c'); P(g, w - 9, 2, 5, 3, '#d8cc9c'); // tape
  drawText(g, 'BACK', (w - 23) >> 1, 8, '#5a2410');
  drawText(g, 'SOON!', (w - 26) >> 1, 19, '#5a2410');
  return { cv: c };
}

export const FILM_W = 44, FILM_H = 36;
export function makeFilmBg(sc) {
  const c = mk(FILM_W, FILM_H), g = c.getContext('2d');
  const grad = (y0, y1, a, b) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < FILM_W; x++) {
        const f = ((y - y0) / (y1 - y0)) * 5, band = Math.floor(f) + (f % 1 > bayer(x, y) ? 1 : 0);
        P(g, x, y, 1, 1, mixHex(a, b, Math.min(1, band / 5)));
      }
    }
  };
  if (sc === 0) {
    grad(0, FILM_H, '#080a24', '#2a1a5a');
    const rnd = mulberry32(3);
    for (let i = 0; i < 18; i++) P(g, Math.floor(rnd() * FILM_W), Math.floor(rnd() * FILM_H), 1, 1, rnd() < 0.3 ? '#ffffff' : '#9aa0d0');
    disc(g, 33, 10, 6, '#d8784a'); disc(g, 31, 8, 3, '#f0a070'); P(g, 35, 13, 3, 2, '#a85030');
    line(g, 24, 13, 42, 7, '#f0d0a0', 1);
  } else if (sc === 1) {
    grad(0, 24, '#f88a50', '#ffe0a0');
    disc(g, 30, 15, 5, '#fff4c0');
    for (const [x0, w, h] of [[2, 12, 9], [18, 8, 6], [34, 10, 8]]) { P(g, x0, 24 - h, w, h, '#8a3a2a'); P(g, x0, 24 - h, w, 1, '#c86a40'); }
    P(g, 0, 24, FILM_W, 12, '#d89048'); P(g, 0, 24, FILM_W, 1, '#f0b060');
    for (let x = 2; x < FILM_W; x += 7) P(g, x, 29 + (x % 3), 3, 1, '#b8702c');
    P(g, 6, 18, 2, 8, '#3a8a4a'); P(g, 4, 20, 2, 3, '#3a8a4a'); P(g, 8, 19, 2, 3, '#3a8a4a'); P(g, 6, 18, 1, 8, '#5aaa5a');
  } else {
    grad(0, 24, '#c04a6a', '#ffc890');
    disc(g, 22, 24, 7, '#fff0b0');
    P(g, 0, 24, FILM_W, 12, '#3a4a90');
    for (let y = 25; y < FILM_H; y += 2) P(g, 18 + ((y * 3) % 5), y, 8 - (y - 25) / 2, 1, '#f0c0a0');
  }
  return c;
}

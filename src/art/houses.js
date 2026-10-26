// The log-cabin chalets.
import { drawBarrel, drawCrate } from './props.js';
import { ramp } from '../core/color.js';
import { mulberry32 } from '../core/math.js';
import { hash2, vnoise } from '../core/noise.js';
import { P, ellipse, line, mk, outline } from '../core/pixels.js';

export function drawHouse(g, h, snow) {
  const { X, Wd, top, bot, ridge } = h.g;
  const roof = ramp(h.roof), logs = ramp(h.logs), beam = ramp('#5a3a22'), cream = ramp('#e8dcc0');
  const mortar = '#3a3440', rnd = mulberry32(h.x * 7 + 3);
  const stones = ['#8c8894', '#968c82', '#7e8696', '#a09a92'].map(ramp);
  const stoneTop = bot - (h.tavern ? 12 : 11);

  // log-cabin upper floor
  for (let y = top + 2; y < stoneTop; y++) {
    const r = (y - top - 2) % 5;
    P(g, X, y, Wd, 1, r === 4 ? logs.o : r === 0 ? logs.l : r === 3 ? logs.d : logs.m);
  }
  for (let i = 0; i < Wd * 0.6; i++) {
    const y = top + 3 + Math.floor(rnd() * (stoneTop - top - 4));
    if ((y - top - 2) % 5 === 4) continue;
    P(g, X + Math.floor(rnd() * Wd), y, 2 + Math.floor(rnd() * 5), 1, rnd() < 0.7 ? logs.d : logs.h);
  }
  // cross-notched log ends poking out at the corners
  for (let y = top + 2; y < stoneTop - 2; y += 5) {
    for (const cx of [X - 3, X + Wd - 1]) {
      P(g, cx, y, 4, 4, logs.m); P(g, cx, y, 4, 1, logs.h); P(g, cx + 1, y + 1, 2, 2, logs.l);
      P(g, cx + 2, y + 2, 1, 1, logs.d); P(g, cx, y + 4, 4, 1, logs.o);
    }
  }
  // shadow under the deep eaves, with rafter ends
  P(g, X, top + 2, Wd, 4, logs.o);
  for (let x = X - 9; x < X + Wd + 8; x += 8) { P(g, x, top + 2, 3, 3, beam.m); P(g, x, top + 2, 3, 1, beam.l); P(g, x + 2, top + 3, 1, 2, beam.o); }

  // rubble-stone ground floor
  P(g, X - 2, stoneTop, Wd + 4, bot - stoneTop, mortar);
  for (let y = stoneTop + 2, row = 0; y < bot - 1; row++) {
    const hh = Math.min(4 + Math.floor(rnd() * 3), bot - 1 - y);
    for (let x = X - 2 - (row % 2) * 4; x < X + Wd + 2;) {
      const sw = 6 + Math.floor(rnd() * 7), st = stones[Math.floor(rnd() * stones.length)];
      const x0 = Math.max(x, X - 2), x1 = Math.min(x + sw - 1, X + Wd + 2);
      if (x1 - x0 >= 2 && hh >= 2) {
        P(g, x0, y, x1 - x0, hh - 1, st.m);
        P(g, x0, y, x1 - x0, 1, st.l); P(g, x0, y, 1, hh - 1, st.l);
        P(g, x1 - 1, y + 1, 1, hh - 2, st.d); P(g, x0 + 1, y + hh - 2, x1 - x0 - 1, 1, st.d);
        if (rnd() < 0.35) P(g, x0 + 2, y + 1, 1, 1, st.h);
      }
      x += sw;
    }
    y += hh;
  }
  P(g, X - 4, stoneTop - 1, Wd + 8, 3, beam.m); P(g, X - 4, stoneTop - 1, Wd + 8, 1, beam.l); P(g, X - 4, stoneTop + 1, Wd + 8, 1, beam.o);

  // windows: cream frames, carved headers, heart shutters, geranium boxes
  for (const [gx, gy] of h.glass) {
    for (const [sx, edge] of [[gx - 6, gx - 3], [gx + 11, gx + 11]]) {
      P(g, sx, gy - 2, 4, 13, roof.m); P(g, sx, gy - 2, 4, 1, roof.l); P(g, sx, gy + 10, 4, 1, roof.d);
      for (let k = 0; k < 4; k++) P(g, sx + k, gy + 4 + k, 1, 1, roof.l);
      P(g, sx + 1, gy + 1, 2, 1, roof.o); P(g, sx + 1, gy + 2, 2, 1, roof.o); P(g, sx + 1, gy + 3, 1, 1, roof.o);
      P(g, edge, gy - 2, 1, 13, roof.o);
    }
    P(g, gx - 2, gy - 2, 13, 13, cream.m); P(g, gx - 2, gy - 2, 13, 1, cream.h); P(g, gx - 2, gy - 2, 1, 13, cream.l);
    P(g, gx + 10, gy - 1, 1, 12, cream.d); P(g, gx - 2, gy + 10, 13, 1, cream.d);
    P(g, gx - 4, gy - 5, 17, 2, beam.m); P(g, gx - 4, gy - 5, 17, 1, beam.l);
    P(g, gx + 1, gy - 7, 7, 2, beam.m); P(g, gx + 3, gy - 8, 3, 1, beam.l);
    P(g, gx, gy, 9, 9, '#1e2a50'); P(g, gx, gy, 9, 2, '#2a3a68');
    for (let i = 0; i < 4; i++) P(g, gx + 1 + i, gy + 6 - i, 1, 1, '#6a8ac8');
    P(g, gx + 6, gy + 1, 1, 1, '#9ab4e0');
    P(g, gx + 4, gy, 1, 9, cream.d); P(g, gx, gy + 4, 9, 1, cream.d);
    if (snow) { P(g, gx - 4, gy - 7, 17, 2, '#ffffff'); P(g, gx - 3, gy + 10, 15, 2, '#ffffff'); continue; }
    if (h.tavern) continue;
    P(g, gx - 3, gy + 11, 15, 3, '#7a4a28'); P(g, gx - 3, gy + 11, 15, 1, '#9a6a3a'); P(g, gx - 3, gy + 13, 15, 1, '#4a2a18');
    for (let i = 0; i < 7; i++) {
      P(g, gx - 2 + i * 2, gy + 9 + (i % 2), 2, 2, i % 3 === 2 ? '#f080a0' : '#e03040');
      if (i % 2 === 0) P(g, gx - 2 + i * 2, gy + 11, 1, 1, '#3a8a3a');
    }
  }

  // arched stone doorway with a Z-braced plank door
  const dr = ramp('#7a4a2a'), qs = ramp('#a8a2aa'), { x: dx, y: dy, w: dw, h: dh } = h.doorHi;
  P(g, dx - 4, dy - 4, dw + 8, dh + 4, mortar);
  for (let y = dy; y < bot; y += 5) {
    for (const qx of [dx - 4, dx + dw]) { P(g, qx, y, 4, 4, qs.m); P(g, qx, y, 4, 1, qs.h); P(g, qx + 3, y + 1, 1, 3, qs.d); }
  }
  P(g, dx - 3, dy - 4, dw + 6, 3, qs.m); P(g, dx - 3, dy - 4, dw + 6, 1, qs.h);
  P(g, dx + (dw >> 1) - 2, dy - 5, 4, 5, qs.l); P(g, dx + (dw >> 1) - 2, dy - 5, 4, 1, qs.h);
  P(g, dx, dy, dw, dh, dr.m);
  for (let x = dx + 3; x < dx + dw; x += 3) P(g, x, dy, 1, dh, dr.d);
  P(g, dx, dy, 1, dh, dr.l);
  for (const sy of [dy + 3, dy + dh - 5]) { P(g, dx, sy, dw, 2, dr.l); P(g, dx, sy + 2, dw, 1, dr.o); }
  line(g, dx + 1, dy + dh - 4, dx + dw - 2, dy + 5, dr.l, 2);
  P(g, dx + dw - 4, dy + (dh >> 1), 2, 2, '#e0b040'); P(g, dx + dw - 4, dy + (dh >> 1) + 2, 2, 1, '#8a6010');
  P(g, dx - 4, bot, dw + 8, 3, qs.m); P(g, dx - 4, bot, dw + 8, 1, qs.h); P(g, dx - 4, bot + 2, dw + 8, 1, qs.d);

  // lantern on an iron bracket
  const { x: lx, y: ly } = h.lantern;
  P(g, lx - 4, ly - 4, 6, 1, '#2a2a34'); P(g, lx - 4, ly - 4, 1, 3, '#2a2a34');
  P(g, lx - 1, ly - 3, 3, 2, '#2a2a34');
  P(g, lx - 3, ly - 1, 7, 1, '#2a2a34'); P(g, lx - 2, ly, 5, 7, '#2a2a34');
  P(g, lx - 1, ly + 1, 3, 4, '#a08048'); P(g, lx - 3, ly + 7, 7, 1, '#2a2a34');

  // wooden shake roof with deep overhang, carved trim and stones holding it down
  const ov = 10;
  for (let y = ridge; y < top; y++) {
    const t = (y - ridge) / (top - ridge);
    const L = Math.round(X + 6 - (6 + ov) * t), R = Math.round(X + Wd - 6 + (6 + ov) * t);
    const fe = top - 1 - y, row = Math.floor(fe / 5), ry = fe % 5;
    for (let x = L; x <= R; x++) {
      let c;
      if (x <= L + 2) c = x === L ? beam.o : beam.l;
      else if (x >= R - 2) c = x === R ? beam.o : beam.m;
      else {
        const ox = x + (row % 2) * 4, col = Math.floor(ox / 8), cx = ox % 8, v = hash2(col, row, h.x);
        c = v < 0.18 ? roof.d : v > 0.86 ? roof.l : roof.m;
        if (ry === 0) c = roof.o;
        else if (ry === 1 || cx === 0) c = roof.d;
        else if (ry === 4 && cx < 6) c = roof.l;
        else if (cx === 2 + Math.floor(v * 4) && ry > 1) c = roof.d;
      }
      P(g, x, y, 1, 1, c);
    }
  }
  P(g, X + 5, ridge - 3, Wd - 10, 4, roof.l); P(g, X + 5, ridge - 3, Wd - 10, 1, roof.h); P(g, X + 5, ridge, Wd - 10, 1, roof.d);
  for (let x = X + 8; x < X + Wd - 8; x += 6) P(g, x, ridge - 3, 1, 4, roof.m);
  P(g, X - ov, top, Wd + ov * 2, 2, beam.m); P(g, X - ov, top, Wd + ov * 2, 1, beam.l);
  for (let x = X - ov; x < X + Wd + ov; x += 4) { P(g, x + 1, top + 2, 2, 1, beam.m); P(g, x + 1, top + 3, 2, 1, beam.o); }
  if (!snow) {
    for (let k = 0; k < Math.round(Wd / 18); k++) {
      const row = 1 + Math.floor(rnd() * 3), y = top - 3 - row * 5;
      const t = (y - ridge) / (top - ridge), L = X + 6 - (6 + ov) * t, R = X + Wd - 6 + (6 + ov) * t;
      const x = Math.round(L + 6 + rnd() * (R - L - 12));
      if (Math.abs(x - (h.chimHi.x + 4)) < 9) continue;
      P(g, x - 2, y + 3, 6, 1, roof.o);
      ellipse(g, x, y, 3, 2, '#8a8690'); P(g, x - 2, y - 2, 3, 1, '#c4c0c8'); P(g, x + 1, y + 1, 2, 1, '#5a5664');
    }
  } else {
    for (let x = X - ov; x < X + Wd + ov; x++) {
      const t = x < X + 6 ? (X + 6 - x) / (6 + ov) : x > X + Wd - 6 ? (x - (X + Wd - 6)) / (6 + ov) : 0;
      if (t >= 1) continue;
      const y0 = Math.round(ridge - 3 + t * 27), depth = 9 + Math.round(vnoise(x * 0.15, 3, h.x) * 6);
      P(g, x, y0, 1, depth, '#f4f8ff'); P(g, x, y0 + depth, 1, 2, '#c8d8f0');
    }
    P(g, X - ov, top - 2, Wd + ov * 2, 2, '#f4f8ff');
    for (let x = X - ov + 2; x < X + Wd + ov - 2; x += 4 + Math.floor(rnd() * 5)) P(g, x, top + 2, 1, 2 + Math.floor(rnd() * 4), '#cfe2f8');
  }

  // stone chimney with a little slate hood
  const { x: cx0, top: ct, bot: cb } = h.chimHi;
  P(g, cx0, ct, 9, cb - ct, mortar);
  for (let y = ct + 1, row = 0; y < cb; y += 3, row++) {
    for (let x = cx0 + (row % 2 ? -1 : 0); x < cx0 + 9; x += 4) {
      const st = stones[(row * 3 + x) % stones.length], x0 = Math.max(cx0, x), x1 = Math.min(cx0 + 9, x + 3);
      P(g, x0, y, x1 - x0, 2, st.m); P(g, x0, y, x1 - x0, 1, st.l);
    }
  }
  P(g, cx0 + 8, ct, 1, cb - ct, mortar);
  const slate = ramp('#5a5e6e');
  P(g, cx0, ct - 4, 2, 4, slate.d); P(g, cx0 + 7, ct - 4, 2, 4, slate.d);
  P(g, cx0 - 2, ct - 6, 13, 2, slate.m); P(g, cx0 - 2, ct - 6, 13, 1, slate.l);
  P(g, cx0, ct - 8, 9, 2, slate.m); P(g, cx0 + 2, ct - 9, 5, 1, slate.l);
  if (snow) P(g, cx0 - 2, ct - 10, 13, 3, '#ffffff');

  if (h.tavern) {
    // wooden balcony across the upper floor
    const fy = h.glass[0][1] + 16, rail = ramp('#7a4a28');
    for (const bx of [X + 6, X + (Wd >> 1) - 2, X + Wd - 10]) { P(g, bx, fy + 3, 4, 2, rail.m); P(g, bx + 1, fy + 5, 2, 2, rail.d); }
    P(g, X - 5, fy, Wd + 10, 3, rail.m); P(g, X - 5, fy, Wd + 10, 1, rail.l); P(g, X - 5, fy + 2, Wd + 10, 1, rail.o);
    for (let x = X - 5; x < X + Wd + 4; x += 4) {
      P(g, x, fy - 5, 3, 5, rail.m); P(g, x, fy - 5, 1, 5, rail.l); P(g, x + 1, fy - 4, 1, 2, rail.o);
    }
    P(g, X - 5, fy - 7, Wd + 10, 2, rail.l); P(g, X - 5, fy - 7, Wd + 10, 1, rail.h);
    if (!snow) {
      for (const [gx] of h.glass) {
        P(g, gx - 2, fy - 4, 13, 3, '#6a3a20');
        for (let i = 0; i < 6; i++) P(g, gx - 1 + i * 2, fy - 6 + (i % 2), 2, 2, i % 3 === 1 ? '#f080a0' : '#e03040');
      }
    } else P(g, X - 5, fy - 9, Wd + 10, 2, '#ffffff');

    // hanging tavern sign with a frothy mug
    P(g, X - 15, top + 13, 16, 2, '#3a3a46'); P(g, X - 15, top + 13, 16, 1, '#6a6a7a');
    P(g, X - 13, top + 15, 1, 3, '#3a3a46'); P(g, X - 4, top + 15, 1, 3, '#3a3a46');
    const sb = ramp('#8a5a30');
    P(g, X - 16, top + 18, 15, 12, sb.m); P(g, X - 16, top + 18, 15, 1, sb.l); P(g, X - 16, top + 29, 15, 1, sb.o);
    P(g, X - 16, top + 18, 1, 12, sb.l); P(g, X - 2, top + 18, 1, 12, sb.d);
    P(g, X - 12, top + 21, 6, 7, '#e0b040'); P(g, X - 12, top + 21, 6, 2, '#ffffff');
    P(g, X - 6, top + 23, 2, 3, '#e0b040'); P(g, X - 12, top + 21, 1, 7, '#f8d870'); P(g, X - 7, top + 23, 1, 5, '#a87820');
  }
}

// Little picket fence across the front yard, open at the door.
export function drawYardFence(g, h, snow) {
  const { X, Wd, bot } = h.g, { x: dx, w: dw } = h.doorHi, wd = ramp('#b0844a'), y0 = bot + 4;
  for (const [a, b] of [[X - 6, dx - 7], [dx + dw + 7, X + Wd + 6]]) {
    for (const ry of [y0 - 7, y0 - 3]) { P(g, a, ry, b - a, 2, wd.d); P(g, a, ry, b - a, 1, wd.l); }
    for (let x = a; x <= b - 3; x += 5) {
      P(g, x, y0 - 10, 3, 11, wd.m); P(g, x, y0 - 10, 1, 11, wd.h); P(g, x + 2, y0 - 10, 1, 11, wd.d);
      P(g, x + 1, y0 - 11, 1, 1, wd.m);
      if (snow) P(g, x, y0 - 12, 3, 2, '#ffffff');
    }
    if (!snow) {
      for (let x = a + 2; x < b - 2; x += 7) {
        P(g, x, y0 - 1, 3, 1, '#3a8a3a');
        P(g, x + 1, y0 - 2, 1, 1, ['#f05a6a', '#f8e060', '#ffffff', '#c890f8'][(x >> 3) % 4]);
      }
    }
  }
}

export function makeHouse(h, snow) {
  const { X, Wd, top, bot } = h.g, ox = X - 24, oy = top - 50;
  const c = mk(Wd + 64, bot - oy + 12), g = c.getContext('2d');
  g.translate(-ox, -oy);
  drawHouse(g, h, snow);
  drawYardFence(g, h, snow);
  if (h.tavern) { drawBarrel(g, X + Wd + 8, bot + 1); drawCrate(g, X + Wd + 16, bot + 1, 12); drawCrate(g, X + Wd + 18, bot - 11, 10); }
  outline(c);
  return { cv: c, x: ox, y: oy };
}

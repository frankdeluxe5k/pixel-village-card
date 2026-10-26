// Small props: benches, lamps, barrels, the well, the woodpile, the projector, the pot.
import { ramp } from '../core/color.js';
import { S } from '../core/constants.js';
import { P, disc, ellipse, line, mk, outline } from '../core/pixels.js';
import { STUMP, WELL } from '../world/layout.js';

export function drawBench(g, x, by, w, snow) {
  const bk = ramp('#6a4428'), top = ramp('#c89a60');
  P(g, x + 2, by - 3, 4, 3, bk.d); P(g, x + w - 6, by - 3, 4, 3, bk.d);
  P(g, x, by - 7, w, 4, bk.m); P(g, x, by - 4, w, 1, bk.d);
  for (let i = x + 3; i < x + w - 3; i += 5) P(g, i, by - 6, 2, 1, bk.o);
  P(g, x, by - 9, w, 2, top.m); P(g, x, by - 9, w, 1, top.l);
  P(g, x + w - 2, by - 8, 2, 4, top.d); P(g, x + w - 1, by - 7, 1, 1, bk.d);
  if (snow) P(g, x, by - 10, w, 2, '#ffffff');
}

export function drawLamp(g, x, by) {
  const ir = ramp('#3a3a48');
  P(g, x - 3, by - 3, 7, 3, ir.m); P(g, x - 3, by - 3, 7, 1, ir.l);
  P(g, x - 1, by - 30, 2, 27, ir.m); P(g, x - 1, by - 30, 1, 27, ir.l);
  P(g, x - 3, by - 31, 7, 1, ir.m);
  P(g, x - 3, by - 38, 7, 7, ir.d); P(g, x - 2, by - 37, 5, 5, '#a08048'); P(g, x, by - 37, 1, 5, ir.d);
  P(g, x - 4, by - 39, 9, 1, ir.m); P(g, x - 3, by - 40, 7, 1, ir.m); P(g, x - 1, by - 42, 3, 2, ir.l); P(g, x, by - 43, 1, 1, ir.l);
}

export function drawHaystack(g, cx, by, snow) {
  const hy = ramp('#d8b048');
  ellipse(g, cx, by - 5, 9, 5, hy.m); ellipse(g, cx - 2, by - 7, 5, 2, hy.l); P(g, cx - 8, by - 1, 17, 1, hy.d);
  for (let i = 0; i < 6; i++) P(g, cx - 7 + i * 2.5, by - 7 + (i % 3) * 2, 1, 2, i % 2 ? hy.d : hy.h);
  if (snow) ellipse(g, cx - 1, by - 9, 6, 2, '#ffffff');
}

export function drawBarrel(g, cx, by) {
  const b = ramp('#9a6234');
  for (let r = 0; r < 16; r++) {
    const w = r > 2 && r < 13 ? 13 : 11, x0 = cx - (w >> 1);
    for (let c = 0; c < w; c++) {
      const u = c / (w - 1);
      P(g, x0 + c, by - 16 + r, 1, 1, u < 0.2 ? b.l : u > 0.75 ? b.d : c % 3 === 0 ? b.d : b.m);
    }
  }
  for (const r of [3, 12]) { P(g, cx - 6, by - 16 + r, 13, 2, '#4a4a56'); P(g, cx - 6, by - 16 + r, 13, 1, '#8a8a9a'); }
  ellipse(g, cx, by - 16, 5, 1, b.l); P(g, cx - 3, by - 16, 6, 1, b.h);
}

export function drawCrate(g, x, by, s) {
  const c = ramp('#a87a44');
  P(g, x, by - s, s, s, c.m); P(g, x, by - s, s, 2, c.l); P(g, x, by - 2, s, 2, c.d);
  P(g, x, by - s, 2, s, c.l); P(g, x + s - 2, by - s, 2, s, c.d);
  line(g, x + 2, by - s + 2, x + s - 3, by - 3, c.d, 2);
  P(g, x + 2, by - (s >> 1), s - 4, 1, c.o);
}

export function drawWell(g, snow) {
  const cx = WELL.x * S, by = WELL.y * S - 3, st = ramp('#8a8692'), wd = ramp('#7a5030'), rf = ramp('#9a3a2a');
  const Y = (dy) => by + dy; // offsets measured from the well's base
  P(g, cx - 13, Y(-41), 3, 27, wd.m); P(g, cx - 13, Y(-41), 1, 27, wd.l);
  P(g, cx + 10, Y(-41), 3, 27, wd.m); P(g, cx + 12, Y(-41), 1, 27, wd.d);
  P(g, cx - 10, Y(-32), 20, 2, wd.d); P(g, cx + 13, Y(-34), 2, 6, wd.m); P(g, cx + 15, Y(-29), 3, 2, wd.l);
  P(g, cx, Y(-30), 1, 8, '#d8c090');
  P(g, cx - 3, Y(-22), 7, 5, wd.m); P(g, cx - 3, Y(-20), 7, 1, '#4a4a56'); P(g, cx - 3, Y(-22), 1, 5, wd.l);
  for (let i = 0; i < 12; i++) {
    const y = Y(-49 + i), hw = 4 + Math.round(i * 1.3);
    for (let x = cx - hw; x <= cx + hw; x++) {
      P(g, x, y, 1, 1, snow && i < 5 ? '#f4f8ff' : i % 3 === 2 ? rf.o : x === cx - hw ? rf.l : x < cx ? rf.m : rf.d);
    }
  }
  P(g, cx - 1, Y(-52), 3, 3, snow ? '#ffffff' : rf.l);
  const ty = Y(-15);
  for (let y = ty; y < by; y++) {
    const row = Math.floor((y - ty) / 4), ry = (y - ty) % 4;
    for (let x = cx - 14; x <= cx + 14; x++) {
      const u = (x - cx) / 14;
      let c = ry === 3 || (x + row * 3) % 7 === 0 ? st.o : u < -0.45 ? st.l : u > 0.5 ? st.d : st.m;
      if (ry === 0 && c !== st.o && u < 0.5) c = st.h;
      P(g, x, y, 1, 1, c);
    }
  }
  ellipse(g, cx, ty, 15, 3, st.l);
  ellipse(g, cx, ty, 12, 2, '#1a2238');
  P(g, cx - 6, ty, 5, 1, '#3a5a8a');
  if (snow) ellipse(g, cx - 4, ty - 2, 10, 1, '#ffffff');
}

export function drawWoodpile(g, snow) {
  const bk = ramp('#6a4428'), sx = STUMP.x * S, sy = STUMP.y * S - 8;
  P(g, sx - 9, sy, 19, 9, bk.m);
  for (let x = sx - 7; x < sx + 9; x += 3) P(g, x, sy + 1, 1, 8, bk.d);
  P(g, sx - 9, sy, 2, 9, bk.l);
  P(g, sx - 11, sy + 6, 23, 3, bk.m); P(g, sx - 11, sy + 8, 23, 1, bk.d);
  ellipse(g, sx, sy, 9, 2, '#d8b07a'); ellipse(g, sx, sy, 6, 1, '#b88a58'); P(g, sx - 3, sy, 7, 1, '#d8b07a'); P(g, sx, sy, 1, 1, '#8a6040');
  if (snow) ellipse(g, sx, sy - 1, 8, 1, '#ffffff');
  const logEnd = (x, y) => {
    disc(g, x, y, 4, '#5a3a22'); disc(g, x, y, 3, '#d8b07a'); disc(g, x, y, 2, '#b88a58'); disc(g, x, y, 1, '#d8b07a');
    P(g, x, y, 1, 1, '#8a6040'); P(g, x - 2, y - 3, 2, 1, '#f0d098');
  };
  const lx = sx + 16, ly = sy + 1;
  for (const [x, y] of [[0, 0], [9, 0], [18, 0], [4, -8], [13, -8], [9, -16]]) logEnd(lx + x, ly + y);
  if (snow) { P(g, lx + 5, ly - 21, 9, 2, '#ffffff'); P(g, lx - 4, ly - 13, 6, 1, '#ffffff'); P(g, lx + 18, ly - 13, 5, 1, '#ffffff'); }
}

export function makeProjector() {
  const c = mk(32, 34), g = c.getContext('2d'), ax = 15, by = 31;
  const cr = ramp('#9a6a3a'), bd = ramp('#4a4a58');
  P(g, ax - 10, by - 9, 21, 10, cr.m); P(g, ax - 10, by - 9, 21, 1, cr.l); P(g, ax - 10, by, 21, 1, cr.d);
  P(g, ax - 10, by - 9, 1, 10, cr.l); P(g, ax + 10, by - 9, 1, 10, cr.d);
  line(g, ax - 8, by - 7, ax + 8, by - 1, cr.d, 1);
  P(g, ax - 8, by - 18, 16, 9, bd.m); P(g, ax - 8, by - 18, 16, 1, bd.l); P(g, ax - 8, by - 10, 16, 1, bd.d);
  for (let x = ax - 6; x < ax + 2; x += 2) P(g, x, by - 16, 1, 4, bd.o);
  P(g, ax + 8, by - 16, 5, 5, bd.d); P(g, ax + 8, by - 16, 5, 1, bd.l); P(g, ax + 12, by - 15, 1, 3, '#c8d8ff');
  P(g, ax - 5, by - 22, 1, 4, bd.o); P(g, ax + 4, by - 22, 1, 4, bd.o);
  outline(c);
  return { cv: c, ax, by, lens: [13, -14], reels: [[-5, -26], [4, -26]] };
}

export function makePot() {
  const c = mk(34, 32), g = c.getContext('2d'), ax = 17, by = 29;
  const wd = ramp('#7a5030'), pt = ramp('#3e3c4a');
  line(g, ax - 13, by, ax - 1, by - 25, wd.m, 2); line(g, ax + 13, by, ax + 1, by - 25, wd.d, 2);
  P(g, ax - 2, by - 27, 5, 3, '#c8a868');
  P(g, ax, by - 24, 1, 6, '#4a4a56');
  ellipse(g, ax, by - 11, 9, 6, pt.m);
  P(g, ax - 7, by - 14, 3, 5, pt.l); P(g, ax - 6, by - 15, 1, 1, pt.h);
  P(g, ax + 4, by - 9, 4, 3, pt.d);
  ellipse(g, ax, by - 16, 9, 2, pt.d); ellipse(g, ax, by - 16, 7, 1, '#d88a30'); P(g, ax - 4, by - 17, 3, 1, '#f8b858');
  P(g, ax - 6, by - 5, 2, 3, pt.d); P(g, ax + 5, by - 5, 2, 3, pt.d);
  outline(c);
  return { cv: c, ax, by };
}

export function makePuff(r, light, mid, dark) {
  const c = mk(r * 2 + 3, r * 2 + 3), g = c.getContext('2d'), o = r + 1;
  disc(g, o, o, r, dark);
  disc(g, o - 1, o - 1, Math.max(0, r - 1), mid);
  if (r > 1) disc(g, o - Math.ceil(r / 2), o - Math.ceil(r / 2), Math.max(0, r - 3), light);
  return c;
}

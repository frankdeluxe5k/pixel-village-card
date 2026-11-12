// Small props: benches, lamps, barrels, the well, the woodpile, the projector, the pot, the memorial statue.
import { ramp } from '../core/color.js';
import { S } from '../core/constants.js';
import { P, disc, ellipse, fillPoly, line, mk, outline } from '../core/pixels.js';
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

// The memorial: a painted German Shepherd (cream with a black saddle and mask) sitting tall on a granite plinth,
// looking out over the village, with a bronze ball cast at its forepaws (part of the statue; it never moves). cx/by in render px, by = ground line.
export function drawMemorial(g, cx, by, snow) {
  const st = ramp('#8e8a98'), br = ramp('#7a5634'), gold = ramp('#c09048');
  // plinth: a footing step, the block, and a moulded cap (lit from the left)
  const block = (x0, y0, w, h) => {
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - x0) / (w - 1);
      P(g, x, y0, 1, h, u < 0.12 ? st.l : u > 0.82 ? st.d : st.m);
    }
    P(g, x0, y0, w, 1, st.h);
  };
  block(cx - 17, by - 4, 35, 4); P(g, cx - 17, by - 1, 35, 1, st.d);
  block(cx - 14, by - 18, 29, 14); P(g, cx - 14, by - 5, 29, 1, st.o);
  block(cx - 16, by - 21, 33, 3); P(g, cx - 16, by - 18, 33, 1, st.o);
  for (const [x, y] of [[cx - 11, by - 15], [cx + 9, by - 11], [cx - 4, by - 7], [cx + 11, by - 16]]) P(g, x, y, 2, 1, st.d); // a little grain
  // a bronze plaque on the front
  P(g, cx - 6, by - 15, 13, 7, br.o); P(g, cx - 5, by - 14, 11, 5, br.m); P(g, cx - 5, by - 14, 11, 1, br.l);
  for (const [x, w] of [[cx - 3, 7], [cx - 2, 5]]) P(g, x, by - 12 + (w === 5 ? 2 : 0), w, 1, br.d);

  // the dog, facing right: drawn as one silhouette, then painted and shaded
  const gy = by - 22, c = mk(40, 44), d = c.getContext('2d'), ox = 20, oy = 42; // local origin = (cx, gy)
  const Q = (pts) => fillPoly(d, pts.map(([x, y]) => [ox + x, oy + y]), '#000');
  const E = (x, y, rx, ry) => ellipse(d, ox + x, oy + y, rx, ry, '#000');
  const R = (x, y, w, h) => P(d, ox + x, oy + y, w, h, '#000');
  E(-5, -6, 7, 6);                                                   // haunch
  Q([[-11, 0], [-11, -7], [-8, -13], [-3, -17], [2, -21], [6, -21], [9, -14], [9, 0]]); // back and body
  E(5, -15, 4, 6);                                                   // deep chest
  Q([[0, -21], [2, -28], [9, -31], [11, -24], [10, -16], [5, -15]]); // a thick neck, held high
  E(6, -30, 5, 4);                                                   // skull
  Q([[9, -33], [15, -30], [16, -28], [15, -26], [9, -25]]);          // long muzzle
  Q([[2, -32], [4, -41], [7, -33]]); Q([[6, -33], [8, -40], [10, -32]]); // tall pricked ears
  R(5, -13, 3, 13); R(2, -10, 3, 10);                                 // forelegs, straight
  R(2, -2, 9, 2);                                                    // forepaws
  R(-5, -3, 8, 3);                                                   // hind paw tucked forward
  Q([[-10, -5], [-14, -3], [-17, 0], [-10, 0], [-8, -3]]);           // bushy tail curled round on the plinth
  const im = d.getImageData(0, 0, 40, 44), a = (x, y) => (x < 0 || y < 0 || x >= 40 || y >= 44 ? 0 : im.data[(y * 40 + x) * 4 + 3]);
  d.clearRect(0, 0, 40, 44);
  // painted in the dog's own colours: a cream coat, a black saddle down the back and tail, a black mask and ears
  const cream = { h: '#fffaea', l: '#f6ecd2', m: '#e6d4ac', d: '#c4a87c', o: '#9a7c54' };
  const black = { h: '#7c7a88', l: '#55535e', m: '#34313a', d: '#24212a', o: '#141218' };
  const isBlack = (x, y) => y <= -33 // ears
    || (x >= 10 && y <= -24) || (x >= 5 && y <= -29) // the black face: muzzle, forehead and round the eye
    || (x <= 4 && y <= -20 && y >= -32 && x <= 3 + (y + 29) * 0.25) // up the back of the neck to the ears
    || (x <= 6 && y >= -21 && y < -1 - (x + 11) * 0.75) // a broad saddle over the back and down the shoulder
    || (x <= -9 && y <= -1); // the tail
  const coat = (lx, ly) => (isBlack(lx, ly) ? black : cream);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 40; x++) {
    if (!a(x, y)) continue;
    const k = coat(x - ox, y - oy), lit = !a(x - 1, y) || !a(x, y - 1), shade = !a(x + 1, y) || !a(x, y + 1) || !a(x + 1, y + 1);
    let col = lit && !shade ? k.l : shade && !lit ? k.d : k.m;
    if (!a(x, y - 1)) col = k === black ? k.h : (!a(x - 1, y - 1) ? k.h : k.l); // a pale rim along the top keeps the black edge clear of the farm behind
    P(d, x, y, 1, 1, col);
  }
  const D = (x, y, w, h, col) => P(d, ox + x, oy + y, w, h, col);
  const Dk = (x, y, w, h, tone) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) D(x + i, y + j, 1, 1, coat(x + i, y + j)[tone]); };
  // modelling: haunch curve, the far foreleg in shadow, the chest line, ears, eye, nose and mouth
  for (const [x, y] of [[-9, -9], [-8, -11], [-6, -12], [-4, -12], [-2, -11], [-1, -9], [0, -7], [0, -5]]) Dk(x, y, 1, 1, 'd');
  Dk(2, -10, 1, 9, 'd'); Dk(4, -10, 1, 9, 'o'); Dk(7, -12, 1, 10, 'd'); Dk(5, -13, 1, 11, 'l');
  Dk(3, -2, 1, 2, 'o'); Dk(6, -2, 1, 2, 'o'); Dk(9, -1, 1, 1, 'o');
  D(4, -38, 1, 5, '#8a6a5a'); D(8, -37, 1, 4, '#8a6a5a');           // inner ears
  D(9, -31, 3, 1, black.o); D(9, -30, 2, 1, '#b07a30'); D(9, -30, 1, 1, '#f0c060'); // a warm eye under the brow
  D(15, -30, 2, 2, black.o); D(15, -30, 1, 1, black.h);              // nose
  D(10, -27, 5, 1, black.o);                                         // mouth line
  // the ball, cast with the statue, sitting on the plinth at the forepaws
  disc(d, ox + 14, oy - 3, 3, gold.d); disc(d, ox + 13, oy - 4, 2, gold.m); D(12, -5, 2, 1, gold.l); D(12, -5, 1, 1, gold.h); D(15, -1, 2, 1, gold.o);
  // a dark contact line where the dog and the ball meet the cap, so the cream paws read against the stone
  for (let x = 0; x < 40; x++) if (a(x, oy) || (x >= ox + 11 && x <= ox + 17)) D(x - ox, 1, 1, 1, black.o);
  if (snow) for (let x = 0; x < 40; x++) for (let y = 0; y < 44; y++) if (a(x, y)) { P(d, x, y, 1, 1, '#f4f8ff'); if (a(x, y + 1) && x % 3) P(d, x, y + 1, 1, 1, '#ffffff'); break; }
  g.drawImage(c, cx - ox, gy - oy + 1);
  if (snow) { P(g, cx - 16, by - 22, 33, 2, '#ffffff'); P(g, cx - 17, by - 5, 35, 1, '#ffffff'); }
}

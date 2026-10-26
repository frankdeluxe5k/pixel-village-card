// Tools, carried things and instruments.
import { METAL, WOOD } from '../palette.js';
import { AX, FY } from './frame.js';
import { BAND_GUITARS } from '../../content/band.js';
import { ramp } from '../../core/color.js';
import { P, disc, ellipse, line } from '../../core/pixels.js';

// Shafted tools drawn along a direction: hoe blade, axe head or hammer head at the tip.
export function drawHafted(g, kind, [hx, hy], [dx, dy]) {
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  const len = kind === 'hammer' ? 7 : 11, px = -dy, py = dx;
  const tx = hx + dx * len, ty = hy + dy * len;
  line(g, Math.round(hx - dx * 4), Math.round(hy - dy * 4), Math.round(tx), Math.round(ty), WOOD.m, 2);
  line(g, Math.round(hx - dx * 4), Math.round(hy - dy * 4), Math.round(tx - dx), Math.round(ty - dy), WOOD.l, 1);
  const at = (a, b) => [Math.round(tx + dx * a + px * b), Math.round(ty + dy * a + py * b)];
  if (kind === 'shovel') { // a flat square blade
    for (let a = 0; a <= 4; a++) for (let b = -2; b <= 2; b++) { const [x, y] = at(a, b); P(g, x, y, 1, 1, b === -2 ? METAL.h : b === 2 ? METAL.d : METAL.m); }
  } else if (kind === 'hoe') {
    for (let k = 0; k < 5; k++) { const [x, y] = at(0, k); P(g, x, y, 2, 2, k === 4 ? METAL.h : METAL.m); }
  } else if (kind === 'axe') {
    for (let a = -3; a <= 0; a++) for (let b = -1; b <= 4; b++) { const [x, y] = at(a, b); P(g, x, y, 1, 1, b === 4 ? METAL.h : b < 0 ? METAL.d : METAL.m); }
  } else {
    for (let a = -1; a <= 1; a++) for (let b = -3; b <= 3; b++) { const [x, y] = at(a, b); P(g, x, y, 1, 1, a < 0 ? METAL.l : METAL.d); }
  }
}

export function drawTool(g, tool, hx, hy, frame, tt, tb) {
  switch (tool) {
    case 'ladle':
      line(g, hx, hy, hx + 4, hy + 7, '#c8ccd4', 1);
      P(g, hx + 3, hy + 7, 4, 2, '#9aa0aa');
      break;
    case 'bowl':
      P(g, hx - 2, hy + 1, 7, 3, WOOD.m); P(g, hx - 2, hy + 1, 7, 1, '#e8a840'); P(g, hx - 1, hy + 3, 5, 1, WOOD.d);
      break;
    case 'spoon':
      P(g, hx, hy - 2, 2, 2, '#e8a840');
      break;
    case 'handheld0': // red-and-blue hybrid console
      P(g, hx - 4, hy - 2, 2, 4, '#e03a3a'); P(g, hx - 2, hy - 2, 5, 4, '#2a2a30'); P(g, hx - 1, hy - 1, 3, 2, '#6ad0ff');
      P(g, hx + 3, hy - 2, 2, 4, '#3a7ad8'); P(g, hx - 4, hy - 2, 1, 1, '#ff8a8a'); P(g, hx + 4, hy - 2, 1, 1, '#8ab0ff');
      break;
    case 'handheld1': // chunky dark handheld PC
      P(g, hx - 4, hy - 2, 10, 4, '#3a3a44'); P(g, hx - 1, hy - 1, 4, 2, '#9ae0ff'); P(g, hx - 1, hy - 1, 1, 1, '#ffffff');
      P(g, hx - 3, hy - 1, 1, 1, '#8a8a98'); P(g, hx + 4, hy, 1, 1, '#8a8a98');
      break;
    case 'pad': // wired controller
      P(g, hx - 2, hy - 1, 6, 3, '#a8a8b4'); P(g, hx - 2, hy - 1, 6, 1, '#c8c8d4');
      P(g, hx - 1, hy, 1, 1, '#2a2a30'); P(g, hx + 2, hy, 1, 1, '#e03a3a'); P(g, hx + 3, hy - 1, 1, 1, '#3a7ad8');
      break;
    case 'mug':
      P(g, hx - 1, hy - 3, 4, 4, '#ffffff'); P(g, hx - 1, hy - 3, 4, 1, '#6a3a1a'); P(g, hx + 3, hy - 2, 1, 2, '#ffffff');
      P(g, hx + 2, hy - 2, 1, 3, '#d8dce4');
      break;
    case 'popcorn': {
      const bx = AX + 1, by = tb - 2;
      for (let i = 0; i < 5; i++) P(g, bx + i, by, 1, 5, i % 2 ? '#ffffff' : '#e03838');
      P(g, bx - 1, by - 2, 7, 2, '#fff2c0'); P(g, bx, by - 3, 2, 1, '#fffae0'); P(g, bx + 3, by - 3, 2, 1, '#fffae0');
      if (frame) P(g, hx, hy - 2, 2, 2, '#fff2c0');
      break;
    }
    case 'lute': {
      const lw = ramp('#c88040');
      line(g, AX + 5, tt + 3, AX + 12, tt - 3, '#5a3418', 2);
      P(g, AX + 11, tt - 6, 3, 3, '#3a2010');
      ellipse(g, AX + 2, tt + 5, 4, 3, lw.m);
      P(g, AX - 1, tt + 3, 3, 1, lw.l);
      P(g, AX + 2, tt + 4, 2, 2, '#3a2010');
      line(g, AX + 1, tt + 6, AX + 11, tt - 2, '#f0e0b0', 1);
      break;
    }
    case 'broom':
      line(g, hx - 3, hy - 7, hx + 5, FY - 4, WOOD.m, 2);
      for (let i = 0; i < 4; i++) P(g, hx + 3 - i + (frame % 2), FY - 3 + i, 6 + 2 * i, 1, i % 2 ? '#c8a050' : '#e0c070');
      break;
    case 'rake': // long handle down to a toothed head on the ground
      line(g, hx - 3, hy - 7, hx + 6, FY - 2, WOOD.m, 2); line(g, hx - 3, hy - 7, hx + 5, FY - 2, WOOD.l, 1);
      P(g, hx + 3 + (frame % 2), FY - 2, 7, 1, METAL.m);
      for (let i = 0; i < 4; i++) P(g, hx + 3 + (frame % 2) + i * 2, FY - 1, 1, 2, METAL.d);
      break;
    case 'snowball':
      P(g, hx - 1, hy - 2, 3, 3, '#f4f8ff'); P(g, hx + 1, hy, 1, 1, '#c4d4e8');
      break;
    case 'pumpkin':
      P(g, hx - 2, hy, 6, 4, '#e07a28'); P(g, hx - 2, hy, 6, 1, '#f8a040'); P(g, hx, hy, 1, 4, '#b85a18'); P(g, hx, hy - 2, 1, 2, '#4a6a28');
      break;
    case 'bucket':
      line(g, hx - 2, hy + 1, hx, hy - 1, '#5a5a66', 1); line(g, hx, hy - 1, hx + 4, hy + 1, '#5a5a66', 1);
      P(g, hx - 2, hy + 1, 7, 6, METAL.m); P(g, hx - 2, hy + 1, 2, 6, METAL.l); P(g, hx + 3, hy + 1, 2, 6, METAL.d);
      P(g, hx - 2, hy + 3, 7, 1, METAL.o); P(g, hx - 1, hy + 1, 5, 1, '#5ab0f0');
      break;
    case 'shears': { // hedge shears: two long blades, open and shut by frame
      line(g, hx - 3, hy + 1, hx, hy, WOOD.m, 1);
      if (frame % 2) { line(g, hx, hy, hx + 8, hy - 3, METAL.h, 1); line(g, hx, hy, hx + 8, hy + 1, METAL.m, 1); }
      else { line(g, hx, hy, hx + 9, hy - 1, METAL.h, 1); line(g, hx, hy + 1, hx + 9, hy, METAL.m, 1); }
      break;
    }
    case 'brush':
      line(g, hx - 1, hy + 2, hx + 3, hy - 3, WOOD.l, 1); P(g, hx + 3, hy - 5, 2, 2, ['#e04848', '#3a8ae0', '#f0c030'][frame % 3]);
      break;
    case 'ring':
      P(g, hx - 2, hy - 4, 4, 1, '#f0c030'); P(g, hx - 2, hy - 1, 4, 1, '#f0c030'); P(g, hx - 3, hy - 3, 1, 2, '#f0c030'); P(g, hx + 2, hy - 3, 1, 2, '#f0c030');
      break;
    case 'balls': {
      const pts = frame % 2 ? [[hx - 2, hy - 9, '#e04848'], [hx + 3, hy - 6, '#f0c030'], [hx - 5, hy - 4, '#3a8ae0']] : [[hx + 1, hy - 10, '#e04848'], [hx - 4, hy - 7, '#f0c030'], [hx + 3, hy - 3, '#3a8ae0']];
      for (const [x, y, c] of pts) { P(g, x, y, 2, 2, c); P(g, x, y, 1, 1, '#ffffff'); }
      break;
    }
    case 'pour':
      P(g, hx, hy - 2, 7, 5, METAL.m); P(g, hx, hy - 2, 7, 1, METAL.l); P(g, hx, hy, 7, 1, METAL.o);
      P(g, hx + 7, hy - 2, 1, 2, '#5ab0f0');
      P(g, hx + 7, hy, 1, 4, '#7ac4f8'); P(g, hx + 8, hy + 4, 1, 5, '#7ac4f8');
      break;
  }
}

export function drawCarry(g, carry, hx, hy, tt) {
  if (carry === 'log') {
    const bk = ramp('#7a4a28');
    P(g, AX - 9, tt - 4, 19, 5, bk.m); P(g, AX - 9, tt - 4, 19, 1, bk.l); P(g, AX - 9, tt, 19, 1, bk.d);
    for (let x = AX - 6; x < AX + 8; x += 4) P(g, x, tt - 3, 2, 1, bk.d);
    P(g, AX + 9, tt - 4, 2, 5, '#e0b47c'); P(g, AX + 10, tt - 2, 1, 1, '#a87a48');
  } else if (carry === 'mail') {
    P(g, hx, hy - 3, 5, 4, '#ffffff'); P(g, hx, hy - 3, 5, 1, '#d8d8e0'); P(g, hx + 2, hy - 2, 1, 1, '#c83a3a');
  } else if (carry === 'package') {
    P(g, AX + 2, tt + 1, 9, 7, '#c8a068'); P(g, AX + 2, tt + 1, 9, 1, '#e0bc88'); P(g, AX + 6, tt + 1, 1, 7, '#f0e0b0'); P(g, AX + 10, tt + 2, 1, 6, '#a07840');
  } else if (carry === 'crate') {
    const cr = ramp('#b08048');
    P(g, AX + 2, tt + 1, 10, 7, cr.m); P(g, AX + 2, tt + 1, 10, 1, cr.l); P(g, AX + 2, tt + 4, 10, 1, cr.d); P(g, AX + 11, tt + 1, 1, 7, cr.d);
    P(g, AX + 4, tt, 2, 1, '#e04848'); P(g, AX + 7, tt, 2, 1, '#f0c030');
  } else if (carry === 'pumpkins') {
    const cr = ramp('#b08048');
    P(g, AX + 2, tt + 2, 10, 6, cr.m); P(g, AX + 2, tt + 2, 10, 1, cr.l); P(g, AX + 11, tt + 2, 1, 6, cr.d);
    for (const x of [AX + 2, AX + 7]) { P(g, x, tt - 1, 5, 4, '#e07a28'); P(g, x, tt - 1, 5, 1, '#f8a040'); P(g, x + 2, tt - 2, 1, 1, '#4a6a28'); }
  } else if (carry === 'case') {
    const cs = ramp('#6a3a22');
    P(g, hx - 3, hy, 7, 5, cs.m); P(g, hx - 3, hy, 7, 1, cs.l); P(g, hx + 3, hy, 1, 5, cs.d); P(g, hx - 1, hy - 1, 3, 1, cs.o); P(g, hx, hy + 2, 1, 1, '#e8c050');
  } else if (carry === 'ladder') {
    const wd = ramp('#b8905a');
    line(g, AX - 12, tt + 5, AX + 13, tt - 7, wd.m, 1); line(g, AX - 11, tt + 8, AX + 14, tt - 4, wd.d, 1);
    for (let k = 0; k < 6; k++) { const x = AX - 9 + k * 4, y = tt + 4 - Math.round(k * 2); line(g, x, y, x + 1, y + 3, wd.l, 1); }
  } else if (carry === 'sign') {
    const sw = ramp('#d8b070');
    P(g, AX + 2, tt, 14, 10, sw.m); P(g, AX + 2, tt, 14, 1, sw.l);
    P(g, AX + 2, tt + 3, 14, 1, sw.d); P(g, AX + 2, tt + 6, 14, 1, sw.d);
    P(g, AX + 8, tt + 10, 2, 4, WOOD.d);
  }
}

// Instruments for the travelling band, drawn over the body; hands go on top of them.
export function drawInstrument(g, v, kind, hf, hb, tt, skin) {
  const hand = ([x, y]) => { P(g, x - 1, y - 1, 3, 3, skin.m); P(g, x - 1, y - 1, 1, 1, skin.l); };
  if (kind === 'drums') {
    const sh = ramp('#c8303a'), cym = ramp('#e8c040'), st = '#8a8e9a';
    P(g, AX - 4, FY - 4, 2, 4, '#3a3a44'); P(g, AX - 6, FY, 6, 1, '#3a3a44'); // throne
    line(g, AX + 15, tt - 2, AX + 15, FY, st, 1); ellipse(g, AX + 15, tt - 3, 5, 1, cym.m); P(g, AX + 11, tt - 4, 4, 1, cym.h); // crash
    disc(g, AX + 8, FY - 6, 6, sh.m); P(g, AX + 5, FY - 12, 5, 1, sh.l); // kick drum, head toward us
    disc(g, AX + 8, FY - 6, 4, '#f2eee6'); P(g, AX + 6, FY - 9, 3, 1, '#ffffff');
    P(g, AX + 6, FY - 6, 5, 1, '#2a2a34'); P(g, AX + 7, FY - 5, 3, 1, '#2a2a34'); // band logo
    P(g, AX + 1, tt + 6, 7, 3, sh.m); P(g, AX + 1, tt + 6, 7, 1, '#f4f4f8'); P(g, AX + 1, tt + 8, 7, 1, sh.d); // snare
    ellipse(g, AX + 11, tt + 5, 3, 1, '#f4f4f8'); P(g, AX + 8, tt + 6, 7, 2, sh.m); // rack tom
    for (const h of [hb, hf]) {
      const up = h[1] < tt + 1;
      line(g, h[0], h[1], h[0] + 5, h[1] + (up ? -3 : 2), '#e8d0a0', 1);
      hand(h);
    }
  } else {
    const bass = kind === 'bass', col = ramp(BAND_GUITARS[v.instrIdx] || '#d02a34');
    const bx = AX + 1, by = tt + 6, nx = AX + (bass ? 17 : 14), ny = tt - (bass ? 4 : 2);
    line(g, AX - 2, tt, bx - 4, by + 1, '#1a1a22', 1); // strap
    line(g, bx + 3, by - 2, nx, ny, '#6a4020', 2); line(g, bx + 3, by - 3, nx, ny - 1, '#a87040', 1);
    P(g, nx, ny - 2, 2, 3, '#2a2a30'); P(g, nx + 1, ny - 2, 1, 1, '#c8ccd8');
    ellipse(g, bx - 1, by + 1, 4, 3, col.m); ellipse(g, bx + 2, by - 1, 3, 2, col.m);
    P(g, bx - 4, by, 2, 1, col.l); P(g, bx - 3, by - 1, 2, 1, col.h); P(g, bx - 3, by + 4, 5, 1, col.d);
    P(g, bx - 1, by - 1, 3, 3, bass ? '#3a2418' : '#f0ece0'); // pickguard
    P(g, bx + 1, by - 1, 1, 2, '#2a2a30'); P(g, bx - 3, by + 1, 1, 2, '#c8ccd8');
    hand(hb); hand(hf);
  }
}

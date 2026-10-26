// Animal sprites.
import { OUT } from '../core/constants.js';
import { P, mk, outline } from '../core/pixels.js';

export const COATS = {
  dog: [
    { c: '#a86a3a', d: '#7a4a28', l: '#c88a58', ear: '#5a3a20', belly: '#e8c8a0' },
    { c: '#f0eee8', d: '#c4c4c8', l: '#ffffff', ear: '#2a2a30', belly: '#ffffff', patch: '#2a2a30' },
    // a German Shepherd: tan with a black saddle, black muzzle and tall pricked ears
    { c: '#c88a48', d: '#8a5a2c', l: '#e0aa68', ear: '#2a2220', belly: '#e8c690', saddle: '#2e2622', prick: true },
  ],
  cat: [{ c: '#e88a3a', d: '#b85a20', l: '#f8b070' }],
  rabbit: [{ c: '#a88a6a', d: '#7a604a', l: '#c8aa8a' }, { c: '#e8e4dc', d: '#b8b0a8', l: '#ffffff' }],
  squirrel: [{ c: '#b8602a', d: '#8a4220', l: '#d88a4a', belly: '#f0d0a0' }],
  bird: [{ c: '#4a7ad0', d: '#2a4a90', l: '#8ab0f0' }, { c: '#8a6a4a', d: '#5a4430', l: '#b89878' }, { c: '#d84a3a', d: '#9a2a20', l: '#f08070' }],
};
export const ANIMAL_SIZE = { dog: [20, 16, 10, 13], cat: [18, 14, 9, 11], rabbit: [14, 16, 7, 13], squirrel: [16, 16, 8, 13], bird: [11, 10, 5, 7] };
export const animalCache = new Map();

// `holding`: a dog with the kid's ball in its mouth (2 px wider each side, so it stays symmetric about its anchor
// and mirrors in place like every other sprite).
export function animalSprite(type, variant, pose, frame, holding = false) {
  const key = `${type}|${variant}|${pose}|${frame}${holding ? '|b' : ''}`;
  let spr = animalCache.get(key);
  if (spr) return spr;
  let [w, h, ax, by] = ANIMAL_SIZE[type];
  if (holding) { w += 4; ax += 2; }
  const c = mk(w, h), g = c.getContext('2d'), k = COATS[type][variant];
  const px = (x, y, ww, hh, col) => P(g, ax + x, by + y, ww, hh, col);
  if (type === 'dog') {
    if (pose === 'lie') {
      px(-6, -3, 12, 3, k.c); px(-6, -3, 12, 1, k.l); px(4, -4, 4, 3, k.c); px(5, -3, 3, 2, k.l);
      px(4, -4, 2, 3, k.ear); px(7, -3, 1, 1, OUT); px(-8, -1, 2, 1, k.c);
      if (k.patch) px(-2, -3, 3, 2, k.patch);
      if (k.saddle) { px(-5, -3, 8, 1, k.saddle); px(-4, -2, 5, 1, k.saddle); px(6, -2, 2, 1, k.saddle); px(-8, -1, 2, 1, k.saddle); }
      if (k.prick) { px(4, -6, 1, 2, k.ear); px(5, -7, 1, 3, k.ear); }
    } else if (pose === 'sit') {
      px(-4, -4, 5, 4, k.c); px(0, -7, 4, 6, k.c); px(0, -7, 1, 6, k.l); px(1, -2, 1, 2, k.d); px(3, -2, 1, 2, k.d);
      px(1, -11, 5, 4, k.c); px(5, -9, 2, 2, k.l); px(6, -9, 1, 1, OUT); px(3, -10, 1, 1, OUT); px(1, -11, 2, 3, k.ear);
      px(-6, -1, 3, 1, k.c);
      if (k.patch) px(-3, -4, 2, 2, k.patch);
      if (k.saddle) { px(-4, -4, 4, 2, k.saddle); px(0, -7, 1, 3, k.saddle); px(5, -9, 2, 1, k.saddle); px(-6, -1, 2, 1, k.saddle); }
      if (k.prick) { px(1, -13, 1, 2, k.ear); px(2, -14, 1, 3, k.ear); px(2, -11, 1, 1, k.ear); }
    } else {
      const run = pose === 'run', sw = [[0, 1], [1, 0], [0, -1], [-1, 0]][frame % 4];
      px(-5, -7, 10, 4, k.c); px(-5, -7, 10, 1, k.l); px(-4, -4, 8, 1, k.belly);
      for (const [lx, s] of [[-4, sw[0]], [-2, -sw[0]], [2, sw[1]], [4, -sw[1]]]) px(lx + (run ? s : 0), -3, 1, 3, k.d);
      px(4, -10 + (run ? 1 : 0), 5, 4, k.c); px(8, -8 + (run ? 1 : 0), 2, 2, k.l); px(9, -8 + (run ? 1 : 0), 1, 1, OUT);
      px(6, -9 + (run ? 1 : 0), 1, 1, OUT); px(4, -10 + (run ? 1 : 0), 2, 3, k.ear);
      const wag = frame % 2;
      px(-6 - wag, -9, 1, 3, k.c); px(-7 - wag, -10, 1, 1, k.c);
      if (k.patch) px(-2, -7, 3, 2, k.patch);
      if (k.saddle) { // dark back and tail tip, black muzzle
        const dy = run ? 1 : 0;
        px(-4, -7, 7, 2, k.saddle); px(-5, -7, 1, 1, k.saddle); px(-7 - wag, -10, 1, 1, k.saddle);
        px(8, -8 + dy, 2, 1, k.saddle);
      }
      if (k.prick) { const dy = run ? 1 : 0; px(4, -12 + dy, 1, 2, k.ear); px(5, -13 + dy, 1, 3, k.ear); }
    }
  } else if (type === 'cat') {
    if (pose === 'curl') {
      px(-4, -3, 8, 3, k.c); px(-4, -3, 8, 1, k.l); px(2, -4, 3, 2, k.c); px(2, -5, 1, 1, k.c); px(4, -5, 1, 1, k.c);
      px(-4, 0, 7, 1, k.d); px(-2, -3, 1, 2, k.d); px(0, -3, 1, 2, k.d);
    } else if (pose === 'sit') {
      px(-2, -6, 4, 6, k.c); px(-2, -6, 1, 6, k.l); px(0, -5, 1, 3, k.d);
      px(-2, -9, 4, 3, k.c); px(-2, -10, 1, 1, k.c); px(1, -10, 1, 1, k.c); px(1, -8, 1, 1, '#3a8a30');
      px(-5, -1, 4, 1, k.c); px(-5, -2, 1, 1, k.c);
    } else {
      const arch = pose === 'arch', sw = [1, 0, -1, 0][frame % 4];
      px(-4, arch ? -7 : -5, 8, arch ? 2 : 3, k.c); px(-4, arch ? -7 : -5, 8, 1, k.l);
      px(-2, arch ? -7 : -5, 1, 2, k.d); px(1, arch ? -7 : -5, 1, 2, k.d);
      for (const [lx, s] of [[-3, sw], [-1, -sw], [2, sw], [3, -sw]]) px(lx + s, arch ? -5 : -2, 1, arch ? 5 : 2, k.d);
      px(3, arch ? -9 : -8, 4, 3, k.c); px(3, arch ? -10 : -9, 1, 1, k.c); px(6, arch ? -10 : -9, 1, 1, k.c);
      px(5, arch ? -8 : -7, 1, 1, '#3a8a30');
      px(-5, arch ? -11 : -8 + (frame % 2), 1, 4, k.c); px(-6, arch ? -12 : -9 + (frame % 2), 1, 1, k.c);
    }
  } else if (type === 'rabbit') {
    const hop = pose === 'hop' && frame % 2;
    if (hop) { px(-4, -6, 8, 3, k.c); px(-4, -6, 8, 1, k.l); px(-6, -4, 2, 1, k.d); px(3, -3, 1, 2, k.d); }
    else { px(-3, -4, 6, 4, k.c); px(-3, -4, 6, 1, k.l); px(-2, 0, 2, 0, k.d); }
    const hx = hop ? 3 : 1, hy = hop ? -8 : -7;
    px(hx, hy, 3, 3, k.c); px(hx + 2, hy + 1, 1, 1, OUT);
    px(hx, hy - 4, 1, 4, k.c); px(hx + 1, hy - 4, 1, 4, '#e8a0a8');
    px(hop ? -5 : -4, hop ? -6 : -4, 2, 2, '#ffffff');
  } else if (type === 'squirrel') {
    if (pose === 'sit') {
      px(-1, -5, 3, 5, k.c); px(0, -4, 1, 3, k.belly); px(-1, -7, 3, 2, k.c); px(1, -6, 1, 1, OUT); px(-1, -8, 1, 1, k.c);
      px(1, -3, 1, 1, '#8a5a2a');
      px(-4, -10, 3, 10, k.c); px(-4, -10, 1, 10, k.l); px(-3, -11, 2, 1, k.c);
    } else {
      const f = frame % 2;
      px(-2, -3 - f, 5, 2, k.c); px(2, -5 - f, 3, 2, k.c); px(4, -4 - f, 1, 1, OUT); px(2, -6 - f, 1, 1, k.c);
      px(-1, -1, 1, 1, k.d); px(2, -1, 1, 1, k.d);
      px(-5, -8 + f, 3, 6, k.c); px(-5, -8 + f, 1, 6, k.l); px(-4, -9 + f, 2, 1, k.c);
    }
  } else if (type === 'bird') {
    px(-2, -3, 4, 2, k.c); px(-2, -3, 4, 1, k.l); px(-3, -3, 1, 1, k.d);
    if (pose === 'fly') {
      px(2, -4, 2, 2, k.c); px(4, -3, 1, 1, '#f0b030'); px(3, -4, 1, 1, OUT);
      if (frame % 2) px(-1, -6, 3, 3, k.d); else px(-1, -1, 3, 2, k.d);
    } else {
      const peck = pose === 'peck' && frame % 2;
      px(2, peck ? -2 : -4, 2, 2, k.c); px(4, peck ? -1 : -3, 1, 1, '#f0b030'); px(3, peck ? -2 : -4, 1, 1, OUT);
      px(-1, -1, 1, 1, '#c08030'); px(1, -1, 1, 1, '#c08030');
    }
  }
  if (holding) { // the ball at the snout
    const [bx, bry] = pose === 'sit' ? [5, -10] : [8, pose === 'run' ? -8 : -9];
    px(bx, bry, 3, 3, '#3a7ad8'); px(bx, bry, 1, 1, '#9ac4ff'); px(bx + 2, bry + 2, 1, 1, '#24508a');
  }
  outline(c);
  spr = { cv: c, ax, by };
  animalCache.set(key, spr);
  return spr;
}

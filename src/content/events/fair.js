// Event: the fair (tent, carousel, ring toss).
import { ramp } from '../../core/color.js';
import { H, S } from '../../core/constants.js';
import { pick, rand, towardX } from '../../core/math.js';
import { P, disc, ellipse, mk, outline } from '../../core/pixels.js';

// The travelling fair: a striped tent, a hand-cranked carousel (8 frames) and a ring-toss stall.
export function makeFairTent() {
  const c = mk(40, 46), g = c.getContext('2d'), ax = 20, by = 44;
  const rd = ramp('#d03a3a'), wh = ramp('#f4ece0');
  P(g, ax - 1, by - 44, 1, 8, '#4a4a56'); P(g, ax, by - 44, 6, 4, '#f0c030'); P(g, ax, by - 42, 6, 1, '#d89a20');
  for (let y = by - 36; y < by; y++) {
    const t = (y - (by - 36)) / 36, half = Math.round(3 + t * 15);
    for (let x = -half; x <= half; x++) {
      const band = Math.floor(((x + half) / (2 * half + 1)) * 6) % 2;
      const shade = x > half * 0.5 ? 'd' : x < -half * 0.5 ? 'l' : 'm';
      P(g, ax + x, y, 1, 1, band ? wh[shade] : rd[shade]);
    }
  }
  for (let i = 0; i < 7; i++) { const sx = ax - 18 + i * 6, col = i % 2 ? wh.m : rd.m; P(g, sx, by - 14, 5, 1, col); P(g, sx + 1, by - 13, 3, 1, col); }
  P(g, ax - 4, by - 11, 9, 11, '#2a1a20'); P(g, ax - 4, by - 11, 2, 11, rd.d); P(g, ax + 3, by - 11, 2, 11, rd.d);
  outline(c);
  return { cv: c, ax, by };
}

export function makeCarousel(frame) {
  const c = mk(52, 54), g = c.getContext('2d'), ax = 26, by = 51;
  const gold = ramp('#e8b840'), rd = ramp('#d03a3a'), wh = ramp('#f4ece0'), wd = ramp('#9a6a3a');
  const horses = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (frame / 8) * (Math.PI / 3);
    horses.push({ x: Math.round(Math.cos(a) * 17), z: Math.sin(a), bob: Math.round(Math.sin(a * 2 + i) * 2), col: ['#f4ece0', '#e8b878', '#a8c8e8'][i % 3], kid: i % 3 === 1 ? ['#e86a3a', '#30a8a8', '#c85ac0'][i % 3] : null });
  }
  const drawHorse = (h) => {
    const x = ax + h.x, y = by - 16 + h.bob, hc = ramp(h.col);
    P(g, x, by - 40, 1, 30, gold.m);
    P(g, x - 3, y - 2, 7, 3, hc.m); P(g, x - 3, y - 2, 7, 1, hc.l); P(g, x + 3, y - 5, 2, 4, hc.m); P(g, x + 4, y - 6, 2, 2, hc.l);
    P(g, x - 3, y + 1, 1, 3, hc.d); P(g, x + 2, y + 1, 1, 3, hc.d); P(g, x - 4, y - 2, 1, 2, '#6a4a3a');
    if (h.kid) { P(g, x - 1, y - 6, 3, 4, h.kid); P(g, x - 1, y - 9, 3, 3, '#e8b48a'); P(g, x - 1, y - 10, 3, 1, '#4a2a18'); }
  };
  // platform
  ellipse(g, ax, by - 6, 23, 5, wd.d); ellipse(g, ax, by - 7, 23, 4, wd.m); ellipse(g, ax, by - 8, 21, 3, wd.l);
  horses.filter((h) => h.z < 0).forEach(drawHorse);
  P(g, ax - 2, by - 42, 4, 34, gold.d); P(g, ax - 1, by - 42, 1, 34, gold.h);
  horses.filter((h) => h.z >= 0).forEach(drawHorse);
  // striped cone roof with a scalloped rim and bulbs
  for (let y = by - 50; y < by - 40; y++) {
    const half = Math.round(2 + ((y - (by - 50)) / 10) * 22);
    for (let x = -half; x <= half; x++) P(g, ax + x, y, 1, 1, (Math.floor((x + half + frame) / 4) % 2 ? wh : rd)[x > half * 0.5 ? 'd' : 'm']);
  }
  for (let i = 0; i < 9; i++) { const sx = ax - 24 + i * 6, col = i % 2 ? wh.m : rd.m; P(g, sx, by - 40, 6, 1, col); P(g, sx + 1, by - 39, 4, 1, col); P(g, sx + 2, by - 41, 2, 1, '#fff2a0'); }
  P(g, ax - 1, by - 53, 3, 3, gold.l);
  outline(c);
  return { cv: c, ax, by };
}

export function makeTossStall() {
  const c = mk(34, 44), g = c.getContext('2d'), ax = 17, by = 42;
  const bl = ramp('#3a6ad0'), wh = ramp('#f4ece0'), wd = ramp('#9a6a3a');
  P(g, ax - 14, by - 36, 2, 36, wd.d); P(g, ax + 12, by - 36, 2, 36, wd.d);
  for (let r = 0; r < 6; r++) for (let i = ax - 16; i < ax + 16; i++) P(g, i, by - 42 + r, 1, 1, Math.floor((i - ax + 16) / 4) % 2 ? wh[r < 2 ? 'h' : 'm'] : bl[r < 2 ? 'l' : 'm']);
  for (let i = 0; i < 8; i++) { const sx = ax - 16 + i * 4, col = i % 2 ? wh.m : bl.m; P(g, sx, by - 36, 4, 1, col); P(g, sx + 1, by - 35, 2, 1, col); }
  // bottles to ring and prizes on the back shelf
  P(g, ax - 11, by - 22, 23, 1, wd.l);
  for (let k = 0; k < 6; k++) { const bx = ax - 10 + k * 4; P(g, bx, by - 27, 2, 5, ['#4a9a5a', '#c84a3a', '#d8a030'][k % 3]); P(g, bx, by - 28, 2, 1, '#e8e0d0'); }
  for (const [px, pc] of [[ax - 8, '#c88a5a'], [ax + 1, '#e8a0c0'], [ax + 8, '#8ac0e8']]) { disc(g, px, by - 31, 2, pc); P(g, px - 1, by - 34, 1, 1, pc); P(g, px + 1, by - 34, 1, 1, pc); }
  P(g, ax - 13, by - 14, 27, 3, wd.l); P(g, ax - 13, by - 14, 27, 1, wd.h);
  P(g, ax - 12, by - 11, 25, 11, bl.m); P(g, ax - 12, by - 11, 25, 1, bl.l);
  for (let x = ax - 10; x < ax + 12; x += 4) P(g, x, by - 9, 2, 7, wh.m);
  outline(c);
  return { cv: c, ax, by };
}
export const FAIR_AT = { tent: { x: 142.5, y: 114.8 }, carousel: { x: 155, y: 121.6 }, stall: { x: 167, y: 115.4 } };
export const fairPiece = (ev, k) => ev.progress >= { tent: 0.15, stall: 0.45, carousel: 0.75, pennants: 0.95 }[k];

export const fair = {
  label: 'Travelling fair', icon: '🎠', text: 'A travelling fair has come to town',
  crew: ['ringmaster', 'fairfolk', 'fairfolk', 'fairfolk'], weight: 1, hours: [13, 16.5], minutes: [90, 150],
  moods: ['work', 'meal', 'evening'], setupSecs: 40, packSecs: 25, extraVisitors: 3, draw: 0.6, maxVisitors: 6,
  suggest: ['fair', 'funfair', 'carnival', 'circus', 'carousel'],
  crewPlan(c, v, ev, i) {
    const { tent, carousel, stall } = FAIR_AT;
    const spots = [
      { x: tent.x + 1, y: tent.y + 1.6, face: 1 }, { x: carousel.x + 7.4, y: carousel.y - 0.4, face: -1 },
      { x: stall.x, y: stall.y - 3.6, face: -1 }, { x: carousel.x + rand(-4, 4), y: carousel.y + 2.6, face: pick([-1, 1]) },
    ];
    if (ev.stage === 'arrive') return { ...spots[i], carry: 'crate', drop: true, action: 'build', dur: 1.2, done: () => { v.ready = true; } };
    if (ev.stage === 'setup' || ev.stage === 'packup') return { ...spots[i], action: 'build', dur: 2 };
    if (ev.stage !== 'open') return null;
    const act = ['announce', 'crank', 'sell', 'juggle'][i];
    return {
      ...spots[i], action: act, dur: rand(6, 12),
      onArrive: () => { if (i === 0) c._spawn({ x: v.x + v.face * 3, y: v.y - 11, vx: 0, vy: -5, life: 1.6, g: 'bang', c: '#d03030', layer: 1 }); },
    };
  },
  visit(c, v) {
    const { carousel, stall } = FAIR_AT;
    if (!v.small && Math.random() < 0.45) {
      const x = stall.x + rand(-3, 3);
      return { x, y: stall.y + 2.4, face: towardX(x, stall.x), action: 'toss', dur: rand(4, 8), done: () => { if (Math.random() < 0.3) c._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -4, life: 1.4, g: 'star', c: '#f0c030', layer: 1 }); } };
    }
    const x = carousel.x + rand(-10, 10);
    return { x, y: Math.min(H - 1.5, carousel.y + rand(1.8, 3.4)), face: towardX(x, carousel.x), action: v.small ? 'cheer' : 'admire', dur: rand(5, 10) };
  },
  blocks(c, ev) {
    const out = [];
    if (ev.stage === 'arrive') return out;
    const { tent, carousel, stall } = FAIR_AT;
    if (fairPiece(ev, 'tent')) out.push([tent.x - 4.4, tent.y - 3, tent.x + 4.4, tent.y + 0.3]);
    if (fairPiece(ev, 'carousel')) out.push([carousel.x - 6.6, carousel.y - 4.6, carousel.x + 6.6, carousel.y + 0.3]);
    if (fairPiece(ev, 'stall')) out.push([stall.x - 4, stall.y - 3, stall.x + 4, stall.y + 0.3]);
    return out;
  },
  props(c, ev, add) {
    if (ev.stage === 'arrive') return;
    const { tent, carousel, stall } = FAIR_AT;
    if (fairPiece(ev, 'tent')) add(tent.x, tent.y, tent.y, c._eventArt('tent', makeFairTent));
    if (fairPiece(ev, 'stall')) add(stall.x, stall.y, stall.y, c._eventArt('stall', makeTossStall));
    if (fairPiece(ev, 'carousel')) {
      const spin = ev.stage === 'open' && ev.crew[1].action === 'crank' && !ev.crew[1].walking;
      const f = spin ? Math.floor(c._t * 5) % 8 : 0;
      add(carousel.x, carousel.y, carousel.y, c._eventArt(`carousel${f}`, () => makeCarousel(f)));
    }
    if (fairPiece(ev, 'pennants')) add(0, 0, tent.y + 0.1, c._eventArt('pennants', makeFairPennants));
  },
  // where the lights glow, so people standing in front are redrawn over them: [x, y, w, h] in px, and the depth line
  lightRects(c, ev, dark) {
    if (!dark || ev.stage === 'arrive') return [];
    const { carousel, stall } = FAIR_AT, out = [];
    if (fairPiece(ev, 'carousel')) out.push([carousel.x * S - 30, carousel.y * S - 48, 64, 16, carousel.y]);
    if (fairPiece(ev, 'stall')) out.push([stall.x * S - 16, stall.y * S - 48, 32, 32, stall.y]);
    return out;
  },
  lights(c, ctx, ev, dark) {
    if (!dark || ev.stage === 'arrive') return;
    const { carousel, stall } = FAIR_AT;
    if (fairPiece(ev, 'carousel')) for (let k = 0; k < 9; k++) c._glow(ctx, carousel.x * S - 22 + k * 6, carousel.y * S - 41, 7, '255,220,120', 0.5);
    if (fairPiece(ev, 'stall')) c._glow(ctx, stall.x * S, stall.y * S - 32, 16, '255,200,120', 0.45);
  },
};

// Pennant string from the tent's peak to the stall's awning, cropped to its box (anchored so add(0, 0) lands it).
export function makeFairPennants() {
  const { tent, stall } = FAIR_AT;
  const x0 = tent.x * S, y0 = tent.y * S - 38, x1 = stall.x * S - 14, y1 = stall.y * S - 40;
  const L = Math.floor(Math.min(x0, x1)) - 2, T = Math.floor(Math.min(y0, y1)) - 2;
  const c = mk(Math.ceil(Math.abs(x1 - x0)) + 8, Math.ceil(Math.abs(y1 - y0)) + 14), g = c.getContext('2d'), cols = ['#e04848', '#f0c040', '#40a0e0', '#50c060'];
  g.translate(-L, -T);
  const n = Math.round((x1 - x0) / 3);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 6);
    P(g, x, y, 3, 1, '#3a3030');
    if (i % 2 && i < n) { const cl = ramp(cols[(i >> 1) % cols.length]); P(g, x - 1, y + 1, 4, 2, cl.m); P(g, x, y + 3, 2, 1, cl.d); }
  }
  return { cv: c, ax: -L, by: -T };
}

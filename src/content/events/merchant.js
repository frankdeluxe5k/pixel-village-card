// Event: the travelling merchant with his mule and cart.
import { DAY_MOODS } from '../moods.js';
import { ramp } from '../../core/color.js';
import { S, W } from '../../core/constants.js';
import { rand, towardX } from '../../core/math.js';
import { P, disc, ellipse, line, mk, outline } from '../../core/pixels.js';
import { ENTRANCE } from '../../world/layout.js';

// All drawn facing the viewer, anchored at (ax, by) = centre of the ground line, then outlined.

// The travelling merchant's hand cart. stage 0: packed under a tarp (as it's pulled), 1: canopy up, 2: goods out.
export function makeMerchantCart(stage) {
  const c = mk(78, 66), g = c.getContext('2d'), ax = 44, by = 63;
  const wd = ramp('#9a6a3a'), dk = ramp('#6a4426'), cv = ramp('#e8dcb8'), st = ramp('#3a8a5a');
  // handles reach out to the left, toward whoever pulls it
  line(g, ax - 22, by - 13, ax - 40, by - 9, dk.m, 2); line(g, ax - 22, by - 16, ax - 40, by - 12, dk.l, 1);
  if (stage > 0) {
    P(g, ax - 23, by - 54, 2, 32, '#6a5a4a'); P(g, ax + 21, by - 54, 2, 32, '#6a5a4a');
    for (let r = 0; r < 7; r++) {
      for (let i = ax - 27; i < ax + 27; i++) {
        const stripe = Math.floor((i - ax + 27) / 6) % 2;
        P(g, i, by - 60 + r, 1, 1, stripe ? (r < 2 ? '#f6eed8' : cv.m) : (r < 2 ? st.l : st.m));
      }
    }
    for (let i = 0; i < 9; i++) { const sx = ax - 27 + i * 6 + 3, col = i % 2 ? cv.m : st.m; P(g, sx - 3, by - 53, 6, 1, col); P(g, sx - 2, by - 52, 4, 1, col); }
    P(g, ax - 28, by - 61, 56, 1, dk.d);
    // hanging shop sign
    P(g, ax - 6, by - 50, 1, 3, '#4a4a56'); P(g, ax + 5, by - 50, 1, 3, '#4a4a56');
    P(g, ax - 8, by - 47, 17, 7, wd.l); P(g, ax - 8, by - 47, 17, 1, wd.h); P(g, ax - 8, by - 41, 17, 1, wd.d);
    P(g, ax - 5, by - 45, 3, 3, '#d84a3a'); P(g, ax - 1, by - 45, 3, 3, '#f0b030'); P(g, ax + 3, by - 45, 3, 3, '#5aa84a');
  }
  // cart box with planks
  P(g, ax - 24, by - 26, 48, 3, wd.l); P(g, ax - 24, by - 24, 48, 1, wd.d);
  P(g, ax - 22, by - 23, 44, 13, wd.m); P(g, ax - 22, by - 23, 44, 1, wd.h); P(g, ax + 19, by - 23, 3, 13, wd.d);
  for (const y of [by - 19, by - 15]) P(g, ax - 22, y, 44, 1, wd.d);
  for (const x of [ax - 12, ax + 2]) P(g, x, by - 23, 1, 13, wd.d);
  if (stage === 0) {
    // goods under a tied-down tarp, the canopy rolled up on top
    ellipse(g, ax, by - 30, 21, 6, cv.d); ellipse(g, ax - 2, by - 31, 18, 5, cv.m); P(g, ax - 14, by - 34, 9, 2, cv.l);
    for (const x of [ax - 10, ax + 8]) P(g, x, by - 35, 1, 10, dk.m);
    P(g, ax - 18, by - 38, 36, 3, st.m); P(g, ax - 18, by - 38, 36, 1, st.l);
  } else if (stage > 1) {
    // fruit baskets, jars and bolts of cloth on the counter
    for (const [bx, cols] of [[ax - 18, ['#d84a3a', '#e86a4a', '#c83a2a']], [ax - 8, ['#f0a030', '#e88a20', '#f8c050']], [ax + 12, ['#6ab84a', '#5aa83a', '#8ad060']]]) {
      P(g, bx - 4, by - 30, 9, 4, dk.m); P(g, bx - 4, by - 30, 9, 1, dk.l);
      for (let k = 0; k < 5; k++) P(g, bx - 3 + (k % 3) * 3, by - 33 + Math.floor(k / 3) * 2, 2, 2, cols[k % 3]);
    }
    for (const [jx, jc] of [[ax + 1, '#5a8ad0'], [ax + 4, '#d8a040'], [ax + 7, '#a85ac0']]) { P(g, jx, by - 32, 2, 6, jc); P(g, jx, by - 33, 2, 1, '#e8e0d0'); P(g, jx, by - 31, 1, 2, '#ffffff'); }
    for (const [fx, fc] of [[ax - 16, '#c83a6a'], [ax - 9, '#3a7ac8'], [ax - 2, '#e8c040'], [ax + 5, '#5aa87a']]) {
      const f = ramp(fc); P(g, fx, by - 22, 6, 9, f.m); P(g, fx, by - 22, 6, 1, f.l); P(g, fx + 5, by - 22, 1, 9, f.d);
    }
  }
  for (const wx of [ax - 14, ax + 14]) {
    disc(g, wx, by - 7, 7, dk.o); disc(g, wx, by - 7, 6, dk.m); disc(g, wx, by - 7, 2, dk.d);
    P(g, wx - 6, by - 7, 13, 1, wd.l); P(g, wx, by - 13, 1, 13, wd.l); P(g, wx, by - 7, 1, 1, '#3a3a46');
  }
  outline(c);
  return { cv: c, ax, by };
}

// The merchant's mule, side view facing right. pose: 'walk' (frame 0-3), 'stand', 'swish' (tail), 'graze' (head down).
export function makeMule(pose, frame = 0) {
  const c = mk(36, 31), g = c.getContext('2d'), ax = 18, by = 30; // room for the ears and a swished tail
  const mc = ramp('#8a7866'), mane = '#3a2e26', pale = '#dcd0bc', hoof = '#2a2420', strap = ramp('#7a3a2a');
  // legs: slim, far pair a shade darker, a real stride in the walk
  const st = pose === 'walk' ? [[2, -2], [1, -1], [-2, 2], [-1, 1]][frame % 4] : [0, 0];
  const leg = (x, dx, col) => { line(g, x, by - 10, x + dx, by - 2, col, 1); line(g, x + 1, by - 10, x + 1 + dx, by - 2, col, 1); P(g, x + dx, by - 1, 2, 1, hoof); };
  leg(ax + 7, st[1], mc.d); leg(ax - 8, st[0], mc.d);
  leg(ax + 4, st[0], mc.m); leg(ax - 5, st[1], mc.m);
  // tail
  const sw = pose === 'swish' ? 3 : 0;
  line(g, ax - 11, by - 16, ax - 13 - sw, by - 10, mc.d, 1); P(g, ax - 14 - sw, by - 10, 2, 3, mane);
  // barrel with a rounded rump, pale belly, light along the back
  ellipse(g, ax - 1, by - 14, 10, 5, mc.m); ellipse(g, ax - 8, by - 15, 4, 4, mc.m);
  P(g, ax - 9, by - 19, 15, 1, mc.l); P(g, ax - 7, by - 11, 13, 2, '#b8a890'); P(g, ax - 10, by - 13, 2, 3, mc.d);
  // neck and head (lowered to graze)
  const graze = pose === 'graze';
  const hx = graze ? ax + 13 : ax + 11, hy = graze ? by - 7 : by - 23;
  line(g, ax + 6, by - 16, hx - 1, hy + 2, mc.m, 4); line(g, ax + 5, by - 19, hx - 3, hy, mane, 1);
  P(g, hx - 2, hy - 1, 6, 4, mc.m); P(g, hx - 2, hy - 1, 6, 1, mc.l); P(g, hx + 2, hy, 3, 3, pale); P(g, hx + 4, hy + 1, 1, 1, '#2a2420');
  P(g, hx - 1, hy, 1, 1, '#1c1220'); // eye
  line(g, hx - 2, hy - 1, hx - 3, hy - 6, mc.d, 1); line(g, hx, hy - 1, hx + 1, hy - 6, mc.m, 1); // long ears
  // collar and a strap over the back
  line(g, ax + 6, by - 19, ax + 7, by - 13, strap.m, 2); P(g, ax + 7, by - 15, 1, 1, '#e8c050');
  line(g, ax - 1, by - 19, ax - 1, by - 10, strap.d, 1);
  P(g, hx - 3, hy + 2, 2, 1, strap.m); // halter
  outline(c);
  return { cv: c, ax, by, halter: [hx - 3 - ax, hy + 2 - by] };
}
// Where things happen (sim units). Open ground, off the paths, away from doors and benches.
export const CART_AT = { x: 154, y: 116.6 };
export const MULE_LEAD = 16; // the merchant walks at the mule's head, this far ahead of the cart's centre
export const merchant = {
  label: 'Travelling merchant', icon: '🛒', text: 'A travelling merchant has set up shop',
  crew: ['merchant'], weight: 3, hours: [9, 15], minutes: [30, 50], moods: DAY_MOODS, setupSecs: 14, packSecs: 10,
  suggest: ['market', 'merchant', 'delivery', 'deliveries', 'packages?', 'parcels?', 'shopping', 'groceries'],
  // The rig always travels east: in by the west lane, out along the main road. So the mule is on the cart's
  // east side, well away from the pond, and nothing has to turn round.
  start(c, ev) { ev.data.parked = false; ev.crew[0].entry = 'west'; },
  instant(c, ev) { ev.data.parked = true; },
  crewPlan(c, v, ev) {
    const { x, y } = CART_AT, head = { x: x + MULE_LEAD, y: y + 0.9 }, stall = { x: x - 9.4, y: y + 0.5 };
    if (ev.stage === 'arrive') {
      v.leading = true;
      return { ...head, face: 1, action: 'idle', dur: 0.6, done: () => { v.leading = false; ev.data.parked = true; v.ready = true; } };
    }
    if (ev.stage === 'setup' || ev.stage === 'packup') return { ...stall, face: 1, action: 'build', dur: 2 };
    if (ev.stage === 'open') {
      return { ...stall, face: Math.random() < 0.75 ? 1 : -1, action: 'sell', dur: rand(4, 9), onArrive: () => { if (Math.random() < 0.3) v.bubble = { g: 'coin', c: '#c89a20', t: 1.4 }; } };
    }
    if (ev.data.parked) return { ...head, face: 1, action: 'hitch', dur: 1.2, done: () => { ev.data.parked = false; v.leading = true; } };
    return { x: W + MULE_LEAD + 12, y: ENTRANCE[1], gone: true, action: 'gone', dur: 9999 }; // drive on east, cart and all
  },
  visit(c, v) {
    const x = CART_AT.x + rand(-6, 6);
    return { x, y: CART_AT.y + rand(2.2, 3.4), face: towardX(x, CART_AT.x), action: 'browse', dur: rand(4, 8), onArrive: () => { if (Math.random() < 0.5) v.bubble = { g: Math.random() < 0.6 ? 'coin' : 'heart', c: '#c89a20', t: 1.4 }; } };
  },
  blocks: (c, ev) => (ev.data.parked ? [[142.5, 114.6, 161.5, 116.9], [CART_AT.x + 9, 115.5, CART_AT.x + 17.5, 117.3]] : []),
  props(c, ev, add) {
    const st = ev.progress < 0.4 ? 0 : ev.progress < 0.85 ? 1 : 2, m = ev.crew[0];
    const mule = (pose, f) => c._eventArt(`mule${pose}${f}`, () => makeMule(pose, f));
    if (ev.data.parked) {
      // hitched and patient: a tail swish now and then, a nibble of grass
      const k = Math.floor(c._t / 2.5) % 6, pose = k === 2 ? 'swish' : k === 4 || k === 5 ? 'graze' : 'stand';
      add(CART_AT.x, CART_AT.y, CART_AT.y, c._eventArt(`cart${st}`, () => makeMerchantCart(st)), true);
      add(CART_AT.x + MULE_LEAD - 3, CART_AT.y + 0.4, CART_AT.y + 0.4, mule(pose, 0));
      return;
    }
    if (!m.leading || m.gone) return;
    // on the road: the merchant leads the mule by a rope, the cart rolls along behind
    const mx = m.x - 3, my = m.y - 0.5, spr = mule(m.walking ? 'walk' : 'stand', m.walking ? Math.floor(c._t * 8) % 4 : 0);
    add(m.x - MULE_LEAD, m.y - 0.6, m.y - 0.62, c._eventArt('cart0', () => makeMerchantCart(0)), true);
    add(mx, my, my, spr);
    const hx = Math.round(mx * S) + spr.halter[0], hy = Math.round(my * S) + spr.halter[1];
    add(0, 0, m.y + 0.01, { cv: null, draw: (ctx) => line(ctx, hx, hy, Math.round(m.x * S) + (m.face > 0 ? -2 : 2), Math.round(m.y * S) - 12, '#6a4a2a', 1) });
  },
};

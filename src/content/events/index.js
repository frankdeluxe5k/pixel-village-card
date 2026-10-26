// The random events registry: one file per event, collected here. See CLAUDE.md "Random events".
import { artists } from './artists.js';
import { fair } from './fair.js';
import { landscapers } from './landscapers.js';
import { merchant } from './merchant.js';
import { salesman } from './salesman.js';
import { mulberry32 } from '../../core/math.js';
import { dayKey } from '../../core/time.js';

export const EVENTS = { merchant, salesman, artists, landscapers, fair };

export const EVENT_MODES = Object.keys(EVENTS).map((k) => `event:${k}`);
export const eventOfMode = (m) => (typeof m === 'string' && m.startsWith('event:') && EVENTS[m.slice(6)] ? m.slice(6) : null);
export function eventsForDay(key, seed = 42, freq = 'daily') {
  // walk forward from a week back so "not the same as yesterday" agrees with what yesterday really had
  const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100 - 1, d = key % 100;
  let last = null, out = [];
  for (let k = 7; k >= 0; k--) {
    out = eventsOnDay(dayKey(new Date(y, m, d - k)), seed, freq, last);
    if (out.length) last = out[out.length - 1].kind;
  }
  return out;
}
export function eventsOnDay(key, seed, freq, avoid) {
  const kinds = Object.keys(EVENTS);
  const r = mulberry32((Math.imul(key ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 1, 0xc2b2ae35)) >>> 0);
  r(); r();
  const n = freq === 'often' ? 3 : r() < (freq === 'rare' ? 0.3 : 0.88) ? 1 : 0;
  const out = [];
  let last = avoid;
  for (let i = 0; i < n; i++) {
    const pool = kinds.filter((k) => k !== last);
    let x = r() * pool.reduce((t, k) => t + EVENTS[k].weight, 0), kind = pool[pool.length - 1];
    for (const k of pool) if ((x -= EVENTS[k].weight) <= 0) { kind = k; break; }
    const E = EVENTS[kind];
    let a = E.hours[0] * 60, b = E.hours[1] * 60;
    if (n > 1) { // spread several events over the day
      const s0 = 8 * 60 + i * (600 / n), s1 = s0 + 600 / n;
      if (Math.min(b, s1) > Math.max(a, s0)) { a = Math.max(a, s0); b = Math.min(b, s1); } else { a = s0; b = s1; }
    }
    const start = Math.round(a + r() * (b - a)), dur = Math.round(E.minutes[0] + r() * (E.minutes[1] - E.minutes[0]));
    out.push({ kind, start, end: start + dur });
    last = kind;
  }
  return out;
}

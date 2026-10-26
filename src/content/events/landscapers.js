// Event: landscapers trimming shrubs and pruning trees.
import { SHRUBS } from '../../art/foliage.js';
import { DAY_MOODS } from '../moods.js';
import { ramp } from '../../core/color.js';
import { S, W } from '../../core/constants.js';
import { rand } from '../../core/math.js';
import { P, disc, line, mk, outline } from '../../core/pixels.js';

// A wooden ladder leaning on a tree, and the landscapers' wheelbarrow (fill 0 empty – 2 heaped with clippings).
export function makeLadder() {
  const c = mk(16, 34), g = c.getContext('2d'), ax = 8, by = 33, wd = ramp('#b8905a');
  line(g, ax - 5, by, ax - 1, by - 31, wd.m, 1); line(g, ax + 2, by, ax + 5, by - 31, wd.d, 1);
  for (let k = 1; k < 8; k++) { const y = by - k * 4, t = k / 8; line(g, Math.round(ax - 5 + 4 * t), y, Math.round(ax + 2 + 3 * t), y, wd.l, 1); }
  outline(c);
  return { cv: c, ax, by };
}

export function makeBarrow(fill) {
  const c = mk(30, 18), g = c.getContext('2d'), ax = 15, by = 16, tr = ramp('#3a7a5a'), wd = ramp('#8a5a30');
  line(g, ax - 13, by - 8, ax - 4, by - 6, wd.m, 1); line(g, ax - 12, by - 6, ax - 4, by - 4, wd.d, 1);
  line(g, ax - 6, by - 4, ax - 7, by, wd.d, 1);
  P(g, ax - 5, by - 9, 15, 5, tr.m); P(g, ax - 5, by - 9, 15, 1, tr.l); P(g, ax - 3, by - 4, 11, 1, tr.d);
  disc(g, ax + 8, by - 3, 3, '#3a3a46'); P(g, ax + 8, by - 3, 1, 1, '#9aa0aa');
  if (fill) {
    const lf = ['#3a7a2a', '#5a9a3a', '#7ab84a'];
    for (let k = 0; k < (fill > 1 ? 14 : 7); k++) P(g, ax - 4 + ((k * 5) % 13), by - 10 - (fill > 1 ? (k % 3) : 0) - (k % 2), 2, 2, lf[k % 3]);
  }
  outline(c);
  return { cv: c, ax, by };
}
export const PRUNE_TREES = [[160, 70], [197, 71]];

export const landscapers = {
  label: 'Landscapers', icon: '✂️', text: 'The landscapers are trimming the greenery',
  crew: ['landscaper', 'landscaper', 'landscaper'], weight: 2, hours: [8, 14], minutes: [40, 60], moods: DAY_MOODS, previewMins: 4,
  suggest: ['garden(er|ers|ing)?', 'lawn', 'landscap\\w*', 'mow(er|ing)?', 'yard ?work', 'hedges?'],
  start(c, ev) {
    c._trimToday();
    ev.data.todo = SHRUBS.map((sh, i) => i).filter((i) => SHRUBS[i][1] / S > 6 && SHRUBS[i][1] / S < W - 6).sort((a, b) => SHRUBS[a][1] - SHRUBS[b][1]);
    ev.data.trees = PRUNE_TREES.slice();
    ev.data.claim = new Map(); // worker → the shrub they're on
    ev.crew[1].pushing = true;
  },
  instant(c, ev) {
    const f = Math.min(1, (Date.now() - ev.startAt) / ev.dur);
    ev.data.todo.slice(0, Math.floor(f * ev.data.todo.length)).forEach((i) => c._trimmed.set.add(i));
    if (f > 0.5) ev.data.trees.shift();
  },
  crewPlan(c, v, ev, i) {
    if (ev.stage === 'arrive') v.ready = true;
    if (ev.stage === 'leave') return null;
    const d = ev.data, trimmed = c._trimmed.set, left = d.todo.filter((k) => !trimmed.has(k)).length + d.trees.length;
    d.claim.delete(v); // a new plan replaces whatever this worker was on
    if (!left) { c._eventStage('leave'); return null; }
    // spread the work over the time the event has left
    const per = Math.max(12, Math.min(240, (ev.endAt - Date.now()) / 1000 / Math.max(1, left / 3)));
    if (i === 2 && d.trees.length) {
      const [tx, ty] = d.trees[0];
      return { x: tx - 3.5, y: ty + 0.8, face: 1, carry: 'ladder', drop: true, action: 'prune', dur: per, done: () => { d.trees.shift(); } };
    }
    const taken = new Set(d.claim.values());
    const k = d.todo.find((j) => !trimmed.has(j) && !taken.has(j));
    if (k === undefined) return { ...c._wanderNear(v), action: 'idle', dur: rand(4, 8) };
    d.claim.set(v, k);
    const [, bx, by, br] = SHRUBS[k], cx = bx / S, off = (br * 5) / 2 / S + 1.6, side = cx + off < W - 3 ? 1 : -1;
    return { x: cx + side * off, y: by / S + 0.5, face: -side, action: 'trim', dur: per, done: () => { trimmed.add(k); d.claim.delete(v); } };
  },
  props(c, ev, add) {
    for (const v of ev.crew) {
      if (v.gone) continue;
      if (v.action === 'prune' && !v.walking) add(v.x + v.face * 2, v.y, v.y - 0.05, c._eventArt('ladder', makeLadder));
      if (v.pushing) {
        const fill = Math.min(2, Math.floor((c._trimmed.set.size / Math.max(1, ev.data.todo.length)) * 3));
        const bx = v.walking ? v.x + v.face * 8 : v.x - v.face * 7;
        add(bx, v.y, v.y - 0.03, c._eventArt(`barrow${fill}`, () => makeBarrow(fill)), v.walking ? v.face < 0 : v.face > 0);
      }
    }
  },
  // shrubs stay trimmed for the rest of the day
  keep(c, day, min) {
    c._trimToday();
    if (c._config.events !== false && !(c._event?.kind === 'landscapers') && c._daySchedule(day).some((e) => e.kind === 'landscapers' && e.end <= min)) {
      SHRUBS.forEach((sh, i) => c._trimmed.set.add(i));
    }
  },
};

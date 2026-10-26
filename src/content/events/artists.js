// Event: artists carving a sculpture by the farm.
import { DAY_MOODS } from '../moods.js';
import { ramp } from '../../core/color.js';
import { pick, rand, towardX } from '../../core/math.js';
import { P, ellipse, line, mk, outline } from '../../core/pixels.js';

// The artists' sculpture: 0 crates, 1 block in scaffolding, 2 roughed out, 3 under a sheet, 4 unveiled.
export function makeSculpture(variant, stage) {
  const c = mk(52, 70), g = c.getContext('2d'), ax = 26, by = 67;
  const stn = ramp('#a8a49a'), wd = ramp('#b8905a'), cu = ramp('#c8783a'), vg = ramp('#5aa890');
  const crate = (x, y) => { P(g, x, y, 11, 8, wd.m); P(g, x, y, 11, 1, wd.l); P(g, x, y + 4, 11, 1, wd.d); P(g, x + 10, y, 1, 8, wd.d); line(g, x + 1, y + 1, x + 9, y + 7, wd.d, 1); };
  if (stage === 0) {
    crate(ax - 14, by - 8); crate(ax - 2, by - 8); crate(ax - 8, by - 16);
    ellipse(g, ax + 10, by - 3, 6, 2, '#d8d4c8');
    outline(c);
    return { cv: c, ax, by };
  }
  // plinth
  P(g, ax - 11, by - 8, 22, 8, stn.d); P(g, ax - 11, by - 8, 22, 2, stn.l); P(g, ax - 12, by - 2, 24, 2, stn.o);
  if (stage === 4) { P(g, ax - 4, by - 5, 8, 2, '#d8b060'); P(g, ax - 3, by - 5, 6, 1, '#f0d890'); }
  const top = by - 8;
  if (stage <= 2) {
    // stone block, then the rough shape coming out of it
    if (stage === 1) { P(g, ax - 9, top - 34, 18, 34, stn.m); P(g, ax - 9, top - 34, 18, 2, stn.l); P(g, ax + 6, top - 34, 3, 34, stn.d); for (let k = 0; k < 6; k++) P(g, ax - 8 + (k * 5) % 15, top - 30 + k * 5, 2, 1, stn.d); }
    else drawSculptureForm(g, variant, ax, top, true);
    // scaffolding
    const sw = ramp('#8a6a40');
    for (const x of [ax - 14, ax + 13]) P(g, x, top - 40, 2, 40, sw.m);
    for (const y of [top - 38, top - 22, top - 8]) { P(g, ax - 14, y, 29, 2, sw.l); P(g, ax - 14, y + 1, 29, 1, sw.d); }
    line(g, ax - 13, top - 22, ax + 13, top - 8, sw.d, 1);
  } else if (stage === 3) {
    // draped sheet with folds and a ribbon
    const sh = ramp('#ece8e0');
    ellipse(g, ax, top - 20, 12, 20, sh.m); P(g, ax - 12, top - 14, 25, 14, sh.m);
    P(g, ax - 6, top - 30, 2, 30, sh.d); P(g, ax + 4, top - 26, 2, 26, sh.d); P(g, ax - 10, top - 36, 5, 3, sh.h);
    P(g, ax - 12, top - 10, 25, 2, '#d83a4a'); P(g, ax + 6, top - 12, 3, 6, '#d83a4a');
  } else drawSculptureForm(g, variant, ax, top, false);
  outline(c);
  return { cv: c, ax, by };
}

export function drawSculptureForm(g, variant, ax, top, rough) {
  const stn = ramp('#b0aca0'), cu = ramp('#c8783a'), vg = ramp('#5aa890');
  if (variant === 'leaf') {
    // a big copper aspen leaf on a stem, green patina in the veins
    P(g, ax - 1, top - 14, 3, 14, cu.d);
    ellipse(g, ax, top - 30, 13, 15, rough ? stn.m : cu.m);
    if (!rough) {
      ellipse(g, ax - 3, top - 34, 7, 8, cu.l); P(g, ax - 6, top - 40, 4, 3, cu.h);
      line(g, ax, top - 16, ax, top - 43, vg.m, 1);
      for (let k = 0; k < 4; k++) { line(g, ax, top - 20 - k * 6, ax - 9 + k, top - 26 - k * 6, vg.m, 1); line(g, ax, top - 20 - k * 6, ax + 9 - k, top - 26 - k * 6, vg.d, 1); }
      P(g, ax - 1, top - 46, 3, 3, cu.m);
    } else for (let k = 0; k < 7; k++) P(g, ax - 10 + (k * 7) % 20, top - 40 + k * 4, 2, 1, stn.d);
    return;
  }
  // stacked-stone elk: body, neck and head of rounded stones, copper antlers
  const rock = (x, y, rx, ry, k) => { ellipse(g, x, y, rx, ry, rough ? stn.d : [stn.m, ramp('#a89878').m, ramp('#9aa0a8').m][k % 3]); if (!rough) P(g, x - rx + 1, y - ry + 1, Math.max(2, rx), 1, stn.h); };
  for (const [x, y] of [[ax - 7, top - 1], [ax + 7, top - 1]]) { P(g, x - 1, y - 12, 3, 12, rough ? stn.d : stn.m); }
  rock(ax, top - 16, 12, 5, 0); rock(ax - 4, top - 22, 8, 4, 1); rock(ax + 6, top - 21, 6, 4, 2);
  rock(ax + 9, top - 28, 4, 4, 0); rock(ax + 11, top - 34, 5, 3, 1);
  if (!rough) {
    const an = cu;
    line(g, ax + 10, top - 37, ax + 6, top - 50, an.m, 2); line(g, ax + 13, top - 37, ax + 18, top - 49, an.m, 2);
    for (const [x0, y0, x1, y1] of [[ax + 7, top - 45, ax + 2, top - 48], [ax + 8, top - 41, ax + 3, top - 42], [ax + 16, top - 45, ax + 21, top - 47], [ax + 15, top - 41, ax + 20, top - 41]]) line(g, x0, y0, x1, y1, an.l, 1);
    P(g, ax + 13, top - 35, 1, 1, '#2a2a30');
  }
}
export const SCULPT_AT = { x: 70, y: 86.6 };

export const artists = {
  label: 'Visiting artists', icon: '🎨', text: 'Artists are making a sculpture',
  crew: ['artist', 'artist', 'artist'], weight: 2, hours: [9, 13], minutes: [40, 60], moods: DAY_MOODS, previewMins: 4,
  suggest: ['art', 'artists?', 'gallery', 'museum', 'sculpt\\w*', 'painting'],
  start(c, ev) { ev.data.variant = ['elk', 'leaf'][c._dayInfo().day % 2]; },
  tick(c, ev) {
    if (ev.stage !== 'open') return;
    ev.progress = Math.min(1, (Date.now() - ev.startAt) / ev.dur * 1.08);
    if (ev.progress >= 1 && !ev.data.unveiled) {
      ev.data.unveiled = true;
      for (let k = 0; k < 10; k++) c._spawn({ x: SCULPT_AT.x + rand(-5, 5), y: SCULPT_AT.y - 14, vx: rand(-8, 8), vy: rand(-14, -6), life: 1.4, g: k % 2 ? 'spark' : 'heart', c: k % 2 ? '#f0d040' : '#ff6080', layer: 1 });
      c._display = { variant: ev.data.variant, day: c._dayInfo().day };
      c._eventStage('leave');
    }
  },
  crewPlan(c, v, ev, i) {
    const { x, y } = SCULPT_AT, side = [[-5.6, 1], [5.8, -1], [0, 1]][i];
    if (ev.stage === 'arrive') return { x: x + side[0], y: y + 0.4, face: side[1], carry: 'crate', drop: true, action: 'build', dur: 1.5, done: () => { v.ready = true; } };
    if (ev.stage !== 'open') return null;
    if (ev.progress >= 0.9 || i === 2) {
      const ax = x + (i === 0 ? -8 : i === 1 ? 8 : pick([-9, 9]));
      return { x: Math.max(60, ax), y: y + rand(2.6, 3.6), face: towardX(ax, x), action: 'admire', dur: rand(4, 7), onArrive: () => { if (Math.random() < 0.3) v.bubble = { g: 'heart', c: '#e04060', t: 1.2 }; } };
    }
    return { x: x + side[0], y: y + 0.4, face: side[1], action: i === 1 && ev.progress > 0.45 ? 'paint' : 'chisel', dur: rand(6, 12) };
  },
  visit(c, v, ev) {
    if (ev && ev.progress < 0.3) return null;
    const ax = SCULPT_AT.x + (Math.random() < 0.5 ? rand(-10, -5) : rand(5, 10));
    return { x: Math.max(60, ax), y: SCULPT_AT.y + rand(4.2, 6.4), face: towardX(ax, SCULPT_AT.x), action: 'admire', dur: rand(4, 8), onArrive: () => { if (Math.random() < 0.4) v.bubble = { g: 'heart', c: '#e04060', t: 1.2 }; } };
  },
  blocks: (c, ev) => (!ev || ev.stage !== 'arrive' || ev.crew.some((v) => v.ready) ? [[SCULPT_AT.x - 4.2, 84.2, SCULPT_AT.x + 4.2, 86.9]] : []),
  props(c, ev, add) {
    const st = !ev ? 4 : ev.stage === 'arrive' ? 0 : ev.progress < 0.12 ? 0 : ev.progress < 0.4 ? 1 : ev.progress < 0.9 ? 2 : 3;
    if (ev && ev.stage === 'arrive' && !ev.crew.some((v) => v.ready)) return;
    const variant = ev ? ev.data.variant : c._display.variant;
    add(SCULPT_AT.x, SCULPT_AT.y, SCULPT_AT.y + 0.2, c._eventArt(`sculpt${variant}${st}`, () => makeSculpture(variant, st)));
  },
  // the finished piece stays on show for the rest of the day
  keep(c, day, min) {
    if (c._display && (c._display.day !== day || c._mode === 'sleep')) c._display = null;
    if (!c._display && c._mode !== 'sleep' && !(c._event?.kind === 'artists') && c._config.events !== false) {
      const done = c._daySchedule(day).find((e) => e.kind === 'artists' && e.end <= min);
      if (done) c._display = { variant: ['elk', 'leaf'][day % 2], day };
    }
  },
};

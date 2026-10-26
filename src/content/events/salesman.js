// Event: the door-to-door salesman.
import { DAY_MOODS } from '../moods.js';
import { HORIZON, W } from '../../core/constants.js';
import { pick, rand, towardX } from '../../core/math.js';
import { FIRE, HOUSES } from '../../world/layout.js';

export const salesman = {
  label: 'Door-to-door salesman', icon: '💼', text: 'A salesman is knocking on doors',
  crew: ['salesman'], weight: 2, hours: [10, 16], minutes: [20, 35], moods: DAY_MOODS,
  suggest: ['door ?bell', 'knock(ing)?', 'front door', 'salesman', 'visitor at the door'],
  start(c, ev) { ev.data.route = HOUSES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 4); },
  crewPlan(c, v, ev) {
    const route = ev.data.route;
    v.ready = true;
    if (ev.stage === 'leave' || Date.now() > ev.endAt - 45000) { if (ev.stage !== 'leave') c._eventStage('leave'); return null; }
    if (!route.length) {
      // between rounds of doors he works the street, or takes a breather by the fire
      const r = Math.random();
      const marks = c._villagers.filter((o) => o !== v && !o.eventKind && !o.inside && !o.gone && !o.walking && o.y > HORIZON + 10);
      if (r < 0.5 && marks.length) {
        const o = pick(marks), side = o.x > W - 12 ? -1 : o.x < 12 ? 1 : pick([-1, 1]);
        return {
          x: o.x + side * 5, y: o.y, face: -side, carry: 'case', action: 'pitch', dur: rand(4, 7),
          onArrive: () => { v.bubble = { g: 'coin', c: '#c89a20', t: 1.6 }; o.bubble = { g: 'dots', c: '#333', t: 1.6 }; },
          done: () => { if (Math.random() < 0.3) c._spawn({ x: o.x, y: o.y - 11, vx: 0, vy: -4, life: 1.4, g: 'star', c: '#f0c030', layer: 1 }); },
        };
      }
      if (r < 0.8) { const a = rand(0, Math.PI * 2), x = FIRE.x + Math.cos(a) * 21; return { x, y: FIRE.y + 1 + Math.sin(a) * 9, face: towardX(x, FIRE.x), carry: 'case', action: 'idle', dur: rand(8, 20) }; }
      route.push(...HOUSES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 3));
    }
    const hi = route[0], d = HOUSES[hi].door, at = { x: d.x + 2, y: d.y + 0.3, carry: 'case' };
    const next = () => { route.shift(); v.knocked = false; };
    if (!v.knocked) return { ...at, face: -1, action: 'knock', dur: 2, done: () => { v.knocked = true; } };
    if ((c._occ?.[hi]?.inside || 0) > 0) {
      return {
        ...at, face: -1, action: 'pitch', dur: rand(4, 6), onArrive: () => { v.bubble = { g: 'dots', c: '#333', t: 2 }; },
        done: () => { const sale = Math.random() < 0.35; c._spawn({ x: d.x, y: d.y - 10, vx: 0, vy: -4, life: 1.6, g: sale ? 'star' : 'cross', c: sale ? '#f0c030' : '#d84040', layer: 1 }); next(); },
      };
    }
    return { ...at, face: 1, action: 'shrug', dur: 1.6, onArrive: () => { v.bubble = { g: 'q', c: '#333', t: 1.4 }; }, done: next };
  },
};

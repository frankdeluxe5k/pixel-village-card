// Card: animal behaviour and drawing.
import { animalSprite } from '../art/animals.js';
import { S, W } from '../core/constants.js';
import { lerp, pick, rand } from '../core/math.js';
import { ENTRANCE, HOUSES } from '../world/layout.js';
import { blocked, freeSpot, route } from '../world/nav.js';
import { CAT_SPOTS, RABBIT_ZONES, TREE_BASES, birdSpot } from '../world/spots.js';

export const animalMethods = {
  _initAnimals(rnd) {
    this._animals = [];
    if (this._config.animals === false) return;
    const res = this._villagers.filter((v) => !v.guest);
    const add = (type, variant, extra = {}) => this._animals.push({
      type, variant, x: rand(60, 160), y: rand(100, 120), tx: 0, ty: 0, path: [], face: 1, speed: 12,
      state: 'idle', t: rand(0, 3), seed: rnd(), hidden: false, ...extra,
    });
    for (let i = 0; i < 2; i++) add('dog', i, { owner: res[(i * 2) % res.length] });
    add('cat', 0, { spot: 0 });
    add('rabbit', 0, { zone: 0 }); add('rabbit', 1, { zone: 1 }); add('rabbit', 0, { zone: 2 });
    add('squirrel', 0, { tree: 1 }); add('squirrel', 0, { tree: 3 });
    for (let i = 0; i < 5; i++) add('bird', i % 3, { alt: 0, flock: i });
    for (const a of this._animals) this._placeAnimal(a);
  },

  _placeAnimal(a) {
    if (a.type === 'dog') {
      const o = a.owner, d = HOUSES[o.home].door;
      a.hidden = !!o.gone; a.path = [];
      if (o.inside || o.gone) { a.x = d.x + 4; a.y = d.y + 2; a.state = 'lie'; } // waits on the doorstep
      else { [a.x, a.y] = freeSpot(o.x + rand(-4, 4), o.y + 2); a.state = 'idle'; }
    }
    else if (a.type === 'cat') { [a.x, a.y] = CAT_SPOTS[a.spot]; a.state = 'curl'; a.t = rand(5, 20); }
    else if (a.type === 'rabbit') { const z = RABBIT_ZONES[a.zone]; a.x = rand(z[0], z[2]); a.y = rand(z[1], z[3]); }
    else if (a.type === 'squirrel') { const tb = TREE_BASES[a.tree]; [a.x, a.y] = freeSpot(tb[0] + rand(-4, 4), tb[1] + rand(1, 3)); }
    else { const sp = birdSpot(); a.x = sp.x; a.y = sp.y; a.alt = sp.alt; a.state = 'perch'; }
  },

  _goAnimal(a, x, y, speed, state = 'walk', direct = false) {
    if (!direct) [x, y] = freeSpot(x, y); // never stop inside a house or an event's footprint
    a.path = direct ? [[x, y]] : route(a.x, a.y, x, y);
    [a.tx, a.ty] = a.path.shift();
    a.speed = speed; a.state = state;
  },

  _updateAnimals(dt) {
    const m = this._mode, night = m === 'sleep' || this._phase === 'night';
    const people = this._villagers.filter((v) => !v.inside && !v.gone);
    const near = (a, list, r) => list.find((o) => Math.hypot(o.x - a.x, o.y - a.y) < r);
    let dogs, threats; // built once a frame, when first needed
    for (const a of this._animals) {
      a.anim = (a.anim || 0) + dt;
      if (a.state === 'walk' || a.state === 'run' || a.state === 'hop' || a.state === 'fly') {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), step = a.speed * dt;
        if (Math.abs(dx) > 0.2) a.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          a.x = a.tx; a.y = a.ty;
          if (a.path.length) [a.tx, a.ty] = a.path.shift();
          else {
            a.state = a.rest || 'idle'; a.t = rand(2, 6);
            if (a.type === 'bird') a.alt = a.alt1 || 0;
            if (a.onArrive) { a.onArrive(); a.onArrive = null; }
          }
        } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
        if (a.type === 'bird' && a.state === 'fly') {
          const pr = Math.min(1, Math.max(0, 1 - d / (a.dist || 1)));
          a.alt = lerp(a.alt0 || 0, a.alt1 || 0, pr) + Math.sin(pr * Math.PI) * 14;
        }
        continue;
      }
      a.t -= dt;
      switch (a.type) {
        case 'dog': {
          const o = a.owner;
          if (o.gone) { a.hidden = a.hidden || (a.x > W + 4 || a.x < -4); if (!a.hidden && a.state !== 'run') this._goAnimal(a, W + 12, ENTRANCE[1] + 1, 20, 'run'); break; }
          if (a.hidden) { a.hidden = false; [a.x, a.y] = freeSpot(o.x + 3, o.y + 1); }
          if (o.inside) {
            const d = HOUSES[o.home].door;
            if (Math.hypot(a.x - d.x - 4, a.y - d.y - 2) > 1) this._goAnimal(a, d.x + 4, d.y + 2, 14, 'walk');
            else { a.state = 'lie'; if (m === 'sleep' && Math.random() < dt * 0.4) this._spawn({ x: a.x, y: a.y - 4, vx: 1.5, vy: -3, life: 2, g: 'z', c: '#e8ecff', layer: 1 }); }
            break;
          }
          const dist = Math.hypot(o.x - a.x, o.y - a.y);
          if (dist > 14) { this._goAnimal(a, o.x - o.face * 4, o.y + 1.5, 20, 'run'); a.rest = 'sit'; break; }
          if (a.t <= 0) {
            const r = Math.random();
            if (r < 0.35) { a.state = 'sit'; a.t = rand(3, 8); }
            else if (r < 0.7) { this._goAnimal(a, o.x + rand(-9, 9), o.y + rand(0, 4), 11, 'walk'); a.rest = 'idle'; }
            else if (r < 0.85) { const other = this._animals.find((b) => b.type === 'dog' && b !== a && !b.hidden); if (other) this._goAnimal(a, other.x + 3, other.y, 22, 'run'); a.rest = 'idle'; }
            else { a.state = 'idle'; a.t = rand(2, 4); this._spawn({ x: a.x + a.face * 3, y: a.y - 6, vx: 0, vy: -5, life: 0.8, g: 'bang', c: '#ffffff', layer: 1 }); }
          }
          break;
        }
        case 'cat': {
          const dog = near(a, (dogs ||= this._animals.filter((b) => b.type === 'dog' && !b.hidden)), 7);
          if (dog && a.state !== 'arch') {
            a.state = 'arch'; a.t = 0.6;
            break;
          }
          if (a.state === 'arch' && a.t <= 0) {
            let far = 0, fd = 0;
            CAT_SPOTS.forEach(([x, y], i) => { const d = Math.hypot(x - a.x, y - a.y); if (d > fd && !blocked(x, y)) { fd = d; far = i; } });
            a.spot = far; this._goAnimal(a, ...CAT_SPOTS[far], 24, 'run'); a.rest = 'sit';
            break;
          }
          if (a.t <= 0) {
            if (a.state === 'idle' || a.state === 'sit') { a.state = Math.random() < 0.6 ? 'curl' : 'sit'; a.t = night ? rand(4, 10) : rand(15, 45); }
            else {
              const open = CAT_SPOTS.map((_, i) => i).filter((i) => !blocked(...CAT_SPOTS[i]));
              a.spot = pick(open.length ? open : [0]); this._goAnimal(a, ...CAT_SPOTS[a.spot], 7, 'walk'); a.rest = 'sit';
            }
          }
          break;
        }
        case 'rabbit': case 'squirrel': {
          if (night || this._weather.heavy) { a.hidden = true; break; }
          if (a.hidden) { if (a.t <= 0) { a.hidden = false; this._placeAnimal(a); } break; }
          const threat = near(a, (threats ||= [...people, ...this._animals.filter((b) => b.type === 'dog' || b.type === 'cat')]), a.type === 'rabbit' ? 9 : 7);
          if (threat) {
            if (a.type === 'squirrel') {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, ...freeSpot(tb[0], tb[1] + 0.5), 22, 'hop');
              a.onArrive = () => { a.hidden = true; a.t = rand(8, 20); };
            } else {
              const ang = Math.atan2(a.y - threat.y, a.x - threat.x), z = RABBIT_ZONES[a.zone];
              const x = Math.max(z[0], Math.min(z[2], a.x + Math.cos(ang) * 8)), y = Math.max(z[1], Math.min(z[3], a.y + Math.sin(ang) * 4));
              if (Math.hypot(x - a.x, y - a.y) < 2) { a.hidden = true; a.t = rand(8, 16); }
              else this._goAnimal(a, x, y, 18, 'hop', true);
            }
            a.rest = 'idle';
            break;
          }
          if (a.t <= 0) {
            if (a.type === 'rabbit') {
              const z = RABBIT_ZONES[a.zone];
              this._goAnimal(a, Math.max(z[0], Math.min(z[2], a.x + rand(-5, 5))), Math.max(z[1], Math.min(z[3], a.y + rand(-2, 2))), 9, 'hop', true);
            } else if (Math.random() < 0.3) {
              const opts = TREE_BASES.map((_, i) => i).filter((i) => Math.hypot(TREE_BASES[i][0] - a.x, TREE_BASES[i][1] - a.y) < 50);
              a.tree = pick(opts.length ? opts : [a.tree]);
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, ...freeSpot(tb[0] + rand(-5, 5), tb[1] + rand(1, 4)), 16, 'hop');
            } else {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, ...freeSpot(tb[0] + rand(-6, 6), tb[1] + rand(1, 5)), 12, 'hop');
            }
            a.rest = Math.random() < 0.5 ? 'sit' : 'idle';
          }
          break;
        }
        case 'bird': {
          if (night || this._weather.rain) { a.hidden = true; break; }
          if (a.hidden) { a.hidden = false; a.state = 'perch'; this._placeAnimal(a); }
          const scared = near(a, people, 6);
          if (scared || a.t <= 0) {
            const sp = birdSpot();
            a.dist = Math.hypot(sp.x - a.x, sp.y - a.y) || 1;
            a.alt0 = a.alt || 0; a.alt1 = sp.alt;
            this._goAnimal(a, sp.x, sp.y, 30, 'fly', true);
            a.rest = 'perch';
            a.t = rand(4, 14);
            break;
          }
          if (a.state === 'perch' && Math.random() < dt * 0.6) { a.state = 'peck'; a.t = rand(1, 2); }
          else if (a.state === 'peck' && a.t <= 0) { a.state = 'perch'; a.t = rand(3, 10); }
          break;
        }
      }
    }
  },

  _animalPose(a) {
    a.anim ||= 0;
    const f = Math.floor(a.anim * (a.state === 'run' ? 12 : a.state === 'fly' ? 10 : 6) + a.seed * 10);
    switch (a.type) {
      case 'dog': return a.state === 'walk' || a.state === 'run' ? [a.state, f % 4] : a.state === 'lie' ? ['lie', 0] : a.state === 'sit' ? ['sit', 0] : ['stand', Math.floor(a.anim * 3) % 2];
      case 'cat': return a.state === 'walk' || a.state === 'run' ? ['walk', f % 4] : [a.state === 'idle' ? 'sit' : a.state, 0];
      case 'rabbit': return a.state === 'hop' ? ['hop', f % 2] : ['sit', 0];
      case 'squirrel': return a.state === 'hop' ? ['run', f % 2] : [a.state === 'sit' ? 'sit' : 'run', 0];
      default: return a.state === 'fly' ? ['fly', f % 2] : [a.state === 'peck' ? 'peck' : 'perch', f % 2];
    }
  },

  // [sprite canvas, x, y, mirrored] for this frame (kept on the animal, no allocation)
  _animalGeom(a) {
    if (a._geomFrame === this._frameNo && a._geom) return a._geom;
    a._geomFrame = this._frameNo;
    const [pose, frame] = this._animalPose(a), spr = animalSprite(a.type, a.variant, pose, frame);
    const lift = a.type === 'bird' ? Math.round((a.alt || 0) * S) : (a.state === 'hop' && frame ? 2 : 0);
    const g = (a._geom ||= [null, 0, 0, false]);
    g[0] = spr.cv; g[1] = Math.round(a.x * S) - spr.ax; g[2] = Math.round(a.y * S) - spr.by - lift; g[3] = a.face < 0;
    return g;
  },

  _drawAnimal(ctx, a) {
    const x = Math.round(a.x * S), y = Math.round(a.y * S);
    if (a.type !== 'bird' || !a.alt) { ctx.fillStyle = 'rgba(16,16,40,0.25)'; ctx.fillRect(x - 4, y, 9, 1); }
    else if (a.state !== 'fly') { ctx.fillStyle = 'rgba(16,16,40,0.25)'; ctx.fillRect(x - 3, y - Math.round(a.alt * S) + 1, 7, 1); }
    const [cv, sx, sy, flip] = this._animalGeom(a);
    if (!flip) ctx.drawImage(cv, sx, sy);
    else { ctx.setTransform(-1, 0, 0, 1, sx + cv.width, sy); ctx.drawImage(cv, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  },
};

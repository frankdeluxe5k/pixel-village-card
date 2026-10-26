// Card: the simulation step.
import { H, HORIZON, RW, S, W } from '../core/constants.js';
import { pick, rand } from '../core/math.js';
import { CART, FIRE, HOUSES, STUMP } from '../world/layout.js';

export const updateMethods = {
  _update(dt) {
    const t = this._t, mode = this._mode;
    for (const v of this._villagers) {
      if (v.bubble && (v.bubble.t -= dt) <= 0) v.bubble = null;
      if (v.jumpT > 0) v.jumpT = Math.max(0, v.jumpT - dt);
      if (v.rethinkAt && t >= v.rethinkAt) { v.rethinkAt = 0; this._think(v); }
      if (v.inside || v.gone) {
        if (v.inside && mode === 'sleep') v.slept = true;
        if (!v.rethinkAt && (v.actT -= dt) <= 0) this._think(v);
        continue;
      }
      if (v.walking) {
        const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
        const step = (v.bike ? 26 : v.speed) * (v.plan?.run ? 1.3 : 1) * dt;
        if (Math.abs(dx) > 0.3) v.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          v.x = v.tx; v.y = v.ty;
          if (v.path?.length) [v.tx, v.ty] = v.path.shift();
          else this._arrive(v);
        }
        else { v.x += (dx / d) * step; v.y += (dy / d) * step; }
        continue;
      }
      v.actT -= dt;
      if (v.action === 'build') this._buildEvent(dt);
      if (v.action === 'setup') this._screen = Math.min(1, this._screen + dt / 3);
      if (v.action === 'teardown') this._screen = Math.max(0, this._screen - dt / 3);
      if ((v.fxT -= dt) <= 0) this._actionFx(v);
      if (v.actT <= 0 && !v.rethinkAt) {
        v.plan?.done?.();
        this._think(v);
      }
    }

    // houses: chimney smoke and sleepy z's
    const occ = this._occupancy();
    const dark = this._phase !== 'day';
    HOUSES.forEach((h, i) => {
      const fx = this._houseFx[i], o = occ[i];
      const lit = this._isLit(i, o, dark);
      const smoky = lit || mode === 'morning' || (this._weather.snow && o.inside) || (h.tavern && (mode === 'meal' || mode === 'party'));
      o.lit = lit;
      if (smoky && (fx.smoke -= dt) <= 0) {
        fx.smoke = rand(0.35, 0.6);
        this._spawn({ x: h.chim.x + 1 + rand(-0.5, 0.5), y: h.chim.y, vx: rand(1, 3), vy: rand(-7, -5), life: rand(2.5, 3.5), c: '#d4d4d8', s: 1, layer: 0, grow: true });
      }
      if (o.sleeping && (fx.z -= dt) <= 0) {
        fx.z = rand(1.4, 2.2);
        this._spawn({ x: h.x + h.w - 4, y: h.base - h.h - 2, vx: rand(2, 4), vy: -4, life: 3, g: 'z', c: '#e8ecff', layer: 1 });
      }
    });
    this._occ = occ;

    // fire sparks and pot steam
    const lvl = this._fireLevel();
    if (lvl >= 2 && Math.random() < dt * (lvl === 3 ? 10 : 3)) {
      this._spawn({ x: FIRE.x + rand(-2, 2), y: FIRE.y - 3, vx: rand(-4, 4), vy: rand(-18, -10), life: rand(0.5, 1.2), c: pick(['#ffd84a', '#ff9a30']), layer: 1 });
    }
    if (this._potOn() && Math.random() < dt * 3) {
      this._spawn({ x: FIRE.x + rand(-2, 2), y: FIRE.y - 7, vx: rand(-1, 1), vy: -5, life: 1.5, c: '#f0f0f0', layer: 0 });
    }

    // particles (compacted in place)
    const ps = this._particles;
    let n = 0;
    for (const p of ps) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += 60 * dt;
      if (p.life > 0) ps[n++] = p;
    }
    ps.length = n;

    // sky
    for (const c of this._clouds) {
      c.x += c.v * dt * (this._weather.storm ? 3 : this._weather.wind ? 4 : 1);
      if (c.x > RW + 4) { c.x = -c.w - 8; c.y = rand(6, 80); }
    }
    for (const f of this._flies) {
      f.p += dt;
      f.x += Math.sin(f.p * 0.7) * 4 * dt;
      f.y += Math.cos(f.p * 0.9) * 3 * dt;
    }
    this._updateAnimals(dt);
    this._updateWeather(dt);
  },

  _actionFx(v) {
    const hx = v.x + 2 * v.face;
    switch (v.action) {
      case 'chop':
        v.fxT = 0.5;
        for (let i = 0; i < 2; i++) this._spawn({ x: STUMP.x, y: STUMP.y - 3, vx: rand(-12, 12), vy: rand(-25, -12), life: 0.6, c: '#d8a868', grav: true, layer: 0 });
        break;
      case 'farm':
        v.fxT = 0.5;
        this._spawn({ x: hx + v.face * 2, y: v.y - 1, vx: rand(-6, 6), vy: rand(-14, -8), life: 0.4, c: '#5e3e24', grav: true, layer: 0 });
        break;
      case 'water':
        v.fxT = 0.12;
        this._spawn({ x: hx + v.face, y: v.y - 3, vx: v.face * 4, vy: 4, life: 0.4, c: '#6ab0f0', grav: true, layer: 0 });
        break;
      case 'sweep':
        v.fxT = 0.4;
        this._spawn({ x: hx + v.face * 2, y: v.y, vx: v.face * 6, vy: -3, life: 0.6, c: '#c8b088', layer: 0 });
        break;
      case 'play': case 'perform':
        v.fxT = v.job === 'child' ? 99 : rand(0.6, 1);
        if (v.job !== 'child') this._spawn({ x: v.x + v.face * 3, y: v.y - 10, vx: rand(-3, 3), vy: -6, life: 2, g: 'note', c: pick(['#fff4a0', '#ffd0f0', '#c0f0ff']), layer: 1 });
        break;
      case 'chat':
        v.fxT = rand(1.8, 3);
        v.bubble = Math.random() < 0.15 ? { g: 'heart', c: '#e04060', t: 1.2 } : { g: 'dots', c: '#333', t: 1.2 };
        break;
      case 'dance':
        v.fxT = rand(1.5, 3);
        if (Math.random() < 0.3) this._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -5, life: 1.5, g: 'heart', c: '#ff6080', layer: 1 });
        break;
      case 'watch': {
        v.fxT = rand(3, 7);
        if (this._screen < 1) break;
        const sc = this._filmScene();
        if (sc === 2 && Math.random() < 0.5) this._spawn({ x: v.x, y: v.y - 10, vx: 0, vy: -4, life: 1.5, g: 'heart', c: '#ff6080', layer: 1 });
        else if (sc === 0 && Math.random() < 0.3) v.bubble = { g: 'bang', c: '#d03030', t: 1 };
        break;
      }
      case 'handheld': case 'controller':
        v.fxT = rand(2, 5);
        if (Math.random() < 0.15) v.bubble = { g: 'bang', c: '#d03030', t: 1 };
        else if (v.action === 'controller' && Math.random() < 0.12) { v.jumpT = 0.5; v.bubble = { g: 'heart', c: '#e04060', t: 1.4 }; }
        break;
      case 'serve': case 'sip': case 'laptop': {
        v.fxT = rand(1.2, 2.5);
        const sx = v.action === 'serve' ? CART.x / S + 2 : v.x + v.face * 3;
        this._spawn({ x: sx + rand(-0.5, 0.5), y: v.action === 'serve' ? CART.by / S - 11 : v.y - 5, vx: rand(-0.5, 0.5), vy: -3, life: 1.2, c: '#f4f4f4', layer: 0 });
        if (v.action === 'laptop' && Math.random() < 0.15) v.bubble = { g: 'dots', c: '#333', t: 1 };
        break;
      }
      case 'idle':
        v.fxT = rand(1.5, 4);
        if (Math.random() < 0.5) v.face = -v.face;
        break;
      // event crews
      case 'trim':
        v.fxT = 0.3;
        this._spawn({ x: hx + v.face * 4, y: v.y - 4, vx: v.face * rand(2, 8), vy: rand(-8, -2), life: 0.7, c: pick(['#3a7a2a', '#5a9a3a', '#7ab84a']), grav: true, layer: 0 });
        break;
      case 'prune':
        v.fxT = 0.4;
        this._spawn({ x: hx + v.face * 3, y: v.y - 15, vx: rand(-4, 4), vy: rand(0, 3), life: 1.4, c: pick(['#5a9a3a', '#e8c040', '#7ab84a']), layer: 0 });
        break;
      case 'chisel':
        v.fxT = 0.45;
        for (let i = 0; i < 2; i++) this._spawn({ x: hx + v.face * 3, y: v.y - 6, vx: rand(-10, 10), vy: rand(-20, -8), life: 0.5, c: pick(['#c8c4b8', '#a8a49a']), grav: true, layer: 0 });
        break;
      case 'paint':
        v.fxT = 0.6;
        this._spawn({ x: hx + v.face * 4, y: v.y - 8, vx: v.face * 3, vy: 2, life: 0.5, c: pick(['#e04848', '#3a8ae0', '#f0c030', '#3aa86a']), layer: 0 });
        break;
      case 'cheer': case 'admire': case 'browse':
        v.fxT = rand(2, 4);
        if (Math.random() < 0.3) this._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -5, life: 1.4, g: 'heart', c: '#ff6080', layer: 1 });
        break;
      case 'announce': case 'juggle': case 'crank': case 'sell':
        v.fxT = rand(1.5, 3);
        if (v.action === 'announce' && Math.random() < 0.5) this._spawn({ x: v.x + v.face * 3, y: v.y - 11, vx: rand(-2, 2), vy: -6, life: 1.6, g: 'note', c: pick(['#fff4a0', '#ffd0f0']), layer: 1 });
        break;
      case 'toss':
        v.fxT = rand(1.2, 2);
        this._spawn({ x: hx + v.face * 3, y: v.y - 8, vx: v.face * 14, vy: -10, life: 0.6, c: '#f0c030', grav: true, layer: 1 });
        break;
      default:
        v.fxT = 1;
    }
  },

  _occupancy() {
    const occ = HOUSES.map(() => ({ inside: 0, sleeping: 0 }));
    for (const v of this._villagers) {
      if (!v.inside || v.guest) continue;
      occ[v.home].inside++;
      if (this._mode === 'sleep') occ[v.home].sleeping++;
    }
    return occ;
  },

  _isLit(i, o, dark) {
    const m = this._mode;
    if (m === 'sleep') return false;
    if (o.inside) return true;
    if (HOUSES[i].tavern && (m === 'party' || m === 'meal')) return true;
    return dark && (m === 'evening' || m === 'party' || m === 'cozy');
  },

  _fireLevel() {
    const m = this._mode;
    if (m === 'away') return 0;
    if (m === 'party') return 3;
    if (m === 'morning' || m === 'meal' || m === 'evening') return this._weather.heavy ? 1 : 2;
    return 1;
  },

  _potOn() {
    return this._mode === 'morning' || this._mode === 'meal' || this._villagers.some((v) => v.action === 'cook');
  },

  _updateWeather(dt) {
    const w = this._weather;
    const want = w.rain ? (w.heavy ? 70 : 40) : w.snow ? 45 : 0;
    while (this._drops.length < want) {
      this._drops.push({ x: rand(0, W + 20), y: rand(-H, 0), land: rand(HORIZON, H), v: w.snow ? rand(8, 14) : rand(90, 130), snow: w.snow && !(w.rain && Math.random() < 0.5), hail: w.hail, p: rand(0, 6) });
    }
    if (this._drops.length > want) this._drops.length = want;
    for (const d of this._drops) {
      d.p += dt;
      d.y += d.v * dt;
      d.x += (d.snow ? Math.sin(d.p) * 6 : -14) * dt - (w.wind ? 30 * dt : 0);
      if (d.y > d.land) {
        if (!d.snow && this._splashes.length < 30) this._splashes.push({ x: d.x, y: d.land, t: 0.15 });
        d.hail = w.hail;
        d.y = rand(-10, 0); d.x = rand(0, W + 20);
      }
    }
    const sp = this._splashes;
    let n = 0;
    for (const s of sp) if ((s.t -= dt) > 0) sp[n++] = s;
    sp.length = n;
    if (w.storm) {
      this._flash = Math.max(0, this._flash - dt);
      if ((this._nextFlash -= dt) <= 0) { this._flash = 0.15; this._nextFlash = rand(5, 14); }
    }
  },

  _spawn(p) {
    if (this._particles.length < 220) this._particles.push(p);
  },

  _click(e) {
    const r = this._canvas.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * W, cy = ((e.clientY - r.top) / r.height) * H;
    const v = this._villagers.find((o) => !o.inside && !o.gone && Math.abs(o.x - cx) < 4 && cy > o.y - 11 && cy < o.y + 2);
    if (v) {
      v.jumpT = 0.5;
      v.bubble = { g: 'heart', c: '#e04060', t: 1.5 };
      return;
    }
    const h = HOUSES.findIndex((o) => cx >= o.x && cx <= o.x + o.w && cy > o.base - o.h - 9 && cy < o.base);
    if (h >= 0 && this._occ?.[h]?.sleeping) {
      for (let i = 0; i < 3; i++) this._spawn({ x: cx + rand(-3, 3), y: cy, vx: rand(-4, 4), vy: rand(-8, -4), life: 2, g: 'z', c: '#e8ecff', layer: 1 });
      return;
    }
    if (Math.abs(cx - FIRE.x) < 8 && Math.abs(cy - FIRE.y) < 8) {
      for (let i = 0; i < 14; i++) this._spawn({ x: FIRE.x, y: FIRE.y - 3, vx: rand(-15, 15), vy: rand(-30, -12), life: rand(0.6, 1.3), c: pick(['#ffd84a', '#ff9a30', '#ff5a20']), layer: 1 });
    }
  },
};

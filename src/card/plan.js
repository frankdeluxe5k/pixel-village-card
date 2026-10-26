// Card: what each villager does next.
import { HORIZON, S, W } from '../core/constants.js';
import { pick, rand } from '../core/math.js';
import { AMPHI_SEATS, BARISTA, CAFE_SEATS, ENTRANCE, FIRE, HOUSES, LEAF_SPOTS, SNOWMAN_AT, STAGE_SPOT, STUMP, WELL, farmSpot } from '../world/layout.js';
import { NAV, blocked, freeSpot, route } from '../world/nav.js';
import { SHRUBS } from '../art/foliage.js';

export const planMethods = {
  _plan(v) {
    const m = this._mode, r = Math.random(), job = v.job, n = this._villagers.length;
    const door = v.guest ? HOUSES[2].door : HOUSES[v.home].door;
    const home = (dur) => ({ x: door.x, y: door.y, enter: true, action: 'inside', dur });
    const seat = () => {
      // Two arcs either side of the fire, so nobody sits in it.
      const side = v.id % 2 ? -1 : 1, per = Math.ceil(n / 2), k = Math.floor(v.id / 2);
      const a = (per > 1 ? k / (per - 1) - 0.5 : 0) * 1.5 + rand(-0.1, 0.1);
      const x = FIRE.x + side * Math.cos(a) * 16, y = FIRE.y + 1 + Math.sin(a) * 8;
      return { x, y, face: -side };
    };
    const wander = () => {
      const r2 = Math.random();
      if (r2 < 0.55) {
        const pts = NAV.nodes.filter(([x]) => x > 8 && x < W - 8), [x, y] = pick(pts);
        return { x: x + rand(-1, 1), y: y + rand(-1, 1) };
      }
      if (r2 < 0.8) return { x: FIRE.x + rand(-20, 20), y: FIRE.y + rand(-7, 8) };
      return { x: rand(140, 166), y: rand(108, 124) };
    };
    const chat = () => {
      const others = this._villagers.filter((o) => o !== v && !o.inside && !o.gone && !o.walking);
      if (!others.length) return { ...wander(), action: 'idle', dur: rand(2, 4) };
      const o = pick(others);
      const side = o.x > W - 12 ? -1 : o.x < 12 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      return { x: o.x + side * 5, y: o.y, face: -side, action: 'chat', dur: rand(4, 8) };
    };
    const cook = () => ({ x: FIRE.x - 7, y: FIRE.y, face: 1, action: 'cook', dur: rand(8, 14) });
    const cafe = (action, dur) => {
      const taken = new Set(this._villagers.filter((o) => o !== v && o.plan?.seat !== undefined).map((o) => o.plan.seat));
      const free = CAFE_SEATS.map((_, i) => i).filter((i) => !taken.has(i));
      if (!free.length) return chat();
      const i = pick(free), st = CAFE_SEATS[i];
      return { x: st.x, y: st.y, face: st.face, seat: i, action, dur };
    };
    if (v.guest) return this._planGuest(v, { cafe, chat, wander });
    const rigger = this._villagers.find((o) => o.job === 'woodcutter') || this._villagers[0];
    const atScreen = { x: 20, y: 112.8, face: -1 };

    // Tidy up after an earlier mood before doing anything else (in away the screen carries the BACK SOON sign).
    if (m !== 'movie' && m !== 'gaming' && m !== 'away') {
      if (v === rigger && this._screen > 0) {
        return { ...atScreen, action: 'teardown', dur: 3 * this._screen + 0.3, done: () => { this._screen = 0; this._sign = 0; } };
      }
    }
    if (m !== 'away' && v.gear) return { x: door.x, y: door.y, action: 'unpack', dur: 0.8, done: () => { v.gear = false; } };

    switch (m) {
      case 'sleep': return home(rand(30, 60));
      case 'cozy': return home(rand(20, 40));
      case 'movie':
        if (v === rigger && this._screen < 1) {
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; } };
        }
        if (job === 'cook' && !this._popcorn) return { ...cook(), dur: 6, done: () => { this._popcorn = true; } };
        return { ...AMPHI_SEATS[v.id], action: 'watch', dur: rand(15, 30) };
      case 'gaming': {
        if (v === rigger && this._screen < 1) {
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; } };
        }
        // half the village plugs in at the amphitheater, the rest play handhelds at the café
        const idx = this._villagers.filter((o) => !o.guest).indexOf(v);
        if (job === 'cook' && r < 0.4) return { ...BARISTA, face: -1, action: 'serve', dur: rand(8, 14) };
        if (idx % 2 === 0 && idx < 8) return { ...AMPHI_SEATS[idx / 2], action: 'controller', dur: rand(20, 40) };
        return cafe('handheld', rand(15, 30));
      }
      case 'away': {
        if (!v.gear) return { x: door.x, y: door.y, action: 'pack', dur: rand(0.8, 1.6), done: () => { v.gear = true; } };
        // The last one out pulls the amphitheater screen down with a BACK SOON sign on it.
        const last = this._villagers.every((o) => o === v || o.guest || o.gone || o.plan?.gone);
        if (last && (this._sign !== 2 || this._screen < 1)) { // (again if someone started rolling it up)
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; this._sign = 2; } };
        }
        return { x: W + 12, y: ENTRANCE[1] + rand(-1, 1), gone: true, action: 'gone', dur: 60 };
      }
      case 'morning':
        // after a snowfall the first job is clearing the paths
        if (this._landSnow && job !== 'cook' && job !== 'child' && r < 0.4) return this._shovelPlan(v);
        if (job === 'cook') return cook();
        if (job === 'carrier') return this._carrierPlan(v);
        if (r < 0.3) return cafe('sip', rand(8, 14));
        if (r < 0.55) return { ...seat(), action: 'eat', dur: rand(6, 12) };
        if (r < 0.7) return chat();
        return { ...wander(), action: 'idle', dur: rand(3, 6) };
      case 'meal':
        if (job === 'cook') return cook();
        if (job === 'child' && r < 0.3) return { ...wander(), action: 'play', dur: rand(2, 4) };
        if (r < 0.8) return { ...seat(), action: 'eat', dur: rand(8, 16) };
        return chat();
      case 'evening': {
        const look = this._eventVisit(v);
        if (look && Math.random() < 0.3) return look;
      }
        if (job === 'child') return home(rand(30, 60));
        if (job === 'bard') return Math.random() < 0.5 ? { ...STAGE_SPOT, face: 1, action: 'perform', dur: rand(12, 20) } : { ...seat(), action: 'play', dur: rand(10, 20) };
        if (r < 0.2 && this._villagers.some((o) => o.action === 'perform')) return { ...AMPHI_SEATS[v.id], action: 'sit', dur: rand(10, 18) };
        if (r < 0.6) return { ...seat(), action: 'sit', dur: rand(8, 16) };
        if (r < 0.75) return cafe(Math.random() < 0.5 ? 'sip' : 'laptop', rand(10, 18));
        if (r < 0.9) return chat();
        return { ...wander(), action: 'idle', dur: rand(3, 6) };
      case 'party': {
        if (job === 'bard') return { x: FIRE.x + 21, y: FIRE.y - 9, face: -1, action: 'play', dur: rand(10, 20) };
        if (job === 'cook' && r < 0.3) return cook();
        v.ang += rand(0.5, 1.1);
        return {
          x: FIRE.x + Math.cos(v.ang) * 22, y: FIRE.y + 1 + Math.sin(v.ang) * 8,
          action: 'dance', dur: rand(1.5, 3.5),
        };
      }
      default: // work
        if (this._weather.heavy || (this._weather.rain && r < 0.35)) return home(rand(15, 30));
        {
          const chore = this._seasonChore(v, { chat });
          if (chore) return chore;
        }
        if (job !== 'cook' && Math.random() < (job === 'child' ? 0.35 : 0.12)) {
          const look = this._eventVisit(v);
          if (look) return look;
        }
        if (job !== 'child' && job !== 'cook' && Math.random() < (job === 'bard' ? 0.3 : 0.15)) {
          return cafe(Math.random() < 0.65 ? 'laptop' : 'sip', rand(10, 20));
        }
        switch (job) {
          case 'farmer':
            if (r < 0.15) return chat();
            return { ...farmSpot(), face: pick([-1, 1]), action: 'farm', dur: rand(5, 10) };
          case 'woodcutter':
            if (r < 0.65) return { x: STUMP.x - 5, y: STUMP.y, face: 1, action: 'chop', dur: rand(6, 12) };
            return { x: HOUSES[2].door.x + 5, y: HOUSES[2].base + 3, face: -1, carry: 'log', drop: true, action: 'idle', dur: 1.5 };
          case 'carrier': return this._carrierPlan(v);
          case 'cook':
            if (r < 0.4) return { ...BARISTA, face: -1, action: 'serve', dur: rand(8, 14) };
            if (r < 0.65) return { x: HOUSES[2].door.x + 6, y: HOUSES[2].base + 3, face: -1, action: 'sweep', dur: rand(6, 10) };
            if (r < 0.85 && this._season !== 'winter' && !this._landSnow) return { ...farmSpot(), face: pick([-1, 1]), action: 'farm', dur: rand(5, 8) };
            return chat();
          case 'bard':
            if (r < 0.5) return { ...wander(), action: 'play', dur: rand(6, 12) };
            if (r < 0.8) return chat();
            return { ...wander(), action: 'idle', dur: rand(3, 6) };
          default: // child
            if (r < 0.25) return chat();
            return { ...wander(), action: 'play', dur: rand(2, 4), run: true };
        }
    }
  },

  _carrierPlan(v) {
    if (!v.water) return { x: WELL.x + 7, y: WELL.y, face: -1, action: 'fetch', dur: 3, done: () => { v.water = true; } };
    // the garden needs the most water in late spring and summer, none once it's put to bed for the winter
    const L = this._look, toFarm = this._season === 'winter' || L?.melt ? 0 : L?.key === 'summer' || L?.key === 'spring-late' ? 0.75 : 0.5;
    const dest = Math.random() < toFarm
      ? farmSpot()
      : { x: FIRE.x - 7, y: FIRE.y + 3 };
    return { ...dest, face: pick([-1, 1]), carry: 'bucket', action: 'water', dur: 2.5, done: () => { v.water = false; } };
  },

  /* ----- seasonal chores ----- */

  // A seasonal job for a resident during the work day, or null for the usual routine.
  _seasonChore(v, { chat }) {
    const L = this._look, job = v.job, r = Math.random();
    if (!L) return null;
    if (v.harvested) { // bring the crate of pumpkins down to the tavern
      const d = HOUSES[2].door;
      return { x: d.x + 5, y: HOUSES[2].base + 3, face: -1, carry: 'pumpkins', drop: true, action: 'idle', dur: 1.5, done: () => { v.harvested = false; } };
    }
    if (this._landSnow) {
      if (job === 'child') return this._snowman < 3 && r < 0.5 ? this._snowmanPlan(v) : r < 0.8 ? this._snowballPlan(v) : null;
      if (job === 'farmer') return r < 0.5 ? this._shovelPlan(v) : this._firewoodPlan(v); // nothing to farm under the snow
      return r < (job === 'cook' ? 0.25 : 0.4) ? this._shovelPlan(v) : null;
    }
    switch (L.season) {
      case 'fall':
        if (job === 'child') return r < 0.45 ? this._leapPlan(v) : null;
        if (job === 'farmer' && L.key === 'fall-early' && r < 0.5) {
          return { ...farmSpot(), face: pick([-1, 1]), action: 'harvest', dur: rand(4, 6), done: () => { v.harvested = true; } };
        }
        if (job === 'woodcutter') return r < 0.3 ? this._firewoodPlan(v) : null;
        if (job === 'cook' || job === 'carrier' || job === 'bard' || job === 'farmer') return r < 0.3 ? this._rakePlan(v) : null;
        return null;
      case 'winter': // the garden is asleep: the farmer helps with the firewood
        if (job === 'woodcutter') return r < 0.35 ? this._firewoodPlan(v) : null;
        if (job === 'farmer') return r < 0.6 ? this._firewoodPlan(v) : chat();
        return null;
      case 'spring':
        if (job === 'farmer' && r < 0.4) return { ...farmSpot(), face: pick([-1, 1]), action: 'sow', dur: rand(5, 9) };
        if ((job === 'cook' || job === 'bard') && L.key === 'spring-late' && r < 0.15) {
          // scattering wildflower seed along a front fence
          const h = pick(HOUSES), side = pick([-1, 1]);
          return { x: h.door.x + side * 8, y: h.base + 3, face: side, action: 'sow', dur: rand(4, 7) };
        }
        return null;
    }
    return null;
  },

  _shovelPlan(v) {
    const h = HOUSES[v.home ?? 2] || HOUSES[2];
    return { x: h.door.x + rand(-3, 3), y: h.base + rand(3.5, 5), face: pick([-1, 1]), action: 'shovel', dur: rand(6, 11) };
  },

  _firewoodPlan(v) {
    const h = pick(HOUSES);
    return { x: h.door.x + 5, y: h.base + 3, face: -1, carry: 'log', drop: true, action: 'idle', dur: 1.5 };
  },

  _rakePlan(v) {
    const piles = this._piles, i = Math.floor(Math.random() * LEAF_SPOTS.length), [px, py] = LEAF_SPOTS[i], side = pick([-1, 1]);
    return { x: px + side * 6, y: py + rand(-0.5, 0.5), face: -side, action: 'rake', pile: i, dur: rand(6, 10), done: () => { piles[i] = Math.min(3, piles[i] + 1); } };
  },

  _leapPlan(v) {
    const piles = this._piles, full = piles.map((n, i) => i).filter((i) => piles[i] >= 2);
    if (!full.length) return null;
    const i = pick(full), [px, py] = LEAF_SPOTS[i];
    return { x: px + rand(-0.5, 0.5), y: py + 0.3, face: pick([-1, 1]), action: 'leap', pile: i, run: true, dur: rand(2, 3), done: () => { piles[i] = Math.max(0, piles[i] - 1); } };
  },

  _snowmanPlan(v) {
    const side = this._snowman >= 1 ? pick([-1, 1]) : -1;
    return { x: SNOWMAN_AT.x + side * 5, y: SNOWMAN_AT.y + 0.4, face: -side, action: 'snowman', dur: rand(5, 8), done: () => { this._snowman = Math.min(3, this._snowman + 1); this._melt = 0; } };
  },

  _snowballPlan(v) {
    const others = this._villagers.filter((o) => o !== v && !o.inside && !o.gone && !o.walking && !o.guest && o.y > HORIZON + 10);
    if (!others.length) return null;
    const o = others.find((x) => x.job === 'child') || pick(others), side = o.x > W - 20 ? -1 : o.x < 20 ? 1 : pick([-1, 1]);
    const [x, y] = freeSpot(o.x + side * 13, o.y + rand(-1, 1));
    return { x, y, face: -side, action: 'throw', target: o, dur: rand(3, 5) };
  },

  // Leaf piles and the snowman between plans: piles go once fall is over, the snowman melts without snow.
  _tickSeason(dt) {
    for (let i = this._hits.length - 1; i >= 0; i--) { // snowballs landing
      const { o, t } = this._hits[i];
      if (this._t < t) continue;
      this._hits.splice(i, 1);
      if (o.inside || o.gone) continue;
      o.bubble = { g: 'bang', c: '#3a6ad0', t: 0.8 };
      for (let k = 0; k < 4; k++) this._spawn({ x: o.x, y: o.y - 6, vx: rand(-10, 10), vy: rand(-14, -4), life: 0.4, c: '#ffffff', grav: true, layer: 1 });
    }
    if (this._season !== 'fall' && this._piles.some((n) => n)) this._piles.fill(0);
    if (this._snowman > 0 && !this._landSnow && (this._melt += dt) > 40) { this._melt = 0; this._snowman--; }
  },

  // Leaves drifting down from the aspens and oaks in fall.
  _fallingLeaves(dt) {
    const L = this._look;
    if (L?.season !== 'fall' || this._landSnow || this._weather.heavy) return;
    const rate = (L.leaves > 1 ? 0.9 : 0.5) * (this._weather.wind ? 2.5 : 1);
    if (Math.random() > rate * dt || this._leafCount >= 8) return;
    const src = Math.random() < 0.7 ? pick([[160, 70, 12], [88, 64, 10], [197, 71, 10]]) : (() => { const sh = pick(SHRUBS.filter(([k]) => k === 'gambel')); return [sh[1] / S, sh[2] / S, 4]; })();
    const [tx, ty, hgt] = src, fallH = rand(3, hgt), vy = rand(2.5, 4);
    this._spawn({ x: tx + rand(-4, 4), y: ty - fallH, vx: rand(0.5, 2) * (this._weather.wind ? 3 : 1), vy, life: fallH / vy, c: pick(['#f4c838', '#d8a020', '#c0501c', '#e8b830']), layer: 0, leaf: true });
  },

  _think(v) {
    let p = this._plan(v);
    if (v.inside && !p.enter) {
      v.inside = false;
      const d = HOUSES[v.home].door;
      v.x = d.x; v.y = d.y;
      if (v.slept) p = { x: d.x + rand(-4, 4), y: d.y + 3, face: pick([-1, 1]), action: 'stretch', dur: rand(2, 4) };
      v.slept = false;
    }
    if (v.inside) { v.plan = p; v.actT = p.dur; return; }
    if (v.gone && !p.gone) {
      v.gone = false;
      if (v.guest && v.entry === 'west') { v.x = -rand(6, 16); v.y = 93; }
      else { v.x = W + rand(6, 20); v.y = ENTRANCE[1] + rand(-1, 1); }
      if (!v.guest) v.bubble = { g: 'heart', c: '#e04060', t: 2 };
    }
    if (v.gone) {
      // told to leave before they ever walked on: they never arrive, so retire them here
      if (v.guest && p.gone && v.active) this._retireGuest(v);
      v.plan = p; v.actT = p.dur; return;
    }
    v.plan = p;
    [p.x, p.y] = freeSpot(p.x, p.y);
    v.path = route(v.x, v.y, p.x, p.y);
    [v.tx, v.ty] = v.path.shift();
    v.carry = p.carry || null;
    v.walking = true;
    v.action = 'walk';
  },

  _arrive(v) {
    const p = v.plan;
    v.walking = false;
    if (p.enter) v.inside = true;
    if (p.gone) { v.gone = true; if (v.guest) this._retireGuest(v); }
    if (p.face) v.face = p.face;
    if (p.drop) v.carry = null;
    p.onArrive?.();
    v.action = p.action;
    v.actT = p.dur;
    v.fxT = rand(0, 0.5);
    // the spot was free when the walk began, but something (an event's stall) has gone up there since
    if (!v.inside && !v.gone && !v.rethinkAt && blocked(v.x, v.y)) v.rethinkAt = this._t + 0.2;
  },
};

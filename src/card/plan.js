// Card: what each villager does next.
import { W } from '../core/constants.js';
import { pick, rand } from '../core/math.js';
import { AMPHI_SEATS, BARISTA, CAFE_SEATS, ENTRANCE, FIRE, HOUSES, STAGE_SPOT, STUMP, WELL, farmSpot } from '../world/layout.js';
import { NAV, blocked, freeSpot, route } from '../world/nav.js';

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
            if (r < 0.85) return { ...farmSpot(), face: pick([-1, 1]), action: 'farm', dur: rand(5, 8) };
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
    const dest = Math.random() < 0.6
      ? farmSpot()
      : { x: FIRE.x - 7, y: FIRE.y + 3 };
    return { ...dest, face: pick([-1, 1]), carry: 'bucket', action: 'water', dur: 2.5, done: () => { v.water = false; } };
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

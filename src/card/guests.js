// Card: visitors, the mail carrier and the band.
import { BAND_LOOKS } from '../content/band.js';
import { CREW_LOOKS } from '../content/crew-looks.js';
import { LOOKS } from '../content/jobs.js';
import { W } from '../core/constants.js';
import { pick, rand } from '../core/math.js';
import { AWAY_READ, BAND_SPOTS, ENTRANCE, FIRE, GUEST_SEATS, HOUSES } from '../world/layout.js';

export const guestMethods = {
  _makeGuest(job, rnd, extra = {}) {
    const p = (arr) => arr[Math.floor(rnd() * arr.length)];
    const id = this._villagers.length;
    const look = job === 'mail'
      ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), shirt: '#3a5a9a', pants: '#2a3a5a', style: 'short' }
      : job === 'band'
        ? { skin: p(LOOKS.skin), ...BAND_LOOKS[extra.instrIdx] }
        : CREW_LOOKS[job]
          ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), ...CREW_LOOKS[job](p, rnd, extra.crewIdx || 0) }
          : {
          skin: p(LOOKS.skin), hair: p(LOOKS.hair), style: rnd() < 0.4 ? 'long' : 'short', beard: rnd() < 0.15,
          shirt: p(['#e85a5a', '#5a8ae8', '#e8c04a', '#8a5ac8', '#4ab8a0', '#e88a3a', '#d0d0d8', '#6a9a3a']),
          pants: p(['#3a3a48', '#4a5a8a', '#6a5040', '#2a4a3a', '#7a6a5a']),
        };
    const v = {
      id, job, guest: true, home: null, look, sprites: new Map(), small: false,
      speed: rand(9, 12), seed: rnd(), x: W + 20, y: ENTRANCE[1], tx: 0, ty: 0, face: -1,
      walking: false, action: 'gone', actT: 9999, fxT: 0, rethinkAt: 0,
      inside: false, gone: true, active: false, carry: null, bubble: null, jumpT: 0, ang: rnd() * 6,
      ...extra,
    };
    if (job === 'visitor') {
      v.hat = p([null, null, 'sunhat', 'beanie', 'cap']);
      v.gear = rnd() < 0.35; // hikers with backpacks and walking sticks
    }
    if (job === 'band' || CREW_LOOKS[job]) v.hat = look.hat;
    this._villagers.push(v);
    return v;
  },

  _activate(v, stay, delay = 0) {
    v.active = true; v.leaving = false; v.readSign = false;
    v.stayUntil = this._t + delay + stay;
    v.entry = v.job === 'visitor' && Math.random() < 0.3 ? 'west' : 'east';
    if (v.job === 'mail') {
      const homes = [...new Set(this._villagers.filter((o) => !o.guest).map((o) => o.home))].sort(() => Math.random() - 0.5);
      v.route = homes.slice(0, 2 + Math.floor(Math.random() * 2)).map((h) => ({ h, pkg: Math.random() < 0.35 }));
      v.mstage = 'ride'; v.bike = true; v.parked = null;
    }
    v.rethinkAt = this._t + 0.1 + delay;
  },

  _spawnGuests() {
    const cfg = this._config, m = this._mode, t = this._t;
    this._spawnEvents();
    if (cfg.visitors === false) return;
    {
      let target = { sleep: 0, cozy: 0, away: 1, morning: 2, work: 3, meal: 3, evening: 4, movie: 5, gaming: 4, party: 6 }[m] ?? 2;
      if (this._event?.stage === 'open') target += this._event.E.extraVisitors || 0;
      const vis = this._villagers.filter((v) => v.job === 'visitor');
      if (vis.filter((v) => v.active).length < target && t > (this._nextGuest || 0)) {
        const free = vis.filter((v) => !v.active && v.gone);
        if (free.length) this._activate(pick(free), rand(70, 220));
        this._nextGuest = t + rand(5, 14);
      }
    }
    const mail = this._villagers.find((v) => v.job === 'mail');
    if (mail && !mail.active && ['morning', 'work', 'meal'].includes(m) && t > this._nextMail) {
      this._activate(mail, 999);
      this._nextMail = t + rand(240, 720);
    }
    if (m === 'party') this._villagers.filter((v) => v.job === 'band' && !v.active).forEach((v, i) => this._activate(v, 9999, i * 1.3));
  },

  _planGuest(v, { cafe, chat, wander }) {
    const m = this._mode, r = Math.random();
    const out = () => {
      const west = v.entry === 'west' ? Math.random() < 0.7 : Math.random() < 0.2;
      return { x: west ? -12 : W + 12, y: west ? 93 : ENTRANCE[1], gone: true, action: 'gone', dur: 9999 };
    };
    if (!v.active) return out();
    if (v.leaving) return out();
    const leave = () => { v.leaving = true; return out(); };
    if (v.eventKind) {
      const ev = this._event;
      if (!ev || ev.kind !== v.eventKind) return leave();
      return ev.E.crewPlan(this, v, ev, ev.crew.indexOf(v)) || leave();
    }
    if (v.job === 'band') return m === 'party' ? { ...BAND_SPOTS[v.instrIdx], action: 'perform', dur: rand(20, 40) } : leave();
    if (v.job === 'mail') return this._planMail(v, leave);
    if (m === 'cozy') { // everyone's snug indoors: visitors head into the tavern to warm up
      const d = HOUSES[2].door;
      return { x: d.x, y: d.y, gone: true, action: 'gone', dur: 9999 };
    }
    if (m === 'sleep' || this._t > v.stayUntil) return leave();
    const fireSpot = (action) => {
      const a = rand(0, Math.PI * 2), x = FIRE.x + Math.cos(a) * 21, y = FIRE.y + 1 + Math.sin(a) * 9;
      return { x, y, face: x < FIRE.x ? 1 : -1, action, dur: rand(10, 20) };
    };
    // something's going on in the village: visitors drift over to see it
    const look = this._eventVisit(v);
    if (look && Math.random() < (this._event?.E.draw ?? 0.4)) return look;
    switch (m) {
      case 'party':
        if (r < 0.7) {
          v.ang += rand(0.5, 1.1);
          return { x: FIRE.x + Math.cos(v.ang) * 24, y: FIRE.y + 1 + Math.sin(v.ang) * 9, action: 'dance', dur: rand(1.5, 3.5) };
        }
        return r < 0.85 ? cafe('sip', rand(8, 14)) : chat();
      case 'gaming':
        if (r < 0.5) return cafe('handheld', rand(15, 30));
      // falls through: the rest watch the big screen
      case 'movie': {
        const taken = new Set(this._villagers.filter((o) => o !== v && o.plan?.gseat !== undefined).map((o) => o.plan.gseat));
        const free = GUEST_SEATS.map((_, i) => i).filter((i) => !taken.has(i));
        if (free.length) { const i = pick(free); return { ...GUEST_SEATS[i], gseat: i, action: m === 'gaming' ? 'sit' : 'watch', dur: rand(20, 40) }; }
        return chat();
      }
      case 'away':
        if (!v.readSign && this._sign === 2) {
          v.readSign = true;
          return { ...AWAY_READ, face: -1, action: 'idle', dur: 3, onArrive: () => { v.bubble = { g: 'dots', c: '#333', t: 2.5 }; } };
        }
        return leave();
      case 'evening':
        if (r < 0.5) return fireSpot('sit');
        return r < 0.75 ? cafe(Math.random() < 0.5 ? 'sip' : 'laptop', rand(10, 18)) : chat();
      case 'meal':
        if (r < 0.5) return fireSpot('eat');
        return r < 0.8 ? cafe('sip', rand(8, 14)) : chat();
      default:
        if (r < 0.35) return cafe(Math.random() < 0.6 ? 'sip' : 'laptop', rand(10, 20));
        if (r < 0.6) return { ...wander(), action: 'idle', dur: rand(3, 7), onArrive: () => { if (Math.random() < 0.4) v.bubble = { g: 'bang', c: '#3a8a3a', t: 1.2 }; } };
        if (r < 0.72) return fireSpot('sit');
        if (r < 0.88) return chat();
        return { x: HOUSES[2].door.x - 4, y: HOUSES[2].base + 3, face: 1, action: 'idle', dur: rand(3, 6) };
    }
  },

  _planMail(v, leave) {
    if (!v.route.length) return leave();
    const stop = v.route[0], h = HOUSES[stop.h], d = h.door;
    if (v.mstage === 'ride') {
      const park = { x: d.x + 6, y: d.y + 3 };
      return {
        ...park, face: -1, action: 'park', dur: 0.6,
        done: () => { v.bike = false; v.parked = { ...park, face: -1 }; v.mstage = 'walk'; },
      };
    }
    if (v.mstage === 'walk') {
      return {
        x: d.x + 1, y: d.y, face: -1, carry: stop.pkg ? 'package' : 'mail', action: 'deliver', dur: 1.4,
        onArrive: () => this._spawn({ x: d.x, y: d.y - 9, vx: 0, vy: -4, life: 1.6, g: stop.pkg ? 'box' : 'mail', c: '#ffffff', layer: 1 }),
        done: () => { v.carry = null; v.mstage = 'back'; },
      };
    }
    return {
      x: v.parked.x - 1, y: v.parked.y, face: 1, action: 'mount', dur: 0.5,
      done: () => { v.bike = true; v.parked = null; v.route.shift(); v.mstage = 'ride'; },
    };
  },

  // A guest who has left (or never made it on screen) is free for the next visit.
  _retireGuest(v) {
    v.active = false; v.leaving = false; v.bike = false; v.pulling = false; v.pushing = false; v.leading = false; v.parked = null;
    v.sprites.clear();
  },
};

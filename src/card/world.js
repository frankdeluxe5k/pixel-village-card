// Card: building the village, time and mood.
import { INSTRUMENTS } from '../content/band.js';
import { EVENTS, eventOfMode } from '../content/events/index.js';
import { JOBS, LOOKS } from '../content/jobs.js';
import { MODES, scheduleMode } from '../content/moods.js';
import { H, HORIZON, RW, W } from '../core/constants.js';
import { mulberry32, rand } from '../core/math.js';
import { seasonOf } from '../core/time.js';
import { activatedAt, evalReactions, reactionKind } from '../ha/reactions.js';
import { autoWeather, isLive, readWeather } from '../ha/weather.js';
import { FIRE, HOUSES } from '../world/layout.js';

export const worldMethods = {
  _initVillage() {
    const n = Math.max(1, Math.min(10, Math.floor(Number(this._config.villagers)) || 6));
    const rnd = mulberry32(this._config.seed || 42);
    const p = (arr) => arr[Math.floor(rnd() * arr.length)];
    this._villagers = [];
    for (let i = 0; i < n; i++) {
      const job = JOBS[i];
      this._villagers.push({
        id: i, job, home: i % HOUSES.length,
        look: (() => {
          const variant = JOBS.slice(0, i).filter((j) => j === job).length % 2;
          const [shirt, pants] = LOOKS.outfit[job][variant];
          return {
            skin: p(LOOKS.skin), hair: p(LOOKS.hair), shirt, pants,
            style: job === 'child' ? 'messy' : job === 'carrier' || rnd() < 0.3 ? 'long' : 'short',
            beard: job === 'woodcutter' || (job === 'bard' && rnd() < 0.5),
          };
        })(),
        sprites: new Map(),
        small: job === 'child',
        speed: job === 'child' ? 18 : rand(10, 13),
        seed: rnd(), x: 96, y: 80, tx: 96, ty: 80, face: 1,
        walking: false, action: 'idle', actT: 0, fxT: 0, rethinkAt: 0,
        inside: false, gone: false, slept: false, water: false, carry: null,
        bubble: null, jumpT: 0, ang: (i / n) * Math.PI * 2,
      });
    }
    const g = mulberry32((this._config.seed || 42) + 99);
    for (let i = 0; i < 8; i++) this._makeGuest('visitor', g);
    this._makeGuest('mail', g);
    INSTRUMENTS.forEach((instr, i) => this._makeGuest('band', g, { instr, instrIdx: i }));
    for (const [kind, E] of Object.entries(EVENTS)) E.crew.forEach((role, i) => this._makeGuest(role, g, { eventKind: kind, crewIdx: i }));
    this._nextMail = rand(15, 45);
    this._nextGuest = 0;
    this._initAnimals(g);
    this._particles = [];
    this._screen = 0;
    this._popcorn = false;
    this._sign = 0; // 2 = the BACK SOON sign hangs on the amphitheater screen
    this._clouds = Array.from({ length: 8 }, () => ({
      x: rand(-40, RW), y: rand(6, 80), w: Math.round(rand(50, 110)), v: rand(2, 5),
    }));
    this._splashes = [];
    this._drops = [];
    this._flies = Array.from({ length: 11 }, () => ({ x: rand(0, W), y: rand(HORIZON + 6, H - 2), p: rand(0, 6) }));
    this._stars = Array.from({ length: 110 }, () => ({ x: rand(0, RW) | 0, y: rand(0, 140) | 0, p: rand(0, 6), b: rand(0.3, 1), big: Math.random() < 0.1 }));
    this._houseFx = HOUSES.map(() => ({ smoke: rand(0, 1), z: rand(0, 2) }));
    this._flash = 0;
    this._nextFlash = rand(4, 12);
    this._mode = undefined;
    this._bgKey = null;
    this._event = null;
    this._eventReq = null;
    this._display = null;
    this._eventsSeen = false;
    this._lastEnded = null;
    this._landKey = null; this._cloudKey = null; this._trimmed = null; // new stars and clouds: refilter and rebuild them
    this._updateMode();
    if (this._hass) this._spawnEvents(); // events wait for the real states (see set hass)
    this._sync();
  },

  // Time zone as HA's frontend resolves it: the user's profile can say "local" (this browser) or "server".
  _tz() {
    return this._hass?.locale?.time_zone === 'local' ? undefined : this._hass?.config?.time_zone;
  },

  // The current date and time in that zone, as a local Date (only its fields are used).
  _now() {
    const tz = this._tz(), now = new Date();
    if (!tz) return now;
    try {
      if (!this._fmt || this._fmtTz !== tz) {
        this._fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
        this._fmtTz = tz;
      }
      const f = {};
      for (const p of this._fmt.formatToParts(now)) f[p.type] = +p.value;
      return new Date(f.year, f.month - 1, f.day, f.hour % 24, f.minute);
    } catch (e) { return now; }
  },

  _hour() {
    if (typeof this.previewHour === 'number') return this.previewHour;
    const now = this._now();
    return now.getHours() + now.getMinutes() / 60;
  },

  _phaseFor(h) {
    const sun = this._hass?.states?.[this._config.sun_entity];
    if (typeof this.previewHour !== 'number' && sun && sun.attributes?.elevation !== undefined) {
      const e = sun.attributes.elevation;
      if (e > 8) return 'day';
      if (e > -6) return sun.attributes.rising ? 'dawn' : 'dusk';
      return 'night';
    }
    if (h >= 7.5 && h < 18) return 'day';
    if (h >= 5.5 && h < 7.5) return 'dawn';
    if (h >= 18 && h < 20) return 'dusk';
    return 'night';
  },

  _matchTrigger() {
    return evalReactions(this._config.triggers, this._hass?.states);
  },

  _updateMode() {
    const cfg = this._config;
    const h = this._hour();
    const states = this._hass?.states || {};
    let mode, reason = null;

    const trig = this._matchTrigger();
    this._eventReq = null;
    if (trig && eventOfMode(trig.mode)) {
      // an event reaction brings that event to the village; the mood follows the normal day
      this._eventReq = eventOfMode(trig.mode);
      // a scene pressed again is a new request, even if the event it brought has already been and gone
      this._eventReqAt = reactionKind(trig) === 'activated' ? activatedAt(states[trig.entity], Date.now(), trig.entity) : 0;
      mode = scheduleMode(h, this._schedule); reason = trig.label ? trig : null;
    } else if (trig) { mode = trig.mode === 'auto' ? scheduleMode(h, this._schedule) : trig.mode; reason = trig.mode === 'auto' && !trig.label ? null : trig; }
    if (!mode && cfg.mode_entity && MODES[states[cfg.mode_entity]?.state]) mode = states[cfg.mode_entity].state;
    if (!mode) mode = scheduleMode(h, this._schedule);

    let wEnt = cfg.weather_entity;
    if (wEnt === undefined) {
      // no weather configured: use the first one that's working (a broken forecast service can leave one unavailable)
      // (a scan of every entity, so a home with no working weather entity looks again every half minute, not every second)
      if (this._hass && (this._autoWeather === undefined || !isLive(states[this._autoWeather])) && !(this._autoAt > this._t - 30)) {
        this._autoAt = this._t;
        this._autoWeather = autoWeather(states);
      }
      wEnt = this._autoWeather;
    }
    this._weather = readWeather(this.previewWeather ?? (wEnt ? states[wEnt]?.state : ''));
    this._phase = this._phaseFor(h);
    this._season = this.previewSeason || seasonOf(this._now(), this._hass?.config?.latitude < 0);
    this._hourNow = h;

    if (mode !== this._mode) {
      const prev = this._mode;
      this._mode = mode;
      this._onModeChange(prev, !!reason);
    }

    let text = MODES[mode].text;
    if (mode === 'meal') text = h < 11 ? 'Breakfast by the fire' : h < 15 ? 'Lunch is served' : 'Dinner by the fire';
    if (mode === 'work' && this._weather.rain) text = 'Working through the rain';
    if (mode === 'work' && this._weather.snow) text = 'A snowy day at work';
    const ev = this._event, evOn = ev && (ev.stage === 'setup' || ev.stage === 'open');
    if (evOn) text = ev.E.text;
    const label = reason?.label || (evOn ? ev.E.label : MODES[mode].label);
    const status = `${evOn ? ev.E.icon : MODES[mode].icon} ${label} · ${text}`;
    if (status !== this._statusText) {
      this._statusText = status;
      this._status.textContent = status;
      this._canvas.setAttribute('aria-label', `Village: ${label}. ${text}`);
    }
    this._warnMissing();
  },

  _onModeChange(prev, triggered) {
    if (prev === 'movie') this._popcorn = false;
    if (this._mode === 'movie' || this._mode === 'gaming') this._sign = 0; // the screen's needed for the show
    if (prev === undefined) {
      // First run: place everyone where they'd be right now, no commute (again when the first states arrive).
      for (const v of this._villagers) {
        v.walking = false; v.path = []; v.rethinkAt = 0;
        if (!v.guest) { v.inside = false; v.gone = false; v.gear = false; }
        else if (!v.eventKind && v.active) { v.gone = true; this._retireGuest(v); v.plan = null; v.actT = 9999; }
      }
      this._screen = 0; this._popcorn = false; this._sign = 0;
      if (this._mode === 'movie' || this._mode === 'gaming') {
        this._screen = 1;
        this._popcorn = this._mode === 'movie';
      }
      if (this._mode === 'away') {
        this._sign = 2; this._screen = 1;
        for (const v of this._villagers) v.gear = true;
      }
      for (const v of this._villagers) {
        const p = this._plan(v);
        v.plan = p;
        if (p.enter) { v.inside = true; v.slept = this._mode === 'sleep'; v.actT = p.dur; continue; }
        if (p.gone) { v.gone = true; v.actT = p.dur; continue; }
        v.x = v.tx = p.x; v.y = v.ty = p.y; v.carry = p.carry || null;
        this._arrive(v);
        v.actT = rand(0, p.dur);
      }
      const want = { sleep: 0, cozy: 0, away: 0, morning: 2, work: 3, meal: 3, evening: 3, movie: 4, gaming: 3, party: 5 }[this._mode] ?? 2;
      const settle = (v) => {
        v.active = true; v.leaving = false; v.stayUntil = this._t + rand(40, 200); v.entry = 'east';
        v.gone = false; v.x = FIRE.x; v.y = FIRE.y + 12;
        const p = this._plan(v);
        v.plan = p; v.x = v.tx = p.x; v.y = v.ty = p.y; this._arrive(v); v.actT = rand(0, p.dur);
      };
      if (this._config.visitors !== false) this._villagers.filter((v) => v.job === 'visitor').slice(0, want).forEach(settle);
      if (this._mode === 'party' && this._config.visitors !== false) this._villagers.filter((v) => v.job === 'band').forEach(settle);
      for (const a of this._animals) this._placeAnimal(a);
      return;
    }
    for (const v of this._villagers) {
      v.rethinkAt = this._t + rand(0.2, 3) + v.id * 0.4;
      if (triggered && !v.inside && !v.gone) v.bubble = { g: 'bang', c: '#d03030', t: 1.6 };
    }
  },
};

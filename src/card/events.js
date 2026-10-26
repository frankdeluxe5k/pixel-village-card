// Card: running random events.
import { EVENTS, eventsForDay } from '../content/events/index.js';
import { H, HORIZON, S, W } from '../core/constants.js';
import { rand } from '../core/math.js';
import { dayKey } from '../core/time.js';
import { FIRE } from '../world/layout.js';
import { EVENT_BLOCKS, blocked, clearPath, freeSpot, route, setEventBlocks } from '../world/nav.js';

export const eventMethods = {
  _dayInfo() {
    const now = this._now();
    return { day: dayKey(now), min: now.getHours() * 60 + now.getMinutes() };
  },

  _daySchedule(day) {
    const key = `${day}|${this._config.seed || 42}|${this._config.event_frequency || 'daily'}`;
    if (this._schedKey !== key) { this._schedKey = key; this._sched = eventsForDay(day, this._config.seed || 42, this._config.event_frequency || 'daily'); }
    return this._sched;
  },

  // What should be happening: the demo's preview, then a Home Assistant reaction, then today's schedule.
  _wantedEvent() {
    if (this.previewEvent && EVENTS[this.previewEvent]) return { kind: this.previewEvent, source: 'preview' };
    if (this._eventReq) return { kind: this._eventReq, source: 'reaction', at: this._eventReqAt };
    if (this._config.events === false) return null;
    const { day, min } = this._dayInfo();
    const e = this._daySchedule(day).find((x) => min >= x.start && min < x.end);
    return e ? { ...e, source: 'schedule', day, min } : null;
  },

  _eventKey(want) {
    return want.source === 'schedule' ? `s${want.day}|${want.start}` : `${want.source}|${want.kind}|${want.at || ''}`;
  },

  // Events stay away in bad weather and from moods that don't suit them.
  _eventOk(kind, source) {
    const w = this._weather, m = this._mode;
    if (w.rain || w.snow || w.heavy) return false;
    if (source === 'schedule') return EVENTS[kind].moods.includes(m);
    return !['sleep', 'away', 'cozy', 'movie', 'gaming', 'party'].includes(m);
  },

  // Once a second: start, wind down or finish events, keep their leftovers and footprints current.
  _spawnEvents() {
    const first = !this._eventsSeen;
    this._eventsSeen = true;
    const want = this._wantedEvent(), ev = this._event;
    if (!want) this._lastEnded = null;
    if (!ev) {
      if (want && this._eventKey(want) !== this._lastEnded && this._eventOk(want.kind, want.source)) this._startEvent(want, first);
    } else {
      const keep = want && want.kind === ev.kind && this._eventOk(ev.kind, want.source);
      if (!keep && ['arrive', 'setup', 'open'].includes(ev.stage)) this._eventStage(ev.E.packSecs && ev.stage !== 'arrive' ? 'packup' : 'leave');
      if (ev.stage === 'arrive' && ev.crew.every((v) => v.ready)) this._eventStage(ev.E.setupSecs ? 'setup' : 'open');
      ev.E.tick?.(this, ev);
      if (ev.stage === 'leave' && ev.crew.every((v) => !v.active)) {
        this._lastEnded = ev.key; this._event = null;
        // its props' art can go; trimmed shrubs and a finished sculpture stay on show for the day
        const art = this._a?.events;
        if (art) for (const k of [...art.keys()]) if (!k.startsWith('shrub') && !/^sculpt\w+4$/.test(k)) art.delete(k);
      }
    }
    const { day, min } = this._dayInfo();
    for (const E of Object.values(EVENTS)) E.keep?.(this, day, min);
    const blocks = this._eventBlocks(), key = JSON.stringify(blocks);
    if (!this._running) return;
    if (key !== this._blockKey || (blocks.length && !EVENT_BLOCKS.has(this))) {
      // something new went up: whoever was standing there steps aside, whoever was walking through finds a way round
      this._blockKey = key;
      setEventBlocks(this, blocks.length ? blocks : null);
      const crosses = (x, y, tx, ty, path) => {
        for (const [nx, ny] of [[tx, ty], ...path]) { if (!clearPath(x, y, nx, ny)) return true; x = nx; y = ny; }
        return false;
      };
      for (const v of this._villagers) {
        if (v.inside || v.gone) continue;
        if (!v.walking) { if (blocked(v.x, v.y)) v.rethinkAt = this._t + 0.1; continue; }
        if (!v.plan || !crosses(v.x, v.y, v.tx, v.ty, v.path || [])) continue;
        [v.plan.x, v.plan.y] = freeSpot(v.plan.x, v.plan.y);
        v.path = route(v.x, v.y, v.plan.x, v.plan.y);
        [v.tx, v.ty] = v.path.shift();
      }
      for (const a of this._animals) {
        if (a.hidden || a.alt > 0) continue;
        if (a.type === 'bird') { if (a.state !== 'fly' && blocked(a.x, a.y)) a.t = 0; continue; } // flies off
        const moving = a.state === 'walk' || a.state === 'run' || a.state === 'hop';
        if (blocked(a.x, a.y) || (moving && crosses(a.x, a.y, a.tx, a.ty, a.path))) {
          const [x, y] = moving ? (a.path.length ? a.path[a.path.length - 1] : [a.tx, a.ty]) : [a.x, a.y];
          const rest = a.rest;
          this._goAnimal(a, x, y, a.speed || 14, moving ? a.state : 'walk');
          a.rest = rest;
        }
      }
    }
  },

  _startEvent(want, instant) {
    const E = EVENTS[want.kind], now = Date.now();
    const mins = want.source === 'preview' ? (E.previewMins || (E.minutes[0] + E.minutes[1]) / 2) : (E.minutes[0] + E.minutes[1]) / 2;
    const ev = {
      kind: want.kind, E, stage: 'arrive', progress: 0, source: want.source, key: this._eventKey(want), data: {},
      startAt: want.source === 'schedule' ? now - (want.min - want.start) * 60000 : now,
      endAt: want.source === 'schedule' ? now + (want.end - want.min) * 60000 : now + mins * 60000,
      crew: this._villagers.filter((v) => v.eventKind === want.kind),
    };
    ev.dur = Math.max(60000, ev.endAt - ev.startAt);
    this._event = ev;
    ev.crew.forEach((v, i) => {
      Object.assign(v, { ready: false, knocked: false, pulling: false, pushing: false, leading: false });
      this._activate(v, 9999, instant ? 0 : i * 1.2);
    });
    E.start?.(this, ev);
    if (!instant) return;
    // the card opened partway through: everything is already set up
    ev.stage = 'open'; ev.progress = 1;
    for (const v of ev.crew) v.ready = true;
    E.instant?.(this, ev);
    E.tick?.(this, ev);
    if (this._event !== ev || ev.stage !== 'open') return;
    for (const v of ev.crew) {
      v.gone = false; v.x = FIRE.x; v.y = FIRE.y + 12;
      const p = this._plan(v);
      if (p.gone) { v.gone = true; this._retireGuest(v); continue; }
      v.plan = p; v.x = v.tx = p.x; v.y = v.ty = p.y; v.carry = p.drop ? null : p.carry || null; this._arrive(v); v.actT = rand(0, p.dur);
    }
  },

  _eventStage(stage) {
    const ev = this._event;
    if (!ev || ev.stage === stage) return;
    ev.stage = stage;
    for (const v of ev.crew) if (v.active) v.rethinkAt = this._t + rand(0.2, 1.2);
  },

  // Crew members doing 'build' put the event up (setup) or take it down (packup).
  _buildEvent(dt) {
    const ev = this._event;
    if (!ev || !ev.E.setupSecs) return;
    const n = ev.crew.length;
    if (ev.stage === 'setup') { ev.progress = Math.min(1, ev.progress + dt / ev.E.setupSecs / n); if (ev.progress >= 1) this._eventStage('open'); }
    else if (ev.stage === 'packup') { ev.progress = Math.max(0, ev.progress - dt / ev.E.packSecs / n); if (ev.progress <= 0) this._eventStage('leave'); }
  },

  // An onlooker's plan for whatever's on (a few at a time, so the crew stays visible).
  _eventVisit(v) {
    const ev = this._event;
    if (v.eventKind) return null;
    const crowd = this._villagers.filter((o) => o !== v && o.plan?.onlook && !o.gone && !o.inside).length;
    let p = null;
    if (ev && ev.stage === 'open' && ev.E.visit) { if (crowd < (ev.E.maxVisitors || 4)) p = ev.E.visit(this, v, ev); }
    else if (!ev && this._display && ['morning', 'work', 'meal', 'evening'].includes(this._mode) && crowd < 3 && Math.random() < 0.3) p = EVENTS.artists.visit(this, v, null);
    if (p) p.onlook = true;
    return p;
  },

  _wanderNear(v) {
    return { x: Math.max(4, Math.min(W - 4, v.x + rand(-6, 6))), y: Math.max(HORIZON + 8, Math.min(H - 2, v.y + rand(-2, 2))) };
  },

  _eventBlocks() {
    const ev = this._event, out = [];
    if (ev?.E.blocks) out.push(...ev.E.blocks(this, ev));
    if (this._display && ev?.kind !== 'artists') out.push(...EVENTS.artists.blocks(this, null));
    return out;
  },

  _eventArt(key, make) {
    const a = this._art(), m = (a.events ||= new Map());
    let spr = m.get(key);
    if (!spr) m.set(key, (spr = make()));
    return spr;
  },

  // Event props join the depth-sorted scene. add(x, y, sortY, sprite, flip); a sprite with draw(ctx) draws itself.
  _eventItems(items, ctx) {
    const ev = this._event;
    let o = 11000;
    const add = (x, y, sortY, spr, flip = false) => {
      if (spr.draw) { items.push({ y: sortY, o: o++, d: () => spr.draw(ctx) }); return; }
      const X = Math.round(x * S) - spr.ax, Y = Math.round(y * S) - spr.by, g = [spr.cv, X, Y, flip];
      items.push({ y: sortY, o: o++, g: () => g, d: () => {
        if (!flip) ctx.drawImage(spr.cv, X, Y);
        else { ctx.setTransform(-1, 0, 0, 1, X + spr.cv.width, Y); ctx.drawImage(spr.cv, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      } });
    };
    if (ev?.E.props) ev.E.props(this, ev, add);
    if (this._display && ev?.kind !== 'artists') EVENTS.artists.props(this, null, add);
  },

  _trimToday() {
    const { day } = this._dayInfo();
    if (this._trimmed?.day !== day) this._trimmed = { day, set: new Set() };
    return this._trimmed;
  },
};

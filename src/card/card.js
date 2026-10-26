// The card element: config, Home Assistant, lifecycle and the animation loop.
import { DEFAULT_VILLAGERS } from '../content/jobs.js';
import { animalMethods } from './animals.js';
import { effectMethods } from './effects.js';
import { eventMethods } from './events.js';
import { guestMethods } from './guests.js';
import { lightMethods } from './lights.js';
import { planMethods } from './plan.js';
import { renderMethods } from './render.js';
import { screenMethods } from './screen.js';
import { spriteMethods } from './sprites.js';
import { updateMethods } from './update.js';
import { worldMethods } from './world.js';
import { DEFAULT_SCHEDULE } from '../content/moods.js';
import { DEFAULT_FPS, H, RH, RW, W } from '../core/constants.js';
import { parseHour } from '../core/time.js';
import { validateConfig } from '../ha/validate.js';
import { autoWeather } from '../ha/weather.js';
import { EVENT_BLOCKS, setEventBlocks } from '../world/nav.js';

export class CompanionVillageCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('companion-village-card-editor');
  }

  static getStubConfig(hass) {
    const weather = autoWeather(hass?.states || {});
    return weather ? { villagers: DEFAULT_VILLAGERS, weather_entity: weather } : { villagers: DEFAULT_VILLAGERS };
  }

  setConfig(config) {
    validateConfig(config);
    // Only who lives here needs a new village; everything else (reactions, schedule, entities, title...) is
    // read live, so the editor preview stays steady while the user types.
    const worldKey = JSON.stringify([Number(config.villagers) || DEFAULT_VILLAGERS, config.seed || 42, config.visitors !== false, config.animals !== false]);
    const keepWorld = this._villagers && worldKey === this._worldKey;
    this._worldKey = worldKey;
    this._config = {
      villagers: DEFAULT_VILLAGERS, fps: DEFAULT_FPS, show_status: true, sun_entity: 'sun.sun', triggers: [], ...config,
    };
    this._schedule = { ...DEFAULT_SCHEDULE };
    for (const [k, v] of Object.entries(config.schedule || {})) this._schedule[k] = parseHour(v);
    this._watchKey = null;
    this._warned = false;
    this._userSun = config.sun_entity;
    if (!this.shadowRoot) this._build();
    this._title.textContent = config.title || '';
    this._title.style.display = config.title ? '' : 'none';
    this._status.style.display = this._config.show_status ? '' : 'none';
    if (!keepWorld) this._initVillage();
    else if (this._hass) this._updateMode(); // a new reaction or schedule shows straight away
  }

  // HA sets hass on every state change in the house; only react when something this card uses changed.
  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this._villagers) return;
    if (!prev) {
      // HA calls setConfig before the first hass: the village was laid out without any states, so lay it out
      // again now that the real mood, weather and reactions are known (no commute, no "!" bubbles)
      this._mode = undefined;
      this._updateMode();
      if (!this._eventsSeen) this._spawnEvents();
      return;
    }
    if (prev.locale?.time_zone !== hass.locale?.time_zone || prev.config?.time_zone !== hass.config?.time_zone) {
      this._updateMode();
      return;
    }
    const ps = prev.states || {}, ns = hass.states || {};
    if (this._watched().some((e) => ps[e] !== ns[e])) this._updateMode();
  }

  // Entities the card reads: weather, sun, mood helper and every reaction's entity.
  _watched() {
    const c = this._config;
    const key = `${c.weather_entity}|${this._autoWeather}`;
    if (this._watchKey !== key) {
      this._watchKey = key;
      const w = c.weather_entity === undefined ? this._autoWeather : c.weather_entity;
      this._watch = [...new Set([w, c.sun_entity, c.mode_entity, ...(c.triggers || []).map((t) => t?.entity)].filter((e) => typeof e === 'string' && e))];
    }
    return this._watch;
  }

  _warnMissing() {
    const states = this._hass?.states;
    if (this._warned || !states || !Object.keys(states).length) return;
    this._warned = true;
    // the default sun.sun only counts if the user picked it; without it the card uses the clock
    const missing = this._watched().filter((e) => !states[e] && !(e === 'sun.sun' && !this._userSun));
    if (missing.length) console.warn(`companion-village-card: these entities don't exist in Home Assistant: ${missing.join(', ')}`);
  }

  getCardSize() {
    return 3 + (this._config?.title ? 1 : 0) + (this._config?.show_status === false ? 0 : 1);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  connectedCallback() {
    this._connected = true;
    this._io?.observe(this._canvas);
    document.addEventListener('visibilitychange', this._onVis);
    this._sync();
  }

  disconnectedCallback() {
    this._connected = false;
    this._io?.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this._sync();
  }

  /* ----- DOM + loop ----- */

  _build() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        ha-card { display: block; overflow: hidden; }
        .title {
          padding: 12px 16px 8px; font-size: var(--ha-card-header-font-size, 1.1em); font-weight: 500;
          color: var(--ha-card-header-color, var(--primary-text-color));
        }
        canvas {
          display: block; width: 100%; aspect-ratio: ${W} / ${H};
          image-rendering: pixelated; image-rendering: crisp-edges;
          cursor: pointer; background: #2c3a70;
        }
        .status {
          padding: 8px 14px; font-size: 13px; line-height: 1.4;
          color: var(--secondary-text-color, #666);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
      </style>
      <ha-card>
        <div class="title"></div>
        <canvas width="${RW}" height="${RH}" role="img" aria-label="Village"></canvas>
        <div class="status"></div>
      </ha-card>`;
    this._title = root.querySelector('.title');
    this._canvas = root.querySelector('canvas');
    this._status = root.querySelector('.status');
    this._ctx = this._canvas.getContext('2d', { alpha: false });
    this._visible = true;
    this._loop = 0;
    this._t = 0;

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries.some((e) => e.isIntersecting);
        this._sync();
      });
      if (this._connected) this._io.observe(this._canvas);
    }
    this._onVis = () => this._sync();
    if (this._connected) document.addEventListener('visibilitychange', this._onVis);
    this._canvas.addEventListener('click', (e) => this._click(e));
  }

  _sync() {
    const run = this._connected && this._visible && !document.hidden && !!this._villagers;
    if (run && !this._running) {
      this._running = true;
      this._last = performance.now();
      this._tick(++this._loop);
    } else if (!run && this._running) {
      this._running = false;
      this._loop++; // a frame already queued from the old loop sees a stale id and stops
      clearTimeout(this._timer);
      cancelAnimationFrame(this._raf);
      // a stopped card's carts and tents shouldn't keep other cards' villagers away
      if (EVENT_BLOCKS.has(this)) setEventBlocks(this, null);
    }
  }

  _tick(loop) {
    if (!this._running || loop !== this._loop) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.25);
    this._last = now;
    this._t += dt;
    if (this._t - (this._modeCheck || 0) > 1) {
      this._modeCheck = this._t;
      this._updateMode();
      if (this._hass) this._spawnGuests(); // events and guests wait for the first states (see set hass)
    }
    try {
      const t0 = performance.now();
      this._update(dt);
      this._render();
      this._pace(performance.now() - t0);
    } catch (e) {
      // keep the village running through a bad frame, and say so once
      if (!this._crashed) { this._crashed = true; console.error('companion-village-card:', e); }
    }
    this._timer = setTimeout(() => { this._raf = requestAnimationFrame(() => this._tick(loop)); }, 1000 / Math.min(this._fps(), this._fpsCap || 30));
  }

  _fps() {
    return Math.max(2, Math.min(30, +this._config.fps || DEFAULT_FPS));
  }

  // On a device that can't keep up (frames over ~40% of their budget), drop to 10 fps; recover once frames
  // take under ~20% of the budget they would get back.
  _pace(ms) {
    const s = (this._paceS ||= { n: 0, sum: 0 });
    s.sum += ms;
    if (++s.n < 60) return;
    const avg = s.sum / s.n, budget = 1000 / this._fps();
    if (!this._fpsCap && this._fps() > 10 && avg > budget * 0.4) this._fpsCap = 10;
    else if (this._fpsCap && avg < budget * 0.2) this._fpsCap = 0;
    s.n = 0; s.sum = 0;
  }
}

// The rest of the card's methods live in card/*.js, grouped by concern. They're copied onto the prototype
// non-enumerable, just like methods written in the class body, so `this` works the same everywhere.
for (const part of [worldMethods, eventMethods, guestMethods, animalMethods, planMethods, updateMethods, renderMethods, screenMethods, lightMethods, effectMethods, spriteMethods]) {
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(part))) Object.defineProperty(CompanionVillageCard.prototype, k, { ...d, enumerable: false });
}

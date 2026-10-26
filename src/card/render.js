// Card: rendering the scene.
import { SHRUBS, shrubProp } from '../art/foliage.js';
import { makeHouse } from '../art/houses.js';
import { makePot, makeProjector, makePuff } from '../art/props.js';
import { allLightRects, sharedArt, sharedLand } from '../art/shared.js';
import { OVERCAST_TINT, SKY, TINT, glowSprite, makeCloud } from '../art/sky.js';
import { makeCafeTable, makeFilmBg, makeSignCard, makeStage } from '../art/venues.js';
import { makeParkedBike } from '../art/villager/build.js';
import { divHex, hexToRgb, mixHex, mulHex } from '../core/color.js';
import { HZ, RH, RW, S, W } from '../core/constants.js';
import { rand } from '../core/math.js';
import { bayer } from '../core/noise.js';
import { P, disc, mk, opaqueBox } from '../core/pixels.js';
import { CART, FIRE, HOUSES, POND, PROJ, TABLES } from '../world/layout.js';

export const byDepth = (p, q) => p.y - q.y || p.o - q.o;
export const renderMethods = {
  _tint() {
    const t = TINT[this._phase];
    if (!this._weather.overcast) return t;
    if (!this._tintOver || this._tintFor !== t) { this._tintFor = t; this._tintOver = t ? mulHex(t, OVERCAST_TINT) : OVERCAST_TINT; }
    return this._tintOver;
  },

  _buildBg() {
    const w = this._weather, ph = this._phase;
    if (this._landSnowWant !== w.snow || this._landSeason !== this._season || !this._landKey) {
      const landKey = `${w.snow ? 'snow' : 'green'}|${this._season}`;
      // built a few ms per frame; until it's ready the previous land (or just the sky) stays up
      const L = sharedLand(w.snow, this._season, this._land ? 6 : 12);
      if (L) { this._useLand(L, landKey, w.snow); this._landSnowWant = w.snow; this._landSeason = this._season; }
    }
    // the sky only depends on the time of day and the cloud cover
    if (this._bgPhase === ph && this._bgOver === w.overcast && this._bgKey) return;
    this._bgPhase = ph; this._bgOver = w.overcast; this._bgKey = true;
    if (!this._bg) this._bg = mk(RW, RH);
    const g = this._bg.getContext('2d');

    // Dithered sky, pre-divided by the tint so it lands on the right colour after the multiply.
    let [top, bot] = SKY[ph];
    if (w.overcast) {
      const grey = ph === 'night' ? '#283040' : '#8a96a4';
      top = mixHex(top, grey, 0.55); bot = mixHex(bot, grey, 0.55);
    }
    const tint = this._tint();
    const A = hexToRgb(tint ? divHex(top, tint) : top), B = hexToRgb(tint ? divHex(bot, tint) : bot);
    const im = g.createImageData(RW, HZ), d = im.data, N = 9;
    for (let y = 0; y < HZ; y++) {
      const f = (y / HZ) * (N - 1), i0 = Math.floor(f), fr = f - i0;
      for (let x = 0; x < RW; x++) {
        const u = (i0 + (fr > bayer(x, y) ? 1 : 0)) / (N - 1), i = (y * RW + x) * 4;
        d[i] = A[0] + (B[0] - A[0]) * u; d[i + 1] = A[1] + (B[1] - A[1]) * u; d[i + 2] = A[2] + (B[2] - A[2]) * u; d[i + 3] = 255;
      }
    }
    g.clearRect(0, 0, RW, RH);
    g.putImageData(im, 0, 0);
  },

  _useLand(L, landKey, snow) {
    this._land = L.land;
    this._props = L.land.props;
    this._skyMask = L.mask;
    // stars hidden behind the mountains never show, so drop them once here
    this._visStars = this._stars.filter((st) => L.skyAt(st.x, st.y));
    this._moonSpr = null;
    this._static = null;
    this._landKey = landKey;
    this._landSnow = snow;
  },

  _art() {
    if (!this._a) {
      this._a = {
        pot: makePot(),
        projector: makeProjector(),
        signCard: makeSignCard(),
        tables: TABLES.map(([, , c]) => makeCafeTable(c)),
        puffs: [null, 1, 2, 3, 4, 5].map((r) => r && makePuff(r, '#ffffff', '#e2e4ec', '#b4b8c8')),
        film: [0, 1, 2].map(makeFilmBg),
      };
    }
    return this._a;
  },

  _glow(ctx, x, y, r, rgb, a) {
    r = Math.round(r);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(glowSprite(r, rgb), Math.round(x - r), Math.round(y - r));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  // Houses, props, tables and the stage never move: build their depth entries once and keep them sorted.
  // `o` keeps the original draw order for equal depths.
  _staticItems(snow) {
    if (this._static && this._staticSnow === snow) return this._static;
    const ctx = this._ctx, a = this._art();
    const stage = (sharedArt.stages[snow ? 1 : 0] ||= makeStage(snow));
    const houses = (sharedArt.houses[snow ? 1 : 0] ||= HOUSES.map((h) => makeHouse(h, snow)));
    // g() gives each item's sprite and where it lands, so the light redraw can tell who is in front of whom
    const stageG = [stage.cv, stage.x, stage.y, false];
    const items = [{ y: 112.5, o: 2000, d: () => { ctx.drawImage(stage.cv, stage.x, stage.y); this._drawScreen(ctx); }, g: () => stageG }];
    HOUSES.forEach((h, i) => { const g = [houses[i].cv, houses[i].x, houses[i].y, false]; items.push({ y: h.base + 0.3, o: 5000 + i, d: () => ctx.drawImage(houses[i].cv, houses[i].x, houses[i].y), g: () => g }); });
    this._props.forEach((pr, i) => {
      const cv = () => (pr.shrub !== undefined && !snow && this._trimmed?.set.has(pr.shrub) ? this._trimmedShrub(pr.shrub) : pr.cv);
      const g = [pr.cv, pr.x, pr.y, false];
      // only props that stand in front of some light (windows, lanterns, lamps, candles, bulbs) are ever redrawn
      const b = opaqueBox(pr.cv), L = pr.x + b[0], T = pr.y + b[1], R = pr.x + b[2], Bt = pr.y + b[3];
      const lit = allLightRects().some(([x, y, w, h, base]) => pr.sortY > base + 0.35 && x < R && x + w > L && y < Bt && y + h > T);
      items.push({ y: pr.sortY, o: 6000 + i, lit, d: () => ctx.drawImage(cv(), pr.x, pr.y), g: () => { g[0] = cv(); return g; } });
    });
    TABLES.forEach(([tx, ty], i) => {
      const spr = this._art().tables[i], g = [spr.cv, tx - spr.ax, ty - spr.by, false];
      items.push({ y: (ty + 3) / S, o: 7000 + i, d: () => this._drawTable(ctx, i, tx, ty), g: () => g });
    });
    items.sort(byDepth);
    this._staticSnow = snow;
    return (this._static = items);
  },

  // A landscaped copy of a shrub, per card and season (the shared land props never change).
  _trimmedShrub(i) {
    const key = `shrub${i}|${this._season}`;
    return this._eventArt(key, () => shrubProp(SHRUBS[i], false, this._season, true)).cv;
  },

  _render() {
    const ctx = this._ctx, w = this._weather, ph = this._phase, a = this._art();
    this._buildBg();
    this._frameNo = (this._frameNo || 0) + 1;
    // who sits at which café seat, once per frame
    const seats = (this._seats ||= new Map());
    seats.clear();
    for (const v of this._villagers) if (!v.walking && !v.inside && !v.gone && v.plan?.seat !== undefined && (v.action === 'laptop' || v.action === 'sip')) if (!seats.has(v.plan.seat)) seats.set(v.plan.seat, v);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._bg, 0, 0); // sky only
    if (!this._land) return; // first frames on a slow device: the land is still being built

    if (ph !== 'night' && !w.overcast) this._drawSun(ctx);
    this._drawClouds(ctx);
    ctx.drawImage(this._land, 0, 0); // mountains, hills and village in front of the sun and clouds
    if (this._mode === 'party') this._drawBunting(ctx);

    // depth-sorted world objects: the few moving things, merged into the pre-sorted static scenery
    const items = (this._items ||= []);
    items.length = 0;
    let o = 0;
    // one record per person/animal, reused every frame
    for (const v of this._villagers) {
      if (v.inside || v.gone) continue;
      const it = (v._item ||= { who: v, d: () => this._drawVillager(ctx, v), g: () => this._villagerGeom(v) });
      it.y = v.y; it.o = o++; items.push(it);
    }
    const fixedItems = (this._fixedItems ||= {
      pot: { y: FIRE.y + 0.5, o: 1000, d: () => this._drawPot(ctx), g: () => { const p = a.pot; return [p.cv, FIRE.x * S - p.ax, FIRE.y * S + 5 - p.by, false]; } },
      projector: { y: PROJ.y, o: 3000, d: () => { this._drawProjector(ctx); this._drawReels(ctx); }, g: () => this._projectorGeom() },
      console: { y: 112.6, o: 4000, d: () => this._drawConsole(ctx) },
    });
    if (this._potOn()) items.push(fixedItems.pot);
    if (this._screen > 0 && !this._sign) items.push(fixedItems.projector);
    if (this._mode === 'gaming' && this._screen > 0) items.push(fixedItems.console);
    o = 9000;
    for (const an of this._animals) {
      if (an.hidden || (an.type === 'bird' && an.state === 'fly')) continue;
      const it = (an._item ||= { who: an, animal: true, d: () => this._drawAnimal(ctx, an), g: () => this._animalGeom(an) });
      it.y = an.y; it.o = o++; items.push(it);
    }
    o = 10000;
    for (const v of this._villagers) {
      if (!v.parked) continue;
      const it = (v._bikeItem ||= { d: () => { const g = it.g(); ctx.drawImage(g[0], g[1], g[2]); }, g: () => {
        const bk = (a.bike ||= makeParkedBike());
        return [bk.cv, Math.round(v.parked.x * S) - bk.ax, Math.round(v.parked.y * S) - bk.by, false];
      } });
      it.y = v.parked.y - 0.01; it.o = o++; items.push(it);
    }
    this._eventItems(items, ctx);
    items.sort(byDepth);
    const fixed = this._staticItems(this._landSnow);
    // the pond's sparkle, under anyone standing in front of it
    if (!w.snow && Math.random() < 0.6) {
      P(ctx, POND.x + Math.round(rand(-14, 14)), POND.y + Math.round(rand(-5, 5)), 2, 1, 'rgba(255,255,255,0.8)');
    }
    for (let i = 0, j = 0; i < items.length || j < fixed.length;) {
      if (j >= fixed.length || (i < items.length && byDepth(items[i], fixed[j]) < 0)) items[i++].d();
      else fixed[j++].d();
    }
    for (const an of this._animals) if (!an.hidden && an.type === 'bird' && an.state === 'fly') this._drawAnimal(ctx, an);
    this._drawParticles(ctx, 0);

    // time-of-day lighting
    const tint = this._tint();
    const dark = ph === 'night' ? 1 : ph === 'day' ? 0 : 0.5;
    if (tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, RW, RH);
      ctx.globalCompositeOperation = 'source-over';
    }

    // lights
    if (ph !== 'day') {
      // moon and stars stay bright after the night tint, but only where the sky shows
      this._drawStars(ctx);
      if (ph === 'night') this._drawMoon(ctx);
    }
    // every light is drawn before the redraw, so whoever stands in front of one stays in front
    this._drawWindows(ctx, dark);
    this._drawCafeLights(ctx, dark);
    this._drawFlames(ctx, dark);
    if (this._event?.E.lights) this._event.E.lights(this, ctx, this._event, dark);
    if (this._mode === 'party') this._drawPartyLights(ctx, dark);
    this._redrawInFrontOfLights(ctx, tint, dark, items, fixed);
    if ((this._mode === 'movie' || this._mode === 'gaming') && this._screen >= 1) this._drawFilm(ctx, dark);
    if (this._mode === 'gaming' && dark) for (const v of this._villagers) if (!v.walking && v.action === 'handheld') this._glow(ctx, v.x * S + v.face * 6, v.y * S - 11, 8, '150,210,255', 0.45);
    if (ph === 'night' && !w.rain && !w.snow) this._drawFireflies(ctx);
    this._drawParticles(ctx, 1);
    this._drawWeather(ctx, dark);
    for (const v of this._villagers) if (v.bubble && !v.inside && !v.gone) this._drawBubble(ctx, v);
  },

  _seated(i) {
    return this._seats?.get(i);
  },

  _drawTable(ctx, i, tx, ty) {
    const spr = this._art().tables[i];
    ctx.drawImage(spr.cv, tx - spr.ax, ty - spr.by);
    for (const side of [0, 1]) {
      const v = this._seated(i * 2 + side);
      if (!v) continue;
      const d = side ? 1 : -1; // which edge of the table this person sits at
      P(ctx, tx + d * 2 - (d < 0 ? 2 : 0), ty - 12, 3, 3, '#ffffff'); P(ctx, tx + d * 2 - (d < 0 ? 2 : 0), ty - 12, 3, 1, '#6a3a1a');
      if (v.action === 'laptop') {
        const lx = tx + d * 6;
        P(ctx, lx - 3, ty - 11, 7, 1, '#9aa0aa');
        P(ctx, lx + d * 3, ty - 16, 1, 5, '#5a5e6a'); P(ctx, lx + d * 2, ty - 16, 1, 5, '#c8ccd4');
      }
    }
  },

  _drawCafeLights(ctx, dark) {
    if (!dark || this._mode === 'away') return;
    TABLES.forEach(([tx, ty], i) => {
      P(ctx, tx, ty - 12, 1, 2, '#ffe48a');
      this._glow(ctx, tx, ty - 11, 14, '255,190,100', 0.35);
      for (const side of [0, 1]) {
        const v = this._seated(i * 2 + side);
        if (v?.action === 'laptop') this._glow(ctx, tx + (side ? 9 : -9), ty - 14, 9, '150,190,255', 0.4);
      }
    });
    this._glow(ctx, CART.x, CART.by - 40, 22, '255,200,120', 0.3);
  },

  _drawSun(ctx) {
    const sun = this._hass?.states?.[this._config.sun_entity];
    let x, y;
    if (typeof this.previewHour !== 'number' && sun?.attributes?.azimuth !== undefined) {
      // east to west, rising on the left: through the south up north, through the north down south
      const az = sun.attributes.azimuth, u = this._hass?.config?.latitude < 0 ? ((90 - az + 360) % 360) / 180 : (az - 90) / 180;
      x = 10 + u * (W - 20);
      y = 52 - sun.attributes.elevation * 0.8;
    } else {
      const p = (this._hourNow - 6) / 13;
      x = 10 + p * (W - 20); y = 52 - Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 42;
    }
    const X = Math.round(x * S), Y = Math.round(Math.max(6, y) * S);
    if (Y > HZ + 10 || X < -20 || X > RW + 20) return;
    const low = this._phase !== 'day';
    this._glow(ctx, X, Y, 40, low ? '255,150,80' : '255,240,180', 0.35);
    const k = low ? 1 : 0, disk = ((this._sunSpr ||= [])[k] ||= (() => {
      const c = mk(23, 23), g = c.getContext('2d');
      disc(g, 11, 11, 11, low ? '#ff9a50' : '#ffe890');
      disc(g, 10, 10, 9, low ? '#ffc080' : '#fff6c8');
      disc(g, 8, 8, 4, '#ffffff');
      return c;
    })());
    ctx.drawImage(disk, X - 11, Y - 11);
  },

  _drawMoon(ctx) {
    const p = ((this._hourNow - 18 + 24) % 24) / 13;
    if (p > 1 || this._weather.overcast) return;
    const X = Math.round((10 + p * (W - 20)) * S), Y = Math.round((50 - Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 40) * S);
    // moon and its glow, clipped to the sky; it only moves a pixel now and then, so cache it
    const R = 34, key = `${X},${Y}`;
    if (!this._moonSpr || this._moonKey !== key) {
      const c = (this._moonSpr ||= mk(R * 2, R * 2)), g = c.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, R * 2, R * 2);
      g.globalAlpha = 0.28; g.drawImage(glowSprite(R, '200,215,255'), 0, 0); g.globalAlpha = 1;
      disc(g, R, R, 9, '#d8d4c0');
      disc(g, R - 1, R - 1, 8, '#f6f2dc');
      for (const [dx, dy, r] of [[-3, -2, 2], [3, 2, 1], [1, -4, 1], [-1, 4, 1]]) disc(g, R + dx, R + dy, r, '#dcd6c0');
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(this._skyMask, X - R, Y - R, R * 2, R * 2, 0, 0, R * 2, R * 2);
      g.globalCompositeOperation = 'source-over';
      this._moonKey = key;
    }
    ctx.drawImage(this._moonSpr, X - R, Y - R);
  },

  _drawStars(ctx) {
    if (this._weather.overcast) return;
    const a = this._phase === 'night' ? 1 : 0.35;
    ctx.fillStyle = '#ffffeb';
    for (const s of this._visStars || []) {
      const tw = 0.55 + 0.45 * Math.sin(this._t * 2 + s.p * 5);
      ctx.globalAlpha = Math.round(s.b * tw * a * 20) / 20;
      ctx.fillRect(s.x, s.y, 1, 1);
      if (s.big && tw > 0.8) { ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); }
    }
    ctx.globalAlpha = 1;
  },

  _drawClouds(ctx) {
    const w = this._weather;
    const pal = w.storm || w.rain
      ? ['#4e566a', '#646c80', '#7c8498', '#949cae']
      : w.overcast ? ['#6a7488', '#868fa2', '#a2aabb', '#bcc2cf'] : ['#a8b8d8', '#d0dcf0', '#f0f6ff', '#ffffff'];
    if (this._cloudKey !== pal[0]) {
      this._cloudKey = pal[0];
      this._cloudSprites = this._clouds.map((c, i) => makeCloud(c.w, 50 + i, pal));
    }
    for (let i = 0; i < w.clouds; i++) {
      const cl = this._clouds[i];
      ctx.drawImage(this._cloudSprites[i], Math.round(cl.x), Math.round(cl.y));
    }
  },

  _drawPot(ctx) {
    const p = this._art().pot, X = FIRE.x * S, by = FIRE.y * S + 5;
    ctx.drawImage(p.cv, X - p.ax, by - p.by);
    if (Math.random() < 0.5) P(ctx, X - 4 + Math.floor(Math.random() * 8), by - 17, 2, 1, '#ffd078');
  },
};

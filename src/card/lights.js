// Card: lights after the night tint, and redrawing people in front of them.
import { BULB_CSS, BULB_RGB, getPartyStrings, partyBulbs } from '../art/shared.js';
import { AMPHI_LANTERNS } from '../art/venues.js';
import { byDepth } from './render.js';
import { mixHex, ramp } from '../core/color.js';
import { OUT, S } from '../core/constants.js';
import { rand } from '../core/math.js';
import { P, disc, mk, opaqueBox } from '../core/pixels.js';
import { CART, FIRE, HOUSES, LAMPS, TABLES } from '../world/layout.js';

export const lightMethods = {
  _partyStrings() {
    return getPartyStrings();
  },

  // The bunting never changes: paint it once into a full-size layer and reuse it.
  _drawBunting(ctx) {
    if (!this._buntingSpr) {
      const pts = this._partyStrings().flat(), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x0 = Math.min(...xs) - 4, y0 = Math.min(...ys) - 2, c = mk(Math.max(...xs) - x0 + 10, Math.max(...ys) - y0 + 10), g = c.getContext('2d');
      g.translate(-x0, -y0);
      this._paintBunting(g);
      this._buntingSpr = { c, x0, y0 };
    }
    ctx.drawImage(this._buntingSpr.c, this._buntingSpr.x0, this._buntingSpr.y0);
  },

  _paintBunting(ctx) {
    const cols = ['#e04848', '#f0c040', '#40a0e0', '#50c060', '#e070c0'];
    this._partyStrings().forEach((pts) => {
      pts.forEach(([x, y], i) => {
        P(ctx, x, y, 4, 1, '#3a3030');
        if (i % 3 === 1) {
          const c = ramp(cols[i % cols.length]);
          for (let r = 0; r < 6; r++) P(ctx, x - 2 + (r >> 1), y + 1 + r, 6 - (r >> 1) * 2, 1, r < 2 ? c.l : c.m);
          P(ctx, x - 3, y + 1, 1, 2, OUT); P(ctx, x + 4, y + 1, 1, 2, OUT);
        }
      });
    });
  },

  _drawPartyLights(ctx, dark) {
    const k = Math.floor(this._t * 3);
    for (const { x, y, i } of partyBulbs()) {
      const c = (i / 3 + k) % BULB_RGB.length;
      P(ctx, x, y + 1, 2, 3, BULB_CSS[c]); P(ctx, x, y + 1, 1, 1, '#ffffff');
      if (dark) this._glow(ctx, x + 1, y + 2, 8, BULB_RGB[c], 0.45);
    }
  },

  _drawWindows(ctx, dark) {
    const occ = this._occ || [];
    HOUSES.forEach((h, i) => {
      const o = occ[i];
      if (o?.lit) {
        h.glass.forEach(([gx, gy], wi) => {
          const flick = 0.9 + Math.sin(this._t * 3 + i) * 0.1;
          if (dark) this._glow(ctx, gx + 4, gy + 5, 22, '255,180,80', 0.38 * flick);
          P(ctx, gx, gy, 9, 9, '#ffcf6a'); P(ctx, gx, gy, 9, 3, '#ffeaa8'); P(ctx, gx, gy + 7, 9, 2, '#f0a848');
          if (o.inside && !o.sleeping && wi === Math.floor(this._t / 6 + i) % h.glass.length) {
            const sx = gx + 4 + Math.round(Math.sin(this._t * 0.8 + i) * 2);
            disc(ctx, sx, gy + 4, 2, '#6a4030'); P(ctx, sx - 3, gy + 6, 7, 3, '#6a4030');
          }
          P(ctx, gx + 4, gy, 1, 9, '#5a3a20'); P(ctx, gx, gy + 4, 9, 1, '#5a3a20');
        });
      }
      if (dark && i === 0) {
        for (const [lx, ly] of AMPHI_LANTERNS) { P(ctx, lx - 1, ly - 1, 3, 3, '#ffe48a'); this._glow(ctx, lx, ly, 16, '255,190,90', 0.4); }
        for (const [lx, ly] of LAMPS) {
          P(ctx, lx - 2, ly - 37, 5, 5, '#ffe48a'); P(ctx, lx - 1, ly - 36, 1, 3, '#ffffff');
          this._glow(ctx, lx, ly - 34, 30, '255,190,90', 0.45);
        }
      }
      if (dark && this._mode !== 'away') {
        const { x, y } = h.lantern;
        P(ctx, x - 1, y + 1, 3, 4, '#ffe48a'); P(ctx, x, y + 2, 1, 2, '#ffffff');
        this._glow(ctx, x, y + 3, 16, '255,190,90', 0.42);
      }
    });
  },

  // Lights (windows, lanterns, lamps, café candles, party bulbs, event lights, the fire) are drawn after the
  // night tint so they stay bright. Anyone standing in front of one is drawn again on top, tinted to match the
  // night (or warmed by the fire, by distance), and cut away wherever something nearer covers them, so the
  // light never shows through them and they never cover what stands in front of them.
  _redrawInFrontOfLights(ctx, tint, dark, items, fixed) {
    const rects = (this._lightRects ||= []);
    rects.length = 0;
    const push = (x, y, w, h, base, t) => rects.push(x, y, w, h, base, t); // flat: 6 numbers per light
    HOUSES.forEach((h, i) => {
      if (this._occ?.[i]?.lit) for (const [gx, gy] of h.glass) push(gx, gy, 9, 9, h.base, undefined);
      if (dark && this._mode !== 'away') push(h.lantern.x - 2, h.lantern.y, 5, 7, h.base, undefined);
    });
    if (dark) {
      for (const [lx, ly] of LAMPS) push(lx - 3, ly - 38, 7, 7, ly / S, undefined);
      for (const [lx, ly] of AMPHI_LANTERNS) push(lx - 1, ly - 1, 3, 3, (ly + 17) / S, undefined);
      if (this._mode !== 'away') {
        TABLES.forEach(([tx, ty]) => push(tx - 3, ty - 15, 7, 7, (ty + 3) / S, undefined)); // candle flames
        push(CART.x - 10, CART.by - 50, 20, 20, CART.by / S, undefined);
      }
    }
    if (this._mode === 'party') for (const b of partyBulbs()) push(b.x - 1, b.y, 4, 5, b.base, undefined);
    if (this._event?.E.lightRects) for (const [x, y, w, h, base, t] of this._event.E.lightRects(this, this._event, dark)) push(x, y, w, h, base, t);
    // the fire: by day only the flames themselves; after dark the whole glow, warmer closer in (four steps)
    const lvl = this._fireLevel(), fireR = !lvl ? 0 : !dark ? 24 : lvl === 3 ? 110 : lvl === 2 ? 75 : 30;
    const fx = FIRE.x * S, fy = FIRE.y * S - 6;
    if (dark && this._warmFor !== tint) { this._warmFor = tint; this._warm = [1, 2, 3, 4].map((k) => mixHex(tint || '#ffffff', '#ffd8a8', 0.15 * k)); }
    if (!rects.length && !fireR) return;
    // what tint someone at [x, y, w, h] with depth line wy gets redrawn with: undefined = not in front of a light
    const lightOn = (x, y, w, h, wy, person) => {
      if (person && fireR && wy > FIRE.y + 0.3) {
        const near = Math.hypot(Math.max(x - fx, 0, fx - x - w), Math.max(y - fy, 0, fy - y - h)); // closest point of the sprite
        if (near < fireR) {
          if (!dark) return null; // in front of the flames: plain redraw
          const d = Math.min(1, Math.hypot(x + w / 2 - fx, y + h - 4 - fy) / fireR);
          return this._warm[Math.min(3, Math.floor((1 - d) * 4))];
        }
      }
      for (let k = 0; k < rects.length; k += 6) {
        const rx = rects[k], ry = rects[k + 1];
        if (wy > rects[k + 4] + (person ? 0 : 0.35) && rx < x + w && rx + rects[k + 2] > x && ry < y + h && ry + rects[k + 3] > y) return rects[k + 5] === undefined ? tint : rects[k + 5];
      }
      return undefined;
    };
    // who gets redrawn, and with which tint
    const redo = (this._redo ||= []), frame = this._frameNo;
    redo.length = 0;
    const consider = (it, person) => {
      const g = it.g();
      if (!g) return;
      const t = lightOn(g[1], g[2], g[0].width, g[0].height, it.y, person);
      if (t === undefined) return;
      it._redoFrame = frame; it._redoTint = t;
      redo.push(it);
    };
    for (const it of items) {
      if (!it.who) continue;
      if (it.animal && it.who.type === 'bird' && it.who.alt > 0) continue; // up on a roof ridge
      consider(it, true);
    }
    if (rects.length) for (const it of fixed) if (it.lit) consider(it, false); // a shrub or tree in front of a lamp
    if (!redo.length) return;
    // back to front, so redrawn things cover each other properly; whatever nearer isn't redrawn is cut away
    redo.sort(byDepth);
    const masks = (this._masks ||= []);
    // the painted part of a sprite as drawn: [left, top, right, bottom] in canvas pixels
    const box = (g, out) => {
      const b = opaqueBox(g[0]), w = g[0].width;
      out[0] = g[1] + (g[3] ? w - b[2] : b[0]); out[2] = g[1] + (g[3] ? w - b[0] : b[2]);
      out[1] = g[2] + b[1]; out[3] = g[2] + b[3];
      return out;
    };
    const A = [0, 0, 0, 0], B = [0, 0, 0, 0];
    const nearer = (list, it) => {
      for (const o of list) {
        if (!o.g || o._redoFrame === frame || byDepth(o, it) <= 0) continue;
        const g = o.g();
        if (!g || g[1] >= A[2] || g[1] + g[0].width <= A[0] || g[2] >= A[3] || g[2] + g[0].height <= A[1]) continue;
        box(g, B);
        if (B[0] < A[2] && B[2] > A[0] && B[1] < A[3] && B[3] > A[1]) masks.push(g);
      }
    };
    for (const it of redo) {
      const g = it.g();
      box(g, A);
      masks.length = 0;
      nearer(items, it); nearer(fixed, it);
      this._drawTinted(ctx, g[0], g[1], g[2], g[3], it._redoTint, masks);
    }
  },

  // Draw a sprite on top of the lit layer, matching the scene's lighting (multiplied by the tint), minus
  // whatever nearer sprites (masks: [canvas, x, y, mirrored]) cover it.
  _drawTinted(ctx, cv, x, y, flip, tint, masks) {
    const w = cv.width, h = cv.height;
    let tmp = this._tintTmp;
    if (!tmp || tmp.width < w || tmp.height < h) tmp = this._tintTmp = mk(Math.max(64, w, tmp?.width || 0), Math.max(64, h, tmp?.height || 0));
    const tg = tmp.getContext('2d');
    const put = (c, dx, dy, f) => {
      if (f) { tg.setTransform(-1, 0, 0, 1, dx + c.width, dy); tg.drawImage(c, 0, 0); tg.setTransform(1, 0, 0, 1, 0, 0); } else tg.drawImage(c, dx, dy);
    };
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h);
    put(cv, 0, 0, flip);
    if (tint) {
      tg.globalCompositeOperation = 'multiply'; tg.fillStyle = tint; tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'destination-in'; put(cv, 0, 0, flip);
    }
    if (masks?.length) {
      tg.globalCompositeOperation = 'destination-out';
      for (const [mc, mx, my, mf] of masks) put(mc, mx - x, my - y, mf);
    }
    tg.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0, w, h, x, y, w, h);
  },

  _drawFlames(ctx, dark) {
    const lvl = this._fireLevel();
    if (!lvl) return;
    const cx = FIRE.x * S, by = FIRE.y * S + 2, pot = this._potOn(), t = this._t;
    const glowR = lvl === 3 ? 110 : lvl === 2 ? 75 : 30;
    this._glow(ctx, cx, by - 6, glowR, '255,150,60', (lvl === 1 ? 0.2 : 0.4) * (dark ? 1 : 0.35) * (0.92 + Math.random() * 0.08));
    if (lvl === 1) {
      for (let i = 0; i < 8; i++) P(ctx, cx - 9 + i * 2 + (i % 2), by - 3 + (i % 2), 2, 1, Math.random() < 0.5 ? '#ff7a28' : '#c83a10');
      return;
    }
    const hw = lvl === 3 ? 12 : 8, maxH = pot ? 7 : lvl === 3 ? 30 : 20;
    for (let dx = -hw; dx <= hw; dx++) {
      const u = dx / (hw + 1);
      const wob = 0.62 + 0.38 * Math.sin(t * 11 + dx * 0.9) * Math.sin(t * 7.3 + dx * 0.4);
      const hc = Math.round(maxH * Math.pow(1 - u * u, 0.9) * wob * (0.85 + 0.15 * Math.random()));
      // colours only change a few times up a column, so fill each run of one colour at once
      let run = null, from = 0;
      for (let i = 0; i <= hc; i++) {
        let c = null;
        if (i < hc) {
          const v = i / maxH, inner = Math.abs(u) / Math.max(0.15, 1 - v * 0.9);
          if (i >= hc - 2) c = '#d83a18';
          else if (inner < 0.35 && v < 0.55) c = '#fff6c8';
          else if (inner < 0.7 && v < 0.78) c = '#ffc038';
          else c = '#ff7a20';
        }
        if (c !== run) {
          if (run) { ctx.fillStyle = run; ctx.fillRect(cx + dx, by - 2 - i, 1, i - from); }
          run = c; from = i;
        }
      }
    }
    if (!pot && Math.random() < 0.6) P(ctx, cx + Math.round(rand(-5, 5)), by - maxH - Math.round(rand(2, 8)), 2, 2, '#ff9a30');
  },
};

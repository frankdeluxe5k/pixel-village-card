// Card: fireflies, particles and weather.
import { RH, RW, S } from '../core/constants.js';
import { rand } from '../core/math.js';
import { P, line, mk } from '../core/pixels.js';

export const effectMethods = {
  _drawFireflies(ctx) {
    for (const f of this._flies) {
      const a = Math.max(0, Math.sin(f.p * 1.7));
      if (a < 0.2) continue;
      const x = Math.round(f.x * S), y = Math.round(f.y * S), q = Math.round(a * 100) / 100;
      ctx.globalAlpha = Math.round(a * 35) / 100; ctx.fillStyle = '#dcff78';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = q; ctx.fillStyle = '#f0ffaa';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  },

  _drawParticles(ctx, layer) {
    const puffs = this._art().puffs;
    for (const p of this._particles) {
      if (p.layer !== layer) continue;
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      const x = Math.round(p.x * S), y = Math.round(p.y * S);
      if (p.g) this._glyph(ctx, p.g, x, y, p.c);
      else if (p.grow) {
        const r = Math.max(1, Math.min(5, 1 + Math.floor((3.5 - p.life) * 1.5)));
        ctx.drawImage(puffs[r], x - r - 1, y - r - 1);
      } else {
        ctx.fillStyle = p.c;
        ctx.fillRect(x, y, 2, p.grav ? 2 : 1 + (p.layer ? 1 : 0));
      }
    }
    ctx.globalAlpha = 1;
  },

  _drawWeather(ctx, dark) {
    const w = this._weather;
    for (const d of this._drops) {
      const x = Math.round(d.x * S), y = Math.round(d.y * S);
      if (d.snow) { P(ctx, x, y, 2, 2, '#ffffff'); P(ctx, x + 1, y + 1, 1, 1, '#c8d4ec'); }
      else if (d.hail) { P(ctx, x, y, 2, 2, '#f4f8ff'); P(ctx, x + 1, y + 1, 1, 1, '#a8b8d8'); P(ctx, x, y - 3, 1, 2, 'rgba(220,230,250,0.5)'); }
      else P(ctx, x, y, 1, 6, dark ? 'rgba(160,180,230,0.55)' : 'rgba(190,215,245,0.7)');
    }
    if (this._splashes?.length) ctx.fillStyle = 'rgba(200,220,250,0.7)';
    for (const s of this._splashes || []) {
      const x = Math.round(s.x * S), y = Math.round(s.y * S);
      ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillRect(x - 1, y, 3, 1);
    }
    if (w.fog) {
      const strip = (this._fogSpr ||= (() => {
        const c = mk(RW, 30), g = c.getContext('2d');
        g.fillStyle = 'rgba(225,230,238,0.16)';
        g.fillRect(0, 0, RW, 30); g.fillRect(0, 6, RW, 18);
        return c;
      })());
      for (let i = 0; i < 5; i++) ctx.drawImage(strip, 0, 120 + i * 42 + Math.round(Math.sin(this._t * 0.3 + i) * 6));
    }
    if (this._flash > 0) {
      if (!this._bolt) {
        this._bolt = [];
        let x = rand(60, RW - 60), y = 0;
        while (y < 150) { this._bolt.push([x, y]); x += rand(-10, 10); y += rand(8, 16); }
      }
      for (let i = 1; i < this._bolt.length; i++) {
        const [x0, y0] = this._bolt[i - 1], [x1, y1] = this._bolt[i];
        line(ctx, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), 'rgba(170,190,255,0.6)', 3);
        line(ctx, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), '#ffffff', 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, RW, RH);
    } else this._bolt = null;
  },
};

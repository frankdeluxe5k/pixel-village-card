// Card: the amphitheater screen, film, projector and console.
import { FILM_H, FILM_W, SIGN_H, SIGN_W } from '../art/venues.js';
import { OUT, S } from '../core/constants.js';
import { P, disc, flipH, mk } from '../core/pixels.js';
import { PROJ, SCREEN_Q, stairY } from '../world/layout.js';

export const screenMethods = {
  _drawScreen(ctx) {
    const Q = SCREEN_Q;
    if (this._screen <= 0) return;
    if (this._screen >= 1) {
      // fully down (most of a movie or an away day): the same pixels every frame, so draw them once
      const k = this._sign === 2 ? 1 : 0, c = ((this._screenCv ||= [])[k] ||= (() => {
        let y0 = Infinity, y1 = -Infinity;
        for (let x = Q.lx + 1; x < Q.rx; x++) { y0 = Math.min(y0, stairY(x, Q.ltop) + 2); y1 = Math.max(y1, stairY(x, Q.lbot) + 1); }
        const cv = mk(Q.rx - Q.lx, y1 - y0 + 1), g = cv.getContext('2d');
        g.translate(-Q.lx, -y0);
        this._paintScreen(g, 1, k === 1);
        return { cv, y0 };
      })());
      ctx.drawImage(c.cv, Q.lx, c.y0);
      return;
    }
    this._paintScreen(ctx, this._screen, false);
  },

  _paintScreen(ctx, amount, sign) {
    const Q = SCREEN_Q;
    for (let x = Q.lx + 1; x < Q.rx; x++) {
      const u = (x - Q.lx) / (Q.rx - Q.lx), top = stairY(x, Q.ltop) + 2, bot = stairY(x, Q.lbot) - 1;
      const h = Math.round((bot - top) * amount);
      P(ctx, x, top, 1, h, u > 0.8 ? '#ddd4c0' : '#efe8d6');
      P(ctx, x, top + h, 1, 1, OUT);
    }
    if (sign) {
      const cv = this._art().signCard.cv, a = Q.lx + 2;
      for (let x = a; x < a + SIGN_W; x++) ctx.drawImage(cv, x - a, 0, 1, SIGN_H, x, stairY(x, Q.ltop) + 5, 1, SIGN_H);
    }
  },

  // Draw the film flat, then lay it onto the angled screen one column at a time.
  _blitAngled(ctx, cv) {
    const Q = SCREEN_Q, a = Q.lx + 2, b = Q.rx - 2;
    for (let x = a; x <= b; x++) {
      const u = (x - a) / (b - a), sx = Math.min(FILM_W - 1, Math.floor(u * FILM_W));
      const top = stairY(x, Q.ltop) + 5, bot = stairY(x, Q.lbot) - 3;
      ctx.drawImage(cv, sx, 0, 1, FILM_H, x, top, 1, bot - top);
    }
  },

  _projectorGeom() {
    const p = this._art().projector;
    p.l = p.l || flipH(p.cv);
    return (p.geom ||= [p.l, PROJ.x * S - (p.cv.width - 1 - p.ax), PROJ.y * S - p.by, false]);
  },

  _drawProjector(ctx) {
    // faces left, toward the stage
    const p = this._art().projector;
    p.l = p.l || flipH(p.cv);
    ctx.drawImage(p.l, PROJ.x * S - (p.cv.width - 1 - p.ax), PROJ.y * S - p.by);
  },

  _drawReels(ctx) {
    const p = this._art().projector, X = PROJ.x * S, Y = PROJ.y * S;
    const spin = this._mode === 'movie' && this._screen >= 1 ? this._t * 6 : 0;
    for (const [rx, ry] of p.reels) {
      const cx = X - rx, cy = Y + ry;
      disc(ctx, cx, cy, 5, OUT); disc(ctx, cx, cy, 4, '#34343e'); disc(ctx, cx, cy, 1, '#8a8a9a');
      for (let k = 0; k < 3; k++) {
        const ang = spin + (k * Math.PI * 2) / 3;
        P(ctx, cx + Math.round(Math.cos(ang) * 3), cy + Math.round(Math.sin(ang) * 3), 1, 1, '#9a9aaa');
      }
    }
  },

  _filmScene() {
    return Math.floor(this._t / 6) % 3;
  },

  _drawFilm(ctx, dark) {
    const a = this._art(), Q = SCREEN_Q;
    const sc = this._filmScene(), u = this._t % 6;
    const lens = [PROJ.x * S - a.projector.lens[0], PROJ.y * S + a.projector.lens[1]];

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = dark ? 'rgba(200,215,255,0.1)' : 'rgba(200,215,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(lens[0], lens[1]); ctx.lineTo(Q.rx - 3, Q.rtop + 5); ctx.lineTo(Q.lx + 3, Q.lbot - 3); ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (dark) this._glow(ctx, Q.rx + 26, Q.lbot + 8, 90, ['110,130,255', '255,200,120', '255,140,150'][sc], 0.2);

    const cv = (this._filmCv ||= mk(FILM_W, FILM_H)), fc = cv.getContext('2d');
    fc.clearRect(0, 0, FILM_W, FILM_H);
    if (this._mode === 'gaming') this._drawGame(fc, 0, 0);
    else this._drawFilmContent(fc, 0, 0, a, sc, u);
    ctx.imageSmoothingEnabled = false;
    this._blitAngled(ctx, cv);
  },

  _drawFilmContent(ctx, X, Y, a, sc, u) {
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, FILM_W, FILM_H); ctx.clip();
    ctx.drawImage(a.film[sc], X, Y);
    const fr = Math.floor(this._t * 8) % 2;
    if (sc === 0) {
      const rx = Math.round(X - 16 + (u / 6) * (FILM_W + 24)), ry = Math.round(Y + 18 + Math.sin(u * 2) * 2);
      P(ctx, rx - 3 - fr, ry, 3 + fr, 3, '#ffb030'); P(ctx, rx - 2, ry + 1, 2, 1, '#ffffff');
      P(ctx, rx, ry - 2, 2, 2, '#e04040'); P(ctx, rx, ry + 3, 2, 2, '#e04040');
      P(ctx, rx, ry, 9, 3, '#dcdce8'); P(ctx, rx, ry, 9, 1, '#ffffff');
      P(ctx, rx + 9, ry, 1, 3, '#e04040'); P(ctx, rx + 10, ry + 1, 1, 1, '#e04040');
      P(ctx, rx + 5, ry + 1, 2, 1, '#4ab0f0');
    } else if (sc === 1) {
      const x = Math.round(X - 6 + ((u * 7) % (FILM_W + 12))), y = Y + 16;
      P(ctx, x - 2, y, 7, 1, '#6a4020'); P(ctx, x - 1, y - 1, 4, 1, '#6a4020');
      P(ctx, x, y + 1, 3, 3, '#f2c7a0'); P(ctx, x + 2, y + 2, 1, 1, '#1c1220');
      P(ctx, x - 1, y + 4, 4, 4, '#c04040'); P(ctx, x - 1, y + 7, 4, 1, '#3a2418');
      if (fr) { P(ctx, x - 1, y + 8, 1, 3, '#3a4a8a'); P(ctx, x + 2, y + 8, 1, 3, '#3a4a8a'); }
      else P(ctx, x, y + 8, 2, 3, '#3a4a8a');
    } else {
      const k = Math.round(Math.min(u, 4) * 2.4);
      for (const [x, skirt] of [[X + 8 + k, false], [X + 35 - k, true]]) {
        disc(ctx, x, Y + 13, 2, '#3a2030');
        P(ctx, x - 2, Y + 16, 5, 6, '#3a2030');
        if (skirt) P(ctx, x - 3, Y + 20, 7, 3, '#3a2030');
        P(ctx, x - 1, Y + 22, 1, 2, '#3a2030'); P(ctx, x + 1, Y + 22, 1, 2, '#3a2030');
      }
      if (u > 4) this._glyph(ctx, 'heart', X + 22, Y + 4, '#ff4060');
    }
    if (Math.random() < 0.25) P(ctx, X + Math.floor(Math.random() * FILM_W), Y, 1, FILM_H, 'rgba(255,255,255,0.18)');
    if (Math.random() < 0.15) P(ctx, X, Y, FILM_W, FILM_H, 'rgba(0,0,0,0.12)');
    ctx.restore();
  },

  // An old-school console on the stage deck, with a cable to each player's controller.
  _drawConsole(ctx) {
    const cx = 40, cy = 343;
    P(ctx, cx - 7, cy - 6, 14, 6, OUT); P(ctx, cx - 6, cy - 5, 12, 4, '#a8a8b4'); P(ctx, cx - 6, cy - 5, 12, 1, '#d0d0dc');
    P(ctx, cx - 4, cy - 4, 5, 1, '#4a4a56'); P(ctx, cx + 3, cy - 3, 2, 1, Math.floor(this._t * 2) % 2 ? '#ff4040' : '#a02020');
    for (const v of this._villagers) {
      if (v.walking || v.action !== 'controller') continue;
      const hx = v.x * S + v.face * 5, hy = v.y * S - 7 - this._lift(v) * S;
      ctx.fillStyle = '#26262e';
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, x = cx + 4 + (hx - cx - 4) * u, y = cy - 2 + (hy - cy + 2) * u + Math.sin(u * Math.PI) * 7;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  },

  // Retro games on the big screen: a platformer, a racer and a paddle game.
  _drawGame(ctx, X, Y) {
    const t = this._t, sc = Math.floor(t / 8) % 3, fr = Math.floor(t * 8) % 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, FILM_W, FILM_H); ctx.clip();
    if (sc === 0) {
      P(ctx, X, Y, FILM_W, FILM_H, '#6ab0f0');
      const off = Math.floor(t * 12) % 8, cl = Math.floor(t * 3) % (FILM_W + 12);
      P(ctx, X + FILM_W - cl, Y + 4, 8, 3, '#ffffff'); P(ctx, X + FILM_W - cl + 2, Y + 3, 4, 1, '#ffffff');
      for (let x = -off; x < FILM_W; x += 8) { P(ctx, X + x, Y + 30, 8, 6, '#b8702c'); P(ctx, X + x, Y + 30, 8, 2, '#5ab040'); P(ctx, X + x, Y + 33, 1, 3, '#8a4a20'); }
      const bx = X + FILM_W - ((t * 12) % (FILM_W + 16)) ;
      P(ctx, Math.round(bx), Y + 14, 6, 6, '#e8b030'); P(ctx, Math.round(bx) + 2, Y + 15, 2, 4, '#ffffff');
      const jy = Math.round(Math.abs(Math.sin(t * 3)) * 11);
      P(ctx, X + 12, Y + 22 - jy, 4, 2, '#d03030'); P(ctx, X + 12, Y + 24 - jy, 4, 2, '#f0c8a0'); P(ctx, X + 12, Y + 26 - jy, 4, 3, '#3050c8');
      P(ctx, X + 12 + fr, Y + 29 - jy, 1, 1, '#6a3a1a'); P(ctx, X + 15 - fr, Y + 29 - jy, 1, 1, '#6a3a1a');
      if (fr) P(ctx, X + 30, Y + 10, 2, 3, '#ffe040');
    } else if (sc === 1) {
      P(ctx, X, Y, FILM_W, FILM_H, '#4a9a3a'); P(ctx, X + 10, Y, 24, FILM_H, '#5a5a66'); P(ctx, X + 9, Y, 1, FILM_H, '#ffffff'); P(ctx, X + 34, Y, 1, FILM_H, '#ffffff');
      const d = Math.floor(t * 40) % 8;
      for (let y = -8 + d; y < FILM_H; y += 8) P(ctx, X + 21, Y + y, 2, 4, '#f0e8a0');
      for (let y = -12 + (Math.floor(t * 40) % 12); y < FILM_H; y += 12) { P(ctx, X + 3, Y + y, 3, 3, '#2a6a2a'); P(ctx, X + 38, Y + y + 5, 3, 3, '#2a6a2a'); }
      const lead = Math.sin(t * 0.9) * 6;
      for (const [cx, cy, col] of [[X + 13, Y + 20 + lead, '#e03a3a'], [X + 26, Y + 20 - lead, '#3a7ae0']]) {
        P(ctx, Math.round(cx), Math.round(cy), 5, 8, col); P(ctx, Math.round(cx) + 1, Math.round(cy) + 2, 3, 2, '#c8e8ff');
        P(ctx, Math.round(cx) - 1, Math.round(cy) + 1, 1, 2, '#1a1a20'); P(ctx, Math.round(cx) + 5, Math.round(cy) + 1, 1, 2, '#1a1a20');
        P(ctx, Math.round(cx) - 1, Math.round(cy) + 5, 1, 2, '#1a1a20'); P(ctx, Math.round(cx) + 5, Math.round(cy) + 5, 1, 2, '#1a1a20');
      }
    } else {
      P(ctx, X, Y, FILM_W, FILM_H, '#10101a');
      for (let y = 1; y < FILM_H; y += 4) P(ctx, X + 21, Y + y, 1, 2, '#5a5a6a');
      const u = (t * 0.7) % 2, bx = X + 3 + (u < 1 ? u : 2 - u) * (FILM_W - 8);
      const w = (t * 1.1) % 2, by = Y + 2 + (w < 1 ? w : 2 - w) * (FILM_H - 6);
      P(ctx, Math.round(bx), Math.round(by), 2, 2, '#ffffff');
      P(ctx, X + 1, Math.round(Math.max(Y + 1, Math.min(Y + FILM_H - 8, by - 3))), 2, 7, '#f0f0f0');
      P(ctx, X + FILM_W - 3, Math.round(Math.max(Y + 1, Math.min(Y + FILM_H - 8, by - 2 + Math.sin(t * 3) * 3))), 2, 7, '#f0f0f0');
    }
    if (Math.random() < 0.15) P(ctx, X, Y, FILM_W, FILM_H, 'rgba(0,0,0,0.1)');
    for (let y = Y; y < Y + FILM_H; y += 2) P(ctx, X, y, FILM_W, 1, 'rgba(0,0,0,0.12)');
    ctx.restore();
  },
};

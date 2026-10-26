// Card: villager poses, sprite caching and bubbles.
import { GLYPHS, glyphSprite } from '../art/text.js';
import { ACTION_POSE, ANIM, KEYS, LIFT, VARIANTS } from '../art/villager/anim.js';
import { buildVillager } from '../art/villager/build.js';
import { AX, FY, SW } from '../art/villager/frame.js';
import { skinRamp } from '../core/color.js';
import { OUT, S } from '../core/constants.js';
import { P } from '../core/pixels.js';
import { mulberry32, pickWeighted } from '../core/math.js';

// long actions pick a fresh variant every so often (a woodcutter stops for a breather, then chops on)
const REROLL = new Set(['chop', 'farm', 'sweep', 'rake', 'cook', 'band_guitar', 'band_bass', 'bounce']);

export const SPRITE_CACHE_MAX = 64; // per villager; the least recently drawn poses are dropped first
export const spriteMethods = {
  _glyph(ctx, name, x, y, c) {
    ctx.drawImage(glyphSprite(name, c), x - (GLYPHS[name][0].length >> 1), y);
  },

  _drawBubble(ctx, v) {
    const b = v.bubble, g = GLYPHS[b.g];
    const gw = g[0].length, gh = g.length;
    const x = Math.round(v.x * S);
    const bw = Math.max(11, gw + 6), bh = gh + 6;
    const top = Math.round(v.y * S) - (v.small ? 28 : 33) - this._lift(v) * S - bh - 3;
    const bx = x - (bw >> 1);
    P(ctx, bx + 1, top, bw - 2, bh, OUT); P(ctx, bx, top + 1, bw, bh - 2, OUT);
    P(ctx, bx + 1, top + 1, bw - 2, bh - 2, '#ffffff'); P(ctx, bx + 1, top + bh - 2, bw - 2, 1, '#d8dce8');
    P(ctx, x - 1, top + bh - 1, 3, 1, '#ffffff'); P(ctx, x - 2, top + bh - 1, 1, 2, OUT); P(ctx, x + 2, top + bh - 1, 1, 2, OUT);
    P(ctx, x - 1, top + bh, 3, 1, OUT); P(ctx, x, top + bh, 1, 1, '#ffffff'); P(ctx, x, top + bh + 1, 1, 1, OUT);
    this._glyph(ctx, b.g, x, top + 3, b.c);
  },

  _poseOf(v) {
    if (v._poseFrame === this._frameNo && v._pose) return v._pose;
    v._poseFrame = this._frameNo;
    return (v._pose = this._computePose(v));
  },

  _computePose(v) {
    const act = v.walking ? 'walk' : v.action;
    let pose;
    if (v.bike) {
      const step = v.walking ? Math.floor(this._t * 8) % 4 : 0;
      return { pose: 'ride', frame: step, step };
    }
    if (act === 'perform' && v.job === 'band') pose = 'band_' + v.instr;
    else switch (act) {
      case 'walk': case 'stretch': case 'dance': case 'farm': case 'chop': case 'cook': case 'chat': case 'sweep':
      case 'fetch': case 'eat': case 'watch': case 'water': case 'sit': case 'laptop': case 'sip': case 'serve':
      case 'handheld': case 'controller':
        pose = act; break;
      case 'sign': case 'unsign': pose = 'sign'; break;
      case 'setup': case 'teardown': pose = 'setup'; break;
      case 'perform': pose = 'lute'; break;
      case 'play': pose = v.job === 'child' ? 'kidplay' : this._mode === 'evening' ? 'lutesit' : 'lute'; break;
      default: pose = ACTION_POSE[act] || 'idle';
    }
    if (pose === 'walk' && v.pulling) pose = 'pull';
    else if (pose === 'walk' && v.pushing) pose = 'push';
    if (act === 'playfetch') { // the throw plays once from its start, then the kid waits for the dog
      const since = this._t - (v.throwAt ?? -9);
      if (since < 2) {
        const [, rate, order] = ANIM.throwball, step = Math.min(order.length - 1, Math.floor(since * rate));
        return { pose: 'throwball', frame: order[step], step };
      }
      pose = 'idle';
    }
    if (VARIANTS[pose]) pose = this._variantOf(v, pose);
    const [keys, rate, order] = ANIM[pose];
    const step = Math.floor(this._t * rate + v.seed * 10) % order.length;
    const frame = order[step];
    return { pose, frame, step, flip: !!(keys && KEYS[keys][frame]?.turn) };
  },

  // Which take on a base pose this villager is playing: picked when the action starts, re-picked now and then
  // in long ones. Uses the villager's own random stream, so the shared Math.random sequence is untouched.
  _variantOf(v, base) {
    if (v.carry || v.gear) return base;
    if (v.varBase !== base || v.varPlan !== v.plan || (v.varAt && this._t >= v.varAt)) {
      const rnd = (v.vrng ||= mulberry32(Math.floor(v.seed * 4294967296)));
      v.varBase = base; v.varPlan = v.plan;
      v.variant = pickWeighted(VARIANTS[base], rnd);
      v.varAt = REROLL.has(base) ? this._t + 6 + rnd() * 6 : 0;
    }
    return v.variant;
  },

  // A villager's sprite for this frame: built on first use, kept in a small per-person cache.
  _spriteOf(v, build) {
    const { pose, frame } = this._poseOf(v);
    const key = `${pose}|${frame}|${v.carry || ''}|${v.gear ? 1 : 0}`;
    let spr = v.sprites.get(key);
    if (!build) return spr;
    if (spr) { if (v.sprites.size >= SPRITE_CACHE_MAX >> 1) { v.sprites.delete(key); v.sprites.set(key, spr); } } // keep recently used poses
    else {
      if (v.sprites.size >= SPRITE_CACHE_MAX) v.sprites.delete(v.sprites.keys().next().value);
      spr = buildVillager(v, pose, frame, v.carry, v.gear);
      v.sprites.set(key, spr);
    }
    return spr;
  },

  _lift(v) {
    const { pose, step } = this._poseOf(v);
    let lift = LIFT[pose] ? LIFT[pose][step % 4] : 0;
    if (pose === 'walk' && this._mode === 'party') lift = step % 3 === 1 ? 2 : 0;
    if (v.jumpT > 0) lift += Math.round(Math.sin((v.jumpT / 0.5) * Math.PI) * 4);
    return lift;
  },

  // [sprite canvas, x, y, mirrored] as drawn this frame, or null before the sprite exists
  _villagerGeom(v) {
    if (v._geomFrame === this._frameNo && v._geom?.[0]) return v._geom;
    const spr = this._spriteOf(v, false);
    if (!spr) return null;
    v._geomFrame = this._frameNo;
    const g = (v._geom ||= [null, 0, 0, false]);
    g[0] = spr.cv; g[1] = Math.round(v.x * S) - AX; g[2] = Math.round(v.y * S) - FY - this._lift(v) * S; g[3] = this._mirrored(v);
    return g;
  },

  // left-facing, or mid-spin (a `turn` keyframe flips the sprite)
  _mirrored(v) {
    return (v.face < 0) !== !!this._poseOf(v).flip;
  },

  _drawVillager(ctx, v) {
    const spr = this._spriteOf(v, true), mir = this._mirrored(v);
    const x = Math.round(v.x * S), y = Math.round(v.y * S);
    ctx.fillStyle = 'rgba(16,16,40,0.3)';
    ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 7, y, 15, 1);
    const sx = x - AX, sy = y - FY - this._lift(v) * S;
    if (!mir) ctx.drawImage(spr.cv, sx, sy);
    else {
      // mirror at draw time instead of caching a flipped copy of every frame
      ctx.setTransform(-1, 0, 0, 1, sx + SW, sy); ctx.drawImage(spr.cv, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if ((this._t + v.seed * 7) % 4 < 0.15) {
      for (const [x, y] of spr.eyes) {
        const ex = !mir ? sx + x : sx + SW - 2 - x;
        P(ctx, ex, sy + y, 2, 2, v.look.skin);
        P(ctx, ex, sy + y + 1, 2, 1, skinRamp(v.look.skin).d);
      }
    }
  },
};

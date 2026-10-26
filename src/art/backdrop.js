// The mountain backdrop, hills and forest edge.
import { FOLIAGE } from './foliage.js';
import { C2, hexToRgb, mixHex } from '../core/color.js';
import { HZ, RW } from '../core/constants.js';
import { mulberry32 } from '../core/math.js';
import { bayer, hash2, vnoise } from '../core/noise.js';

// The backdrop, painted back to front:
//   1. the far range: hazy, jagged, a flat-topped massif with a sheer east face, snowfields
//      lying in the gullies above the snowline;
//   2. a nearer granite range: rock above treeline, a band of tundra, dark forest below;
//   3. forested foothills with meadows and a few tilted sandstone slabs;
//   4. a forest edge of spruce/fir spires, ponderosa and aspen groves (two rows for depth);
//   5. the rolling meadow in front of the village.
// Every layer fills down to the horizon, so each one only paints the rows above the next one's top.
export function* paintBackdrop(set, snow, season) {
  const HAZE = '#b6c6e0';
  const fade = (arr, k) => arr.map((c) => hexToRgb(mixHex(c, HAZE, k)));
  const frost = (arr, k) => (snow ? arr.map((c) => mixHex(c, '#eef4fc', k)) : arr);
  const fbm = (x, y, seed, oct = 3) => { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, seed + i * 17) * a; n += a; a *= 0.5; f *= 2.03; } return v / n; };
  const ridged = (x, y, seed) => 1 - Math.abs(fbm(x, y, seed, 3) * 2 - 1);
  // Distant conifer forest as rows of little tree tips (the classic pixel-art treeline): each row is offset,
  // trees are lit on their western side, gaps between them read as shadow. Returns a palette index 0-2, or -1
  // above the forest's spiky top edge.
  const forestTex = (x, y, top, seed) => {
    const rowH = 4, dy0 = y - top + 3; // tips poke up to 3px above the forest line
    if (dy0 < 0) return -1;
    const r = Math.floor(dy0 / rowH), dy = dy0 - r * rowH, ph = Math.floor(hash2(r, 1, seed) * 4);
    const cell = Math.floor((x + ph) / 4), cx = cell * 4 + 1.5 - ph, tip = hash2(cell, r, seed + 1) * 1.6;
    const half = (dy + 1 - tip) * 0.55;
    if (r === 0 && half < Math.abs(x - cx)) return -1; // above the first row of tips: sky / rock shows
    if (half < Math.abs(x - cx) || dy < tip) return 0;
    return x < cx ? 2 : 1;
  };
  // how far down the snow reaches: deep in winter and spring, lingering snowfields in summer
  const snowAmt = (snow ? 1.5 : 0) + ({ winter: 1, spring: 0.8, fall: 0.45, summer: 0.4 }[season] ?? 0.5);

  // ridgelines: each peak is an asymmetric cone (or a tilted flat summit); the highest wins per column,
  // then the line is roughened with broad undulation and serrated pinnacles
  const profile = (peaks, seed, jag, floor) => {
    const top = new Float32Array(RW), owner = new Int16Array(RW);
    for (let x = 0; x < RW; x++) {
      let best = 1e9, who = 0;
      peaks.forEach((p, i) => {
        const dx = x - p.x, flat = p.flat || 0, ax = Math.abs(dx);
        const y = ax <= flat ? p.y + (dx + flat) * (p.tilt || 0) : p.y + (ax - flat) * (dx < 0 ? p.l : p.r);
        if (y < best) { best = y; who = i; }
      });
      best += (fbm(x * 0.035, 0.5, seed) - 0.5) * jag * 2 + (hash2(x >> 1, 7, seed) - 0.5) * jag * 0.45;
      if (hash2(x >> 2, 9, seed) < 0.12) best -= jag * 0.35; // little pinnacles
      top[x] = Math.max(0, Math.min(best, floor + (fbm(x * 0.05, 3, seed) - 0.5) * 6)); owner[x] = who;
    }
    return { top, owner, peaks };
  };

  const divide = profile([
    { x: -30, y: 92, l: 0.7, r: 0.62 }, { x: 64, y: 74, l: 0.78, r: 0.92 }, { x: 150, y: 90, l: 0.48, r: 0.52 },
    { x: 236, y: 72, l: 0.82, r: 0.55 }, { x: 292, y: 56, l: 0.72, r: 1.5, flat: 15, tilt: 0.1 },
    { x: 362, y: 84, l: 0.6, r: 0.5 }, { x: 440, y: 66, l: 0.95, r: 0.78 }, { x: 522, y: 82, l: 0.55, r: 0.62 },
    { x: 604, y: 62, l: 0.72, r: 0.84 }, { x: 700, y: 82, l: 0.62, r: 0.6 },
  ], 61, 5, HZ - 62);
  const range = profile([
    { x: 6, y: 96, l: 0.6, r: 0.72 }, { x: 108, y: 86, l: 0.84, r: 0.62 }, { x: 186, y: 104, l: 0.55, r: 0.6 },
    { x: 384, y: 90, l: 0.72, r: 0.92 }, { x: 470, y: 104, l: 0.55, r: 0.6 }, { x: 560, y: 84, l: 0.8, r: 0.72 }, { x: 664, y: 96, l: 0.6, r: 0.62 },
  ], 62, 4, HZ - 50);

  // foothills, with a few sandstone slabs leaning on them (steep west edge, longer east edge)
  const SLABS = [[176, 4, 8, 20], [192, 6, 11, 26], [209, 3, 8, 18], [223, 2, 6, 14]]; // apex x, rise above the hill, half-width, length down the slope
  const foot = new Float32Array(RW), hill = new Float32Array(RW);
  for (let x = 0; x < RW; x++) {
    hill[x] = HZ - 44 + 6 * Math.sin(x * 0.013 + 1.2) + 4 * Math.sin(x * 0.041 + 0.3) + (fbm(x * 0.02, 1.5, 63) - 0.5) * 12;
    foot[x] = hill[x];
  }
  // each slab is a steep triangle: apex just above the hill line, widening down the slope
  const slabEdge = (i, x) => {
    const [ax, rise, hw, len] = SLABS[i], t = (x - ax) / hw;
    if (t < -1 || t > 1.4) return null;
    return { top: hill[ax] - rise + (t < 0 ? -t : t / 1.4) * (len * 0.75), bot: hill[ax] - rise + len };
  };
  SLABS.forEach((sl, i) => {
    for (let x = sl[0] - sl[2]; x <= sl[0] + Math.round(sl[2] * 1.4); x++) {
      if (x < 0 || x >= RW) continue;
      const e = slabEdge(i, x);
      if (e && e.top < foot[x]) foot[x] = e.top;
    }
  });

  // the forest edge: mostly spruce and fir spires, ponderosa with flat crowns, aspen in groves
  const mh = (x) => HZ - 22 + 5 * Math.sin(x * 0.011 + 0.5) + 4 * vnoise(x * 0.03, 0.2, 15);
  const nh = (x) => HZ - 11 + 5 * Math.sin(x * 0.017 + 2) + 3 * vnoise(x * 0.05, 0.7, 17);
  const trees = [];
  const R = mulberry32(5);
  for (const row of [1, 0]) {
    for (let px = -12 + row * 2; px < RW + 12; px += (row ? 3 : 4) + R() * (row ? 3 : 5)) {
      if (fbm(px * 0.018, row + 3, 64) < 0.28) continue; // meadow gaps
      const grove = fbm(px * 0.022, 8, 65) > 0.63;
      const kind = grove ? 'aspen' : R() < 0.25 ? 'pine' : 'spruce';
      const h = (row ? 9 : 12) + R() * (row ? 10 : 15) * (kind === 'aspen' ? 0.65 : 1) + (kind === 'spruce' && R() < 0.15 ? 6 : 0);
      trees.push({ x: px + R() * 2, base: mh(px) + (row ? -2.5 : 1.5) + R(), h, kind, row, seed: Math.floor(R() * 1e6) });
    }
  }
  trees.sort((a, b) => (b.row - a.row) || (a.base - b.base));

  const nearTop = new Float32Array(RW), ridgeTop = new Float32Array(RW);
  // trees are painted over the layers behind, so those stop at the hill line, not the treetops
  for (let x = 0; x < RW; x++) { nearTop[x] = Math.round(nh(x)); ridgeTop[x] = Math.round(mh(x)); }
  const stop1 = new Float32Array(RW), stop2 = new Float32Array(RW), stop3 = new Float32Array(RW), stop4 = new Float32Array(RW);
  for (let x = 0; x < RW; x++) {
    stop4[x] = Math.min(nearTop[x], HZ);
    stop3[x] = Math.min(ridgeTop[x], stop4[x]);
    stop2[x] = Math.min(Math.round(foot[x]), stop3[x]);
    stop1[x] = Math.min(Math.round(range.top[x]), stop2[x]);
  }

  // A range: faceted rock from ridged noise (ribs and gullies falling down the faces, lit from the left),
  // warm granite patches, snow above a ragged snowline (mostly in the gullies), tundra and forest below
  // the treeline, and haze toward the base.
  const paintRange = function* (prof, stop, P0, seed, o) {
    const rock = fade(frost(P0.rock, 0.35), o.haze), warm = fade(frost(P0.warm, 0.35), o.haze), snw = fade(P0.snow, o.haze * 0.5);
    const forest = fade(frost(P0.forest, 0.45), o.haze), tundra = P0.tundra && fade(frost(P0.tundra, 0.6), o.haze);
    const base = hexToRgb(mixHex(P0.base, HAZE, o.haze)), line = hexToRgb(P0.line), rim = hexToRgb('#f2f6ff');
    let minTop = HZ;
    for (let x = 0; x < RW; x++) minTop = Math.min(minTop, Math.round(prof.top[x]));
    for (let y = minTop; y < HZ; y++) {
      if ((y - minTop) % 20 === 19) yield; // a few rows at a time
      let prevF = null;
      for (let x = 0; x < RW; x++) {
        const F = ridged(x * 0.045 + fbm(x * 0.015, y * 0.025, seed) * 2.2, y * 0.022 + x * 0.004, seed + 5);
        const gF = prevF === null ? 0 : F - prevF;
        prevF = F;
        if (y < Math.round(prof.top[x]) || y >= stop[x]) continue;
        const pk = prof.peaks[prof.owner[x]], depth = y - prof.top[x], flat = pk.flat || 0;
        const broad = fbm(x * 0.012, y * 0.02, seed + 2);
        // the arête between the lit west face and the shaded east face wanders and leans as it descends
        const ry = y - pk.y, arete = pk.x + (fbm(ry * 0.06, pk.x * 0.1, seed + 8) - 0.5) * 16 + ry * 0.18;
        const dx = x - arete;
        let light = Math.abs(x - pk.x) <= flat && ry < flat * 0.8 ? 0.66 : dx < 0 ? 0.6 : 0.36;
        const cliff = pk.r > 1.2 && x > pk.x + flat - ry * 0.25; // the sheer east face, narrowing downward
        if (cliff) light -= 0.14;
        light += -gF * 6 + (F - 0.5) * 0.3 + (broad - 0.5) * 0.2;
        const gully = F < 0.5, sl = o.snowY + (fbm(x * 0.03, 2, seed + 9) - 0.5) * 16 + (fbm(x * 0.13, y * 0.06, seed + 10) - 0.5) * 9;
        // snow only where it's high enough: the snowline is an altitude, ragged, reaching a little lower in the gullies
        const isSnow = !cliff && (gully ? y < sl + (0.5 - F) * 44 : y < sl - 3 && (light > 0.4 || depth < 4));
        const tl = o.treeY ? o.treeY + (fbm(x * 0.03, 4, seed + 11) - 0.5) * 16 + (fbm(x * 0.12, 5, seed + 12) - 0.5) * 6 : 1e9;
        let col;
        const ft = o.treeY ? forestTex(x, y, Math.round(tl), seed + 3) : -1;
        if (ft >= 0) col = forest[ft];
        else if (tundra && y > tl - 4 - Math.round(fbm(x * 0.06, 6, seed + 13) * 4)) col = tundra[y > tl - 2 ? 0 : 1]; // a clean band of tundra above the trees
        else if (isSnow) col = snw[light > 0.5 ? 1 : 0];
        else {
          const pal = fbm(x * 0.04, y * 0.009, seed + 14) > 0.64 ? warm : rock; // mineral streaks down the fall line
          col = pal[light < 0.3 ? 0 : light < 0.47 ? 1 : light < 0.68 ? 2 : 3];
        }
        if (!o.treeY && y > HZ - o.hazeH * 0.5) col = base; // the far range fades into haze at its foot
        // selective outline: a pale rim on the sunlit western flanks, a deeper tone of the rock on the shaded side
        const tN = Math.round(prof.top[x]);
        if (y === tN || (x > 0 && y < Math.round(prof.top[x - 1])) || (x < RW - 1 && y < Math.round(prof.top[x + 1]))) {
          const westFlank = x < RW - 1 && x > 0 && prof.top[x + 1] < prof.top[x - 1];
          const c = col.map((v) => v); // tint the actual fill so the edge belongs to the rock or snow under it
          col = westFlank ? c.map((v, i) => Math.round(v + (rim[i] - v) * 0.5)) : c.map((v, i) => Math.round(v + (line[i] - v) * 0.45));
        }
        set(x, y, col);
      }
    }
  };

  yield* paintRange(divide, stop1, {
    rock: ['#444c76', '#5a648a', '#7a88aa', '#98a4c2'], warm: ['#545068', '#6c6680', '#88809c', '#a49cb6'],
    snow: ['#c2cee8', '#f4f8ff'], forest: ['#4a6276', '#56707e', '#62808a'], base: '#7e92b6', line: '#2e3458',
  }, 71, { haze: 0.1, snowY: 74 + snowAmt * 24, hazeH: 16 });
  yield;
  yield* paintRange(range, stop2, {
    rock: ['#3e4664', '#545c7a', '#747a96', '#9498ae'], warm: ['#54485a', '#6e5e6c', '#8e7a84', '#aa96a0'],
    snow: ['#c0cce4', '#eaf0fa'], forest: ['#203a3a', '#2a4a44', '#365a4c'], tundra: ['#6e6a50', '#867c58', '#7a5e48'], base: '#6c84a0', line: '#1c2034',
  }, 72, { haze: 0.1, snowY: 94 + snowAmt * 12, treeY: HZ - 56, hazeH: 0 });
  yield;

  // foothills: dense forest, lit western flanks, meadow clearings, sandstone slabs
  const fForest = fade(frost(['#1c3632', '#24443a', '#305442', '#3e664c'], 0.5), 0.07);
  const meadowPal = { spring: ['#5e8a44', '#76a050'], summer: ['#5a7e44', '#6e9450'], fall: ['#8a8a48', '#a8a058'], winter: ['#7e7658', '#958a66'] }[season] || ['#5a7e44', '#6e9450'];
  const fMeadow = fade(frost(meadowPal, 0.8), 0.07), slab = C2(frost(['#6e3c30', '#9a5644', '#bc7254', '#d89068'], 0.45));
  for (let x = 0; x < RW; x++) {
    const slope = (hill[Math.min(RW - 1, x + 3)] - hill[Math.max(0, x - 3)]) / 6;
    for (let y = Math.round(foot[x]); y < stop3[x]; y++) {
      const depth = y - hill[x];
      let col;
      const si = SLABS.findIndex((sl, i) => { const e = slabEdge(i, x); return e && y >= e.top && y < e.bot; });
      if (si >= 0) {
        // a tilted sandstone slab: lit face with bedding lines, shadowed east edge, crumbling foot
        const [ax, , hw] = SLABS[si], u = (x - ax) / hw, e = slabEdge(si, x);
        col = slab[u > 1.1 ? 0 : (y + Math.floor(x * 0.6)) % 4 === 0 ? 1 : u < -0.5 || y - e.top < 1 ? 3 : 2];
        if (e.bot - y < 4 && hash2(x, y, 72) < 0.5) col = fForest[1];
      } else if (fbm(x * 0.03, y * 0.09, 66) > 0.64 && depth < 12) col = fMeadow[hash2(x, y, 67) < 0.3 ? 1 : 0];
      else {
        const ft = forestTex(x, y + 3, Math.round(hill[x]), 68);
        col = fForest[ft < 0 ? 1 : ft === 2 ? (slope > 0 ? 3 : 2) : ft === 1 ? 1 : 0];
      }
      if (snow && si < 0) { const ft = forestTex(x, y + 3, Math.round(hill[x]), 68); if (ft === 2) col = hexToRgb('#f4f8ff'); else if (ft < 0 || ft === 1) col = hexToRgb('#c8d4e2'); } // snow on each tree's sunny side
      set(x, y, col);
    }
  }
  yield;

  // the forest edge: hill body, then the back row and the front row of trees
  const hillPal = fade(frost({ fall: ['#3e5e36', '#4e7040'], winter: ['#4e5a40', '#606c4c'] }[season] || ['#2c5a40', '#3c6c4a'], 0.8), 0.04);
  for (let x = 0; x < RW; x++) {
    for (let y = Math.round(mh(x)); y < stop4[x]; y++) set(x, y, hillPal[y - mh(x) < 2 || hash2(x, y, 17) < 0.07 ? 1 : 0]);
  }
  const aspenPal = season === 'winter' ? ['#6a6458', '#8a8274', '#a69e90'] : FOLIAGE.aspen[season === 'fall' ? 'fall' : season === 'spring' ? 'spring' : 'summer'].slice(1, 4);
  const pals = {
    spruce: [fade(frost(FOLIAGE.spruce.slice(0, 3), 0.4), 0.2), fade(frost(FOLIAGE.spruce.slice(0, 3), 0.4), 0.05)],
    pine: [fade(frost(FOLIAGE.pine.slice(1, 4), 0.4), 0.2), fade(frost(FOLIAGE.pine.slice(1, 4), 0.4), 0.05)],
    aspen: [fade(frost(aspenPal, 0.5), 0.2), fade(frost(aspenPal, 0.5), 0.05)],
  };
  const bark = { pine: hexToRgb('#7a4a2e'), aspen: hexToRgb('#e4e0d4') };
  for (const tr of trees) {
    const pal = pals[tr.kind][tr.row ? 0 : 1], h = tr.h, top = tr.base - h;
    for (let y = Math.max(0, Math.floor(top)); y < Math.round(tr.base) && y < HZ; y++) {
      const t = (y - top) / h; // 0 at the tip, 1 at the base
      let hw, cx = tr.x;
      if (tr.kind === 'spruce') hw = t * h * 0.24 * (0.7 + 0.3 * ((t * h / 3) % 1)) + (t < 0.08 ? 0.3 : 0); // narrow tiered spire
      else if (tr.kind === 'pine') { // ponderosa: flat-topped, clumpy crown high on a bare orange trunk
        const k = t / 0.62;
        hw = t < 0.62 ? Math.pow(Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.5), 0.7) * (k < 0.85 ? 1 : (1 - k) * 6.7) * h * 0.26 * (0.7 + 0.6 * hash2(tr.seed, y >> 1, 70)) : 0;
        cx += (hash2(tr.seed, y >> 2, 71) - 0.5) * 1.6;
      } else { // aspen: slim oval crowns crowding together
        const k = t / 0.78;
        hw = t < 0.78 ? Math.sqrt(Math.max(0, 1 - (k * 2 - 1) ** 2)) * h * 0.2 : 0;
      }
      if (hw < 0.5) {
        if (tr.kind !== 'spruce' && t >= 0.5) { const xx = Math.round(tr.x); if (xx >= 0 && xx < RW) set(xx, y, bark[tr.kind]); }
        continue;
      }
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        if (x < 0 || x >= RW) continue;
        if (tr.kind !== 'spruce' && hash2(x, y, tr.seed) < 0.16 && Math.abs(x - cx) > hw - 1.5) continue; // ragged edge
        const u = (x - cx) / hw;
        let col = pal[u < -0.25 ? 2 : u > 0.3 ? 0 : 1];
        if (tr.kind === 'spruce' && (y - Math.floor(top)) % 3 === 2 && u > -0.6) col = pal[0]; // shadow under each tier
        if (snow && hash2(x, y, tr.seed + 1) < 0.35) col = hexToRgb('#f0f6ff');
        set(x, y, col);
      }
    }
  }
  yield;

  // the meadow before the village: patchy grass, the odd shrub
  const mPal = fade(frost({ spring: ['#4e8c42', '#66a650', '#3e7636', '#82bc60'], fall: ['#748a3e', '#90a04a', '#5e7234', '#aab45a'], winter: ['#7a7450', '#948a5e', '#665e44', '#ae9e6c'] }[season] || ['#4c8c46', '#62a24e', '#3c7638', '#7cb85c'], 0.85), 0.02);
  for (let x = 0; x < RW; x++) {
    const ht = nearTop[x];
    for (let y = ht; y < HZ; y++) {
      const pt = fbm(x * 0.04, y * 0.12, 74);
      let col = y - ht < 2 ? mPal[1] : (y - ht) / (HZ - ht) > 0.6 + bayer(x, y) * 0.4 ? mPal[2] : pt > 0.6 ? mPal[3] : mPal[0];
      if (y - ht < 4 && hash2(x >> 1, 3, 75) < 0.05) col = mPal[2];
      set(x, y, col);
    }
  }
}

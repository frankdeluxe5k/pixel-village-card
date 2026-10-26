// Trees and shrubs, by season.
import { hexToRgb, ramp } from '../core/color.js';
import { S } from '../core/constants.js';
import { mulberry32 } from '../core/math.js';
import { bayer, hash2 } from '../core/noise.js';
import { P, line, mk, outline } from '../core/pixels.js';

export const FOLIAGE = {
  spruce: ['#1c3436', '#2a4c52', '#3c6668', '#57847f', '#88b0a8'],
  pine: ['#18301c', '#264826', '#386430', '#50803c', '#72a04e'],
  aspen: {
    spring: ['#2e5a24', '#44802e', '#62a23c', '#88c450', '#bce47c'],
    summer: ['#24502a', '#346e32', '#4e8e3c', '#70ae4c', '#9ccc66'],
    fall: ['#6a3c0c', '#a86a14', '#d8a020', '#f4c838', '#fff08a'],
  },
  gambel: {
    spring: ['#26461e', '#386628', '#548a34', '#76aa46', '#a0cc66'],
    summer: ['#22401e', '#325c28', '#4a7a34', '#66984a', '#8cb866'],
    fall: ['#4a1e10', '#7a3016', '#a8481c', '#d0702a', '#eca450'],
  },
  juniper: ['#1a3430', '#28463e', '#3a5e52', '#527a6a', '#7c9c8c'],
  sage: ['#566052', '#727c6a', '#909a86', '#b0b8a6', '#ced4c4'],
  rabbit: ['#46523e', '#5e6c52', '#7a886a', '#98a684', '#b8c4a0'],
  rose: ['#244a22', '#346a2e', '#4a8a3a', '#68a84c', '#90c868'],
};

// Shade overlapping leaf clusters lit from the upper left, in clean bands with a little dither.
export function paintClusters(w, h, clusters, pal, { seed = 1, noise = 0.3, spiky = 0, snow = false, gx = w / 2, gy = h / 2, gr = w / 2 } = {}) {
  const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, cols = pal.map(hexToRgb);
  const white = hexToRgb('#f4f8ff'), blue = hexToRgb('#cad8ea');
  for (const k of [...clusters].sort((a, b) => a.y - b.y)) {
    const ry = k.ry || k.r;
    for (let y = Math.floor(k.y - ry); y <= Math.ceil(k.y + ry); y++) {
      for (let x = Math.floor(k.x - k.r); x <= Math.ceil(k.x + k.r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const nx = (x - k.x) / k.r, ny = (y - k.y) / ry, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        if (spiky && d2 > 0.55 && hash2(x, y, seed) < spiky) continue;
        let v = 0.5 - 0.42 * (nx * 0.6 + ny * 0.8) - 0.3 * (((x - gx) / gr) * 0.6 + ((y - gy) / gr) * 0.8) + (hash2(x, y, seed + 1) - 0.5) * noise;
        if (d2 > 0.7 && ny > -0.1) v -= 0.3;
        const lvl = Math.max(0, Math.min(4, Math.floor(v * 5 + bayer(x, y) - 0.5)));
        let col = cols[lvl];
        if (snow && ny < -0.2 && v > 0.42) col = v > 0.62 ? white : blue;
        const i = (y * w + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Blue spruce: tiers of drooping, silvery blue-green boughs.
export function drawSpruce(size, seed, snow) {
  const H = Math.round(size * S * 3.3), W = Math.round(size * S * 1.7), w = W + 8, h = H + 10;
  const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  const cols = FOLIAGE.spruce.map(hexToRgb), white = hexToRgb('#f4f8ff'), blue = hexToRgb('#c4d4e8');
  const cx = w >> 1, top = 2, tiers = 6 + Math.round(size / 2), th = H / tiers;
  for (let y = top; y < top + H; y++) {
    const ti = Math.floor((y - top) / th), loc = (y - top - ti * th) / th;
    const half = (W / 2) * (0.1 + 0.9 * ((ti + loc) / tiers)) * (0.72 + 0.28 * loc);
    for (let x = 0; x < w; x++) {
      const dx = x - cx, u = dx / Math.max(1, half);
      const jag = (hash2(y, ti, seed) - 0.5) * 2.2;
      if (Math.abs(dx) > half + jag) continue;
      if (Math.abs(u) > 0.8 && loc < 0.35) continue; // bough tips droop below the tier above
      let v = 0.58 - 0.42 * u + (hash2(x, y, seed) - 0.5) * 0.45;
      if (loc > 0.78) v -= 0.38;
      else if (loc < 0.2) v += 0.12;
      const lvl = Math.max(0, Math.min(4, Math.floor(v * 5 + bayer(x, y) - 0.5)));
      let col = cols[lvl];
      if (snow && loc < 0.4 && u < 0.6 && v > 0.35) col = v > 0.6 ? white : blue;
      const i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const bark = ramp('#5a3a24');
  P(g, cx - 1, top + H - 1, 3, 6, bark.m); P(g, cx - 1, top + H - 1, 1, 6, bark.l);
  outline(c, '#0e2022');
  return { cv: c, ax: cx, ay: top + H + 4, r: W / 2 };
}

// Ponderosa pine: a tall cinnamon-plated trunk with tufted clumps of needles up top.
export function drawPonderosa(size, seed, snow) {
  const R = size * S, rnd = mulberry32(seed);
  const w = Math.round(R * 2.4) + 8, h = Math.round(R * 3.4) + 8, cx = w >> 1, by = h - 2, trunkTop = Math.round(R * 0.6);
  const c = mk(w, h), g = c.getContext('2d');
  const bark = ['#6a3418', '#9a5428', '#c07838', '#dc9a58'];
  for (let y = trunkTop; y <= by; y++) {
    const tw = y > by - 4 ? 6 : 4;
    for (let x = -Math.floor(tw / 2); x < Math.ceil(tw / 2); x++) {
      const plate = hash2(cx + x, Math.floor(y / 3), seed) < 0.3;
      P(g, cx + x, y, 1, 1, x === -Math.floor(tw / 2) ? bark[3] : x === Math.ceil(tw / 2) - 1 ? bark[0] : plate ? bark[1] : bark[2]);
    }
  }
  const clusters = [], tips = [];
  const tuft = (x, y, r) => {
    for (let k = 0; k < 3; k++) clusters.push({ x: x + (k - 1) * r * 0.55, y: y + (k === 1 ? -r * 0.15 : 0), r: r * 0.55, ry: r * 0.36 });
    tips.push([x, y, r]);
  };
  tuft(cx, trunkTop + R * 0.05, R * 0.6);
  tuft(cx + R * 0.15, trunkTop - R * 0.25, R * 0.42);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, yy = trunkTop + R * (0.4 + i * 0.3);
    const xx = cx + side * R * (0.5 + rnd() * 0.3);
    line(g, cx, Math.round(yy + 3), Math.round(xx), Math.round(yy + 1), bark[0], 1);
    tuft(xx, yy, R * (0.42 + rnd() * 0.12));
  }
  g.drawImage(paintClusters(w, h, clusters, FOLIAGE.pine, { seed, noise: 0.6, spiky: 0.5, snow, gx: cx, gy: trunkTop + R * 0.4, gr: R }), 0, 0);
  // needle sprays poking out of each tuft
  for (const [x, y, r] of tips) {
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI, len = r * (0.55 + rnd() * 0.25);
      const ex = Math.round(x + Math.cos(a) * len * 1.25), ey = Math.round(y + Math.sin(a) * len * 0.7);
      P(g, ex, ey, 1, 1, k % 2 ? FOLIAGE.pine[3] : FOLIAGE.pine[1]);
    }
  }
  outline(c, '#10261a');
  return { cv: c, ax: cx, ay: by, r: R };
}

// A small grove of quaking aspens: white trunks with dark eyes, round fluttery leaves.
export function drawAspens(size, seed, snow, season) {
  const R = size * S, rnd = mulberry32(seed), n = size >= 5 ? 3 : 2;
  const w = Math.round(R * 2.6) + 10, h = Math.round(R * 3.4) + 8, by = h - 2, base = w >> 1;
  const c = mk(w, h), g = c.getContext('2d'), pal = FOLIAGE.aspen[season === 'winter' ? 'summer' : season];
  const trunks = Array.from({ length: n }, (_, i) => ({
    x: Math.round(base + (i - (n - 1) / 2) * R * 0.7 + (rnd() - 0.5) * 3),
    top: Math.round(R * (0.55 + rnd() * 0.5)), lean: (rnd() - 0.5) * 0.08,
  }));
  const clusters = [];
  for (const t of trunks) {
    for (let y = t.top; y <= by; y++) {
      const x = Math.round(t.x + (by - y) * t.lean);
      P(g, x - 1, y, 3, 1, '#e8e6dc'); P(g, x + 1, y, 1, 1, '#b8b4a8');
      if (hash2(x, y, seed) < 0.1) P(g, x - 1 + Math.floor(hash2(y, x, seed) * 2), y, 2, 1, '#2a2a28');
    }
    for (let y = t.top + 6; y < by - 4; y += 7) {
      const x = Math.round(t.x + (by - y) * t.lean);
      if (hash2(x, y, seed + 3) < 0.6) { P(g, x - 1, y, 2, 1, '#2a2a28'); P(g, x, y + 1, 1, 1, '#4a4a46'); }
    }
    if (season === 'winter') {
      for (let k = 0; k < 6; k++) {
        const y0 = t.top + 2 + k * 3, side = k % 2 ? 1 : -1;
        line(g, t.x, y0 + 4, t.x + side * (4 + (k % 3) * 2), y0, '#9a948a', 1);
      }
      continue;
    }
    const cy = t.top + R * 0.7;
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2, dd = Math.sqrt(rnd());
      clusters.push({ x: t.x + Math.cos(a) * dd * R * 0.5, y: cy + Math.sin(a) * dd * R * 1.05, r: 2 + rnd() * 2.5 });
    }
  }
  if (clusters.length) g.drawImage(paintClusters(w, h, clusters, pal, { seed, noise: 0.6, spiky: 0.22, snow, gx: base, gy: R, gr: R }), 0, 0);
  if (season === 'fall' && !snow) for (let k = 0; k < 6; k++) P(g, Math.round(base + (rnd() - 0.5) * R * 2), by - Math.round(rnd() * 3), 1, 1, '#f4c838');
  outline(c, season === 'fall' ? '#3a2008' : '#10261a');
  return { cv: c, ax: base, ay: by, r: R };
}

export function makeTree(kind, size, seed, snow, season) {
  if (kind === 'spruce') return drawSpruce(size, seed, snow);
  if (kind === 'pine') return drawPonderosa(size, seed, snow);
  return drawAspens(size, seed, snow, season);
}

// Shrubs, drawn straight into a prop sprite.
// Shrubs around the village (render px): kind, x, ground y, size.
export const SHRUBS = [
  ['gambel', 156, 334, 6], ['rabbit', 376, 340, 6], ['juniper', 424, 376, 7], ['rose', 508, 376, 6], ['sage', 250, 288, 5],
  ['gambel', 470, 250, 6], ['juniper', 660, 300, 6], ['rabbit', 92, 248, 5], ['gambel', 4, 374, 6], ['sage', 128, 322, 4],
  ['juniper', 12, 362, 8], ['gambel', -3, 349, 6],
];
export function shrubProp([kind, bx, by, br], snow, season, trimmed) {
  const w = br * 5 + 6, h = br * 3 + 6, x = bx - (w >> 1) - 2, y = by - h - 1;
  const cv = mk(w + 4, h + 4), g = cv.getContext('2d');
  g.translate(-x, -y); drawShrub(g, kind, bx, by, br, snow, season, trimmed); outline(cv);
  return { cv, x, y, sortY: by / S - 0.2 };
}

export function drawShrub(g, kind, cx, by, r, snow, season, trimmed = false) {
  const rnd = mulberry32(Math.round(cx * 7 + by)), w = r * 5 + 6, h = r * 3 + 6, ox = cx - (w >> 1), oy = by - h + 1;
  const cl = [];
  // leaf clusters fill a dome: a full row along the ground, then random clumps under the dome's curve
  const low = kind === 'sage', tall = kind === 'gambel' || kind === 'juniper';
  const half = r * (low ? 1.75 : 1.3), dome = r * (low ? 0.75 : tall ? 2.0 : 1.55) * (trimmed ? 0.85 : 1), base = h - 2 - r * 0.45, mid = w >> 1;
  for (let u = -0.8; u <= 0.81; u += 0.4) cl.push({ x: mid + u * half, y: base - rnd() * 1.5, r: r * 0.55, ry: r * (low ? 0.42 : 0.5) });
  if (trimmed) {
    // freshly clipped: an even, rounded dome of same-sized clumps
    for (let i = 0; i < (low ? 5 : 8); i++) {
      const u = -0.85 + (1.7 * i) / ((low ? 5 : 8) - 1), lift = Math.sqrt(1 - u * u) * dome * 0.8;
      cl.push({ x: mid + u * half * 0.8, y: base - lift, r: r * 0.5, ry: r * (low ? 0.38 : 0.46) });
    }
    cl.push({ x: mid, y: base - dome * 0.55, r: r * 0.62, ry: r * 0.5 });
  } else {
    for (let i = 0; i < (low ? 5 : 9); i++) {
      const u = rnd() * 2 - 1, lift = Math.sqrt(1 - u * u) * dome * (0.35 + rnd() * 0.65);
      cl.push({ x: mid + u * half * 0.85, y: base - lift, r: r * (0.42 + rnd() * 0.2), ry: r * (low ? 0.38 : 0.48) });
    }
  }
  if (kind === 'gambel' && season === 'winter') {
    for (let i = 0; i < 9; i++) line(g, cx + Math.round((rnd() - 0.5) * r * 2.5), by, cx + Math.round((rnd() - 0.5) * r * 3.5), by - Math.round(r * (1 + rnd())), '#6a5040', 1);
    return;
  }
  let pal = FOLIAGE[kind];
  if (kind === 'gambel') pal = FOLIAGE.gambel[season];
  if (kind === 'rose' && season === 'winter') pal = ['#3a2a22', '#5a3a2a', '#6a4a32', '#7a5a3a', '#8a6a4a'];
  const cv = paintClusters(w, h, cl, pal, { seed: Math.round(cx), noise: trimmed ? 0.25 : 0.5, spiky: trimmed ? 0 : kind === 'juniper' ? 0.45 : kind === 'sage' ? 0.3 : 0.15, snow });
  g.drawImage(cv, ox, oy);
  if (snow) return;
  const dots = (cols, k, yMax) => {
    for (let i = 0; i < k; i++) {
      const c0 = cl[Math.floor(rnd() * cl.length)], a = rnd() * Math.PI * 2;
      const x = Math.round(ox + c0.x + Math.cos(a) * c0.r * 0.7), y = Math.round(oy + c0.y + Math.sin(a) * c0.ry * 0.7 * yMax);
      P(g, x, y, 1, 1, cols[i % cols.length]);
    }
  };
  if (kind === 'rabbit' && (season === 'fall' || season === 'summer')) {
    // golden flower heads across the top
    for (const c0 of cl) for (let k = 0; k < (trimmed ? 1 : 4); k++) P(g, Math.round(ox + c0.x + (rnd() - 0.5) * c0.r * 1.6), Math.round(oy + c0.y - c0.ry * (0.6 + rnd() * 0.4)), 2, 1, k % 2 ? '#f8e060' : '#e8c030');
  }
  if (kind === 'juniper') dots(['#8ab0d8', '#6a90c0'], 6, 1);
  if (kind === 'rose') dots(season === 'summer' || season === 'spring' ? ['#f080a0', '#ffffff', '#f0a0b8'] : ['#c83a2a', '#e05a3a'], 7, 1);
}

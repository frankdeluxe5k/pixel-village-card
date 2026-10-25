/*
 * Pixel Village Card for Home Assistant
 * A tiny living pixel-art village that follows the time of day, the weather
 * and whatever is happening in your home (scenes, media players, alarm...).
 *
 * Everything is drawn procedurally: no image files, no dependencies.
 * The simulation runs on a 192x108 grid; art is drawn at 3x (576x324) in a
 * 16-bit arcade style. Sprites and scenery are rendered once and cached, and
 * the card only animates while it is actually on screen.
 */
const PV_VERSION = '2.0.0';

const W = 224, H = 126, HORIZON = 60; // simulation units
const S = 3, RW = W * S, RH = H * S, HZ = HORIZON * S; // render pixels
const OUT = '#1c1220';

const MODES = {
  sleep:   { icon: '🌙', label: 'Night',     text: 'The village is fast asleep' },
  morning: { icon: '🌅', label: 'Morning',   text: 'Rise and shine, breakfast is on' },
  work:    { icon: '☀️', label: 'Daytime',   text: 'Everyone is hard at work' },
  meal:    { icon: '🍲', label: 'Mealtime',  text: 'Gathering round for a meal' },
  evening: { icon: '🔥', label: 'Evening',   text: 'Stories around the campfire' },
  party:   { icon: '🎉', label: 'Party!',    text: 'A festival in the village square' },
  movie:   { icon: '🎬', label: 'Movie night', text: 'Popcorn and a picture show under the stars' },
  gaming:  { icon: '🎮', label: 'Game night', text: 'Controllers out and handhelds at the café' },
  cozy:    { icon: '🕯️', label: 'Cozy',      text: 'Everyone is snug indoors' },
  away:    { icon: '🎒', label: 'Adventure', text: 'Off on an adventure, back soon' },
};

const DEFAULT_SCHEDULE = {
  wake: 6.5, work: 8.5, lunch: 12, work_after_lunch: 13, dinner: 18, evening: 19.5, sleep: 22.5,
};

const JOBS = ['farmer', 'cook', 'woodcutter', 'carrier', 'bard', 'child', 'farmer', 'woodcutter', 'carrier', 'child'];

const LOOKS = {
  skin: ['#f8d0a8', '#eab48a', '#c88a60', '#9a623e', '#6e442a'],
  hair: ['#3a2418', '#6a3a1c', '#c89038', '#26222e', '#a8381c', '#d8d0c8', '#e8c060'],
  // per-job outfit colours: [shirt, pants]
  outfit: {
    farmer: [['#ece2c8', '#4a72b8'], ['#e8d0b0', '#3a8a6a']],
    cook: [['#5a86c8', '#4a3a30'], ['#c86a4a', '#3a3a48']],
    woodcutter: [['#c43a2a', '#4a4036'], ['#3a7ac4', '#4a4036']],
    carrier: [['#e8a838', '#8a3a6a'], ['#58b0a0', '#6a3a8a']],
    bard: [['#3a9a5a', '#5a3a6a'], ['#9a4ac0', '#3a4a6a']],
    child: [['#e86a3a', '#3a5a9a'], ['#30a8a8', '#8a5a3a']],
  },
};

// Houses sit at different depths: `base` is the ground line of each one.
const HOUSES = [
  { x: 8,   w: 24, h: 14, base: 82, roof: '#b04a34', logs: '#a8703c' },
  { x: 36,  w: 22, h: 13, base: 96, roof: '#4a6aa8', logs: '#9a6a40' },
  { x: 96,  w: 32, h: 16, base: 78, roof: '#8a5a34', logs: '#8a5634', tavern: true },
  { x: 170, w: 24, h: 14, base: 82, roof: '#4f8f4a', logs: '#b07a44' },
  { x: 142, w: 22, h: 13, base: 99, roof: '#6a5a8a', logs: '#a07448' },
  { x: 200, w: 22, h: 13, base: 76, roof: '#3a7a7a', logs: '#9a6a40' },
];
for (const h of HOUSES) {
  const X = h.x * S, Wd = h.w * S, top = (h.base - h.h) * S, bot = h.base * S;
  h.g = { X, Wd, top, bot, ridge: top - 27 };
  h.door = { x: h.x + (h.w >> 1), y: h.base + 2 };
  const cx0 = X + Math.round(Wd * 0.7);
  h.chimHi = { x: cx0, top: top - 36, bot: top - 12 };
  h.chim = { x: (cx0 + 4) / S, y: (top - 40) / S };
  const wy = (h.base - h.h + 4) * S;
  const wxs = h.tavern ? [h.x + 3, h.x + 9, h.x + h.w - 12, h.x + h.w - 6] : [h.x + 3, h.x + h.w - 6];
  h.glass = wxs.map((wx) => [wx * S, wy]);
  const dw = h.tavern ? 18 : 12, dh = h.tavern ? 18 : 22;
  h.doorHi = { x: h.door.x * S - dw / 2, y: bot - dh, w: dw, h: dh };
  h.posts = h.tavern ? [0, 21, 72, Wd - 3] : [0, Math.round(Wd * 0.33) - 1, Math.round(Wd * 0.64), Wd - 3];
  h.lantern = { x: X + h.posts[2] + 1, y: bot - 30 };
}

// Paths through the village (simulation units). A cobbled main road comes in from the east
// and ends at the square, a cobbled lane climbs to the tavern, dirt paths lead to the houses.
const PATHS = [
  { kind: 'main', pts: [[236, 92], [222, 89], [208, 89], [196, 91], [185, 96], [172, 103], [160, 106.5], [148, 107], [134, 106], [120, 104.5], [108, 104], [100, 105]] },
  { kind: 'lane', pts: [[101, 104], [102, 97], [106, 89], [110, 84], [112, 80.5]] },
  { kind: 'path', pts: [[206, 89], [196, 87.5], [188, 86], [183, 84.5]] },
  { kind: 'path', pts: [[218, 88.5], [213, 84], [211, 80], [211, 78.5]] },
  { kind: 'path', pts: [[153, 106.5], [153.5, 103.5], [153, 101.5]] },
  { kind: 'path', pts: [[76, 107], [66, 105.5], [57, 103], [48, 101.5], [39, 101], [31, 97.5], [25, 92.5], [21, 88], [20, 84.5]] },
  { kind: 'path', pts: [[47, 101.5], [47, 98.5]] },
  { kind: 'path', pts: [[24, 91.5], [14, 92.5], [4, 92], [-12, 93]] },
  { kind: 'foot', pts: [[103, 94], [95, 91.5], [87, 89], [81, 85.5], [78.5, 82], [79, 78.5]] },
  { kind: 'foot', pts: [[187, 95.5], [192, 100], [196, 105]] },
  { kind: 'foot', pts: [[62, 104.5], [54, 108], [46, 111], [40, 113]] },
];
function smoothPath(c, k = 4) {
  const pts = [];
  for (let i = 0; i < c.length - 1; i++) {
    const p0 = c[Math.max(0, i - 1)], p1 = c[i], p2 = c[i + 1], p3 = c[Math.min(c.length - 1, i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(c[c.length - 1]);
  return pts;
}
PATHS.forEach((p) => { p.line = smoothPath(p.pts); });
const ENTRANCE = PATHS[0].pts[0];

const FIRE = { x: 92, y: 112 };
const WELL = { x: 70, y: 83 };
const STUMP = { x: 60, y: 122 };
// Village square furniture, in render pixels.
const POND = { x: 392, y: 352, rx: 20, ry: 8 };
const LAMPS = [[FIRE.x * S - 58, FIRE.y * S - 34], [FIRE.x * S + 64, FIRE.y * S - 37]];

// Movie night: a pull-up screen right of the fire, a projector behind the audience.
// The amphitheater on the left: stage with a roll-down screen, curved tiers facing it.
const SCREEN = { x0: 2, x1: 16, top: 94, base: 115 };
// The screen is a panel turned toward the seats at the lower right: its near edge is on the left
// (lower on screen), its far edge on the right (higher), like a wall seen at 45° (render px).
const SCREEN_Q = { lx: 4, ltop: 297, lbot: 341, rx: 44 };
// Every slanted edge uses the same clean 2:1 pixel stair (two across, one up).
const stairY = (x, y0, x0 = SCREEN_Q.lx) => y0 - Math.floor((x - x0) / 2);
SCREEN_Q.rtop = stairY(SCREEN_Q.rx, SCREEN_Q.ltop); SCREEN_Q.rbot = stairY(SCREEN_Q.rx, SCREEN_Q.lbot);
const lerp = (a, b, u) => a + (b - a) * u;
const PROJ = { x: 43, y: 120.5 };
// Tiers wrap around a point in front of the screen and open toward it.
const AMPHI = { x: 28, y: 340, tiers: [50, 70, 90], squash: 0.42, a0: -12, a1: 68 };
const AMPHI_SEATS = [[0, 2], [0, 28], [0, 54], [1, -6], [1, 16], [1, 38], [1, 60], [2, 2], [2, 28], [2, 54]].map(([t, a]) => {
  const rx = AMPHI.tiers[t], r = (a * Math.PI) / 180;
  return { x: (AMPHI.x + rx * Math.cos(r)) / S, y: (AMPHI.y + rx * AMPHI.squash * Math.sin(r)) / S, face: -1 };
});
const GUEST_SEATS = [[0, -10], [0, 15], [0, 41], [1, 5], [1, 27], [1, 49], [2, -10], [2, 15], [2, 41]].map(([t, a]) => {
  const rx = AMPHI.tiers[t], r = (a * Math.PI) / 180;
  return { x: (AMPHI.x + rx * Math.cos(r)) / S, y: (AMPHI.y + rx * AMPHI.squash * Math.sin(r)) / S, face: -1 };
});
const STAGE_SPOT = { x: 9.5, y: 114 };
// The farm, set back behind the well (render pixels).
const FARM = { x0: 144, x1: 268, y0: 198, y1: 226 };
const farmSpot = () => ({ x: Math.random() < 0.5 ? rand(50, 62) : rand(78, 87), y: rand(67, 74) });

// The café: brick patio, bistro tables, a coffee cart (render pixels).
const PATIO = { x0: 522, x1: 650, y0: 328 };
const CART = { x: 600, by: 318 };
const TABLES = [[552, 350, '#d84848'], [604, 348, '#3a8a5a'], [568, 374, '#3a6ac8'], [624, 374, '#e0a030']];
const STOOLS = [[584, 330], [606, 330]];
// Seats in simulation units: two per table, then the stools at the cart.
const CAFE_SEATS = [
  ...TABLES.flatMap(([tx, ty]) => [{ x: (tx - 13) / S, y: (ty + 2) / S, face: 1 }, { x: (tx + 13) / S, y: (ty + 2) / S, face: -1 }]),
  ...STOOLS.map(([x, y]) => ({ x: x / S, y: y / S, face: 1 })),
];
const BARISTA = { x: (CART.x + 28) / S, y: CART.by / S };

// Away: the "back soon!" sign.
const SIGN = { x: CART.x / S, base: (CART.by - 2) / S };
// Where the travelling band plays (behind the fire), and extra amphitheater seats for visitors.
const BAND_SPOTS = [[-15, -12.5], [-6, -13.5], [3, -13.5], [12, -12.5]].map(([dx, dy]) => ({ x: FIRE.x + dx, y: FIRE.y + dy }));
const INSTRUMENTS = ['drum', 'fiddle', 'accordion', 'horn'];

// Ground footprints villagers shouldn't walk through, and a path network along the road.
const FOOTPRINTS = [
  ...HOUSES.map((h) => [h.x - 1, h.base - 8, h.x + h.w + 1, h.base + 0.5]),
  [WELL.x - 6, WELL.y - 5, WELL.x + 6, WELL.y + 0.5],
];
const NAV = (() => {
  // every path becomes a chain of nodes; path ends link to the nearest node on another path
  const nodes = [], adj = [], owner = [];
  PATHS.forEach((p, pi) => {
    p.line.forEach((pt, i) => {
      if (i % 2 && i !== p.line.length - 1) return;
      const id = nodes.length;
      nodes.push([pt[0], pt[1]]); adj.push([]); owner.push(pi);
      if (id > 0 && owner[id - 1] === pi) { adj[id].push(id - 1); adj[id - 1].push(id); }
    });
  });
  const link = (i) => {
    let best = -1, bd = 6;
    nodes.forEach((n, j) => {
      const d = Math.hypot(n[0] - nodes[i][0], n[1] - nodes[i][1]);
      if (owner[j] !== owner[i] && d < bd) { bd = d; best = j; }
    });
    if (best >= 0 && !adj[i].includes(best)) { adj[i].push(best); adj[best].push(i); }
  };
  nodes.forEach((_, i) => { if (i === 0 || owner[i - 1] !== owner[i] || i === nodes.length - 1 || owner[i + 1] !== owner[i]) link(i); });
  // the square is a hub: path ends that reach it connect across it
  const onSquare = nodes.map((n, i) => i).filter((i) => ((nodes[i][0] - FIRE.x) / 26) ** 2 + ((nodes[i][1] - FIRE.y) / 12) ** 2 < 1);
  for (const i of onSquare) for (const j of onSquare) if (i < j && owner[i] !== owner[j] && !adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); }
  return { nodes, adj };
})();
const blocked = (x, y) => FOOTPRINTS.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1);
function clearPath(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 1; i < n; i++) if (blocked(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}
function route(x0, y0, x1, y1) {
  if (clearPath(x0, y0, x1, y1)) return [[x1, y1]];
  const { nodes, adj } = NAV;
  const nearest = (x, y) => {
    let best = -1, bd = 1e9;
    nodes.forEach(([nx, ny], i) => {
      const d = Math.hypot(nx - x, ny - y);
      if (d < bd && clearPath(x, y, nx, ny)) { bd = d; best = i; }
    });
    return best;
  };
  const a = nearest(x0, y0), b = nearest(x1, y1);
  if (a < 0 || b < 0) return [[x1, y1]];
  const prev = new Array(nodes.length).fill(-1), seen = new Set([a]), queue = [a];
  while (queue.length) {
    const i = queue.shift();
    if (i === b) break;
    for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); prev[j] = i; queue.push(j); }
  }
  const path = [];
  for (let i = b; i !== -1; i = prev[i]) path.unshift(nodes[i]);
  return [...path.map(([x, y]) => [x, y]), [x1, y1]];
}
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
};

// Final sky colours, and the light tint multiplied over the world for each phase.
const SKY = {
  day:   ['#3f84d8', '#aedcf6'],
  dawn:  ['#4a5aa8', '#ffc08a'],
  dusk:  ['#3a3278', '#ff8a5c'],
  night: ['#0a1030', '#26326c'],
};
const TINT = { day: null, dawn: '#f4d4c8', dusk: '#dca8b4', night: '#5262a8' };
const OVERCAST_TINT = '#bcc2cc';

const GLYPHS = {
  z:     ['#####', '...#.', '..#..', '.#...', '#####'],
  note:  ['..#..', '..##.', '..#.#', '..#..', '.##..', '###..', '.#...'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  bang:  ['##', '##', '##', '##', '..', '##'],
  dots:  ['##.##.##', '##.##.##'],
  mail:  ['#######', '##...##', '#.#.#.#', '#######'],
  box:   ['######', '#..#.#', '######', '#..#.#', '######'],
};

/* ---------- small helpers ---------- */

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHour(v) {
  if (typeof v === 'number') return v;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
  return m ? +m[1] + +m[2] / 60 : parseFloat(v);
}

function scheduleMode(h, s) {
  if (h < s.wake || h >= s.sleep) return 'sleep';
  if (h < s.work) return 'morning';
  if (h < s.lunch) return 'work';
  if (h < s.work_after_lunch) return 'meal';
  if (h < s.dinner) return 'work';
  if (h < s.evening) return 'meal';
  return 'evening';
}

function readWeather(state) {
  const s = state || '';
  return {
    state: s,
    rain: /rain|pouring/.test(s),
    heavy: /pouring|lightning/.test(s),
    snow: /snow/.test(s),
    fog: s === 'fog',
    storm: /lightning/.test(s),
    overcast: /cloudy|rain|pouring|snow|fog|lightning/.test(s) && s !== 'partlycloudy',
    clouds: s === 'partlycloudy' ? 4 : /cloudy|rain|pouring|snow|lightning/.test(s) ? 7 : 3,
  };
}

/* ---------- colour ---------- */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function toward(h, target, amt) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amt);
}

function shiftColor(hex, dl, hueTarget, hueAmt, ds = 0) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return hslToHex(toward(h, hueTarget, hueAmt), s + ds, l + dl);
}

// 16-bit style colour ramp: shadows drift toward blue/purple, highlights toward yellow.
const rampCache = new Map();
function ramp(hex) {
  let r = rampCache.get(hex);
  if (!r) {
    r = {
      o: shiftColor(hex, -0.36, 260, 30, 0.04),
      d: shiftColor(hex, -0.15, 250, 14, 0.05),
      m: hex,
      l: shiftColor(hex, 0.1, 55, 8, 0.02),
      h: shiftColor(hex, 0.2, 55, 14, -0.04),
    };
    rampCache.set(hex, r);
  }
  return r;
}

function mixHex(a, b, u) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(...A.map((v, i) => v + (B[i] - v) * u));
}
const mulHex = (a, b) => { const B = hexToRgb(b); return rgbToHex(...hexToRgb(a).map((v, i) => (v * B[i]) / 255)); };
const divHex = (a, b) => { const B = hexToRgb(b); return rgbToHex(...hexToRgb(a).map((v, i) => (v * 255) / Math.max(B[i], 1))); };

/* ---------- pixel helpers ---------- */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function P(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function line(g, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  g.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    g.fillRect(x - (t >> 1), y - (t >> 1), t, t);
  }
}

function ellipse(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

function fillPoly(g, pts, c) {
  g.fillStyle = c;
  const ys = pts.map((p) => p[1]), y0 = Math.ceil(Math.min(...ys)), y1 = Math.floor(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) g.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
  }
}

function tpl(g, rows, x, y, map) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = map[row[c]];
      if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
    }
  }
}

// Selective outline: every empty pixel touching the sprite becomes the outline colour.
function outline(cv, color = OUT) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  const im = g.getImageData(0, 0, w, h), d = im.data, src = new Uint8ClampedArray(d);
  const [r, gg, b] = hexToRgb(color);
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) continue;
      if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) {
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(im, 0, 0);
  return cv;
}

function flipH(cv) {
  const c = mk(cv.width, cv.height), g = c.getContext('2d');
  g.translate(cv.width, 0);
  g.scale(-1, 1);
  g.drawImage(cv, 0, 0);
  return c;
}

/* ---------- villager sprites ---------- */

const SW = 37, SH = 46, AX = 18, FY = 42; // sprite canvas, anchor x, feet row

const HEAD = [
  '...HHHHHH...',
  '..HSSSSSSSS.',
  '.HSSSSSSSSSS',
  '.SSSSSSSSSSS',
  'SSSSSSSkkkSS',
  'SSSSSSSSweSS',
  'SsESSSSSeeSS',
  'SssSHSSSSSSn',
  '.sSSSSSbbSSs',
  '.ssSSSSSmmS.',
  '..ssSSSSSS..',
  '....ssss....',
];

const HAIR = {
  short: [
    '....jjjjj.....',
    '..jjjhhhhhh...',
    '.jjhhhhhhhhhh.',
    '.jhhjjhhhhhhhh',
    'jhhhhhhhhhhkhk',
    'hhhhhkkh..k...',
    'hhhhk.........',
    'khhk..........',
    '.kk...........',
  ],
  long: [
    '....jjjjj.....',
    '..jjjhhhhhh...',
    '.jjhhhhhhhhhh.',
    '.jhhhhhhhhhhhh',
    'jhhhhhhhhhhhhk',
    'hhhhhhkhhkhk..',
    'hhhhhk........',
    'hhhhk.........',
    'jhhhk.........',
    'hhhhk.........',
    'hhhk..........',
    'hhhk..........',
    'hhk...........',
    'kk............',
  ],
  messy: [
    '...j..j.j.....',
    '..jjhjjhjh....',
    '.jjhhhhhhhhhh.',
    '.jhhhhhhhhhhhh',
    'jhhhhhhhhhkhhk',
    'hhhhhhk.hk.k..',
    'hhhhk.........',
    'khk...........',
  ],
};

const BEARD = [
  '..h.........',
  '..hh.....hh.',
  '..hhhhhhhhhk',
  '...hhhhhhhk.',
  '....khhhhk..',
  '......kk....',
];

const HATS = {
  farmer: {
    ox: -3, oy: -4,
    map: { Y: '#f4dc8a', y: '#e0bc5c', u: '#a87a34', r: '#c83a2a' },
    rows: [
      '......YYYYY.......',
      '.....YYyyyyyy.....',
      '....Yyyyyyyyyu....',
      '....rrrrrrrrrr....',
      'YYyyyyyyyyyyyyyyuu',
      '.uuuuuuuuuuuuuuuu.',
    ],
  },
  cook: {
    ox: -1, oy: -7,
    map: { W: '#fafaf6', V: '#c8ccd8' },
    rows: [
      '...WWW.WWW....',
      '..WWWWWWWWWV..',
      '.WWWWWWWWWWVV.',
      '.WWWWWWWWWWWV.',
      '..WWWWWWWWWV..',
      '..VVVVVVVVVV..',
      '..WWWWWWWWWW..',
      '..VVVVVVVVVV..',
    ],
  },
  woodcutter: {
    ox: -1, oy: -3,
    map: { R: '#c43a2a', r: '#8a2420', Q: '#e86a50' },
    rows: [
      '.....QQQ......',
      '...QQRRRRR....',
      '..QRRRRRRRRR..',
      '.QRRRRRRRRRRR.',
      '.rrrrrrrrrrrrr',
      '.QRQRQRQRQRQRr',
    ],
  },
  bard: {
    ox: -1, oy: -6,
    map: { f: '#f8f0d0', t: '#c8b890', F: '#6ac87a', G: '#3a9a5a', g: '#246a3e' },
    rows: [
      'f.............',
      '.ft...........',
      '..ftFFFF......',
      '...tFGGGGGG...',
      '..FGGGGGGGGGG.',
      '.FGGGGGGGGGGGg',
      '.gggggggggggg.',
    ],
  },
  carrier: {
    ox: -1, oy: -2,
    map: { K: '#d0508a', k: '#9a3066', X: '#f088b8', z: '#ffffff' },
    rows: [
      '....XXXXX.....',
      '..XXKKzKKK....',
      '.XKKKKKKKzKK..',
      '.KKzKKKKKKKKK.',
      'KKKKKKKKKKKkk.',
      'kKK...........',
      'kKk...........',
      '.kk...........',
    ],
  },
};

// Keyframes: [frontHand, backHand] offsets from the shoulders, plus optional upper-body bob.
const KEYS = {
  idle: [{ f: [1, 6], b: [-1, 6] }, { f: [1, 5], b: [-1, 5], bob: -1 }],
  sit: [{ f: [3, 3], b: [2, 4] }, { f: [3, 2], b: [2, 3], bob: -1 }],
  // hoe / axe / hammer: wind-up, swing, strike, follow-through (dir = tool shaft direction)
  swing: [
    { f: [0, -7], b: [-2, -6], dir: [-0.3, -1] },
    { f: [4, -4], b: [2, -3], dir: [0.75, -0.65] },
    { f: [6, 2], b: [4, 3], dir: [0.8, 0.6] },
    { f: [5, 4], b: [3, 4], dir: [0.45, 0.9], bob: 1 },
  ],
  cook: [{ f: [6, 3] }, { f: [5, 4] }, { f: [4, 3] }, { f: [5, 2] }],
  chat: [{ f: [5, 2] }, { f: [5, -1] }, { f: [6, 0] }, { f: [4, 1] }],
  dance: [
    { f: [5, -6], b: [-5, -6] }, { f: [6, 0], b: [-6, 0] },
    { f: [3, 2], b: [-4, -7] }, { f: [6, -5], b: [-6, 1] },
  ],
  stretch: [{ f: [1, 4], b: [-1, 4] }, { f: [2, -4], b: [-2, -4] }, { f: [2, -8], b: [-2, -8], bob: -1 }],
  eat: [{ f: [3, 4], b: [1, 5] }, { f: [3, 1], b: [1, 5] }, { f: [3, -3], b: [1, 5] }],
  sip: [{ f: [4, 2], b: [2, 4] }, { f: [4, -1], b: [2, 4] }, { f: [3, -3], b: [2, 4] }],
  watch: [{ f: [2, 4], b: [1, 5] }, { f: [3, 1], b: [1, 5] }, { f: [3, -3], b: [1, 5] }],
  laptop: [{ f: [5, 1], b: [4, 2] }, { f: [5, 2], b: [4, 1] }, { f: [5, 1], b: [3, 2] }, { f: [6, 2], b: [4, 1] }],
  lute: [{ f: [2, 4], b: [6, 0] }, { f: [2, 5], b: [6, -1] }, { f: [3, 4], b: [6, 0] }, { f: [2, 6], b: [7, 0] }],
  sweep: [{ f: [3, 4], b: [1, 5] }, { f: [4, 4], b: [2, 5] }, { f: [5, 4], b: [3, 5] }, { f: [4, 4], b: [2, 5] }],
  fetch: [{ f: [4, 5], b: [3, 3] }, { f: [4, 3], b: [3, 2] }, { f: [4, 1], b: [3, 1] }, { f: [4, 3], b: [3, 2] }],
  setup: [{ f: [3, -6], b: [-1, -8] }, { f: [2, -8], b: [0, -7] }, { f: [3, -9], b: [-1, -6] }, { f: [2, -7], b: [0, -8] }],
  serve: [{ f: [6, 1], b: [4, 2] }, { f: [5, -1], b: [4, 2] }, { f: [4, 2], b: [4, 2] }, { f: [6, 1], b: [4, 2] }],
  water: [{ f: [6, 1], b: [4, 2] }, { f: [6, 0], b: [4, 1] }],
  handheld: [{ f: [4, 0], b: [3, 1] }, { f: [4, 1], b: [3, 1] }, { f: [4, 0], b: [3, 0] }],
  controller: [{ f: [3, 2], b: [2, 3] }, { f: [4, 2], b: [2, 2] }, { f: [3, 1], b: [2, 3] }],
  band_drum: [{ f: [4, -2], b: [0, 4] }, { f: [5, 2], b: [0, 4] }],
  band_fiddle: [{ f: [5, 1], b: [6, -5] }, { f: [2, 2], b: [6, -5] }, { f: [-1, 3], b: [6, -5] }, { f: [2, 2], b: [6, -5] }],
  band_accordion: [{ f: [5, 4], b: [-3, 4] }, { f: [7, 4], b: [-4, 4] }, { f: [8, 4], b: [-5, 4] }, { f: [7, 4], b: [-4, 4] }],
  band_horn: [{ f: [5, -4], b: [4, -3] }, { f: [5, -5], b: [4, -4], bob: -1 }],
};
// pose -> [keyframe set, frames per second, playback order]
const ANIM = {
  idle: ['idle', 1.4, [0, 0, 0, 1, 1, 0]],
  sit: ['sit', 1, [0, 0, 0, 1, 1, 0]],
  walk: [null, 10, [0, 1, 2, 3, 4, 5]],
  farm: ['swing', 6, [0, 1, 2, 3]], chop: ['swing', 7, [0, 1, 2, 3]], sign: ['swing', 8, [0, 1, 2, 3]],
  cook: ['cook', 5, [0, 1, 2, 3]], chat: ['chat', 3, [0, 1, 2, 1, 3, 0]],
  dance: ['dance', 6, [0, 1, 2, 3]], kidplay: ['dance', 6, [0, 1, 3, 1]],
  stretch: ['stretch', 3, [0, 1, 2, 2, 2, 1]],
  eat: ['eat', 3, [0, 0, 0, 1, 2, 2, 1, 0]], sip: ['sip', 2.5, [0, 0, 0, 0, 1, 2, 2, 1]],
  watch: ['watch', 3, [0, 0, 0, 0, 1, 2, 1, 0]],
  laptop: ['laptop', 7, [0, 1, 2, 3, 0, 2, 1, 3]],
  lute: ['lute', 6, [0, 1, 2, 3]], lutesit: ['lute', 6, [0, 1, 2, 3]],
  sweep: ['sweep', 5, [0, 1, 2, 3]], fetch: ['fetch', 4, [0, 1, 2, 3]], setup: ['setup', 4, [0, 1, 2, 3]],
  serve: ['serve', 2.5, [0, 1, 2, 3]], water: ['water', 4, [0, 1]],
  ride: [null, 8, [0, 1, 2, 3]],
  handheld: ['handheld', 3, [0, 1, 0, 2, 1, 0]], controller: ['controller', 7, [0, 1, 2, 1]],
  band_drum: ['band_drum', 4, [0, 1]], band_fiddle: ['band_fiddle', 6, [0, 1, 2, 3]],
  band_accordion: ['band_accordion', 4, [0, 1, 2, 3]], band_horn: ['band_horn', 3, [0, 1]],
};
const LIFT = { dance: [0, 2, 3, 2], kidplay: [0, 2, 3, 2] };

// Shafted tools drawn along a direction: hoe blade, axe head or hammer head at the tip.
function drawHafted(g, kind, [hx, hy], [dx, dy]) {
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  const len = kind === 'hammer' ? 7 : 11, px = -dy, py = dx;
  const tx = hx + dx * len, ty = hy + dy * len;
  line(g, Math.round(hx - dx * 4), Math.round(hy - dy * 4), Math.round(tx), Math.round(ty), WOOD.m, 2);
  line(g, Math.round(hx - dx * 4), Math.round(hy - dy * 4), Math.round(tx - dx), Math.round(ty - dy), WOOD.l, 1);
  const at = (a, b) => [Math.round(tx + dx * a + px * b), Math.round(ty + dy * a + py * b)];
  if (kind === 'hoe') {
    for (let k = 0; k < 5; k++) { const [x, y] = at(0, k); P(g, x, y, 2, 2, k === 4 ? METAL.h : METAL.m); }
  } else if (kind === 'axe') {
    for (let a = -3; a <= 0; a++) for (let b = -1; b <= 4; b++) { const [x, y] = at(a, b); P(g, x, y, 1, 1, b === 4 ? METAL.h : b < 0 ? METAL.d : METAL.m); }
  } else {
    for (let a = -1; a <= 1; a++) for (let b = -3; b <= 3; b++) { const [x, y] = at(a, b); P(g, x, y, 1, 1, a < 0 ? METAL.l : METAL.d); }
  }
}

Object.assign(HATS, {
  mail: { ox: -1, oy: -3, map: { B: '#3a5a9a', b: '#22325a', Y: '#f0c040' }, rows: ['...BBBBBB.....', '..BBBBBBBB....', '.BBBBBYBBBB...', '.bbbbbbbbbbbbb'] },
  band: { ox: -2, oy: -4, map: { K: '#e8c870', k: '#b89848', R: '#c03a3a' }, rows: ['....KKKKKKKK....', '....RRRRRRRR....', 'kkkkkkkkkkkkkkkk'] },
  sunhat: {
    ox: -3, oy: -4, map: { P: '#f4e4c0', p: '#c8b48a', F: '#e06a8a' },
    rows: ['......PPPPP.......', '.....PPPPPPP......', '....FFFFFFFFF.....', 'PPPPPPPPPPPPPPPPPP', '.pppppppppppppppp.'],
  },
  beanie: { ox: -1, oy: -3, map: { R: '#3a8ac8', r: '#24609a', Q: '#6ab0f0' }, rows: HATS.woodcutter.rows },
  cap: { ox: -1, oy: -3, map: { C: '#3a9a5a', c: '#246a3e' }, rows: ['...CCCCCC.....', '..CCCCCCCC....', '.CCCCCCCCCC...', '.ccccccccccccc'] },
});

const SIT_POSES = new Set(['sit', 'eat', 'watch', 'lutesit', 'laptop', 'sip', 'handheld', 'controller']);
const SHOE = ramp('#4a3022');
const WOOD = ramp('#8a5a30');
const METAL = ramp('#9aa2b0');

function limb(g, [x0, y0], [x1, y1], sl, sk, outlined) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
  if (outlined) {
    for (let i = 2; i < pts.length; i++) {
      const [x, y] = pts[i];
      P(g, x - 2, y - 1, 5, 3, OUT); P(g, x - 1, y - 2, 3, 5, OUT);
    }
  }
  pts.forEach(([x, y], i) => P(g, x - 1, y - 1, 3, 3, i / n < 0.55 ? sl.m : sk.m));
  pts.forEach(([x, y], i) => { if (i / n < 0.55) P(g, x - 1, y - 1, 1, 1, sl.l); });
  const cuff = pts[Math.max(0, Math.floor(n * 0.55) - 1)];
  if (n > 3) P(g, cuff[0] - 1, cuff[1] - 1, 3, 1, sl.d || sl.m);
  P(g, x1 - 1, y1 - 1, 3, 3, sk.m);
  P(g, x1 - 1, y1 - 1, 1, 1, sk.l);
  P(g, x1 + 1, y1 + 1, 1, 1, sk.d);
}

function drawLegs(g, o, sit, child, legLen, pants, skin) {
  if (sit) {
    const ty = FY - 4;
    P(g, AX - 3, ty - 1, 8, 2, pants.d);
    P(g, AX - 2, ty, 9, 2, pants.m); P(g, AX - 2, ty, 9, 1, pants.l);
    P(g, AX + 4, ty + 1, 3, 2, child ? skin.m : pants.m);
    P(g, AX + 4, FY - 1, 5, 2, SHOE.m); P(g, AX + 4, FY, 5, 1, SHOE.d); P(g, AX + 7, FY - 1, 1, 1, SHOE.l);
    return;
  }
  const top = FY - legLen + 1;
  const leg = (cx, off, lift, col, hl) => {
    const x = cx + off, rows = legLen - 3 - lift;
    P(g, cx + Math.round(off / 2) - 1, top, 3, 1, col);
    P(g, x - 1, top + 1, 3, rows, child ? skin.m : col);
    if (hl && !child) P(g, x - 1, top + 1, 1, rows, hl);
    if (!child && rows > 2) P(g, x, top + 2, 1, 1, pants.o);
    P(g, x - 1, FY - 1 - lift, 4, 2, SHOE.m);
    P(g, x, FY - 1 - lift, 1, 1, SHOE.h);
    P(g, x - 1, FY - lift, 4, 1, SHOE.d);
    P(g, x + 1, FY - 1 - lift, 2, 1, SHOE.l);
  };
  leg(AX - 2, o[0], o[1], pants.d, null);
  leg(AX + 2, o[2], o[3], pants.m, pants.l);
}

function drawTorso(g, v, tt, tb, shirt, pants, skin) {
  const x0 = AX - 4, w = 9, h = tb - tt + 1;
  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w; c++) {
      if (r === 0 && (c === 0 || c === w - 1)) continue;
      let col = c <= 1 ? shirt.l : c >= w - 2 ? shirt.d : shirt.m;
      if (r === 0) col = shirt.l;
      P(g, x0 + c, tt + r, 1, 1, col);
    }
  }
  P(g, x0 + 3, tt + 4, 2, 1, shirt.d); P(g, x0 + 5, tt + 6, 2, 1, shirt.d); P(g, x0 + 2, tt + 1, 1, 2, shirt.d);
  P(g, x0 + 2, tt, 2, 1, shirt.h); P(g, x0 + 5, tt, 2, 1, shirt.h); P(g, x0 + 4, tt, 1, 1, skin.d);
  P(g, x0, tb, w, 1, pants.m);
  let belt = true;
  switch (v.job) {
    case 'farmer': {
      const ov = ramp(v.look.pants);
      P(g, x0 + 2, tt + 2, 5, h - 2, ov.m); P(g, x0 + 6, tt + 2, 1, h - 2, ov.d);
      P(g, x0, tt + 5, w, h - 5, ov.m); P(g, x0, tt + 5, 1, h - 5, ov.l); P(g, x0 + w - 1, tt + 5, 1, h - 5, ov.d);
      P(g, x0 + 2, tt, 1, 2, ov.d); P(g, x0 + 6, tt, 1, 2, ov.d);
      P(g, x0 + 2, tt + 2, 1, 1, '#f0d060'); P(g, x0 + 6, tt + 2, 1, 1, '#f0d060');
      P(g, x0 + 3, tt + 3, 3, 2, ov.l); P(g, x0 + 3, tt + 4, 3, 1, ov.d);
      belt = false;
      break;
    }
    case 'cook': {
      const ap = ramp('#f4f2ec');
      P(g, x0 + 1, tt + 2, 7, h - 2, ap.m); P(g, x0 + 7, tt + 2, 1, h - 2, ap.d);
      P(g, x0 + 3, tt + 4, 1, h - 4, ap.d); P(g, x0 + 5, tt + 5, 1, h - 5, ap.d);
      P(g, x0 + 3, tt, 3, 2, '#d04040'); P(g, x0 + 4, tt + 2, 1, 1, '#a02828');
      belt = false;
      break;
    }
    case 'woodcutter':
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w; c++) {
          if (r === 0 && (c === 0 || c === w - 1)) continue;
          if ((c + 1) % 4 === 0 || (r + 2) % 4 === 0) P(g, x0 + c, tt + r, 1, 1, c >= w - 2 ? shirt.o : mixHex(shirt.d, '#1a1010', 0.45));
        }
      }
      P(g, x0 + 2, tt, 1, h - 1, '#5a3a20'); P(g, x0 + 6, tt, 1, h - 1, '#5a3a20');
      break;
    case 'bard':
      P(g, x0 + 3, tt, 3, 1, skin.m); P(g, x0 + 4, tt + 1, 1, 1, skin.m);
      for (let r = 1; r < h - 2; r++) P(g, x0 + r - 1, tt + r, 2, 1, r % 2 ? '#e8c050' : '#c89a30');
      break;
    case 'carrier': {
      P(g, x0 + 2, tt, 5, 1, '#ffffff');
      const vest = ramp('#6a3a2a');
      P(g, x0 + 2, tt + 3, 5, h - 4, vest.m); P(g, x0 + 2, tt + 3, 1, h - 4, vest.l);
      for (let r = tt + 3; r < tb - 1; r += 2) P(g, x0 + 4, r, 1, 1, '#f0e0c0');
      belt = false;
      break;
    }
    case 'band':
      P(g, x0, tt, 2, 1, '#e8c050'); P(g, x0 + 7, tt, 2, 1, '#e8c050');
      for (let r = tt + 2; r < tb - 1; r += 2) P(g, x0 + 4, r, 1, 1, '#e8c050');
      P(g, x0 + 3, tt, 3, 2, '#ffffff');
      break;
    case 'mail':
      P(g, x0 + 6, tt + 2, 2, 2, '#e8c050'); P(g, x0 + 3, tt, 3, 1, '#ffffff');
      break;
    case 'child':
      P(g, x0, tt + 3, w, 1, shirt.h);
      belt = false;
      break;
  }
  if (belt) { P(g, x0, tb - 1, w, 1, '#3a2418'); P(g, x0 + 5, tb - 1, 2, 1, '#e0b040'); }
}

function drawSkirt(g, tb, pants, sit) {
  if (sit) {
    P(g, AX - 4, tb - 1, 12, 4, pants.m); P(g, AX - 4, tb - 1, 12, 1, pants.l); P(g, AX + 7, tb, 1, 3, pants.d);
    return;
  }
  P(g, AX - 5, tb - 1, 11, 2, pants.m);
  P(g, AX - 6, tb + 1, 13, 3, pants.m);
  P(g, AX - 6, tb + 1, 1, 3, pants.l);
  for (const x of [AX - 3, AX + 1, AX + 4]) P(g, x, tb + 1, 1, 3, pants.d);
  P(g, AX - 6, tb + 3, 13, 1, pants.d);
}

function drawPack(g, tt) {
  const pk = ramp('#8a5a30'), br = ramp('#c84a3a');
  P(g, AX - 10, tt - 1, 7, 11, pk.m); P(g, AX - 10, tt - 1, 1, 11, pk.l); P(g, AX - 4, tt - 1, 1, 11, pk.d);
  P(g, AX - 10, tt, 7, 3, pk.d); P(g, AX - 8, tt + 2, 2, 2, '#e0c060');
  P(g, AX - 10, tt + 6, 7, 1, pk.o);
  P(g, AX - 11, tt - 5, 9, 4, br.m); P(g, AX - 11, tt - 5, 9, 1, br.l); P(g, AX - 11, tt - 2, 9, 1, br.d);
  P(g, AX - 11, tt - 5, 1, 4, br.h); P(g, AX - 3, tt - 5, 1, 4, br.d); P(g, AX - 8, tt - 5, 1, 4, '#4a2a18');
}

function drawTool(g, tool, hx, hy, frame, tt, tb) {
  switch (tool) {
    case 'ladle':
      line(g, hx, hy, hx + 4, hy + 7, '#c8ccd4', 1);
      P(g, hx + 3, hy + 7, 4, 2, '#9aa0aa');
      break;
    case 'bowl':
      P(g, hx - 2, hy + 1, 7, 3, WOOD.m); P(g, hx - 2, hy + 1, 7, 1, '#e8a840'); P(g, hx - 1, hy + 3, 5, 1, WOOD.d);
      break;
    case 'spoon':
      P(g, hx, hy - 2, 2, 2, '#e8a840');
      break;
    case 'handheld0': // red-and-blue hybrid console
      P(g, hx - 4, hy - 2, 2, 4, '#e03a3a'); P(g, hx - 2, hy - 2, 5, 4, '#2a2a30'); P(g, hx - 1, hy - 1, 3, 2, '#6ad0ff');
      P(g, hx + 3, hy - 2, 2, 4, '#3a7ad8'); P(g, hx - 4, hy - 2, 1, 1, '#ff8a8a'); P(g, hx + 4, hy - 2, 1, 1, '#8ab0ff');
      break;
    case 'handheld1': // chunky dark handheld PC
      P(g, hx - 4, hy - 2, 10, 4, '#3a3a44'); P(g, hx - 1, hy - 1, 4, 2, '#9ae0ff'); P(g, hx - 1, hy - 1, 1, 1, '#ffffff');
      P(g, hx - 3, hy - 1, 1, 1, '#8a8a98'); P(g, hx + 4, hy, 1, 1, '#8a8a98');
      break;
    case 'pad': // wired controller
      P(g, hx - 2, hy - 1, 6, 3, '#a8a8b4'); P(g, hx - 2, hy - 1, 6, 1, '#c8c8d4');
      P(g, hx - 1, hy, 1, 1, '#2a2a30'); P(g, hx + 2, hy, 1, 1, '#e03a3a'); P(g, hx + 3, hy - 1, 1, 1, '#3a7ad8');
      break;
    case 'mug':
      P(g, hx - 1, hy - 3, 4, 4, '#ffffff'); P(g, hx - 1, hy - 3, 4, 1, '#6a3a1a'); P(g, hx + 3, hy - 2, 1, 2, '#ffffff');
      P(g, hx + 2, hy - 2, 1, 3, '#d8dce4');
      break;
    case 'popcorn': {
      const bx = AX + 1, by = tb - 2;
      for (let i = 0; i < 5; i++) P(g, bx + i, by, 1, 5, i % 2 ? '#ffffff' : '#e03838');
      P(g, bx - 1, by - 2, 7, 2, '#fff2c0'); P(g, bx, by - 3, 2, 1, '#fffae0'); P(g, bx + 3, by - 3, 2, 1, '#fffae0');
      if (frame) P(g, hx, hy - 2, 2, 2, '#fff2c0');
      break;
    }
    case 'lute': {
      const lw = ramp('#c88040');
      line(g, AX + 5, tt + 3, AX + 12, tt - 3, '#5a3418', 2);
      P(g, AX + 11, tt - 6, 3, 3, '#3a2010');
      ellipse(g, AX + 2, tt + 5, 4, 3, lw.m);
      P(g, AX - 1, tt + 3, 3, 1, lw.l);
      P(g, AX + 2, tt + 4, 2, 2, '#3a2010');
      line(g, AX + 1, tt + 6, AX + 11, tt - 2, '#f0e0b0', 1);
      break;
    }
    case 'broom':
      line(g, hx - 3, hy - 7, hx + 5, FY - 4, WOOD.m, 2);
      for (let i = 0; i < 4; i++) P(g, hx + 3 - i + (frame % 2), FY - 3 + i, 6 + 2 * i, 1, i % 2 ? '#c8a050' : '#e0c070');
      break;
    case 'bucket':
      line(g, hx - 2, hy + 1, hx, hy - 1, '#5a5a66', 1); line(g, hx, hy - 1, hx + 4, hy + 1, '#5a5a66', 1);
      P(g, hx - 2, hy + 1, 7, 6, METAL.m); P(g, hx - 2, hy + 1, 2, 6, METAL.l); P(g, hx + 3, hy + 1, 2, 6, METAL.d);
      P(g, hx - 2, hy + 3, 7, 1, METAL.o); P(g, hx - 1, hy + 1, 5, 1, '#5ab0f0');
      break;
    case 'pour':
      P(g, hx, hy - 2, 7, 5, METAL.m); P(g, hx, hy - 2, 7, 1, METAL.l); P(g, hx, hy, 7, 1, METAL.o);
      P(g, hx + 7, hy - 2, 1, 2, '#5ab0f0');
      P(g, hx + 7, hy, 1, 4, '#7ac4f8'); P(g, hx + 8, hy + 4, 1, 5, '#7ac4f8');
      break;
  }
}

function drawCarry(g, carry, hx, hy, tt) {
  if (carry === 'log') {
    const bk = ramp('#7a4a28');
    P(g, AX - 9, tt - 4, 19, 5, bk.m); P(g, AX - 9, tt - 4, 19, 1, bk.l); P(g, AX - 9, tt, 19, 1, bk.d);
    for (let x = AX - 6; x < AX + 8; x += 4) P(g, x, tt - 3, 2, 1, bk.d);
    P(g, AX + 9, tt - 4, 2, 5, '#e0b47c'); P(g, AX + 10, tt - 2, 1, 1, '#a87a48');
  } else if (carry === 'mail') {
    P(g, hx, hy - 3, 5, 4, '#ffffff'); P(g, hx, hy - 3, 5, 1, '#d8d8e0'); P(g, hx + 2, hy - 2, 1, 1, '#c83a3a');
  } else if (carry === 'package') {
    P(g, AX + 2, tt + 1, 9, 7, '#c8a068'); P(g, AX + 2, tt + 1, 9, 1, '#e0bc88'); P(g, AX + 6, tt + 1, 1, 7, '#f0e0b0'); P(g, AX + 10, tt + 2, 1, 6, '#a07840');
  } else if (carry === 'sign') {
    const sw = ramp('#d8b070');
    P(g, AX + 2, tt, 14, 10, sw.m); P(g, AX + 2, tt, 14, 1, sw.l);
    P(g, AX + 2, tt + 3, 14, 1, sw.d); P(g, AX + 2, tt + 6, 14, 1, sw.d);
    P(g, AX + 8, tt + 10, 2, 4, WOOD.d);
  }
}

function buildVillager(v, pose, frame, carry, gear) {
  if (pose === 'ride') return buildRider(v, frame, carry);
  const c = mk(SW, SH), g = c.getContext('2d');
  const L = v.look;
  const skin = ramp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  const child = v.small, legLen = child ? 4 : 6, torsoH = child ? 7 : 9;
  const sit = SIT_POSES.has(pose);
  let back = child ? [-1, 5] : [-1, 6], front = child ? [1, 5] : [1, 6], tool = null, bob = 0, dir = null;
  let legs = [0, 0, 0, 0];
  if (pose === 'walk') {
    const ph = (frame / 6) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
    const fo = Math.round(3 * cs);
    legs = [-fo, sn < -0.6 ? 1 : 0, fo, sn > 0.6 ? 1 : 0];
    bob = -Math.round(Math.abs(sn));
    front = [1 - Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
    back = [-1 + Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
  } else if (ANIM[pose]) {
    const k = KEYS[ANIM[pose][0]][frame] || KEYS[ANIM[pose][0]][0];
    if (k.f) front = k.f;
    if (k.b) back = k.b;
    bob = k.bob || 0; dir = k.dir;
  }
  if (child) { front = [front[0], Math.min(front[1], 5)]; back = [back[0], Math.min(back[1], 5)]; }
  const tb = (sit ? FY - 5 : FY - legLen) + bob;
  const tt = tb - torsoH + 1, hy = tt - 12;
  const sb = [AX - 3, tt + 2], sf = [AX + 3, tt + 2];
  switch (pose) {
    case 'farm': case 'chop': case 'sign': tool = pose === 'farm' ? 'hoe' : pose === 'chop' ? 'axe' : 'hammer'; break;
    case 'cook': tool = 'ladle'; break;
    case 'eat': tool = frame === 2 ? 'spoon' : 'bowl'; break;
    case 'watch': tool = 'popcorn'; break;
    case 'lute': case 'lutesit': tool = 'lute'; break;
    case 'sweep': tool = 'broom'; break;
    case 'fetch': tool = 'bucket'; break;
    case 'water': tool = 'pour'; break;
    case 'sip': tool = 'mug'; break;
    case 'serve': tool = frame === 1 || frame === 2 ? null : 'mug'; break;
    case 'handheld': tool = 'handheld' + (v.id % 2); break;
    case 'controller': tool = 'pad'; break;
    case 'band_drum': tool = 'drum'; break;
    case 'band_fiddle': tool = 'fiddle'; break;
    case 'band_accordion': tool = 'accordion'; break;
    case 'band_horn': tool = 'horn'; break;
  }
  if (carry === 'log') { back = [-1, -3]; front = [2, -3]; }
  else if (carry === 'bucket' && pose !== 'water') { front = [1, 6]; tool = 'bucket'; }
  else if (carry === 'sign') { back = [4, 2]; front = [5, 1]; }
  else if (carry === 'package') { back = [4, 3]; front = [6, 2]; }
  else if (carry === 'mail') front = [4, -1];
  const stick = gear && !tool && !carry && (pose === 'walk' || pose === 'idle');
  if (stick) front = [4, 3];
  const hb = [sb[0] + back[0], sb[1] + back[1]], hf = [sf[0] + front[0], sf[1] + front[1]];

  if (gear) drawPack(g, tt);
  limb(g, sb, hb, { m: shirt.d, l: shirt.m }, { m: skin.d, l: skin.m, d: skin.o }, false);
  drawLegs(g, legs, sit, child, legLen, pants, skin);
  if (!sit && tb < FY - legLen) P(g, AX - 4, tb + 1, 9, FY - legLen - tb, pants.m);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  if (v.job === 'carrier') drawSkirt(g, tb, pants, sit);

  tpl(g, HEAD, AX - 5, hy, { S: skin.m, s: skin.d, H: skin.l, E: skin.o, n: skin.d, w: '#ffffff', e: OUT, b: '#e8907c', m: skin.o, k: hair.d });
  if (L.beard) tpl(g, BEARD, AX - 5, hy + 7, { h: hair.m, k: hair.d });
  tpl(g, HAIR[L.style], AX - 6, hy - 2, { h: hair.m, k: hair.d, j: hair.l });
  const hat = HATS[v.hat || v.job];
  if (hat) tpl(g, hat.rows, AX - 5 + hat.ox, hy + hat.oy, hat.map);
  if (v.job === 'mail') { line(g, AX + 2, tt, AX - 3, tb - 3, '#5a3a20', 1); P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48'); }
  if (gear) line(g, AX - 3, tt + 1, AX + 1, tt + 5, '#4a2a18', 1);

  limb(g, sf, hf, shirt, skin, true);
  if (tool === 'hoe' || tool === 'axe' || tool === 'hammer') drawHafted(g, tool, hf, dir || [0.8, 0.6]);
  else if (INSTRUMENTS.includes(tool)) drawInstrument(g, tool, hf, hb, frame, tt, hy);
  else if (tool) drawTool(g, tool, hf[0], hf[1], frame, tt, tb);
  if (carry && carry !== 'bucket') drawCarry(g, carry, hf[0], hf[1], tt);
  if (stick) {
    line(g, hf[0] + 1, hf[1] - 9, hf[0] + 2, FY, '#9a6a3a', 2);
    P(g, hf[0], hf[1] - 11, 3, 3, '#6a4020');
  }
  if (stick || (tool && !['popcorn', 'lute', 'bowl', 'spoon', 'mug', 'handheld0', 'handheld1', 'pad', ...INSTRUMENTS].includes(tool))) {
    P(g, hf[0] - 1, hf[1] - 1, 3, 3, skin.m); P(g, hf[0] - 1, hf[1] - 1, 1, 1, skin.l);
  }
  outline(c);
  return { cv: c, eyeX: AX + 3, eyeY: hy + 5, top: hy - 6 };
}

/* ---------- animals ---------- */

const COATS = {
  dog: [
    { c: '#a86a3a', d: '#7a4a28', l: '#c88a58', ear: '#5a3a20', belly: '#e8c8a0' },
    { c: '#f0eee8', d: '#c4c4c8', l: '#ffffff', ear: '#2a2a30', belly: '#ffffff', patch: '#2a2a30' },
  ],
  cat: [{ c: '#e88a3a', d: '#b85a20', l: '#f8b070' }],
  rabbit: [{ c: '#a88a6a', d: '#7a604a', l: '#c8aa8a' }, { c: '#e8e4dc', d: '#b8b0a8', l: '#ffffff' }],
  squirrel: [{ c: '#b8602a', d: '#8a4220', l: '#d88a4a', belly: '#f0d0a0' }],
  bird: [{ c: '#4a7ad0', d: '#2a4a90', l: '#8ab0f0' }, { c: '#8a6a4a', d: '#5a4430', l: '#b89878' }, { c: '#d84a3a', d: '#9a2a20', l: '#f08070' }],
};
const ANIMAL_SIZE = { dog: [20, 16, 10, 13], cat: [18, 14, 9, 11], rabbit: [14, 16, 7, 13], squirrel: [16, 16, 8, 13], bird: [11, 10, 5, 7] };
const animalCache = new Map();

function animalSprite(type, variant, pose, frame) {
  const key = `${type}|${variant}|${pose}|${frame}`;
  let spr = animalCache.get(key);
  if (spr) return spr;
  const [w, h, ax, by] = ANIMAL_SIZE[type];
  const c = mk(w, h), g = c.getContext('2d'), k = COATS[type][variant];
  const px = (x, y, ww, hh, col) => P(g, ax + x, by + y, ww, hh, col);
  if (type === 'dog') {
    if (pose === 'lie') {
      px(-6, -3, 12, 3, k.c); px(-6, -3, 12, 1, k.l); px(4, -4, 4, 3, k.c); px(5, -3, 3, 2, k.l);
      px(4, -4, 2, 3, k.ear); px(7, -3, 1, 1, OUT); px(-8, -1, 2, 1, k.c);
      if (k.patch) px(-2, -3, 3, 2, k.patch);
    } else if (pose === 'sit') {
      px(-4, -4, 5, 4, k.c); px(0, -7, 4, 6, k.c); px(0, -7, 1, 6, k.l); px(1, -2, 1, 2, k.d); px(3, -2, 1, 2, k.d);
      px(1, -11, 5, 4, k.c); px(5, -9, 2, 2, k.l); px(6, -9, 1, 1, OUT); px(3, -10, 1, 1, OUT); px(1, -11, 2, 3, k.ear);
      px(-6, -1, 3, 1, k.c);
      if (k.patch) px(-3, -4, 2, 2, k.patch);
    } else {
      const run = pose === 'run', sw = [[0, 1], [1, 0], [0, -1], [-1, 0]][frame % 4];
      px(-5, -7, 10, 4, k.c); px(-5, -7, 10, 1, k.l); px(-4, -4, 8, 1, k.belly);
      for (const [lx, s] of [[-4, sw[0]], [-2, -sw[0]], [2, sw[1]], [4, -sw[1]]]) px(lx + (run ? s : 0), -3, 1, 3, k.d);
      px(4, -10 + (run ? 1 : 0), 5, 4, k.c); px(8, -8 + (run ? 1 : 0), 2, 2, k.l); px(9, -8 + (run ? 1 : 0), 1, 1, OUT);
      px(6, -9 + (run ? 1 : 0), 1, 1, OUT); px(4, -10 + (run ? 1 : 0), 2, 3, k.ear);
      const wag = frame % 2;
      px(-6 - wag, -9, 1, 3, k.c); px(-7 - wag, -10, 1, 1, k.c);
      if (k.patch) px(-2, -7, 3, 2, k.patch);
    }
  } else if (type === 'cat') {
    if (pose === 'curl') {
      px(-4, -3, 8, 3, k.c); px(-4, -3, 8, 1, k.l); px(2, -4, 3, 2, k.c); px(2, -5, 1, 1, k.c); px(4, -5, 1, 1, k.c);
      px(-4, 0, 7, 1, k.d); px(-2, -3, 1, 2, k.d); px(0, -3, 1, 2, k.d);
    } else if (pose === 'sit') {
      px(-2, -6, 4, 6, k.c); px(-2, -6, 1, 6, k.l); px(0, -5, 1, 3, k.d);
      px(-2, -9, 4, 3, k.c); px(-2, -10, 1, 1, k.c); px(1, -10, 1, 1, k.c); px(1, -8, 1, 1, '#3a8a30');
      px(-5, -1, 4, 1, k.c); px(-5, -2, 1, 1, k.c);
    } else {
      const arch = pose === 'arch', sw = [1, 0, -1, 0][frame % 4];
      px(-4, arch ? -7 : -5, 8, arch ? 2 : 3, k.c); px(-4, arch ? -7 : -5, 8, 1, k.l);
      px(-2, arch ? -7 : -5, 1, 2, k.d); px(1, arch ? -7 : -5, 1, 2, k.d);
      for (const [lx, s] of [[-3, sw], [-1, -sw], [2, sw], [3, -sw]]) px(lx + s, arch ? -5 : -2, 1, arch ? 5 : 2, k.d);
      px(3, arch ? -9 : -8, 4, 3, k.c); px(3, arch ? -10 : -9, 1, 1, k.c); px(6, arch ? -10 : -9, 1, 1, k.c);
      px(5, arch ? -8 : -7, 1, 1, '#3a8a30');
      px(-5, arch ? -11 : -8 + (frame % 2), 1, 4, k.c); px(-6, arch ? -12 : -9 + (frame % 2), 1, 1, k.c);
    }
  } else if (type === 'rabbit') {
    const hop = pose === 'hop' && frame % 2;
    if (hop) { px(-4, -6, 8, 3, k.c); px(-4, -6, 8, 1, k.l); px(-6, -4, 2, 1, k.d); px(3, -3, 1, 2, k.d); }
    else { px(-3, -4, 6, 4, k.c); px(-3, -4, 6, 1, k.l); px(-2, 0, 2, 0, k.d); }
    const hx = hop ? 3 : 1, hy = hop ? -8 : -7;
    px(hx, hy, 3, 3, k.c); px(hx + 2, hy + 1, 1, 1, OUT);
    px(hx, hy - 4, 1, 4, k.c); px(hx + 1, hy - 4, 1, 4, '#e8a0a8');
    px(hop ? -5 : -4, hop ? -6 : -4, 2, 2, '#ffffff');
  } else if (type === 'squirrel') {
    if (pose === 'sit') {
      px(-1, -5, 3, 5, k.c); px(0, -4, 1, 3, k.belly); px(-1, -7, 3, 2, k.c); px(1, -6, 1, 1, OUT); px(-1, -8, 1, 1, k.c);
      px(1, -3, 1, 1, '#8a5a2a');
      px(-4, -10, 3, 10, k.c); px(-4, -10, 1, 10, k.l); px(-3, -11, 2, 1, k.c);
    } else {
      const f = frame % 2;
      px(-2, -3 - f, 5, 2, k.c); px(2, -5 - f, 3, 2, k.c); px(4, -4 - f, 1, 1, OUT); px(2, -6 - f, 1, 1, k.c);
      px(-1, -1, 1, 1, k.d); px(2, -1, 1, 1, k.d);
      px(-5, -8 + f, 3, 6, k.c); px(-5, -8 + f, 1, 6, k.l); px(-4, -9 + f, 2, 1, k.c);
    }
  } else if (type === 'bird') {
    px(-2, -3, 4, 2, k.c); px(-2, -3, 4, 1, k.l); px(-3, -3, 1, 1, k.d);
    if (pose === 'fly') {
      px(2, -4, 2, 2, k.c); px(4, -3, 1, 1, '#f0b030'); px(3, -4, 1, 1, OUT);
      if (frame % 2) px(-1, -6, 3, 3, k.d); else px(-1, -1, 3, 2, k.d);
    } else {
      const peck = pose === 'peck' && frame % 2;
      px(2, peck ? -2 : -4, 2, 2, k.c); px(4, peck ? -1 : -3, 1, 1, '#f0b030'); px(3, peck ? -2 : -4, 1, 1, OUT);
      px(-1, -1, 1, 1, '#c08030'); px(1, -1, 1, 1, '#c08030');
    }
  }
  outline(c);
  spr = { cv: c, ax, by };
  animalCache.set(key, spr);
  return spr;
}

// Lounging spots for the cat, and places for wildlife (simulation units).
const CAT_SPOTS = [[86, 104], [74, 120], [110, 121], [188, 117], [70, 84], [130, 84], [60, 102], [204, 110]];
const RABBIT_ZONES = [[134, 64, 166, 75], [112, 117, 122, 125], [2, 96, 14, 101]];
const TREE_BASES = [[40, 72], [134, 70], [160, 70], [88, 64], [221, 106]];

// Instruments for the travelling band.
function drawInstrument(g, kind, hf, hb, frame, tt, hy) {
  const [hx, hyy] = hf;
  if (kind === 'drum') {
    P(g, AX - 3, tt, 1, 4, '#5a3a20'); P(g, AX + 3, tt, 1, 4, '#5a3a20');
    disc(g, AX + 2, tt + 6, 5, '#c83a3a'); disc(g, AX + 2, tt + 6, 4, '#f0e8d8'); P(g, AX - 3, tt + 6, 11, 1, '#e8c050');
    line(g, hx, hyy, hx + 2, hyy - 3, '#8a5a30', 1); P(g, hx + 2, hyy - 5, 2, 2, '#f0f0f0');
  } else if (kind === 'fiddle') {
    ellipse(g, AX + 5, tt, 3, 2, '#a85a28'); P(g, AX + 4, tt, 2, 1, '#3a2010');
    line(g, AX + 7, tt - 1, hb[0], hb[1], '#5a3418', 1);
    const bx = hx - 1, by = hyy + 1;
    line(g, bx - 4, by + 2, bx + 5, by - 3, '#e8dcc0', 1);
  } else if (kind === 'accordion') {
    const x0 = Math.min(hb[0], hf[0]) + 1, x1 = Math.max(hb[0], hf[0]) - 1;
    for (let x = x0; x <= x1; x++) P(g, x, tt + 3, 1, 6, x % 2 ? '#c83a3a' : '#2a2a30');
    P(g, x0 - 1, tt + 2, 2, 8, '#e8e0d0'); P(g, x1, tt + 2, 2, 8, '#e8e0d0');
  } else if (kind === 'horn') {
    line(g, AX + 6, hy + 9, hx + 4, hyy - 1, '#e8b830', 2);
    disc(g, hx + 6, hyy - 2, 3, '#f0c840'); disc(g, hx + 6, hyy - 2, 1, '#a87810');
  }
}

// The mail carrier pedalling a red bicycle.
function drawBike(g, frame, cx, by) {
  const fr = ramp('#c83a3a');
  for (const wx of [cx - 8, cx + 8]) {
    disc(g, wx, by - 4, 4, '#2a2a30');
    g.clearRect(wx - 2, by - 6, 5, 5);
    const a = (frame / 4) * Math.PI;
    P(g, wx + Math.round(Math.cos(a) * 2), by - 4 + Math.round(Math.sin(a) * 2), 1, 1, '#9aa0aa');
    P(g, wx - Math.round(Math.cos(a) * 2), by - 4 - Math.round(Math.sin(a) * 2), 1, 1, '#9aa0aa');
    P(g, wx, by - 4, 1, 1, '#c8ccd4');
  }
  line(g, cx - 8, by - 4, cx - 2, by - 10, fr.m, 1); line(g, cx - 2, by - 10, cx + 1, by - 4, fr.m, 1);
  line(g, cx - 8, by - 4, cx + 1, by - 4, fr.d, 1); line(g, cx + 1, by - 4, cx + 6, by - 11, fr.m, 1);
  line(g, cx - 2, by - 10, cx + 6, by - 11, fr.l, 1); line(g, cx + 6, by - 11, cx + 8, by - 4, fr.m, 1);
  P(g, cx - 4, by - 11, 4, 1, '#3a2a20'); P(g, cx + 5, by - 13, 1, 3, '#3a3a46'); P(g, cx + 4, by - 13, 3, 1, '#3a3a46');
  P(g, cx + 6, by - 8, 4, 3, '#8a5a30');
}

function makeParkedBike() {
  const c = mk(26, 18), g = c.getContext('2d');
  drawBike(g, 0, 13, 16);
  outline(c);
  return { cv: c, ax: 13, by: 16 };
}

function buildRider(v, frame, carry) {
  const c = mk(SW, SH), g = c.getContext('2d'), L = v.look;
  const skin = ramp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  drawBike(g, frame, AX, FY);
  const tb = FY - 10, tt = tb - 8, hy = tt - 12;
  const a = (frame / 4) * Math.PI * 2, pedal = [AX + 1 + Math.round(Math.cos(a) * 3), FY - 4 + Math.round(Math.sin(a) * 3)];
  const pedal2 = [AX + 1 - Math.round(Math.cos(a) * 3), FY - 4 - Math.round(Math.sin(a) * 3)];
  limb(g, [AX - 2, tb], pedal2, { m: pants.d, l: pants.d }, { m: SHOE.d, l: SHOE.m, d: SHOE.o }, false);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  tpl(g, HEAD, AX - 5, hy, { S: skin.m, s: skin.d, H: skin.l, E: skin.o, n: skin.d, w: '#ffffff', e: OUT, b: '#e8907c', m: skin.o, k: hair.d });
  tpl(g, HAIR[L.style], AX - 6, hy - 2, { h: hair.m, k: hair.d, j: hair.l });
  const hat = HATS[v.hat || v.job];
  if (hat) tpl(g, hat.rows, AX - 5 + hat.ox, hy + hat.oy, hat.map);
  limb(g, [AX - 1, tb], pedal, { m: pants.m, l: pants.l }, { m: SHOE.m, l: SHOE.l, d: SHOE.d }, true);
  limb(g, [AX + 3, tt + 2], [AX + 6, FY - 13], shirt, skin, true);
  P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48');
  if (carry === 'package') { P(g, AX + 6, FY - 11, 5, 4, '#c8a068'); P(g, AX + 8, FY - 11, 1, 4, '#e8d8a0'); }
  outline(c);
  return { cv: c, eyeX: AX + 3, eyeY: hy + 5, top: hy - 6 };
}

/* ---------- scenery ---------- */

function disc(g, cx, cy, r, c) {
  ellipse(g, cx, cy, r, r, c);
}

function makeTree(rw, seed, snow) {
  const R = rw * S + 1, trunkH = 13;
  const w = R * 2 + 10, h = R * 2 + trunkH + 8;
  const c = mk(w, h), g = c.getContext('2d'), rnd = mulberry32(seed);
  const cx = w >> 1, by = h - 2, ccy = by - trunkH - R + 3;

  const bark = ramp('#6a4428'), tw = rw >= 6 ? 7 : 5, tx = cx - (tw >> 1);
  P(g, tx, ccy, tw, by - ccy + 1, bark.m);
  P(g, tx, ccy, 2, by - ccy + 1, bark.l);
  P(g, tx + tw - 2, ccy, 2, by - ccy + 1, bark.d);
  for (let i = 0; i < 6; i++) P(g, tx + 1 + Math.floor(rnd() * (tw - 2)), ccy + R * 0.6 + Math.floor(rnd() * (by - ccy - R * 0.6 - 3)), 1, 3, bark.o);
  P(g, tx - 2, by - 1, tw + 4, 2, bark.m); P(g, tx - 2, by, tw + 4, 1, bark.d);

  const leaf = (snow
    ? ['#24443a', '#355e4c', '#4a7a5e', '#d4e0ee', '#ffffff']
    : ['#1c4628', '#2c6630', '#40863a', '#5ca846', '#8ccc5e']).map(hexToRgb);
  const cl = [{ x: cx, y: ccy, r: R * 0.66 }];
  const n = 5 + Math.round(R / 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, dd = Math.sqrt(rnd()) * R * 0.55;
    cl.push({ x: cx + Math.cos(a) * dd * 1.1, y: ccy + Math.sin(a) * dd * 0.85, r: R * (0.3 + rnd() * 0.22) });
  }
  cl.sort((a, b) => a.y - b.y);
  const lc = mk(w, h), lg = lc.getContext('2d'), im = lg.createImageData(w, h), d = im.data;
  for (const k of cl) {
    for (let y = Math.floor(k.y - k.r); y <= Math.ceil(k.y + k.r); y++) {
      for (let x = Math.floor(k.x - k.r); x <= Math.ceil(k.x + k.r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const nx = (x - k.x) / k.r, ny = (y - k.y) / k.r, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const gx = (x - cx) / R, gy = (y - ccy) / R;
        let v = 0.5 - 0.45 * (nx * 0.6 + ny * 0.8) - 0.4 * (gx * 0.6 + gy * 0.8) + (hash2(x, y, seed) - 0.5) * 0.3;
        if (d2 > 0.72 && ny > -0.1) v -= 0.35;
        let lvl = Math.max(0, Math.min(4, Math.floor(v * 4 + bayer(x, y) - 0.5)));
        if (snow) lvl = ny < -0.2 && v > 0.45 ? (v > 0.7 ? 4 : 3) : Math.min(lvl, 2);
        const i = (y * w + x) * 4, col = leaf[lvl];
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
  }
  lg.putImageData(im, 0, 0);
  g.drawImage(lc, 0, 0);
  outline(c, snow ? '#1a2630' : '#10261a');
  return { cv: c, ax: cx, ay: by, r: R };
}

function drawHouse(g, h, snow) {
  const { X, Wd, top, bot, ridge } = h.g;
  const roof = ramp(h.roof), logs = ramp(h.logs), beam = ramp('#5a3a22'), cream = ramp('#e8dcc0');
  const mortar = '#3a3440', rnd = mulberry32(h.x * 7 + 3);
  const stones = ['#8c8894', '#968c82', '#7e8696', '#a09a92'].map(ramp);
  const stoneTop = bot - (h.tavern ? 12 : 11);

  // log-cabin upper floor
  for (let y = top + 2; y < stoneTop; y++) {
    const r = (y - top - 2) % 5;
    P(g, X, y, Wd, 1, r === 4 ? logs.o : r === 0 ? logs.l : r === 3 ? logs.d : logs.m);
  }
  for (let i = 0; i < Wd * 0.6; i++) {
    const y = top + 3 + Math.floor(rnd() * (stoneTop - top - 4));
    if ((y - top - 2) % 5 === 4) continue;
    P(g, X + Math.floor(rnd() * Wd), y, 2 + Math.floor(rnd() * 5), 1, rnd() < 0.7 ? logs.d : logs.h);
  }
  // cross-notched log ends poking out at the corners
  for (let y = top + 2; y < stoneTop - 2; y += 5) {
    for (const cx of [X - 3, X + Wd - 1]) {
      P(g, cx, y, 4, 4, logs.m); P(g, cx, y, 4, 1, logs.h); P(g, cx + 1, y + 1, 2, 2, logs.l);
      P(g, cx + 2, y + 2, 1, 1, logs.d); P(g, cx, y + 4, 4, 1, logs.o);
    }
  }
  // shadow under the deep eaves, with rafter ends
  P(g, X, top + 2, Wd, 4, logs.o);
  for (let x = X - 9; x < X + Wd + 8; x += 8) { P(g, x, top + 2, 3, 3, beam.m); P(g, x, top + 2, 3, 1, beam.l); P(g, x + 2, top + 3, 1, 2, beam.o); }

  // rubble-stone ground floor
  P(g, X - 2, stoneTop, Wd + 4, bot - stoneTop, mortar);
  for (let y = stoneTop + 2, row = 0; y < bot - 1; row++) {
    const hh = Math.min(4 + Math.floor(rnd() * 3), bot - 1 - y);
    for (let x = X - 2 - (row % 2) * 4; x < X + Wd + 2;) {
      const sw = 6 + Math.floor(rnd() * 7), st = stones[Math.floor(rnd() * stones.length)];
      const x0 = Math.max(x, X - 2), x1 = Math.min(x + sw - 1, X + Wd + 2);
      if (x1 - x0 >= 2 && hh >= 2) {
        P(g, x0, y, x1 - x0, hh - 1, st.m);
        P(g, x0, y, x1 - x0, 1, st.l); P(g, x0, y, 1, hh - 1, st.l);
        P(g, x1 - 1, y + 1, 1, hh - 2, st.d); P(g, x0 + 1, y + hh - 2, x1 - x0 - 1, 1, st.d);
        if (rnd() < 0.35) P(g, x0 + 2, y + 1, 1, 1, st.h);
      }
      x += sw;
    }
    y += hh;
  }
  P(g, X - 4, stoneTop - 1, Wd + 8, 3, beam.m); P(g, X - 4, stoneTop - 1, Wd + 8, 1, beam.l); P(g, X - 4, stoneTop + 1, Wd + 8, 1, beam.o);

  // windows: cream frames, carved headers, heart shutters, geranium boxes
  for (const [gx, gy] of h.glass) {
    for (const [sx, edge] of [[gx - 6, gx - 3], [gx + 11, gx + 11]]) {
      P(g, sx, gy - 2, 4, 13, roof.m); P(g, sx, gy - 2, 4, 1, roof.l); P(g, sx, gy + 10, 4, 1, roof.d);
      for (let k = 0; k < 4; k++) P(g, sx + k, gy + 4 + k, 1, 1, roof.l);
      P(g, sx + 1, gy + 1, 2, 1, roof.o); P(g, sx + 1, gy + 2, 2, 1, roof.o); P(g, sx + 1, gy + 3, 1, 1, roof.o);
      P(g, edge, gy - 2, 1, 13, roof.o);
    }
    P(g, gx - 2, gy - 2, 13, 13, cream.m); P(g, gx - 2, gy - 2, 13, 1, cream.h); P(g, gx - 2, gy - 2, 1, 13, cream.l);
    P(g, gx + 10, gy - 1, 1, 12, cream.d); P(g, gx - 2, gy + 10, 13, 1, cream.d);
    P(g, gx - 4, gy - 5, 17, 2, beam.m); P(g, gx - 4, gy - 5, 17, 1, beam.l);
    P(g, gx + 1, gy - 7, 7, 2, beam.m); P(g, gx + 3, gy - 8, 3, 1, beam.l);
    P(g, gx, gy, 9, 9, '#1e2a50'); P(g, gx, gy, 9, 2, '#2a3a68');
    for (let i = 0; i < 4; i++) P(g, gx + 1 + i, gy + 6 - i, 1, 1, '#6a8ac8');
    P(g, gx + 6, gy + 1, 1, 1, '#9ab4e0');
    P(g, gx + 4, gy, 1, 9, cream.d); P(g, gx, gy + 4, 9, 1, cream.d);
    if (snow) { P(g, gx - 4, gy - 7, 17, 2, '#ffffff'); P(g, gx - 3, gy + 10, 15, 2, '#ffffff'); continue; }
    if (h.tavern) continue;
    P(g, gx - 3, gy + 11, 15, 3, '#7a4a28'); P(g, gx - 3, gy + 11, 15, 1, '#9a6a3a'); P(g, gx - 3, gy + 13, 15, 1, '#4a2a18');
    for (let i = 0; i < 7; i++) {
      P(g, gx - 2 + i * 2, gy + 9 + (i % 2), 2, 2, i % 3 === 2 ? '#f080a0' : '#e03040');
      if (i % 2 === 0) P(g, gx - 2 + i * 2, gy + 11, 1, 1, '#3a8a3a');
    }
  }

  // arched stone doorway with a Z-braced plank door
  const dr = ramp('#7a4a2a'), qs = ramp('#a8a2aa'), { x: dx, y: dy, w: dw, h: dh } = h.doorHi;
  P(g, dx - 4, dy - 4, dw + 8, dh + 4, mortar);
  for (let y = dy; y < bot; y += 5) {
    for (const qx of [dx - 4, dx + dw]) { P(g, qx, y, 4, 4, qs.m); P(g, qx, y, 4, 1, qs.h); P(g, qx + 3, y + 1, 1, 3, qs.d); }
  }
  P(g, dx - 3, dy - 4, dw + 6, 3, qs.m); P(g, dx - 3, dy - 4, dw + 6, 1, qs.h);
  P(g, dx + (dw >> 1) - 2, dy - 5, 4, 5, qs.l); P(g, dx + (dw >> 1) - 2, dy - 5, 4, 1, qs.h);
  P(g, dx, dy, dw, dh, dr.m);
  for (let x = dx + 3; x < dx + dw; x += 3) P(g, x, dy, 1, dh, dr.d);
  P(g, dx, dy, 1, dh, dr.l);
  for (const sy of [dy + 3, dy + dh - 5]) { P(g, dx, sy, dw, 2, dr.l); P(g, dx, sy + 2, dw, 1, dr.o); }
  line(g, dx + 1, dy + dh - 4, dx + dw - 2, dy + 5, dr.l, 2);
  P(g, dx + dw - 4, dy + (dh >> 1), 2, 2, '#e0b040'); P(g, dx + dw - 4, dy + (dh >> 1) + 2, 2, 1, '#8a6010');
  P(g, dx - 4, bot, dw + 8, 3, qs.m); P(g, dx - 4, bot, dw + 8, 1, qs.h); P(g, dx - 4, bot + 2, dw + 8, 1, qs.d);

  // lantern on an iron bracket
  const { x: lx, y: ly } = h.lantern;
  P(g, lx - 4, ly - 4, 6, 1, '#2a2a34'); P(g, lx - 4, ly - 4, 1, 3, '#2a2a34');
  P(g, lx - 1, ly - 3, 3, 2, '#2a2a34');
  P(g, lx - 3, ly - 1, 7, 1, '#2a2a34'); P(g, lx - 2, ly, 5, 7, '#2a2a34');
  P(g, lx - 1, ly + 1, 3, 4, '#a08048'); P(g, lx - 3, ly + 7, 7, 1, '#2a2a34');

  // wooden shake roof with deep overhang, carved trim and stones holding it down
  const ov = 10;
  for (let y = ridge; y < top; y++) {
    const t = (y - ridge) / (top - ridge);
    const L = Math.round(X + 6 - (6 + ov) * t), R = Math.round(X + Wd - 6 + (6 + ov) * t);
    const fe = top - 1 - y, row = Math.floor(fe / 5), ry = fe % 5;
    for (let x = L; x <= R; x++) {
      let c;
      if (x <= L + 2) c = x === L ? beam.o : beam.l;
      else if (x >= R - 2) c = x === R ? beam.o : beam.m;
      else {
        const ox = x + (row % 2) * 4, col = Math.floor(ox / 8), cx = ox % 8, v = hash2(col, row, h.x);
        c = v < 0.18 ? roof.d : v > 0.86 ? roof.l : roof.m;
        if (ry === 0) c = roof.o;
        else if (ry === 1 || cx === 0) c = roof.d;
        else if (ry === 4 && cx < 6) c = roof.l;
        else if (cx === 2 + Math.floor(v * 4) && ry > 1) c = roof.d;
      }
      P(g, x, y, 1, 1, c);
    }
  }
  P(g, X + 5, ridge - 3, Wd - 10, 4, roof.l); P(g, X + 5, ridge - 3, Wd - 10, 1, roof.h); P(g, X + 5, ridge, Wd - 10, 1, roof.d);
  for (let x = X + 8; x < X + Wd - 8; x += 6) P(g, x, ridge - 3, 1, 4, roof.m);
  P(g, X - ov, top, Wd + ov * 2, 2, beam.m); P(g, X - ov, top, Wd + ov * 2, 1, beam.l);
  for (let x = X - ov; x < X + Wd + ov; x += 4) { P(g, x + 1, top + 2, 2, 1, beam.m); P(g, x + 1, top + 3, 2, 1, beam.o); }
  if (!snow) {
    for (let k = 0; k < Math.round(Wd / 18); k++) {
      const row = 1 + Math.floor(rnd() * 3), y = top - 3 - row * 5;
      const t = (y - ridge) / (top - ridge), L = X + 6 - (6 + ov) * t, R = X + Wd - 6 + (6 + ov) * t;
      const x = Math.round(L + 6 + rnd() * (R - L - 12));
      if (Math.abs(x - (h.chimHi.x + 4)) < 9) continue;
      P(g, x - 2, y + 3, 6, 1, roof.o);
      ellipse(g, x, y, 3, 2, '#8a8690'); P(g, x - 2, y - 2, 3, 1, '#c4c0c8'); P(g, x + 1, y + 1, 2, 1, '#5a5664');
    }
  } else {
    for (let x = X - ov; x < X + Wd + ov; x++) {
      const t = x < X + 6 ? (X + 6 - x) / (6 + ov) : x > X + Wd - 6 ? (x - (X + Wd - 6)) / (6 + ov) : 0;
      if (t >= 1) continue;
      const y0 = Math.round(ridge - 3 + t * 27), depth = 9 + Math.round(vnoise(x * 0.15, 3, h.x) * 6);
      P(g, x, y0, 1, depth, '#f4f8ff'); P(g, x, y0 + depth, 1, 2, '#c8d8f0');
    }
    P(g, X - ov, top - 2, Wd + ov * 2, 2, '#f4f8ff');
    for (let x = X - ov + 2; x < X + Wd + ov - 2; x += 4 + Math.floor(rnd() * 5)) P(g, x, top + 2, 1, 2 + Math.floor(rnd() * 4), '#cfe2f8');
  }

  // stone chimney with a little slate hood
  const { x: cx0, top: ct, bot: cb } = h.chimHi;
  P(g, cx0, ct, 9, cb - ct, mortar);
  for (let y = ct + 1, row = 0; y < cb; y += 3, row++) {
    for (let x = cx0 + (row % 2 ? -1 : 0); x < cx0 + 9; x += 4) {
      const st = stones[(row * 3 + x) % stones.length], x0 = Math.max(cx0, x), x1 = Math.min(cx0 + 9, x + 3);
      P(g, x0, y, x1 - x0, 2, st.m); P(g, x0, y, x1 - x0, 1, st.l);
    }
  }
  P(g, cx0 + 8, ct, 1, cb - ct, mortar);
  const slate = ramp('#5a5e6e');
  P(g, cx0, ct - 4, 2, 4, slate.d); P(g, cx0 + 7, ct - 4, 2, 4, slate.d);
  P(g, cx0 - 2, ct - 6, 13, 2, slate.m); P(g, cx0 - 2, ct - 6, 13, 1, slate.l);
  P(g, cx0, ct - 8, 9, 2, slate.m); P(g, cx0 + 2, ct - 9, 5, 1, slate.l);
  if (snow) P(g, cx0 - 2, ct - 10, 13, 3, '#ffffff');

  if (h.tavern) {
    // wooden balcony across the upper floor
    const fy = h.glass[0][1] + 16, rail = ramp('#7a4a28');
    for (const bx of [X + 6, X + (Wd >> 1) - 2, X + Wd - 10]) { P(g, bx, fy + 3, 4, 2, rail.m); P(g, bx + 1, fy + 5, 2, 2, rail.d); }
    P(g, X - 5, fy, Wd + 10, 3, rail.m); P(g, X - 5, fy, Wd + 10, 1, rail.l); P(g, X - 5, fy + 2, Wd + 10, 1, rail.o);
    for (let x = X - 5; x < X + Wd + 4; x += 4) {
      P(g, x, fy - 5, 3, 5, rail.m); P(g, x, fy - 5, 1, 5, rail.l); P(g, x + 1, fy - 4, 1, 2, rail.o);
    }
    P(g, X - 5, fy - 7, Wd + 10, 2, rail.l); P(g, X - 5, fy - 7, Wd + 10, 1, rail.h);
    if (!snow) {
      for (const [gx] of h.glass) {
        P(g, gx - 2, fy - 4, 13, 3, '#6a3a20');
        for (let i = 0; i < 6; i++) P(g, gx - 1 + i * 2, fy - 6 + (i % 2), 2, 2, i % 3 === 1 ? '#f080a0' : '#e03040');
      }
    } else P(g, X - 5, fy - 9, Wd + 10, 2, '#ffffff');

    // hanging tavern sign with a frothy mug
    P(g, X - 15, top + 13, 16, 2, '#3a3a46'); P(g, X - 15, top + 13, 16, 1, '#6a6a7a');
    P(g, X - 13, top + 15, 1, 3, '#3a3a46'); P(g, X - 4, top + 15, 1, 3, '#3a3a46');
    const sb = ramp('#8a5a30');
    P(g, X - 16, top + 18, 15, 12, sb.m); P(g, X - 16, top + 18, 15, 1, sb.l); P(g, X - 16, top + 29, 15, 1, sb.o);
    P(g, X - 16, top + 18, 1, 12, sb.l); P(g, X - 2, top + 18, 1, 12, sb.d);
    P(g, X - 12, top + 21, 6, 7, '#e0b040'); P(g, X - 12, top + 21, 6, 2, '#ffffff');
    P(g, X - 6, top + 23, 2, 3, '#e0b040'); P(g, X - 12, top + 21, 1, 7, '#f8d870'); P(g, X - 7, top + 23, 1, 5, '#a87820');
  }
}

// Little picket fence across the front yard, open at the door.
function drawYardFence(g, h, snow) {
  const { X, Wd, bot } = h.g, { x: dx, w: dw } = h.doorHi, wd = ramp('#b0844a'), y0 = bot + 4;
  for (const [a, b] of [[X - 6, dx - 7], [dx + dw + 7, X + Wd + 6]]) {
    for (const ry of [y0 - 7, y0 - 3]) { P(g, a, ry, b - a, 2, wd.d); P(g, a, ry, b - a, 1, wd.l); }
    for (let x = a; x <= b - 3; x += 5) {
      P(g, x, y0 - 10, 3, 11, wd.m); P(g, x, y0 - 10, 1, 11, wd.h); P(g, x + 2, y0 - 10, 1, 11, wd.d);
      P(g, x + 1, y0 - 11, 1, 1, wd.m);
      if (snow) P(g, x, y0 - 12, 3, 2, '#ffffff');
    }
    if (!snow) {
      for (let x = a + 2; x < b - 2; x += 7) {
        P(g, x, y0 - 1, 3, 1, '#3a8a3a');
        P(g, x + 1, y0 - 2, 1, 1, ['#f05a6a', '#f8e060', '#ffffff', '#c890f8'][(x >> 3) % 4]);
      }
    }
  }
}

function drawBench(g, x, by, w, snow) {
  const bk = ramp('#6a4428'), top = ramp('#c89a60');
  P(g, x + 2, by - 3, 4, 3, bk.d); P(g, x + w - 6, by - 3, 4, 3, bk.d);
  P(g, x, by - 7, w, 4, bk.m); P(g, x, by - 4, w, 1, bk.d);
  for (let i = x + 3; i < x + w - 3; i += 5) P(g, i, by - 6, 2, 1, bk.o);
  P(g, x, by - 9, w, 2, top.m); P(g, x, by - 9, w, 1, top.l);
  P(g, x + w - 2, by - 8, 2, 4, top.d); P(g, x + w - 1, by - 7, 1, 1, bk.d);
  if (snow) P(g, x, by - 10, w, 2, '#ffffff');
}

function drawLamp(g, x, by) {
  const ir = ramp('#3a3a48');
  P(g, x - 3, by - 3, 7, 3, ir.m); P(g, x - 3, by - 3, 7, 1, ir.l);
  P(g, x - 1, by - 30, 2, 27, ir.m); P(g, x - 1, by - 30, 1, 27, ir.l);
  P(g, x - 3, by - 31, 7, 1, ir.m);
  P(g, x - 3, by - 38, 7, 7, ir.d); P(g, x - 2, by - 37, 5, 5, '#a08048'); P(g, x, by - 37, 1, 5, ir.d);
  P(g, x - 4, by - 39, 9, 1, ir.m); P(g, x - 3, by - 40, 7, 1, ir.m); P(g, x - 1, by - 42, 3, 2, ir.l); P(g, x, by - 43, 1, 1, ir.l);
}

function drawBush(g, cx, by, r, snow) {
  const lf = snow ? ramp('#3a6a50') : ramp('#3a8a38');
  for (const [dx, dy, rr] of [[-0.7, -0.9, 0.7], [0.7, -0.9, 0.7], [0, -1.4, 0.8]]) {
    const x = Math.round(cx + dx * r), y = Math.round(by + dy * r), R = Math.round(rr * r);
    disc(g, x, y, R, lf.d); disc(g, x - 1, y - 1, R - 1, lf.m); disc(g, x - 2, y - 2, Math.max(1, R - 3), snow ? '#ffffff' : lf.l);
  }
  if (!snow) {
    const rnd = mulberry32(cx);
    for (let i = 0; i < 5; i++) P(g, Math.round(cx + (rnd() - 0.5) * r * 2.2), Math.round(by - r * (0.5 + rnd() * 1.4)), 2, 2, rnd() < 0.5 ? '#f05a7a' : '#ffffff');
  }
}

function drawHaystack(g, cx, by, snow) {
  const hy = ramp('#d8b048');
  ellipse(g, cx, by - 7, 13, 7, hy.m); ellipse(g, cx - 3, by - 10, 7, 3, hy.l); P(g, cx - 12, by - 2, 25, 2, hy.d);
  for (let i = 0; i < 9; i++) P(g, cx - 10 + i * 2.5, by - 9 + (i % 3) * 2, 1, 3, i % 2 ? hy.d : hy.h);
  if (snow) ellipse(g, cx - 1, by - 12, 9, 2, '#ffffff');
}

function makeHouse(h, snow) {
  const { X, Wd, top, bot } = h.g, ox = X - 24, oy = top - 50;
  const c = mk(Wd + 64, bot - oy + 12), g = c.getContext('2d');
  g.translate(-ox, -oy);
  drawHouse(g, h, snow);
  drawYardFence(g, h, snow);
  if (h.tavern) { drawBarrel(g, X + Wd + 8, bot + 1); drawCrate(g, X + Wd + 16, bot + 1, 12); drawCrate(g, X + Wd + 18, bot - 11, 10); }
  outline(c);
  return { cv: c, x: ox, y: oy };
}

function drawBarrel(g, cx, by) {
  const b = ramp('#9a6234');
  for (let r = 0; r < 16; r++) {
    const w = r > 2 && r < 13 ? 13 : 11, x0 = cx - (w >> 1);
    for (let c = 0; c < w; c++) {
      const u = c / (w - 1);
      P(g, x0 + c, by - 16 + r, 1, 1, u < 0.2 ? b.l : u > 0.75 ? b.d : c % 3 === 0 ? b.d : b.m);
    }
  }
  for (const r of [3, 12]) { P(g, cx - 6, by - 16 + r, 13, 2, '#4a4a56'); P(g, cx - 6, by - 16 + r, 13, 1, '#8a8a9a'); }
  ellipse(g, cx, by - 16, 5, 1, b.l); P(g, cx - 3, by - 16, 6, 1, b.h);
}

function drawCrate(g, x, by, s) {
  const c = ramp('#a87a44');
  P(g, x, by - s, s, s, c.m); P(g, x, by - s, s, 2, c.l); P(g, x, by - 2, s, 2, c.d);
  P(g, x, by - s, 2, s, c.l); P(g, x + s - 2, by - s, 2, s, c.d);
  line(g, x + 2, by - s + 2, x + s - 3, by - 3, c.d, 2);
  P(g, x + 2, by - (s >> 1), s - 4, 1, c.o);
}

function drawWell(g, snow) {
  const cx = WELL.x * S, by = WELL.y * S - 3, st = ramp('#8a8692'), wd = ramp('#7a5030'), rf = ramp('#9a3a2a');
  const Y = (dy) => by + dy; // offsets measured from the well's base
  P(g, cx - 13, Y(-41), 3, 27, wd.m); P(g, cx - 13, Y(-41), 1, 27, wd.l);
  P(g, cx + 10, Y(-41), 3, 27, wd.m); P(g, cx + 12, Y(-41), 1, 27, wd.d);
  P(g, cx - 10, Y(-32), 20, 2, wd.d); P(g, cx + 13, Y(-34), 2, 6, wd.m); P(g, cx + 15, Y(-29), 3, 2, wd.l);
  P(g, cx, Y(-30), 1, 8, '#d8c090');
  P(g, cx - 3, Y(-22), 7, 5, wd.m); P(g, cx - 3, Y(-20), 7, 1, '#4a4a56'); P(g, cx - 3, Y(-22), 1, 5, wd.l);
  for (let i = 0; i < 12; i++) {
    const y = Y(-49 + i), hw = 4 + Math.round(i * 1.3);
    for (let x = cx - hw; x <= cx + hw; x++) {
      P(g, x, y, 1, 1, snow && i < 5 ? '#f4f8ff' : i % 3 === 2 ? rf.o : x === cx - hw ? rf.l : x < cx ? rf.m : rf.d);
    }
  }
  P(g, cx - 1, Y(-52), 3, 3, snow ? '#ffffff' : rf.l);
  const ty = Y(-15);
  for (let y = ty; y < by; y++) {
    const row = Math.floor((y - ty) / 4), ry = (y - ty) % 4;
    for (let x = cx - 14; x <= cx + 14; x++) {
      const u = (x - cx) / 14;
      let c = ry === 3 || (x + row * 3) % 7 === 0 ? st.o : u < -0.45 ? st.l : u > 0.5 ? st.d : st.m;
      if (ry === 0 && c !== st.o && u < 0.5) c = st.h;
      P(g, x, y, 1, 1, c);
    }
  }
  ellipse(g, cx, ty, 15, 3, st.l);
  ellipse(g, cx, ty, 12, 2, '#1a2238');
  P(g, cx - 6, ty, 5, 1, '#3a5a8a');
  if (snow) ellipse(g, cx - 4, ty - 2, 10, 1, '#ffffff');
}

function drawWoodpile(g, snow) {
  const bk = ramp('#6a4428'), sx = STUMP.x * S, sy = STUMP.y * S - 8;
  P(g, sx - 9, sy, 19, 9, bk.m);
  for (let x = sx - 7; x < sx + 9; x += 3) P(g, x, sy + 1, 1, 8, bk.d);
  P(g, sx - 9, sy, 2, 9, bk.l);
  P(g, sx - 11, sy + 6, 23, 3, bk.m); P(g, sx - 11, sy + 8, 23, 1, bk.d);
  ellipse(g, sx, sy, 9, 2, '#d8b07a'); ellipse(g, sx, sy, 6, 1, '#b88a58'); P(g, sx - 3, sy, 7, 1, '#d8b07a'); P(g, sx, sy, 1, 1, '#8a6040');
  if (snow) ellipse(g, sx, sy - 1, 8, 1, '#ffffff');
  const logEnd = (x, y) => {
    disc(g, x, y, 4, '#5a3a22'); disc(g, x, y, 3, '#d8b07a'); disc(g, x, y, 2, '#b88a58'); disc(g, x, y, 1, '#d8b07a');
    P(g, x, y, 1, 1, '#8a6040'); P(g, x - 2, y - 3, 2, 1, '#f0d098');
  };
  const lx = sx + 16, ly = sy + 1;
  for (const [x, y] of [[0, 0], [9, 0], [18, 0], [4, -8], [13, -8], [9, -16]]) logEnd(lx + x, ly + y);
  if (snow) { P(g, lx + 5, ly - 21, 9, 2, '#ffffff'); P(g, lx - 4, ly - 13, 6, 1, '#ffffff'); P(g, lx + 18, ly - 13, 5, 1, '#ffffff'); }
}

function buildLand(snow) {
  const c = mk(RW, RH), g = c.getContext('2d');
  const im = g.createImageData(RW, RH), d = im.data;
  const kind = new Uint8Array(RW * RH);
  const set = (x, y, col) => { const i = (y * RW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  const C = (arr) => arr.map(hexToRgb);

  // two mountain ranges: lit left faces, shadowed right faces, snowcaps and crevices
  const range = (seed, yBase, hMin, hMax, pal, capDepth) => {
    const rr = mulberry32(seed), peaks = [];
    for (let x = -60; x < RW + 60; x += 50 + rr() * 60) peaks.push({ x, top: yBase - hMin - rr() * (hMax - hMin), s: 0.7 + rr() * 0.4 });
    const [rl, rd, rc, sl, sd, hz] = C(pal);
    for (let x = 0; x < RW; x++) {
      let pk = null, best = 1e9;
      for (const k of peaks) {
        const y = k.top + Math.abs(x - k.x) * k.s + vnoise(x * 0.2, k.x, seed) * 3;
        if (y < best) { best = y; pk = k; }
      }
      const top = Math.max(0, Math.round(best)), lit = x < pk.x;
      const cap = capDepth + vnoise(x * 0.18, 1, seed + 1) * 8 - (snow ? -6 : 0);
      for (let y = top; y < HZ; y++) {
        const depth = y - pk.top, under = y - best;
        let col;
        if (depth < cap) col = lit ? sl : sd;
        else {
          col = lit ? rl : rd;
          const k = lit ? (x + y * 0.9) : (x - y * 0.9);
          if (under > 3 && ((k % 17) + 17) % 17 < 1.3 && vnoise(x * 0.1, y * 0.1, seed + 2) > 0.45) col = rc;
          if (depth < cap + 3 && bayer(x, y) < 0.5) col = lit ? sl : sd;
        }
        if (under < 1 && !lit && depth >= cap) col = rc;
        if ((y - (HZ - 30)) / 30 > bayer(x, y) + 0.1) col = hz;
        set(x, y, col);
      }
    }
  };
  range(41, HZ - 34, 38, 72, snow
    ? ['#c4d0e8', '#9aaacb', '#8494b8', '#ffffff', '#d4e0f4', '#c8d4ea']
    : ['#9eb0d0', '#7688b0', '#66769e', '#f0f6ff', '#c2d2ec', '#b0c0dc'], 14);
  range(42, HZ - 22, 20, 44, snow
    ? ['#b0c0dc', '#8494b8', '#6e7ea4', '#ffffff', '#d0dcf0', '#bccae2']
    : ['#8a9cc2', '#5e6c96', '#4c5884', '#eef4ff', '#b8c8e4', '#a8b8d8'], 9);

  // mid hills crowned with pines
  const hill = C(snow ? ['#c4d2e6', '#dce6f4'] : ['#3c765a', '#54926a']);
  const pine = C(snow ? ['#5a7a90', '#e8f0fa'] : ['#2a5a44', '#3f7656']);
  const mh = (x) => HZ - 24 + 6 * Math.sin(x * 0.011 + 0.5) + 4 * vnoise(x * 0.03, 0.2, 15);
  const pineTop = new Float32Array(RW).fill(1e9), pineLit = new Uint8Array(RW);
  const R = mulberry32(5);
  for (let px = -10; px < RW + 10; px += 4 + R() * 6) {
    const ht = 10 + R() * 14, hw = ht * 0.32, top = mh(px) + 2 - ht;
    for (let x = Math.floor(px - hw); x <= Math.ceil(px + hw); x++) {
      if (x < 0 || x >= RW) continue;
      const yy = top + (Math.abs(x - px) / hw) * ht + (hash2(x, 3, 16) < 0.3 ? 1 : 0);
      if (yy < pineTop[x]) { pineTop[x] = yy; pineLit[x] = x < px ? 1 : 0; }
    }
  }
  for (let x = 0; x < RW; x++) {
    const ht = Math.round(mh(x)), pt = Math.round(pineTop[x]);
    for (let y = Math.max(0, Math.min(pt, ht)); y < HZ; y++) {
      if (y < ht) set(x, y, pineLit[x] ? pine[1] : pine[0]);
      else set(x, y, y - ht < 2 || (hash2(x, y, 17) < 0.06) ? hill[1] : hill[0]);
    }
  }

  // near hills
  const nh = (x) => HZ - 11 + 5 * Math.sin(x * 0.017 + 2) + 3 * vnoise(x * 0.05, 0.7, 17);
  const near = C(snow ? ['#d4e0f0', '#ffffff', '#b8c8dc'] : ['#4c8c46', '#6cae54', '#3c7638']);
  for (let x = 0; x < RW; x++) {
    const ht = Math.round(nh(x));
    for (let y = ht; y < HZ; y++) set(x, y, y - ht < 2 ? near[1] : (y - ht) / (HZ - ht) > 0.6 + bayer(x, y) * 0.4 ? near[2] : near[0]);
  }

  // ground: grass, cobbled street, flagstone square, pond and farm soil
  const pale = (arr) => (snow ? arr.map((c) => c.map((v) => v + (255 - v) * 0.3)) : arr);
  const grass = C(snow ? ['#bccbe0', '#d4e0ee', '#e8f0f8', '#ffffff'] : ['#468434', '#5a9e40', '#70b44c', '#88c85c']);
  const dirt = C(snow ? ['#9a948e', '#b4aea6', '#ccc6be', '#e0dcd6'] : ['#86603c', '#a87e50', '#c49a64', '#d8b47c']);
  const soil = C(snow ? ['#8a8490', '#a8a2ac', '#c4c0c8', '#e4e4ec'] : ['#4e3020', '#6a4228', '#845634', '#9a6a42']);
  const water = C(snow ? ['#9ab8d0', '#b8d0e4', '#d4e6f4', '#ffffff'] : ['#24527e', '#2f6a9e', '#4a8cc4', '#9ad4f4']);
  const cob = [
    pale(C(['#7e7468', '#948a7c', '#a69c8c', '#bab0a0'])),
    pale(C(['#86786a', '#9c8e7c', '#ae9f8a', '#c2b49e'])),
    pale(C(['#767272', '#8a8684', '#9c9894', '#b0aca6'])),
  ];
  const flag = [
    pale(C(['#7a6a56', '#9a8a72', '#b8a88c', '#d4c6a8'])),
    pale(C(['#6e6a66', '#8c8882', '#aaa69e', '#c8c4bc'])),
    pale(C(['#80705e', '#a08e78', '#bca890', '#d8c8ae'])),
  ];
  const mortar = hexToRgb(snow ? '#e4eaf2' : '#7a6246'), ash = C(['#3a3238', '#4a4048', '#5a4e52']);
  const en = (v, s) => Math.round(vnoise(v * 0.25, s, 41) * 3);
  const FX = FIRE.x * S, FPY = FIRE.y * S;
  // paths as hi-res segments, bucketed by column for quick distance checks
  const segs = [];
  for (const p of PATHS) for (let i = 1; i < p.line.length; i++) segs.push([p.line[i - 1][0] * S, p.line[i - 1][1] * S, p.line[i][0] * S, p.line[i][1] * S, p.kind]);
  const cols = Array.from({ length: RW }, () => []);
  for (const sg of segs) {
    const x0 = Math.max(0, Math.floor(Math.min(sg[0], sg[2]) - 16)), x1 = Math.min(RW - 1, Math.ceil(Math.max(sg[0], sg[2]) + 16));
    for (let x = x0; x <= x1; x++) cols[x].push(sg);
  }
  const segDist = (x, y, [ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  };
  // half-widths; edges wobble so paths look trodden rather than drawn
  const HW = { main: 11, lane: 7.5, path: 5.5, foot: 3.2 };
  const pathAt = (x, y) => {
    let out = null;
    const wob = 0.8 + 0.4 * vnoise(x * 0.07, y * 0.07, 44);
    for (const sg of cols[x]) {
      const d = segDist(x, y, sg), hw = HW[sg[4]] * wob;
      if (d >= hw) continue;
      if ((sg[4] === 'main' || sg[4] === 'lane') && d < hw - 2.5 - en(x + y, 2) * 0.7) return 'cob';
      out = sg[4] === 'foot' ? (out || 'foot') : 'dirt';
    }
    return out;
  };
  const isSoil = (x, y) => x >= FARM.x0 && x < FARM.x1 && y >= FARM.y0 && y < FARM.y1;
  const region = (x, y) => {
    if (isSoil(x, y)) return 'soil';
    const pd = ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2;
    if (pd <= 1) return 'water';
    if (pd <= 1.35) return 'shore';
    if (((x - FX) / 19) ** 2 + ((y - FPY - 2) / 8.5) ** 2 <= 1) return 'pit';
    const pz = ((x - FX) / 66) ** 2 + ((y - FPY - 4) / 30) ** 2;
    if (pz <= 0.86) return 'flag';
    if (pz <= 1) return 'dirt';
    const pa = pathAt(x, y);
    if (pa === 'foot') return hash2(x, y, 45) < 0.18 ? 'grass' : 'dirt';
    return pa || 'grass';
  };
  // Cellular stones: nearest jittered point decides the stone, the gap to the next one is mortar.
  const vor = (x, y, sx, sy, seed) => {
    const nx = x / sx, ny = y / sy, gx = Math.floor(nx), gy = Math.floor(ny);
    let d1 = 9, d2 = 9, cx = 0, cy = 0, id = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const px = gx + i + 0.2 + hash2(gx + i, gy + j, seed) * 0.6, py = gy + j + 0.2 + hash2(gx + i, gy + j, seed + 7) * 0.6;
        const d = (nx - px) ** 2 + (ny - py) ** 2;
        if (d < d1) { d2 = d1; d1 = d; cx = px; cy = py; id = hash2(gx + i, gy + j, seed + 3); } else if (d < d2) d2 = d;
      }
    }
    return { e: (Math.sqrt(d2) - Math.sqrt(d1)) * Math.min(sx, sy), lit: -((nx - cx) * 0.6 + (ny - cy) * 0.8), id };
  };
  const stone = (x, y, sx, sy, seed, pals) => {
    const c = vor(x, y, sx, sy, seed);
    if (c.e < 1) return mortar;
    const pal = pals[Math.floor(c.id * pals.length)];
    if (c.e < 2.2) return pal[c.lit > 0 ? 3 : 0];
    let l = c.lit > 0.08 ? 2 : 1;
    if (c.id > 0.88) l -= 1;
    if (hash2(x, y, seed) < 0.06) l = Math.max(0, l - 1);
    return pal[l];
  };
  const lv = (v) => Math.max(0, Math.min(3, v));
  for (let y = HZ; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      const r = region(x, y), k = y * RW + x;
      let col;
      if (r === 'soil') {
        const ph = (y - FARM.y0) % 6, base = ph < 2 ? 3 : ph < 4 ? 2 : ph < 5 ? 1 : 0;
        col = soil[lv(Math.round(base + (vnoise(x * 0.2, y * 0.2, 23) - 0.5) * 1.4 + bayer(x, y) - 0.5))];
        kind[k] = 4;
      } else if (r === 'cob') {
        // cobbles worn through to dirt in patches
        const worn = vnoise(x * 0.04, y * 0.12, 26) + (hash2(x, y, 27) - 0.5) * 0.12;
        if (worn > 0.66) { col = dirt[worn > 0.72 ? 1 : 0]; kind[k] = 3; }
        else { col = stone(x, y, 6, 4, 51, cob); kind[k] = 5; }
      }
      else if (r === 'flag') { col = stone(x, y, 15, 9, 52, flag); kind[k] = 6; }
      else if (r === 'pit') { col = ash[lv(Math.floor(vnoise(x * 0.3, y * 0.5, 24) * 3 + bayer(x, y) - 0.5)) % 3]; kind[k] = 7; }
      else if (r === 'water') {
        const pd = ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2;
        let l = pd > 0.7 ? 1 : 0;
        if (vnoise(x * 0.12, y * 0.7, 25) > 0.7) l = 2;
        if (y - POND.y < -POND.ry * 0.55 && pd > 0.45) l = 3;
        col = water[l];
        kind[k] = 8;
      } else if (r === 'shore') { col = dirt[(x + y) % 3 ? 0 : 1]; kind[k] = 3; }
      else if (r === 'dirt') {
        const v = vnoise(x * 0.08, y * 0.15, 21) * 0.7 + vnoise(x * 0.3, y * 0.5, 22) * 0.3;
        col = dirt[lv(Math.floor(v * 3.4 + bayer(x, y) - 0.6))];
        kind[k] = 3;
      } else {
        const v = vnoise(x * 0.045, y * 0.09, 31) * 0.6 + vnoise(x * 0.16, y * 0.3, 32) * 0.4;
        col = grass[lv(Math.floor(v * 3.6 + bayer(x, y) - 0.9))];
        kind[k] = 2;
      }
      set(x, y, col);
    }
  }
  g.putImageData(im, 0, 0);
  const K = (x, y) => kind[(y | 0) * RW + (x | 0)];
  const hexG = snow ? ['#b8c8dc', '#ffffff'] : ['#3a7a2c', '#9ad86a'];

  // tufts, wildflower patches, mushrooms, pebbles
  const R2 = mulberry32(9);
  for (let i = 0; i < 360; i++) {
    const x = Math.floor(R2() * (RW - 6)), y = HZ + 4 + Math.floor(R2() * (RH - HZ - 8));
    if (K(x, y) !== 2 || K(x + 4, y) !== 2 || K(x, y + 3) !== 2) continue;
    tpl(g, ['.l..l', 'lml.l', 'mmlml'], x, y, { l: hexG[1], m: hexG[0] });
  }
  if (!snow) {
    for (let p = 0; p < 14; p++) {
      const px = 10 + R2() * (RW - 20), py = HZ + 10 + R2() * (RH - HZ - 14), col = pick(['#f05a6a', '#f8e060', '#ffffff', '#c890f8', '#f8a040']);
      for (let i = 0; i < 7; i++) {
        const x = Math.round(px + rand(-9, 9)), y = Math.round(py + rand(-4, 4));
        if (K(x, y) !== 2 || K(x, y + 3) !== 2) continue;
        P(g, x, y + 2, 1, 2, '#3a7a2c'); P(g, x - 1, y, 3, 1, col); P(g, x, y - 1, 1, 3, col); P(g, x, y, 1, 1, '#f8d030');
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(R2() * RW), y = HZ + 8 + Math.floor(R2() * (RH - HZ - 10));
      if (K(x, y) !== 2 || K(x + 4, y + 3) !== 2) continue;
      P(g, x + 1, y + 2, 2, 2, '#f0e8d8'); P(g, x, y, 4, 2, '#d83a2a'); P(g, x + 1, y - 1, 2, 1, '#d83a2a'); P(g, x + 1, y, 1, 1, '#ffffff');
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(R2() * (RW - 4)), y = HZ + Math.floor(R2() * (RH - HZ - 3));
    if (K(x, y) !== 3 || K(x + 3, y + 2) !== 3) continue;
    P(g, x, y, 3, 2, '#8a8478'); P(g, x, y, 2, 1, '#c8c0b0'); P(g, x + 1, y + 2, 3, 1, '#5a5040');
  }


  // pond: lily pads, cattails, shore rocks (frozen in winter)
  if (snow) {
    for (let i = 0; i < 5; i++) P(g, POND.x - 14 + i * 6, POND.y - 3 + (i % 3) * 2, 5, 1, '#ffffff');
  } else {
    for (const [lx, ly, fl] of [[-10, -1, true], [-3, 3, false], [8, -2, false], [12, 2, true]]) {
      ellipse(g, POND.x + lx, POND.y + ly, 3, 1, '#3a9a3a'); P(g, POND.x + lx - 2, POND.y + ly - 1, 2, 1, '#6aca5a'); P(g, POND.x + lx + 1, POND.y + ly, 2, 1, '#2a6a2a');
      if (fl) { P(g, POND.x + lx, POND.y + ly - 2, 2, 2, '#f8a0c0'); P(g, POND.x + lx, POND.y + ly - 2, 1, 1, '#ffffff'); }
    }
  }
  for (const [rx, h] of [[-22, 10], [-20, 7], [-18, 12], [19, 9], [21, 13], [23, 8]]) {
    const x = POND.x + rx, y = POND.y + 2;
    P(g, x, y - h, 1, h, snow ? '#8a9a8a' : '#4a8a30');
    if (h > 9) { P(g, x, y - h - 1, 2, 4, snow ? '#e0e8f0' : '#6a4020'); P(g, x, y - h + 3, 1, 2, '#4a8a30'); }
  }
  for (const [rx, ry] of [[-17, 6], [15, 7], [-6, 9], [5, -9]]) {
    const x = POND.x + rx, y = POND.y + ry;
    ellipse(g, x, y, 3, 2, '#8a8690'); P(g, x - 2, y - 2, 3, 1, snow ? '#ffffff' : '#c0bcc4'); P(g, x - 1, y + 2, 4, 1, '#4a4654');
  }

  // fire pit: ash bed, embers, crossed logs inside a ring of stones
  for (let i = 0; i < 14; i++) P(g, FX - 8 + Math.floor(R2() * 16), FPY - 1 + Math.floor(R2() * 6), 1, 1, R2() < 0.5 ? '#c84a20' : '#7a2a18');
  line(g, FX - 10, FPY + 5, FX + 10, FPY - 2, '#6a4428', 3); line(g, FX - 10, FPY - 2, FX + 10, FPY + 5, '#5a3820', 3);
  P(g, FX - 11, FPY - 3, 3, 3, '#2a1a18'); P(g, FX + 9, FPY + 4, 3, 3, '#2a1a18');
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, sx = Math.round(FX + Math.cos(a) * 20), sy = Math.round(FPY + 3 + Math.sin(a) * 8.5);
    ellipse(g, sx, sy + 1, 4, 3, '#2a2630');
    ellipse(g, sx, sy, 4, 3, i % 3 ? '#8a8690' : '#968c84');
    P(g, sx - 2, sy - 2, 4, 1, snow ? '#ffffff' : '#c8c4cc'); P(g, sx - 3, sy - 1, 1, 2, '#b0acb6'); P(g, sx - 2, sy + 2, 5, 1, '#5a5664');
  }

  drawPatio(g, snow);
  drawAmphitheater(g, snow);

  drawBackFarm(g, snow);

  // trees behind the houses
  const tree = (x, y, r, seed) => {
    const t = makeTree(r, seed, snow), X = x * S, Y = y * S;
    g.fillStyle = 'rgba(16,40,20,0.3)';
    ellipse(g, X, Y, Math.round(t.r * 0.8), 3, 'rgba(16,40,20,0.3)');
    g.drawImage(t.cv, X - t.ax, Y - t.ay);
  };
  [[40, 72, 6], [134, 70, 6], [160, 70, 5], [228, 70, 6], [-2, 78, 6], [88, 64, 5]].forEach(([x, y, r], i) => tree(x, y, r, 100 + i));

  // buildings and props share one outlined layer
  const lay = mk(RW, RH), lg = lay.getContext('2d');
  drawWell(lg, snow);
  drawBackFence(lg, snow);
  drawScarecrow(lg, FARM.x1 - 16, FARM.y0 + 18, snow);
  drawWoodpile(lg, snow);
  drawBench(lg, FX - 18, FPY - 20, 36, snow); drawBench(lg, FX - 70, FPY + 21, 20, snow); drawBench(lg, FX + 50, FPY + 23, 20, snow);
  for (const [lx, ly] of LAMPS) drawLamp(lg, lx, ly);
  for (const [bx, byy, br] of [[156, 334, 6], [376, 340, 6], [424, 376, 7], [508, 376, 6], [250, 288, 5], [470, 250, 6], [660, 300, 6], [92, 248, 5]]) drawBush(lg, bx, byy, br, snow);
  drawHaystack(lg, FARM.x0 - 14, FARM.y1 + 2, snow);
  drawCoffeeCart(lg, snow);
  drawMenuBoard(lg, PATIO.x0 - 10, PATIO.y0 + 8, snow);
  for (const [tx, ty] of TABLES) { drawStool(lg, tx - 13, ty + 2); drawStool(lg, tx + 13, ty + 2); }
  for (const [x, y] of STOOLS) drawStool(lg, x, y);
  outline(lay);
  g.drawImage(lay, 0, 0);

  // trees in front
  [[221, 106, 6]].forEach(([x, y, r], i) => tree(x, y, r, 200 + i));
  return c;
}

// Puffy cumulus: a row of overlapping domes on a flat base, lit from the upper left
// and shaded in clean bands (no dithering) for a smooth arcade look.
function makeCloud(w, seed, pal) {
  const rnd = mulberry32(seed);
  const n = 3 + Math.round(w / 22), cl = [];
  let maxR = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, r = w * (0.17 + rnd() * 0.07) * (1.15 - Math.abs(u - 0.5) * 1.1);
    cl.push({ x: 2 + u * w, r });
    maxR = Math.max(maxR, r);
  }
  const h = Math.round(maxR * 1.6) + 6, cw = Math.round(w + maxR) + 4, base = h - 3, ox = Math.round(maxR / 2);
  for (const k of cl) { k.x += ox; k.y = base - k.r * (0.55 + rnd() * 0.3); }
  const c = mk(cw, h), g = c.getContext('2d'), im = g.createImageData(cw, h), d = im.data;
  const cols = pal.map(hexToRgb);
  for (let y = 0; y <= base; y++) {
    for (let x = 0; x < cw; x++) {
      let v = -1, edge = false;
      for (const k of cl) {
        const nx = (x - k.x) / k.r, ny = (y - k.y) / k.r, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const vv = 0.62 - 0.5 * (nx * 0.45 + ny * 0.9) - d2 * 0.12;
        if (vv > v) { v = vv; edge = d2 > 0.8 && ny > 0.3; }
      }
      if (v < 0) continue;
      const fromBase = base - y;
      let lvl = v > 0.86 ? 3 : v > 0.56 ? 2 : v > 0.3 ? 1 : 0;
      if (fromBase < 3) lvl = 0;
      else if (fromBase < 6) lvl = Math.min(lvl, 1);
      if (edge && lvl > 1) lvl = 1;
      const col = cols[lvl], i = (y * cw + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ---------- amphitheater ---------- */

// Low grassy terraces with fieldstone faces and log benches, painted straight onto the
// ground (no outline) so they sit in the meadow rather than on top of it.
function drawAmphitheater(g, snow) {
  const st = ramp('#8e8a84'), bark = ramp('#6a4428'), wood = ramp('#c09060');
  const turf = snow ? ['#d4e0ee', '#e8f0f8', '#ffffff'] : ['#5a9e40', '#70b44c', '#88c85c'];
  const stamps = [];
  AMPHI.tiers.forEach((rx, t) => {
    const ry = rx * AMPHI.squash;
    for (let a = AMPHI.a0; a <= AMPHI.a1; a += 1.5) {
      const r = (a * Math.PI) / 180;
      stamps.push({ x: Math.round(AMPHI.x + rx * Math.cos(r)), y: Math.round(AMPHI.y + ry * Math.sin(r)), i: stamps.length });
    }
  });
  stamps.sort((p, q) => p.y - q.y);
  for (const { x, y } of stamps) {
    for (let yy = y - 10; y - yy > 5; yy++) for (let xx = x - 3; xx <= x + 3; xx++) P(g, xx, yy, 1, 1, turf[(xx + yy) % 3 ? 1 : (yy < y - 8 ? 2 : 0)]);
    P(g, x - 3, y - 5, 7, 5, st.m); P(g, x - 3, y - 5, 7, 1, st.l); P(g, x - 3, y - 1, 7, 1, st.d);
    if ((x + y) % 5 === 0) P(g, x, y - 4, 1, 3, st.d);
  }
  for (const { x, y, i } of stamps) {
    if (i % 7 === 0) continue;
    P(g, x - 3, y - 9, 7, 2, bark.m); P(g, x - 3, y - 9, 7, 1, wood.m);
    if (snow) P(g, x - 3, y - 10, 7, 1, '#ffffff');
  }
  const tuft = snow ? ['#b8c8dc', '#ffffff'] : ['#3a7a2c', '#9ad86a'];
  for (const { x, y, i } of stamps) {
    if (i % 4) continue;
    tpl(g, ['.l.l.', 'lmlml'], x - 2, y - 2, { l: tuft[1], m: tuft[0] });
  }
  for (const [lx, ly] of amphiLanterns()) {
    P(g, lx - 1, ly + 3, 2, 14, bark.m); P(g, lx - 1, ly + 3, 1, 14, bark.l);
    P(g, lx - 1, ly - 1, 5, 2, bark.d);
    P(g, lx + 1, ly + 2, 4, 5, '#2a2a34'); P(g, lx + 2, ly + 3, 2, 3, '#a08048');
  }
}

function amphiLanterns() {
  return [AMPHI.a0 - 7, AMPHI.a1 + 5].map((deg) => {
    const t = (deg * Math.PI) / 180, rx = AMPHI.tiers[AMPHI.tiers.length - 1] + 4;
    return [Math.round(AMPHI.x + rx * Math.cos(t)), Math.round(AMPHI.y + rx * AMPHI.squash * Math.sin(t)) - 17];
  });
}

// Rustic screen at the left of the scene: a slanted panel turned toward the seats, on a low deck.
// All diagonals follow stairY so the pixel steps are even.
function makeStage(snow) {
  const ox = -8, oy = 262, c = mk(84, 100), g = c.getContext('2d'), Q = SCREEN_Q;
  const X = (x) => x - ox, Y = (y) => y - oy;
  const bark = ramp('#6a4428'), plank = ramp('#9a7a58'), deck = ramp('#a88a64'), st = ramp('#8a8680'), roof = ramp('#8a5a34');
  const topAt = (x) => stairY(x, Q.ltop), botAt = (x) => stairY(x, Q.lbot);
  // deck: a parallelogram whose back edge runs under the panel and whose sides step forward 2:1
  const x0 = Q.lx - 6, x1 = Q.rx + 6, depth = 10, back = (x) => stairY(x, Q.lbot + 3);
  for (let x = x0; x <= x1 + depth; x++) {
    const top = x <= x1 ? back(x) : back(x1) + Math.floor((x - x1) / 2);
    const bot = x >= x0 + depth ? back(x - depth) + depth / 2 : back(x0) + Math.floor((x - x0) / 2);
    if (bot <= top) continue;
    P(g, X(x), Y(top), 1, bot - top, snow ? '#e8eef6' : deck.l);
    for (let k = 1; k < 3; k++) { const y = top + Math.round(((bot - top) * k) / 3); P(g, X(x), Y(y), 1, 1, deck.m); }
    // front face and fieldstone footing below the front edge
    if (x >= x0 + depth - 1 || x === x0) {
      P(g, X(x), Y(bot), 1, 3, deck.d);
      P(g, X(x), Y(bot + 3), 1, 4, (x + Math.floor(bot / 1)) % 7 === 0 ? st.d : st.m);
      P(g, X(x), Y(bot + 3), 1, 1, st.l);
    }
    if (x > x1) { P(g, X(x), Y(bot), 1, 3, st.d); P(g, X(x), Y(bot + 3), 1, 4, st.o); }
  }
  // plank backing inside the panel
  for (let x = Q.lx; x <= Q.rx; x++) {
    const t = topAt(x), b = botAt(x);
    P(g, X(x), Y(t), 1, b - t, x % 4 === 0 ? plank.d : x % 4 === 1 ? plank.l : plank.m);
    if ((x - Q.lx) % 10 === 4) P(g, X(x), Y(t + 22), 3, 1, plank.o);
  }
  // posts: the far one behind, the near one in front wrapped in ivy
  P(g, X(Q.rx + 1), Y(Q.rtop - 6), 3, Q.rbot - Q.rtop + 10, bark.m); P(g, X(Q.rx + 3), Y(Q.rtop - 6), 1, Q.rbot - Q.rtop + 10, bark.d);
  P(g, X(Q.lx - 4), Y(Q.ltop - 7), 4, Q.lbot - Q.ltop + 11, bark.m); P(g, X(Q.lx - 4), Y(Q.ltop - 7), 1, Q.lbot - Q.ltop + 11, bark.l);
  for (let y = Q.ltop - 3; y < Q.lbot; y += 6) P(g, X(Q.lx - 3 + ((y >> 2) % 2)), Y(y), 1, 3, bark.o);
  if (!snow) for (let y = Q.ltop + 18; y < Q.lbot + 2; y += 3) P(g, X(Q.lx - 3 + Math.round(Math.sin(y * 0.5))), Y(y), 2, 2, y % 2 ? '#3a8a3a' : '#5aaa48');
  // log beam with a shingled cap, stepping exactly with the panel
  for (let x = Q.lx - 6; x <= Q.rx + 5; x++) {
    const y = topAt(x) - 3;
    P(g, X(x), Y(y), 1, 3, bark.m); P(g, X(x), Y(y), 1, 1, bark.l); P(g, X(x), Y(y + 2), 1, 1, bark.d);
    for (let k = 1; k <= 4; k++) {
      const col = snow && k > 2 ? '#f4f8ff' : k === 4 ? roof.l : (Math.floor((x - Q.lx) / 6) + k) % 2 && (x - Q.lx) % 6 === 0 ? roof.o : roof.m;
      P(g, X(x), Y(y - k), 1, 1, col);
    }
  }
  P(g, X(Q.lx - 7), Y(topAt(Q.lx - 7) - 3), 2, 3, '#d8b07a');
  // the rolled-up canvas under the beam
  for (let x = Q.lx; x <= Q.rx; x++) { const y = topAt(x); P(g, X(x), Y(y), 1, 1, '#f8f2e2'); P(g, X(x), Y(y + 1), 1, 1, '#d8ccb0'); }
  if (!snow) {
    const px = x0 + depth - 3, py = back(x0) + depth / 2;
    P(g, X(px), Y(py - 6), 7, 5, '#b0603e'); P(g, X(px), Y(py - 6), 7, 1, '#c87a52');
    for (let k = 0; k < 4; k++) P(g, X(px + k * 2), Y(py - 9 + (k % 2)), 2, 2, k % 2 ? '#f0d040' : '#e85a6a');
  }
  outline(c);
  return { cv: c, x: ox, y: oy };
}

function drawBackFarm(g, snow) {
  const CAB = ['.ggg.', 'gGHGg', 'gGGGd', '.ddd.'];
  const CAR = ['H.H', '.g.', '.o.'];
  for (let k = 0; k < 5; k++) {
    const yb = FARM.y0 + 6 * k + 3;
    for (let cx = FARM.x0 + 4 + (k % 2) * 4; cx < FARM.x1 - 3; cx += 8) {
      if (snow) { P(g, cx - 2, yb - 1, 4, 1, '#ffffff'); continue; }
      if (k === 0) {
        P(g, cx, yb - 9, 1, 9, '#3a8a30'); P(g, cx + 1, yb - 5, 2, 1, '#5aaa40');
        P(g, cx - 1, yb - 12, 3, 3, '#f8c830'); P(g, cx, yb - 11, 1, 1, '#7a4a20'); P(g, cx - 2, yb - 11, 1, 1, '#f8c830'); P(g, cx + 2, yb - 11, 1, 1, '#f8c830');
      } else if (k % 2) tpl(g, CAB, cx - 2, yb - 3, { G: '#5cb040', H: '#b0e878', g: '#3a8030', d: '#265a24' });
      else tpl(g, CAR, cx - 1, yb - 2, { H: '#8ad860', g: '#3a8a30', o: '#e07a28' });
    }
  }
}

function drawBackFence(g, snow) {
  const wd = ramp('#8a6038'), y = FARM.y1 + 2;
  for (const ry of [y, y + 3]) { P(g, FARM.x0 - 2, ry, FARM.x1 - FARM.x0 + 4, 1, wd.m); }
  for (let x = FARM.x0 - 2; x <= FARM.x1 + 2; x += 9) { P(g, x, y - 3, 2, 8, wd.m); P(g, x, y - 3, 1, 8, wd.l); if (snow) P(g, x, y - 4, 2, 1, '#ffffff'); }
}

function drawScarecrow(g, x, by, snow) {
  P(g, x - 1, by - 22, 2, 22, '#7a5030');
  P(g, x - 8, by - 17, 16, 2, '#7a5030');
  P(g, x - 4, by - 18, 8, 8, '#c04a3a'); P(g, x - 4, by - 18, 2, 8, '#d86a5a'); P(g, x - 2, by - 14, 2, 2, '#e0b040');
  P(g, x - 10, by - 17, 2, 3, '#e8d070'); P(g, x + 8, by - 17, 2, 3, '#e8d070');
  disc(g, x, by - 22, 3, '#d8c090'); P(g, x - 1, by - 23, 1, 1, '#3a2418'); P(g, x + 1, by - 23, 1, 1, '#3a2418');
  P(g, x - 5, by - 25, 11, 2, '#e0bc5c'); P(g, x - 3, by - 28, 7, 3, '#e0bc5c'); P(g, x - 3, by - 26, 7, 1, '#c83a2a');
  if (snow) P(g, x - 5, by - 29, 11, 2, '#ffffff');
}

/* ---------- café ---------- */

// Terracotta brick patio under the café tables.
function drawPatio(g, snow) {
  const { x0, x1, y0 } = PATIO;
  const br = [ramp(snow ? '#c8b4b0' : '#b0603e'), ramp(snow ? '#d0bcb8' : '#c0704a'), ramp(snow ? '#c4aca4' : '#a4583a')];
  const mortar = snow ? '#e8eef6' : '#7a5a44';
  P(g, x0, y0, x1 - x0, RH - y0, mortar);
  for (let y = y0 + 1, row = 0; y < RH; y += 4, row++) {
    for (let x = x0 - (row % 2) * 4; x < x1; x += 8) {
      const a = Math.max(x, x0), b = Math.min(x + 7, x1);
      const r = br[Math.floor(hash2(x, row, 61) * 3)];
      if (b - a < 2) continue;
      P(g, a, y, b - a, 3, r.m); P(g, a, y, b - a, 1, r.l); P(g, b - 1, y + 1, 1, 2, r.d);
    }
  }
  P(g, x0 - 2, y0 - 2, x1 - x0 + 4, 2, snow ? '#ffffff' : '#8a8690');
  P(g, x0 - 2, y0 - 2, 2, RH - y0 + 2, snow ? '#ffffff' : '#8a8690');
  P(g, x1, y0 - 2, 2, RH - y0 + 2, snow ? '#ffffff' : '#8a8690');
}

function drawCoffeeCart(g, snow) {
  const { x, by } = CART, wd = ramp('#8a5a30'), body = ramp('#f0e2c0'), trim = ramp('#2f8a8a'), chrome = ramp('#a8b0bc');
  // awning poles and striped scalloped awning
  P(g, x - 21, by - 46, 2, 30, '#5a5a66'); P(g, x + 19, by - 46, 2, 30, '#5a5a66');
  for (let r = 0; r < 8; r++) {
    for (let i = x - 26; i < x + 26; i++) {
      const stripe = Math.floor((i - x + 26) / 5) % 2;
      P(g, i, by - 54 + r, 1, 1, stripe ? (r < 2 ? '#fff8ec' : '#f0e6d6') : (r < 2 ? '#e86a5a' : '#d04a40'));
    }
  }
  for (let i = 0; i < 10; i++) {
    const sx = x - 26 + i * 5 + 2, col = i % 2 ? '#f0e6d6' : '#d04a40';
    P(g, sx - 2, by - 46, 5, 1, col); P(g, sx - 1, by - 45, 3, 1, col);
  }
  P(g, x - 27, by - 55, 54, 1, '#5a3a30');
  // espresso machine, cups and a bean jar on the counter
  P(g, x - 4, by - 33, 11, 9, chrome.m); P(g, x - 4, by - 33, 11, 1, chrome.h); P(g, x + 6, by - 33, 1, 9, chrome.d);
  P(g, x - 2, by - 30, 2, 2, '#e04040'); P(g, x + 2, by - 30, 2, 2, '#40c070'); P(g, x, by - 27, 3, 2, '#3a3a46');
  P(g, x - 14, by - 27, 3, 3, '#ffffff'); P(g, x - 10, by - 27, 3, 3, '#ffffff'); P(g, x - 12, by - 30, 3, 3, '#ffffff');
  P(g, x + 11, by - 30, 5, 6, '#c8e4f0'); P(g, x + 12, by - 27, 3, 3, '#6a3a1a'); P(g, x + 11, by - 31, 5, 1, '#8a5a30');
  // counter and cart body
  P(g, x - 24, by - 24, 48, 3, wd.l); P(g, x - 24, by - 22, 48, 1, wd.d);
  P(g, x - 22, by - 21, 44, 14, body.m); P(g, x - 22, by - 21, 44, 1, body.h); P(g, x + 19, by - 21, 3, 14, body.d);
  P(g, x - 22, by - 9, 44, 2, trim.m); P(g, x - 22, by - 19, 44, 1, trim.l);
  // coffee cup emblem
  P(g, x - 4, by - 17, 7, 5, '#6a3a1a'); P(g, x + 3, by - 16, 2, 3, '#6a3a1a'); P(g, x - 5, by - 12, 9, 1, '#6a3a1a');
  P(g, x - 3, by - 20, 1, 2, '#c8b8a0'); P(g, x, by - 21, 1, 3, '#c8b8a0');
  // spoked wheels
  for (const wx of [x - 13, x + 13]) {
    disc(g, wx, by - 5, 5, wd.o); disc(g, wx, by - 5, 4, wd.m); disc(g, wx, by - 5, 2, wd.d);
    P(g, wx - 4, by - 5, 9, 1, wd.l); P(g, wx, by - 9, 1, 9, wd.l); P(g, wx, by - 5, 1, 1, '#3a3a46');
  }
  if (snow) P(g, x - 27, by - 57, 54, 2, '#ffffff');
}

function drawMenuBoard(g, x, by, snow) {
  const wd = ramp('#8a5a30');
  line(g, x - 6, by, x - 3, by - 16, wd.m, 2); line(g, x + 6, by, x + 3, by - 16, wd.d, 2);
  P(g, x - 5, by - 15, 11, 12, wd.m); P(g, x - 4, by - 14, 9, 10, '#2a4a3a');
  P(g, x - 3, by - 13, 6, 1, '#f0f0e0'); P(g, x - 3, by - 11, 4, 1, '#e8d080'); P(g, x - 3, by - 9, 7, 1, '#f0f0e0'); P(g, x - 3, by - 7, 5, 1, '#f0a0a0');
  if (snow) P(g, x - 5, by - 16, 11, 1, '#ffffff');
}

function drawStool(g, x, y) {
  P(g, x - 3, y - 5, 7, 2, '#c04a3a'); P(g, x - 3, y - 5, 7, 1, '#e06a5a');
  line(g, x - 2, y - 3, x - 3, y, '#3a3a46'); line(g, x + 2, y - 3, x + 3, y, '#3a3a46');
}

// Bistro table under a striped umbrella; drawn in front of the people sitting at it.
function makeCafeTable(color) {
  const c = mk(42, 52), g = c.getContext('2d'), ax = 21, by = 49, st = ramp(color);
  P(g, ax - 1, by - 42, 2, 34, '#8a8e98'); P(g, ax - 1, by - 42, 1, 34, '#c8ccd4');
  for (let r = 0; r < 8; r++) {
    const half = 6 + Math.round(r * 1.9);
    for (let x = -half; x <= half; x++) {
      const seg = Math.floor(((x / half) + 1) * 3) % 2;
      const shade = x > half * 0.4 ? 'd' : r < 2 ? 'l' : 'm';
      P(g, ax + x, by - 46 + r, 1, 1, seg ? (shade === 'd' ? '#d8d0c4' : '#fbf6ee') : st[shade]);
    }
  }
  for (let i = 0; i < 6; i++) {
    const sx = ax - 18 + i * 6 + 3, col = i % 2 ? '#fbf6ee' : st.m;
    P(g, sx - 3, by - 38, 6, 1, col); P(g, sx - 2, by - 37, 4, 1, col);
  }
  P(g, ax - 1, by - 48, 2, 2, '#8a8e98');
  P(g, ax - 1, by - 8, 2, 7, '#3a3a46');
  ellipse(g, ax, by - 1, 4, 1, '#3a3a46');
  ellipse(g, ax, by - 9, 9, 2, '#d8d2c8'); ellipse(g, ax, by - 10, 9, 1, '#f6f2ea');
  outline(c);
  return { cv: c, ax, by };
}

// "BACK SOON!" board that hangs on the front of the coffee cart.
function makeSign() {
  const c = mk(42, 32), g = c.getContext('2d'), ax = 21, by = 29;
  const bd = ramp('#d8b070'), x0 = ax - 18, y0 = by - 24, w = 37, h = 24;
  line(g, x0 + 4, y0 - 4, x0 + 4, y0, '#4a4a56'); line(g, x0 + w - 5, y0 - 4, x0 + w - 5, y0, '#4a4a56');
  P(g, x0, y0, w, h, bd.m); P(g, x0, y0, w, 1, bd.l); P(g, x0, y0 + 11, w, 1, bd.o); P(g, x0, y0 + 12, w, 1, bd.l);
  P(g, x0, y0, 1, h, bd.l); P(g, x0 + w - 1, y0, 1, h, bd.d); P(g, x0, y0 + h - 1, w, 1, bd.d);
  drawText(g, 'BACK', ax - 11, y0 + 3, '#5a2410');
  drawText(g, 'SOON!', ax - 13, y0 + 14, '#5a2410');
  outline(c);
  return { cv: c, ax, by };
}

/* ---------- props ---------- */

function drawText(g, str, x, y, c) {
  for (const ch of str) {
    const gl = FONT[ch];
    tpl(g, gl, x, y, { '#': ch === '!' ? '#d03020' : c });
    x += gl[0].length + 1;
  }
}

function makeProjector() {
  const c = mk(32, 34), g = c.getContext('2d'), ax = 15, by = 31;
  const cr = ramp('#9a6a3a'), bd = ramp('#4a4a58');
  P(g, ax - 10, by - 9, 21, 10, cr.m); P(g, ax - 10, by - 9, 21, 1, cr.l); P(g, ax - 10, by, 21, 1, cr.d);
  P(g, ax - 10, by - 9, 1, 10, cr.l); P(g, ax + 10, by - 9, 1, 10, cr.d);
  line(g, ax - 8, by - 7, ax + 8, by - 1, cr.d, 1);
  P(g, ax - 8, by - 18, 16, 9, bd.m); P(g, ax - 8, by - 18, 16, 1, bd.l); P(g, ax - 8, by - 10, 16, 1, bd.d);
  for (let x = ax - 6; x < ax + 2; x += 2) P(g, x, by - 16, 1, 4, bd.o);
  P(g, ax + 8, by - 16, 5, 5, bd.d); P(g, ax + 8, by - 16, 5, 1, bd.l); P(g, ax + 12, by - 15, 1, 3, '#c8d8ff');
  P(g, ax - 5, by - 22, 1, 4, bd.o); P(g, ax + 4, by - 22, 1, 4, bd.o);
  outline(c);
  return { cv: c, ax, by, lens: [13, -14], reels: [[-5, -26], [4, -26]] };
}

function makePot() {
  const c = mk(34, 32), g = c.getContext('2d'), ax = 17, by = 29;
  const wd = ramp('#7a5030'), pt = ramp('#3e3c4a');
  line(g, ax - 13, by, ax - 1, by - 25, wd.m, 2); line(g, ax + 13, by, ax + 1, by - 25, wd.d, 2);
  P(g, ax - 2, by - 27, 5, 3, '#c8a868');
  P(g, ax, by - 24, 1, 6, '#4a4a56');
  ellipse(g, ax, by - 11, 9, 6, pt.m);
  P(g, ax - 7, by - 14, 3, 5, pt.l); P(g, ax - 6, by - 15, 1, 1, pt.h);
  P(g, ax + 4, by - 9, 4, 3, pt.d);
  ellipse(g, ax, by - 16, 9, 2, pt.d); ellipse(g, ax, by - 16, 7, 1, '#d88a30'); P(g, ax - 4, by - 17, 3, 1, '#f8b858');
  P(g, ax - 6, by - 5, 2, 3, pt.d); P(g, ax + 5, by - 5, 2, 3, pt.d);
  outline(c);
  return { cv: c, ax, by };
}

function makePuff(r, light, mid, dark) {
  const c = mk(r * 2 + 3, r * 2 + 3), g = c.getContext('2d'), o = r + 1;
  disc(g, o, o, r, dark);
  disc(g, o - 1, o - 1, Math.max(0, r - 1), mid);
  if (r > 1) disc(g, o - Math.ceil(r / 2), o - Math.ceil(r / 2), Math.max(0, r - 3), light);
  return c;
}

const FILM_W = 44, FILM_H = 36;
function makeFilmBg(sc) {
  const c = mk(FILM_W, FILM_H), g = c.getContext('2d');
  const grad = (y0, y1, a, b) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < FILM_W; x++) {
        const f = ((y - y0) / (y1 - y0)) * 5, band = Math.floor(f) + (f % 1 > bayer(x, y) ? 1 : 0);
        P(g, x, y, 1, 1, mixHex(a, b, Math.min(1, band / 5)));
      }
    }
  };
  if (sc === 0) {
    grad(0, FILM_H, '#080a24', '#2a1a5a');
    const rnd = mulberry32(3);
    for (let i = 0; i < 18; i++) P(g, Math.floor(rnd() * FILM_W), Math.floor(rnd() * FILM_H), 1, 1, rnd() < 0.3 ? '#ffffff' : '#9aa0d0');
    disc(g, 33, 10, 6, '#d8784a'); disc(g, 31, 8, 3, '#f0a070'); P(g, 35, 13, 3, 2, '#a85030');
    line(g, 24, 13, 42, 7, '#f0d0a0', 1);
  } else if (sc === 1) {
    grad(0, 24, '#f88a50', '#ffe0a0');
    disc(g, 30, 15, 5, '#fff4c0');
    for (const [x0, w, h] of [[2, 12, 9], [18, 8, 6], [34, 10, 8]]) { P(g, x0, 24 - h, w, h, '#8a3a2a'); P(g, x0, 24 - h, w, 1, '#c86a40'); }
    P(g, 0, 24, FILM_W, 12, '#d89048'); P(g, 0, 24, FILM_W, 1, '#f0b060');
    for (let x = 2; x < FILM_W; x += 7) P(g, x, 29 + (x % 3), 3, 1, '#b8702c');
    P(g, 6, 18, 2, 8, '#3a8a4a'); P(g, 4, 20, 2, 3, '#3a8a4a'); P(g, 8, 19, 2, 3, '#3a8a4a'); P(g, 6, 18, 1, 8, '#5aaa5a');
  } else {
    grad(0, 24, '#c04a6a', '#ffc890');
    disc(g, 22, 24, 7, '#fff0b0');
    P(g, 0, 24, FILM_W, 12, '#3a4a90');
    for (let y = 25; y < FILM_H; y += 2) P(g, 18 + ((y * 3) % 5), y, 8 - (y - 25) / 2, 1, '#f0c0a0');
  }
  return c;
}

/* ---------- reactions: map anything in Home Assistant to a village mood ---------- */

// States that count as "on / active" across the common domains.
const ACTIVE_STATES = new Set([
  'on', 'home', 'open', 'opening', 'playing', 'active', 'detected', 'occupied', 'unlocked', 'running', 'cleaning',
  'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'wet', 'problem', 'triggered',
  'armed_away', 'armed_home', 'armed_night', 'armed_vacation', 'armed_custom_bypass',
]);
const EVENT_DOMAINS = ['scene', 'script', 'automation', 'button', 'input_button', 'event'];
const REACTION_KINDS = ['activated', 'on', 'state', 'not_state', 'numeric'];
// 'auto' sends the village back to its daily routine (e.g. a "Good morning" scene ending "Good night").
const REACTION_MODES = new Set(['auto', ...Object.keys(MODES)]);
const modeInfo = (m) => (m === 'auto' ? { icon: '🗓️', label: 'Daily routine', text: 'Follow the normal schedule' } : MODES[m]);

const domainOf = (entity) => String(entity || '').split('.')[0];

// Older configs leave `when` out: scenes, scripts and buttons react when activated, the rest when "on".
function reactionKind(t) {
  if (REACTION_KINDS.includes(t.when)) return t.when;
  if (t.state !== undefined) return 'state';
  if (t.above !== undefined || t.below !== undefined) return 'numeric';
  return EVENT_DOMAINS.includes(domainOf(t.entity)) ? 'activated' : 'on';
}

// When was this entity last "activated"? Scenes and buttons store it as their state, scripts and
// automations as last_triggered; anything else counts its last state change.
function activatedAt(st, now) {
  const d = domainOf(st.entity_id);
  // never-used scenes and buttons report "unknown": they haven't been activated
  if (['scene', 'button', 'input_button', 'event'].includes(d)) return Date.parse(st.state);
  if (d === 'script' && st.state === 'on') return now;
  if (d === 'script' || d === 'automation') return st.attributes?.last_triggered ? Date.parse(st.attributes.last_triggered) : NaN;
  return Date.parse(st.last_changed);
}

// First matching reaction wins. Among "activated" reactions only the most recent activation counts,
// and only while it's within its duration: pressing a newer scene cancels older ones for good.
function evalReactions(list, states, now = Date.now()) {
  if (!Array.isArray(list) || !states) return null;
  let latest = null;
  list.forEach((t, i) => {
    if (!t || !REACTION_MODES.has(t.mode) || reactionKind(t) !== 'activated') return;
    const st = states[t.entity];
    if (!st) return;
    const ts = activatedAt(st, now);
    if (!isNaN(ts) && ts <= now + 60000 && (!latest || ts > latest.ts)) latest = { i, ts };
  });
  if (latest && (now - latest.ts) / 60000 >= (Number(list[latest.i].duration) || 120)) latest = null;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t || !REACTION_MODES.has(t.mode)) continue;
    const st = states[t.entity];
    if (!st) continue;
    const kind = reactionKind(t);
    if (kind === 'activated') { if (latest?.i === i) return t; continue; }
    const raw = t.attribute ? st.attributes?.[t.attribute] : st.state;
    if (raw === undefined || raw === null) continue;
    const val = String(raw);
    if (val === 'unavailable' || val === 'unknown') continue;
    const wanted = [].concat(t.state ?? []).map(String);
    if (kind === 'on' && (raw === true || ACTIVE_STATES.has(val))) return t;
    if (kind === 'state' && wanted.includes(val)) return t;
    if (kind === 'not_state' && wanted.length && !wanted.includes(val)) return t;
    if (kind === 'numeric') {
      const n = parseFloat(raw);
      const above = t.above === '' || t.above === undefined ? null : Number(t.above);
      const below = t.below === '' || t.below === undefined ? null : Number(t.below);
      if (!isNaN(n) && (above !== null || below !== null) && (above === null || n > above) && (below === null || n < below)) return t;
    }
  }
  return null;
}

// Look at what's in this Home Assistant and propose sensible reactions.
const SUGGEST_WORDS = [
  ['party', ['party', 'celebrat\\w*', 'disco', 'festive', 'dance', 'dancing', 'birthday']],
  ['movie', ['movie', 'movies', 'cinema', 'film', 'theater', 'theatre', 'tv time', 'netflix', 'watch tv']],
  ['cozy', ['cozy', 'cosy', 'relax\\w*', 'chill', 'reading', 'fireplace', 'lounge', 'romantic', 'candle\\w*']],
  ['sleep', ['good ?night', 'sleep\\w*', 'bed ?time', 'night mode', 'lights out', 'nap']],
  ['auto', ['good ?morning', 'morning', 'wake ?up', 'sunrise', 'day ?time', 'daylight']],
  ['gaming', ['gaming', 'games?', 'game ?night', 'xbox', 'playstation', 'ps[345]', 'nintendo', 'steam', 'console', 'retro']],
  ['meal', ['dinner', 'lunch', 'breakfast', 'meal', 'cooking', 'dining']],
  ['away', ['away', 'leave', 'leaving', 'vacation', 'holiday', 'good ?bye', 'not home', 'nobody home']],
  ['work', ['work', 'working', 'focus', 'office', 'study']],
].map(([mode, words]) => [mode, new RegExp(`\\b(${words.join('|')})\\b`, 'i')]);
const SUGGEST_DURATION = { auto: 900, gaming: 240, sleep: 480, away: 720, morning: 60, meal: 90, party: 180, movie: 150, cozy: 150, work: 240 };

function suggestReactions(states, existing = []) {
  if (!states) return [];
  const have = new Set(existing.map((t) => `${t.entity}|${t.mode}`));
  const out = [];
  const add = (s) => { if (!have.has(`${s.entity}|${s.mode}`)) { have.add(`${s.entity}|${s.mode}`); out.push(s); } };
  const nameOf = (st) => String(st.attributes?.friendly_name || st.entity_id.split('.')[1].replace(/_/g, ' '));
  for (const st of Object.values(states)) {
    const d = domainOf(st.entity_id), name = nameOf(st);
    if (['scene', 'script', 'button', 'input_button'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([, re]) => re.test(name));
      if (hit) add({ entity: st.entity_id, when: 'activated', mode: hit[0], duration: SUGGEST_DURATION[hit[0]], why: hit[0] === 'auto' ? `"${name}" sounds like the start of a normal day` : `"${name}" sounds like ${MODES[hit[0]].label.toLowerCase()}` });
    } else if (['input_boolean', 'switch'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([m, re]) => ['party', 'movie', 'gaming', 'sleep', 'away', 'cozy'].includes(m) && re.test(name));
      if (hit) add({ entity: st.entity_id, when: 'on', mode: hit[0], why: `while "${name}" is on` });
    } else if (d === 'alarm_control_panel') {
      add({ entity: st.entity_id, when: 'state', state: ['armed_away', 'armed_vacation'], mode: 'away', why: `when "${name}" is armed away` });
      add({ entity: st.entity_id, when: 'state', state: ['armed_night'], mode: 'sleep', why: `when "${name}" is armed for the night` });
    } else if (d === 'media_player' && (st.attributes?.device_class === 'tv' || /\b(tv|television|living room|lounge|theat(er|re)|projector)\b/i.test(name))) {
      add({ entity: st.entity_id, when: 'state', state: ['playing'], mode: 'movie', why: `while "${name}" is playing` });
    }
  }
  const people = Object.keys(states).filter((k) => k.startsWith('person.'));
  if (states['zone.home'] && people.length) add({ entity: 'zone.home', when: 'numeric', below: 1, mode: 'away', why: 'when nobody is home' });
  else if (people.length === 1) add({ entity: people[0], when: 'not_state', state: ['home'], mode: 'away', why: 'when you leave home' });
  const order = ['auto', ...Object.keys(MODES)];
  return out.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)).slice(0, 16);
}

/* ---------- visual editor ---------- */

const MODE_OPTIONS = ['auto', ...Object.keys(MODES)].map((value) => { const m = modeInfo(value); return { value, label: `${m.icon} ${m.label} — ${m.text}` }; });
const SCHEDULE_FIELDS = [
  ['wake', 'Wake up'], ['work', 'Start work'], ['lunch', 'Lunch'], ['work_after_lunch', 'Back to work'],
  ['dinner', 'Dinner'], ['evening', 'Evening by the fire'], ['sleep', 'Bedtime'],
];
const EDITOR_LABELS = {
  title: 'Title', villagers: 'Residents', visitors: 'Visitors, mail carrier and party band', animals: 'Animals',
  show_status: 'Show the status line', fps: 'Frames per second',
  weather_entity: 'Weather', sun_entity: 'Sun', mode_entity: 'Mood helper (optional)',
  entity: 'When this', when: 'Condition', state: 'State', attribute: 'Attribute (optional)',
  above: 'Above', below: 'Below', duration: 'Stay in this mood for (minutes)', mode: 'The village goes into', label: 'Caption (optional)',
  ...Object.fromEntries(SCHEDULE_FIELDS),
};
const EDITOR_HELPERS = {
  villagers: 'People who live in the village (1–10).',
  fps: 'Lower saves a little power; 15 is smooth.',
  weather_entity: 'Leave empty to use the first weather entity found.',
  mode_entity: 'An input_select / select whose state is a mood name (sleep, morning, work, meal, evening, party, movie, gaming, cozy, away). Anything else falls back to the schedule.',
  duration: 'How long the mood lasts after it was activated.',
  attribute: 'Compare an attribute instead of the state.',
};

// The most useful starting condition for a freshly picked entity.
function defaultKind(entity, states) {
  const d = domainOf(entity), st = states?.[entity];
  if (EVENT_DOMAINS.includes(d)) return 'activated';
  if (['sensor', 'number', 'input_number', 'counter', 'zone'].includes(d) && st && !isNaN(parseFloat(st.state))) return 'numeric';
  if (['person', 'device_tracker', 'media_player', 'alarm_control_panel', 'input_select', 'select', 'vacuum', 'lock', 'cover', 'climate', 'weather'].includes(d)) return 'state';
  return 'on';
}

function kindOptions(entity) {
  const d = domainOf(entity);
  const ev = EVENT_DOMAINS.includes(d);
  return [
    { value: 'activated', label: ev ? 'Is activated / run' : 'Changes (any state change)' },
    { value: 'on', label: 'Is on / active (on, home, open, playing…)' },
    { value: 'state', label: 'Has a specific state' },
    { value: 'not_state', label: "Doesn't have a specific state" },
    { value: 'numeric', label: 'Is above / below a number' },
  ];
}

function reactionSchema(t) {
  const kind = reactionKind(t);
  const schema = [
    { name: 'entity', required: true, selector: { entity: {} } },
    { name: 'when', selector: { select: { mode: 'dropdown', options: kindOptions(t.entity) } } },
  ];
  if (kind === 'activated') schema.push({ name: 'duration', selector: { number: { min: 1, max: 1440, step: 1, mode: 'box', unit_of_measurement: 'min' } } });
  if (kind === 'state' || kind === 'not_state' || kind === 'numeric') {
    schema.push({ name: 'attribute', selector: { attribute: {} }, context: { filter_entity: 'entity' } });
  }
  if (kind === 'state' || kind === 'not_state') {
    schema.push({ name: 'state', selector: { state: { multiple: true } }, context: { filter_entity: 'entity', filter_attribute: 'attribute' } });
  }
  if (kind === 'numeric') {
    schema.push({ type: 'grid', name: '', schema: [
      { name: 'above', selector: { number: { mode: 'box', step: 'any' } } },
      { name: 'below', selector: { number: { mode: 'box', step: 'any' } } },
    ] });
  }
  schema.push({ name: 'mode', required: true, selector: { select: { mode: 'dropdown', options: MODE_OPTIONS } } });
  schema.push({ name: 'label', selector: { text: {} } });
  return schema;
}

// Strip empty values and defaults so the saved YAML stays tidy.
function cleanReaction(t) {
  const out = {};
  for (const k of ['entity', 'when', 'attribute', 'state', 'above', 'below', 'duration', 'mode', 'label']) {
    const v = t[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  const kind = reactionKind(out);
  if (kind !== 'activated') delete out.duration;
  if (kind !== 'state' && kind !== 'not_state') delete out.state;
  if (kind !== 'numeric') { delete out.above; delete out.below; }
  if (kind === 'activated' || kind === 'on') delete out.attribute;
  return out;
}

let haComponents;
function loadHaComponents() {
  // ha-form and the pickers are lazy-loaded by Home Assistant; borrowing a built-in card's editor loads them.
  haComponents ||= (async () => {
    if (customElements.get('ha-form') && customElements.get('ha-entity-picker')) return;
    try {
      const helpers = await window.loadCardHelpers?.();
      const card = await helpers?.createCardElement({ type: 'entities', entities: [] });
      await card?.constructor?.getConfigElement?.();
    } catch (e) { /* fall through to waiting */ }
    await Promise.race([customElements.whenDefined('ha-form'), new Promise((r) => setTimeout(r, 4000))]);
  })();
  return haComponents;
}

class PixelVillageCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config, triggers: Array.isArray(config.triggers) ? config.triggers.map((t) => ({ ...t })) : [] };
    if (this._ready) this._refresh();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._ready) {
      for (const f of this.shadowRoot.querySelectorAll('ha-form')) f.hass = hass;
      this._renderSuggestions();
    }
  }

  async connectedCallback() {
    if (this._ready) return;
    await loadHaComponents();
    this._ready = true;
    this._build();
  }

  _emit() {
    const c = { ...this._config };
    c.triggers = (c.triggers || []).map(cleanReaction).filter((t) => t.entity && t.mode);
    if (!c.triggers.length) delete c.triggers;
    for (const k of ['title', 'weather_entity', 'mode_entity']) if (!c[k]) delete c[k];
    if (c.sun_entity === 'sun.sun' || !c.sun_entity) delete c.sun_entity;
    for (const k of ['visitors', 'animals', 'show_status']) if (c[k] === true) delete c[k];
    if (c.fps === 15) delete c.fps;
    if (c.schedule) {
      const sch = {};
      for (const [k] of SCHEDULE_FIELDS) {
        const v = c.schedule[k];
        if (v && String(v).slice(0, 5) !== hourToTime(DEFAULT_SCHEDULE[k])) sch[k] = String(v).slice(0, 5);
      }
      if (Object.keys(sch).length) c.schedule = sch; else delete c.schedule;
    }
    this._config = { ...this._config, schedule: c.schedule };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
  }

  _form(schema, data, onChange) {
    if (!customElements.get('ha-form')) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = 'This version of Home Assistant can’t show the visual editor; use the code editor instead.';
      return p;
    }
    const f = document.createElement('ha-form');
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
    f.computeHelper = (s) => EDITOR_HELPERS[s.name];
    f.addEventListener('value-changed', (ev) => { ev.stopPropagation(); onChange(ev.detail.value, f); });
    return f;
  }

  _section(title, intro) {
    const s = document.createElement('section');
    s.innerHTML = `<h3>${title}</h3>${intro ? `<p class="note">${intro}</p>` : ''}`;
    this._root.appendChild(s);
    return s;
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        section { margin-bottom: 20px; }
        h3 { margin: 18px 0 6px; font-size: 15px; font-weight: 500; }
        .note { margin: 0 0 10px; font-size: 13px; color: var(--secondary-text-color); line-height: 1.45; }
        .reaction { border: 1px solid var(--divider-color, #ddd); border-radius: 12px; padding: 8px 12px 12px; margin-bottom: 10px; }
        .rhead { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .rhead .t { flex: 1; font-weight: 500; font-size: 14px; }
        .rhead .n { color: var(--secondary-text-color); font-size: 12px; }
        button { font: inherit; font-size: 13px; border-radius: 8px; border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff); color: var(--primary-text-color); padding: 6px 10px; cursor: pointer; }
        button.icon { padding: 2px 8px; min-width: 30px; }
        button.primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
        button:disabled { opacity: 0.4; cursor: default; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .sugg { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--divider-color, #eee); }
        .sugg .what { flex: 1; font-size: 13px; line-height: 1.35; }
        .sugg .what b { font-weight: 500; }
        .sugg .what span { color: var(--secondary-text-color); }
        .empty { font-size: 13px; color: var(--secondary-text-color); padding: 6px 0; }
      </style>
      <div id="root"></div>`;
    this._root = root.getElementById('root');
    const cfg = this._config;

    const gen = this._section('Village');
    gen.appendChild(this._form([
      { name: 'title', selector: { text: {} } },
      { name: 'villagers', selector: { number: { min: 1, max: 10, step: 1, mode: 'slider' } } },
      { type: 'grid', name: '', schema: [
        { name: 'visitors', selector: { boolean: {} } },
        { name: 'animals', selector: { boolean: {} } },
      ] },
      { name: 'show_status', selector: { boolean: {} } },
      { name: 'fps', selector: { number: { min: 2, max: 30, step: 1, mode: 'box' } } },
    ], {
      title: cfg.title ?? '', villagers: cfg.villagers ?? 6, visitors: cfg.visitors !== false, animals: cfg.animals !== false,
      show_status: cfg.show_status !== false, fps: cfg.fps ?? 15,
    }, (v) => { Object.assign(this._config, v); this._emit(); }));

    const env = this._section('Surroundings', 'The village follows the sun and the weather. A mood helper lets automations set the mood directly.');
    env.appendChild(this._form([
      { name: 'weather_entity', selector: { entity: { domain: 'weather' } } },
      { name: 'sun_entity', selector: { entity: { domain: 'sun' } } },
      { name: 'mode_entity', selector: { entity: { domain: ['input_select', 'select', 'input_text'] } } },
    ], { weather_entity: cfg.weather_entity ?? '', sun_entity: cfg.sun_entity ?? 'sun.sun', mode_entity: cfg.mode_entity ?? '' },
    (v) => { Object.assign(this._config, v); this._emit(); }));

    const sch = this._section('Daily routine', 'What the villagers do when nothing else is going on.');
    const schData = {};
    for (const [k] of SCHEDULE_FIELDS) schData[k] = `${hourToTime(parseHour(cfg.schedule?.[k] ?? DEFAULT_SCHEDULE[k]))}:00`;
    sch.appendChild(this._form([{ type: 'grid', name: '', schema: SCHEDULE_FIELDS.map(([name]) => ({ name, selector: { time: {} } })) }], schData,
      (v) => { this._config.schedule = { ...v }; this._emit(); }));

    const re = this._section('Reactions', 'Tie anything in your home to a village mood: scenes, scripts, automations, buttons, switches, media players, people, alarms, sensors. The first reaction that matches wins, so put the most important ones on top.');
    this._list = document.createElement('div');
    re.appendChild(this._list);
    const add = document.createElement('div');
    add.className = 'row';
    add.innerHTML = '<button class="primary" id="add">+ Add reaction</button>';
    add.querySelector('#add').onclick = () => {
      this._config.triggers.push({ entity: '', mode: 'party' });
      this._renderList(); this._emit();
    };
    re.appendChild(add);

    const sg = this._section('Suggestions', 'Based on what’s in your Home Assistant. Add the ones you like and tweak them above.');
    this._sugg = document.createElement('div');
    sg.appendChild(this._sugg);

    this._renderList();
    this._renderSuggestions();
  }

  _refresh() {
    // a config change from outside (e.g. the YAML editor): rebuild everything
    this._build();
  }

  _renderList() {
    const list = this._config.triggers;
    this._list.innerHTML = '';
    if (!list.length) this._list.innerHTML = '<div class="empty">No reactions yet — the village just follows its daily routine.</div>';
    list.forEach((t, i) => {
      const box = document.createElement('div');
      box.className = 'reaction';
      const title = () => {
        const st = this._hass?.states?.[t.entity];
        return `${modeInfo(t.mode)?.icon || ''} ${st?.attributes?.friendly_name || t.entity || 'New reaction'}`;
      };
      box.innerHTML = `<div class="rhead"><span class="n">${i + 1}</span><span class="t"></span>
        <button class="icon" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon" data-a="down" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon" data-a="del" title="Remove">✕</button></div>`;
      box.querySelector('.t').textContent = title();
      box.querySelector('[data-a=up]').onclick = () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; this._renderList(); this._emit(); };
      box.querySelector('[data-a=down]').onclick = () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; this._renderList(); this._emit(); };
      box.querySelector('[data-a=del]').onclick = () => { list.splice(i, 1); this._renderList(); this._emit(); };
      const data = { ...t, when: reactionKind(t), duration: t.duration ?? 120 };
      const form = this._form(reactionSchema(t), data, (v, f) => {
        const entityChanged = v.entity !== t.entity;
        Object.assign(t, v);
        if (entityChanged && !list[i]._whenTouched) t.when = defaultKind(t.entity, this._hass?.states);
        if (v.when !== data.when) list[i]._whenTouched = true;
        Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; });
        const next = reactionSchema(t);
        if (JSON.stringify(next) !== JSON.stringify(f.schema)) f.schema = next;
        f.data = { ...t, when: reactionKind(t), duration: t.duration ?? 120 };
        Object.assign(data, f.data);
        box.querySelector('.t').textContent = title();
        this._emit();
      });
      box.appendChild(form);
      this._list.appendChild(box);
    });
  }

  _renderSuggestions() {
    if (!this._sugg) return;
    const sugg = suggestReactions(this._hass?.states, this._config.triggers);
    const key = JSON.stringify(sugg.map((s) => s.entity + s.mode));
    if (key === this._suggKey) return;
    this._suggKey = key;
    this._sugg.innerHTML = '';
    if (!sugg.length) { this._sugg.innerHTML = '<div class="empty">Nothing obvious to suggest — add reactions by hand above.</div>'; return; }
    for (const s of sugg) {
      const row = document.createElement('div');
      row.className = 'sugg';
      const st = this._hass.states[s.entity];
      row.innerHTML = `<div class="what"><b></b><br><span></span></div><button>Add</button>`;
      row.querySelector('b').textContent = `${modeInfo(s.mode).icon} ${modeInfo(s.mode).label}`;
      row.querySelector('span').textContent = `${st?.attributes?.friendly_name || s.entity} — ${s.why}`;
      row.querySelector('button').onclick = () => {
        const { why, ...t } = s;
        this._config.triggers.push(t);
        this._suggKey = null;
        this._renderList(); this._renderSuggestions(); this._emit();
      };
      this._sugg.appendChild(row);
    }
    if (sugg.length > 1) {
      const all = document.createElement('div');
      all.className = 'row';
      all.style.marginTop = '8px';
      all.innerHTML = '<button>Add all suggestions</button>';
      all.querySelector('button').onclick = () => {
        for (const { why, ...t } of sugg) this._config.triggers.push(t);
        this._suggKey = null;
        this._renderList(); this._renderSuggestions(); this._emit();
      };
      this._sugg.appendChild(all);
    }
  }
}

function hourToTime(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* ---------- the card ---------- */

class PixelVillageCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('pixel-village-card-editor');
  }

  static getStubConfig() {
    return { villagers: 6 };
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    if (config.triggers !== undefined && !Array.isArray(config.triggers)) throw new Error('triggers must be a list');
    this._config = {
      villagers: 6, fps: 15, show_status: true, sun_entity: 'sun.sun', triggers: [], ...config,
    };
    this._schedule = { ...DEFAULT_SCHEDULE };
    for (const [k, v] of Object.entries(config.schedule || {})) this._schedule[k] = parseHour(v);
    if (!this.shadowRoot) this._build();
    this._title.textContent = config.title || '';
    this._title.style.display = config.title ? '' : 'none';
    this._status.style.display = this._config.show_status ? '' : 'none';
    this._initVillage();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._villagers) this._updateMode();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  connectedCallback() {
    this._connected = true;
    this._io?.observe(this._canvas);
    this._sync();
  }

  disconnectedCallback() {
    this._connected = false;
    this._io?.disconnect();
    this._sync();
  }

  /* ----- DOM + loop ----- */

  _build() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        ha-card { display: block; overflow: hidden; }
        .title { padding: 12px 16px 8px; font-size: 1.1em; font-weight: 500; }
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
        <canvas width="${RW}" height="${RH}"></canvas>
        <div class="status"></div>
      </ha-card>`;
    this._title = root.querySelector('.title');
    this._canvas = root.querySelector('canvas');
    this._status = root.querySelector('.status');
    this._ctx = this._canvas.getContext('2d');
    this._visible = true;
    this._t = 0;

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries.some((e) => e.isIntersecting);
        this._sync();
      });
      if (this._connected) this._io.observe(this._canvas);
    }
    this._onVis = () => this._sync();
    document.addEventListener('visibilitychange', this._onVis);
    this._canvas.addEventListener('click', (e) => this._click(e));
  }

  _sync() {
    const run = this._connected && this._visible && !document.hidden && !!this._villagers;
    if (run && !this._running) {
      this._running = true;
      this._last = performance.now();
      this._tick();
    } else if (!run && this._running) {
      this._running = false;
      clearTimeout(this._timer);
    }
  }

  _tick() {
    if (!this._running) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.25);
    this._last = now;
    this._t += dt;
    if (this._t - (this._modeCheck || 0) > 1) {
      this._modeCheck = this._t;
      this._updateMode();
      this._spawnGuests();
    }
    this._update(dt);
    this._render();
    const fps = Math.max(2, Math.min(30, this._config.fps || 12));
    this._timer = setTimeout(() => requestAnimationFrame(() => this._tick()), 1000 / fps);
  }

  /* ----- world state ----- */

  _initVillage() {
    const n = Math.max(1, Math.min(10, this._config.villagers | 0 || 6));
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
    this._nextMail = rand(15, 45);
    this._nextGuest = 0;
    this._initAnimals(g);
    this._particles = [];
    this._screen = 0;
    this._popcorn = false;
    this._sign = 0;
    this._signBy = null;
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
    this._updateMode();
    this._sync();
  }

  _hour() {
    if (typeof this.previewHour === 'number') return this.previewHour;
    const tz = this._hass?.config?.time_zone;
    const now = new Date();
    if (tz) {
      try {
        if (!this._fmt || this._fmtTz !== tz) {
          this._fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
          this._fmtTz = tz;
        }
        const [hh, mm] = this._fmt.format(now).split(':').map(Number);
        return hh + mm / 60;
      } catch (e) { /* fall back to browser time */ }
    }
    return now.getHours() + now.getMinutes() / 60;
  }

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
  }

  _matchTrigger() {
    return evalReactions(this._config.triggers, this._hass?.states);
  }

  _updateMode() {
    const cfg = this._config;
    const h = this._hour();
    const states = this._hass?.states || {};
    let mode, reason = null;

    const trig = this._matchTrigger();
    if (trig) { mode = trig.mode === 'auto' ? scheduleMode(h, this._schedule) : trig.mode; reason = trig.mode === 'auto' && !trig.label ? null : trig; }
    if (!mode && cfg.mode_entity && MODES[states[cfg.mode_entity]?.state]) mode = states[cfg.mode_entity].state;
    if (!mode) mode = scheduleMode(h, this._schedule);

    let wEnt = cfg.weather_entity;
    if (wEnt === undefined) {
      if (this._autoWeather === undefined && this._hass) this._autoWeather = Object.keys(states).find((k) => k.startsWith('weather.')) || null;
      wEnt = this._autoWeather;
    }
    this._weather = readWeather(this.previewWeather ?? (wEnt ? states[wEnt]?.state : ''));
    this._phase = this._phaseFor(h);
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
    const label = reason?.label || MODES[mode].label;
    const status = `${MODES[mode].icon} ${label} · ${text}`;
    if (status !== this._statusText) {
      this._statusText = status;
      this._status.textContent = status;
    }
  }

  _onModeChange(prev, triggered) {
    if (prev === 'movie') this._popcorn = false;
    if (prev === undefined) {
      // First run: place everyone where they'd be right now, no commute.
      if (this._mode === 'movie' || this._mode === 'gaming') {
        this._screen = 1;
        this._popcorn = this._mode === 'movie';
      }
      if (this._mode === 'away') {
        this._sign = 2;
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
      const want = { sleep: 0, cozy: 1, away: 0, morning: 2, work: 3, meal: 3, evening: 3, movie: 4, gaming: 3, party: 5 }[this._mode] ?? 2;
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
  }

  /* ----- guests: visitors, the mail carrier and the travelling band ----- */

  _makeGuest(job, rnd, extra = {}) {
    const p = (arr) => arr[Math.floor(rnd() * arr.length)];
    const id = this._villagers.length;
    const look = job === 'mail'
      ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), shirt: '#3a5a9a', pants: '#2a3a5a', style: 'short' }
      : job === 'band'
        ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), shirt: '#c03a3a', pants: '#2a2a3a', style: rnd() < 0.3 ? 'long' : 'short', beard: rnd() < 0.3 }
        : {
          skin: p(LOOKS.skin), hair: p(LOOKS.hair), style: rnd() < 0.4 ? 'long' : 'short', beard: rnd() < 0.15,
          shirt: p(['#e85a5a', '#5a8ae8', '#e8c04a', '#8a5ac8', '#4ab8a0', '#e88a3a', '#d0d0d8', '#6a9a3a']),
          pants: p(['#3a3a48', '#4a5a8a', '#6a5040', '#2a4a3a', '#7a6a5a']),
        };
    const v = {
      id, job, guest: true, home: null, look, sprites: new Map(), small: false,
      speed: rand(9, 12), seed: rnd(), x: W + 20, y: ENTRANCE[1], tx: 0, ty: 0, face: -1,
      walking: false, action: 'gone', actT: 9999, fxT: 0, rethinkAt: 0,
      inside: false, gone: true, active: false, carry: null, bubble: null, jumpT: 0, ang: rnd() * 6,
      ...extra,
    };
    if (job === 'visitor') {
      v.hat = p([null, null, 'sunhat', 'beanie', 'cap']);
      v.gear = rnd() < 0.35; // hikers with backpacks and walking sticks
    }
    if (job === 'band') v.hat = 'band';
    this._villagers.push(v);
    return v;
  }

  _activate(v, stay, delay = 0) {
    v.active = true; v.leaving = false; v.readSign = false;
    v.stayUntil = this._t + delay + stay;
    v.entry = v.job === 'visitor' && Math.random() < 0.3 ? 'west' : 'east';
    if (v.job === 'mail') {
      const homes = [...new Set(this._villagers.filter((o) => !o.guest).map((o) => o.home))].sort(() => Math.random() - 0.5);
      v.route = homes.slice(0, 2 + Math.floor(Math.random() * 2)).map((h) => ({ h, pkg: Math.random() < 0.35 }));
      v.mstage = 'ride'; v.bike = true; v.parked = null;
    }
    v.rethinkAt = this._t + 0.1 + delay;
  }

  _spawnGuests() {
    const cfg = this._config, m = this._mode, t = this._t;
    if (cfg.visitors === false) return;
    {
      const target = { sleep: 0, cozy: 1, away: 1, morning: 2, work: 3, meal: 3, evening: 4, movie: 5, gaming: 4, party: 6 }[m] ?? 2;
      const vis = this._villagers.filter((v) => v.job === 'visitor');
      if (vis.filter((v) => v.active).length < target && t > (this._nextGuest || 0)) {
        const free = vis.filter((v) => !v.active && v.gone);
        if (free.length) this._activate(pick(free), rand(70, 220));
        this._nextGuest = t + rand(5, 14);
      }
    }
    const mail = this._villagers.find((v) => v.job === 'mail');
    if (mail && !mail.active && ['morning', 'work', 'meal'].includes(m) && t > this._nextMail) {
      this._activate(mail, 999);
      this._nextMail = t + rand(240, 720);
    }
    if (m === 'party') this._villagers.filter((v) => v.job === 'band' && !v.active).forEach((v, i) => this._activate(v, 9999, i * 1.3));
  }

  _planGuest(v, { cafe, chat, wander }) {
    const m = this._mode, r = Math.random();
    const out = () => {
      const west = v.entry === 'west' ? Math.random() < 0.7 : Math.random() < 0.2;
      return { x: west ? -12 : W + 12, y: west ? 93 : ENTRANCE[1], gone: true, action: 'gone', dur: 9999 };
    };
    if (!v.active) return out();
    if (v.leaving) return out();
    const leave = () => { v.leaving = true; return out(); };
    if (v.job === 'band') return m === 'party' ? { ...BAND_SPOTS[v.instrIdx], face: 1, action: 'perform', dur: rand(20, 40) } : leave();
    if (v.job === 'mail') return this._planMail(v, leave);
    if (m === 'sleep' || this._t > v.stayUntil) return leave();
    const fireSpot = (action) => {
      const a = rand(0, Math.PI * 2), x = FIRE.x + Math.cos(a) * 21, y = FIRE.y + 1 + Math.sin(a) * 9;
      return { x, y, face: x < FIRE.x ? 1 : -1, action, dur: rand(10, 20) };
    };
    switch (m) {
      case 'party':
        if (r < 0.7) {
          v.ang += rand(0.5, 1.1);
          return { x: FIRE.x + Math.cos(v.ang) * 24, y: FIRE.y + 1 + Math.sin(v.ang) * 9, action: 'dance', dur: rand(1.5, 3.5) };
        }
        return r < 0.85 ? cafe('sip', rand(8, 14)) : chat();
      case 'gaming':
        if (r < 0.5) return cafe('handheld', rand(15, 30));
      // falls through: the rest watch the big screen
      case 'movie': {
        const taken = new Set(this._villagers.filter((o) => o !== v && o.plan?.gseat !== undefined).map((o) => o.plan.gseat));
        const free = GUEST_SEATS.map((_, i) => i).filter((i) => !taken.has(i));
        if (free.length) { const i = pick(free); return { ...GUEST_SEATS[i], gseat: i, action: m === 'gaming' ? 'sit' : 'watch', dur: rand(20, 40) }; }
        return chat();
      }
      case 'away':
        if (!v.readSign) {
          v.readSign = true;
          return { x: SIGN.x + 8, y: SIGN.base + 3, face: -1, action: 'idle', dur: 3, onArrive: () => { v.bubble = { g: 'dots', c: '#333', t: 2.5 }; } };
        }
        return leave();
      case 'evening':
        if (r < 0.5) return fireSpot('sit');
        return r < 0.75 ? cafe(Math.random() < 0.5 ? 'sip' : 'laptop', rand(10, 18)) : chat();
      case 'meal':
        if (r < 0.5) return fireSpot('eat');
        return r < 0.8 ? cafe('sip', rand(8, 14)) : chat();
      default:
        if (r < 0.35) return cafe(Math.random() < 0.6 ? 'sip' : 'laptop', rand(10, 20));
        if (r < 0.6) return { ...wander(), action: 'idle', dur: rand(3, 7), onArrive: () => { if (Math.random() < 0.4) v.bubble = { g: 'bang', c: '#3a8a3a', t: 1.2 }; } };
        if (r < 0.72) return fireSpot('sit');
        if (r < 0.88) return chat();
        return { x: HOUSES[2].door.x - 4, y: HOUSES[2].base + 3, face: 1, action: 'idle', dur: rand(3, 6) };
    }
  }

  _planMail(v, leave) {
    if (!v.route.length) return leave();
    const stop = v.route[0], h = HOUSES[stop.h], d = h.door;
    if (v.mstage === 'ride') {
      const park = { x: d.x + 6, y: d.y + 3 };
      return {
        ...park, face: -1, action: 'park', dur: 0.6,
        done: () => { v.bike = false; v.parked = { ...park, face: -1 }; v.mstage = 'walk'; },
      };
    }
    if (v.mstage === 'walk') {
      return {
        x: d.x + 1, y: d.y, face: -1, carry: stop.pkg ? 'package' : 'mail', action: 'deliver', dur: 1.4,
        onArrive: () => this._spawn({ x: d.x, y: d.y - 9, vx: 0, vy: -4, life: 1.6, g: stop.pkg ? 'box' : 'mail', c: '#ffffff', layer: 1 }),
        done: () => { v.carry = null; v.mstage = 'back'; },
      };
    }
    return {
      x: v.parked.x - 1, y: v.parked.y, face: 1, action: 'mount', dur: 0.5,
      done: () => { v.bike = true; v.parked = null; v.route.shift(); v.mstage = 'ride'; },
    };
  }

  /* ----- animals ----- */

  _initAnimals(rnd) {
    this._animals = [];
    if (this._config.animals === false) return;
    const res = this._villagers.filter((v) => !v.guest);
    const add = (type, variant, extra = {}) => this._animals.push({
      type, variant, x: rand(60, 160), y: rand(100, 120), tx: 0, ty: 0, path: [], face: 1, speed: 12,
      state: 'idle', t: rand(0, 3), seed: rnd(), hidden: false, ...extra,
    });
    for (let i = 0; i < 2; i++) add('dog', i, { owner: res[(i * 2) % res.length] });
    add('cat', 0, { spot: 0 });
    add('rabbit', 0, { zone: 0 }); add('rabbit', 1, { zone: 1 }); add('rabbit', 0, { zone: 2 });
    add('squirrel', 0, { tree: 1 }); add('squirrel', 0, { tree: 3 });
    for (let i = 0; i < 5; i++) add('bird', i % 3, { alt: 0, flock: i });
    for (const a of this._animals) this._placeAnimal(a);
  }

  _placeAnimal(a) {
    if (a.type === 'dog') { a.x = a.owner.x + rand(-4, 4); a.y = a.owner.y + 2; }
    else if (a.type === 'cat') { [a.x, a.y] = CAT_SPOTS[a.spot]; a.state = 'curl'; a.t = rand(5, 20); }
    else if (a.type === 'rabbit') { const z = RABBIT_ZONES[a.zone]; a.x = rand(z[0], z[2]); a.y = rand(z[1], z[3]); }
    else if (a.type === 'squirrel') { const tb = TREE_BASES[a.tree]; a.x = tb[0] + rand(-4, 4); a.y = tb[1] + rand(1, 3); }
    else { a.x = FIRE.x + rand(-30, 30); a.y = FIRE.y + rand(-8, 10); a.state = 'perch'; }
  }

  _goAnimal(a, x, y, speed, state = 'walk', direct = false) {
    a.path = direct ? [[x, y]] : route(a.x, a.y, x, y);
    [a.tx, a.ty] = a.path.shift();
    a.speed = speed; a.state = state;
  }

  _updateAnimals(dt) {
    const m = this._mode, night = m === 'sleep' || this._phase === 'night';
    const people = this._villagers.filter((v) => !v.inside && !v.gone);
    const near = (a, list, r) => list.find((o) => Math.hypot(o.x - a.x, o.y - a.y) < r);
    for (const a of this._animals) {
      a.anim = (a.anim || 0) + dt;
      if (a.state === 'walk' || a.state === 'run' || a.state === 'hop' || a.state === 'fly') {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), step = a.speed * dt;
        if (Math.abs(dx) > 0.2) a.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          a.x = a.tx; a.y = a.ty;
          if (a.path.length) [a.tx, a.ty] = a.path.shift();
          else { a.state = a.rest || 'idle'; a.t = rand(2, 6); if (a.onArrive) { a.onArrive(); a.onArrive = null; } }
        } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
        if (a.type === 'bird' && a.state === 'fly') a.alt = Math.max(0, Math.sin(Math.min(1, 1 - d / (a.dist || 1)) * Math.PI) * 16 + 2);
        continue;
      }
      a.t -= dt;
      switch (a.type) {
        case 'dog': {
          const o = a.owner;
          if (o.gone) { a.hidden = a.hidden || (a.x > W + 4 || a.x < -4); if (!a.hidden && a.state !== 'run') this._goAnimal(a, W + 12, ENTRANCE[1] + 1, 20, 'run'); break; }
          if (a.hidden) { a.hidden = false; a.x = o.x + 3; a.y = o.y + 1; }
          if (o.inside) {
            const d = HOUSES[o.home].door;
            if (Math.hypot(a.x - d.x - 4, a.y - d.y - 2) > 1) this._goAnimal(a, d.x + 4, d.y + 2, 14, 'walk');
            else { a.state = 'lie'; if (m === 'sleep' && Math.random() < dt * 0.4) this._spawn({ x: a.x, y: a.y - 4, vx: 1.5, vy: -3, life: 2, g: 'z', c: '#e8ecff', layer: 1 }); }
            break;
          }
          const dist = Math.hypot(o.x - a.x, o.y - a.y);
          if (dist > 14) { this._goAnimal(a, o.x - o.face * 4, o.y + 1.5, 20, 'run'); a.rest = 'sit'; break; }
          if (a.t <= 0) {
            const r = Math.random();
            if (r < 0.35) { a.state = 'sit'; a.t = rand(3, 8); }
            else if (r < 0.7) { this._goAnimal(a, o.x + rand(-9, 9), o.y + rand(0, 4), 11, 'walk'); a.rest = 'idle'; }
            else if (r < 0.85) { const other = this._animals.find((b) => b.type === 'dog' && b !== a && !b.hidden); if (other) this._goAnimal(a, other.x + 3, other.y, 22, 'run'); a.rest = 'idle'; }
            else { a.state = 'idle'; a.t = rand(2, 4); this._spawn({ x: a.x + a.face * 3, y: a.y - 6, vx: 0, vy: -5, life: 0.8, g: 'bang', c: '#ffffff', layer: 1 }); }
          }
          break;
        }
        case 'cat': {
          const dog = near(a, this._animals.filter((b) => b.type === 'dog' && !b.hidden), 7);
          if (dog && a.state !== 'arch') {
            a.state = 'arch'; a.t = 0.6;
            break;
          }
          if (a.state === 'arch' && a.t <= 0) {
            let far = 0, fd = 0;
            CAT_SPOTS.forEach(([x, y], i) => { const d = Math.hypot(x - a.x, y - a.y); if (d > fd) { fd = d; far = i; } });
            a.spot = far; this._goAnimal(a, ...CAT_SPOTS[far], 24, 'run'); a.rest = 'sit';
            break;
          }
          if (a.t <= 0) {
            if (a.state === 'idle' || a.state === 'sit') { a.state = Math.random() < 0.6 ? 'curl' : 'sit'; a.t = night ? rand(4, 10) : rand(15, 45); }
            else { a.spot = Math.floor(Math.random() * CAT_SPOTS.length); this._goAnimal(a, ...CAT_SPOTS[a.spot], 7, 'walk'); a.rest = 'sit'; }
          }
          break;
        }
        case 'rabbit': case 'squirrel': {
          if (night || this._weather.heavy) { a.hidden = true; break; }
          if (a.hidden) { if (a.t <= 0) { a.hidden = false; this._placeAnimal(a); } break; }
          const threat = near(a, [...people, ...this._animals.filter((b) => b.type === 'dog' || b.type === 'cat')], a.type === 'rabbit' ? 9 : 7);
          if (threat) {
            if (a.type === 'squirrel') {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, tb[0], tb[1] + 0.5, 22, 'hop', true);
              a.onArrive = () => { a.hidden = true; a.t = rand(8, 20); };
            } else {
              const ang = Math.atan2(a.y - threat.y, a.x - threat.x), z = RABBIT_ZONES[a.zone];
              const x = Math.max(z[0], Math.min(z[2], a.x + Math.cos(ang) * 8)), y = Math.max(z[1], Math.min(z[3], a.y + Math.sin(ang) * 4));
              if (Math.hypot(x - a.x, y - a.y) < 2) { a.hidden = true; a.t = rand(8, 16); }
              else this._goAnimal(a, x, y, 18, 'hop', true);
            }
            a.rest = 'idle';
            break;
          }
          if (a.t <= 0) {
            if (a.type === 'rabbit') {
              const z = RABBIT_ZONES[a.zone];
              this._goAnimal(a, Math.max(z[0], Math.min(z[2], a.x + rand(-5, 5))), Math.max(z[1], Math.min(z[3], a.y + rand(-2, 2))), 9, 'hop', true);
            } else if (Math.random() < 0.3) {
              const opts = TREE_BASES.map((_, i) => i).filter((i) => Math.hypot(TREE_BASES[i][0] - a.x, TREE_BASES[i][1] - a.y) < 50);
              a.tree = pick(opts.length ? opts : [a.tree]);
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, tb[0] + rand(-5, 5), tb[1] + rand(1, 4), 16, 'hop', true);
            } else {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, tb[0] + rand(-6, 6), tb[1] + rand(1, 5), 12, 'hop', true);
            }
            a.rest = Math.random() < 0.5 ? 'sit' : 'idle';
          }
          break;
        }
        case 'bird': {
          if (night || this._weather.rain) { a.hidden = true; break; }
          if (a.hidden) { a.hidden = false; a.state = 'perch'; this._placeAnimal(a); }
          const scared = near(a, people, 6);
          if (scared || a.t <= 0) {
            const spots = [[FIRE.x + rand(-25, 25), FIRE.y + rand(-8, 10)], [rand(150, 200), rand(108, 124)], [rand(56, 86), rand(66, 74)], [rand(120, 166), rand(64, 75)]];
            const [x, y] = scared ? pick(spots) : (Math.random() < 0.5 ? [a.x + rand(-10, 10), a.y + rand(-4, 4)] : pick(spots));
            a.dist = Math.hypot(x - a.x, y - a.y) || 1;
            this._goAnimal(a, x, y, 30, 'fly', true);
            a.rest = 'perch';
            a.t = rand(4, 14);
            break;
          }
          if (a.state === 'perch' && Math.random() < dt * 0.6) { a.state = 'peck'; a.t = rand(1, 2); }
          else if (a.state === 'peck' && a.t <= 0) { a.state = 'perch'; a.t = rand(3, 10); }
          break;
        }
      }
    }
  }

  _animalPose(a) {
    const f = Math.floor(a.anim * (a.state === 'run' ? 12 : a.state === 'fly' ? 10 : 6) + a.seed * 10);
    switch (a.type) {
      case 'dog': return a.state === 'walk' || a.state === 'run' ? [a.state, f % 4] : a.state === 'lie' ? ['lie', 0] : a.state === 'sit' ? ['sit', 0] : ['stand', Math.floor(a.anim * 3) % 2];
      case 'cat': return a.state === 'walk' || a.state === 'run' ? ['walk', f % 4] : [a.state === 'idle' ? 'sit' : a.state, 0];
      case 'rabbit': return a.state === 'hop' ? ['hop', f % 2] : ['sit', 0];
      case 'squirrel': return a.state === 'hop' ? ['run', f % 2] : [a.state === 'sit' ? 'sit' : 'run', 0];
      default: return a.state === 'fly' ? ['fly', f % 2] : [a.state === 'peck' ? 'peck' : 'perch', f % 2];
    }
  }

  _drawAnimal(ctx, a) {
    const [pose, frame] = this._animalPose(a), spr = animalSprite(a.type, a.variant, pose, frame);
    const x = Math.round(a.x * S), y = Math.round(a.y * S), lift = a.type === 'bird' ? Math.round((a.alt || 0) * S) : (a.state === 'hop' && frame ? 2 : 0);
    if (a.type !== 'bird' || !a.alt) { ctx.fillStyle = 'rgba(16,16,40,0.25)'; ctx.fillRect(x - 4, y, 9, 1); }
    const sx = x - spr.ax, sy = y - spr.by - lift;
    if (a.face > 0) ctx.drawImage(spr.cv, sx, sy);
    else { ctx.save(); ctx.translate(sx + spr.cv.width, sy); ctx.scale(-1, 1); ctx.drawImage(spr.cv, 0, 0); ctx.restore(); }
  }

  /* ----- villager brains ----- */

  _plan(v) {
    const m = this._mode, r = Math.random(), job = v.job, n = this._villagers.length;
    const door = v.guest ? HOUSES[2].door : HOUSES[v.home].door;
    const home = (dur) => ({ x: door.x, y: door.y, enter: true, action: 'inside', dur });
    const seat = () => {
      // Two arcs either side of the fire, so nobody sits in it.
      const side = v.id % 2 ? -1 : 1, per = Math.ceil(n / 2), k = Math.floor(v.id / 2);
      const a = (per > 1 ? k / (per - 1) - 0.5 : 0) * 1.5 + rand(-0.1, 0.1);
      const x = FIRE.x + side * Math.cos(a) * 16, y = FIRE.y + 1 + Math.sin(a) * 8;
      return { x, y, face: -side };
    };
    const wander = () => {
      const r2 = Math.random();
      if (r2 < 0.55) {
        const pts = NAV.nodes.filter(([x]) => x > 8 && x < W - 8), [x, y] = pick(pts);
        return { x: x + rand(-1, 1), y: y + rand(-1, 1) };
      }
      if (r2 < 0.8) return { x: FIRE.x + rand(-20, 20), y: FIRE.y + rand(-7, 8) };
      return { x: rand(140, 166), y: rand(108, 124) };
    };
    const chat = () => {
      const others = this._villagers.filter((o) => o !== v && !o.inside && !o.gone && !o.walking);
      if (!others.length) return { ...wander(), action: 'idle', dur: rand(2, 4) };
      const o = pick(others);
      const side = o.x > W - 12 ? -1 : o.x < 12 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      return { x: o.x + side * 5, y: o.y, face: -side, action: 'chat', dur: rand(4, 8) };
    };
    const cook = () => ({ x: FIRE.x - 7, y: FIRE.y, face: 1, action: 'cook', dur: rand(8, 14) });
    const cafe = (action, dur) => {
      const taken = new Set(this._villagers.filter((o) => o !== v && o.plan?.seat !== undefined).map((o) => o.plan.seat));
      const free = CAFE_SEATS.map((_, i) => i).filter((i) => !taken.has(i));
      if (!free.length) return chat();
      const i = pick(free), st = CAFE_SEATS[i];
      return { x: st.x, y: st.y, face: st.face, seat: i, action, dur };
    };
    if (v.guest) return this._planGuest(v, { cafe, chat, wander });
    const rigger = this._villagers.find((o) => o.job === 'woodcutter') || this._villagers[0];
    const atScreen = { x: 20, y: 112.8, face: -1 };
    const atSign = { x: SIGN.x + 9, y: SIGN.base + 1.5, face: -1 };

    // Tidy up after an earlier mood before doing anything else.
    if (m !== 'movie' && m !== 'gaming') {
      if (v === rigger && this._screen > 0) {
        return { ...atScreen, action: 'teardown', dur: 3 * this._screen + 0.3, done: () => { this._screen = 0; } };
      }
    }
    if (m !== 'away') {
      if (this._sign && (this._signBy === null || this._signBy === v.id)) {
        this._signBy = v.id;
        return { ...atSign, action: 'unsign', dur: 1.5, done: () => { this._sign = 0; this._signBy = null; } };
      }
      if (v.gear) return { x: door.x, y: door.y, action: 'unpack', dur: 0.8, done: () => { v.gear = false; } };
    }

    switch (m) {
      case 'sleep': return home(rand(30, 60));
      case 'cozy': return home(rand(20, 40));
      case 'movie':
        if (v === rigger && this._screen < 1) {
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; } };
        }
        if (job === 'cook' && !this._popcorn) return { ...cook(), dur: 6, done: () => { this._popcorn = true; } };
        return { ...AMPHI_SEATS[v.id], action: 'watch', dur: rand(15, 30) };
      case 'gaming': {
        if (v === rigger && this._screen < 1) {
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; } };
        }
        // half the village plugs in at the amphitheater, the rest play handhelds at the café
        const idx = this._villagers.filter((o) => !o.guest).indexOf(v);
        if (job === 'cook' && r < 0.4) return { ...BARISTA, face: -1, action: 'serve', dur: rand(8, 14) };
        if (idx % 2 === 0 && idx < 8) return { ...AMPHI_SEATS[idx / 2], action: 'controller', dur: rand(20, 40) };
        return cafe('handheld', rand(15, 30));
      }
      case 'away': {
        if (!v.gear) return { x: door.x, y: door.y, action: 'pack', dur: rand(0.8, 1.6), done: () => { v.gear = true; } };
        // The last one out puts up the sign.
        const last = this._villagers.every((o) => o === v || o.guest || o.gone || o.plan?.gone);
        if (last && !this._sign) {
          return {
            ...atSign, carry: 'sign', drop: true, action: 'sign', dur: 2.5,
            onArrive: () => { this._sign = 1; }, done: () => { this._sign = 2; },
          };
        }
        return { x: W + 12, y: ENTRANCE[1] + rand(-1, 1), gone: true, action: 'gone', dur: 60 };
      }
      case 'morning':
        if (job === 'cook') return cook();
        if (job === 'carrier') return this._carrierPlan(v);
        if (r < 0.3) return cafe('sip', rand(8, 14));
        if (r < 0.55) return { ...seat(), action: 'eat', dur: rand(6, 12) };
        if (r < 0.7) return chat();
        return { ...wander(), action: 'idle', dur: rand(3, 6) };
      case 'meal':
        if (job === 'cook') return cook();
        if (job === 'child' && r < 0.3) return { ...wander(), action: 'play', dur: rand(2, 4) };
        if (r < 0.8) return { ...seat(), action: 'eat', dur: rand(8, 16) };
        return chat();
      case 'evening':
        if (job === 'child') return home(rand(30, 60));
        if (job === 'bard') return Math.random() < 0.5 ? { ...STAGE_SPOT, face: 1, action: 'perform', dur: rand(12, 20) } : { ...seat(), action: 'play', dur: rand(10, 20) };
        if (r < 0.2 && this._villagers.some((o) => o.action === 'perform')) return { ...AMPHI_SEATS[v.id], action: 'sit', dur: rand(10, 18) };
        if (r < 0.6) return { ...seat(), action: 'sit', dur: rand(8, 16) };
        if (r < 0.75) return cafe(Math.random() < 0.5 ? 'sip' : 'laptop', rand(10, 18));
        if (r < 0.9) return chat();
        return { ...wander(), action: 'idle', dur: rand(3, 6) };
      case 'party': {
        if (job === 'bard') return { x: FIRE.x + 21, y: FIRE.y - 9, face: -1, action: 'play', dur: rand(10, 20) };
        if (job === 'cook' && r < 0.3) return cook();
        v.ang += rand(0.5, 1.1);
        return {
          x: FIRE.x + Math.cos(v.ang) * 22, y: FIRE.y + 1 + Math.sin(v.ang) * 8,
          action: 'dance', dur: rand(1.5, 3.5),
        };
      }
      default: // work
        if (this._weather.heavy || (this._weather.rain && r < 0.35)) return home(rand(15, 30));
        if (job !== 'child' && job !== 'cook' && Math.random() < (job === 'bard' ? 0.3 : 0.15)) {
          return cafe(Math.random() < 0.65 ? 'laptop' : 'sip', rand(10, 20));
        }
        switch (job) {
          case 'farmer':
            if (r < 0.15) return chat();
            return { ...farmSpot(), face: pick([-1, 1]), action: 'farm', dur: rand(5, 10) };
          case 'woodcutter':
            if (r < 0.65) return { x: STUMP.x - 5, y: STUMP.y, face: 1, action: 'chop', dur: rand(6, 12) };
            return { x: HOUSES[2].door.x + 5, y: HOUSES[2].base + 3, face: -1, carry: 'log', drop: true, action: 'idle', dur: 1.5 };
          case 'carrier': return this._carrierPlan(v);
          case 'cook':
            if (r < 0.4) return { ...BARISTA, face: -1, action: 'serve', dur: rand(8, 14) };
            if (r < 0.65) return { x: HOUSES[2].door.x + 6, y: HOUSES[2].base + 3, face: -1, action: 'sweep', dur: rand(6, 10) };
            if (r < 0.85) return { ...farmSpot(), face: pick([-1, 1]), action: 'farm', dur: rand(5, 8) };
            return chat();
          case 'bard':
            if (r < 0.5) return { ...wander(), action: 'play', dur: rand(6, 12) };
            if (r < 0.8) return chat();
            return { ...wander(), action: 'idle', dur: rand(3, 6) };
          default: // child
            if (r < 0.25) return chat();
            return { ...wander(), action: 'play', dur: rand(2, 4), run: true };
        }
    }
  }

  _carrierPlan(v) {
    if (!v.water) return { x: WELL.x + 7, y: WELL.y, face: -1, action: 'fetch', dur: 3, done: () => { v.water = true; } };
    const dest = Math.random() < 0.6
      ? farmSpot()
      : { x: FIRE.x - 7, y: FIRE.y + 3 };
    return { ...dest, face: pick([-1, 1]), carry: 'bucket', action: 'water', dur: 2.5, done: () => { v.water = false; } };
  }

  _think(v) {
    let p = this._plan(v);
    if (v.inside && !p.enter) {
      v.inside = false;
      const d = HOUSES[v.home].door;
      v.x = d.x; v.y = d.y;
      if (v.slept) p = { x: d.x + rand(-4, 4), y: d.y + 3, face: pick([-1, 1]), action: 'stretch', dur: rand(2, 4) };
      v.slept = false;
    }
    if (v.inside) { v.plan = p; v.actT = p.dur; return; }
    if (v.gone && !p.gone) {
      v.gone = false;
      if (v.guest && v.entry === 'west') { v.x = -rand(6, 16); v.y = 93; }
      else { v.x = W + rand(6, 20); v.y = ENTRANCE[1] + rand(-1, 1); }
      if (!v.guest) v.bubble = { g: 'heart', c: '#e04060', t: 2 };
    }
    if (v.gone) { v.plan = p; v.actT = p.dur; return; }
    v.plan = p;
    v.path = route(v.x, v.y, p.x, p.y);
    [v.tx, v.ty] = v.path.shift();
    v.carry = p.carry || null;
    v.walking = true;
    v.action = 'walk';
  }

  _arrive(v) {
    const p = v.plan;
    v.walking = false;
    if (p.enter) v.inside = true;
    if (p.gone) { v.gone = true; if (v.guest) { v.active = false; v.leaving = false; v.bike = false; } }
    if (p.face) v.face = p.face;
    if (p.drop) v.carry = null;
    p.onArrive?.();
    v.action = p.action;
    v.actT = p.dur;
    v.fxT = rand(0, 0.5);
  }

  /* ----- simulation ----- */

  _update(dt) {
    const t = this._t, mode = this._mode;
    for (const v of this._villagers) {
      if (v.bubble && (v.bubble.t -= dt) <= 0) v.bubble = null;
      if (v.jumpT > 0) v.jumpT = Math.max(0, v.jumpT - dt);
      if (v.rethinkAt && t >= v.rethinkAt) { v.rethinkAt = 0; this._think(v); }
      if (v.inside || v.gone) {
        if (v.inside && mode === 'sleep') v.slept = true;
        if (!v.rethinkAt && (v.actT -= dt) <= 0) this._think(v);
        continue;
      }
      if (v.walking) {
        const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
        const step = (v.bike ? 26 : v.speed) * (v.plan?.run ? 1.3 : 1) * dt;
        if (Math.abs(dx) > 0.3) v.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          v.x = v.tx; v.y = v.ty;
          if (v.path?.length) [v.tx, v.ty] = v.path.shift();
          else this._arrive(v);
        }
        else { v.x += (dx / d) * step; v.y += (dy / d) * step; }
        continue;
      }
      v.actT -= dt;
      if (v.action === 'setup') this._screen = Math.min(1, this._screen + dt / 3);
      if (v.action === 'teardown') this._screen = Math.max(0, this._screen - dt / 3);
      if ((v.fxT -= dt) <= 0) this._actionFx(v);
      if (v.actT <= 0 && !v.rethinkAt) {
        v.plan?.done?.();
        this._think(v);
      }
    }

    // houses: chimney smoke and sleepy z's
    const occ = this._occupancy();
    const dark = this._phase !== 'day';
    HOUSES.forEach((h, i) => {
      const fx = this._houseFx[i], o = occ[i];
      const lit = this._isLit(i, o, dark);
      const smoky = lit || mode === 'morning' || (this._weather.snow && o.inside) || (h.tavern && (mode === 'meal' || mode === 'party'));
      o.lit = lit;
      if (smoky && (fx.smoke -= dt) <= 0) {
        fx.smoke = rand(0.35, 0.6);
        this._spawn({ x: h.chim.x + 1 + rand(-0.5, 0.5), y: h.chim.y, vx: rand(1, 3), vy: rand(-7, -5), life: rand(2.5, 3.5), c: '#d4d4d8', s: 1, layer: 0, grow: true });
      }
      if (o.sleeping && (fx.z -= dt) <= 0) {
        fx.z = rand(1.4, 2.2);
        this._spawn({ x: h.x + h.w - 4, y: h.base - h.h - 2, vx: rand(2, 4), vy: -4, life: 3, g: 'z', c: '#e8ecff', layer: 1 });
      }
    });
    this._occ = occ;

    // fire sparks and pot steam
    const lvl = this._fireLevel();
    if (lvl >= 2 && Math.random() < dt * (lvl === 3 ? 10 : 3)) {
      this._spawn({ x: FIRE.x + rand(-2, 2), y: FIRE.y - 3, vx: rand(-4, 4), vy: rand(-18, -10), life: rand(0.5, 1.2), c: pick(['#ffd84a', '#ff9a30']), layer: 1 });
    }
    if (this._potOn() && Math.random() < dt * 3) {
      this._spawn({ x: FIRE.x + rand(-2, 2), y: FIRE.y - 7, vx: rand(-1, 1), vy: -5, life: 1.5, c: '#f0f0f0', layer: 0 });
    }

    // particles
    for (const p of this._particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += 60 * dt;
    }
    this._particles = this._particles.filter((p) => p.life > 0);

    // sky
    for (const c of this._clouds) {
      c.x += c.v * dt * (this._weather.storm ? 3 : 1);
      if (c.x > RW + 4) { c.x = -c.w - 8; c.y = rand(6, 80); }
    }
    for (const f of this._flies) {
      f.p += dt;
      f.x += Math.sin(f.p * 0.7) * 4 * dt;
      f.y += Math.cos(f.p * 0.9) * 3 * dt;
    }
    this._updateAnimals(dt);
    this._updateWeather(dt);
  }

  _actionFx(v) {
    const hx = v.x + 2 * v.face;
    switch (v.action) {
      case 'chop':
        v.fxT = 0.5;
        for (let i = 0; i < 2; i++) this._spawn({ x: STUMP.x, y: STUMP.y - 3, vx: rand(-12, 12), vy: rand(-25, -12), life: 0.6, c: '#d8a868', grav: true, layer: 0 });
        break;
      case 'farm':
        v.fxT = 0.5;
        this._spawn({ x: hx + v.face * 2, y: v.y - 1, vx: rand(-6, 6), vy: rand(-14, -8), life: 0.4, c: '#5e3e24', grav: true, layer: 0 });
        break;
      case 'water':
        v.fxT = 0.12;
        this._spawn({ x: hx + v.face, y: v.y - 3, vx: v.face * 4, vy: 4, life: 0.4, c: '#6ab0f0', grav: true, layer: 0 });
        break;
      case 'sweep':
        v.fxT = 0.4;
        this._spawn({ x: hx + v.face * 2, y: v.y, vx: v.face * 6, vy: -3, life: 0.6, c: '#c8b088', layer: 0 });
        break;
      case 'play': case 'perform':
        v.fxT = v.job === 'child' ? 99 : rand(0.6, 1);
        if (v.job !== 'child') this._spawn({ x: v.x + v.face * 3, y: v.y - 10, vx: rand(-3, 3), vy: -6, life: 2, g: 'note', c: pick(['#fff4a0', '#ffd0f0', '#c0f0ff']), layer: 1 });
        break;
      case 'chat':
        v.fxT = rand(1.8, 3);
        v.bubble = Math.random() < 0.15 ? { g: 'heart', c: '#e04060', t: 1.2 } : { g: 'dots', c: '#333', t: 1.2 };
        break;
      case 'dance':
        v.fxT = rand(1.5, 3);
        if (Math.random() < 0.3) this._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -5, life: 1.5, g: 'heart', c: '#ff6080', layer: 1 });
        break;
      case 'watch': {
        v.fxT = rand(3, 7);
        if (this._screen < 1) break;
        const sc = this._filmScene();
        if (sc === 2 && Math.random() < 0.5) this._spawn({ x: v.x, y: v.y - 10, vx: 0, vy: -4, life: 1.5, g: 'heart', c: '#ff6080', layer: 1 });
        else if (sc === 0 && Math.random() < 0.3) v.bubble = { g: 'bang', c: '#d03030', t: 1 };
        break;
      }
      case 'sign': case 'unsign':
        v.fxT = 0.5;
        this._spawn({ x: SIGN.x, y: SIGN.base - 4, vx: rand(-8, 8), vy: rand(-14, -8), life: 0.4, c: '#e0bc78', grav: true, layer: 0 });
        break;
      case 'handheld': case 'controller':
        v.fxT = rand(2, 5);
        if (Math.random() < 0.15) v.bubble = { g: 'bang', c: '#d03030', t: 1 };
        else if (v.action === 'controller' && Math.random() < 0.12) { v.jumpT = 0.5; v.bubble = { g: 'heart', c: '#e04060', t: 1.4 }; }
        break;
      case 'serve': case 'sip': case 'laptop': {
        v.fxT = rand(1.2, 2.5);
        const sx = v.action === 'serve' ? CART.x / S + 2 : v.x + v.face * 3;
        this._spawn({ x: sx + rand(-0.5, 0.5), y: v.action === 'serve' ? CART.by / S - 11 : v.y - 5, vx: rand(-0.5, 0.5), vy: -3, life: 1.2, c: '#f4f4f4', layer: 0 });
        if (v.action === 'laptop' && Math.random() < 0.15) v.bubble = { g: 'dots', c: '#333', t: 1 };
        break;
      }
      case 'idle':
        v.fxT = rand(1.5, 4);
        if (Math.random() < 0.5) v.face = -v.face;
        break;
      default:
        v.fxT = 1;
    }
  }

  _occupancy() {
    const occ = HOUSES.map(() => ({ inside: 0, sleeping: 0 }));
    for (const v of this._villagers) {
      if (!v.inside || v.guest) continue;
      occ[v.home].inside++;
      if (this._mode === 'sleep') occ[v.home].sleeping++;
    }
    return occ;
  }

  _isLit(i, o, dark) {
    const m = this._mode;
    if (m === 'sleep') return false;
    if (o.inside) return true;
    if (HOUSES[i].tavern && (m === 'party' || m === 'meal')) return true;
    return dark && (m === 'evening' || m === 'party' || m === 'cozy');
  }

  _fireLevel() {
    const m = this._mode;
    if (m === 'away') return 0;
    if (m === 'party') return 3;
    if (m === 'morning' || m === 'meal' || m === 'evening') return this._weather.heavy ? 1 : 2;
    return 1;
  }

  _potOn() {
    return this._mode === 'morning' || this._mode === 'meal' || this._villagers.some((v) => v.action === 'cook');
  }

  _updateWeather(dt) {
    const w = this._weather;
    const want = w.rain ? (w.heavy ? 70 : 40) : w.snow ? 45 : 0;
    while (this._drops.length < want) {
      this._drops.push({ x: rand(0, W + 20), y: rand(-H, 0), land: rand(HORIZON, H), v: w.snow ? rand(8, 14) : rand(90, 130), snow: w.snow && !(w.rain && Math.random() < 0.5), p: rand(0, 6) });
    }
    if (this._drops.length > want) this._drops.length = want;
    for (const d of this._drops) {
      d.p += dt;
      d.y += d.v * dt;
      d.x += d.snow ? Math.sin(d.p) * 6 * dt : -14 * dt;
      if (d.y > d.land) {
        if (!d.snow && this._splashes.length < 30) this._splashes.push({ x: d.x, y: d.land, t: 0.15 });
        d.y = rand(-10, 0); d.x = rand(0, W + 20);
      }
    }
    for (const s of this._splashes) s.t -= dt;
    this._splashes = this._splashes.filter((s) => s.t > 0);
    if (w.storm) {
      this._flash = Math.max(0, this._flash - dt);
      if ((this._nextFlash -= dt) <= 0) { this._flash = 0.15; this._nextFlash = rand(5, 14); }
    }
  }

  _spawn(p) {
    if (this._particles.length < 220) this._particles.push(p);
  }

  _click(e) {
    const r = this._canvas.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * W, cy = ((e.clientY - r.top) / r.height) * H;
    const v = this._villagers.find((o) => !o.inside && !o.gone && Math.abs(o.x - cx) < 4 && cy > o.y - 11 && cy < o.y + 2);
    if (v) {
      v.jumpT = 0.5;
      v.bubble = { g: 'heart', c: '#e04060', t: 1.5 };
      return;
    }
    const h = HOUSES.findIndex((o) => cx >= o.x && cx <= o.x + o.w && cy > o.base - o.h - 9 && cy < o.base);
    if (h >= 0 && this._occ?.[h]?.sleeping) {
      for (let i = 0; i < 3; i++) this._spawn({ x: cx + rand(-3, 3), y: cy, vx: rand(-4, 4), vy: rand(-8, -4), life: 2, g: 'z', c: '#e8ecff', layer: 1 });
      return;
    }
    if (Math.abs(cx - FIRE.x) < 8 && Math.abs(cy - FIRE.y) < 8) {
      for (let i = 0; i < 14; i++) this._spawn({ x: FIRE.x, y: FIRE.y - 3, vx: rand(-15, 15), vy: rand(-30, -12), life: rand(0.6, 1.3), c: pick(['#ffd84a', '#ff9a30', '#ff5a20']), layer: 1 });
    }
  }

  /* ----- rendering ----- */

  _tint() {
    let t = TINT[this._phase];
    if (this._weather.overcast) t = t ? mulHex(t, OVERCAST_TINT) : OVERCAST_TINT;
    return t;
  }

  _buildBg() {
    const w = this._weather, ph = this._phase;
    const key = `${ph}|${w.snow ? 's' : ''}|${w.overcast ? 'o' : ''}`;
    if (key === this._bgKey) return;
    this._bgKey = key;
    const landKey = w.snow ? 'snow' : 'green';
    if (this._landKey !== landKey) {
      this._land = buildLand(w.snow);
      this._landKey = landKey;
    }
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
    g.drawImage(this._land, 0, 0);
  }

  _art() {
    if (!this._a) {
      this._a = {
        pot: makePot(),
        projector: makeProjector(),
        sign: makeSign(),
        stages: {},
        houses: {},
        tables: TABLES.map(([, , c]) => makeCafeTable(c)),
        puffs: [null, 1, 2, 3, 4, 5].map((r) => r && makePuff(r, '#ffffff', '#e2e4ec', '#b4b8c8')),
        film: [0, 1, 2].map(makeFilmBg),
      };
    }
    return this._a;
  }

  _glow(ctx, x, y, r, rgb, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  _render() {
    const ctx = this._ctx, w = this._weather, ph = this._phase, a = this._art();
    this._buildBg();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._bg, 0, 0);

    if (ph !== 'night' && !w.overcast) this._drawSun(ctx);
    this._drawClouds(ctx);
    if (this._mode === 'party') this._drawBunting(ctx);

    // depth-sorted world objects
    const items = [];
    for (const v of this._villagers) if (!v.inside && !v.gone) items.push({ y: v.y, d: () => this._drawVillager(ctx, v) });
    if (this._potOn()) items.push({ y: FIRE.y + 0.5, d: () => this._drawPot(ctx) });
    const stage = (a.stages[w.snow ? 1 : 0] ||= makeStage(w.snow));
    items.push({ y: 112.5, d: () => { ctx.drawImage(stage.cv, stage.x, stage.y); this._drawScreen(ctx); } });
    if (this._screen > 0) items.push({ y: PROJ.y, d: () => this._drawProjector(ctx) });
    if (this._mode === 'gaming' && this._screen > 0) items.push({ y: 112.6, d: () => this._drawConsole(ctx) });
    const houses = (a.houses[w.snow ? 1 : 0] ||= HOUSES.map((h) => makeHouse(h, w.snow)));
    HOUSES.forEach((h, i) => items.push({ y: h.base + 0.3, d: () => ctx.drawImage(houses[i].cv, houses[i].x, houses[i].y) }));
    TABLES.forEach(([tx, ty], i) => items.push({ y: (ty + 3) / S, d: () => this._drawTable(ctx, i, tx, ty) }));
    if (this._sign === 2) {
      const spr = a.sign;
      items.push({ y: SIGN.base, d: () => ctx.drawImage(spr.cv, Math.round(SIGN.x * S) - spr.ax, Math.round(SIGN.base * S) - spr.by) });
    }
    for (const an of this._animals) if (!an.hidden && !(an.type === 'bird' && an.state === 'fly')) items.push({ y: an.y, d: () => this._drawAnimal(ctx, an) });
    for (const v of this._villagers) {
      if (!v.parked) continue;
      const bk = (a.bike ||= makeParkedBike()), px = Math.round(v.parked.x * S), py = Math.round(v.parked.y * S);
      items.push({ y: v.parked.y - 0.01, d: () => ctx.drawImage(bk.cv, px - bk.ax, py - bk.by) });
    }
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.d();
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
    if (ph !== 'day') this._drawStars(ctx);
    if (ph === 'night') this._drawMoon(ctx);
    this._drawWindows(ctx, dark);
    this._drawCafeLights(ctx, dark);
    this._drawFlames(ctx, dark);
    if (this._mode === 'party') this._drawPartyLights(ctx, dark);
    if ((this._mode === 'movie' || this._mode === 'gaming') && this._screen >= 1) this._drawFilm(ctx, dark);
    if (this._mode === 'gaming' && dark) for (const v of this._villagers) if (!v.walking && v.action === 'handheld') this._glow(ctx, v.x * S + v.face * 6, v.y * S - 11, 8, '150,210,255', 0.45);
    if (this._screen > 0) this._drawReels(ctx);
    if (ph === 'night' && !w.rain && !w.snow) this._drawFireflies(ctx);
    if (!w.snow && Math.random() < 0.6) {
      P(ctx, POND.x + Math.round(rand(-14, 14)), POND.y + Math.round(rand(-5, 5)), 2, 1, dark ? 'rgba(200,215,255,0.5)' : 'rgba(255,255,255,0.8)');
    }
    this._drawParticles(ctx, 1);
    this._drawWeather(ctx, dark);
    for (const v of this._villagers) if (v.bubble && !v.inside && !v.gone) this._drawBubble(ctx, v);
  }

  _seated(i) {
    return this._villagers.find((v) => !v.walking && !v.inside && !v.gone && v.plan?.seat === i && ['laptop', 'sip'].includes(v.action));
  }

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
  }

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
  }

  _drawSun(ctx) {
    const sun = this._hass?.states?.[this._config.sun_entity];
    let x, y;
    if (typeof this.previewHour !== 'number' && sun?.attributes?.azimuth !== undefined) {
      x = 10 + ((sun.attributes.azimuth - 90) / 180) * (W - 20);
      y = 52 - sun.attributes.elevation * 0.8;
    } else {
      const p = (this._hourNow - 6) / 13;
      x = 10 + p * (W - 20); y = 52 - Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 42;
    }
    const X = Math.round(x * S), Y = Math.round(Math.max(6, y) * S);
    if (Y > HZ + 10 || X < -20 || X > RW + 20) return;
    const low = this._phase !== 'day';
    this._glow(ctx, X, Y, 40, low ? '255,150,80' : '255,240,180', 0.35);
    disc(ctx, X, Y, 11, low ? '#ff9a50' : '#ffe890');
    disc(ctx, X - 1, Y - 1, 9, low ? '#ffc080' : '#fff6c8');
    disc(ctx, X - 3, Y - 3, 4, '#ffffff');
  }

  _drawMoon(ctx) {
    const p = ((this._hourNow - 18 + 24) % 24) / 13;
    if (p > 1 || this._weather.overcast) return;
    const X = Math.round((10 + p * (W - 20)) * S), Y = Math.round((50 - Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 40) * S);
    this._glow(ctx, X, Y, 34, '200,215,255', 0.28);
    disc(ctx, X, Y, 9, '#d8d4c0');
    disc(ctx, X - 1, Y - 1, 8, '#f6f2dc');
    for (const [dx, dy, r] of [[-3, -2, 2], [3, 2, 1], [1, -4, 1], [-1, 4, 1]]) disc(ctx, X + dx, Y + dy, r, '#dcd6c0');
  }

  _drawStars(ctx) {
    if (this._weather.overcast) return;
    const a = this._phase === 'night' ? 1 : 0.35;
    for (const s of this._stars) {
      const tw = 0.55 + 0.45 * Math.sin(this._t * 2 + s.p * 5);
      ctx.fillStyle = `rgba(255,255,235,${(s.b * tw * a).toFixed(2)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
      if (s.big && tw > 0.8) { ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); }
    }
  }

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
  }

  _drawPot(ctx) {
    const p = this._art().pot, X = FIRE.x * S, by = FIRE.y * S + 5;
    ctx.drawImage(p.cv, X - p.ax, by - p.by);
    if (Math.random() < 0.5) P(ctx, X - 4 + Math.floor(Math.random() * 8), by - 17, 2, 1, '#ffd078');
  }

  _drawScreen(ctx) {
    const Q = SCREEN_Q;
    if (this._screen <= 0) return;
    for (let x = Q.lx + 1; x < Q.rx; x++) {
      const u = (x - Q.lx) / (Q.rx - Q.lx), top = stairY(x, Q.ltop) + 2, bot = stairY(x, Q.lbot) - 1;
      const h = Math.round((bot - top) * this._screen);
      P(ctx, x, top, 1, h, u > 0.8 ? '#ddd4c0' : '#efe8d6');
      P(ctx, x, top + h, 1, 1, OUT);
    }
  }

  // Draw the film flat, then lay it onto the angled screen one column at a time.
  _blitAngled(ctx, cv) {
    const Q = SCREEN_Q, a = Q.lx + 2, b = Q.rx - 2;
    for (let x = a; x <= b; x++) {
      const u = (x - a) / (b - a), sx = Math.min(FILM_W - 1, Math.floor(u * FILM_W));
      const top = stairY(x, Q.ltop) + 5, bot = stairY(x, Q.lbot) - 3;
      ctx.drawImage(cv, sx, 0, 1, FILM_H, x, top, 1, bot - top);
    }
  }

  _drawProjector(ctx) {
    // faces left, toward the stage
    const p = this._art().projector;
    p.l = p.l || flipH(p.cv);
    ctx.drawImage(p.l, PROJ.x * S - (p.cv.width - 1 - p.ax), PROJ.y * S - p.by);
  }

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
  }

  _filmScene() {
    return Math.floor(this._t / 6) % 3;
  }

  _drawFilm(ctx, dark) {
    const a = this._art(), Q = SCREEN_Q;
    const sc = this._filmScene(), u = this._t % 6;
    const lens = [PROJ.x * S - a.projector.lens[0], PROJ.y * S + a.projector.lens[1]];

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(200,215,255,${dark ? 0.1 : 0.04})`;
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
  }

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
  }

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
  }

  // Retro games on the big screen: a platformer, a racer and a game of pong.
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
  }

  _partyStrings() {
    const [l0, l1] = LAMPS, tv = HOUSES[2].g;
    return [[[l0[0], l0[1] - 40], [l1[0], l1[1] - 40]], [[l0[0], l0[1] - 40], [tv.X - 4, tv.top + 6]], [[tv.X + tv.Wd + 4, tv.top + 6], [l1[0], l1[1] - 40]]]
      .map(([[x0, y0], [x1, y1]]) => {
        const pts = [], n = Math.max(2, Math.round(Math.abs(x1 - x0) / 4));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          pts.push([Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 14)]);
        }
        return pts;
      });
  }

  _drawBunting(ctx) {
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
  }

  _drawPartyLights(ctx, dark) {
    const cols = ['255,80,80', '255,210,60', '80,230,110', '80,160,255', '255,110,210'];
    this._partyStrings().forEach((pts) => {
      pts.forEach(([x, y], i) => {
        if (i % 3) return;
        const c = cols[(i / 3 + Math.floor(this._t * 3)) % cols.length];
        P(ctx, x, y + 1, 2, 3, `rgb(${c})`); P(ctx, x, y + 1, 1, 1, '#ffffff');
        if (dark) this._glow(ctx, x + 1, y + 2, 8, c, 0.45);
      });
    });
  }

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
        for (const [lx, ly] of amphiLanterns()) { P(ctx, lx - 1, ly - 1, 3, 3, '#ffe48a'); this._glow(ctx, lx, ly, 16, '255,190,90', 0.4); }
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
  }

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
      for (let i = 0; i < hc; i++) {
        const v = i / maxH, inner = Math.abs(u) / Math.max(0.15, 1 - v * 0.9);
        let c;
        if (i >= hc - 2) c = '#d83a18';
        else if (inner < 0.35 && v < 0.55) c = '#fff6c8';
        else if (inner < 0.7 && v < 0.78) c = '#ffc038';
        else c = '#ff7a20';
        ctx.fillStyle = c;
        ctx.fillRect(cx + dx, by - 3 - i, 1, 1);
      }
    }
    if (!pot && Math.random() < 0.6) P(ctx, cx + Math.round(rand(-5, 5)), by - maxH - Math.round(rand(2, 8)), 2, 2, '#ff9a30');
  }

  _drawFireflies(ctx) {
    for (const f of this._flies) {
      const a = Math.max(0, Math.sin(f.p * 1.7));
      if (a < 0.2) continue;
      const x = Math.round(f.x * S), y = Math.round(f.y * S);
      ctx.fillStyle = `rgba(220,255,120,${(a * 0.35).toFixed(2)})`;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = `rgba(240,255,170,${a.toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

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
  }

  _drawWeather(ctx, dark) {
    const w = this._weather;
    for (const d of this._drops) {
      const x = Math.round(d.x * S), y = Math.round(d.y * S);
      if (d.snow) { P(ctx, x, y, 2, 2, '#ffffff'); P(ctx, x + 1, y + 1, 1, 1, '#c8d4ec'); }
      else P(ctx, x, y, 1, 6, dark ? 'rgba(160,180,230,0.55)' : 'rgba(190,215,245,0.7)');
    }
    for (const s of this._splashes || []) {
      const x = Math.round(s.x * S), y = Math.round(s.y * S);
      ctx.fillStyle = 'rgba(200,220,250,0.7)';
      ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillRect(x - 1, y, 3, 1);
    }
    if (w.fog) {
      for (let i = 0; i < 5; i++) {
        const y = 120 + i * 42 + Math.round(Math.sin(this._t * 0.3 + i) * 6);
        ctx.fillStyle = 'rgba(225,230,238,0.16)';
        ctx.fillRect(0, y, RW, 30); ctx.fillRect(0, y + 6, RW, 18);
      }
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
  }

  _glyph(ctx, name, x, y, c) {
    const g = GLYPHS[name];
    const ox = x - (g[0].length >> 1);
    tpl(ctx, g, ox + 1, y + 1, { '#': 'rgba(20,10,30,0.55)' });
    tpl(ctx, g, ox, y, { '#': c });
    if (name === 'heart') P(ctx, ox + 1, y + 1, 1, 1, '#ffffff');
  }

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
  }

  _poseOf(v) {
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
      default: pose = 'idle';
    }
    const [, rate, order] = ANIM[pose];
    const step = Math.floor(this._t * rate + v.seed * 10) % order.length;
    return { pose, frame: order[step], step };
  }

  _lift(v) {
    const { pose, step } = this._poseOf(v);
    let lift = LIFT[pose] ? LIFT[pose][step % 4] : 0;
    if (pose === 'walk' && this._mode === 'party') lift = step % 3 === 1 ? 2 : 0;
    if (v.jumpT > 0) lift += Math.round(Math.sin((v.jumpT / 0.5) * Math.PI) * 4);
    return lift;
  }

  _drawVillager(ctx, v) {
    const { pose, frame } = this._poseOf(v);
    const key = `${pose}|${frame}|${v.carry || ''}|${v.gear ? 1 : 0}`;
    let spr = v.sprites.get(key);
    if (!spr) {
      spr = buildVillager(v, pose, frame, v.carry, v.gear);
      v.sprites.set(key, spr);
    }
    const x = Math.round(v.x * S), y = Math.round(v.y * S);
    ctx.fillStyle = 'rgba(16,16,40,0.3)';
    ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 7, y, 15, 1);
    const sx = x - AX, sy = y - FY - this._lift(v) * S;
    if (v.face > 0) ctx.drawImage(spr.cv, sx, sy);
    else {
      // mirror at draw time instead of caching a flipped copy of every frame
      ctx.save(); ctx.translate(sx + SW, sy); ctx.scale(-1, 1); ctx.drawImage(spr.cv, 0, 0); ctx.restore();
    }
    if ((this._t + v.seed * 7) % 4 < 0.15) {
      const ex = v.face > 0 ? sx + spr.eyeX : sx + SW - 2 - spr.eyeX;
      P(ctx, ex, sy + spr.eyeY, 2, 2, v.look.skin);
      P(ctx, ex, sy + spr.eyeY + 1, 2, 1, ramp(v.look.skin).o);
    }
  }

}

if (!customElements.get('pixel-village-card-editor')) customElements.define('pixel-village-card-editor', PixelVillageCardEditor);
if (!customElements.get('pixel-village-card')) {
  customElements.define('pixel-village-card', PixelVillageCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'pixel-village-card',
    name: 'Pixel Village',
    description: 'A tiny pixel-art village that lives along with your home.',
    preview: true,
  });
  console.info(`%c PIXEL-VILLAGE-CARD %c v${PV_VERSION} `, 'background:#3f9a50;color:#fff;border-radius:3px 0 0 3px', 'background:#2c3a70;color:#fff;border-radius:0 3px 3px 0');
}

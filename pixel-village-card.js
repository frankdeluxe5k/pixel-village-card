/*
 * Pixel Village Card for Home Assistant
 * A tiny living pixel-art village that follows the time of day, the weather
 * and whatever is happening in your home (scenes, media players, alarm...).
 *
 * Everything is drawn procedurally: no image files, no dependencies.
 * The simulation runs on a 224x126 grid; art is drawn at 3x (672x378) in a
 * 16-bit arcade style. Sprites and scenery are rendered once and cached, and
 * the card only animates while it is actually on screen.
 */
const PV_VERSION = '2.2.0';

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

const DEFAULT_FPS = 15;

const isLive = (st) => !!st && st.state !== 'unavailable' && st.state !== 'unknown';
function autoWeather(states) {
  const ids = Object.keys(states).filter((k) => k.startsWith('weather.'));
  return ids.find((k) => isLive(states[k])) || ids[0] || null;
}

// Clear errors for the editor and HA's error card instead of a village that silently ignores things.
function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
  if (config.triggers !== undefined && !Array.isArray(config.triggers)) throw new Error('triggers must be a list');
  (config.triggers || []).forEach((t, i) => {
    const at = `triggers[${i + 1}]`;
    if (!t || typeof t !== 'object') throw new Error(`${at} must be an object with an entity and a mode`);
    if (t.entity !== undefined && typeof t.entity !== 'string') throw new Error(`${at}.entity must be an entity id`);
    if (t.mode !== undefined && t.mode !== 'auto' && !MODES[t.mode] && !eventOfMode(t.mode)) throw new Error(`${at}.mode "${t.mode}" isn't a mood (use auto, one of: ${Object.keys(MODES).join(', ')}, or an event: ${EVENT_MODES.join(', ')})`);
    if (t.when !== undefined && !REACTION_KINDS.includes(t.when)) throw new Error(`${at}.when "${t.when}" isn't one of: ${REACTION_KINDS.join(', ')}`);
    if (t.duration !== undefined && !(Number(t.duration) > 0)) throw new Error(`${at}.duration must be a number of minutes`);
  });
  if (config.villagers !== undefined && !(Number(config.villagers) >= 1)) throw new Error('villagers must be a number from 1 to 10');
  if (config.fps !== undefined && !(Number(config.fps) > 0)) throw new Error('fps must be a number (2 to 30)');
  if (config.events !== undefined && typeof config.events !== 'boolean') throw new Error('events must be true or false');
  if (config.event_frequency !== undefined && !['rare', 'daily', 'often'].includes(config.event_frequency)) throw new Error('event_frequency must be rare, daily or often');
  if (config.schedule !== undefined && (typeof config.schedule !== 'object' || Array.isArray(config.schedule))) throw new Error('schedule must be a map of times');
  for (const [k, v] of Object.entries(config.schedule || {})) {
    if (!(k in DEFAULT_SCHEDULE)) throw new Error(`schedule.${k} isn't a schedule entry (use: ${Object.keys(DEFAULT_SCHEDULE).join(', ')})`);
    const h = parseHour(v);
    if (!(h >= 0 && h < 24)) throw new Error(`schedule.${k} must be a time like "06:30"`);
  }
}

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
const WELL = { x: 145, y: 73 };
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
// The farm, set back at the back centre (render pixels). It starts right of the blue house so nobody
// working it is hidden behind that roof.
const FARM = { x0: 192, x1: 268, y0: 198, y1: 226 };
const farmSpot = () => ({ x: rand(66, 87), y: rand(67, 74) });

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

// Away: where visitors stand to read the BACK SOON sign on the amphitheater screen.
const AWAY_READ = { x: 29, y: 115.2 };
// Where the travelling band plays: up in front of the tavern, above the string lights over the square,
// the drummer a step back in the middle. Same order as INSTRUMENTS.
const BAND_SPOTS = [{ x: 94.5, y: 84.5, face: 1 }, { x: 86, y: 88.5, face: 1 }, { x: 102, y: 88.5, face: -1 }, { x: 109, y: 88, face: -1 }];
const INSTRUMENTS = ['drums', 'bass', 'guitar', 'guitar'];
// The band's look: young garage-rock kids. Guitar body colours by member.
const BAND_LOOKS = [
  { hair: '#26222e', style: 'messy', shirt: '#2e2e38', pants: '#3a4a6a', top: 'print', hat: 'bandbeanie' },
  { hair: '#e8dca8', style: 'swoop', shirt: '#ececf0', pants: '#22222c', top: 'stripes' },
  { hair: '#26222e', style: 'swoop', shirt: '#b8303a', pants: '#2a2a3a', top: 'flannel', streak: '#e04a5a' },
  { hair: '#a8381c', style: 'spiky', shirt: '#3a9aa8', pants: '#2a2a3a', top: 'tee' },
];
const BAND_GUITARS = ['#2a2a34', '#ece6d4', '#d02a34', '#3a6ad0'];

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
// Temporary footprints of event props (carts, stalls, sculptures), per card; every card's count, like FOOTPRINTS.
// `eventRects` is the flat list `blocked()` reads; refresh it with `setEventBlocks` whenever the map changes.
const EVENT_BLOCKS = new Map();
let eventRects = [];
function setEventBlocks(card, list) {
  if (list) EVENT_BLOCKS.set(card, list); else EVENT_BLOCKS.delete(card);
  eventRects = [...EVENT_BLOCKS.values()].flat();
  eventCorners = cornersOf(eventRects);
}
const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
const blocked = (x, y) => {
  for (const r of FOOTPRINTS) if (inRect(x, y, r)) return true;
  for (const r of eventRects) if (inRect(x, y, r)) return true;
  return false;
};
// Does the segment pass through the inside of rect r? (exact, so a path can't clip a corner between samples)
function segHits(x0, y0, x1, y1, r) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, d, lo, hi] of [[x0, dx, r[0], r[2]], [y0, dy, r[1], r[3]]]) {
    if (Math.abs(d) < 1e-9) { if (p <= lo || p >= hi) return false; continue; }
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 >= t1) return false;
  }
  return true;
}
function clearPath(x0, y0, x1, y1) {
  for (const r of FOOTPRINTS) if (segHits(x0, y0, x1, y1, r)) return false;
  for (const r of eventRects) if (segHits(x0, y0, x1, y1, r)) return false;
  return true;
}
function freeSpot(x, y) {
  for (let k = 0; k < 12 && blocked(x, y); k++) y += 1;
  return [x, y];
}
// Just outside each footprint's corners: detours for spots no path node can see (behind a house, the well,
// right in front of a parked cart). Event props' corners are added while they stand.
const cornersOf = (rects) => rects.flatMap(([x0, y0, x1, y1]) => [[x0 - 1.5, y0 - 1], [x1 + 1.5, y0 - 1], [x0 - 1.5, y1 + 1], [x1 + 1.5, y1 + 1]])
  .filter(([x, y]) => y > HORIZON + 3 && x > 1 && x < W - 1 && !FOOTPRINTS.some((r) => inRect(x, y, r)));
const CORNERS = cornersOf(FOOTPRINTS);
let eventCorners = [];

function route(x0, y0, x1, y1) {
  const out = [];
  // someone standing inside a footprint (an event prop went up around them) steps out to its front first
  if (blocked(x0, y0)) { [x0, y0] = freeSpot(x0, y0); out.push([x0, y0]); }
  if (clearPath(x0, y0, x1, y1)) return [...out, [x1, y1]];
  const { nodes, adj } = NAV;
  const nearest = (x, y) => {
    let best = -1, bd = 1e9;
    nodes.forEach(([nx, ny], i) => {
      const d = Math.hypot(nx - x, ny - y);
      if (d < bd && clearPath(x, y, nx, ny)) { bd = d; best = i; }
    });
    return best;
  };
  // the nearest node in sight, or one seen from a footprint corner that is in sight
  const reach = (x, y) => {
    const i = nearest(x, y);
    if (i >= 0) return { i, via: null };
    let best = null, bd = 1e9;
    for (const c of [...CORNERS, ...eventCorners]) {
      const d = Math.hypot(c[0] - x, c[1] - y);
      if (d >= bd || blocked(c[0], c[1]) || !clearPath(x, y, c[0], c[1])) continue;
      const j = nearest(c[0], c[1]);
      if (j >= 0) { bd = d; best = { i: j, via: c }; }
    }
    return best;
  };
  const A = reach(x0, y0), B = reach(x1, y1);
  if (!A || !B) return [...out, [x1, y1]];
  const a = A.i, b = B.i;
  const prev = new Array(nodes.length).fill(-1), seen = new Set([a]), queue = [a];
  while (queue.length) {
    const i = queue.shift();
    if (i === b) break;
    for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); prev[j] = i; queue.push(j); }
  }
  const path = [];
  for (let i = b; i !== -1; i = prev[i]) path.unshift([nodes[i][0], nodes[i][1]]);
  if (A.via) out.push([A.via[0], A.via[1]]);
  out.push(...path);
  if (B.via) out.push([B.via[0], B.via[1]]);
  out.push([x1, y1]);
  return out;
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
  coin:  ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  star:  ['..#..', '..#..', '#####', '.###.', '.#.#.'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  q:     ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'],
  spark: ['..#..', '..#..', '##.##', '..#..', '..#..'],
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
  // bedtime can be after midnight (sleep 00:30, wake 06:30): then the small hours before it are still evening
  const late = s.sleep < s.wake;
  if (late ? h >= s.sleep && h < s.wake : h < s.wake || h >= s.sleep) return 'sleep';
  if (late && h < s.sleep) return 'evening';
  if (h < s.work) return 'morning';
  if (h < s.lunch) return 'work';
  if (h < s.work_after_lunch) return 'meal';
  if (h < s.dinner) return 'work';
  if (h < s.evening) return 'meal';
  return 'evening';
}

// Home Assistant weather conditions: clear-night, cloudy, exceptional, fog, hail, lightning,
// lightning-rainy, partlycloudy, pouring, rainy, snowy, snowy-rainy, sunny, windy, windy-variant.
// Anything else (unknown, unavailable, no entity) reads as clear.
function readWeather(state) {
  const s = state || '';
  return {
    state: s,
    rain: /rain|pouring|hail/.test(s),
    heavy: /pouring|lightning|hail/.test(s),
    hail: s === 'hail',
    snow: /snow/.test(s),
    fog: s === 'fog',
    storm: /lightning/.test(s),
    wind: /windy/.test(s),
    overcast: /^cloudy|rain|pouring|hail|snow|fog|lightning|exceptional/.test(s),
    clouds: s === 'partlycloudy' ? 4 : s === 'windy-variant' ? 6 : /cloudy|rain|pouring|hail|snow|lightning|exceptional/.test(s) ? 7 : 3,
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
  let x0 = w, y0 = h, x1 = 0, y1 = 0; // the painted box, for opaqueBox (no second readback later)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) { if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; if (y >= y1) y1 = y + 1; continue; }
      if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) {
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(im, 0, 0);
  cv._box = x1 > x0 ? [Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(w, x1 + 1), Math.min(h, y1 + 1)] : [0, 0, 0, 0];
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

// Head in 3/4 view facing right: flat crown under the hair, ear on the left, cheek and a defined chin on
// the right. The face itself (brows, eyes, nose, mouth) is drawn by drawFace from each person's traits.
const HEAD = [
  '..HHHHHHH...',
  '.HHHSSSSSS..',
  '.HSSSSSSSSS.',
  'HSSSSSSSSSSS',
  'SSSSSSSSSSSS',
  'SSSSSSSSSSSS',
  'SESSSSSSSSSS',
  'sEsSSSSSSSSS',
  '.ssSSSSSSSSs',
  '.ssSSSSSSSS.',
  '..ssSSSSSSs.',
  '....sssss...',
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
  swoop: [
    '...jjjjjj.....',
    '..jjhhhhhhj...',
    '.jhhhhhhhhhhh.',
    'jhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhk',
    'hhhhhhhhhhhhk.',
    'hhhhhkhhhkk...',
    'hhhk..........',
    'hhk...........',
    'hk............',
  ],
  spiky: [
    '..j..j..j.....',
    '.jj.jj.jjj....',
    '.jhhjhhjhhjh..',
    'jhhhhhhhhhhhh.',
    'hhhhhhhhhhhkhk',
    'hhhhhkkh..k...',
    'hhhk..........',
    'khk...........',
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
  '..hh..hhhhh.',
  '..hhhh..hhhk',
  '...hhhhhhhk.',
  '....khhhhk..',
  '......kk....',
];

// Skin gets its own gentle ramp: the general hue-shifted ramp pushes light skin into orange and red.
const skinCache = new Map();
function skinRamp(hex) {
  let r = skinCache.get(hex);
  if (!r) skinCache.set(hex, (r = { o: mixHex(hex, '#3a1a1e', 0.55), d: mixHex(hex, '#7a3a34', 0.28), m: hex, l: mixHex(hex, '#fff2e0', 0.3), h: mixHex(hex, '#ffffff', 0.55) }));
  return r;
}

// Each person's face: stable traits picked from their seed, so everyone keeps the same face.
const IRIS = ['#5a3a24', '#3a6ab8', '#3a8a5a', '#7a5a2a', '#3a3044'];
function faceOf(v) {
  const L = v.look;
  if (L.faceT) return L.faceT;
  const r = mulberry32(Math.floor((v.seed || 0) * 1e6) + v.id * 131 + 7), pick = (a) => a[Math.floor(r() * a.length)];
  const kid = v.small;
  return (L.faceT = {
    ...{
    eye: pick(kid ? ['round', 'round', 'lash'] : ['round', 'round', 'lash', 'narrow']),
    iris: pick(IRIS),
    brow: pick(kid ? ['flat', 'arch', 'soft'] : ['flat', 'arch', 'thick', 'soft', 'worried', 'bold']),
    mouth: pick(kid ? ['smile', 'grin', 'open'] : ['smile', 'smile', 'flat', 'smirk', 'grin']),
    nose: pick(['button', 'button', 'long', 'round']),
    blush: kid || r() < 0.3,
    freckles: r() < (kid ? 0.45 : 0.15),
    glasses: !kid && !L.beard && r() < 0.15,
    stache: !L.beard && !kid && r() < 0.12,
    },
    ...L.face,
  });
}
// Brows as [col, row] pixels in head space: near eye then far eye.
const BROWS = {
  flat: [[4, 4], [5, 4], [6, 4], [9, 4], [10, 4]],
  arch: [[4, 4], [5, 3], [6, 4], [9, 3], [10, 4]],
  thick: [[4, 4], [5, 4], [6, 4], [5, 3], [6, 3], [9, 4], [10, 4], [9, 3]],
  soft: [[5, 4], [6, 4], [9, 4]],
  worried: [[4, 4], [5, 4], [6, 3], [9, 3], [10, 4]],
  bold: [[4, 3], [5, 4], [6, 4], [9, 4], [10, 3]],
};

// Head, face, beard, hair and hat. Returns the eye boxes for blinking.
function drawHead(g, v, hy, skin, hair) {
  const L = v.look, F = faceOf(v), X = AX - 5;
  const Q = (c, r, col, w = 1, h = 1) => P(g, X + c, hy + r, w, h, col);
  tpl(g, HEAD, X, hy, { S: skin.m, s: skin.d, H: skin.l, E: skin.o });
  Q(2, 6, skin.d); Q(1, 5, skin.m);
  for (const [c, r] of BROWS[F.brow]) Q(c, r, F.brow === 'soft' ? hair.m : hair.d);
  // eyes: white on the outer side, pupil looking ahead with the iris colour under the lid
  for (const ex of [5, 9]) {
    if (F.eye === 'narrow') { Q(ex, 5, OUT, 2, 1); Q(ex, 6, '#f8f4ee'); Q(ex + 1, 6, F.iris); }
    else { Q(ex, 5, '#f8f4ee', 1, 2); Q(ex + 1, 5, OUT); Q(ex + 1, 6, F.iris); }
  }
  if (F.eye === 'lash') { Q(4, 5, OUT); Q(5, 4, OUT); Q(11, 5, OUT); }
  // nose between the eyes, lit from the upper left
  const lip = mixHex(skin.o, '#8a3a3a', 0.25), nose = mixHex(skin.d, skin.o, 0.35), dark = '#4a1e22';
  if (F.nose === 'long') { Q(8, 5, skin.l, 1, 2); Q(8, 7, nose); Q(9, 7, skin.d); }
  else if (F.nose === 'round') { Q(8, 6, skin.l); Q(7, 7, skin.d); Q(8, 7, nose); }
  else { Q(8, 6, skin.l); Q(8, 7, nose); }
  if (F.blush) { const b = mixHex(skin.m, '#e86a70', 0.22); Q(4, 8, b); Q(10, 8, b); }
  if (F.freckles) for (const [c, r] of [[3, 7], [5, 8], [10, 7]]) Q(c, r, skin.d);
  switch (F.mouth) {
    case 'smile': Q(7, 9, lip, 2); Q(6, 8, skin.d); Q(9, 8, skin.d); break;
    case 'grin': Q(6, 9, lip); Q(7, 9, '#fffaf0', 2); Q(9, 9, lip); Q(7, 10, dark, 2); break;
    case 'open': Q(7, 9, dark, 2); Q(7, 10, mixHex(dark, '#e07070', 0.6), 2); break;
    case 'smirk': Q(7, 9, lip, 2); Q(9, 8, lip); break;
    default: Q(7, 9, lip, 2);
  }
  Q(6, 10, skin.l, 2); // chin light
  if (L.beard) tpl(g, BEARD, X, hy + 7, { h: hair.m, k: hair.d });
  else if (F.stache) { Q(6, 8, hair.m, 4); Q(6, 8, hair.d); Q(9, 8, hair.d); }
  tpl(g, HAIR[L.style], X - 1, hy - 2, { h: hair.m, k: hair.d, j: L.streak || hair.l });
  if (F.glasses) {
    const [r, gg, b] = hexToRgb(L.skin), fr = r * 0.3 + gg * 0.6 + b * 0.1 < 140 ? '#e0d4b8' : '#3a2a24';
    Q(4, 5, fr, 1, 2); Q(5, 7, fr, 2); Q(7, 5, fr, 1, 2); Q(8, 5, fr); Q(9, 7, fr, 2); Q(11, 5, fr, 1, 2); Q(2, 5, fr, 2);
  }
  const hat = HATS[v.hat || v.job];
  if (hat) tpl(g, hat.rows, X + hat.ox, hy + hat.oy, hat.map);
  return [[X + 5, hy + 5], [X + 9, hy + 5]];
}

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
  // sticks: snare hit, other hand down on the tom, crash
  band_drums: [{ f: [3, 3], b: [8, -5] }, { f: [2, -5], b: [10, 2] }, { f: [9, -4], b: [8, -5] }],
  // fretting hand on the neck, strumming hand at the body; down-strums dip the body
  band_bass: [{ f: [-1, 3], b: [14, -2] }, { f: [0, 4], b: [14, -2], bob: 1 }, { f: [-1, 3], b: [13, -2] }, { f: [0, 4], b: [13, -2], bob: 1 }],
  band_guitar: [{ f: [0, 2], b: [13, -2] }, { f: [1, 4], b: [13, -2], bob: 1 }, { f: [0, 3], b: [12, -2] }, { f: [1, 5], b: [12, -2], bob: 1 }],
  // event crews
  knock: [{ f: [5, -3] }, { f: [6, -2] }],
  shrug: [{ f: [4, -1], b: [-4, -1], bob: -1 }],
  paint: [{ f: [6, -4] }, { f: [6, -1] }, { f: [5, -6] }, { f: [6, -2] }],
  trim: [{ f: [6, 0], b: [5, 1] }, { f: [6, 1], b: [5, 2] }],
  prune: [{ f: [4, -7], b: [3, -6] }, { f: [5, -8], b: [4, -7] }],
  crank: [{ f: [6, 0] }, { f: [7, -2] }, { f: [6, -4] }, { f: [5, -2] }],
  toss: [{ f: [2, -6] }, { f: [6, -3] }, { f: [7, 0] }, { f: [4, 3] }],
  announce: [{ f: [6, -5] }, { f: [7, -3] }],
  juggle: [{ f: [5, -2], b: [3, 1] }, { f: [5, 1], b: [3, -2] }],
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
  band_drums: ['band_drums', 7, [0, 1, 0, 1, 0, 1, 2, 1]], band_bass: ['band_bass', 4, [0, 1, 2, 3]],
  band_guitar: ['band_guitar', 7, [0, 1, 2, 3]],
  pull: [null, 10, [0, 1, 2, 3, 4, 5]], push: [null, 10, [0, 1, 2, 3, 4, 5]],
  knock: ['knock', 4, [0, 1, 0, 1, 0, 0, 0, 0]], shrug: ['shrug', 1, [0]], paint: ['paint', 5, [0, 1, 2, 3]],
  trim: ['trim', 6, [0, 1]], prune: ['prune', 5, [0, 1]], crank: ['crank', 5, [0, 1, 2, 3]],
  toss: ['toss', 4, [0, 0, 1, 2, 3, 3]], announce: ['announce', 2, [0, 1]], juggle: ['juggle', 5, [0, 1]],
};
const LIFT = { dance: [0, 2, 3, 2], kidplay: [0, 2, 3, 2], prune: [4, 4, 4, 4] };
// Actions that simply play a pose of another name (event crews and onlookers).
const ACTION_POSE = {
  build: 'setup', sell: 'chat', pitch: 'chat', browse: 'idle', admire: 'idle', chisel: 'sign', cheer: 'dance', hitch: 'setup',
  knock: 'knock', shrug: 'shrug', paint: 'paint', trim: 'trim', prune: 'prune', crank: 'crank', toss: 'toss', announce: 'announce', juggle: 'juggle',
};
// Tools held for a pose (by frame where it matters).
const POSE_TOOL = { paint: () => 'brush', trim: () => 'shears', prune: () => 'shears', toss: (f) => (f < 2 ? 'ring' : null), juggle: () => 'balls' };

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
  bandbeanie: { ox: -1, oy: -3, map: { R: '#2e2e38', r: '#1a1a22', Q: '#4a4a58' }, rows: HATS.woodcutter.rows },
  sunhat: {
    ox: -3, oy: -4, map: { P: '#f4e4c0', p: '#c8b48a', F: '#e06a8a' },
    rows: ['......PPPPP.......', '.....PPPPPPP......', '....FFFFFFFFF.....', 'PPPPPPPPPPPPPPPPPP', '.pppppppppppppppp.'],
  },
  beanie: { ox: -1, oy: -3, map: { R: '#3a8ac8', r: '#24609a', Q: '#6ab0f0' }, rows: HATS.woodcutter.rows },
  cap: { ox: -1, oy: -3, map: { C: '#3a9a5a', c: '#246a3e' }, rows: ['...CCCCCC.....', '..CCCCCCCC....', '.CCCCCCCCCC...', '.ccccccccccccc'] },
  // event crews
  flatcap: { ox: -1, oy: -2, map: { F: '#7a6a54', f: '#54483a', h: '#9a8a70' }, rows: ['..FhFFFFF.....', '.FFFFFFFFFF...', '.fffffffffffff'] },
  redcap: { ox: -1, oy: -2, map: { F: '#c83a3a', f: '#8a2626', h: '#e86a5a' }, rows: ['..FhFFFFF.....', '.FFFFFFFFFF...', '.fffffffffffff'] },
  bowler: { ox: -1, oy: -4, map: { B: '#3a2a20', b: '#22160e', h: '#5e4634', r: '#7a2a2a' }, rows: ['....BBBBB.....', '...BhBBBBB....', '...BBBBBBB....', '...rrrrrrr....', '.bbbbbbbbbbb..'] },
  beret: { ox: -1, oy: -3, map: { R: '#c83a3a', r: '#8a2626', h: '#e86a5a' }, rows: ['.....R........', '..RhRRRRRR....', '.RRRRRRRRRRR..', '..rrrrrrrrr...'] },
  beret2: { ox: -1, oy: -3, map: { R: '#2a3a6a', r: '#1a2444', h: '#4a5a9a' }, rows: ['.....R........', '..RhRRRRRR....', '.RRRRRRRRRRR..', '..rrrrrrrrr...'] },
  workcap: { ox: -1, oy: -3, map: { C: '#e07a2a', c: '#a8541a', h: '#f8a050' }, rows: ['...ChCCCC.....', '..CCCCCCCC....', '.CCCCCCCCCC...', '.ccccccccccccc'] },
  tophat: { ox: 0, oy: -7, map: { T: '#26222e', t: '#16121c', h: '#4a4656', R: '#c83a3a' }, rows: ['...ThTTTT...', '...ThTTTT...', '...TTTTTT...', '...TTTTTT...', '...RRRRRR...', '.tttttttttt.'] },
});

// Event crew looks: each role builds a look from the guest RNG. `outfit` lists garment pieces drawn by
// drawOutfit, so a new role is mostly data. `face` overrides any of faceOf's traits.
const CREW_LOOKS = {
  merchant: (p, rnd) => ({ shirt: '#ece0c4', pants: '#5a4a3a', vest: p(['#2f6a4a', '#7a2a3a', '#3a4a7a']), outfit: ['waistcoat', 'satchel'], hat: 'flatcap', style: 'short', beard: rnd() < 0.5 }),
  salesman: (p) => ({ shirt: '#7a5434', pants: '#6a4a2e', tie: p(['#b83030', '#2a5a9a', '#3a7a3a']), outfit: ['suit'], hat: 'bowler', style: 'short', face: { mouth: 'grin', glasses: false } }),
  artist: (p, rnd, i) => ({
    shirt: ['#e8b8c8', '#b8d8e8', '#e8e0a8'][i % 3], pants: p(['#3a4a6a', '#5a3a5a', '#4a4a3a']), outfit: ['smock'],
    hat: ['beret', 'beret2', null][i % 3], style: ['long', 'messy', 'swoop'][i % 3], beard: i === 1 && rnd() < 0.6,
  }),
  landscaper: (p, rnd) => ({ shirt: p(['#e8d8b0', '#c8d8e8', '#e8e8e0']), pants: '#3a6a3a', outfit: ['overalls'], hat: 'workcap', style: 'short', beard: rnd() < 0.3 }),
  ringmaster: () => ({ shirt: '#c03030', pants: '#2a2a34', outfit: ['tailcoat'], hat: 'tophat', style: 'short', face: { stache: true, mouth: 'grin' } }),
  fairfolk: (p, rnd, i) => ({ shirt: '#f4f0e6', pants: p(['#3a3a6a', '#4a3a2a']), stripe: ['#d03a3a', '#3a6ad0', '#2a8a5a'][i % 3], outfit: ['stripes', 'suspenders'], hat: i % 2 ? 'redcap' : null, style: p(['short', 'long', 'messy']) }),
};

// Garment pieces for crew looks, drawn over the plain shirt. Returns false when the piece replaces the belt.
function drawOutfit(g, L, x0, tt, tb, w, h, shirt, skin) {
  let belt = true;
  for (const piece of L.outfit) {
    switch (piece) {
      case 'waistcoat': {
        const vs = ramp(L.vest);
        P(g, x0, tt + 2, 3, h - 3, vs.m); P(g, x0 + 6, tt + 2, 3, h - 3, vs.d); P(g, x0, tt + 2, 1, h - 3, vs.l);
        P(g, x0 + 2, tt + 1, 1, 1, vs.m); P(g, x0 + 6, tt + 1, 1, 1, vs.d);
        for (let r = tt + 3; r < tb - 1; r += 2) P(g, x0 + 2, r, 1, 1, '#e8c050');
        break;
      }
      case 'suit': {
        // jacket is the shirt colour; white shirt and tie in the open V, lapels and buttons
        P(g, x0 + 3, tt, 3, 3, '#f4f0e6'); P(g, x0 + 4, tt + 3, 1, 1, '#f4f0e6');
        P(g, x0 + 4, tt + 1, 1, 4, L.tie); P(g, x0 + 4, tt + 5, 1, 1, ramp(L.tie).d);
        P(g, x0 + 2, tt, 1, 4, shirt.d); P(g, x0 + 6, tt, 1, 4, shirt.d);
        P(g, x0 + 5, tt + 6, 1, 1, '#e8c050'); P(g, x0 + 1, tt + 3, 2, 1, '#f4f0e6');
        belt = false;
        break;
      }
      case 'tailcoat': {
        P(g, x0 + 3, tt, 3, h - 2, '#f4f0e6'); P(g, x0 + 3, tt + 1, 3, 1, '#1a1a22'); P(g, x0 + 4, tt + 1, 1, 1, '#3a3a46');
        for (let r = tt + 3; r < tb - 1; r += 2) { P(g, x0 + 2, r, 1, 1, '#e8c050'); P(g, x0 + 6, r, 1, 1, '#e8c050'); }
        P(g, x0 - 1, tb - 2, 2, 4, shirt.d); // coat tails
        belt = false;
        break;
      }
      case 'smock': {
        P(g, x0 + 2, tt + 4, 3, 2, shirt.d); // pocket
        const dots = [['#e04848', 1, 3], ['#3a8ae0', 6, 2], ['#f0c030', 4, 6], ['#3aa86a', 2, 7]];
        for (const [c, dx, dy] of dots) if (dy < h - 1) P(g, x0 + dx, tt + dy, 1, 1, c);
        belt = false;
        break;
      }
      case 'overalls': {
        const ov = ramp(L.pants);
        P(g, x0 + 2, tt + 2, 5, h - 2, ov.m); P(g, x0 + 6, tt + 2, 1, h - 2, ov.d);
        P(g, x0, tt + 5, w, h - 5, ov.m); P(g, x0, tt + 5, 1, h - 5, ov.l); P(g, x0 + w - 1, tt + 5, 1, h - 5, ov.d);
        P(g, x0 + 2, tt, 1, 2, ov.d); P(g, x0 + 6, tt, 1, 2, ov.d);
        P(g, x0 + 2, tt + 2, 1, 1, '#d8d8e0'); P(g, x0 + 6, tt + 2, 1, 1, '#d8d8e0');
        P(g, x0 + 3, tt + 3, 3, 2, ov.l);
        belt = false;
        break;
      }
      case 'stripes': {
        const st = ramp(L.stripe);
        for (let r = 1; r < h - 1; r += 2) { P(g, x0, tt + r, w, 1, st.m); P(g, x0 + w - 2, tt + r, 2, 1, st.d); }
        break;
      }
      case 'suspenders':
        P(g, x0 + 2, tt, 1, h - 1, '#3a2a24'); P(g, x0 + 6, tt, 1, h - 1, '#3a2a24');
        break;
    }
  }
  return belt;
}

const SIT_POSES = new Set(['sit', 'eat', 'watch', 'lutesit', 'laptop', 'sip', 'handheld', 'controller', 'band_drums']);
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

function drawLegs(g, o, sit, child, legLen, pants, skin, sole = SHOE.d) {
  if (sit) {
    const ty = FY - 4;
    P(g, AX - 3, ty - 1, 8, 2, pants.d);
    P(g, AX - 2, ty, 9, 2, pants.m); P(g, AX - 2, ty, 9, 1, pants.l);
    P(g, AX + 4, ty + 1, 3, 2, child ? skin.m : pants.m);
    P(g, AX + 4, FY - 1, 5, 2, SHOE.m); P(g, AX + 4, FY, 5, 1, sole); P(g, AX + 7, FY - 1, 1, 1, SHOE.l);
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
    P(g, x - 1, FY - lift, 4, 1, sole);
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
    case 'band': {
      const top = v.look.top, tee = '#2e2e38';
      if (top === 'stripes') for (let r = 1; r < h - 1; r += 2) P(g, x0, tt + r, w, 1, r === 1 ? '#3a3a46' : '#24242c');
      if (top === 'flannel') {
        for (let r = 0; r < h - 1; r++) for (let c = 0; c < w; c++) if ((c + 1) % 3 === 0 || (r + 1) % 3 === 0) P(g, x0 + c, tt + r, 1, 1, mixHex(shirt.d, '#1a1010', 0.5));
        P(g, x0 + 3, tt, 3, h - 1, tee); P(g, x0 + 3, tt, 1, h - 1, '#44444f');
      }
      if (top === 'print') { P(g, x0 + 3, tt + 2, 3, 2, '#e8e8e8'); P(g, x0 + 3, tt + 4, 1, 1, '#e8e8e8'); P(g, x0 + 5, tt + 4, 1, 1, '#e8e8e8'); P(g, x0 + 4, tt + 3, 1, 1, tee); }
      if (top === 'tee') { P(g, x0 + 2, tt + 3, 5, 2, '#f0e050'); P(g, x0 + 3, tt + 3, 1, 1, '#2a2a30'); P(g, x0 + 5, tt + 4, 1, 1, '#2a2a30'); }
      P(g, x0, tb - 1, w, 1, '#1a1a20');
      for (let c = 1; c < w; c += 2) P(g, x0 + c, tb - 1, 1, 1, '#c8ccd8');
      belt = false;
      break;
    }
    case 'mail':
      P(g, x0 + 6, tt + 2, 2, 2, '#e8c050'); P(g, x0 + 3, tt, 3, 1, '#ffffff');
      break;
    case 'child':
      P(g, x0, tt + 3, w, 1, shirt.h);
      belt = false;
      break;
    default:
      if (v.look.outfit) belt = drawOutfit(g, v.look, x0, tt, tb, w, h, shirt, skin);
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
    case 'shears': { // hedge shears: two long blades, open and shut by frame
      line(g, hx - 3, hy + 1, hx, hy, WOOD.m, 1);
      if (frame % 2) { line(g, hx, hy, hx + 8, hy - 3, METAL.h, 1); line(g, hx, hy, hx + 8, hy + 1, METAL.m, 1); }
      else { line(g, hx, hy, hx + 9, hy - 1, METAL.h, 1); line(g, hx, hy + 1, hx + 9, hy, METAL.m, 1); }
      break;
    }
    case 'brush':
      line(g, hx - 1, hy + 2, hx + 3, hy - 3, WOOD.l, 1); P(g, hx + 3, hy - 5, 2, 2, ['#e04848', '#3a8ae0', '#f0c030'][frame % 3]);
      break;
    case 'ring':
      P(g, hx - 2, hy - 4, 4, 1, '#f0c030'); P(g, hx - 2, hy - 1, 4, 1, '#f0c030'); P(g, hx - 3, hy - 3, 1, 2, '#f0c030'); P(g, hx + 2, hy - 3, 1, 2, '#f0c030');
      break;
    case 'balls': {
      const pts = frame % 2 ? [[hx - 2, hy - 9, '#e04848'], [hx + 3, hy - 6, '#f0c030'], [hx - 5, hy - 4, '#3a8ae0']] : [[hx + 1, hy - 10, '#e04848'], [hx - 4, hy - 7, '#f0c030'], [hx + 3, hy - 3, '#3a8ae0']];
      for (const [x, y, c] of pts) { P(g, x, y, 2, 2, c); P(g, x, y, 1, 1, '#ffffff'); }
      break;
    }
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
  } else if (carry === 'crate') {
    const cr = ramp('#b08048');
    P(g, AX + 2, tt + 1, 10, 7, cr.m); P(g, AX + 2, tt + 1, 10, 1, cr.l); P(g, AX + 2, tt + 4, 10, 1, cr.d); P(g, AX + 11, tt + 1, 1, 7, cr.d);
    P(g, AX + 4, tt, 2, 1, '#e04848'); P(g, AX + 7, tt, 2, 1, '#f0c030');
  } else if (carry === 'case') {
    const cs = ramp('#6a3a22');
    P(g, hx - 3, hy, 7, 5, cs.m); P(g, hx - 3, hy, 7, 1, cs.l); P(g, hx + 3, hy, 1, 5, cs.d); P(g, hx - 1, hy - 1, 3, 1, cs.o); P(g, hx, hy + 2, 1, 1, '#e8c050');
  } else if (carry === 'ladder') {
    const wd = ramp('#b8905a');
    line(g, AX - 12, tt + 5, AX + 13, tt - 7, wd.m, 1); line(g, AX - 11, tt + 8, AX + 14, tt - 4, wd.d, 1);
    for (let k = 0; k < 6; k++) { const x = AX - 9 + k * 4, y = tt + 4 - Math.round(k * 2); line(g, x, y, x + 1, y + 3, wd.l, 1); }
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
  const skin = skinRamp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  const child = v.small, legLen = child ? 4 : 6, torsoH = child ? 7 : 9;
  const sit = SIT_POSES.has(pose);
  let back = child ? [-1, 5] : [-1, 6], front = child ? [1, 5] : [1, 6], tool = null, bob = 0, dir = null;
  let legs = [0, 0, 0, 0];
  if (pose === 'walk' || pose === 'pull' || pose === 'push') {
    const ph = (frame / 6) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
    const fo = Math.round(3 * cs);
    legs = [-fo, sn < -0.6 ? 1 : 0, fo, sn > 0.6 ? 1 : 0];
    bob = -Math.round(Math.abs(sn));
    front = [1 - Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
    back = [-1 + Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
    if (pose === 'pull') { front = [-6, 4]; back = [-7, 4]; } // hauling a cart behind
    if (pose === 'push') { front = [6, 4]; back = [5, 4]; } // pushing a barrow ahead
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
    case 'band_drums': case 'band_bass': case 'band_guitar': tool = pose.slice(5); break;
    default: if (POSE_TOOL[pose]) tool = POSE_TOOL[pose](frame);
  }
  if (carry === 'log') { back = [-1, -3]; front = [2, -3]; }
  else if (carry === 'bucket' && pose !== 'water') { front = [1, 6]; tool = 'bucket'; }
  else if (carry === 'sign') { back = [4, 2]; front = [5, 1]; }
  else if (carry === 'package' || carry === 'crate') { back = [4, 3]; front = [6, 2]; }
  else if (carry === 'ladder') { back = [3, -3]; front = [5, -2]; }
  else if (carry === 'mail') front = [4, -1];
  const stick = gear && !tool && !carry && (pose === 'walk' || pose === 'idle');
  if (stick) front = [4, 3];
  const hb = [sb[0] + back[0], sb[1] + back[1]], hf = [sf[0] + front[0], sf[1] + front[1]];

  if (gear) drawPack(g, tt);
  limb(g, sb, hb, { m: shirt.d, l: shirt.m }, { m: skin.d, l: skin.m, d: skin.o }, false);
  if (carry === 'case') drawCarry(g, 'case', hb[0], hb[1], tt); // sample case swings from the far hand
  drawLegs(g, legs, sit, child, legLen, pants, skin, v.job === 'band' ? '#f0f0f0' : SHOE.d);
  if (!sit && tb < FY - legLen) P(g, AX - 4, tb + 1, 9, FY - legLen - tb, pants.m);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  if (v.job === 'carrier') drawSkirt(g, tb, pants, sit);
  if (L.outfit?.includes('smock') && !sit) { P(g, AX - 4, tb, 9, 2, shirt.m); P(g, AX - 4, tb, 1, 2, shirt.l); P(g, AX + 3, tb, 2, 2, shirt.d); P(g, AX - 4, tb + 1, 9, 1, shirt.d); }

  const eyes = drawHead(g, v, hy, skin, hair);
  if (v.job === 'mail' || L.outfit?.includes('satchel')) { line(g, AX + 2, tt, AX - 3, tb - 3, '#5a3a20', 1); P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48'); }
  if (gear) line(g, AX - 3, tt + 1, AX + 1, tt + 5, '#4a2a18', 1);

  limb(g, sf, hf, shirt, skin, true);
  if (tool === 'hoe' || tool === 'axe' || tool === 'hammer') drawHafted(g, tool, hf, dir || [0.8, 0.6]);
  else if (INSTRUMENTS.includes(tool)) drawInstrument(g, v, tool, hf, hb, tt, skin);
  else if (tool) drawTool(g, tool, hf[0], hf[1], frame, tt, tb);
  if (carry && carry !== 'bucket' && carry !== 'case') drawCarry(g, carry, hf[0], hf[1], tt);
  if (stick) {
    line(g, hf[0] + 1, hf[1] - 9, hf[0] + 2, FY, '#9a6a3a', 2);
    P(g, hf[0], hf[1] - 11, 3, 3, '#6a4020');
  }
  if (stick || (tool && !['popcorn', 'lute', 'bowl', 'spoon', 'mug', 'handheld0', 'handheld1', 'pad', 'balls', ...INSTRUMENTS].includes(tool))) {
    P(g, hf[0] - 1, hf[1] - 1, 3, 3, skin.m); P(g, hf[0] - 1, hf[1] - 1, 1, 1, skin.l);
  }
  outline(c);
  return { cv: c, eyes, top: hy - 6 };
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
const RABBIT_ZONES = [[152, 64, 168, 75], [112, 117, 122, 125], [2, 96, 14, 101]];
const TREE_BASES = [[40, 72], [134, 70], [160, 70], [88, 64], [221, 106]];
// Where birds may land. Ground spots are in the open village; roof spots sit on a ridge and are drawn
// just in front of that house (y is the house's ground line, alt lifts the bird up to the ridge).
function birdSpot() {
  const r = Math.random();
  if (r < 0.3) {
    const h = pick(HOUSES), x = (h.g.X + 8 + Math.random() * (h.g.Wd - 16)) / S;
    return { x, y: h.base + 0.35, alt: (h.g.bot - h.g.ridge + 3) / S };
  }
  const ground = [
    () => [FIRE.x + rand(-22, 22), FIRE.y + rand(-6, 9)],
    () => [rand(66, 87), rand(68, 74)],
    () => [rand(140, 166), rand(108, 124)],
    () => [rand(176, 214), rand(110, 125)],
  ];
  for (let k = 0; k < 6; k++) {
    const [x, y] = pick(ground)();
    const pond = ((x * S - POND.x) / (POND.rx + 4)) ** 2 + ((y * S - POND.y) / (POND.ry + 4)) ** 2 < 1;
    if (!blocked(x, y) && !pond) return { x, y, alt: 0 };
  }
  return { x: FIRE.x, y: FIRE.y + 8, alt: 0 };
}

// Instruments for the travelling band, drawn over the body; hands go on top of them.
function drawInstrument(g, v, kind, hf, hb, tt, skin) {
  const hand = ([x, y]) => { P(g, x - 1, y - 1, 3, 3, skin.m); P(g, x - 1, y - 1, 1, 1, skin.l); };
  if (kind === 'drums') {
    const sh = ramp('#c8303a'), cym = ramp('#e8c040'), st = '#8a8e9a';
    P(g, AX - 4, FY - 4, 2, 4, '#3a3a44'); P(g, AX - 6, FY, 6, 1, '#3a3a44'); // throne
    line(g, AX + 15, tt - 2, AX + 15, FY, st, 1); ellipse(g, AX + 15, tt - 3, 5, 1, cym.m); P(g, AX + 11, tt - 4, 4, 1, cym.h); // crash
    disc(g, AX + 8, FY - 6, 6, sh.m); P(g, AX + 5, FY - 12, 5, 1, sh.l); // kick drum, head toward us
    disc(g, AX + 8, FY - 6, 4, '#f2eee6'); P(g, AX + 6, FY - 9, 3, 1, '#ffffff');
    P(g, AX + 6, FY - 6, 5, 1, '#2a2a34'); P(g, AX + 7, FY - 5, 3, 1, '#2a2a34'); // band logo
    P(g, AX + 1, tt + 6, 7, 3, sh.m); P(g, AX + 1, tt + 6, 7, 1, '#f4f4f8'); P(g, AX + 1, tt + 8, 7, 1, sh.d); // snare
    ellipse(g, AX + 11, tt + 5, 3, 1, '#f4f4f8'); P(g, AX + 8, tt + 6, 7, 2, sh.m); // rack tom
    for (const h of [hb, hf]) {
      const up = h[1] < tt + 1;
      line(g, h[0], h[1], h[0] + 5, h[1] + (up ? -3 : 2), '#e8d0a0', 1);
      hand(h);
    }
  } else {
    const bass = kind === 'bass', col = ramp(BAND_GUITARS[v.instrIdx] || '#d02a34');
    const bx = AX + 1, by = tt + 6, nx = AX + (bass ? 17 : 14), ny = tt - (bass ? 4 : 2);
    line(g, AX - 2, tt, bx - 4, by + 1, '#1a1a22', 1); // strap
    line(g, bx + 3, by - 2, nx, ny, '#6a4020', 2); line(g, bx + 3, by - 3, nx, ny - 1, '#a87040', 1);
    P(g, nx, ny - 2, 2, 3, '#2a2a30'); P(g, nx + 1, ny - 2, 1, 1, '#c8ccd8');
    ellipse(g, bx - 1, by + 1, 4, 3, col.m); ellipse(g, bx + 2, by - 1, 3, 2, col.m);
    P(g, bx - 4, by, 2, 1, col.l); P(g, bx - 3, by - 1, 2, 1, col.h); P(g, bx - 3, by + 4, 5, 1, col.d);
    P(g, bx - 1, by - 1, 3, 3, bass ? '#3a2418' : '#f0ece0'); // pickguard
    P(g, bx + 1, by - 1, 1, 2, '#2a2a30'); P(g, bx - 3, by + 1, 1, 2, '#c8ccd8');
    hand(hb); hand(hf);
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
  const skin = skinRamp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  drawBike(g, frame, AX, FY);
  const tb = FY - 10, tt = tb - 8, hy = tt - 12;
  const a = (frame / 4) * Math.PI * 2, pedal = [AX + 1 + Math.round(Math.cos(a) * 3), FY - 4 + Math.round(Math.sin(a) * 3)];
  const pedal2 = [AX + 1 - Math.round(Math.cos(a) * 3), FY - 4 - Math.round(Math.sin(a) * 3)];
  limb(g, [AX - 2, tb], pedal2, { m: pants.d, l: pants.d }, { m: SHOE.d, l: SHOE.m, d: SHOE.o }, false);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  const eyes = drawHead(g, v, hy, skin, hair);
  limb(g, [AX - 1, tb], pedal, { m: pants.m, l: pants.l }, { m: SHOE.m, l: SHOE.l, d: SHOE.d }, true);
  limb(g, [AX + 3, tt + 2], [AX + 6, FY - 13], shirt, skin, true);
  P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48');
  if (carry === 'package') { P(g, AX + 6, FY - 11, 5, 4, '#c8a068'); P(g, AX + 8, FY - 11, 1, 4, '#e8d8a0'); }
  outline(c);
  return { cv: c, eyes, top: hy - 6 };
}

/* ---------- foliage: Colorado Front Range trees and shrubs ---------- */

// south = the southern hemisphere, where the seasons run six months apart
function seasonOf(d = new Date(), south = false) {
  const m = (d.getMonth() + (south ? 6 : 0)) % 12, day = d.getDate();
  if (m === 11 || m <= 1 || (m === 2 && day < 20) || (m === 10 && day > 10)) return 'winter';
  if ((m === 8 && day >= 20) || m === 9 || m === 10) return 'fall';
  if (m <= 4) return 'spring';
  return 'summer';
}

const FOLIAGE = {
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
function paintClusters(w, h, clusters, pal, { seed = 1, noise = 0.3, spiky = 0, snow = false, gx = w / 2, gy = h / 2, gr = w / 2 } = {}) {
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

// Colorado blue spruce: tiers of drooping, silvery blue-green boughs.
function drawSpruce(size, seed, snow) {
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
function drawPonderosa(size, seed, snow) {
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
function drawAspens(size, seed, snow, season) {
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

function makeTree(kind, size, seed, snow, season) {
  if (kind === 'spruce') return drawSpruce(size, seed, snow);
  if (kind === 'pine') return drawPonderosa(size, seed, snow);
  return drawAspens(size, seed, snow, season);
}

// Front Range shrubs, drawn straight into a prop sprite.
// Shrubs around the village (render px): kind, x, ground y, size.
const SHRUBS = [
  ['gambel', 156, 334, 6], ['rabbit', 376, 340, 6], ['juniper', 424, 376, 7], ['rose', 508, 376, 6], ['sage', 250, 288, 5],
  ['gambel', 470, 250, 6], ['juniper', 660, 300, 6], ['rabbit', 92, 248, 5], ['gambel', 4, 374, 6], ['sage', 128, 322, 4],
  ['juniper', 12, 362, 8], ['gambel', -3, 349, 6],
];
function shrubProp([kind, bx, by, br], snow, season, trimmed) {
  const w = br * 5 + 6, h = br * 3 + 6, x = bx - (w >> 1) - 2, y = by - h - 1;
  const cv = mk(w + 4, h + 4), g = cv.getContext('2d');
  g.translate(-x, -y); drawShrub(g, kind, bx, by, br, snow, season, trimmed); outline(cv);
  return { cv, x, y, sortY: by / S - 0.2 };
}

function drawShrub(g, kind, cx, by, r, snow, season, trimmed = false) {
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

/* ---------- scenery ---------- */

function disc(g, cx, cy, r, c) {
  ellipse(g, cx, cy, r, r, c);
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

function drawHaystack(g, cx, by, snow) {
  const hy = ramp('#d8b048');
  ellipse(g, cx, by - 5, 9, 5, hy.m); ellipse(g, cx - 2, by - 7, 5, 2, hy.l); P(g, cx - 8, by - 1, 17, 1, hy.d);
  for (let i = 0; i < 6; i++) P(g, cx - 7 + i * 2.5, by - 7 + (i % 3) * 2, 1, 2, i % 2 ? hy.d : hy.h);
  if (snow) ellipse(g, cx - 1, by - 9, 6, 2, '#ffffff');
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

// The backdrop, after the Colorado Front Range, painted back to front:
//   1. the Continental Divide: hazy, jagged, a flat-topped Longs-like massif with a sheer east face, snowfields
//      lying in the gullies above the snowline;
//   2. a nearer granite range: rock above treeline, a band of tundra, dark forest below;
//   3. forested foothills with meadows and a few Flatirons-style sandstone slabs;
//   4. a forest edge of spruce/fir spires, ponderosa and aspen groves (two rows for depth);
//   5. the rolling meadow in front of the village.
// Every layer fills down to the horizon, so each one only paints the rows above the next one's top.
function* paintBackdrop(set, snow, season) {
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
const C2 = (arr) => arr.map(hexToRgb);

// The whole land layer at once (tests, tools). The card builds it in steps across frames instead.
function buildLand(snow, season = 'summer') {
  const it = buildLandSteps(snow, season);
  let r;
  while (!(r = it.next()).done);
  return r.value;
}

// Builds the land layer, yielding between stages so a slow device never freezes for long.
function* buildLandSteps(snow, season = 'summer') {
  const c = mk(RW, RH), g = c.getContext('2d');
  const im = g.createImageData(RW, RH), d = im.data;
  const kind = new Uint8Array(RW * RH);
  const set = (x, y, col) => { const i = (y * RW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  const C = (arr) => arr.map(hexToRgb);

  yield* paintBackdrop(set, snow, season);

  // ground: grass, cobbled street, flagstone square, pond and farm soil
  const pale = (arr) => (snow ? arr.map((c) => c.map((v) => v + (255 - v) * 0.3)) : arr);
  // Front Range grass: green through summer, golden in fall, dry and tawny in a snowless winter
  const grass = C(snow ? ['#bccbe0', '#d4e0ee', '#e8f0f8', '#ffffff']
    : season === 'fall' ? ['#56783a', '#709040', '#8ea64c', '#acb85e']
      : season === 'winter' ? ['#6a6a44', '#84804e', '#9e9460', '#b8aa74'] : ['#468434', '#5a9e40', '#70b44c', '#88c85c']);
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
    sg.push(Math.min(sg[1], sg[3]) - 14, Math.max(sg[1], sg[3]) + 14); // rows a path can reach (widest half-width × wobble < 14)
    for (let x = x0; x <= x1; x++) cols[x].push(sg);
  }
  const segDist = (x, y, [ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  };
  // half-widths; edges wobble so paths look trodden rather than drawn
  const HW = { main: 11, lane: 7.5, path: 5.5, foot: 3.2 };
  const pathAt = (x, y) => {
    let out = null, wob = -1;
    for (const sg of cols[x]) {
      if (y < sg[5] || y > sg[6]) continue;
      if (wob < 0) wob = 0.8 + 0.4 * vnoise(x * 0.07, y * 0.07, 44);
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
  yield;
  for (let y = HZ; y < RH; y++) {
    if ((y - HZ) % 40 === 39) yield;
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
  yield;
  const K = (x, y) => kind[(y | 0) * RW + (x | 0)];
  const hexG = snow ? ['#b8c8dc', '#ffffff'] : season === 'winter' ? ['#5a5a3a', '#c8b884'] : season === 'fall' ? ['#4a6a2e', '#c0c470'] : ['#3a7a2c', '#9ad86a'];

  // tufts, wildflower patches, mushrooms, pebbles
  const R2 = mulberry32(9);
  for (let i = 0; i < 360; i++) {
    const x = Math.floor(R2() * (RW - 6)), y = HZ + 4 + Math.floor(R2() * (RH - HZ - 8));
    if (K(x, y) !== 2 || K(x + 4, y) !== 2 || K(x, y + 3) !== 2) continue;
    tpl(g, ['.l..l', 'lml.l', 'mmlml'], x, y, { l: hexG[1], m: hexG[0] });
  }
  if (!snow && season !== 'winter') {
    for (let p = 0; p < (season === 'fall' ? 7 : 14); p++) {
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
  {
    // flower clusters and ferns along the back row, so the tiers sit in the meadow
    const R3 = mulberry32(31), back = AMPHI.tiers[AMPHI.tiers.length - 1] + 9;
    for (let deg = AMPHI.a0 + 2; deg <= AMPHI.a1 - 2; deg += 9) {
      const t = (deg * Math.PI) / 180, x = Math.round(AMPHI.x + back * Math.cos(t)), y = Math.round(AMPHI.y + back * AMPHI.squash * Math.sin(t));
      if (snow) { P(g, x - 2, y - 1, 5, 2, '#ffffff'); continue; }
      tpl(g, ['g..g.g', '.gGgG.', 'gGGGGg'], x - 3, y - 3, { g: hexG[0], G: season === 'winter' ? '#8a7a50' : '#5aa840' });
      if (season === 'winter') continue;
      const col = ['#f05a7a', '#f8e060', '#c890f8', '#ffffff'][Math.floor(R3() * 4)];
      if (R3() < 0.7) { P(g, x - 1, y - 5, 1, 1, col); P(g, x + 2, y - 4, 1, 1, col); P(g, x, y - 6, 1, 1, '#f8d030'); }
    }
  }

  if (season !== 'winter' || snow) drawBackFarm(g, snow);

  yield;
  // Trees and props are separate sprites, sorted by depth with everything that moves.
  const props = [];
  const prop = (bx, by, bw, bh, sortY, fn) => {
    const pc = mk(bw, bh), pg = pc.getContext('2d');
    pg.translate(-bx, -by); fn(pg); outline(pc);
    props.push({ cv: pc, x: bx, y: by, sortY });
  };
  const tree = (kind, x, y, r, seed) => {
    const t = makeTree(kind, r, seed, snow, season), X = x * S, Y = y * S;
    ellipse(g, X, Y, Math.round(t.r * 0.7), 3, 'rgba(16,40,20,0.3)');
    props.push({ cv: t.cv, x: X - t.ax, y: Y - t.ay, sortY: y });
  };
  [
    ['spruce', 40, 72, 6], ['pine', 134, 70, 6], ['aspen', 160, 70, 5], ['spruce', 228, 70, 6], ['pine', -2, 78, 6],
    ['aspen', 88, 64, 4], ['spruce', 221, 106, 5], ['spruce', 63, 63, 3], ['aspen', 197, 71, 4],
  ].forEach(([kind, x, y, r], i) => tree(kind, x, y, r, 100 + i));
  yield;
  const wx = WELL.x * S, wy = WELL.y * S - 3;
  prop(wx - 22, wy - 58, 44, 62, WELL.y - 0.6, (pg) => drawWell(pg, snow));
  prop(FARM.x0 - 6, FARM.y1 - 4, FARM.x1 - FARM.x0 + 12, 14, (FARM.y1 + 6) / S, (pg) => drawBackFence(pg, snow));
  const scx = FARM.x1 - 16, scy = FARM.y0 + 18;
  prop(scx - 13, scy - 32, 26, 34, scy / S, (pg) => drawScarecrow(pg, scx, scy, snow));
  const sx = STUMP.x * S, sy = STUMP.y * S - 8;
  prop(sx - 13, sy - 24, 56, 36, STUMP.y - 0.1, (pg) => drawWoodpile(pg, snow));
  for (const [bx, by, bw] of [[FX - 18, FPY - 20, 36], [FX - 70, FPY + 21, 20], [FX + 50, FPY + 23, 20]]) prop(bx - 2, by - 12, bw + 4, 14, by / S, (pg) => drawBench(pg, bx, by, bw, snow));
  for (const [lx, ly] of LAMPS) prop(lx - 6, ly - 46, 12, 48, ly / S, (pg) => drawLamp(pg, lx, ly));
  SHRUBS.forEach((sh, i) => {
    const pr = shrubProp(sh, snow, season, false);
    pr.shrub = i; // landscapers swap in a trimmed copy per card (see _staticItems)
    props.push(pr);
  });
  const hx = FARM.x0 - 9, hy = FARM.y0 + 13;
  prop(hx - 11, hy - 13, 22, 15, hy / S, (pg) => drawHaystack(pg, hx, hy, snow));
  prop(CART.x - 30, CART.by - 60, 60, 63, CART.by / S, (pg) => drawCoffeeCart(pg, snow));
  const mbx = PATIO.x0 - 10, mby = PATIO.y0 + 8;
  prop(mbx - 8, mby - 19, 16, 21, mby / S, (pg) => drawMenuBoard(pg, mbx, mby, snow));
  for (const [x, y] of [...TABLES.flatMap(([tx, ty]) => [[tx - 13, ty + 2], [tx + 13, ty + 2]]), ...STOOLS]) prop(x - 5, y - 7, 11, 9, y / S - 0.05, (pg) => drawStool(pg, x, y));
  c.props = props;
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
const AMPHI_LANTERNS = amphiLanterns();

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
    const fx = Q.rx + 4, fy = back(Q.rx + 4) + 2;
    P(g, X(fx), Y(fy - 4), 6, 4, '#a85a3a'); P(g, X(fx), Y(fy - 4), 6, 1, '#c87a52');
    tpl(g, ['g.g.g', '.ggg.', 'gGgGg'], X(fx), Y(fy - 7), { g: '#3a8a3a', G: '#6ac050' });
  }
  if (!snow) {
    const px = x0 + depth - 3, py = back(x0) + depth / 2;
    P(g, X(px), Y(py - 6), 7, 5, '#b0603e'); P(g, X(px), Y(py - 6), 7, 1, '#c87a52');
    for (let k = 0; k < 4; k++) P(g, X(px + k * 2), Y(py - 9 + (k % 2)), 2, 2, k % 2 ? '#f0d040' : '#e85a6a');
  }
  outline(c);
  return { cv: c, x: ox, y: oy };
}

function drawBackFarm(g, snow, season) {
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

// The "BACK SOON!" card hung on the amphitheater screen while everyone's away. It's exactly the screen's
// size (one card column per screen column), so the letters slant with the screen without losing pixels.
const SIGN_W = SCREEN_Q.rx - SCREEN_Q.lx - 3, SIGN_H = SCREEN_Q.lbot - SCREEN_Q.ltop - 8;
function makeSignCard() {
  const c = mk(SIGN_W, SIGN_H), g = c.getContext('2d'), pa = ramp('#efe2c2'), w = SIGN_W, h = SIGN_H;
  P(g, 2, 3, w - 4, h - 6, pa.m); P(g, 2, 3, w - 4, 1, pa.h); P(g, 2, h - 4, w - 4, 1, pa.d);
  P(g, 2, 3, 1, h - 6, pa.l); P(g, w - 3, 3, 1, h - 6, pa.d);
  P(g, 4, 2, 5, 3, '#d8cc9c'); P(g, w - 9, 2, 5, 3, '#d8cc9c'); // tape
  drawText(g, 'BACK', (w - 23) >> 1, 8, '#5a2410');
  drawText(g, 'SOON!', (w - 26) >> 1, 19, '#5a2410');
  return { cv: c };
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

/* ---------- event props ---------- */
// All drawn facing the viewer, anchored at (ax, by) = centre of the ground line, then outlined.

// The travelling merchant's hand cart. stage 0: packed under a tarp (as it's pulled), 1: canopy up, 2: goods out.
function makeMerchantCart(stage) {
  const c = mk(78, 66), g = c.getContext('2d'), ax = 44, by = 63;
  const wd = ramp('#9a6a3a'), dk = ramp('#6a4426'), cv = ramp('#e8dcb8'), st = ramp('#3a8a5a');
  // handles reach out to the left, toward whoever pulls it
  line(g, ax - 22, by - 13, ax - 40, by - 9, dk.m, 2); line(g, ax - 22, by - 16, ax - 40, by - 12, dk.l, 1);
  if (stage > 0) {
    P(g, ax - 23, by - 54, 2, 32, '#6a5a4a'); P(g, ax + 21, by - 54, 2, 32, '#6a5a4a');
    for (let r = 0; r < 7; r++) {
      for (let i = ax - 27; i < ax + 27; i++) {
        const stripe = Math.floor((i - ax + 27) / 6) % 2;
        P(g, i, by - 60 + r, 1, 1, stripe ? (r < 2 ? '#f6eed8' : cv.m) : (r < 2 ? st.l : st.m));
      }
    }
    for (let i = 0; i < 9; i++) { const sx = ax - 27 + i * 6 + 3, col = i % 2 ? cv.m : st.m; P(g, sx - 3, by - 53, 6, 1, col); P(g, sx - 2, by - 52, 4, 1, col); }
    P(g, ax - 28, by - 61, 56, 1, dk.d);
    // hanging shop sign
    P(g, ax - 6, by - 50, 1, 3, '#4a4a56'); P(g, ax + 5, by - 50, 1, 3, '#4a4a56');
    P(g, ax - 8, by - 47, 17, 7, wd.l); P(g, ax - 8, by - 47, 17, 1, wd.h); P(g, ax - 8, by - 41, 17, 1, wd.d);
    P(g, ax - 5, by - 45, 3, 3, '#d84a3a'); P(g, ax - 1, by - 45, 3, 3, '#f0b030'); P(g, ax + 3, by - 45, 3, 3, '#5aa84a');
  }
  // cart box with planks
  P(g, ax - 24, by - 26, 48, 3, wd.l); P(g, ax - 24, by - 24, 48, 1, wd.d);
  P(g, ax - 22, by - 23, 44, 13, wd.m); P(g, ax - 22, by - 23, 44, 1, wd.h); P(g, ax + 19, by - 23, 3, 13, wd.d);
  for (const y of [by - 19, by - 15]) P(g, ax - 22, y, 44, 1, wd.d);
  for (const x of [ax - 12, ax + 2]) P(g, x, by - 23, 1, 13, wd.d);
  if (stage === 0) {
    // goods under a tied-down tarp, the canopy rolled up on top
    ellipse(g, ax, by - 30, 21, 6, cv.d); ellipse(g, ax - 2, by - 31, 18, 5, cv.m); P(g, ax - 14, by - 34, 9, 2, cv.l);
    for (const x of [ax - 10, ax + 8]) P(g, x, by - 35, 1, 10, dk.m);
    P(g, ax - 18, by - 38, 36, 3, st.m); P(g, ax - 18, by - 38, 36, 1, st.l);
  } else if (stage > 1) {
    // fruit baskets, jars and bolts of cloth on the counter
    for (const [bx, cols] of [[ax - 18, ['#d84a3a', '#e86a4a', '#c83a2a']], [ax - 8, ['#f0a030', '#e88a20', '#f8c050']], [ax + 12, ['#6ab84a', '#5aa83a', '#8ad060']]]) {
      P(g, bx - 4, by - 30, 9, 4, dk.m); P(g, bx - 4, by - 30, 9, 1, dk.l);
      for (let k = 0; k < 5; k++) P(g, bx - 3 + (k % 3) * 3, by - 33 + Math.floor(k / 3) * 2, 2, 2, cols[k % 3]);
    }
    for (const [jx, jc] of [[ax + 1, '#5a8ad0'], [ax + 4, '#d8a040'], [ax + 7, '#a85ac0']]) { P(g, jx, by - 32, 2, 6, jc); P(g, jx, by - 33, 2, 1, '#e8e0d0'); P(g, jx, by - 31, 1, 2, '#ffffff'); }
    for (const [fx, fc] of [[ax - 16, '#c83a6a'], [ax - 9, '#3a7ac8'], [ax - 2, '#e8c040'], [ax + 5, '#5aa87a']]) {
      const f = ramp(fc); P(g, fx, by - 22, 6, 9, f.m); P(g, fx, by - 22, 6, 1, f.l); P(g, fx + 5, by - 22, 1, 9, f.d);
    }
  }
  for (const wx of [ax - 14, ax + 14]) {
    disc(g, wx, by - 7, 7, dk.o); disc(g, wx, by - 7, 6, dk.m); disc(g, wx, by - 7, 2, dk.d);
    P(g, wx - 6, by - 7, 13, 1, wd.l); P(g, wx, by - 13, 1, 13, wd.l); P(g, wx, by - 7, 1, 1, '#3a3a46');
  }
  outline(c);
  return { cv: c, ax, by };
}

// The artists' sculpture: 0 crates, 1 block in scaffolding, 2 roughed out, 3 under a sheet, 4 unveiled.
function makeSculpture(variant, stage) {
  const c = mk(52, 70), g = c.getContext('2d'), ax = 26, by = 67;
  const stn = ramp('#a8a49a'), wd = ramp('#b8905a'), cu = ramp('#c8783a'), vg = ramp('#5aa890');
  const crate = (x, y) => { P(g, x, y, 11, 8, wd.m); P(g, x, y, 11, 1, wd.l); P(g, x, y + 4, 11, 1, wd.d); P(g, x + 10, y, 1, 8, wd.d); line(g, x + 1, y + 1, x + 9, y + 7, wd.d, 1); };
  if (stage === 0) {
    crate(ax - 14, by - 8); crate(ax - 2, by - 8); crate(ax - 8, by - 16);
    ellipse(g, ax + 10, by - 3, 6, 2, '#d8d4c8');
    outline(c);
    return { cv: c, ax, by };
  }
  // plinth
  P(g, ax - 11, by - 8, 22, 8, stn.d); P(g, ax - 11, by - 8, 22, 2, stn.l); P(g, ax - 12, by - 2, 24, 2, stn.o);
  if (stage === 4) { P(g, ax - 4, by - 5, 8, 2, '#d8b060'); P(g, ax - 3, by - 5, 6, 1, '#f0d890'); }
  const top = by - 8;
  if (stage <= 2) {
    // stone block, then the rough shape coming out of it
    if (stage === 1) { P(g, ax - 9, top - 34, 18, 34, stn.m); P(g, ax - 9, top - 34, 18, 2, stn.l); P(g, ax + 6, top - 34, 3, 34, stn.d); for (let k = 0; k < 6; k++) P(g, ax - 8 + (k * 5) % 15, top - 30 + k * 5, 2, 1, stn.d); }
    else drawSculptureForm(g, variant, ax, top, true);
    // scaffolding
    const sw = ramp('#8a6a40');
    for (const x of [ax - 14, ax + 13]) P(g, x, top - 40, 2, 40, sw.m);
    for (const y of [top - 38, top - 22, top - 8]) { P(g, ax - 14, y, 29, 2, sw.l); P(g, ax - 14, y + 1, 29, 1, sw.d); }
    line(g, ax - 13, top - 22, ax + 13, top - 8, sw.d, 1);
  } else if (stage === 3) {
    // draped sheet with folds and a ribbon
    const sh = ramp('#ece8e0');
    ellipse(g, ax, top - 20, 12, 20, sh.m); P(g, ax - 12, top - 14, 25, 14, sh.m);
    P(g, ax - 6, top - 30, 2, 30, sh.d); P(g, ax + 4, top - 26, 2, 26, sh.d); P(g, ax - 10, top - 36, 5, 3, sh.h);
    P(g, ax - 12, top - 10, 25, 2, '#d83a4a'); P(g, ax + 6, top - 12, 3, 6, '#d83a4a');
  } else drawSculptureForm(g, variant, ax, top, false);
  outline(c);
  return { cv: c, ax, by };
}

function drawSculptureForm(g, variant, ax, top, rough) {
  const stn = ramp('#b0aca0'), cu = ramp('#c8783a'), vg = ramp('#5aa890');
  if (variant === 'leaf') {
    // a big copper aspen leaf on a stem, green patina in the veins
    P(g, ax - 1, top - 14, 3, 14, cu.d);
    ellipse(g, ax, top - 30, 13, 15, rough ? stn.m : cu.m);
    if (!rough) {
      ellipse(g, ax - 3, top - 34, 7, 8, cu.l); P(g, ax - 6, top - 40, 4, 3, cu.h);
      line(g, ax, top - 16, ax, top - 43, vg.m, 1);
      for (let k = 0; k < 4; k++) { line(g, ax, top - 20 - k * 6, ax - 9 + k, top - 26 - k * 6, vg.m, 1); line(g, ax, top - 20 - k * 6, ax + 9 - k, top - 26 - k * 6, vg.d, 1); }
      P(g, ax - 1, top - 46, 3, 3, cu.m);
    } else for (let k = 0; k < 7; k++) P(g, ax - 10 + (k * 7) % 20, top - 40 + k * 4, 2, 1, stn.d);
    return;
  }
  // stacked-stone elk: body, neck and head of rounded stones, copper antlers
  const rock = (x, y, rx, ry, k) => { ellipse(g, x, y, rx, ry, rough ? stn.d : [stn.m, ramp('#a89878').m, ramp('#9aa0a8').m][k % 3]); if (!rough) P(g, x - rx + 1, y - ry + 1, Math.max(2, rx), 1, stn.h); };
  for (const [x, y] of [[ax - 7, top - 1], [ax + 7, top - 1]]) { P(g, x - 1, y - 12, 3, 12, rough ? stn.d : stn.m); }
  rock(ax, top - 16, 12, 5, 0); rock(ax - 4, top - 22, 8, 4, 1); rock(ax + 6, top - 21, 6, 4, 2);
  rock(ax + 9, top - 28, 4, 4, 0); rock(ax + 11, top - 34, 5, 3, 1);
  if (!rough) {
    const an = cu;
    line(g, ax + 10, top - 37, ax + 6, top - 50, an.m, 2); line(g, ax + 13, top - 37, ax + 18, top - 49, an.m, 2);
    for (const [x0, y0, x1, y1] of [[ax + 7, top - 45, ax + 2, top - 48], [ax + 8, top - 41, ax + 3, top - 42], [ax + 16, top - 45, ax + 21, top - 47], [ax + 15, top - 41, ax + 20, top - 41]]) line(g, x0, y0, x1, y1, an.l, 1);
    P(g, ax + 13, top - 35, 1, 1, '#2a2a30');
  }
}

// The merchant's mule, side view facing right. pose: 'walk' (frame 0-3), 'stand', 'swish' (tail), 'graze' (head down).
function makeMule(pose, frame = 0) {
  const c = mk(36, 31), g = c.getContext('2d'), ax = 18, by = 30; // room for the ears and a swished tail
  const mc = ramp('#8a7866'), mane = '#3a2e26', pale = '#dcd0bc', hoof = '#2a2420', strap = ramp('#7a3a2a');
  // legs: slim, far pair a shade darker, a real stride in the walk
  const st = pose === 'walk' ? [[2, -2], [1, -1], [-2, 2], [-1, 1]][frame % 4] : [0, 0];
  const leg = (x, dx, col) => { line(g, x, by - 10, x + dx, by - 2, col, 1); line(g, x + 1, by - 10, x + 1 + dx, by - 2, col, 1); P(g, x + dx, by - 1, 2, 1, hoof); };
  leg(ax + 7, st[1], mc.d); leg(ax - 8, st[0], mc.d);
  leg(ax + 4, st[0], mc.m); leg(ax - 5, st[1], mc.m);
  // tail
  const sw = pose === 'swish' ? 3 : 0;
  line(g, ax - 11, by - 16, ax - 13 - sw, by - 10, mc.d, 1); P(g, ax - 14 - sw, by - 10, 2, 3, mane);
  // barrel with a rounded rump, pale belly, light along the back
  ellipse(g, ax - 1, by - 14, 10, 5, mc.m); ellipse(g, ax - 8, by - 15, 4, 4, mc.m);
  P(g, ax - 9, by - 19, 15, 1, mc.l); P(g, ax - 7, by - 11, 13, 2, '#b8a890'); P(g, ax - 10, by - 13, 2, 3, mc.d);
  // neck and head (lowered to graze)
  const graze = pose === 'graze';
  const hx = graze ? ax + 13 : ax + 11, hy = graze ? by - 7 : by - 23;
  line(g, ax + 6, by - 16, hx - 1, hy + 2, mc.m, 4); line(g, ax + 5, by - 19, hx - 3, hy, mane, 1);
  P(g, hx - 2, hy - 1, 6, 4, mc.m); P(g, hx - 2, hy - 1, 6, 1, mc.l); P(g, hx + 2, hy, 3, 3, pale); P(g, hx + 4, hy + 1, 1, 1, '#2a2420');
  P(g, hx - 1, hy, 1, 1, '#1c1220'); // eye
  line(g, hx - 2, hy - 1, hx - 3, hy - 6, mc.d, 1); line(g, hx, hy - 1, hx + 1, hy - 6, mc.m, 1); // long ears
  // collar and a strap over the back
  line(g, ax + 6, by - 19, ax + 7, by - 13, strap.m, 2); P(g, ax + 7, by - 15, 1, 1, '#e8c050');
  line(g, ax - 1, by - 19, ax - 1, by - 10, strap.d, 1);
  P(g, hx - 3, hy + 2, 2, 1, strap.m); // halter
  outline(c);
  return { cv: c, ax, by, halter: [hx - 3 - ax, hy + 2 - by] };
}

// A wooden ladder leaning on a tree, and the landscapers' wheelbarrow (fill 0 empty – 2 heaped with clippings).
function makeLadder() {
  const c = mk(16, 34), g = c.getContext('2d'), ax = 8, by = 33, wd = ramp('#b8905a');
  line(g, ax - 5, by, ax - 1, by - 31, wd.m, 1); line(g, ax + 2, by, ax + 5, by - 31, wd.d, 1);
  for (let k = 1; k < 8; k++) { const y = by - k * 4, t = k / 8; line(g, Math.round(ax - 5 + 4 * t), y, Math.round(ax + 2 + 3 * t), y, wd.l, 1); }
  outline(c);
  return { cv: c, ax, by };
}

function makeBarrow(fill) {
  const c = mk(30, 18), g = c.getContext('2d'), ax = 15, by = 16, tr = ramp('#3a7a5a'), wd = ramp('#8a5a30');
  line(g, ax - 13, by - 8, ax - 4, by - 6, wd.m, 1); line(g, ax - 12, by - 6, ax - 4, by - 4, wd.d, 1);
  line(g, ax - 6, by - 4, ax - 7, by, wd.d, 1);
  P(g, ax - 5, by - 9, 15, 5, tr.m); P(g, ax - 5, by - 9, 15, 1, tr.l); P(g, ax - 3, by - 4, 11, 1, tr.d);
  disc(g, ax + 8, by - 3, 3, '#3a3a46'); P(g, ax + 8, by - 3, 1, 1, '#9aa0aa');
  if (fill) {
    const lf = ['#3a7a2a', '#5a9a3a', '#7ab84a'];
    for (let k = 0; k < (fill > 1 ? 14 : 7); k++) P(g, ax - 4 + ((k * 5) % 13), by - 10 - (fill > 1 ? (k % 3) : 0) - (k % 2), 2, 2, lf[k % 3]);
  }
  outline(c);
  return { cv: c, ax, by };
}

// The travelling fair: a striped tent, a hand-cranked carousel (8 frames) and a ring-toss stall.
function makeFairTent() {
  const c = mk(40, 46), g = c.getContext('2d'), ax = 20, by = 44;
  const rd = ramp('#d03a3a'), wh = ramp('#f4ece0');
  P(g, ax - 1, by - 44, 1, 8, '#4a4a56'); P(g, ax, by - 44, 6, 4, '#f0c030'); P(g, ax, by - 42, 6, 1, '#d89a20');
  for (let y = by - 36; y < by; y++) {
    const t = (y - (by - 36)) / 36, half = Math.round(3 + t * 15);
    for (let x = -half; x <= half; x++) {
      const band = Math.floor(((x + half) / (2 * half + 1)) * 6) % 2;
      const shade = x > half * 0.5 ? 'd' : x < -half * 0.5 ? 'l' : 'm';
      P(g, ax + x, y, 1, 1, band ? wh[shade] : rd[shade]);
    }
  }
  for (let i = 0; i < 7; i++) { const sx = ax - 18 + i * 6, col = i % 2 ? wh.m : rd.m; P(g, sx, by - 14, 5, 1, col); P(g, sx + 1, by - 13, 3, 1, col); }
  P(g, ax - 4, by - 11, 9, 11, '#2a1a20'); P(g, ax - 4, by - 11, 2, 11, rd.d); P(g, ax + 3, by - 11, 2, 11, rd.d);
  outline(c);
  return { cv: c, ax, by };
}

function makeCarousel(frame) {
  const c = mk(52, 54), g = c.getContext('2d'), ax = 26, by = 51;
  const gold = ramp('#e8b840'), rd = ramp('#d03a3a'), wh = ramp('#f4ece0'), wd = ramp('#9a6a3a');
  const horses = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (frame / 8) * (Math.PI / 3);
    horses.push({ x: Math.round(Math.cos(a) * 17), z: Math.sin(a), bob: Math.round(Math.sin(a * 2 + i) * 2), col: ['#f4ece0', '#e8b878', '#a8c8e8'][i % 3], kid: i % 3 === 1 ? ['#e86a3a', '#30a8a8', '#c85ac0'][i % 3] : null });
  }
  const drawHorse = (h) => {
    const x = ax + h.x, y = by - 16 + h.bob, hc = ramp(h.col);
    P(g, x, by - 40, 1, 30, gold.m);
    P(g, x - 3, y - 2, 7, 3, hc.m); P(g, x - 3, y - 2, 7, 1, hc.l); P(g, x + 3, y - 5, 2, 4, hc.m); P(g, x + 4, y - 6, 2, 2, hc.l);
    P(g, x - 3, y + 1, 1, 3, hc.d); P(g, x + 2, y + 1, 1, 3, hc.d); P(g, x - 4, y - 2, 1, 2, '#6a4a3a');
    if (h.kid) { P(g, x - 1, y - 6, 3, 4, h.kid); P(g, x - 1, y - 9, 3, 3, '#e8b48a'); P(g, x - 1, y - 10, 3, 1, '#4a2a18'); }
  };
  // platform
  ellipse(g, ax, by - 6, 23, 5, wd.d); ellipse(g, ax, by - 7, 23, 4, wd.m); ellipse(g, ax, by - 8, 21, 3, wd.l);
  horses.filter((h) => h.z < 0).forEach(drawHorse);
  P(g, ax - 2, by - 42, 4, 34, gold.d); P(g, ax - 1, by - 42, 1, 34, gold.h);
  horses.filter((h) => h.z >= 0).forEach(drawHorse);
  // striped cone roof with a scalloped rim and bulbs
  for (let y = by - 50; y < by - 40; y++) {
    const half = Math.round(2 + ((y - (by - 50)) / 10) * 22);
    for (let x = -half; x <= half; x++) P(g, ax + x, y, 1, 1, (Math.floor((x + half + frame) / 4) % 2 ? wh : rd)[x > half * 0.5 ? 'd' : 'm']);
  }
  for (let i = 0; i < 9; i++) { const sx = ax - 24 + i * 6, col = i % 2 ? wh.m : rd.m; P(g, sx, by - 40, 6, 1, col); P(g, sx + 1, by - 39, 4, 1, col); P(g, sx + 2, by - 41, 2, 1, '#fff2a0'); }
  P(g, ax - 1, by - 53, 3, 3, gold.l);
  outline(c);
  return { cv: c, ax, by };
}

function makeTossStall() {
  const c = mk(34, 44), g = c.getContext('2d'), ax = 17, by = 42;
  const bl = ramp('#3a6ad0'), wh = ramp('#f4ece0'), wd = ramp('#9a6a3a');
  P(g, ax - 14, by - 36, 2, 36, wd.d); P(g, ax + 12, by - 36, 2, 36, wd.d);
  for (let r = 0; r < 6; r++) for (let i = ax - 16; i < ax + 16; i++) P(g, i, by - 42 + r, 1, 1, Math.floor((i - ax + 16) / 4) % 2 ? wh[r < 2 ? 'h' : 'm'] : bl[r < 2 ? 'l' : 'm']);
  for (let i = 0; i < 8; i++) { const sx = ax - 16 + i * 4, col = i % 2 ? wh.m : bl.m; P(g, sx, by - 36, 4, 1, col); P(g, sx + 1, by - 35, 2, 1, col); }
  // bottles to ring and prizes on the back shelf
  P(g, ax - 11, by - 22, 23, 1, wd.l);
  for (let k = 0; k < 6; k++) { const bx = ax - 10 + k * 4; P(g, bx, by - 27, 2, 5, ['#4a9a5a', '#c84a3a', '#d8a030'][k % 3]); P(g, bx, by - 28, 2, 1, '#e8e0d0'); }
  for (const [px, pc] of [[ax - 8, '#c88a5a'], [ax + 1, '#e8a0c0'], [ax + 8, '#8ac0e8']]) { disc(g, px, by - 31, 2, pc); P(g, px - 1, by - 34, 1, 1, pc); P(g, px + 1, by - 34, 1, 1, pc); }
  P(g, ax - 13, by - 14, 27, 3, wd.l); P(g, ax - 13, by - 14, 27, 1, wd.h);
  P(g, ax - 12, by - 11, 25, 11, bl.m); P(g, ax - 12, by - 11, 25, 1, bl.l);
  for (let x = ax - 10; x < ax + 12; x += 4) P(g, x, by - 9, 2, 7, wh.m);
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

/* ---------- random events ---------- */
// Visiting crews with their own props. Each entry in EVENTS is self-contained; the card's event framework
// (_spawnEvents and friends) schedules them, runs their stages and draws their props. To add an event:
// add an entry here (crew roles from CREW_LOOKS, a spot on open ground, plan/visit/props hooks), any new
// poses/tools/FX it needs, and a row in the README. See "Adding an event" in CLAUDE.md.
//
// Stages: arrive → setup (only with setupSecs) → open → packup (only with packSecs) → leave.
// Hooks (all optional except crewPlan): start(c, ev), instant(c, ev) when the card loads mid-event,
// crewPlan(c, v, ev, i) → a plan or null (null = leave), visit(c, v, ev) → an onlooker plan,
// tick(c, ev) once a second, props(c, ev, add) to draw, blocks(c, ev) → footprints, lights(c, ctx, ev, dark)
// with lightRects(c, ev, dark) → [x, y, w, h, depth line, tint?] so people in front of those lights are redrawn,
// keep(c, day, min) for anything that outlasts the event (a sculpture, trimmed shrubs).

const DAY_MOODS = ['morning', 'work', 'meal'];
// Where things happen (sim units). Open ground, off the paths, away from doors and benches.
const CART_AT = { x: 154, y: 116.6 };
const MULE_LEAD = 16; // the merchant walks at the mule's head, this far ahead of the cart's centre
const SCULPT_AT = { x: 70, y: 86.6 };
const FAIR_AT = { tent: { x: 142.5, y: 114.8 }, carousel: { x: 155, y: 121.6 }, stall: { x: 167, y: 115.4 } };
const PRUNE_TREES = [[160, 70], [197, 71]];

const towardX = (x, cx) => (x < cx ? 1 : -1);
const fairPiece = (ev, k) => ev.progress >= { tent: 0.15, stall: 0.45, carousel: 0.75, pennants: 0.95 }[k];

const EVENTS = {
  merchant: {
    label: 'Travelling merchant', icon: '🛒', text: 'A travelling merchant has set up shop',
    crew: ['merchant'], weight: 3, hours: [9, 15], minutes: [30, 50], moods: DAY_MOODS, setupSecs: 14, packSecs: 10,
    suggest: ['market', 'merchant', 'delivery', 'deliveries', 'packages?', 'parcels?', 'shopping', 'groceries'],
    // The rig always travels east: in by the west lane, out along the main road. So the mule is on the cart's
    // east side, well away from the pond, and nothing has to turn round.
    start(c, ev) { ev.data.parked = false; ev.crew[0].entry = 'west'; },
    instant(c, ev) { ev.data.parked = true; },
    crewPlan(c, v, ev) {
      const { x, y } = CART_AT, head = { x: x + MULE_LEAD, y: y + 0.9 }, stall = { x: x - 9.4, y: y + 0.5 };
      if (ev.stage === 'arrive') {
        v.leading = true;
        return { ...head, face: 1, action: 'idle', dur: 0.6, done: () => { v.leading = false; ev.data.parked = true; v.ready = true; } };
      }
      if (ev.stage === 'setup' || ev.stage === 'packup') return { ...stall, face: 1, action: 'build', dur: 2 };
      if (ev.stage === 'open') {
        return { ...stall, face: Math.random() < 0.75 ? 1 : -1, action: 'sell', dur: rand(4, 9), onArrive: () => { if (Math.random() < 0.3) v.bubble = { g: 'coin', c: '#c89a20', t: 1.4 }; } };
      }
      if (ev.data.parked) return { ...head, face: 1, action: 'hitch', dur: 1.2, done: () => { ev.data.parked = false; v.leading = true; } };
      return { x: W + MULE_LEAD + 12, y: ENTRANCE[1], gone: true, action: 'gone', dur: 9999 }; // drive on east, cart and all
    },
    visit(c, v) {
      const x = CART_AT.x + rand(-6, 6);
      return { x, y: CART_AT.y + rand(2.2, 3.4), face: towardX(x, CART_AT.x), action: 'browse', dur: rand(4, 8), onArrive: () => { if (Math.random() < 0.5) v.bubble = { g: Math.random() < 0.6 ? 'coin' : 'heart', c: '#c89a20', t: 1.4 }; } };
    },
    blocks: (c, ev) => (ev.data.parked ? [[142.5, 114.6, 161.5, 116.9], [CART_AT.x + 9, 115.5, CART_AT.x + 17.5, 117.3]] : []),
    props(c, ev, add) {
      const st = ev.progress < 0.4 ? 0 : ev.progress < 0.85 ? 1 : 2, m = ev.crew[0];
      const mule = (pose, f) => c._eventArt(`mule${pose}${f}`, () => makeMule(pose, f));
      if (ev.data.parked) {
        // hitched and patient: a tail swish now and then, a nibble of grass
        const k = Math.floor(c._t / 2.5) % 6, pose = k === 2 ? 'swish' : k === 4 || k === 5 ? 'graze' : 'stand';
        add(CART_AT.x, CART_AT.y, CART_AT.y, c._eventArt(`cart${st}`, () => makeMerchantCart(st)), true);
        add(CART_AT.x + MULE_LEAD - 3, CART_AT.y + 0.4, CART_AT.y + 0.4, mule(pose, 0));
        return;
      }
      if (!m.leading || m.gone) return;
      // on the road: the merchant leads the mule by a rope, the cart rolls along behind
      const mx = m.x - 3, my = m.y - 0.5, spr = mule(m.walking ? 'walk' : 'stand', m.walking ? Math.floor(c._t * 8) % 4 : 0);
      add(m.x - MULE_LEAD, m.y - 0.6, m.y - 0.62, c._eventArt('cart0', () => makeMerchantCart(0)), true);
      add(mx, my, my, spr);
      const hx = Math.round(mx * S) + spr.halter[0], hy = Math.round(my * S) + spr.halter[1];
      add(0, 0, m.y + 0.01, { cv: null, draw: (ctx) => line(ctx, hx, hy, Math.round(m.x * S) + (m.face > 0 ? -2 : 2), Math.round(m.y * S) - 12, '#6a4a2a', 1) });
    },
  },

  salesman: {
    label: 'Door-to-door salesman', icon: '💼', text: 'A salesman is knocking on doors',
    crew: ['salesman'], weight: 2, hours: [10, 16], minutes: [20, 35], moods: DAY_MOODS,
    suggest: ['door ?bell', 'knock(ing)?', 'front door', 'salesman', 'visitor at the door'],
    start(c, ev) { ev.data.route = HOUSES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 4); },
    crewPlan(c, v, ev) {
      const route = ev.data.route;
      v.ready = true;
      if (ev.stage === 'leave' || Date.now() > ev.endAt - 45000) { if (ev.stage !== 'leave') c._eventStage('leave'); return null; }
      if (!route.length) {
        // between rounds of doors he works the street, or takes a breather by the fire
        const r = Math.random();
        const marks = c._villagers.filter((o) => o !== v && !o.eventKind && !o.inside && !o.gone && !o.walking && o.y > HORIZON + 10);
        if (r < 0.5 && marks.length) {
          const o = pick(marks), side = o.x > W - 12 ? -1 : o.x < 12 ? 1 : pick([-1, 1]);
          return {
            x: o.x + side * 5, y: o.y, face: -side, carry: 'case', action: 'pitch', dur: rand(4, 7),
            onArrive: () => { v.bubble = { g: 'coin', c: '#c89a20', t: 1.6 }; o.bubble = { g: 'dots', c: '#333', t: 1.6 }; },
            done: () => { if (Math.random() < 0.3) c._spawn({ x: o.x, y: o.y - 11, vx: 0, vy: -4, life: 1.4, g: 'star', c: '#f0c030', layer: 1 }); },
          };
        }
        if (r < 0.8) { const a = rand(0, Math.PI * 2), x = FIRE.x + Math.cos(a) * 21; return { x, y: FIRE.y + 1 + Math.sin(a) * 9, face: towardX(x, FIRE.x), carry: 'case', action: 'idle', dur: rand(8, 20) }; }
        route.push(...HOUSES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 3));
      }
      const hi = route[0], d = HOUSES[hi].door, at = { x: d.x + 2, y: d.y + 0.3, carry: 'case' };
      const next = () => { route.shift(); v.knocked = false; };
      if (!v.knocked) return { ...at, face: -1, action: 'knock', dur: 2, done: () => { v.knocked = true; } };
      if ((c._occ?.[hi]?.inside || 0) > 0) {
        return {
          ...at, face: -1, action: 'pitch', dur: rand(4, 6), onArrive: () => { v.bubble = { g: 'dots', c: '#333', t: 2 }; },
          done: () => { const sale = Math.random() < 0.35; c._spawn({ x: d.x, y: d.y - 10, vx: 0, vy: -4, life: 1.6, g: sale ? 'star' : 'cross', c: sale ? '#f0c030' : '#d84040', layer: 1 }); next(); },
        };
      }
      return { ...at, face: 1, action: 'shrug', dur: 1.6, onArrive: () => { v.bubble = { g: 'q', c: '#333', t: 1.4 }; }, done: next };
    },
  },

  artists: {
    label: 'Visiting artists', icon: '🎨', text: 'Artists are making a sculpture',
    crew: ['artist', 'artist', 'artist'], weight: 2, hours: [9, 13], minutes: [40, 60], moods: DAY_MOODS, previewMins: 4,
    suggest: ['art', 'artists?', 'gallery', 'museum', 'sculpt\\w*', 'painting'],
    start(c, ev) { ev.data.variant = ['elk', 'leaf'][c._dayInfo().day % 2]; },
    tick(c, ev) {
      if (ev.stage !== 'open') return;
      ev.progress = Math.min(1, (Date.now() - ev.startAt) / ev.dur * 1.08);
      if (ev.progress >= 1 && !ev.data.unveiled) {
        ev.data.unveiled = true;
        for (let k = 0; k < 10; k++) c._spawn({ x: SCULPT_AT.x + rand(-5, 5), y: SCULPT_AT.y - 14, vx: rand(-8, 8), vy: rand(-14, -6), life: 1.4, g: k % 2 ? 'spark' : 'heart', c: k % 2 ? '#f0d040' : '#ff6080', layer: 1 });
        c._display = { variant: ev.data.variant, day: c._dayInfo().day };
        c._eventStage('leave');
      }
    },
    crewPlan(c, v, ev, i) {
      const { x, y } = SCULPT_AT, side = [[-5.6, 1], [5.8, -1], [0, 1]][i];
      if (ev.stage === 'arrive') return { x: x + side[0], y: y + 0.4, face: side[1], carry: 'crate', drop: true, action: 'build', dur: 1.5, done: () => { v.ready = true; } };
      if (ev.stage !== 'open') return null;
      if (ev.progress >= 0.9 || i === 2) {
        const ax = x + (i === 0 ? -8 : i === 1 ? 8 : pick([-9, 9]));
        return { x: Math.max(60, ax), y: y + rand(2.6, 3.6), face: towardX(ax, x), action: 'admire', dur: rand(4, 7), onArrive: () => { if (Math.random() < 0.3) v.bubble = { g: 'heart', c: '#e04060', t: 1.2 }; } };
      }
      return { x: x + side[0], y: y + 0.4, face: side[1], action: i === 1 && ev.progress > 0.45 ? 'paint' : 'chisel', dur: rand(6, 12) };
    },
    visit(c, v, ev) {
      if (ev && ev.progress < 0.3) return null;
      const ax = SCULPT_AT.x + (Math.random() < 0.5 ? rand(-10, -5) : rand(5, 10));
      return { x: Math.max(60, ax), y: SCULPT_AT.y + rand(4.2, 6.4), face: towardX(ax, SCULPT_AT.x), action: 'admire', dur: rand(4, 8), onArrive: () => { if (Math.random() < 0.4) v.bubble = { g: 'heart', c: '#e04060', t: 1.2 }; } };
    },
    blocks: (c, ev) => (!ev || ev.stage !== 'arrive' || ev.crew.some((v) => v.ready) ? [[SCULPT_AT.x - 4.2, 84.2, SCULPT_AT.x + 4.2, 86.9]] : []),
    props(c, ev, add) {
      const st = !ev ? 4 : ev.stage === 'arrive' ? 0 : ev.progress < 0.12 ? 0 : ev.progress < 0.4 ? 1 : ev.progress < 0.9 ? 2 : 3;
      if (ev && ev.stage === 'arrive' && !ev.crew.some((v) => v.ready)) return;
      const variant = ev ? ev.data.variant : c._display.variant;
      add(SCULPT_AT.x, SCULPT_AT.y, SCULPT_AT.y + 0.2, c._eventArt(`sculpt${variant}${st}`, () => makeSculpture(variant, st)));
    },
    // the finished piece stays on show for the rest of the day
    keep(c, day, min) {
      if (c._display && (c._display.day !== day || c._mode === 'sleep')) c._display = null;
      if (!c._display && c._mode !== 'sleep' && !(c._event?.kind === 'artists') && c._config.events !== false) {
        const done = c._daySchedule(day).find((e) => e.kind === 'artists' && e.end <= min);
        if (done) c._display = { variant: ['elk', 'leaf'][day % 2], day };
      }
    },
  },

  landscapers: {
    label: 'Landscapers', icon: '✂️', text: 'The landscapers are trimming the greenery',
    crew: ['landscaper', 'landscaper', 'landscaper'], weight: 2, hours: [8, 14], minutes: [40, 60], moods: DAY_MOODS, previewMins: 4,
    suggest: ['garden(er|ers|ing)?', 'lawn', 'landscap\\w*', 'mow(er|ing)?', 'yard ?work', 'hedges?'],
    start(c, ev) {
      c._trimToday();
      ev.data.todo = SHRUBS.map((sh, i) => i).filter((i) => SHRUBS[i][1] / S > 6 && SHRUBS[i][1] / S < W - 6).sort((a, b) => SHRUBS[a][1] - SHRUBS[b][1]);
      ev.data.trees = PRUNE_TREES.slice();
      ev.data.claim = new Map(); // worker → the shrub they're on
      ev.crew[1].pushing = true;
    },
    instant(c, ev) {
      const f = Math.min(1, (Date.now() - ev.startAt) / ev.dur);
      ev.data.todo.slice(0, Math.floor(f * ev.data.todo.length)).forEach((i) => c._trimmed.set.add(i));
      if (f > 0.5) ev.data.trees.shift();
    },
    crewPlan(c, v, ev, i) {
      if (ev.stage === 'arrive') v.ready = true;
      if (ev.stage === 'leave') return null;
      const d = ev.data, trimmed = c._trimmed.set, left = d.todo.filter((k) => !trimmed.has(k)).length + d.trees.length;
      d.claim.delete(v); // a new plan replaces whatever this worker was on
      if (!left) { c._eventStage('leave'); return null; }
      // spread the work over the time the event has left
      const per = Math.max(12, Math.min(240, (ev.endAt - Date.now()) / 1000 / Math.max(1, left / 3)));
      if (i === 2 && d.trees.length) {
        const [tx, ty] = d.trees[0];
        return { x: tx - 3.5, y: ty + 0.8, face: 1, carry: 'ladder', drop: true, action: 'prune', dur: per, done: () => { d.trees.shift(); } };
      }
      const taken = new Set(d.claim.values());
      const k = d.todo.find((j) => !trimmed.has(j) && !taken.has(j));
      if (k === undefined) return { ...c._wanderNear(v), action: 'idle', dur: rand(4, 8) };
      d.claim.set(v, k);
      const [, bx, by, br] = SHRUBS[k], cx = bx / S, off = (br * 5) / 2 / S + 1.6, side = cx + off < W - 3 ? 1 : -1;
      return { x: cx + side * off, y: by / S + 0.5, face: -side, action: 'trim', dur: per, done: () => { trimmed.add(k); d.claim.delete(v); } };
    },
    props(c, ev, add) {
      for (const v of ev.crew) {
        if (v.gone) continue;
        if (v.action === 'prune' && !v.walking) add(v.x + v.face * 2, v.y, v.y - 0.05, c._eventArt('ladder', makeLadder));
        if (v.pushing) {
          const fill = Math.min(2, Math.floor((c._trimmed.set.size / Math.max(1, ev.data.todo.length)) * 3));
          const bx = v.walking ? v.x + v.face * 8 : v.x - v.face * 7;
          add(bx, v.y, v.y - 0.03, c._eventArt(`barrow${fill}`, () => makeBarrow(fill)), v.walking ? v.face < 0 : v.face > 0);
        }
      }
    },
    // shrubs stay trimmed for the rest of the day
    keep(c, day, min) {
      c._trimToday();
      if (c._config.events !== false && !(c._event?.kind === 'landscapers') && c._daySchedule(day).some((e) => e.kind === 'landscapers' && e.end <= min)) {
        SHRUBS.forEach((sh, i) => c._trimmed.set.add(i));
      }
    },
  },

  fair: {
    label: 'Travelling fair', icon: '🎠', text: 'A travelling fair has come to town',
    crew: ['ringmaster', 'fairfolk', 'fairfolk', 'fairfolk'], weight: 1, hours: [13, 16.5], minutes: [90, 150],
    moods: ['work', 'meal', 'evening'], setupSecs: 40, packSecs: 25, extraVisitors: 3, draw: 0.6, maxVisitors: 6,
    suggest: ['fair', 'funfair', 'carnival', 'circus', 'carousel'],
    crewPlan(c, v, ev, i) {
      const { tent, carousel, stall } = FAIR_AT;
      const spots = [
        { x: tent.x + 1, y: tent.y + 1.6, face: 1 }, { x: carousel.x + 7.4, y: carousel.y - 0.4, face: -1 },
        { x: stall.x, y: stall.y - 3.6, face: -1 }, { x: carousel.x + rand(-4, 4), y: carousel.y + 2.6, face: pick([-1, 1]) },
      ];
      if (ev.stage === 'arrive') return { ...spots[i], carry: 'crate', drop: true, action: 'build', dur: 1.2, done: () => { v.ready = true; } };
      if (ev.stage === 'setup' || ev.stage === 'packup') return { ...spots[i], action: 'build', dur: 2 };
      if (ev.stage !== 'open') return null;
      const act = ['announce', 'crank', 'sell', 'juggle'][i];
      return {
        ...spots[i], action: act, dur: rand(6, 12),
        onArrive: () => { if (i === 0) c._spawn({ x: v.x + v.face * 3, y: v.y - 11, vx: 0, vy: -5, life: 1.6, g: 'bang', c: '#d03030', layer: 1 }); },
      };
    },
    visit(c, v) {
      const { carousel, stall } = FAIR_AT;
      if (!v.small && Math.random() < 0.45) {
        const x = stall.x + rand(-3, 3);
        return { x, y: stall.y + 2.4, face: towardX(x, stall.x), action: 'toss', dur: rand(4, 8), done: () => { if (Math.random() < 0.3) c._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -4, life: 1.4, g: 'star', c: '#f0c030', layer: 1 }); } };
      }
      const x = carousel.x + rand(-10, 10);
      return { x, y: Math.min(H - 1.5, carousel.y + rand(1.8, 3.4)), face: towardX(x, carousel.x), action: v.small ? 'cheer' : 'admire', dur: rand(5, 10) };
    },
    blocks(c, ev) {
      const out = [];
      if (ev.stage === 'arrive') return out;
      const { tent, carousel, stall } = FAIR_AT;
      if (fairPiece(ev, 'tent')) out.push([tent.x - 4.4, tent.y - 3, tent.x + 4.4, tent.y + 0.3]);
      if (fairPiece(ev, 'carousel')) out.push([carousel.x - 6.6, carousel.y - 4.6, carousel.x + 6.6, carousel.y + 0.3]);
      if (fairPiece(ev, 'stall')) out.push([stall.x - 4, stall.y - 3, stall.x + 4, stall.y + 0.3]);
      return out;
    },
    props(c, ev, add) {
      if (ev.stage === 'arrive') return;
      const { tent, carousel, stall } = FAIR_AT;
      if (fairPiece(ev, 'tent')) add(tent.x, tent.y, tent.y, c._eventArt('tent', makeFairTent));
      if (fairPiece(ev, 'stall')) add(stall.x, stall.y, stall.y, c._eventArt('stall', makeTossStall));
      if (fairPiece(ev, 'carousel')) {
        const spin = ev.stage === 'open' && ev.crew[1].action === 'crank' && !ev.crew[1].walking;
        const f = spin ? Math.floor(c._t * 5) % 8 : 0;
        add(carousel.x, carousel.y, carousel.y, c._eventArt(`carousel${f}`, () => makeCarousel(f)));
      }
      if (fairPiece(ev, 'pennants')) add(0, 0, tent.y + 0.1, c._eventArt('pennants', makeFairPennants));
    },
    // where the lights glow, so people standing in front are redrawn over them: [x, y, w, h] in px, and the depth line
    lightRects(c, ev, dark) {
      if (!dark || ev.stage === 'arrive') return [];
      const { carousel, stall } = FAIR_AT, out = [];
      if (fairPiece(ev, 'carousel')) out.push([carousel.x * S - 30, carousel.y * S - 48, 64, 16, carousel.y]);
      if (fairPiece(ev, 'stall')) out.push([stall.x * S - 16, stall.y * S - 48, 32, 32, stall.y]);
      return out;
    },
    lights(c, ctx, ev, dark) {
      if (!dark || ev.stage === 'arrive') return;
      const { carousel, stall } = FAIR_AT;
      if (fairPiece(ev, 'carousel')) for (let k = 0; k < 9; k++) c._glow(ctx, carousel.x * S - 22 + k * 6, carousel.y * S - 41, 7, '255,220,120', 0.5);
      if (fairPiece(ev, 'stall')) c._glow(ctx, stall.x * S, stall.y * S - 32, 16, '255,200,120', 0.45);
    },
  },
};
const EVENT_MODES = Object.keys(EVENTS).map((k) => `event:${k}`);
const eventOfMode = (m) => (typeof m === 'string' && m.startsWith('event:') && EVENTS[m.slice(6)] ? m.slice(6) : null);

// Pennant string from the tent's peak to the stall's awning, cropped to its box (anchored so add(0, 0) lands it).
function makeFairPennants() {
  const { tent, stall } = FAIR_AT;
  const x0 = tent.x * S, y0 = tent.y * S - 38, x1 = stall.x * S - 14, y1 = stall.y * S - 40;
  const L = Math.floor(Math.min(x0, x1)) - 2, T = Math.floor(Math.min(y0, y1)) - 2;
  const c = mk(Math.ceil(Math.abs(x1 - x0)) + 8, Math.ceil(Math.abs(y1 - y0)) + 14), g = c.getContext('2d'), cols = ['#e04848', '#f0c040', '#40a0e0', '#50c060'];
  g.translate(-L, -T);
  const n = Math.round((x1 - x0) / 3);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 6);
    P(g, x, y, 3, 1, '#3a3030');
    if (i % 2 && i < n) { const cl = ramp(cols[(i >> 1) % cols.length]); P(g, x - 1, y + 1, 4, 2, cl.m); P(g, x, y + 3, 2, 1, cl.d); }
  }
  return { cv: c, ax: -L, by: -T };
}

// Which events happen on a given day (wall-clock minutes from midnight), from the date and the card's seed.
// Every dashboard shows the same events on the same day; the same kind never runs twice in a row.
const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
function eventsForDay(key, seed = 42, freq = 'daily') {
  // walk forward from a week back so "not the same as yesterday" agrees with what yesterday really had
  const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100 - 1, d = key % 100;
  let last = null, out = [];
  for (let k = 7; k >= 0; k--) {
    out = eventsOnDay(dayKey(new Date(y, m, d - k)), seed, freq, last);
    if (out.length) last = out[out.length - 1].kind;
  }
  return out;
}
function eventsOnDay(key, seed, freq, avoid) {
  const kinds = Object.keys(EVENTS);
  const r = mulberry32((Math.imul(key ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 1, 0xc2b2ae35)) >>> 0);
  r(); r();
  const n = freq === 'often' ? 3 : r() < (freq === 'rare' ? 0.3 : 0.88) ? 1 : 0;
  const out = [];
  let last = avoid;
  for (let i = 0; i < n; i++) {
    const pool = kinds.filter((k) => k !== last);
    let x = r() * pool.reduce((t, k) => t + EVENTS[k].weight, 0), kind = pool[pool.length - 1];
    for (const k of pool) if ((x -= EVENTS[k].weight) <= 0) { kind = k; break; }
    const E = EVENTS[kind];
    let a = E.hours[0] * 60, b = E.hours[1] * 60;
    if (n > 1) { // spread several events over the day
      const s0 = 8 * 60 + i * (600 / n), s1 = s0 + 600 / n;
      if (Math.min(b, s1) > Math.max(a, s0)) { a = Math.max(a, s0); b = Math.min(b, s1); } else { a = s0; b = s1; }
    }
    const start = Math.round(a + r() * (b - a)), dur = Math.round(E.minutes[0] + r() * (E.minutes[1] - E.minutes[0]));
    out.push({ kind, start, end: start + dur });
    last = kind;
  }
  return out;
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
const REACTION_MODES = new Set(['auto', ...Object.keys(MODES), ...EVENT_MODES]);
const modeInfo = (m) => {
  if (m === 'auto') return { icon: '🗓️', label: 'Daily routine', text: 'Follow the normal schedule' };
  const ev = eventOfMode(m);
  return ev ? { icon: EVENTS[ev].icon, label: `Event: ${EVENTS[ev].label}`, text: EVENTS[ev].text } : MODES[m];
};

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
function activatedAt(st, now, id = st.entity_id) {
  const d = domainOf(id);
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
    const ts = activatedAt(st, now, t.entity);
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
  ...Object.entries(EVENTS).map(([k, E]) => [`event:${k}`, E.suggest]), // before "work", so "Yard work" means landscapers
  ['work', ['work', 'working', 'focus', 'office', 'study']],
].map(([mode, words]) => [mode, new RegExp(`\\b(${words.join('|')})\\b`, 'i')]);
const SUGGEST_DURATION = {
  auto: 900, gaming: 240, sleep: 480, away: 720, morning: 60, meal: 90, party: 180, movie: 150, cozy: 150, work: 240,
  ...Object.fromEntries(Object.entries(EVENTS).map(([k, E]) => [`event:${k}`, E.minutes[1]])),
};

function suggestReactions(states, existing = []) {
  if (!states) return [];
  const have = new Set(existing.map((t) => `${t.entity}|${t.mode}`));
  const out = [];
  const add = (s) => { if (!have.has(`${s.entity}|${s.mode}`)) { have.add(`${s.entity}|${s.mode}`); out.push(s); } };
  const nameOf = (id, st) => String(st.attributes?.friendly_name || id.split('.')[1].replace(/_/g, ' '));
  for (const [id, st] of Object.entries(states)) {
    const d = domainOf(id), name = nameOf(id, st);
    if (['scene', 'script', 'button', 'input_button'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([, re]) => re.test(name));
      if (hit) add({ entity: id, when: 'activated', mode: hit[0], duration: SUGGEST_DURATION[hit[0]], why: hit[0] === 'auto' ? `"${name}" sounds like the start of a normal day` : eventOfMode(hit[0]) ? `"${name}" could bring the ${EVENTS[eventOfMode(hit[0])].label.toLowerCase()}` : `"${name}" sounds like ${MODES[hit[0]].label.toLowerCase()}` });
    } else if (['input_boolean', 'switch'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([m, re]) => (['party', 'movie', 'gaming', 'sleep', 'away', 'cozy'].includes(m) || eventOfMode(m)) && re.test(name));
      if (hit) add({ entity: id, when: 'on', mode: hit[0], why: `while "${name}" is on` });
    } else if (d === 'alarm_control_panel') {
      add({ entity: id, when: 'state', state: ['armed_away', 'armed_vacation'], mode: 'away', why: `when "${name}" is armed away` });
      add({ entity: id, when: 'state', state: ['armed_night'], mode: 'sleep', why: `when "${name}" is armed for the night` });
    } else if (d === 'media_player' && (st.attributes?.device_class === 'tv' || /\b(tv|television|living room|lounge|theat(er|re)|projector)\b/i.test(name))) {
      add({ entity: id, when: 'state', state: ['playing'], mode: 'movie', why: `while "${name}" is playing` });
    }
  }
  const people = Object.keys(states).filter((k) => k.startsWith('person.'));
  if (states['zone.home'] && people.length) add({ entity: 'zone.home', when: 'numeric', below: 1, mode: 'away', why: 'when nobody is home' });
  else if (people.length === 1) add({ entity: people[0], when: 'not_state', state: ['home'], mode: 'away', why: 'when you leave home' });
  const order = ['auto', ...Object.keys(MODES), ...EVENT_MODES];
  return out.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)).slice(0, 16);
}

/* ---------- visual editor ---------- */

const MODE_OPTIONS = ['auto', ...Object.keys(MODES), ...EVENT_MODES].map((value) => { const m = modeInfo(value); return { value, label: `${m.icon} ${m.label} — ${m.text}` }; });
const SCHEDULE_FIELDS = [
  ['wake', 'Wake up'], ['work', 'Start work'], ['lunch', 'Lunch'], ['work_after_lunch', 'Back to work'],
  ['dinner', 'Dinner'], ['evening', 'Evening by the fire'], ['sleep', 'Bedtime'],
];
const EDITOR_LABELS = {
  title: 'Title', villagers: 'Residents', visitors: 'Visitors, mail carrier and party band', animals: 'Animals',
  show_status: 'Show the status line', fps: 'Frames per second', events: 'Random events', event_frequency: 'How often',
  weather_entity: 'Weather', sun_entity: 'Sun', mode_entity: 'Mood helper (optional)',
  entity: 'When this', when: 'Condition', state: 'State', attribute: 'Attribute (optional)',
  above: 'Above', below: 'Below', duration: 'Stay in this mood for (minutes)', mode: 'The village goes into', label: 'Caption (optional)',
  ...Object.fromEntries(SCHEDULE_FIELDS),
};
const EDITOR_HELPERS = {
  villagers: 'People who live in the village (1–10).',
  fps: 'Lower saves a little power; 15 is smooth.',
  events: `Now and then a crew drops by: ${Object.values(EVENTS).map((E) => E.label.toLowerCase()).join(', ')}. A reaction can bring one on demand.`,
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
  if (kind !== 'activated' || Number(out.duration) === 120) delete out.duration; // 120 minutes is the default
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
    if (!customElements.get('ha-form')) haComponents = null; // try again next time the editor opens
  })();
  return haComponents;
}

const stableJson = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

class PixelVillageCardEditor extends HTMLElement {
  setConfig(config) {
    // HA hands back every config we emit; rebuilding then would steal focus mid-typing.
    if (this._ready && this._emitted && stableJson(config) === this._emitted) return;
    this._config = { ...config, triggers: Array.isArray(config.triggers) ? config.triggers.map((t) => ({ ...t })) : [] };
    if (this._ready) this._refresh();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._ready) {
      for (const f of this.shadowRoot.querySelectorAll('ha-form')) f.hass = hass;
      // suggestions scan every entity: at most every few seconds, not on every state change
      const now = Date.now();
      if (now - (this._suggAt || 0) > 5000) { this._suggAt = now; this._renderSuggestions(); }
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
    // weather_entity: false means "no weather" and must survive; only empty values are dropped
    for (const k of ['title', 'weather_entity', 'mode_entity']) if (c[k] === '' || c[k] == null) delete c[k];
    if (c.sun_entity === 'sun.sun' || !c.sun_entity) delete c.sun_entity;
    for (const k of ['visitors', 'animals', 'show_status', 'events']) if (c[k] === true) delete c[k];
    if (c.event_frequency === 'daily' || !c.event_frequency) delete c.event_frequency;
    if (Number(c.fps) === DEFAULT_FPS) delete c.fps;
    if (Number(c.villagers) === 6) delete c.villagers;
    if (c.schedule) {
      const sch = {};
      for (const [k] of SCHEDULE_FIELDS) {
        const v = c.schedule[k], h = v === undefined || v === null || v === '' ? NaN : parseHour(v);
        if (h >= 0 && h < 24 && hourToTime(h) !== hourToTime(DEFAULT_SCHEDULE[k])) sch[k] = hourToTime(h);
      }
      if (Object.keys(sch).length) c.schedule = sch; else delete c.schedule;
    }
    if (c.schedule) this._config.schedule = c.schedule; else delete this._config.schedule;
    this._emitted = stableJson(c);
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
      { type: 'grid', name: '', schema: [
        { name: 'events', selector: { boolean: {} } },
        { name: 'event_frequency', selector: { select: { mode: 'dropdown', options: [
          { value: 'rare', label: 'Rarely (a couple a week)' }, { value: 'daily', label: 'About once a day' }, { value: 'often', label: 'Often (a few a day)' },
        ] } } },
      ] },
      { name: 'show_status', selector: { boolean: {} } },
      { name: 'fps', selector: { number: { min: 2, max: 30, step: 1, mode: 'box' } } },
    ], {
      title: cfg.title ?? '', villagers: cfg.villagers ?? 6, visitors: cfg.visitors !== false, animals: cfg.animals !== false,
      events: cfg.events !== false, event_frequency: cfg.event_frequency ?? 'daily',
      show_status: cfg.show_status !== false, fps: cfg.fps ?? 15,
    }, (v) => { Object.assign(this._config, v); this._emit(); }));

    const env = this._section('Surroundings', 'The village follows the sun and the weather. A mood helper lets automations set the mood directly.');
    env.appendChild(this._form([
      { name: 'weather_entity', selector: { entity: { domain: 'weather' } } },
      { name: 'sun_entity', selector: { entity: { domain: 'sun' } } },
      { name: 'mode_entity', selector: { entity: { domain: ['input_select', 'select', 'input_text'] } } },
    ], { weather_entity: cfg.weather_entity || '', sun_entity: cfg.sun_entity ?? 'sun.sun', mode_entity: cfg.mode_entity ?? '' },
    (v) => {
      // weather turned off in YAML (false) shows as an empty picker; keep it off unless one is picked
      if (this._config.weather_entity === false && !v.weather_entity) v = { ...v, weather_entity: false };
      Object.assign(this._config, v); this._emit();
    }));

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
        // another entity's states and attributes don't carry over
        if (entityChanged) v = { ...v, state: v.state === t.state ? undefined : v.state, attribute: v.attribute === t.attribute ? undefined : v.attribute };
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

/* ---------- shared render caches ---------- */

// The painted part of a sprite canvas, [left, top, right, bottom): outline() notes it while it has the
// pixels; anything drawn without an outline counts as the whole canvas (no readback just for this).
function opaqueBox(cv) {
  return (cv._box ||= [0, 0, cv.width, cv.height]);
}

// Glyphs (z's, notes, hearts, bubbles) with their drop shadow, one small sprite per glyph and colour.
const glyphCache = new Map();
function glyphSprite(name, c) {
  let m = glyphCache.get(name);
  if (!m) glyphCache.set(name, (m = new Map()));
  let cv = m.get(c);
  if (!cv) {
    const g = GLYPHS[name];
    cv = mk(g[0].length + 1, g.length + 1);
    const gg = cv.getContext('2d');
    tpl(gg, g, 1, 1, { '#': 'rgba(20,10,30,0.55)' });
    tpl(gg, g, 0, 0, { '#': c });
    if (name === 'heart') P(gg, 1, 1, 1, 1, '#ffffff');
    m.set(c, cv);
  }
  return cv;
}

// Soft radial glows, drawn once per (radius, colour) and stamped with globalAlpha.
const glowCache = new Map();
function glowSprite(r, rgb) {
  let m = glowCache.get(rgb); // by colour, then radius: no key string per call
  if (!m) glowCache.set(rgb, (m = new Map()));
  let c = m.get(r);
  if (!c) {
    c = mk(r * 2, r * 2);
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    m.set(r, c);
  }
  return c;
}

// Land layers (terrain + props + sky mask) and houses are shared by every card on the page, keyed by
// snow/season, and both snow states stay cached so weather flips don't rebuild them.
const landCache = new Map(), landJobs = new Map();
// Returns the land for these conditions, or null while it's still being built (a few ms per call).
function sharedLand(snow, season, budget = Infinity) {
  const key = `${snow ? 'snow' : 'green'}|${season}`;
  let L = landCache.get(key);
  if (!L) {
    let job = landJobs.get(key);
    if (!job) landJobs.set(key, (job = buildLandSteps(snow, season)));
    const t0 = performance.now();
    let r;
    while (!(r = job.next()).done) if (performance.now() - t0 > budget) return null;
    landJobs.delete(key);
    const land = r.value;
    // where the sky shows through: everything the land layer doesn't cover (only the sky rows matter)
    const mask = mk(RW, HZ + 10), mg = mask.getContext('2d');
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, RW, HZ + 10);
    mg.globalCompositeOperation = 'destination-out'; mg.drawImage(land, 0, 0);
    const alpha = mg.getImageData(0, 0, RW, HZ + 10).data, sky = new Uint8Array(RW * (HZ + 10)); // one byte a pixel, not four
    for (let i = 0; i < sky.length; i++) sky[i] = alpha[i * 4 + 3] > 0 ? 1 : 0;
    L = { land, mask, skyAt: (x, y) => y >= 0 && y < HZ + 10 && x >= 0 && x < RW && sky[y * RW + x] === 1 };
    if (landCache.size >= 2) landCache.delete(landCache.keys().next().value); // today's green and snowy land
    landCache.set(key, L);
  }
  return L;
}
const sharedArt = { houses: {}, stages: {} };

// The party's light strings (lamp to lamp, lamps to the tavern) never move.
let partyStrings = null;
function getPartyStrings() {
  if (partyStrings) return partyStrings;
  const [l0, l1] = LAMPS, tv = HOUSES[2].g;
  return (partyStrings = [[[l0[0], l0[1] - 40], [l1[0], l1[1] - 40]], [[l0[0], l0[1] - 40], [tv.X - 4, tv.top + 6]], [[tv.X + tv.Wd + 4, tv.top + 6], [l1[0], l1[1] - 40]]]
    .map(([[x0, y0], [x1, y1]]) => {
      const pts = [], n = Math.max(2, Math.round(Math.abs(x1 - x0) / 4));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push([Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 14)]);
      }
      return pts;
    }));
}

const BULB_RGB = ['255,80,80', '255,210,60', '80,230,110', '80,160,255', '255,110,210'];
const BULB_CSS = BULB_RGB.map((c) => `rgb(${c})`);
// Every place a light can be, lit or not (for working out once which props could stand in front of one).
let allLights = null;
function allLightRects() {
  if (allLights) return allLights;
  allLights = [];
  for (const h of HOUSES) {
    for (const [gx, gy] of h.glass) allLights.push([gx, gy, 9, 9, h.base]);
    allLights.push([h.lantern.x - 2, h.lantern.y, 5, 7, h.base]);
  }
  for (const [lx, ly] of LAMPS) allLights.push([lx - 3, ly - 38, 7, 7, ly / S]);
  for (const [lx, ly] of AMPHI_LANTERNS) allLights.push([lx - 1, ly - 1, 3, 3, (ly + 17) / S]);
  for (const [tx, ty] of TABLES) allLights.push([tx - 3, ty - 15, 7, 7, (ty + 3) / S]);
  allLights.push([CART.x - 10, CART.by - 50, 20, 20, CART.by / S]);
  for (const b of partyBulbs()) allLights.push([b.x - 1, b.y, 4, 5, b.base]);
  return allLights;
}

// The party bulbs: every third point on the strings, with the depth line each one hangs over.
let partyBulbList = null;
function partyBulbs() {
  if (partyBulbList) return partyBulbList;
  const [l0, l1] = LAMPS, tb = HOUSES[2].base, ends = [[l0[1] / S, l1[1] / S], [l0[1] / S, tb], [tb, l1[1] / S]];
  partyBulbList = [];
  getPartyStrings().forEach((pts, si) => pts.forEach(([x, y], i) => {
    if (!(i % 3)) partyBulbList.push({ x, y, i, base: lerp(ends[si][0], ends[si][1], i / (pts.length - 1)) });
  }));
  return partyBulbList;
}

const byDepth = (p, q) => p.y - q.y || p.o - q.o;
const SPRITE_CACHE_MAX = 64; // per villager; the least recently drawn poses are dropped first

/* ---------- the card ---------- */

class PixelVillageCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('pixel-village-card-editor');
  }

  static getStubConfig(hass) {
    const weather = autoWeather(hass?.states || {});
    return weather ? { villagers: 6, weather_entity: weather } : { villagers: 6 };
  }

  setConfig(config) {
    validateConfig(config);
    // Only who lives here needs a new village; everything else (reactions, schedule, entities, title...) is
    // read live, so the editor preview stays steady while the user types.
    const worldKey = JSON.stringify([Number(config.villagers) || 6, config.seed || 42, config.visitors !== false, config.animals !== false]);
    const keepWorld = this._villagers && worldKey === this._worldKey;
    this._worldKey = worldKey;
    this._config = {
      villagers: 6, fps: DEFAULT_FPS, show_status: true, sun_entity: 'sun.sun', triggers: [], ...config,
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
    if (missing.length) console.warn(`pixel-village-card: these entities don't exist in Home Assistant: ${missing.join(', ')}`);
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
        <canvas width="${RW}" height="${RH}" role="img" aria-label="Pixel village"></canvas>
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
      if (!this._crashed) { this._crashed = true; console.error('pixel-village-card:', e); }
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

  /* ----- world state ----- */

  _initVillage() {
    const n = Math.max(1, Math.min(10, Math.floor(Number(this._config.villagers)) || 6));
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
    for (const [kind, E] of Object.entries(EVENTS)) E.crew.forEach((role, i) => this._makeGuest(role, g, { eventKind: kind, crewIdx: i }));
    this._nextMail = rand(15, 45);
    this._nextGuest = 0;
    this._initAnimals(g);
    this._particles = [];
    this._screen = 0;
    this._popcorn = false;
    this._sign = 0; // 2 = the BACK SOON sign hangs on the amphitheater screen
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
    this._event = null;
    this._eventReq = null;
    this._display = null;
    this._eventsSeen = false;
    this._lastEnded = null;
    this._landKey = null; this._cloudKey = null; this._trimmed = null; // new stars and clouds: refilter and rebuild them
    this._updateMode();
    if (this._hass) this._spawnEvents(); // events wait for the real states (see set hass)
    this._sync();
  }

  // Time zone as HA's frontend resolves it: the user's profile can say "local" (this browser) or "server".
  _tz() {
    return this._hass?.locale?.time_zone === 'local' ? undefined : this._hass?.config?.time_zone;
  }

  // The current date and time in that zone, as a local Date (only its fields are used).
  _now() {
    const tz = this._tz(), now = new Date();
    if (!tz) return now;
    try {
      if (!this._fmt || this._fmtTz !== tz) {
        this._fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
        this._fmtTz = tz;
      }
      const f = {};
      for (const p of this._fmt.formatToParts(now)) f[p.type] = +p.value;
      return new Date(f.year, f.month - 1, f.day, f.hour % 24, f.minute);
    } catch (e) { return now; }
  }

  _hour() {
    if (typeof this.previewHour === 'number') return this.previewHour;
    const now = this._now();
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
    this._eventReq = null;
    if (trig && eventOfMode(trig.mode)) {
      // an event reaction brings that event to the village; the mood follows the normal day
      this._eventReq = eventOfMode(trig.mode);
      // a scene pressed again is a new request, even if the event it brought has already been and gone
      this._eventReqAt = reactionKind(trig) === 'activated' ? activatedAt(states[trig.entity], Date.now(), trig.entity) : 0;
      mode = scheduleMode(h, this._schedule); reason = trig.label ? trig : null;
    } else if (trig) { mode = trig.mode === 'auto' ? scheduleMode(h, this._schedule) : trig.mode; reason = trig.mode === 'auto' && !trig.label ? null : trig; }
    if (!mode && cfg.mode_entity && MODES[states[cfg.mode_entity]?.state]) mode = states[cfg.mode_entity].state;
    if (!mode) mode = scheduleMode(h, this._schedule);

    let wEnt = cfg.weather_entity;
    if (wEnt === undefined) {
      // no weather configured: use the first one that's working (a broken forecast service can leave one unavailable)
      // (a scan of every entity, so a home with no working weather entity looks again every half minute, not every second)
      if (this._hass && (this._autoWeather === undefined || !isLive(states[this._autoWeather])) && !(this._autoAt > this._t - 30)) {
        this._autoAt = this._t;
        this._autoWeather = autoWeather(states);
      }
      wEnt = this._autoWeather;
    }
    this._weather = readWeather(this.previewWeather ?? (wEnt ? states[wEnt]?.state : ''));
    this._phase = this._phaseFor(h);
    this._season = this.previewSeason || seasonOf(this._now(), this._hass?.config?.latitude < 0);
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
    const ev = this._event, evOn = ev && (ev.stage === 'setup' || ev.stage === 'open');
    if (evOn) text = ev.E.text;
    const label = reason?.label || (evOn ? ev.E.label : MODES[mode].label);
    const status = `${evOn ? ev.E.icon : MODES[mode].icon} ${label} · ${text}`;
    if (status !== this._statusText) {
      this._statusText = status;
      this._status.textContent = status;
      this._canvas.setAttribute('aria-label', `Pixel village: ${label}. ${text}`);
    }
    this._warnMissing();
  }

  _onModeChange(prev, triggered) {
    if (prev === 'movie') this._popcorn = false;
    if (this._mode === 'movie' || this._mode === 'gaming') this._sign = 0; // the screen's needed for the show
    if (prev === undefined) {
      // First run: place everyone where they'd be right now, no commute (again when the first states arrive).
      for (const v of this._villagers) {
        v.walking = false; v.path = []; v.rethinkAt = 0;
        if (!v.guest) { v.inside = false; v.gone = false; v.gear = false; }
        else if (!v.eventKind && v.active) { v.gone = true; this._retireGuest(v); v.plan = null; v.actT = 9999; }
      }
      this._screen = 0; this._popcorn = false; this._sign = 0;
      if (this._mode === 'movie' || this._mode === 'gaming') {
        this._screen = 1;
        this._popcorn = this._mode === 'movie';
      }
      if (this._mode === 'away') {
        this._sign = 2; this._screen = 1;
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
      const want = { sleep: 0, cozy: 0, away: 0, morning: 2, work: 3, meal: 3, evening: 3, movie: 4, gaming: 3, party: 5 }[this._mode] ?? 2;
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

  /* ----- random events: see EVENTS ----- */

  _dayInfo() {
    const now = this._now();
    return { day: dayKey(now), min: now.getHours() * 60 + now.getMinutes() };
  }

  _daySchedule(day) {
    const key = `${day}|${this._config.seed || 42}|${this._config.event_frequency || 'daily'}`;
    if (this._schedKey !== key) { this._schedKey = key; this._sched = eventsForDay(day, this._config.seed || 42, this._config.event_frequency || 'daily'); }
    return this._sched;
  }

  // What should be happening: the demo's preview, then a Home Assistant reaction, then today's schedule.
  _wantedEvent() {
    if (this.previewEvent && EVENTS[this.previewEvent]) return { kind: this.previewEvent, source: 'preview' };
    if (this._eventReq) return { kind: this._eventReq, source: 'reaction', at: this._eventReqAt };
    if (this._config.events === false) return null;
    const { day, min } = this._dayInfo();
    const e = this._daySchedule(day).find((x) => min >= x.start && min < x.end);
    return e ? { ...e, source: 'schedule', day, min } : null;
  }

  _eventKey(want) {
    return want.source === 'schedule' ? `s${want.day}|${want.start}` : `${want.source}|${want.kind}|${want.at || ''}`;
  }

  // Events stay away in bad weather and from moods that don't suit them.
  _eventOk(kind, source) {
    const w = this._weather, m = this._mode;
    if (w.rain || w.snow || w.heavy) return false;
    if (source === 'schedule') return EVENTS[kind].moods.includes(m);
    return !['sleep', 'away', 'cozy', 'movie', 'gaming', 'party'].includes(m);
  }

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
  }

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
  }

  _eventStage(stage) {
    const ev = this._event;
    if (!ev || ev.stage === stage) return;
    ev.stage = stage;
    for (const v of ev.crew) if (v.active) v.rethinkAt = this._t + rand(0.2, 1.2);
  }

  // Crew members doing 'build' put the event up (setup) or take it down (packup).
  _buildEvent(dt) {
    const ev = this._event;
    if (!ev || !ev.E.setupSecs) return;
    const n = ev.crew.length;
    if (ev.stage === 'setup') { ev.progress = Math.min(1, ev.progress + dt / ev.E.setupSecs / n); if (ev.progress >= 1) this._eventStage('open'); }
    else if (ev.stage === 'packup') { ev.progress = Math.max(0, ev.progress - dt / ev.E.packSecs / n); if (ev.progress <= 0) this._eventStage('leave'); }
  }

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
  }

  _wanderNear(v) {
    return { x: Math.max(4, Math.min(W - 4, v.x + rand(-6, 6))), y: Math.max(HORIZON + 8, Math.min(H - 2, v.y + rand(-2, 2))) };
  }

  _eventBlocks() {
    const ev = this._event, out = [];
    if (ev?.E.blocks) out.push(...ev.E.blocks(this, ev));
    if (this._display && ev?.kind !== 'artists') out.push(...EVENTS.artists.blocks(this, null));
    return out;
  }

  _eventArt(key, make) {
    const a = this._art(), m = (a.events ||= new Map());
    let spr = m.get(key);
    if (!spr) m.set(key, (spr = make()));
    return spr;
  }

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
  }

  _trimToday() {
    const { day } = this._dayInfo();
    if (this._trimmed?.day !== day) this._trimmed = { day, set: new Set() };
    return this._trimmed;
  }

  /* ----- guests: visitors, the mail carrier and the travelling band ----- */

  _makeGuest(job, rnd, extra = {}) {
    const p = (arr) => arr[Math.floor(rnd() * arr.length)];
    const id = this._villagers.length;
    const look = job === 'mail'
      ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), shirt: '#3a5a9a', pants: '#2a3a5a', style: 'short' }
      : job === 'band'
        ? { skin: p(LOOKS.skin), ...BAND_LOOKS[extra.instrIdx] }
        : CREW_LOOKS[job]
          ? { skin: p(LOOKS.skin), hair: p(LOOKS.hair), ...CREW_LOOKS[job](p, rnd, extra.crewIdx || 0) }
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
    if (job === 'band' || CREW_LOOKS[job]) v.hat = look.hat;
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
    this._spawnEvents();
    if (cfg.visitors === false) return;
    {
      let target = { sleep: 0, cozy: 0, away: 1, morning: 2, work: 3, meal: 3, evening: 4, movie: 5, gaming: 4, party: 6 }[m] ?? 2;
      if (this._event?.stage === 'open') target += this._event.E.extraVisitors || 0;
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
    if (v.eventKind) {
      const ev = this._event;
      if (!ev || ev.kind !== v.eventKind) return leave();
      return ev.E.crewPlan(this, v, ev, ev.crew.indexOf(v)) || leave();
    }
    if (v.job === 'band') return m === 'party' ? { ...BAND_SPOTS[v.instrIdx], action: 'perform', dur: rand(20, 40) } : leave();
    if (v.job === 'mail') return this._planMail(v, leave);
    if (m === 'cozy') { // everyone's snug indoors: visitors head into the tavern to warm up
      const d = HOUSES[2].door;
      return { x: d.x, y: d.y, gone: true, action: 'gone', dur: 9999 };
    }
    if (m === 'sleep' || this._t > v.stayUntil) return leave();
    const fireSpot = (action) => {
      const a = rand(0, Math.PI * 2), x = FIRE.x + Math.cos(a) * 21, y = FIRE.y + 1 + Math.sin(a) * 9;
      return { x, y, face: x < FIRE.x ? 1 : -1, action, dur: rand(10, 20) };
    };
    // something's going on in the village: visitors drift over to see it
    const look = this._eventVisit(v);
    if (look && Math.random() < (this._event?.E.draw ?? 0.4)) return look;
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
        if (!v.readSign && this._sign === 2) {
          v.readSign = true;
          return { ...AWAY_READ, face: -1, action: 'idle', dur: 3, onArrive: () => { v.bubble = { g: 'dots', c: '#333', t: 2.5 }; } };
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
    if (a.type === 'dog') {
      const o = a.owner, d = HOUSES[o.home].door;
      a.hidden = !!o.gone; a.path = [];
      if (o.inside || o.gone) { a.x = d.x + 4; a.y = d.y + 2; a.state = 'lie'; } // waits on the doorstep
      else { [a.x, a.y] = freeSpot(o.x + rand(-4, 4), o.y + 2); a.state = 'idle'; }
    }
    else if (a.type === 'cat') { [a.x, a.y] = CAT_SPOTS[a.spot]; a.state = 'curl'; a.t = rand(5, 20); }
    else if (a.type === 'rabbit') { const z = RABBIT_ZONES[a.zone]; a.x = rand(z[0], z[2]); a.y = rand(z[1], z[3]); }
    else if (a.type === 'squirrel') { const tb = TREE_BASES[a.tree]; [a.x, a.y] = freeSpot(tb[0] + rand(-4, 4), tb[1] + rand(1, 3)); }
    else { const sp = birdSpot(); a.x = sp.x; a.y = sp.y; a.alt = sp.alt; a.state = 'perch'; }
  }

  _goAnimal(a, x, y, speed, state = 'walk', direct = false) {
    if (!direct) [x, y] = freeSpot(x, y); // never stop inside a house or an event's footprint
    a.path = direct ? [[x, y]] : route(a.x, a.y, x, y);
    [a.tx, a.ty] = a.path.shift();
    a.speed = speed; a.state = state;
  }

  _updateAnimals(dt) {
    const m = this._mode, night = m === 'sleep' || this._phase === 'night';
    const people = this._villagers.filter((v) => !v.inside && !v.gone);
    const near = (a, list, r) => list.find((o) => Math.hypot(o.x - a.x, o.y - a.y) < r);
    let dogs, threats; // built once a frame, when first needed
    for (const a of this._animals) {
      a.anim = (a.anim || 0) + dt;
      if (a.state === 'walk' || a.state === 'run' || a.state === 'hop' || a.state === 'fly') {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), step = a.speed * dt;
        if (Math.abs(dx) > 0.2) a.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          a.x = a.tx; a.y = a.ty;
          if (a.path.length) [a.tx, a.ty] = a.path.shift();
          else {
            a.state = a.rest || 'idle'; a.t = rand(2, 6);
            if (a.type === 'bird') a.alt = a.alt1 || 0;
            if (a.onArrive) { a.onArrive(); a.onArrive = null; }
          }
        } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
        if (a.type === 'bird' && a.state === 'fly') {
          const pr = Math.min(1, Math.max(0, 1 - d / (a.dist || 1)));
          a.alt = lerp(a.alt0 || 0, a.alt1 || 0, pr) + Math.sin(pr * Math.PI) * 14;
        }
        continue;
      }
      a.t -= dt;
      switch (a.type) {
        case 'dog': {
          const o = a.owner;
          if (o.gone) { a.hidden = a.hidden || (a.x > W + 4 || a.x < -4); if (!a.hidden && a.state !== 'run') this._goAnimal(a, W + 12, ENTRANCE[1] + 1, 20, 'run'); break; }
          if (a.hidden) { a.hidden = false; [a.x, a.y] = freeSpot(o.x + 3, o.y + 1); }
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
          const dog = near(a, (dogs ||= this._animals.filter((b) => b.type === 'dog' && !b.hidden)), 7);
          if (dog && a.state !== 'arch') {
            a.state = 'arch'; a.t = 0.6;
            break;
          }
          if (a.state === 'arch' && a.t <= 0) {
            let far = 0, fd = 0;
            CAT_SPOTS.forEach(([x, y], i) => { const d = Math.hypot(x - a.x, y - a.y); if (d > fd && !blocked(x, y)) { fd = d; far = i; } });
            a.spot = far; this._goAnimal(a, ...CAT_SPOTS[far], 24, 'run'); a.rest = 'sit';
            break;
          }
          if (a.t <= 0) {
            if (a.state === 'idle' || a.state === 'sit') { a.state = Math.random() < 0.6 ? 'curl' : 'sit'; a.t = night ? rand(4, 10) : rand(15, 45); }
            else {
              const open = CAT_SPOTS.map((_, i) => i).filter((i) => !blocked(...CAT_SPOTS[i]));
              a.spot = pick(open.length ? open : [0]); this._goAnimal(a, ...CAT_SPOTS[a.spot], 7, 'walk'); a.rest = 'sit';
            }
          }
          break;
        }
        case 'rabbit': case 'squirrel': {
          if (night || this._weather.heavy) { a.hidden = true; break; }
          if (a.hidden) { if (a.t <= 0) { a.hidden = false; this._placeAnimal(a); } break; }
          const threat = near(a, (threats ||= [...people, ...this._animals.filter((b) => b.type === 'dog' || b.type === 'cat')]), a.type === 'rabbit' ? 9 : 7);
          if (threat) {
            if (a.type === 'squirrel') {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, ...freeSpot(tb[0], tb[1] + 0.5), 22, 'hop');
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
              this._goAnimal(a, ...freeSpot(tb[0] + rand(-5, 5), tb[1] + rand(1, 4)), 16, 'hop');
            } else {
              const tb = TREE_BASES[a.tree];
              this._goAnimal(a, ...freeSpot(tb[0] + rand(-6, 6), tb[1] + rand(1, 5)), 12, 'hop');
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
            const sp = birdSpot();
            a.dist = Math.hypot(sp.x - a.x, sp.y - a.y) || 1;
            a.alt0 = a.alt || 0; a.alt1 = sp.alt;
            this._goAnimal(a, sp.x, sp.y, 30, 'fly', true);
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
    a.anim ||= 0;
    const f = Math.floor(a.anim * (a.state === 'run' ? 12 : a.state === 'fly' ? 10 : 6) + a.seed * 10);
    switch (a.type) {
      case 'dog': return a.state === 'walk' || a.state === 'run' ? [a.state, f % 4] : a.state === 'lie' ? ['lie', 0] : a.state === 'sit' ? ['sit', 0] : ['stand', Math.floor(a.anim * 3) % 2];
      case 'cat': return a.state === 'walk' || a.state === 'run' ? ['walk', f % 4] : [a.state === 'idle' ? 'sit' : a.state, 0];
      case 'rabbit': return a.state === 'hop' ? ['hop', f % 2] : ['sit', 0];
      case 'squirrel': return a.state === 'hop' ? ['run', f % 2] : [a.state === 'sit' ? 'sit' : 'run', 0];
      default: return a.state === 'fly' ? ['fly', f % 2] : [a.state === 'peck' ? 'peck' : 'perch', f % 2];
    }
  }

  // [sprite canvas, x, y, mirrored] for this frame (kept on the animal, no allocation)
  _animalGeom(a) {
    if (a._geomFrame === this._frameNo && a._geom) return a._geom;
    a._geomFrame = this._frameNo;
    const [pose, frame] = this._animalPose(a), spr = animalSprite(a.type, a.variant, pose, frame);
    const lift = a.type === 'bird' ? Math.round((a.alt || 0) * S) : (a.state === 'hop' && frame ? 2 : 0);
    const g = (a._geom ||= [null, 0, 0, false]);
    g[0] = spr.cv; g[1] = Math.round(a.x * S) - spr.ax; g[2] = Math.round(a.y * S) - spr.by - lift; g[3] = a.face < 0;
    return g;
  }

  _drawAnimal(ctx, a) {
    const x = Math.round(a.x * S), y = Math.round(a.y * S);
    if (a.type !== 'bird' || !a.alt) { ctx.fillStyle = 'rgba(16,16,40,0.25)'; ctx.fillRect(x - 4, y, 9, 1); }
    else if (a.state !== 'fly') { ctx.fillStyle = 'rgba(16,16,40,0.25)'; ctx.fillRect(x - 3, y - Math.round(a.alt * S) + 1, 7, 1); }
    const [cv, sx, sy, flip] = this._animalGeom(a);
    if (!flip) ctx.drawImage(cv, sx, sy);
    else { ctx.setTransform(-1, 0, 0, 1, sx + cv.width, sy); ctx.drawImage(cv, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
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

    // Tidy up after an earlier mood before doing anything else (in away the screen carries the BACK SOON sign).
    if (m !== 'movie' && m !== 'gaming' && m !== 'away') {
      if (v === rigger && this._screen > 0) {
        return { ...atScreen, action: 'teardown', dur: 3 * this._screen + 0.3, done: () => { this._screen = 0; this._sign = 0; } };
      }
    }
    if (m !== 'away' && v.gear) return { x: door.x, y: door.y, action: 'unpack', dur: 0.8, done: () => { v.gear = false; } };

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
        // The last one out pulls the amphitheater screen down with a BACK SOON sign on it.
        const last = this._villagers.every((o) => o === v || o.guest || o.gone || o.plan?.gone);
        if (last && (this._sign !== 2 || this._screen < 1)) { // (again if someone started rolling it up)
          return { ...atScreen, action: 'setup', dur: 3 * (1 - this._screen) + 0.3, done: () => { this._screen = 1; this._sign = 2; } };
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
      case 'evening': {
        const look = this._eventVisit(v);
        if (look && Math.random() < 0.3) return look;
      }
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
        if (job !== 'cook' && Math.random() < (job === 'child' ? 0.35 : 0.12)) {
          const look = this._eventVisit(v);
          if (look) return look;
        }
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
    if (v.gone) {
      // told to leave before they ever walked on: they never arrive, so retire them here
      if (v.guest && p.gone && v.active) this._retireGuest(v);
      v.plan = p; v.actT = p.dur; return;
    }
    v.plan = p;
    [p.x, p.y] = freeSpot(p.x, p.y);
    v.path = route(v.x, v.y, p.x, p.y);
    [v.tx, v.ty] = v.path.shift();
    v.carry = p.carry || null;
    v.walking = true;
    v.action = 'walk';
  }

  // A guest who has left (or never made it on screen) is free for the next visit.
  _retireGuest(v) {
    v.active = false; v.leaving = false; v.bike = false; v.pulling = false; v.pushing = false; v.leading = false; v.parked = null;
    v.sprites.clear();
  }

  _arrive(v) {
    const p = v.plan;
    v.walking = false;
    if (p.enter) v.inside = true;
    if (p.gone) { v.gone = true; if (v.guest) this._retireGuest(v); }
    if (p.face) v.face = p.face;
    if (p.drop) v.carry = null;
    p.onArrive?.();
    v.action = p.action;
    v.actT = p.dur;
    v.fxT = rand(0, 0.5);
    // the spot was free when the walk began, but something (an event's stall) has gone up there since
    if (!v.inside && !v.gone && !v.rethinkAt && blocked(v.x, v.y)) v.rethinkAt = this._t + 0.2;
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
      if (v.action === 'build') this._buildEvent(dt);
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

    // particles (compacted in place)
    const ps = this._particles;
    let n = 0;
    for (const p of ps) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += 60 * dt;
      if (p.life > 0) ps[n++] = p;
    }
    ps.length = n;

    // sky
    for (const c of this._clouds) {
      c.x += c.v * dt * (this._weather.storm ? 3 : this._weather.wind ? 4 : 1);
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
      // event crews
      case 'trim':
        v.fxT = 0.3;
        this._spawn({ x: hx + v.face * 4, y: v.y - 4, vx: v.face * rand(2, 8), vy: rand(-8, -2), life: 0.7, c: pick(['#3a7a2a', '#5a9a3a', '#7ab84a']), grav: true, layer: 0 });
        break;
      case 'prune':
        v.fxT = 0.4;
        this._spawn({ x: hx + v.face * 3, y: v.y - 15, vx: rand(-4, 4), vy: rand(0, 3), life: 1.4, c: pick(['#5a9a3a', '#e8c040', '#7ab84a']), layer: 0 });
        break;
      case 'chisel':
        v.fxT = 0.45;
        for (let i = 0; i < 2; i++) this._spawn({ x: hx + v.face * 3, y: v.y - 6, vx: rand(-10, 10), vy: rand(-20, -8), life: 0.5, c: pick(['#c8c4b8', '#a8a49a']), grav: true, layer: 0 });
        break;
      case 'paint':
        v.fxT = 0.6;
        this._spawn({ x: hx + v.face * 4, y: v.y - 8, vx: v.face * 3, vy: 2, life: 0.5, c: pick(['#e04848', '#3a8ae0', '#f0c030', '#3aa86a']), layer: 0 });
        break;
      case 'cheer': case 'admire': case 'browse':
        v.fxT = rand(2, 4);
        if (Math.random() < 0.3) this._spawn({ x: v.x, y: v.y - 11, vx: 0, vy: -5, life: 1.4, g: 'heart', c: '#ff6080', layer: 1 });
        break;
      case 'announce': case 'juggle': case 'crank': case 'sell':
        v.fxT = rand(1.5, 3);
        if (v.action === 'announce' && Math.random() < 0.5) this._spawn({ x: v.x + v.face * 3, y: v.y - 11, vx: rand(-2, 2), vy: -6, life: 1.6, g: 'note', c: pick(['#fff4a0', '#ffd0f0']), layer: 1 });
        break;
      case 'toss':
        v.fxT = rand(1.2, 2);
        this._spawn({ x: hx + v.face * 3, y: v.y - 8, vx: v.face * 14, vy: -10, life: 0.6, c: '#f0c030', grav: true, layer: 1 });
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
      this._drops.push({ x: rand(0, W + 20), y: rand(-H, 0), land: rand(HORIZON, H), v: w.snow ? rand(8, 14) : rand(90, 130), snow: w.snow && !(w.rain && Math.random() < 0.5), hail: w.hail, p: rand(0, 6) });
    }
    if (this._drops.length > want) this._drops.length = want;
    for (const d of this._drops) {
      d.p += dt;
      d.y += d.v * dt;
      d.x += (d.snow ? Math.sin(d.p) * 6 : -14) * dt - (w.wind ? 30 * dt : 0);
      if (d.y > d.land) {
        if (!d.snow && this._splashes.length < 30) this._splashes.push({ x: d.x, y: d.land, t: 0.15 });
        d.hail = w.hail;
        d.y = rand(-10, 0); d.x = rand(0, W + 20);
      }
    }
    const sp = this._splashes;
    let n = 0;
    for (const s of sp) if ((s.t -= dt) > 0) sp[n++] = s;
    sp.length = n;
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
    const t = TINT[this._phase];
    if (!this._weather.overcast) return t;
    if (!this._tintOver || this._tintFor !== t) { this._tintFor = t; this._tintOver = t ? mulHex(t, OVERCAST_TINT) : OVERCAST_TINT; }
    return this._tintOver;
  }

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
  }

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
  }

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
  }

  _glow(ctx, x, y, r, rgb, a) {
    r = Math.round(r);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(glowSprite(r, rgb), Math.round(x - r), Math.round(y - r));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

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
  }

  // A landscaped copy of a shrub, per card and season (the shared land props never change).
  _trimmedShrub(i) {
    const key = `shrub${i}|${this._season}`;
    return this._eventArt(key, () => shrubProp(SHRUBS[i], false, this._season, true)).cv;
  }

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
  }

  _seated(i) {
    return this._seats?.get(i);
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
  }

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
  }

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
  }

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

  _projectorGeom() {
    const p = this._art().projector;
    p.l = p.l || flipH(p.cv);
    return (p.geom ||= [p.l, PROJ.x * S - (p.cv.width - 1 - p.ax), PROJ.y * S - p.by, false]);
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
    return getPartyStrings();
  }

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
  }

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
  }

  _drawPartyLights(ctx, dark) {
    const k = Math.floor(this._t * 3);
    for (const { x, y, i } of partyBulbs()) {
      const c = (i / 3 + k) % BULB_RGB.length;
      P(ctx, x, y + 1, 2, 3, BULB_CSS[c]); P(ctx, x, y + 1, 1, 1, '#ffffff');
      if (dark) this._glow(ctx, x + 1, y + 2, 8, BULB_RGB[c], 0.45);
    }
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
  }

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
  }

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
  }

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
  }

  _glyph(ctx, name, x, y, c) {
    ctx.drawImage(glyphSprite(name, c), x - (GLYPHS[name][0].length >> 1), y);
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
    if (v._poseFrame === this._frameNo && v._pose) return v._pose;
    v._poseFrame = this._frameNo;
    return (v._pose = this._computePose(v));
  }

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
    const [, rate, order] = ANIM[pose];
    const step = Math.floor(this._t * rate + v.seed * 10) % order.length;
    return { pose, frame: order[step], step };
  }

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
  }

  _lift(v) {
    const { pose, step } = this._poseOf(v);
    let lift = LIFT[pose] ? LIFT[pose][step % 4] : 0;
    if (pose === 'walk' && this._mode === 'party') lift = step % 3 === 1 ? 2 : 0;
    if (v.jumpT > 0) lift += Math.round(Math.sin((v.jumpT / 0.5) * Math.PI) * 4);
    return lift;
  }

  // [sprite canvas, x, y, mirrored] as drawn this frame, or null before the sprite exists
  _villagerGeom(v) {
    if (v._geomFrame === this._frameNo && v._geom?.[0]) return v._geom;
    const spr = this._spriteOf(v, false);
    if (!spr) return null;
    v._geomFrame = this._frameNo;
    const g = (v._geom ||= [null, 0, 0, false]);
    g[0] = spr.cv; g[1] = Math.round(v.x * S) - AX; g[2] = Math.round(v.y * S) - FY - this._lift(v) * S; g[3] = v.face < 0;
    return g;
  }

  _drawVillager(ctx, v) {
    const spr = this._spriteOf(v, true);
    const x = Math.round(v.x * S), y = Math.round(v.y * S);
    ctx.fillStyle = 'rgba(16,16,40,0.3)';
    ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 7, y, 15, 1);
    const sx = x - AX, sy = y - FY - this._lift(v) * S;
    if (v.face > 0) ctx.drawImage(spr.cv, sx, sy);
    else {
      // mirror at draw time instead of caching a flipped copy of every frame
      ctx.setTransform(-1, 0, 0, 1, sx + SW, sy); ctx.drawImage(spr.cv, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if ((this._t + v.seed * 7) % 4 < 0.15) {
      for (const [x, y] of spr.eyes) {
        const ex = v.face > 0 ? sx + x : sx + SW - 2 - x;
        P(ctx, ex, sy + y, 2, 2, v.look.skin);
        P(ctx, ex, sy + y + 1, 2, 1, skinRamp(v.look.skin).d);
      }
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
    documentationURL: 'https://github.com/frankdeluxe5k/pixel-village-card',
  });
  console.info(`%c PIXEL-VILLAGE-CARD %c v${PV_VERSION} `, 'background:#3f9a50;color:#fff;border-radius:3px 0 0 3px', 'background:#2c3a70;color:#fff;border-radius:0 3px 3px 0');
}

// Where everything is: houses, paths, the square, amphitheater, café, farm, animal spots.
import { S } from '../core/constants.js';
import { rand } from '../core/math.js';

// Houses sit at different depths: `base` is the ground line of each one.
export const HOUSES = [
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
export const PATHS = [
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
export function smoothPath(c, k = 4) {
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
export const ENTRANCE = PATHS[0].pts[0];

export const FIRE = { x: 92, y: 112 };
export const WELL = { x: 145, y: 73 };
export const STUMP = { x: 55, y: 122 }; // the chopping block, with the woodpile stacked to its right (clear of the bench)
// Village square furniture, in render pixels.
export const POND = { x: 392, y: 352, rx: 20, ry: 8 };
export const LAMPS = [[FIRE.x * S - 58, FIRE.y * S - 34], [FIRE.x * S + 64, FIRE.y * S - 37]];
// Benches around the fire: [left x, ground line y, width].
export const BENCHES = [[FIRE.x * S - 18, FIRE.y * S - 20, 36], [FIRE.x * S - 70, FIRE.y * S + 21, 20], [FIRE.x * S + 50, FIRE.y * S + 23, 20]];

// Movie night: a pull-up screen right of the fire, a projector behind the audience.
// The amphitheater on the left: stage with a roll-down screen, curved tiers facing it.
export const SCREEN = { x0: 2, x1: 16, top: 94, base: 115 };
// The screen is a panel turned toward the seats at the lower right: its near edge is on the left
// (lower on screen), its far edge on the right (higher), like a wall seen at 45° (render px).
export const SCREEN_Q = { lx: 4, ltop: 297, lbot: 341, rx: 44 };
// Every slanted edge uses the same clean 2:1 pixel stair (two across, one up).
export const stairY = (x, y0, x0 = SCREEN_Q.lx) => y0 - Math.floor((x - x0) / 2);
SCREEN_Q.rtop = stairY(SCREEN_Q.rx, SCREEN_Q.ltop);
 SCREEN_Q.rbot = stairY(SCREEN_Q.rx, SCREEN_Q.lbot);
export const PROJ = { x: 43, y: 120.5 };
// Tiers wrap around a point in front of the screen and open toward it.
export const AMPHI = { x: 28, y: 340, tiers: [50, 70, 90], squash: 0.42, a0: -12, a1: 68 };
export const AMPHI_SEATS = [[0, 2], [0, 28], [0, 54], [1, -6], [1, 16], [1, 38], [1, 60], [2, 2], [2, 28], [2, 54]].map(([t, a]) => {
  const rx = AMPHI.tiers[t], r = (a * Math.PI) / 180;
  return { x: (AMPHI.x + rx * Math.cos(r)) / S, y: (AMPHI.y + rx * AMPHI.squash * Math.sin(r)) / S, face: -1 };
});
export const GUEST_SEATS = [[0, -10], [0, 15], [0, 41], [1, 5], [1, 27], [1, 49], [2, -10], [2, 15], [2, 41]].map(([t, a]) => {
  const rx = AMPHI.tiers[t], r = (a * Math.PI) / 180;
  return { x: (AMPHI.x + rx * Math.cos(r)) / S, y: (AMPHI.y + rx * AMPHI.squash * Math.sin(r)) / S, face: -1 };
});
export const STAGE_SPOT = { x: 9.5, y: 114 };
// The farm, set back at the back centre (render pixels). It starts right of the blue house so nobody
// working it is hidden behind that roof.
export const FARM = { x0: 192, x1: 268, y0: 198, y1: 226 };
export const farmSpot = () => ({ x: rand(66, 87), y: rand(67, 74) });

// The café: brick patio, bistro tables, a coffee cart (render pixels).
export const PATIO = { x0: 522, x1: 650, y0: 328 };
export const CART = { x: 600, by: 318 };
export const TABLES = [[552, 350, '#d84848'], [604, 348, '#3a8a5a'], [568, 374, '#3a6ac8'], [624, 374, '#e0a030']];
export const STOOLS = [[584, 330], [606, 330]];
// Seats in simulation units: two per table, then the stools at the cart.
export const CAFE_SEATS = [
  ...TABLES.flatMap(([tx, ty]) => [{ x: (tx - 13) / S, y: (ty + 2) / S, face: 1 }, { x: (tx + 13) / S, y: (ty + 2) / S, face: -1 }]),
  ...STOOLS.map(([x, y]) => ({ x: x / S, y: y / S, face: 1, stool: true })),
];
export const BARISTA = { x: (CART.x + 28) / S, y: CART.by / S };

// Away: where visitors stand to read the BACK SOON sign on the amphitheater screen.
export const AWAY_READ = { x: 29, y: 115.2 };
// Where the travelling band plays: up in front of the tavern, above the string lights over the square,
// the drummer a step back in the middle. Same order as INSTRUMENTS.
export const BAND_SPOTS = [{ x: 94.5, y: 84.5, face: 1 }, { x: 86, y: 88.5, face: 1 }, { x: 102, y: 88.5, face: -1 }, { x: 109, y: 88, face: -1 }];

// Seasonal yard spots (sim units), on open grass off the paths: leaf piles in fall, the kids' snowman.
export const LEAF_SPOTS = [[76, 96], [68, 90], [132, 95], [172, 93]];
export const SNOWMAN_AT = { x: 122, y: 88 };

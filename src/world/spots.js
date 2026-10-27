// Where animals may sit, hop and perch.
import { S } from '../core/constants.js';
import { pick, rand } from '../core/math.js';
import { FIRE, HOUSES, POND } from './layout.js';
import { blocked } from './nav.js';

// Lounging spots for the cat, and places for wildlife (simulation units).
export const CAT_SPOTS = [[83.5, 104.5], [74, 120], [110, 121], [188, 117], [70, 84], [130, 84], [60, 102], [204, 110]];
export const RABBIT_ZONES = [[152, 64, 168, 75], [111, 121, 123, 125], [2, 96, 14, 101]]; // the middle one sits in front of the east bench
export const TREE_BASES = [[40, 72], [134, 70], [160, 70], [88, 64], [221, 106]];
// Where birds may land. Ground spots are in the open village; roof spots sit on a ridge and are drawn
// just in front of that house (y is the house's ground line, alt lifts the bird up to the ridge).
export function birdSpot() {
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

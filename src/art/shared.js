// Render caches shared by every card on the page.
import { buildLandSteps } from './land.js';
import { AMPHI_LANTERNS } from './venues.js';
import { HZ, RW, S } from '../core/constants.js';
import { lerp } from '../core/math.js';
import { mk } from '../core/pixels.js';
import { CART, HOUSES, LAMPS, TABLES } from '../world/layout.js';

// Land layers (terrain + props + sky mask) and houses are shared by every card on the page, keyed by
// snow/season, and both snow states stay cached so weather flips don't rebuild them.
export const landCache = new Map(), landJobs = new Map();
// Returns the land for these conditions, or null while it's still being built (a few ms per call).
export function sharedLand(snow, season, budget = Infinity) {
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
export const sharedArt = { houses: {}, stages: {} };

// The party's light strings (lamp to lamp, lamps to the tavern) never move.
export let partyStrings = null;
export function getPartyStrings() {
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

export const BULB_RGB = ['255,80,80', '255,210,60', '80,230,110', '80,160,255', '255,110,210'];
export const BULB_CSS = BULB_RGB.map((c) => `rgb(${c})`);
// Every place a light can be, lit or not (for working out once which props could stand in front of one).
export let allLights = null;
export function allLightRects() {
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
export let partyBulbList = null;
export function partyBulbs() {
  if (partyBulbList) return partyBulbList;
  const [l0, l1] = LAMPS, tb = HOUSES[2].base, ends = [[l0[1] / S, l1[1] / S], [l0[1] / S, tb], [tb, l1[1] / S]];
  partyBulbList = [];
  getPartyStrings().forEach((pts, si) => pts.forEach(([x, y], i) => {
    if (!(i % 3)) partyBulbList.push({ x, y, i, base: lerp(ends[si][0], ends[si][1], i / (pts.length - 1)) });
  }));
  return partyBulbList;
}

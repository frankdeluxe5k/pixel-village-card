// The ground layer and its depth-sorted props, built a few ms per frame.
import { paintBackdrop } from './backdrop.js';
import { SHRUBS, makeTree, shrubProp } from './foliage.js';
import { drawBench, drawHaystack, drawLamp, drawWell, drawWoodpile } from './props.js';
import { drawAmphitheater, drawBackFarm, drawBackFence, drawCoffeeCart, drawMenuBoard, drawPatio, drawScarecrow, drawStool } from './venues.js';
import { byLook, hexToRgb } from '../core/color.js';
import { HZ, RH, RW, S } from '../core/constants.js';
import { mulberry32, pick, rand } from '../core/math.js';
import { bayer, hash2, vnoise } from '../core/noise.js';
import { P, ellipse, line, mk, outline, tpl } from '../core/pixels.js';
import { AMPHI, CART, FARM, FIRE, HOUSES, LAMPS, PATHS, PATIO, POND, STOOLS, STUMP, TABLES, WELL } from '../world/layout.js';
import { lookOf } from '../core/time.js';

// The whole land layer at once (tests, tools). The card builds it in steps across frames instead.
export function buildLand(snow, look = 'summer') {
  const it = buildLandSteps(snow, look);
  let r;
  while (!(r = it.next()).done);
  return r.value;
}

// Builds the land layer, yielding between stages so a slow device never freezes for long.
export function* buildLandSteps(snow, look = 'summer') {
  const L = lookOf(look), season = L.season;
  const c = mk(RW, RH), g = c.getContext('2d');
  const im = g.createImageData(RW, RH), d = im.data;
  const kind = new Uint8Array(RW * RH);
  const set = (x, y, col) => { const i = (y * RW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  const C = (arr) => arr.map(hexToRgb);

  yield* paintBackdrop(set, snow, L.key);

  // ground: grass, cobbled street, flagstone square, pond and farm soil
  const pale = (arr) => (snow ? arr.map((c) => c.map((v) => v + (255 - v) * 0.3)) : arr);
  // Grass: greening up through spring, lush in summer, golden in fall, dry and tawny in a snowless winter
  const grass = C(snow ? ['#bccbe0', '#d4e0ee', '#e8f0f8', '#ffffff'] : byLook(L, {
    'spring-early': ['#5a6e38', '#708440', '#889a4c', '#a2ae5c'], 'spring-late': ['#448a34', '#58a440', '#70bc4c', '#8cd05e'],
    'fall-early': ['#56783a', '#709040', '#8ea64c', '#acb85e'], 'fall-late': ['#6a6c3c', '#868446', '#a29a56', '#bcb06a'],
    winter: ['#6a6a44', '#84804e', '#9e9460', '#b8aa74'],
  }, ['#468434', '#5a9e40', '#70b44c', '#88c85c']));
  const frozen = snow || season === 'winter'; // the pond ices over by midwinter
  const dirt = C(snow ? ['#9a948e', '#b4aea6', '#ccc6be', '#e0dcd6'] : ['#86603c', '#a87e50', '#c49a64', '#d8b47c']);
  const soil = C(snow ? ['#8a8490', '#a8a2ac', '#c4c0c8', '#e4e4ec'] : ['#4e3020', '#6a4228', '#845634', '#9a6a42']);
  const water = C(snow ? ['#9ab8d0', '#b8d0e4', '#d4e6f4', '#ffffff'] : frozen ? ['#6a8ca8', '#86a6be', '#a8c2d6', '#d8e6f0'] : ['#24527e', '#2f6a9e', '#4a8cc4', '#9ad4f4']);
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
  const hexG = snow ? ['#b8c8dc', '#ffffff'] : byLook(L, { winter: ['#5a5a3a', '#c8b884'], 'fall-late': ['#5a5a32', '#c8b878'], fall: ['#4a6a2e', '#c0c470'], 'spring-early': ['#4a6230', '#a8b46a'] }, ['#3a7a2c', '#9ad86a']);

  // tufts, wildflower patches, mushrooms, pebbles
  const R2 = mulberry32(9);
  for (let i = 0; i < 360; i++) {
    const x = Math.floor(R2() * (RW - 6)), y = HZ + 4 + Math.floor(R2() * (RH - HZ - 8));
    if (K(x, y) !== 2 || K(x + 4, y) !== 2 || K(x, y + 3) !== 2) continue;
    tpl(g, ['.l..l', 'lml.l', 'mmlml'], x, y, { l: hexG[1], m: hexG[0] });
  }
  if (!snow && L.bloom) {
    // pasque flowers as the snow melts; columbine, paintbrush and lupine in late spring; a summer mix; asters in fall
    const flowerCols = byLook(L, {
      'spring-early': ['#b890e8', '#9a70d0', '#d0b0f0'], 'spring-late': ['#7a90f0', '#e84a3a', '#9060d8', '#ffffff', '#f8e060', '#f05a6a'],
      fall: ['#a080e0', '#c8a0f0', '#f8e060'],
    }, ['#f05a6a', '#f8e060', '#ffffff', '#c890f8', '#f8a040']);
    const R5 = mulberry32(19);
    for (let p = 0; p < [0, 7, 14, 24][L.bloom]; p++) {
      const px = 10 + R5() * (RW - 20), py = HZ + 10 + R5() * (RH - HZ - 14), col = flowerCols[Math.floor(R5() * flowerCols.length)];
      for (let i = 0; i < (L.bloom === 3 ? 9 : 7); i++) {
        const x = Math.round(px + (R5() - 0.5) * 18), y = Math.round(py + (R5() - 0.5) * 8);
        if (K(x, y) !== 2 || K(x, y + 3) !== 2) continue;
        P(g, x, y + 2, 1, 2, hexG[0]);
        if (L.melt) { P(g, x - 1, y, 1, 2, col); P(g, x + 1, y, 1, 2, col); P(g, x, y, 1, 1, '#f8d030'); continue; } // low cups
        P(g, x - 1, y, 3, 1, col); P(g, x, y - 1, 1, 3, col); P(g, x, y, 1, 1, '#f8d030');
      }
    }
  }
  if (!snow && (L.key === 'summer' || L.key === 'fall-early')) {
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(R2() * RW), y = HZ + 8 + Math.floor(R2() * (RH - HZ - 10));
      if (K(x, y) !== 2 || K(x + 4, y + 3) !== 2) continue;
      P(g, x + 1, y + 2, 2, 2, '#f0e8d8'); P(g, x, y, 4, 2, '#d83a2a'); P(g, x + 1, y - 1, 2, 1, '#d83a2a'); P(g, x + 1, y, 1, 1, '#ffffff');
    }
  }
  if (!snow && L.leaves) {
    // fallen leaves: thick under the aspens and oaks, blown a little east, drifted along the path edges
    const R4 = mulberry32(41), gold = ['#f4c838', '#d8a020', '#e8b830', '#a86a14'], rust = ['#c0501c', '#a8481c', '#8a3a18', '#d0702a'];
    const brown = L.leaves > 1 ? ['#8a6a3a', '#a07a40', '#6e5430', '#b89050'] : gold;
    const onGround = (x, y) => { const k = K(x, y); return k === 2 || k === 3 || k === 5 || k === 6; };
    const drop = (cx, cy, rx, ry, n, cols) => {
      for (let i = 0; i < n; i++) {
        const a = R4() * Math.PI * 2, d = Math.sqrt(R4()), x = Math.round(cx + Math.cos(a) * d * rx), y = Math.round(cy + Math.sin(a) * d * ry);
        if (x < 0 || x >= RW - 1 || y < HZ + 2 || y >= RH || !onGround(x, y)) continue;
        P(g, x, y, R4() < 0.35 ? 2 : 1, 1, cols[Math.floor(R4() * cols.length)]);
      }
    };
    for (const [x, y] of [[160, 70], [88, 64], [197, 71]]) drop(x * S + 10, y * S + 3, 42, 11, 150 * L.leaves, gold);
    for (const [kind, bx, by, br] of SHRUBS) if (kind === 'gambel' || kind === 'rose') drop(bx + 4, by + 2, br * 4, 6, 45 * L.leaves, rust);
    // drifts: patchy, thicker in late fall, gathered along path edges
    const thr = L.leaves > 1 ? 0.5 : 0.62, all = [...gold, ...rust, ...brown];
    yield;
    for (let y = HZ + 3; y < RH; y++) {
      if ((y - HZ) % 50 === 0) yield; // a few slices, so a slow tablet never stalls
      for (let x = 0; x < RW - 1; x++) {
        if (K(x, y) !== 2) continue;
        const edge = K(x, y + 2) === 3 || K(x, y - 2) === 3 || K(x + 2, y) === 3 || K(x - 2, y) === 3 || K(x, y + 2) === 5 || K(x, y - 2) === 5;
        const p = (vnoise(x * 0.035, y * 0.09, 77) - thr) * 0.6 + (edge ? 0.12 * L.leaves : 0);
        if (hash2(x, y, 78) < p) P(g, x, y, 1, 1, all[Math.floor(hash2(y, x, 79) * all.length)]);
      }
    }
  }
  if (!snow && L.melt) {
    // early spring: old snow lingering in shady spots, puddles of meltwater on the dirt paths
    const R6 = mulberry32(53);
    const patch = (cx, cy, rx, ry) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x / rx) ** 2 + (y / ry) ** 2 + (hash2(cx + x, cy + y, 54) - 0.5) * 0.5;
        if (d > 1 || !onGrass(cx + x, cy + y)) continue;
        P(g, cx + x, cy + y, 1, 1, d > 0.75 ? '#b8c4d4' : y < 0 ? '#f0f4fa' : '#d8e0ec');
      }
    };
    const onGrass = (x, y) => K(x, y) === 2;
    for (const h of HOUSES) patch(Math.round(h.x * S + (R6() - 0.5) * 30), Math.round(h.base * S - 4), 10 + Math.floor(R6() * 6), 2);
    for (let i = 0; i < 6; i++) patch(Math.floor(R6() * RW), HZ + 3 + Math.floor(R6() * 8), 8 + Math.floor(R6() * 8), 2);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(R6() * (RW - 8)), y = HZ + 6 + Math.floor(R6() * (RH - HZ - 8));
      if (K(x, y) !== 3 || K(x + 6, y) !== 3 || K(x, y + 2) !== 3) continue;
      ellipse(g, x + 3, y + 1, 3, 1, '#5a4a3a'); P(g, x + 1, y, 3, 1, '#8aa4bc'); P(g, x + 2, y + 1, 2, 1, '#6a84a0');
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(R2() * (RW - 4)), y = HZ + Math.floor(R2() * (RH - HZ - 3));
    if (K(x, y) !== 3 || K(x + 3, y + 2) !== 3) continue;
    P(g, x, y, 3, 2, '#8a8478'); P(g, x, y, 2, 1, '#c8c0b0'); P(g, x + 1, y + 2, 3, 1, '#5a5040');
  }

  // pond: lily pads from late spring to early fall, cattails, shore rocks; frozen in winter
  if (frozen) {
    for (let i = 0; i < 5; i++) P(g, POND.x - 14 + i * 6, POND.y - 3 + (i % 3) * 2, 5, 1, snow ? '#ffffff' : '#eef4fa');
    if (!snow) for (const [lx, ly, n] of [[-12, 1, 7], [2, -2, 5], [6, 3, 6]]) line(g, POND.x + lx, POND.y + ly, POND.x + lx + n, POND.y + ly - 1, '#5a7c98', 1); // cracks
  } else if (L.key === 'spring-late' || L.key === 'summer' || L.key === 'fall-early') {
    for (const [lx, ly, fl] of [[-10, -1, true], [-3, 3, false], [8, -2, false], [12, 2, true]]) {
      ellipse(g, POND.x + lx, POND.y + ly, 3, 1, '#3a9a3a'); P(g, POND.x + lx - 2, POND.y + ly - 1, 2, 1, '#6aca5a'); P(g, POND.x + lx + 1, POND.y + ly, 2, 1, '#2a6a2a');
      if (fl && L.key !== 'fall-early') { P(g, POND.x + lx, POND.y + ly - 2, 2, 2, '#f8a0c0'); P(g, POND.x + lx, POND.y + ly - 2, 1, 1, '#ffffff'); }
    }
  }
  for (const [rx, h] of [[-22, 10], [-20, 7], [-18, 12], [19, 9], [21, 13], [23, 8]]) {
    const x = POND.x + rx, y = POND.y + 2;
    const reed = snow ? '#8a9a8a' : L.key === 'spring-late' || L.key === 'summer' ? '#4a8a30' : L.key === 'fall-early' ? '#7a8a3a' : '#a08a5a';
    P(g, x, y - h, 1, h, reed);
    if (h > 9) { P(g, x, y - h - 1, 2, 4, snow ? '#e0e8f0' : L.melt ? '#c8b8a0' : '#6a4020'); P(g, x, y - h + 3, 1, 2, reed); }
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
      tpl(g, ['g..g.g', '.gGgG.', 'gGGGGg'], x - 3, y - 3, { g: hexG[0], G: season === 'winter' || L.leaves > 1 ? '#8a7a50' : L.melt ? '#7a8a48' : '#5aa840' });
      if (!L.bloom) continue;
      const col = ['#f05a7a', '#f8e060', '#c890f8', '#ffffff'][Math.floor(R3() * 4)];
      if (R3() < 0.7) { P(g, x - 1, y - 5, 1, 1, col); P(g, x + 2, y - 4, 1, 1, col); P(g, x, y - 6, 1, 1, '#f8d030'); }
    }
  }

  if (season !== 'winter' || snow) drawBackFarm(g, snow, L.key);

  yield;
  // Trees and props are separate sprites, sorted by depth with everything that moves.
  const props = [];
  const prop = (bx, by, bw, bh, sortY, fn) => {
    const pc = mk(bw, bh), pg = pc.getContext('2d');
    pg.translate(-bx, -by); fn(pg); outline(pc);
    props.push({ cv: pc, x: bx, y: by, sortY });
  };
  const tree = (kind, x, y, r, seed) => {
    const t = makeTree(kind, r, seed, snow, L.key), X = x * S, Y = y * S;
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
    const pr = shrubProp(sh, snow, L.key, false);
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

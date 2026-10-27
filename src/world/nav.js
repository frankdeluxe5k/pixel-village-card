// Walking: footprints, the path graph, event blocks and route finding.
import { HORIZON, S, W } from '../core/constants.js';
import { BENCHES, FIRE, HOUSES, PATHS, WELL } from './layout.js';

// Ground footprints villagers shouldn't walk through, and a path network along the road.
export const FOOTPRINTS = [
  ...HOUSES.map((h) => [h.x - 1, h.base - 8, h.x + h.w + 1, h.base + 0.5]),
  [WELL.x - 6, WELL.y - 5, WELL.x + 6, WELL.y + 0.5],
  [FIRE.x - 7, FIRE.y - 2, FIRE.x + 7, FIRE.y + 4], // the stone ring of the fire pit (the cook stands at its west edge)
  ...BENCHES.map(([x, by, w]) => [x / S - 0.7, by / S - 1.5, (x + w) / S + 0.7, by / S + 0.6]),
];
export const NAV = (() => {
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
  // the square is a hub: path ends that reach it connect across it, through the gap between the back bench and the fire
  [[FIRE.x - 9, FIRE.y - 4.6], [FIRE.x + 8.5, FIRE.y - 4.8]].forEach((pt, k) => { nodes.push(pt); adj.push([]); owner.push(-1 - k); });
  const onSquare = nodes.map((n, i) => i).filter((i) => ((nodes[i][0] - FIRE.x) / 26) ** 2 + ((nodes[i][1] - FIRE.y) / 12) ** 2 < 1);
  for (const i of onSquare) for (const j of onSquare) {
    if (i >= j || owner[i] === owner[j] || adj[i].includes(j)) continue;
    if (FOOTPRINTS.some((r) => segHits(...nodes[i], ...nodes[j], r))) continue; // not across the fire or a bench
    adj[i].push(j); adj[j].push(i);
  }
  return { nodes, adj };
})();
// Temporary footprints of event props (carts, stalls, sculptures), per card; every card's count, like FOOTPRINTS.
// `eventRects` is the flat list `blocked()` reads; refresh it with `setEventBlocks` whenever the map changes.
export const EVENT_BLOCKS = new Map();
export let eventRects = [];
export function setEventBlocks(card, list) {
  if (list) EVENT_BLOCKS.set(card, list); else EVENT_BLOCKS.delete(card);
  eventRects = [...EVENT_BLOCKS.values()].flat();
  eventCorners = cornersOf(eventRects);
}
export const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
export const blocked = (x, y) => {
  for (const r of FOOTPRINTS) if (inRect(x, y, r)) return true;
  for (const r of eventRects) if (inRect(x, y, r)) return true;
  return false;
};
// Does the segment pass through the inside of rect r? (exact, so a path can't clip a corner between samples)
export function segHits(x0, y0, x1, y1, r) {
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
export function clearPath(x0, y0, x1, y1) {
  for (const r of FOOTPRINTS) if (segHits(x0, y0, x1, y1, r)) return false;
  for (const r of eventRects) if (segHits(x0, y0, x1, y1, r)) return false;
  return true;
}
export function freeSpot(x, y) {
  for (let k = 0; k < 12 && blocked(x, y); k++) y += 1;
  return [x, y];
}
// Just outside each footprint's corners: detours for spots no path node can see (behind a house, the well,
// right in front of a parked cart). Event props' corners are added while they stand.
export const cornersOf = (rects) => rects.flatMap(([x0, y0, x1, y1]) => [[x0 - 1.5, y0 - 1], [x1 + 1.5, y0 - 1], [x0 - 1.5, y1 + 1], [x1 + 1.5, y1 + 1]])
  .filter(([x, y]) => y > HORIZON + 3 && x > 1 && x < W - 1 && !FOOTPRINTS.some((r) => inRect(x, y, r)));
export const CORNERS = cornersOf(FOOTPRINTS);
export let eventCorners = [];

export function route(x0, y0, x1, y1) {
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

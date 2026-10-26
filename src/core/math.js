// Small number helpers and the seeded random generator.

export const lerp = (a, b, u) => a + (b - a) * u;

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One item from [[item, weight], …], drawn with `rnd` (a 0..1 generator, Math.random by default).
export function pickWeighted(list, rnd = Math.random) {
  let total = 0;
  for (const [, w] of list) total += w;
  let r = rnd() * total;
  for (const [item, w] of list) if ((r -= w) < 0) return item;
  return list[list.length - 1][0];
}

export const towardX = (x, cx) => (x < cx ? 1 : -1);

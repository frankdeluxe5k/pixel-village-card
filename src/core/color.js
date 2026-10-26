// Colour maths: hex/RGB/HSL, hue-shifted ramps, skin ramps.
import { clamp01 } from './math.js';

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl([r, g, b]) {
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

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function toward(h, target, amt) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amt);
}

export function shiftColor(hex, dl, hueTarget, hueAmt, ds = 0) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return hslToHex(toward(h, hueTarget, hueAmt), s + ds, l + dl);
}

// Retro-style colour ramp: shadows drift toward blue/purple, highlights toward yellow.
export const rampCache = new Map();
export function ramp(hex) {
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

export function mixHex(a, b, u) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(...A.map((v, i) => v + (B[i] - v) * u));
}
export const mulHex = (a, b) => { const B = hexToRgb(b); return rgbToHex(...hexToRgb(a).map((v, i) => (v * B[i]) / 255)); };
export const divHex = (a, b) => { const B = hexToRgb(b); return rgbToHex(...hexToRgb(a).map((v, i) => (v * 255) / Math.max(B[i], 1))); };

// Skin gets its own gentle ramp: the general hue-shifted ramp pushes light skin into orange and red.
export const skinCache = new Map();
export function skinRamp(hex) {
  let r = skinCache.get(hex);
  if (!r) skinCache.set(hex, (r = { o: mixHex(hex, '#3a1a1e', 0.55), d: mixHex(hex, '#7a3a34', 0.28), m: hex, l: mixHex(hex, '#fff2e0', 0.3), h: mixHex(hex, '#ffffff', 0.55) }));
  return r;
}
export const C2 = (arr) => arr.map(hexToRgb);

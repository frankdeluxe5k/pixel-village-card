// Canvas pixel helpers: rectangles, lines, polygons, char templates, outlines.
import { hexToRgb } from './color.js';
import { OUT } from './constants.js';

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function P(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

export function line(g, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  g.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    g.fillRect(x - (t >> 1), y - (t >> 1), t, t);
  }
}

export function ellipse(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

export function fillPoly(g, pts, c) {
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

export function tpl(g, rows, x, y, map) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = map[row[c]];
      if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
    }
  }
}

// Selective outline: every empty pixel touching the sprite becomes the outline colour.
export function outline(cv, color = OUT) {
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

export function flipH(cv) {
  const c = mk(cv.width, cv.height), g = c.getContext('2d');
  g.translate(cv.width, 0);
  g.scale(-1, 1);
  g.drawImage(cv, 0, 0);
  return c;
}

export function disc(g, cx, cy, r, c) {
  ellipse(g, cx, cy, r, r, c);
}

// The painted part of a sprite canvas, [left, top, right, bottom): outline() notes it while it has the
// pixels; anything drawn without an outline counts as the whole canvas (no readback just for this).
export function opaqueBox(cv) {
  return (cv._box ||= [0, 0, cv.width, cv.height]);
}

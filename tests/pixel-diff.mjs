// Pixel-for-pixel regression bench: renders the same scenarios with a baseline build of the card and with
// the current dist/companion-village-card.js, and reports any frame that differs.
//
//   npm run build && node tests/pixel-diff.mjs [--base <git ref>] [--only <name substring>] [--out <dir>]
//
// The baseline is the single-file card at a git ref (default: the last single-file commit). Each scenario
// runs in a fresh page with Math.random seeded, performance.now and Date faked, and steps _update/_render
// directly (no animation loop), so both builds see exactly the same inputs.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', '0062655:companion-village-card.js');
const ONLY = arg('--only', '');
const OUT = arg('--out', '');
const TAG = 'companion-village-card';

const baseJs = execSync(`git show ${BASE}`, { maxBuffer: 1 << 26 }).toString();
const curJs = readFileSync(process.env.CUR || 'dist/companion-village-card.js', 'utf8');

// ---- scenarios ----
const scenarios = [];
const add = (name, s) => scenarios.push({ name, frames: 450, shots: [40, 200, 450], date: [2026, 5, 15], ...s });
const MOODS = [['sleep', 2], ['morning', 7], ['work', 10], ['meal', 12.5], ['evening', 20], ['party', 21.5],
  ['movie', 21], ['gaming', 20], ['cozy', 19], ['away', 14], ['auto', 6.8], ['auto', 18.6]];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const WEATHER = ['sunny', 'rainy', 'snowy', 'fog', 'lightning-rainy', 'windy', 'partlycloudy', 'cloudy', 'pouring', 'hail', 'clear-night', 'exceptional'];
MOODS.forEach(([mode, hour], i) => add(`mood-${mode}-${hour}`, { mode, hour, season: SEASONS[i % 4], weather: WEATHER[i % WEATHER.length] }));
SEASONS.forEach((season) => ['sunny', 'snowy', 'rainy', 'fog'].forEach((weather) => add(`work-${season}-${weather}`, { mode: 'work', hour: 10.5, season, weather })));
for (const [event, hour] of [['merchant', 11], ['salesman', 11], ['artists', 11], ['landscapers', 11], ['fair', 16], ['fair', 19.8]]) {
  add(`event-${event}-${hour}`, { mode: 'auto', hour, season: 'summer', weather: 'sunny', event, frames: 900, shots: [40, 300, 600, 900] });
}
add('party-night-winter-snow', { mode: 'party', hour: 23, season: 'winter', weather: 'snowy' });
add('movie-to-auto', { mode: 'movie', then: 'auto', hour: 20.5, season: 'fall', weather: 'clear-night', frames: 700, shots: [200, 450, 700] });
add('away-to-auto', { mode: 'away', then: 'auto', hour: 11, season: 'spring', weather: 'sunny', frames: 900, shots: [300, 600, 900] });
add('one-villager', { mode: 'work', hour: 9, season: 'summer', weather: 'sunny', config: { villagers: 1 } });
add('ten-villagers', { mode: 'party', hour: 21, season: 'summer', weather: 'sunny', config: { villagers: 10 } });
add('no-guests-animals', { mode: 'work', hour: 15, season: 'fall', weather: 'partlycloudy', config: { visitors: false, animals: false } });
add('dusk-real-date', { mode: 'evening', hour: 19.2, weather: 'sunny', date: [2026, 9, 31] });
add('south-hemisphere', { mode: 'work', hour: 10, weather: 'sunny', date: [2026, 6, 4], latitude: -33 });
add('schedule-events-daily', { mode: 'auto', weather: 'sunny', date: [2026, 3, 8], frames: 600, shots: [300, 600] });

// ---- page side ----
function fakes([seed, T]) {
  let s = seed;
  Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let pn = 0; performance.now = () => (pn += 0.25);
  const RD = Date;
  class FD extends RD { constructor(...a) { super(...(a.length ? a : [T + pn])); } static now() { return T + pn; } }
  window.Date = FD;
}

function run([tag, sc]) {
  const card = document.createElement(tag);
  if (sc.hour !== undefined) card.previewHour = sc.hour;
  if (sc.season) card.previewSeason = sc.season;
  if (sc.weather) card.previewWeather = sc.weather;
  if (sc.event) card.previewEvent = sc.event;
  card.setConfig({ villagers: 6, mode_entity: 'input_select.m', ...(sc.config || {}) });
  card._running = true; // so event blocks register, as they would on screen (no loop is started)
  const hass = (mode) => ({ states: { 'input_select.m': { state: mode, attributes: {} } }, config: sc.latitude ? { latitude: sc.latitude } : {} });
  card.hass = hass(sc.mode);
  const dt = 1 / 15, out = [];
  const hash = () => {
    const d = new Uint32Array(card._ctx.getImageData(0, 0, card._canvas.width, card._canvas.height).data.buffer);
    let h = 0x811c9dc5;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
    return (h >>> 0).toString(16);
  };
  for (let f = 1; f <= sc.frames; f++) {
    if (sc.then && f === Math.round(sc.frames / 2)) card.hass = hass(sc.then);
    card._t += dt;
    if (card._t - (card._modeCheck || 0) > 1) {
      card._modeCheck = card._t;
      card._updateMode();
      if (card._hass) card._spawnGuests();
    }
    card._update(dt);
    const shot = sc.shots.includes(f);
    if (f <= 60 || f % 5 === 0 || shot) card._render();
    if (shot) out.push({ f, hash: hash(), png: window.__png ? card._canvas.toDataURL() : null, status: card._statusText });
  }
  return out;
}

const browser = await chromium.launch();
async function render(js, sc, png) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('http://bench.local/**', (r) => r.request().url().endsWith('.js')
    ? r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: js })
    : r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><body><script>window.__png=${png}</script><script src="card.js"></script></body>` }));
  const [y, m, d] = sc.date;
  await page.addInitScript(fakes, [1234567, new Date(y, m, d, 12, 0).getTime()]);
  await page.goto('http://bench.local/');
  let res;
  try { res = await page.evaluate(run, [TAG, sc]); } catch (e) { errors.push(String(e)); res = []; }
  await page.close();
  return { res, errors };
}

// Differing pixels in red over a dimmed copy of the baseline, plus a count and bounding box.
async function diffImage(a, b) {
  const page = await browser.newPage();
  const r = await page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]), w = ia.width, h = ia.height;
    const px = (img) => { const c = new OffscreenCanvas(w, h).getContext('2d'); c.drawImage(img, 0, 0); return c.getImageData(0, 0, w, h); };
    const da = px(ia), db = px(ib).data, d = da.data;
    let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < d.length; i += 4) {
      const same = d[i] === db[i] && d[i + 1] === db[i + 1] && d[i + 2] === db[i + 2];
      if (same) { d[i] >>= 2; d[i + 1] >>= 2; d[i + 2] >>= 2; continue; }
      n++; const x = (i / 4) % w, y = Math.floor(i / 4 / w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      d[i] = 255; d[i + 1] = 0; d[i + 2] = 0;
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(da, 0, 0);
    return { png: c.toDataURL(), n, box: n ? `${x0},${y0}-${x1},${y1}` : '-' };
  }, [a, b]);
  await page.close();
  return r;
}

const list = scenarios.filter((s) => s.name.includes(ONLY));
let bad = 0;
const t0 = Date.now();
const queue = [...list];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let sc; (sc = queue.shift());) {
    const [a, b] = await Promise.all([render(baseJs, sc, false), render(curJs, sc, false)]);
    const errs = [...a.errors.map((e) => `base: ${e}`), ...b.errors.map((e) => `current: ${e}`)];
    const diff = a.res.map((r, i) => (r.hash !== b.res[i]?.hash || r.status !== b.res[i]?.status ? r.f : null)).filter((f) => f !== null);
    const ok = !errs.length && !diff.length && a.res.length === sc.shots.length;
    if (!ok) bad++;
    console.log(`${ok ? 'same' : 'DIFF'}  ${sc.name}${diff.length ? `  frames ${diff.join(', ')}` : ''}${errs.length ? `\n      ${errs.join('\n      ')}` : ''}`);
    if (!ok && OUT) {
      mkdirSync(OUT, { recursive: true });
      const [pa, pb] = await Promise.all([render(baseJs, sc, true), render(curJs, sc, true)]);
      for (const [i, r] of pa.res.entries()) {
        const q = pb.res[i];
        if (!r.png || !q?.png) continue;
        const { png, n, box } = await diffImage(r.png, q.png);
        console.log(`      frame ${r.f}: ${n} px differ, box ${box}${r.status !== q.status ? `, status "${r.status}" vs "${q.status}"` : ''}`);
        writeFileSync(`${OUT}/${sc.name}-${r.f}-base.png`, Buffer.from(r.png.split(',')[1], 'base64'));
        writeFileSync(`${OUT}/${sc.name}-${r.f}-current.png`, Buffer.from(q.png.split(',')[1], 'base64'));
        writeFileSync(`${OUT}/${sc.name}-${r.f}-diff.png`, Buffer.from(png.split(',')[1], 'base64'));
      }
    }
  }
}));
await browser.close();
console.log(`\n${list.length - bad}/${list.length} scenarios identical (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(bad ? 1 : 0);

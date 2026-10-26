// Compares the building blocks of the card with a baseline single-file build: routes, event schedules,
// reactions, suggestions, config errors, every sprite pose and the editor's DOM. Complements pixel-diff.mjs,
// which only drives whole scenes.
//
//   npm run build:dev && node tests/logic-diff.mjs [--base <git ref>]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', '0062655:companion-village-card.js');
const baseJs = execSync(`git show ${BASE}`, { maxBuffer: 1 << 26 }).toString();
const devJs = readFileSync('dist/companion-village-card.dev.js', 'utf8');

const NAMES = ['route', 'freeSpot', 'blocked', 'eventsForDay', 'evalReactions', 'suggestReactions', 'validateConfig', 'reactionKind',
  'buildVillager', 'animalSprite', 'makeTree', 'drawShrub', 'mk', 'ANIM', 'EVENTS', 'seasonOf', 'scheduleMode', 'readWeather', 'birdSpot', 'W', 'H', 'HORIZON'];

// Runs in the page with L = the card's internals; returns plain data to compare.
async function probe(L) {
  let s = 99;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = rnd;
  const out = {};
  const hashCv = (x) => {
    const cv = x.getContext ? x : x.cv || x.canvas || x[0];
    const d = new Uint32Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer);
    let h = 0x811c9dc5;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
    return `${cv.width}x${cv.height}:${(h >>> 0).toString(16)}`;
  };
  const r = (a, b) => a + rnd() * (b - a);
  out.routes = Array.from({ length: 3000 }, () => L.route(r(-10, L.W + 10), r(L.HORIZON, L.H), r(-10, L.W + 10), r(L.HORIZON, L.H)).map((p) => p.map((v) => +v.toFixed(6))));
  out.free = Array.from({ length: 2000 }, () => L.freeSpot(r(0, L.W), r(L.HORIZON, L.H)));
  out.blocked = Array.from({ length: 4000 }, () => L.blocked(r(0, L.W), r(L.HORIZON, L.H)));
  out.birds = Array.from({ length: 200 }, () => L.birdSpot());
  out.events = [];
  for (const freq of ['rare', 'daily', 'often']) for (const seed of [1, 42, 777]) for (let d = 0; d < 400; d += 3) {
    const dt = new Date(2026, 0, 1 + d), key = dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
    out.events.push(L.eventsForDay(key, seed, freq));
  }
  out.seasons = Array.from({ length: 366 }, (_, d) => [L.seasonOf(new Date(2026, 0, 1 + d)), L.seasonOf(new Date(2026, 0, 1 + d), true)]);
  out.sched = Array.from({ length: 96 }, (_, i) => L.scheduleMode(i / 4, { wake: 6.5, work: 8.5, lunch: 12, work_after_lunch: 13, dinner: 18, evening: 19.5, sleep: 22.5 }));
  out.weather = ['sunny', 'clear-night', 'partlycloudy', 'cloudy', 'windy', 'windy-variant', 'fog', 'rainy', 'pouring', 'lightning', 'lightning-rainy', 'hail', 'snowy', 'snowy-rainy', 'exceptional', '', 'unknown'].map(L.readWeather);
  const now = Date.parse('2026-10-26T12:00:00Z');
  const st = (state, extra = {}) => ({ state, attributes: {}, last_changed: '2026-10-26T11:30:00Z', ...extra });
  const states = {
    'scene.movie_night': st('2026-10-26T11:50:00Z'), 'scene.good_morning': st('2026-10-26T10:00:00Z'), 'scene.never': st('unknown'),
    'script.goodnight': st('off', { attributes: { last_triggered: '2026-10-26T11:40:00Z' } }), 'media_player.tv': st('playing'),
    'alarm_control_panel.home': st('armed_away'), 'zone.home': st('0'), 'input_boolean.party': st('on'), 'sensor.temp': st('21.5'),
    'light.lounge': st('on', { attributes: { brightness: 80 } }), 'person.frank': st('not_home'), 'switch.console': st('unavailable'),
    'button.market': st('2026-10-26T11:55:00Z'), 'script.gaming_time': st('off'), 'input_select.mood': st('party'),
  };
  const lists = [
    [{ entity: 'scene.movie_night', mode: 'movie' }, { entity: 'scene.good_morning', mode: 'auto' }],
    [{ entity: 'scene.never', mode: 'party' }, { entity: 'media_player.tv', mode: 'movie', when: 'state', state: ['playing', 'paused'] }],
    [{ entity: 'sensor.temp', mode: 'cozy', when: 'numeric', below: 22 }, { entity: 'light.lounge', when: 'numeric', attribute: 'brightness', above: 50, mode: 'party' }],
    [{ entity: 'person.frank', when: 'not_state', state: 'home', mode: 'away' }, { entity: 'switch.console', mode: 'gaming' }],
    [{ entity: 'button.market', mode: 'event:merchant' }, { entity: 'script.goodnight', mode: 'sleep', duration: 5 }],
    [{ entity: 'zone.home', when: 'numeric', below: 1, mode: 'away' }, { entity: 'input_boolean.party', mode: 'party', label: 'Party!' }],
    [{ entity: 'scene.movie_night', mode: 'movie', state: 'x' }, { entity: 'input_boolean.party' }],
  ];
  out.reactions = lists.map((l) => [L.evalReactions(l, states, now), l.map((t) => L.reactionKind(t))]);
  out.suggest = [L.suggestReactions(states), L.suggestReactions(states, lists[0])];
  const configs = [{}, { triggers: 3 }, { triggers: [5] }, { triggers: [{ mode: 'dance' }] }, { triggers: [{ when: 'x' }] }, { triggers: [{ duration: -1 }] },
    { villagers: 0 }, { fps: 'x' }, { events: 'yes' }, { event_frequency: 'hourly' }, { schedule: [] }, { schedule: { nap: '12:00' } }, { schedule: { wake: '25:00' } },
    { schedule: { wake: '06:30' }, triggers: [{ entity: 'scene.a', mode: 'event:fair' }] }, null];
  out.config = configs.map((c) => { try { L.validateConfig(c); return 'ok'; } catch (e) { return e.message; } });
  // every pose and frame for a few residents, plus animals and foliage
  const vs = [
    { id: 0, job: 'farmer', small: false, seed: 0.1, look: { skin: '#f8d0a8', hair: '#3a2418', shirt: '#ece2c8', pants: '#4a72b8', style: 'short', beard: false } },
    { id: 3, job: 'child', small: true, seed: 0.7, look: { skin: '#9a623e', hair: '#e8c060', shirt: '#e86a3a', pants: '#3a5a9a', style: 'messy', beard: false } },
    { id: 5, job: 'band', instr: 'guitar', small: false, seed: 0.4, look: { skin: '#c88a60', hair: '#26222e', shirt: '#30a8a8', pants: '#8a5a3a', style: 'long', beard: true } },
  ];
  out.sprites = [];
  for (const v of vs) for (const [pose, [, , order]] of Object.entries(L.ANIM)) for (const f of new Set(order)) {
    for (const [carry, gear] of [[null, false], ['bucket', false], [null, true]]) out.sprites.push(`${pose}${f}${carry}${gear}:${hashCv(L.buildVillager(v, pose, f, carry, gear))}`);
  }
  for (const t of ['dog', 'cat', 'rabbit', 'squirrel', 'bird']) for (const pose of ['idle', 'walk', 'sit', 'sleep', 'fly', 'hop', 'peck']) for (let f = 0; f < 4; f++) {
    try { out.sprites.push(`${t}${pose}${f}:${hashCv(L.animalSprite(t, 1, pose, f))}`); } catch (e) { out.sprites.push(`${t}${pose}${f}:${e.message}`); }
  }
  for (const season of ['spring', 'summer', 'fall', 'winter']) for (const snow of [false, true]) {
    for (const kind of ['spruce', 'pine', 'aspen']) out.sprites.push(`${kind}${season}${snow}:${hashCv(L.makeTree(kind, 14, 3, snow, season))}`);
    for (const kind of ['gambel', 'rabbit', 'juniper', 'rose', 'sage']) for (const trimmed of [false, true]) {
      const cv = L.mk(60, 40); L.drawShrub(cv.getContext('2d'), kind, 30, 36, 6, snow, season, trimmed); out.sprites.push(`${kind}${season}${snow}${trimmed}:${hashCv(cv)}`);
    }
  }
  out.eventKeys = Object.entries(L.EVENTS).map(([k, E]) => [k, Object.keys(E).join(',')]);
  // the editor: built with no HA components loaded, so ha-form elements stay inert
  // stand-ins for HA's lazy-loaded form elements: they just hold the data and schema the editor gives them
  for (const t of ['ha-form', 'ha-entity-picker']) if (!customElements.get(t)) customElements.define(t, class extends HTMLElement {});
  const ed = document.createElement('companion-village-card-editor');
  document.body.appendChild(ed);
  ed.hass = { states, config: {}, locale: {} };
  ed.setConfig({ villagers: 6, title: 'Village', triggers: lists[0], schedule: { wake: '06:30' } });
  await new Promise((ok) => setTimeout(ok, 200));
  const root = ed.shadowRoot || ed;
  out.editor = root.innerHTML.replace(/companion-village-card|pixel-village-card/g, 'X');
  out.editorData = [...root.querySelectorAll('*')].filter((e) => e.data || e.schema).map((e) => JSON.stringify([e.tagName, e.data, e.schema, e.computeLabel && e.schema?.map?.((x) => e.computeLabel(x)), e.computeHelper && e.schema?.map?.((x) => e.computeHelper(x))]));
  return out;
}

const browser = await chromium.launch();
async function run(js, dev) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('http://bench.local/**', (r) => r.request().url().endsWith('.js')
    ? r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: js })
    : r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body><script src="card.js"></script></body>' }));
  await page.goto('http://bench.local/');
  const res = await page.evaluate(async ([dev, names, src]) => {
    const L = dev ? window.CompanionVillage : new Function(`return { ${names.join(', ')} };`)();
    return (0, eval)(`(${src})`)(L);
  }, [dev, NAMES, probe.toString()]);
  await page.close();
  return { res, errors };
}
const [a, b] = await Promise.all([run(baseJs, false), run(devJs, true)]);
await browser.close();
let bad = a.errors.length + b.errors.length;
[...a.errors, ...b.errors].forEach((e) => console.log('page error:', e));
for (const k of Object.keys(a.res)) {
  const x = JSON.stringify(a.res[k]), y = JSON.stringify(b.res[k]);
  const n = Array.isArray(a.res[k]) ? a.res[k].length : 1;
  if (x === y) console.log(`same  ${k} (${n})`);
  else { bad++; console.log(`DIFF  ${k}`); }
  if (process.env.SHOW) console.log("   ", x.slice(0, 160), x.length);
}
process.exit(bad ? 1 : 0);

// Times of day, dates and seasons.

export function parseHour(v) {
  if (typeof v === 'number') return v;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
  return m ? +m[1] + +m[2] / 60 : parseFloat(v);
}

// Seasons start on the usual calendar dates (Mar 20, Jun 21, Sep 22, Dec 21) and spring and fall each have
// an early and a late look. snowpack: how far down the peaks are white (deepest in early spring, least in
// late summer); leaves: fallen leaves on the ground (0-2); bloom: wildflowers (0-3); bare: share of
// deciduous leaves already gone.
export const SEASON_LOOKS = {
  winter: { season: 'winter', snowpack: 1.35, leaves: 0, bloom: 0, bare: 1 },
  'spring-early': { season: 'spring', snowpack: 1.5, leaves: 0, bloom: 1, bare: 1, melt: true },
  'spring-late': { season: 'spring', snowpack: 0.85, leaves: 0, bloom: 3, bare: 0, blossom: true },
  summer: { season: 'summer', snowpack: 0.3, leaves: 0, bloom: 2, bare: 0 },
  'fall-early': { season: 'fall', snowpack: 0.35, leaves: 1, bloom: 1, bare: 0.15 },
  'fall-late': { season: 'fall', snowpack: 0.8, leaves: 2, bloom: 0, bare: 0.85 },
};
for (const k in SEASON_LOOKS) SEASON_LOOKS[k].key = k;
// A look from a look key or a plain season name (a season maps to its first look).
export function lookOf(k) {
  if (k && typeof k === 'object') return k;
  return SEASON_LOOKS[k] || SEASON_LOOKS[{ spring: 'spring-early', fall: 'fall-early' }[k]] || SEASON_LOOKS.summer;
}
// Start dates (month * 100 + day) of each look; south of the equator the seasons are flipped.
const LOOK_STARTS = {
  north: [[320, 'spring-early'], [501, 'spring-late'], [621, 'summer'], [922, 'fall-early'], [1016, 'fall-late'], [1221, 'winter']],
  south: [[320, 'fall-early'], [416, 'fall-late'], [621, 'winter'], [922, 'spring-early'], [1101, 'spring-late'], [1221, 'summer']],
};
export function seasonLook(d = new Date(), south = false) {
  const md = (d.getMonth() + 1) * 100 + d.getDate(), starts = LOOK_STARTS[south ? 'south' : 'north'];
  let key = starts[starts.length - 1][1]; // before the first start date: still last year's last look
  for (const [at, k] of starts) if (md >= at) key = k;
  return SEASON_LOOKS[key];
}
export function seasonOf(d = new Date(), south = false) {
  return seasonLook(d, south).season;
}
// The season's window boxes and doorstep: geraniums, bare soil in early spring, mums and pumpkins in fall,
// evergreens and wreaths from December through winter.
export function decorOf(look, d = new Date(), south = false) {
  const L = lookOf(look);
  if (L.season === 'winter') return 'winter';
  if (L.season === 'fall') return L.key === 'fall-late' && d.getMonth() === (south ? 5 : 11) ? 'winter' : 'harvest';
  return L.melt ? 'bare' : 'bloom';
}

// Which events happen on a given day (wall-clock minutes from midnight), from the date and the card's seed.
// Every dashboard shows the same events on the same day; the same kind never runs twice in a row.
export const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export function hourToTime(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

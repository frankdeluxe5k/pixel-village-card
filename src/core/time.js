// Times of day, dates and seasons.

export function parseHour(v) {
  if (typeof v === 'number') return v;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
  return m ? +m[1] + +m[2] / 60 : parseFloat(v);
}

// south = the southern hemisphere, where the seasons run six months apart
export function seasonOf(d = new Date(), south = false) {
  const m = (d.getMonth() + (south ? 6 : 0)) % 12, day = d.getDate();
  if (m === 11 || m <= 1 || (m === 2 && day < 20) || (m === 10 && day > 10)) return 'winter';
  if ((m === 8 && day >= 20) || m === 9 || m === 10) return 'fall';
  if (m <= 4) return 'spring';
  return 'summer';
}

// Which events happen on a given day (wall-clock minutes from midnight), from the date and the card's seed.
// Every dashboard shows the same events on the same day; the same kind never runs twice in a row.
export const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export function hourToTime(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

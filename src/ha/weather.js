// Home Assistant weather entities and conditions.

export const isLive = (st) => !!st && st.state !== 'unavailable' && st.state !== 'unknown';
export function autoWeather(states) {
  const ids = Object.keys(states).filter((k) => k.startsWith('weather.'));
  return ids.find((k) => isLive(states[k])) || ids[0] || null;
}

// Home Assistant weather conditions: clear-night, cloudy, exceptional, fog, hail, lightning,
// lightning-rainy, partlycloudy, pouring, rainy, snowy, snowy-rainy, sunny, windy, windy-variant.
// Anything else (unknown, unavailable, no entity) reads as clear.
export function readWeather(state) {
  const s = state || '';
  return {
    state: s,
    rain: /rain|pouring|hail/.test(s),
    heavy: /pouring|lightning|hail/.test(s),
    hail: s === 'hail',
    snow: /snow/.test(s),
    fog: s === 'fog',
    storm: /lightning/.test(s),
    wind: /windy/.test(s),
    overcast: /^cloudy|rain|pouring|hail|snow|fog|lightning|exceptional/.test(s),
    clouds: s === 'partlycloudy' ? 4 : s === 'windy-variant' ? 6 : /cloudy|rain|pouring|hail|snow|lightning|exceptional/.test(s) ? 7 : 3,
  };
}

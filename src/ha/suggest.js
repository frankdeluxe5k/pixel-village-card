// Reaction suggestions from the user's own entities.
import { EVENTS, EVENT_MODES, eventOfMode } from '../content/events/index.js';
import { MODES } from '../content/moods.js';
import { domainOf } from './reactions.js';

// Look at what's in this Home Assistant and propose sensible reactions.
export const SUGGEST_WORDS = [
  ['party', ['party', 'celebrat\\w*', 'disco', 'festive', 'dance', 'dancing', 'birthday']],
  ['movie', ['movie', 'movies', 'cinema', 'film', 'theater', 'theatre', 'tv time', 'netflix', 'watch tv']],
  ['cozy', ['cozy', 'cosy', 'relax\\w*', 'chill', 'reading', 'fireplace', 'lounge', 'romantic', 'candle\\w*']],
  ['sleep', ['good ?night', 'sleep\\w*', 'bed ?time', 'night mode', 'lights out', 'nap']],
  ['auto', ['good ?morning', 'morning', 'wake ?up', 'sunrise', 'day ?time', 'daylight']],
  ['gaming', ['gaming', 'games?', 'game ?night', 'xbox', 'playstation', 'ps[345]', 'nintendo', 'steam', 'console', 'retro']],
  ['meal', ['dinner', 'lunch', 'breakfast', 'meal', 'cooking', 'dining']],
  ['away', ['away', 'leave', 'leaving', 'vacation', 'holiday', 'good ?bye', 'not home', 'nobody home']],
  ...Object.entries(EVENTS).map(([k, E]) => [`event:${k}`, E.suggest]), // before "work", so "Yard work" means landscapers
  ['work', ['work', 'working', 'focus', 'office', 'study']],
].map(([mode, words]) => [mode, new RegExp(`\\b(${words.join('|')})\\b`, 'i')]);
export const SUGGEST_DURATION = {
  auto: 900, gaming: 240, sleep: 480, away: 720, morning: 60, meal: 90, party: 180, movie: 150, cozy: 150, work: 240,
  ...Object.fromEntries(Object.entries(EVENTS).map(([k, E]) => [`event:${k}`, E.minutes[1]])),
};

export function suggestReactions(states, existing = []) {
  if (!states) return [];
  const have = new Set(existing.map((t) => `${t.entity}|${t.mode}`));
  const out = [];
  const add = (s) => { if (!have.has(`${s.entity}|${s.mode}`)) { have.add(`${s.entity}|${s.mode}`); out.push(s); } };
  const nameOf = (id, st) => String(st.attributes?.friendly_name || id.split('.')[1].replace(/_/g, ' '));
  for (const [id, st] of Object.entries(states)) {
    const d = domainOf(id), name = nameOf(id, st);
    if (['scene', 'script', 'button', 'input_button'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([, re]) => re.test(name));
      if (hit) add({ entity: id, when: 'activated', mode: hit[0], duration: SUGGEST_DURATION[hit[0]], why: hit[0] === 'auto' ? `"${name}" sounds like the start of a normal day` : eventOfMode(hit[0]) ? `"${name}" could bring the ${EVENTS[eventOfMode(hit[0])].label.toLowerCase()}` : `"${name}" sounds like ${MODES[hit[0]].label.toLowerCase()}` });
    } else if (['input_boolean', 'switch'].includes(d)) {
      const hit = SUGGEST_WORDS.find(([m, re]) => (['party', 'movie', 'gaming', 'sleep', 'away', 'cozy'].includes(m) || eventOfMode(m)) && re.test(name));
      if (hit) add({ entity: id, when: 'on', mode: hit[0], why: `while "${name}" is on` });
    } else if (d === 'alarm_control_panel') {
      add({ entity: id, when: 'state', state: ['armed_away', 'armed_vacation'], mode: 'away', why: `when "${name}" is armed away` });
      add({ entity: id, when: 'state', state: ['armed_night'], mode: 'sleep', why: `when "${name}" is armed for the night` });
    } else if (d === 'media_player' && (st.attributes?.device_class === 'tv' || /\b(tv|television|living room|lounge|theat(er|re)|projector)\b/i.test(name))) {
      add({ entity: id, when: 'state', state: ['playing'], mode: 'movie', why: `while "${name}" is playing` });
    }
  }
  const people = Object.keys(states).filter((k) => k.startsWith('person.'));
  if (states['zone.home'] && people.length) add({ entity: 'zone.home', when: 'numeric', below: 1, mode: 'away', why: 'when nobody is home' });
  else if (people.length === 1) add({ entity: people[0], when: 'not_state', state: ['home'], mode: 'away', why: 'when you leave home' });
  const order = ['auto', ...Object.keys(MODES), ...EVENT_MODES];
  return out.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)).slice(0, 16);
}

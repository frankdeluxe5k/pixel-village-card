// Config validation with clear error messages.
import { EVENT_MODES, eventOfMode } from '../content/events/index.js';
import { DEFAULT_SCHEDULE, MODES } from '../content/moods.js';
import { parseHour } from '../core/time.js';
import { REACTION_KINDS } from './reactions.js';

// Clear errors for the editor and HA's error card instead of a village that silently ignores things.
export function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
  if (config.triggers !== undefined && !Array.isArray(config.triggers)) throw new Error('triggers must be a list');
  (config.triggers || []).forEach((t, i) => {
    const at = `triggers[${i + 1}]`;
    if (!t || typeof t !== 'object') throw new Error(`${at} must be an object with an entity and a mode`);
    if (t.entity !== undefined && typeof t.entity !== 'string') throw new Error(`${at}.entity must be an entity id`);
    if (t.mode !== undefined && t.mode !== 'auto' && !MODES[t.mode] && !eventOfMode(t.mode)) throw new Error(`${at}.mode "${t.mode}" isn't a mood (use auto, one of: ${Object.keys(MODES).join(', ')}, or an event: ${EVENT_MODES.join(', ')})`);
    if (t.when !== undefined && !REACTION_KINDS.includes(t.when)) throw new Error(`${at}.when "${t.when}" isn't one of: ${REACTION_KINDS.join(', ')}`);
    if (t.duration !== undefined && !(Number(t.duration) > 0)) throw new Error(`${at}.duration must be a number of minutes`);
  });
  if (config.villagers !== undefined && !(Number(config.villagers) >= 1)) throw new Error('villagers must be a number from 1 to 10');
  if (config.fps !== undefined && !(Number(config.fps) > 0)) throw new Error('fps must be a number (2 to 30)');
  if (config.events !== undefined && typeof config.events !== 'boolean') throw new Error('events must be true or false');
  if (config.event_frequency !== undefined && !['rare', 'daily', 'often'].includes(config.event_frequency)) throw new Error('event_frequency must be rare, daily or often');
  if (config.schedule !== undefined && (typeof config.schedule !== 'object' || Array.isArray(config.schedule))) throw new Error('schedule must be a map of times');
  for (const [k, v] of Object.entries(config.schedule || {})) {
    if (!(k in DEFAULT_SCHEDULE)) throw new Error(`schedule.${k} isn't a schedule entry (use: ${Object.keys(DEFAULT_SCHEDULE).join(', ')})`);
    const h = parseHour(v);
    if (!(h >= 0 && h < 24)) throw new Error(`schedule.${k} must be a time like "06:30"`);
  }
}

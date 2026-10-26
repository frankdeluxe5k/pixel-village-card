// Reactions: map anything in Home Assistant to a village mood or event.
import { EVENT_MODES } from '../content/events/index.js';
import { MODES } from '../content/moods.js';

// States that count as "on / active" across the common domains.
export const ACTIVE_STATES = new Set([
  'on', 'home', 'open', 'opening', 'playing', 'active', 'detected', 'occupied', 'unlocked', 'running', 'cleaning',
  'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'wet', 'problem', 'triggered',
  'armed_away', 'armed_home', 'armed_night', 'armed_vacation', 'armed_custom_bypass',
]);
export const EVENT_DOMAINS = ['scene', 'script', 'automation', 'button', 'input_button', 'event'];
export const REACTION_KINDS = ['activated', 'on', 'state', 'not_state', 'numeric'];
// 'auto' sends the village back to its daily routine (e.g. a "Good morning" scene ending "Good night").
export const REACTION_MODES = new Set(['auto', ...Object.keys(MODES), ...EVENT_MODES]);

export const domainOf = (entity) => String(entity || '').split('.')[0];

// Older configs leave `when` out: scenes, scripts and buttons react when activated, the rest when "on".
export function reactionKind(t) {
  if (REACTION_KINDS.includes(t.when)) return t.when;
  if (t.state !== undefined) return 'state';
  if (t.above !== undefined || t.below !== undefined) return 'numeric';
  return EVENT_DOMAINS.includes(domainOf(t.entity)) ? 'activated' : 'on';
}

// When was this entity last "activated"? Scenes and buttons store it as their state, scripts and
// automations as last_triggered; anything else counts its last state change.
export function activatedAt(st, now, id = st.entity_id) {
  const d = domainOf(id);
  // never-used scenes and buttons report "unknown": they haven't been activated
  if (['scene', 'button', 'input_button', 'event'].includes(d)) return Date.parse(st.state);
  if (d === 'script' && st.state === 'on') return now;
  if (d === 'script' || d === 'automation') return st.attributes?.last_triggered ? Date.parse(st.attributes.last_triggered) : NaN;
  return Date.parse(st.last_changed);
}

// First matching reaction wins. Among "activated" reactions only the most recent activation counts,
// and only while it's within its duration: pressing a newer scene cancels older ones for good.
export function evalReactions(list, states, now = Date.now()) {
  if (!Array.isArray(list) || !states) return null;
  let latest = null;
  list.forEach((t, i) => {
    if (!t || !REACTION_MODES.has(t.mode) || reactionKind(t) !== 'activated') return;
    const st = states[t.entity];
    if (!st) return;
    const ts = activatedAt(st, now, t.entity);
    if (!isNaN(ts) && ts <= now + 60000 && (!latest || ts > latest.ts)) latest = { i, ts };
  });
  if (latest && (now - latest.ts) / 60000 >= (Number(list[latest.i].duration) || 120)) latest = null;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t || !REACTION_MODES.has(t.mode)) continue;
    const st = states[t.entity];
    if (!st) continue;
    const kind = reactionKind(t);
    if (kind === 'activated') { if (latest?.i === i) return t; continue; }
    const raw = t.attribute ? st.attributes?.[t.attribute] : st.state;
    if (raw === undefined || raw === null) continue;
    const val = String(raw);
    if (val === 'unavailable' || val === 'unknown') continue;
    const wanted = [].concat(t.state ?? []).map(String);
    if (kind === 'on' && (raw === true || ACTIVE_STATES.has(val))) return t;
    if (kind === 'state' && wanted.includes(val)) return t;
    if (kind === 'not_state' && wanted.length && !wanted.includes(val)) return t;
    if (kind === 'numeric') {
      const n = parseFloat(raw);
      const above = t.above === '' || t.above === undefined ? null : Number(t.above);
      const below = t.below === '' || t.below === undefined ? null : Number(t.below);
      if (!isNaN(n) && (above !== null || below !== null) && (above === null || n > above) && (below === null || n < below)) return t;
    }
  }
  return null;
}

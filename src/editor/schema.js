// Editor form schemas, labels and helpers.
import { EVENTS, EVENT_MODES, eventOfMode } from '../content/events/index.js';
import { MODES } from '../content/moods.js';
import { EVENT_DOMAINS, domainOf, reactionKind } from '../ha/reactions.js';

export const modeInfo = (m) => {
  if (m === 'auto') return { icon: '🗓️', label: 'Daily routine', text: 'Follow the normal schedule' };
  const ev = eventOfMode(m);
  return ev ? { icon: EVENTS[ev].icon, label: `Event: ${EVENTS[ev].label}`, text: EVENTS[ev].text } : MODES[m];
};

export const MODE_OPTIONS = ['auto', ...Object.keys(MODES), ...EVENT_MODES].map((value) => { const m = modeInfo(value); return { value, label: `${m.icon} ${m.label} — ${m.text}` }; });
export const SCHEDULE_FIELDS = [
  ['wake', 'Wake up'], ['work', 'Start work'], ['lunch', 'Lunch'], ['work_after_lunch', 'Back to work'],
  ['dinner', 'Dinner'], ['evening', 'Evening by the fire'], ['sleep', 'Bedtime'],
];
export const EDITOR_LABELS = {
  title: 'Title', villagers: 'Residents', visitors: 'Visitors, mail carrier and party band', animals: 'Animals',
  show_status: 'Show the status line', fps: 'Frames per second', events: 'Random events', event_frequency: 'How often',
  weather_entity: 'Weather', sun_entity: 'Sun', mode_entity: 'Mood helper (optional)',
  entity: 'When this', when: 'Condition', state: 'State', attribute: 'Attribute (optional)',
  above: 'Above', below: 'Below', duration: 'Stay in this mood for (minutes)', mode: 'The village goes into', label: 'Caption (optional)',
  ...Object.fromEntries(SCHEDULE_FIELDS),
};
export const EDITOR_HELPERS = {
  villagers: 'People who live in the village (1–10).',
  fps: 'Lower saves a little power; 15 is smooth.',
  events: `Now and then a crew drops by: ${Object.values(EVENTS).map((E) => E.label.toLowerCase()).join(', ')}. A reaction can bring one on demand.`,
  weather_entity: 'Leave empty to use the first weather entity found.',
  mode_entity: 'An input_select / select whose state is a mood name (sleep, morning, work, meal, evening, party, movie, gaming, cozy, away). Anything else falls back to the schedule.',
  duration: 'How long the mood lasts after it was activated.',
  attribute: 'Compare an attribute instead of the state.',
};

// The most useful starting condition for a freshly picked entity.
export function defaultKind(entity, states) {
  const d = domainOf(entity), st = states?.[entity];
  if (EVENT_DOMAINS.includes(d)) return 'activated';
  if (['sensor', 'number', 'input_number', 'counter', 'zone'].includes(d) && st && !isNaN(parseFloat(st.state))) return 'numeric';
  if (['person', 'device_tracker', 'media_player', 'alarm_control_panel', 'input_select', 'select', 'vacuum', 'lock', 'cover', 'climate', 'weather'].includes(d)) return 'state';
  return 'on';
}

export function kindOptions(entity) {
  const d = domainOf(entity);
  const ev = EVENT_DOMAINS.includes(d);
  return [
    { value: 'activated', label: ev ? 'Is activated / run' : 'Changes (any state change)' },
    { value: 'on', label: 'Is on / active (on, home, open, playing…)' },
    { value: 'state', label: 'Has a specific state' },
    { value: 'not_state', label: "Doesn't have a specific state" },
    { value: 'numeric', label: 'Is above / below a number' },
  ];
}

export function reactionSchema(t) {
  const kind = reactionKind(t);
  const schema = [
    { name: 'entity', required: true, selector: { entity: {} } },
    { name: 'when', selector: { select: { mode: 'dropdown', options: kindOptions(t.entity) } } },
  ];
  if (kind === 'activated') schema.push({ name: 'duration', selector: { number: { min: 1, max: 1440, step: 1, mode: 'box', unit_of_measurement: 'min' } } });
  if (kind === 'state' || kind === 'not_state' || kind === 'numeric') {
    schema.push({ name: 'attribute', selector: { attribute: {} }, context: { filter_entity: 'entity' } });
  }
  if (kind === 'state' || kind === 'not_state') {
    schema.push({ name: 'state', selector: { state: { multiple: true } }, context: { filter_entity: 'entity', filter_attribute: 'attribute' } });
  }
  if (kind === 'numeric') {
    schema.push({ type: 'grid', name: '', schema: [
      { name: 'above', selector: { number: { mode: 'box', step: 'any' } } },
      { name: 'below', selector: { number: { mode: 'box', step: 'any' } } },
    ] });
  }
  schema.push({ name: 'mode', required: true, selector: { select: { mode: 'dropdown', options: MODE_OPTIONS } } });
  schema.push({ name: 'label', selector: { text: {} } });
  return schema;
}

// Strip empty values and defaults so the saved YAML stays tidy.
export function cleanReaction(t) {
  const out = {};
  for (const k of ['entity', 'when', 'attribute', 'state', 'above', 'below', 'duration', 'mode', 'label']) {
    const v = t[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  const kind = reactionKind(out);
  if (kind !== 'activated' || Number(out.duration) === 120) delete out.duration; // 120 minutes is the default
  if (kind !== 'state' && kind !== 'not_state') delete out.state;
  if (kind !== 'numeric') { delete out.above; delete out.below; }
  if (kind === 'activated' || kind === 'on') delete out.attribute;
  return out;
}

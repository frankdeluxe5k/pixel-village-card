// Village moods and the default daily schedule.

export const MODES = {
  sleep:   { icon: '🌙', label: 'Night',     text: 'The village is fast asleep' },
  morning: { icon: '🌅', label: 'Morning',   text: 'Rise and shine, breakfast is on' },
  work:    { icon: '☀️', label: 'Daytime',   text: 'Everyone is hard at work' },
  meal:    { icon: '🍲', label: 'Mealtime',  text: 'Gathering round for a meal' },
  evening: { icon: '🔥', label: 'Evening',   text: 'Stories around the campfire' },
  party:   { icon: '🎉', label: 'Party!',    text: 'A festival in the village square' },
  movie:   { icon: '🎬', label: 'Movie night', text: 'Popcorn and a picture show under the stars' },
  gaming:  { icon: '🎮', label: 'Game night', text: 'Controllers out and handhelds at the café' },
  cozy:    { icon: '🕯️', label: 'Cozy',      text: 'Everyone is snug indoors' },
  away:    { icon: '🎒', label: 'Adventure', text: 'Off on an adventure, back soon' },
};

export const DEFAULT_SCHEDULE = {
  wake: 6.5, work: 8.5, lunch: 12, work_after_lunch: 13, dinner: 18, evening: 19.5, sleep: 22.5,
};

export function scheduleMode(h, s) {
  // bedtime can be after midnight (sleep 00:30, wake 06:30): then the small hours before it are still evening
  const late = s.sleep < s.wake;
  if (late ? h >= s.sleep && h < s.wake : h < s.wake || h >= s.sleep) return 'sleep';
  if (late && h < s.sleep) return 'evening';
  if (h < s.work) return 'morning';
  if (h < s.lunch) return 'work';
  if (h < s.work_after_lunch) return 'meal';
  if (h < s.dinner) return 'work';
  if (h < s.evening) return 'meal';
  return 'evening';
}

// Visiting crews with their own props. Each entry in EVENTS is self-contained; the card's event framework
// (_spawnEvents and friends) schedules them, runs their stages and draws their props. To add an event:
// add an entry here (crew roles from CREW_LOOKS, a spot on open ground, plan/visit/props hooks), any new
// poses/tools/FX it needs, and a row in the README. See "Adding an event" in CLAUDE.md.
//
// Stages: arrive → setup (only with setupSecs) → open → packup (only with packSecs) → leave.
// Hooks (all optional except crewPlan): start(c, ev), instant(c, ev) when the card loads mid-event,
// crewPlan(c, v, ev, i) → a plan or null (null = leave), visit(c, v, ev) → an onlooker plan,
// tick(c, ev) once a second, props(c, ev, add) to draw, blocks(c, ev) → footprints, lights(c, ctx, ev, dark)
// with lightRects(c, ev, dark) → [x, y, w, h, depth line, tint?] so people in front of those lights are redrawn,
// keep(c, day, min) for anything that outlasts the event (a sculpture, trimmed shrubs).

export const DAY_MOODS = ['morning', 'work', 'meal'];

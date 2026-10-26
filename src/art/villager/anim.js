// Keyframe animation tables for villager poses.

// Keyframes: [frontHand, backHand] offsets from the shoulders, plus optional upper-body bob.
export const KEYS = {
  idle: [{ f: [1, 6], b: [-1, 6] }, { f: [1, 5], b: [-1, 5], bob: -1 }],
  sit: [{ f: [3, 3], b: [2, 4] }, { f: [3, 2], b: [2, 3], bob: -1 }],
  // hoe / axe / hammer: wind-up, swing, strike, follow-through (dir = tool shaft direction)
  swing: [
    { f: [0, -7], b: [-2, -6], dir: [-0.3, -1] },
    { f: [4, -4], b: [2, -3], dir: [0.75, -0.65] },
    { f: [6, 2], b: [4, 3], dir: [0.8, 0.6] },
    { f: [5, 4], b: [3, 4], dir: [0.45, 0.9], bob: 1 },
  ],
  cook: [{ f: [6, 3] }, { f: [5, 4] }, { f: [4, 3] }, { f: [5, 2] }],
  chat: [{ f: [5, 2] }, { f: [5, -1] }, { f: [6, 0] }, { f: [4, 1] }],
  dance: [
    { f: [5, -6], b: [-5, -6] }, { f: [6, 0], b: [-6, 0] },
    { f: [3, 2], b: [-4, -7] }, { f: [6, -5], b: [-6, 1] },
  ],
  stretch: [{ f: [1, 4], b: [-1, 4] }, { f: [2, -4], b: [-2, -4] }, { f: [2, -8], b: [-2, -8], bob: -1 }],
  eat: [{ f: [3, 4], b: [1, 5] }, { f: [3, 1], b: [1, 5] }, { f: [3, -3], b: [1, 5] }],
  // café poses: everyone sits behind a table, so hands stay on the tabletop (FY - 14) instead of dipping under it
  sip: [{ f: [6, -2], b: [2, 4] }, { f: [5, -4], b: [2, 4] }, { f: [3, -4], b: [2, 4] }],
  watch: [{ f: [2, 4], b: [1, 5] }, { f: [3, 1], b: [1, 5] }, { f: [3, -3], b: [1, 5] }],
  laptop: [{ f: [5, -2], b: [4, -2] }, { f: [5, -3], b: [4, -2] }, { f: [5, -2], b: [3, -3] }, { f: [6, -3], b: [4, -2] }],
  lute: [{ f: [2, 4], b: [6, 0] }, { f: [2, 5], b: [6, -1] }, { f: [3, 4], b: [6, 0] }, { f: [2, 6], b: [7, 0] }],
  sweep: [{ f: [3, 4], b: [1, 5] }, { f: [4, 4], b: [2, 5] }, { f: [5, 4], b: [3, 5] }, { f: [4, 4], b: [2, 5] }],
  fetch: [{ f: [4, 5], b: [3, 3] }, { f: [4, 3], b: [3, 2] }, { f: [4, 1], b: [3, 1] }, { f: [4, 3], b: [3, 2] }],
  setup: [{ f: [3, -6], b: [-1, -8] }, { f: [2, -8], b: [0, -7] }, { f: [3, -9], b: [-1, -6] }, { f: [2, -7], b: [0, -8] }],
  serve: [{ f: [6, 1], b: [4, 2] }, { f: [5, -1], b: [4, 2] }, { f: [4, 2], b: [4, 2] }, { f: [6, 1], b: [4, 2] }],
  water: [{ f: [6, 1], b: [4, 2] }, { f: [6, 0], b: [4, 1] }],
  handheld: [{ f: [4, -3], b: [3, -2] }, { f: [4, -2], b: [3, -2] }, { f: [4, -3], b: [3, -3] }],
  controller: [{ f: [3, 2], b: [2, 3] }, { f: [4, 2], b: [2, 2] }, { f: [3, 1], b: [2, 3] }],
  // sticks: snare hit, other hand down on the tom, crash
  band_drums: [{ f: [3, 3], b: [8, -5] }, { f: [2, -5], b: [10, 2] }, { f: [9, -4], b: [8, -5] }],
  // fretting hand on the neck, strumming hand at the body; down-strums dip the body
  band_bass: [{ f: [-1, 3], b: [14, -2] }, { f: [0, 4], b: [14, -2], bob: 1 }, { f: [-1, 3], b: [13, -2] }, { f: [0, 4], b: [13, -2], bob: 1 }],
  band_guitar: [{ f: [0, 2], b: [13, -2] }, { f: [1, 4], b: [13, -2], bob: 1 }, { f: [0, 3], b: [12, -2] }, { f: [1, 5], b: [12, -2], bob: 1 }],
  // event crews
  knock: [{ f: [5, -3] }, { f: [6, -2] }],
  shrug: [{ f: [4, -1], b: [-4, -1], bob: -1 }],
  paint: [{ f: [6, -4] }, { f: [6, -1] }, { f: [5, -6] }, { f: [6, -2] }],
  trim: [{ f: [6, 0], b: [5, 1] }, { f: [6, 1], b: [5, 2] }],
  prune: [{ f: [4, -7], b: [3, -6] }, { f: [5, -8], b: [4, -7] }],
  crank: [{ f: [6, 0] }, { f: [7, -2] }, { f: [6, -4] }, { f: [5, -2] }],
  toss: [{ f: [2, -6] }, { f: [6, -3] }, { f: [7, 0] }, { f: [4, 3] }],
  announce: [{ f: [6, -5] }, { f: [7, -3] }],
  juggle: [{ f: [5, -2], b: [3, 1] }, { f: [5, 1], b: [3, -2] }],
  // seasonal chores: shovel bites into the snow, lifts, tosses it aside, comes back
  shovel: [
    { f: [5, 4], b: [1, 2], dir: [0.45, 0.9] }, { f: [4, 1], b: [0, 0], dir: [0.85, 0.35], bob: 1 },
    { f: [3, -3], b: [-1, -3], dir: [0.9, -0.45] }, { f: [5, 2], b: [1, 1], dir: [0.6, 0.8] },
  ],

  // ----- variants (see VARIANTS). `legs` = [backOff, backLift, frontOff, frontLift] like the walk; `turn` mirrors the frame -----
  // dances: side-step with a clap, a jig with kicks (hands on hips), a spin with the arms up
  dance_sway: [
    { f: [3, -1], b: [9, -1], legs: [-1, 0, 2, 0] }, { f: [5, 1], b: [5, 1], legs: [-2, 0, 1, 0], bob: 1 },
    { f: [3, -1], b: [9, -1], legs: [1, 0, -1, 0] }, { f: [5, 1], b: [5, 1], legs: [-2, 0, 1, 0], bob: 1 },
  ],
  dance_jig: [
    { f: [1, 4], b: [-1, 4], legs: [0, 0, 3, 2] }, { f: [1, 4], b: [-1, 4], bob: 1 },
    { f: [1, 4], b: [-1, 4], legs: [-3, 2, 0, 0] }, { f: [1, 4], b: [-1, 4], bob: 1 },
  ],
  dance_spin: [
    { f: [5, -14], b: [-5, -14] }, { f: [4, -15], b: [-4, -14], turn: true },
    { f: [5, -14], b: [-5, -14], turn: true, legs: [0, 0, 1, 1] }, { f: [4, -15], b: [-4, -14], legs: [-1, 1, 0, 0] },
  ],
  // the kid: hopscotch on one leg with arms out, a twirl
  kid_hop: [{ f: [6, -1], b: [-6, -1], legs: [0, 1, 0, 0] }, { f: [6, -2], b: [-6, 0], legs: [0, 1, 0, 0] }, { f: [5, 1], b: [-5, 1] }],
  kid_twirl: [{ f: [7, -2], b: [-7, -2] }, { f: [7, -1], b: [-7, -3], turn: true }, { f: [7, -2], b: [-7, -2], turn: true }, { f: [7, -3], b: [-7, -1] }],
  // toys: yo-yo (the disc's drop is drawn by frame), bouncing a ball, kicking it, watching a spinning top
  yoyo: [{ f: [4, -3], b: [-1, 5] }, { f: [4, -1], b: [-1, 5] }, { f: [4, 0], b: [-1, 5], bob: 1 }, { f: [4, -3], b: [-1, 5] }],
  bounce: [{ f: [4, -2], b: [-1, 5] }, { f: [4, 0], b: [-1, 5] }, { f: [4, 1], b: [-1, 5], bob: 1 }, { f: [4, -1], b: [-1, 5] }],
  kick: [{ f: [2, 3], b: [-3, 2], legs: [1, 0, -2, 1] }, { f: [3, 2], b: [-4, 1], legs: [0, 0, 3, 1], bob: -1 }, { f: [2, 4], b: [-2, 4] }],
  spintop: [{ f: [3, 4], b: [2, 5], bob: 1 }, { f: [3, 4], b: [2, 5], bob: 1 }],
  // catch between the two kids: ball held at the chest, arms out ready for the throw coming in
  holdball: [{ f: [3, 0], b: [4, 1] }, { f: [3, 0], b: [4, 1], bob: -1 }],
  catchready: [{ f: [5, -3], b: [7, -2] }, { f: [5, -2], b: [7, -1], bob: -1 }],
  // the grandmother knitting in her lap, needles clicking
  knit: [{ f: [3, 2], b: [2, 3] }, { f: [4, 2], b: [1, 3] }, { f: [3, 1], b: [2, 3] }, { f: [4, 2], b: [1, 2] }],
  // work: a flat side swing, leaning on the axe for a breather
  chop_side: [
    { f: [-3, -2], b: [-5, -1], dir: [-1, -0.25] }, { f: [3, -1], b: [1, 0], dir: [0.95, -0.3] },
    { f: [6, 1], b: [4, 1], dir: [1, 0.15] }, { f: [5, 3], b: [3, 3], dir: [0.7, 0.7], bob: 1 },
  ],
  chop_rest: [{ f: [3, 1], b: [6, 1], dir: [0.3, 1] }, { f: [3, 1], b: [6, 1], dir: [0.3, 1], bob: -1 }],
  farm_dig: [{ f: [3, -2], b: [1, -1], dir: [0.5, -0.85] }, { f: [5, 2], b: [3, 3], dir: [0.7, 0.7], bob: 1 }],
  farm_weed: [{ f: [5, 5], b: [3, 6], bob: 2, tool: null }, { f: [4, 2], b: [3, 6], bob: 2, tool: null }, { f: [5, 4], b: [2, 5], bob: 2, tool: null }],
  sweep_wide: [{ f: [1, 4], b: [-1, 5] }, { f: [4, 4], b: [2, 5] }, { f: [7, 4], b: [5, 5] }, { f: [4, 4], b: [2, 5] }],
  sweep_lean: [{ f: [6, 4], b: [7, 4] }, { f: [6, 4], b: [7, 4], bob: -1 }],
  cook_season: [{ f: [5, 3], b: [9, -3] }, { f: [5, 4], b: [9, -1] }, { f: [5, 3], b: [9, -3] }, { f: [5, 2], b: [9, -1] }],
  cook_taste: [{ f: [5, 3] }, { f: [3, -2] }, { f: [2, -5] }, { f: [2, -5], bob: -1 }],
  // social: big two-handed gestures, a belly laugh, shading the eyes, hands behind the back
  chat_wave: [{ f: [6, -3], b: [7, -1] }, { f: [4, 0], b: [8, -4] }, { f: [7, -5], b: [6, 0] }, { f: [5, -1], b: [8, -3] }],
  chat_laugh: [{ f: [1, 4], b: [-1, 5], bob: -1 }, { f: [1, 5], b: [-1, 6] }],
  idle_look: [{ f: [5, -9], b: [-1, 6] }, { f: [5, -9], b: [-1, 5], bob: -1 }],
  idle_whistle: [{ f: [-2, 5], b: [-1, 5] }, { f: [-2, 5], b: [-1, 5], bob: -1 }],
};
// the band rocking harder: deeper dips on the down-strums, leaning back on the up-strums
KEYS.band_guitar_rock = KEYS.band_guitar.map((k) => ({ ...k, bob: k.bob ? 2 : -1 }));
KEYS.band_bass_rock = KEYS.band_bass.map((k) => ({ ...k, bob: k.bob ? 2 : -1 }));

// pose -> [keyframe set, frames per second, playback order]
export const ANIM = {
  idle: ['idle', 1.4, [0, 0, 0, 1, 1, 0]],
  sit: ['sit', 1, [0, 0, 0, 1, 1, 0]],
  walk: [null, 10, [0, 1, 2, 3, 4, 5]],
  farm: ['swing', 6, [0, 1, 2, 3]], chop: ['swing', 7, [0, 1, 2, 3]], sign: ['swing', 8, [0, 1, 2, 3]],
  cook: ['cook', 5, [0, 1, 2, 3]], chat: ['chat', 3, [0, 1, 2, 1, 3, 0]],
  dance: ['dance', 6, [0, 1, 2, 3]], kidplay: ['dance', 6, [0, 1, 3, 1]],
  stretch: ['stretch', 3, [0, 1, 2, 2, 2, 1]],
  eat: ['eat', 3, [0, 0, 0, 1, 2, 2, 1, 0]], sip: ['sip', 2.5, [0, 0, 0, 0, 1, 2, 2, 1]],
  watch: ['watch', 3, [0, 0, 0, 0, 1, 2, 1, 0]],
  laptop: ['laptop', 7, [0, 1, 2, 3, 0, 2, 1, 3]],
  lute: ['lute', 6, [0, 1, 2, 3]], lutesit: ['lute', 6, [0, 1, 2, 3]],
  sweep: ['sweep', 5, [0, 1, 2, 3]], fetch: ['fetch', 4, [0, 1, 2, 3]], setup: ['setup', 4, [0, 1, 2, 3]],
  serve: ['serve', 2.5, [0, 1, 2, 3]], water: ['water', 4, [0, 1]],
  ride: [null, 8, [0, 1, 2, 3]],
  handheld: ['handheld', 3, [0, 1, 0, 2, 1, 0]], controller: ['controller', 7, [0, 1, 2, 1]],
  band_drums: ['band_drums', 7, [0, 1, 0, 1, 0, 1, 2, 1]], band_bass: ['band_bass', 4, [0, 1, 2, 3]],
  band_guitar: ['band_guitar', 7, [0, 1, 2, 3]],
  pull: [null, 10, [0, 1, 2, 3, 4, 5]], push: [null, 10, [0, 1, 2, 3, 4, 5]],
  knock: ['knock', 4, [0, 1, 0, 1, 0, 0, 0, 0]], shrug: ['shrug', 1, [0]], paint: ['paint', 5, [0, 1, 2, 3]],
  trim: ['trim', 6, [0, 1]], prune: ['prune', 5, [0, 1]], crank: ['crank', 5, [0, 1, 2, 3]],
  toss: ['toss', 4, [0, 0, 1, 2, 3, 3]], announce: ['announce', 2, [0, 1]], juggle: ['juggle', 5, [0, 1]],
  rake: ['sweep', 4, [0, 1, 2, 3, 2, 1]], shovel: ['shovel', 4, [0, 1, 2, 2, 3, 0]], sow: ['toss', 4, [0, 1, 2, 3]],
  throw: ['toss', 4, [0, 0, 0, 1, 2, 3, 3, 3]], harvest: ['fetch', 3, [0, 1, 2, 3]], pat: ['cook', 4, [0, 1, 2, 3]],
  // variants
  dance_sway: ['dance_sway', 5, [0, 1, 2, 3]], dance_jig: ['dance_jig', 7, [0, 1, 2, 3]], dance_spin: ['dance_spin', 7, [0, 1, 2, 3, 0, 0]],
  kid_hop: ['kid_hop', 5, [0, 1, 0, 1, 2, 2]], kid_twirl: ['kid_twirl', 7, [0, 1, 2, 3]],
  yoyo: ['yoyo', 5, [0, 1, 2, 3]], bounce: ['bounce', 5, [0, 1, 2, 3]], kick: ['kick', 4, [0, 1, 2, 2, 2, 2]], spintop: ['spintop', 8, [0, 1]],
  throwball: ['toss', 4, [0, 0, 0, 1, 2, 3, 3, 3]],
  holdball: ['holdball', 1.5, [0, 0, 1, 1]], catchready: ['catchready', 2, [0, 1]], knit: ['knit', 4, [0, 1, 2, 3]],
  chop_side: ['chop_side', 7, [0, 1, 2, 3]], chop_rest: ['chop_rest', 1.2, [0, 1]],
  farm_dig: ['farm_dig', 7, [0, 1]], farm_weed: ['farm_weed', 3, [0, 1, 0, 2]],
  sweep_wide: ['sweep_wide', 4, [0, 1, 2, 3]], sweep_lean: ['sweep_lean', 1.2, [0, 1]],
  rake_wide: ['sweep_wide', 3, [0, 1, 2, 3, 2, 1]],
  cook_season: ['cook_season', 6, [0, 1, 2, 3]], cook_taste: ['cook_taste', 3, [0, 1, 2, 3, 3, 3, 2, 1]],
  chat_wave: ['chat_wave', 3, [0, 1, 2, 3]], chat_laugh: ['chat_laugh', 7, [0, 1]],
  idle_look: ['idle_look', 1.4, [0, 0, 0, 1, 1, 0]], idle_whistle: ['idle_whistle', 1.4, [0, 0, 1, 1]],
  band_guitar_rock: ['band_guitar_rock', 7, [0, 1, 2, 3]], band_guitar_jump: ['band_guitar', 7, [0, 1, 2, 3]],
  band_bass_rock: ['band_bass_rock', 4, [0, 1, 2, 3]], band_bass_jump: ['band_bass', 4, [0, 1, 2, 3]],
};
export const LIFT = {
  dance: [0, 2, 3, 2], kidplay: [0, 2, 3, 2], prune: [4, 4, 4, 4],
  dance_jig: [0, 1, 0, 1], dance_spin: [1, 2, 2, 1], kid_hop: [2, 0, 2, 0], kid_twirl: [0, 1, 1, 0],
  band_guitar_jump: [0, 3, 0, 0], band_bass_jump: [0, 3, 0, 0],
};
// Alternatives to a base pose: [pose, weight], default first. One is picked when the action starts
// (and again now and then during long ones), so the default is the usual look and the last is a rare treat.
export const VARIANTS = {
  dance: [['dance', 6], ['dance_sway', 3], ['dance_jig', 3], ['dance_spin', 1]],
  kidplay: [['kidplay', 5], ['kid_hop', 3], ['kid_twirl', 1]],
  bounce: [['bounce', 3], ['kick', 1]],
  chop: [['chop', 6], ['chop_side', 3], ['chop_rest', 1]],
  farm: [['farm', 6], ['farm_dig', 3], ['farm_weed', 1.5]],
  sweep: [['sweep', 6], ['sweep_wide', 3], ['sweep_lean', 1]],
  rake: [['rake', 3], ['rake_wide', 1]],
  cook: [['cook', 6], ['cook_season', 3], ['cook_taste', 1.5]],
  chat: [['chat', 6], ['chat_wave', 3], ['chat_laugh', 1.5]],
  idle: [['idle', 6], ['idle_look', 2], ['idle_whistle', 1]],
  band_guitar: [['band_guitar', 5], ['band_guitar_rock', 3], ['band_guitar_jump', 1]],
  band_bass: [['band_bass', 5], ['band_bass_rock', 3], ['band_bass_jump', 1]],
};
// variant pose -> its base pose (tools and effects follow the base)
export const BASE_POSE = {};
for (const [base, list] of Object.entries(VARIANTS)) for (const [pose] of list) BASE_POSE[pose] = base;
// Actions that simply play a pose of another name (event crews and onlookers).
export const ACTION_POSE = {
  build: 'setup', sell: 'chat', pitch: 'chat', browse: 'idle', admire: 'idle', chisel: 'sign', cheer: 'dance', hitch: 'setup',
  knock: 'knock', shrug: 'shrug', paint: 'paint', trim: 'trim', prune: 'prune', crank: 'crank', toss: 'toss', announce: 'announce', juggle: 'juggle',
  rake: 'rake', shovel: 'shovel', yoyo: 'yoyo', bounce: 'bounce', spintop: 'spintop', playfetch: 'throwball', tag: 'kidplay',
  catch: 'catchready', knit: 'knit', mend: 'sign', feed: 'sow', tend: 'water', sow: 'sow', throw: 'throw', harvest: 'harvest', snowman: 'pat', leap: 'kidplay',
};
// Tools held for a pose (by frame where it matters).
export const POSE_TOOL = {
  paint: () => 'brush', trim: () => 'shears', prune: () => 'shears', toss: (f) => (f < 2 ? 'ring' : null), juggle: () => 'balls',
  rake: () => 'rake', shovel: () => 'shovel', throw: (f) => (f < 2 ? 'snowball' : null), harvest: () => 'pumpkin',
  yoyo: () => 'yoyo', bounce: () => 'ball', holdball: () => 'heldball', knit: () => 'knit', kick: (f) => (f < 2 ? 'football' : null), spintop: () => 'top', throwball: (f) => (f < 2 ? 'heldball' : null),
};

// sitting at a café table: a child's shoulders are 2 px lower, so their hands are raised to match
export const TABLE_POSES = new Set(['sip', 'laptop', 'handheld']);
export const SIT_POSES = new Set(['knit', 'sit', 'eat', 'watch', 'lutesit', 'laptop', 'sip', 'handheld', 'controller', 'band_drums']);

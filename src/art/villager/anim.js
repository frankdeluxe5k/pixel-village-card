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
  sip: [{ f: [4, 2], b: [2, 4] }, { f: [4, -1], b: [2, 4] }, { f: [3, -3], b: [2, 4] }],
  watch: [{ f: [2, 4], b: [1, 5] }, { f: [3, 1], b: [1, 5] }, { f: [3, -3], b: [1, 5] }],
  laptop: [{ f: [5, 1], b: [4, 2] }, { f: [5, 2], b: [4, 1] }, { f: [5, 1], b: [3, 2] }, { f: [6, 2], b: [4, 1] }],
  lute: [{ f: [2, 4], b: [6, 0] }, { f: [2, 5], b: [6, -1] }, { f: [3, 4], b: [6, 0] }, { f: [2, 6], b: [7, 0] }],
  sweep: [{ f: [3, 4], b: [1, 5] }, { f: [4, 4], b: [2, 5] }, { f: [5, 4], b: [3, 5] }, { f: [4, 4], b: [2, 5] }],
  fetch: [{ f: [4, 5], b: [3, 3] }, { f: [4, 3], b: [3, 2] }, { f: [4, 1], b: [3, 1] }, { f: [4, 3], b: [3, 2] }],
  setup: [{ f: [3, -6], b: [-1, -8] }, { f: [2, -8], b: [0, -7] }, { f: [3, -9], b: [-1, -6] }, { f: [2, -7], b: [0, -8] }],
  serve: [{ f: [6, 1], b: [4, 2] }, { f: [5, -1], b: [4, 2] }, { f: [4, 2], b: [4, 2] }, { f: [6, 1], b: [4, 2] }],
  water: [{ f: [6, 1], b: [4, 2] }, { f: [6, 0], b: [4, 1] }],
  handheld: [{ f: [4, 0], b: [3, 1] }, { f: [4, 1], b: [3, 1] }, { f: [4, 0], b: [3, 0] }],
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
};
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
};
export const LIFT = { dance: [0, 2, 3, 2], kidplay: [0, 2, 3, 2], prune: [4, 4, 4, 4] };
// Actions that simply play a pose of another name (event crews and onlookers).
export const ACTION_POSE = {
  build: 'setup', sell: 'chat', pitch: 'chat', browse: 'idle', admire: 'idle', chisel: 'sign', cheer: 'dance', hitch: 'setup',
  knock: 'knock', shrug: 'shrug', paint: 'paint', trim: 'trim', prune: 'prune', crank: 'crank', toss: 'toss', announce: 'announce', juggle: 'juggle',
};
// Tools held for a pose (by frame where it matters).
export const POSE_TOOL = { paint: () => 'brush', trim: () => 'shears', prune: () => 'shears', toss: (f) => (f < 2 ? 'ring' : null), juggle: () => 'balls' };

export const SIT_POSES = new Set(['sit', 'eat', 'watch', 'lutesit', 'laptop', 'sip', 'handheld', 'controller', 'band_drums']);

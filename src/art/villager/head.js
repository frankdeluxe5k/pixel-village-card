// Villager heads, faces, hair, beards and hats.
import { AX } from './frame.js';
import { hexToRgb, mixHex } from '../../core/color.js';
import { OUT } from '../../core/constants.js';
import { mulberry32 } from '../../core/math.js';
import { P, tpl } from '../../core/pixels.js';

// Head in 3/4 view facing right: flat crown under the hair, ear on the left, cheek and a defined chin on
// the right. The face itself (brows, eyes, nose, mouth) is drawn by drawFace from each person's traits.
export const HEAD = [
  '..HHHHHHH...',
  '.HHHSSSSSS..',
  '.HSSSSSSSSS.',
  'HSSSSSSSSSSS',
  'SSSSSSSSSSSS',
  'SSSSSSSSSSSS',
  'SESSSSSSSSSS',
  'sEsSSSSSSSSS',
  '.ssSSSSSSSSs',
  '.ssSSSSSSSS.',
  '..ssSSSSSSs.',
  '....sssss...',
];

export const HAIR = {
  // no hair at all: the head's own highlight shines on top
  bald: [],
  // grey hair swept back into a bun at the back of the head
  bun: [
    'kkk..jjjjj....',
    'khhkjhhhhhh...',
    'khhkhhhhhhhhh.',
    '.kjhhhhhhhhhhh',
    '.hhhhhhhhhhkhk',
    'hhhhhkkh..k...',
    'hhhhk.........',
    'khhk..........',
    '.kk...........',
  ],
  short: [
    '....jjjjj.....',
    '..jjjhhhhhh...',
    '.jjhhhhhhhhhh.',
    '.jhhjjhhhhhhhh',
    'jhhhhhhhhhhkhk',
    'hhhhhkkh..k...',
    'hhhhk.........',
    'khhk..........',
    '.kk...........',
  ],
  long: [
    '....jjjjj.....',
    '..jjjhhhhhh...',
    '.jjhhhhhhhhhh.',
    '.jhhhhhhhhhhhh',
    'jhhhhhhhhhhhhk',
    'hhhhhhkhhkhk..',
    'hhhhhk........',
    'hhhhk.........',
    'jhhhk.........',
    'hhhhk.........',
    'hhhk..........',
    'hhhk..........',
    'hhk...........',
    'kk............',
  ],
  swoop: [
    '...jjjjjj.....',
    '..jjhhhhhhj...',
    '.jhhhhhhhhhhh.',
    'jhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhk',
    'hhhhhhhhhhhhk.',
    'hhhhhkhhhkk...',
    'hhhk..........',
    'hhk...........',
    'hk............',
  ],
  spiky: [
    '..j..j..j.....',
    '.jj.jj.jjj....',
    '.jhhjhhjhhjh..',
    'jhhhhhhhhhhhh.',
    'hhhhhhhhhhhkhk',
    'hhhhhkkh..k...',
    'hhhk..........',
    'khk...........',
  ],
  messy: [
    '...j..j.j.....',
    '..jjhjjhjh....',
    '.jjhhhhhhhhhh.',
    '.jhhhhhhhhhhhh',
    'jhhhhhhhhhkhhk',
    'hhhhhhk.hk.k..',
    'hhhhk.........',
    'khk...........',
  ],
};

export const BEARD = [
  '..h.........',
  '..hh..hhhhh.',
  '..hhhh..hhhk',
  '...hhhhhhhk.',
  '....khhhhk..',
  '......kk....',
];

// Each person's face: stable traits picked from their seed, so everyone keeps the same face.
export const IRIS = ['#5a3a24', '#3a6ab8', '#3a8a5a', '#7a5a2a', '#3a3044'];
export function faceOf(v) {
  const L = v.look;
  if (L.faceT) return L.faceT;
  const r = mulberry32(Math.floor((v.seed || 0) * 1e6) + v.id * 131 + 7), pick = (a) => a[Math.floor(r() * a.length)];
  const kid = v.small;
  return (L.faceT = {
    ...{
    eye: pick(kid ? ['round', 'round', 'lash'] : ['round', 'round', 'lash', 'narrow']),
    iris: pick(IRIS),
    brow: pick(kid ? ['flat', 'arch', 'soft'] : ['flat', 'arch', 'thick', 'soft', 'worried', 'bold']),
    mouth: pick(kid ? ['smile', 'grin', 'open'] : ['smile', 'smile', 'flat', 'smirk', 'grin']),
    nose: pick(['button', 'button', 'long', 'round']),
    blush: kid || r() < 0.3,
    freckles: r() < (kid ? 0.45 : 0.15),
    glasses: !kid && !L.beard && r() < 0.15,
    stache: !L.beard && !kid && r() < 0.12,
    },
    ...L.face,
  });
}
// Brows as [col, row] pixels in head space: near eye then far eye.
export const BROWS = {
  flat: [[4, 4], [5, 4], [6, 4], [9, 4], [10, 4]],
  arch: [[4, 4], [5, 3], [6, 4], [9, 3], [10, 4]],
  thick: [[4, 4], [5, 4], [6, 4], [5, 3], [6, 3], [9, 4], [10, 4], [9, 3]],
  soft: [[5, 4], [6, 4], [9, 4]],
  worried: [[4, 4], [5, 4], [6, 3], [9, 3], [10, 4]],
  bold: [[4, 3], [5, 4], [6, 4], [9, 4], [10, 3]],
};

// Head, face, beard, hair and hat. Returns the eye boxes for blinking.
export function drawHead(g, v, hy, skin, hair) {
  const L = v.look, F = faceOf(v), X = AX - 5;
  const Q = (c, r, col, w = 1, h = 1) => P(g, X + c, hy + r, w, h, col);
  tpl(g, HEAD, X, hy, { S: skin.m, s: skin.d, H: skin.l, E: skin.o });
  Q(2, 6, skin.d); Q(1, 5, skin.m);
  for (const [c, r] of BROWS[F.brow]) Q(c, r, F.brow === 'soft' ? hair.m : hair.d);
  // eyes: white on the outer side, pupil looking ahead with the iris colour under the lid
  for (const ex of [5, 9]) {
    if (F.eye === 'narrow') { Q(ex, 5, OUT, 2, 1); Q(ex, 6, '#f8f4ee'); Q(ex + 1, 6, F.iris); }
    else { Q(ex, 5, '#f8f4ee', 1, 2); Q(ex + 1, 5, OUT); Q(ex + 1, 6, F.iris); }
  }
  if (F.eye === 'lash') { Q(4, 5, OUT); Q(5, 4, OUT); Q(11, 5, OUT); }
  // nose between the eyes, lit from the upper left
  const lip = mixHex(skin.o, '#8a3a3a', 0.25), nose = mixHex(skin.d, skin.o, 0.35), dark = '#4a1e22';
  if (F.nose === 'long') { Q(8, 5, skin.l, 1, 2); Q(8, 7, nose); Q(9, 7, skin.d); }
  else if (F.nose === 'round') { Q(8, 6, skin.l); Q(7, 7, skin.d); Q(8, 7, nose); }
  else { Q(8, 6, skin.l); Q(8, 7, nose); }
  if (F.blush) { const b = mixHex(skin.m, '#e86a70', 0.22); Q(4, 8, b); Q(10, 8, b); }
  if (F.freckles) for (const [c, r] of [[3, 7], [5, 8], [10, 7]]) Q(c, r, skin.d);
  switch (F.mouth) {
    case 'smile': Q(7, 9, lip, 2); Q(6, 8, skin.d); Q(9, 8, skin.d); break;
    case 'grin': Q(6, 9, lip); Q(7, 9, '#fffaf0', 2); Q(9, 9, lip); Q(7, 10, dark, 2); break;
    case 'open': Q(7, 9, dark, 2); Q(7, 10, mixHex(dark, '#e07070', 0.6), 2); break;
    case 'smirk': Q(7, 9, lip, 2); Q(9, 8, lip); break;
    case 'beam': Q(5, 8, lip); Q(10, 8, lip); Q(6, 9, lip, 4); Q(7, 9, '#fffaf0', 2); break; // a wide, upturned smile
    default: Q(7, 9, lip, 2);
  }
  Q(6, 10, skin.l, 2); // chin light
  if (L.beard) {
    tpl(g, BEARD, X, hy + 7, { h: hair.m, k: hair.d });
    if (F.mouth === 'beam') { Q(5, 8, lip); Q(10, 8, lip); Q(6, 9, lip, 4); Q(7, 9, '#fffaf0', 2); } // a grin that shows through the beard
  }
  else if (F.stache) { Q(6, 8, hair.m, 4); Q(6, 8, hair.d); Q(9, 8, hair.d); }
  tpl(g, HAIR[L.style], X - 1, hy - 2, { h: hair.m, k: hair.d, j: L.streak || hair.l });
  if (F.glasses) {
    const [r, gg, b] = hexToRgb(L.skin), fr = r * 0.3 + gg * 0.6 + b * 0.1 < 140 ? '#e0d4b8' : '#3a2a24';
    Q(4, 5, fr, 1, 2); Q(5, 7, fr, 2); Q(7, 5, fr, 1, 2); Q(8, 5, fr); Q(9, 7, fr, 2); Q(11, 5, fr, 1, 2); Q(2, 5, fr, 2);
  }
  const hat = HATS[v.hat || v.job];
  if (hat) tpl(g, hat.rows, X + hat.ox, hy + hat.oy, hat.map);
  return [[X + 5, hy + 5], [X + 9, hy + 5]];
}

export const HATS = {
  farmer: {
    ox: -3, oy: -4,
    map: { Y: '#f4dc8a', y: '#e0bc5c', u: '#a87a34', r: '#c83a2a' },
    rows: [
      '......YYYYY.......',
      '.....YYyyyyyy.....',
      '....Yyyyyyyyyu....',
      '....rrrrrrrrrr....',
      'YYyyyyyyyyyyyyyyuu',
      '.uuuuuuuuuuuuuuuu.',
    ],
  },
  cook: {
    ox: -1, oy: -7,
    map: { W: '#fafaf6', V: '#c8ccd8' },
    rows: [
      '...WWW.WWW....',
      '..WWWWWWWWWV..',
      '.WWWWWWWWWWVV.',
      '.WWWWWWWWWWWV.',
      '..WWWWWWWWWV..',
      '..VVVVVVVVVV..',
      '..WWWWWWWWWW..',
      '..VVVVVVVVVV..',
    ],
  },
  woodcutter: {
    ox: -1, oy: -3,
    map: { R: '#c43a2a', r: '#8a2420', Q: '#e86a50' },
    rows: [
      '.....QQQ......',
      '...QQRRRRR....',
      '..QRRRRRRRRR..',
      '.QRRRRRRRRRRR.',
      '.rrrrrrrrrrrrr',
      '.QRQRQRQRQRQRr',
    ],
  },
  bard: {
    ox: -1, oy: -6,
    map: { f: '#f8f0d0', t: '#c8b890', F: '#6ac87a', G: '#3a9a5a', g: '#246a3e' },
    rows: [
      'f.............',
      '.ft...........',
      '..ftFFFF......',
      '...tFGGGGGG...',
      '..FGGGGGGGGGG.',
      '.FGGGGGGGGGGGg',
      '.gggggggggggg.',
    ],
  },
  carrier: {
    ox: -1, oy: -2,
    map: { K: '#d0508a', k: '#9a3066', X: '#f088b8', z: '#ffffff' },
    rows: [
      '....XXXXX.....',
      '..XXKKzKKK....',
      '.XKKKKKKKzKK..',
      '.KKzKKKKKKKKK.',
      'KKKKKKKKKKKkk.',
      'kKK...........',
      'kKk...........',
      '.kk...........',
    ],
  },
};

Object.assign(HATS, {
  mail: { ox: -1, oy: -3, map: { B: '#3a5a9a', b: '#22325a', Y: '#f0c040' }, rows: ['...BBBBBB.....', '..BBBBBBBB....', '.BBBBBYBBBB...', '.bbbbbbbbbbbbb'] },
  bandbeanie: { ox: -1, oy: -3, map: { R: '#2e2e38', r: '#1a1a22', Q: '#4a4a58' }, rows: HATS.woodcutter.rows },
  sunhat: {
    ox: -3, oy: -4, map: { P: '#f4e4c0', p: '#c8b48a', F: '#e06a8a' },
    rows: ['......PPPPP.......', '.....PPPPPPP......', '....FFFFFFFFF.....', 'PPPPPPPPPPPPPPPPPP', '.pppppppppppppppp.'],
  },
  beanie: { ox: -1, oy: -3, map: { R: '#3a8ac8', r: '#24609a', Q: '#6ab0f0' }, rows: HATS.woodcutter.rows },
  cap: { ox: -1, oy: -3, map: { C: '#3a9a5a', c: '#246a3e' }, rows: ['...CCCCCC.....', '..CCCCCCCC....', '.CCCCCCCCCC...', '.ccccccccccccc'] },
  // event crews
  flatcap: { ox: -1, oy: -2, map: { F: '#7a6a54', f: '#54483a', h: '#9a8a70' }, rows: ['..FhFFFFF.....', '.FFFFFFFFFF...', '.fffffffffffff'] },
  redcap: { ox: -1, oy: -2, map: { F: '#c83a3a', f: '#8a2626', h: '#e86a5a' }, rows: ['..FhFFFFF.....', '.FFFFFFFFFF...', '.fffffffffffff'] },
  bowler: { ox: -1, oy: -4, map: { B: '#3a2a20', b: '#22160e', h: '#5e4634', r: '#7a2a2a' }, rows: ['....BBBBB.....', '...BhBBBBB....', '...BBBBBBB....', '...rrrrrrr....', '.bbbbbbbbbbb..'] },
  beret: { ox: -1, oy: -3, map: { R: '#c83a3a', r: '#8a2626', h: '#e86a5a' }, rows: ['.....R........', '..RhRRRRRR....', '.RRRRRRRRRRR..', '..rrrrrrrrr...'] },
  beret2: { ox: -1, oy: -3, map: { R: '#2a3a6a', r: '#1a2444', h: '#4a5a9a' }, rows: ['.....R........', '..RhRRRRRR....', '.RRRRRRRRRRR..', '..rrrrrrrrr...'] },
  workcap: { ox: -1, oy: -3, map: { C: '#e07a2a', c: '#a8541a', h: '#f8a050' }, rows: ['...ChCCCC.....', '..CCCCCCCC....', '.CCCCCCCCCC...', '.ccccccccccccc'] },
  tophat: { ox: 0, oy: -7, map: { T: '#26222e', t: '#16121c', h: '#4a4656', R: '#c83a3a' }, rows: ['...ThTTTT...', '...ThTTTT...', '...TTTTTT...', '...TTTTTT...', '...RRRRRR...', '.tttttttttt.'] },
});

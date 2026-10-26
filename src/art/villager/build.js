// Assembles a villager sprite for a pose and frame (and riders on the bicycle).
import { SHOE } from '../palette.js';
import { ANIM, KEYS, POSE_TOOL, SIT_POSES } from './anim.js';
import { drawLegs, drawPack, drawSkirt, drawTorso, limb } from './body.js';
import { AX, FY, SH, SW } from './frame.js';
import { drawHead } from './head.js';
import { drawCarry, drawHafted, drawInstrument, drawTool } from './tools.js';
import { INSTRUMENTS } from '../../content/band.js';
import { ramp, skinRamp } from '../../core/color.js';
import { P, disc, line, mk, outline } from '../../core/pixels.js';

export function buildVillager(v, pose, frame, carry, gear) {
  if (pose === 'ride') return buildRider(v, frame, carry);
  const c = mk(SW, SH), g = c.getContext('2d');
  const L = v.look;
  const skin = skinRamp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  const child = v.small, legLen = child ? 4 : 6, torsoH = child ? 7 : 9;
  const sit = SIT_POSES.has(pose);
  let back = child ? [-1, 5] : [-1, 6], front = child ? [1, 5] : [1, 6], tool = null, bob = 0, dir = null;
  let legs = [0, 0, 0, 0];
  if (pose === 'walk' || pose === 'pull' || pose === 'push') {
    const ph = (frame / 6) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
    const fo = Math.round(3 * cs);
    legs = [-fo, sn < -0.6 ? 1 : 0, fo, sn > 0.6 ? 1 : 0];
    bob = -Math.round(Math.abs(sn));
    front = [1 - Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
    back = [-1 + Math.round(2.5 * cs), 6 - (Math.abs(cs) > 0.7 ? 1 : 0)];
    if (pose === 'pull') { front = [-6, 4]; back = [-7, 4]; } // hauling a cart behind
    if (pose === 'push') { front = [6, 4]; back = [5, 4]; } // pushing a barrow ahead
  } else if (ANIM[pose]) {
    const k = KEYS[ANIM[pose][0]][frame] || KEYS[ANIM[pose][0]][0];
    if (k.f) front = k.f;
    if (k.b) back = k.b;
    bob = k.bob || 0; dir = k.dir;
  }
  if (child) { front = [front[0], Math.min(front[1], 5)]; back = [back[0], Math.min(back[1], 5)]; }
  const tb = (sit ? FY - 5 : FY - legLen) + bob;
  const tt = tb - torsoH + 1, hy = tt - 12;
  const sb = [AX - 3, tt + 2], sf = [AX + 3, tt + 2];
  switch (pose) {
    case 'farm': case 'chop': case 'sign': tool = pose === 'farm' ? 'hoe' : pose === 'chop' ? 'axe' : 'hammer'; break;
    case 'cook': tool = 'ladle'; break;
    case 'eat': tool = frame === 2 ? 'spoon' : 'bowl'; break;
    case 'watch': tool = 'popcorn'; break;
    case 'lute': case 'lutesit': tool = 'lute'; break;
    case 'sweep': tool = 'broom'; break;
    case 'fetch': tool = 'bucket'; break;
    case 'water': tool = 'pour'; break;
    case 'sip': tool = 'mug'; break;
    case 'serve': tool = frame === 1 || frame === 2 ? null : 'mug'; break;
    case 'handheld': tool = 'handheld' + (v.id % 2); break;
    case 'controller': tool = 'pad'; break;
    case 'band_drums': case 'band_bass': case 'band_guitar': tool = pose.slice(5); break;
    default: if (POSE_TOOL[pose]) tool = POSE_TOOL[pose](frame);
  }
  if (carry === 'log') { back = [-1, -3]; front = [2, -3]; }
  else if (carry === 'bucket' && pose !== 'water') { front = [1, 6]; tool = 'bucket'; }
  else if (carry === 'sign') { back = [4, 2]; front = [5, 1]; }
  else if (carry === 'package' || carry === 'crate') { back = [4, 3]; front = [6, 2]; }
  else if (carry === 'ladder') { back = [3, -3]; front = [5, -2]; }
  else if (carry === 'mail') front = [4, -1];
  const stick = gear && !tool && !carry && (pose === 'walk' || pose === 'idle');
  if (stick) front = [4, 3];
  const hb = [sb[0] + back[0], sb[1] + back[1]], hf = [sf[0] + front[0], sf[1] + front[1]];

  if (gear) drawPack(g, tt);
  limb(g, sb, hb, { m: shirt.d, l: shirt.m }, { m: skin.d, l: skin.m, d: skin.o }, false);
  if (carry === 'case') drawCarry(g, 'case', hb[0], hb[1], tt); // sample case swings from the far hand
  drawLegs(g, legs, sit, child, legLen, pants, skin, v.job === 'band' ? '#f0f0f0' : SHOE.d);
  if (!sit && tb < FY - legLen) P(g, AX - 4, tb + 1, 9, FY - legLen - tb, pants.m);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  if (v.job === 'carrier') drawSkirt(g, tb, pants, sit);
  if (L.outfit?.includes('smock') && !sit) { P(g, AX - 4, tb, 9, 2, shirt.m); P(g, AX - 4, tb, 1, 2, shirt.l); P(g, AX + 3, tb, 2, 2, shirt.d); P(g, AX - 4, tb + 1, 9, 1, shirt.d); }

  const eyes = drawHead(g, v, hy, skin, hair);
  if (v.job === 'mail' || L.outfit?.includes('satchel')) { line(g, AX + 2, tt, AX - 3, tb - 3, '#5a3a20', 1); P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48'); }
  if (gear) line(g, AX - 3, tt + 1, AX + 1, tt + 5, '#4a2a18', 1);

  limb(g, sf, hf, shirt, skin, true);
  if (tool === 'hoe' || tool === 'axe' || tool === 'hammer') drawHafted(g, tool, hf, dir || [0.8, 0.6]);
  else if (INSTRUMENTS.includes(tool)) drawInstrument(g, v, tool, hf, hb, tt, skin);
  else if (tool) drawTool(g, tool, hf[0], hf[1], frame, tt, tb);
  if (carry && carry !== 'bucket' && carry !== 'case') drawCarry(g, carry, hf[0], hf[1], tt);
  if (stick) {
    line(g, hf[0] + 1, hf[1] - 9, hf[0] + 2, FY, '#9a6a3a', 2);
    P(g, hf[0], hf[1] - 11, 3, 3, '#6a4020');
  }
  if (stick || (tool && !['popcorn', 'lute', 'bowl', 'spoon', 'mug', 'handheld0', 'handheld1', 'pad', 'balls', ...INSTRUMENTS].includes(tool))) {
    P(g, hf[0] - 1, hf[1] - 1, 3, 3, skin.m); P(g, hf[0] - 1, hf[1] - 1, 1, 1, skin.l);
  }
  outline(c);
  return { cv: c, eyes, top: hy - 6 };
}

// The mail carrier pedalling a red bicycle.
export function drawBike(g, frame, cx, by) {
  const fr = ramp('#c83a3a');
  for (const wx of [cx - 8, cx + 8]) {
    disc(g, wx, by - 4, 4, '#2a2a30');
    g.clearRect(wx - 2, by - 6, 5, 5);
    const a = (frame / 4) * Math.PI;
    P(g, wx + Math.round(Math.cos(a) * 2), by - 4 + Math.round(Math.sin(a) * 2), 1, 1, '#9aa0aa');
    P(g, wx - Math.round(Math.cos(a) * 2), by - 4 - Math.round(Math.sin(a) * 2), 1, 1, '#9aa0aa');
    P(g, wx, by - 4, 1, 1, '#c8ccd4');
  }
  line(g, cx - 8, by - 4, cx - 2, by - 10, fr.m, 1); line(g, cx - 2, by - 10, cx + 1, by - 4, fr.m, 1);
  line(g, cx - 8, by - 4, cx + 1, by - 4, fr.d, 1); line(g, cx + 1, by - 4, cx + 6, by - 11, fr.m, 1);
  line(g, cx - 2, by - 10, cx + 6, by - 11, fr.l, 1); line(g, cx + 6, by - 11, cx + 8, by - 4, fr.m, 1);
  P(g, cx - 4, by - 11, 4, 1, '#3a2a20'); P(g, cx + 5, by - 13, 1, 3, '#3a3a46'); P(g, cx + 4, by - 13, 3, 1, '#3a3a46');
  P(g, cx + 6, by - 8, 4, 3, '#8a5a30');
}

export function makeParkedBike() {
  const c = mk(26, 18), g = c.getContext('2d');
  drawBike(g, 0, 13, 16);
  outline(c);
  return { cv: c, ax: 13, by: 16 };
}

export function buildRider(v, frame, carry) {
  const c = mk(SW, SH), g = c.getContext('2d'), L = v.look;
  const skin = skinRamp(L.skin), hair = ramp(L.hair), shirt = ramp(L.shirt), pants = ramp(L.pants);
  drawBike(g, frame, AX, FY);
  const tb = FY - 10, tt = tb - 8, hy = tt - 12;
  const a = (frame / 4) * Math.PI * 2, pedal = [AX + 1 + Math.round(Math.cos(a) * 3), FY - 4 + Math.round(Math.sin(a) * 3)];
  const pedal2 = [AX + 1 - Math.round(Math.cos(a) * 3), FY - 4 - Math.round(Math.sin(a) * 3)];
  limb(g, [AX - 2, tb], pedal2, { m: pants.d, l: pants.d }, { m: SHOE.d, l: SHOE.m, d: SHOE.o }, false);
  drawTorso(g, v, tt, tb, shirt, pants, skin);
  const eyes = drawHead(g, v, hy, skin, hair);
  limb(g, [AX - 1, tb], pedal, { m: pants.m, l: pants.l }, { m: SHOE.m, l: SHOE.l, d: SHOE.d }, true);
  limb(g, [AX + 3, tt + 2], [AX + 6, FY - 13], shirt, skin, true);
  P(g, AX - 7, tb - 4, 5, 4, '#8a5a30'); P(g, AX - 7, tb - 4, 5, 1, '#a87a48');
  if (carry === 'package') { P(g, AX + 6, FY - 11, 5, 4, '#c8a068'); P(g, AX + 8, FY - 11, 1, 4, '#e8d8a0'); }
  outline(c);
  return { cv: c, eyes, top: hy - 6 };
}

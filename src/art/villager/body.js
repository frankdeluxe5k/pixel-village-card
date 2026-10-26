// Villager bodies: limbs, legs, torsos, outfits.
import { SHOE } from '../palette.js';
import { AX, FY } from './frame.js';
import { mixHex, ramp } from '../../core/color.js';
import { OUT } from '../../core/constants.js';
import { P } from '../../core/pixels.js';

// Garment pieces for crew looks, drawn over the plain shirt. Returns false when the piece replaces the belt.
export function drawOutfit(g, L, x0, tt, tb, w, h, shirt, skin) {
  let belt = true;
  for (const piece of L.outfit) {
    switch (piece) {
      case 'waistcoat': {
        const vs = ramp(L.vest);
        P(g, x0, tt + 2, 3, h - 3, vs.m); P(g, x0 + 6, tt + 2, 3, h - 3, vs.d); P(g, x0, tt + 2, 1, h - 3, vs.l);
        P(g, x0 + 2, tt + 1, 1, 1, vs.m); P(g, x0 + 6, tt + 1, 1, 1, vs.d);
        for (let r = tt + 3; r < tb - 1; r += 2) P(g, x0 + 2, r, 1, 1, '#e8c050');
        break;
      }
      case 'suit': {
        // jacket is the shirt colour; white shirt and tie in the open V, lapels and buttons
        P(g, x0 + 3, tt, 3, 3, '#f4f0e6'); P(g, x0 + 4, tt + 3, 1, 1, '#f4f0e6');
        P(g, x0 + 4, tt + 1, 1, 4, L.tie); P(g, x0 + 4, tt + 5, 1, 1, ramp(L.tie).d);
        P(g, x0 + 2, tt, 1, 4, shirt.d); P(g, x0 + 6, tt, 1, 4, shirt.d);
        P(g, x0 + 5, tt + 6, 1, 1, '#e8c050'); P(g, x0 + 1, tt + 3, 2, 1, '#f4f0e6');
        belt = false;
        break;
      }
      case 'tailcoat': {
        P(g, x0 + 3, tt, 3, h - 2, '#f4f0e6'); P(g, x0 + 3, tt + 1, 3, 1, '#1a1a22'); P(g, x0 + 4, tt + 1, 1, 1, '#3a3a46');
        for (let r = tt + 3; r < tb - 1; r += 2) { P(g, x0 + 2, r, 1, 1, '#e8c050'); P(g, x0 + 6, r, 1, 1, '#e8c050'); }
        P(g, x0 - 1, tb - 2, 2, 4, shirt.d); // coat tails
        belt = false;
        break;
      }
      case 'smock': {
        P(g, x0 + 2, tt + 4, 3, 2, shirt.d); // pocket
        const dots = [['#e04848', 1, 3], ['#3a8ae0', 6, 2], ['#f0c030', 4, 6], ['#3aa86a', 2, 7]];
        for (const [c, dx, dy] of dots) if (dy < h - 1) P(g, x0 + dx, tt + dy, 1, 1, c);
        belt = false;
        break;
      }
      case 'overalls': {
        const ov = ramp(L.pants);
        P(g, x0 + 2, tt + 2, 5, h - 2, ov.m); P(g, x0 + 6, tt + 2, 1, h - 2, ov.d);
        P(g, x0, tt + 5, w, h - 5, ov.m); P(g, x0, tt + 5, 1, h - 5, ov.l); P(g, x0 + w - 1, tt + 5, 1, h - 5, ov.d);
        P(g, x0 + 2, tt, 1, 2, ov.d); P(g, x0 + 6, tt, 1, 2, ov.d);
        P(g, x0 + 2, tt + 2, 1, 1, '#d8d8e0'); P(g, x0 + 6, tt + 2, 1, 1, '#d8d8e0');
        P(g, x0 + 3, tt + 3, 3, 2, ov.l);
        belt = false;
        break;
      }
      case 'stripes': {
        const st = ramp(L.stripe);
        for (let r = 1; r < h - 1; r += 2) { P(g, x0, tt + r, w, 1, st.m); P(g, x0 + w - 2, tt + r, 2, 1, st.d); }
        break;
      }
      case 'suspenders':
        P(g, x0 + 2, tt, 1, h - 1, '#3a2a24'); P(g, x0 + 6, tt, 1, h - 1, '#3a2a24');
        break;
    }
  }
  return belt;
}

export function limb(g, [x0, y0], [x1, y1], sl, sk, outlined) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
  if (outlined) {
    for (let i = 2; i < pts.length; i++) {
      const [x, y] = pts[i];
      P(g, x - 2, y - 1, 5, 3, OUT); P(g, x - 1, y - 2, 3, 5, OUT);
    }
  }
  pts.forEach(([x, y], i) => P(g, x - 1, y - 1, 3, 3, i / n < 0.55 ? sl.m : sk.m));
  pts.forEach(([x, y], i) => { if (i / n < 0.55) P(g, x - 1, y - 1, 1, 1, sl.l); });
  const cuff = pts[Math.max(0, Math.floor(n * 0.55) - 1)];
  if (n > 3) P(g, cuff[0] - 1, cuff[1] - 1, 3, 1, sl.d || sl.m);
  P(g, x1 - 1, y1 - 1, 3, 3, sk.m);
  P(g, x1 - 1, y1 - 1, 1, 1, sk.l);
  P(g, x1 + 1, y1 + 1, 1, 1, sk.d);
}

export function drawLegs(g, o, sit, child, legLen, pants, skin, sole = SHOE.d) {
  if (sit) {
    const ty = FY - 4;
    P(g, AX - 3, ty - 1, 8, 2, pants.d);
    P(g, AX - 2, ty, 9, 2, pants.m); P(g, AX - 2, ty, 9, 1, pants.l);
    P(g, AX + 4, ty + 1, 3, 2, child ? skin.m : pants.m);
    P(g, AX + 4, FY - 1, 5, 2, SHOE.m); P(g, AX + 4, FY, 5, 1, sole); P(g, AX + 7, FY - 1, 1, 1, SHOE.l);
    return;
  }
  const top = FY - legLen + 1;
  const leg = (cx, off, lift, col, hl) => {
    const x = cx + off, rows = legLen - 3 - lift;
    P(g, cx + Math.round(off / 2) - 1, top, 3, 1, col);
    P(g, x - 1, top + 1, 3, rows, child ? skin.m : col);
    if (hl && !child) P(g, x - 1, top + 1, 1, rows, hl);
    if (!child && rows > 2) P(g, x, top + 2, 1, 1, pants.o);
    P(g, x - 1, FY - 1 - lift, 4, 2, SHOE.m);
    P(g, x, FY - 1 - lift, 1, 1, SHOE.h);
    P(g, x - 1, FY - lift, 4, 1, sole);
    P(g, x + 1, FY - 1 - lift, 2, 1, SHOE.l);
  };
  leg(AX - 2, o[0], o[1], pants.d, null);
  leg(AX + 2, o[2], o[3], pants.m, pants.l);
}

export function drawTorso(g, v, tt, tb, shirt, pants, skin) {
  const x0 = AX - 4, w = 9, h = tb - tt + 1;
  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w; c++) {
      if (r === 0 && (c === 0 || c === w - 1)) continue;
      let col = c <= 1 ? shirt.l : c >= w - 2 ? shirt.d : shirt.m;
      if (r === 0) col = shirt.l;
      P(g, x0 + c, tt + r, 1, 1, col);
    }
  }
  P(g, x0 + 3, tt + 4, 2, 1, shirt.d); P(g, x0 + 5, tt + 6, 2, 1, shirt.d); P(g, x0 + 2, tt + 1, 1, 2, shirt.d);
  P(g, x0 + 2, tt, 2, 1, shirt.h); P(g, x0 + 5, tt, 2, 1, shirt.h); P(g, x0 + 4, tt, 1, 1, skin.d);
  P(g, x0, tb, w, 1, pants.m);
  let belt = true;
  switch (v.job) {
    case 'farmer': {
      const ov = ramp(v.look.pants);
      P(g, x0 + 2, tt + 2, 5, h - 2, ov.m); P(g, x0 + 6, tt + 2, 1, h - 2, ov.d);
      P(g, x0, tt + 5, w, h - 5, ov.m); P(g, x0, tt + 5, 1, h - 5, ov.l); P(g, x0 + w - 1, tt + 5, 1, h - 5, ov.d);
      P(g, x0 + 2, tt, 1, 2, ov.d); P(g, x0 + 6, tt, 1, 2, ov.d);
      P(g, x0 + 2, tt + 2, 1, 1, '#f0d060'); P(g, x0 + 6, tt + 2, 1, 1, '#f0d060');
      P(g, x0 + 3, tt + 3, 3, 2, ov.l); P(g, x0 + 3, tt + 4, 3, 1, ov.d);
      belt = false;
      break;
    }
    case 'cook': {
      const ap = ramp('#f4f2ec');
      P(g, x0 + 1, tt + 2, 7, h - 2, ap.m); P(g, x0 + 7, tt + 2, 1, h - 2, ap.d);
      P(g, x0 + 3, tt + 4, 1, h - 4, ap.d); P(g, x0 + 5, tt + 5, 1, h - 5, ap.d);
      P(g, x0 + 3, tt, 3, 2, '#d04040'); P(g, x0 + 4, tt + 2, 1, 1, '#a02828');
      belt = false;
      break;
    }
    case 'woodcutter':
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w; c++) {
          if (r === 0 && (c === 0 || c === w - 1)) continue;
          if ((c + 1) % 4 === 0 || (r + 2) % 4 === 0) P(g, x0 + c, tt + r, 1, 1, c >= w - 2 ? shirt.o : mixHex(shirt.d, '#1a1010', 0.45));
        }
      }
      P(g, x0 + 2, tt, 1, h - 1, '#5a3a20'); P(g, x0 + 6, tt, 1, h - 1, '#5a3a20');
      break;
    case 'bard':
      P(g, x0 + 3, tt, 3, 1, skin.m); P(g, x0 + 4, tt + 1, 1, 1, skin.m);
      for (let r = 1; r < h - 2; r++) P(g, x0 + r - 1, tt + r, 2, 1, r % 2 ? '#e8c050' : '#c89a30');
      break;
    case 'carrier': {
      P(g, x0 + 2, tt, 5, 1, '#ffffff');
      const vest = ramp('#6a3a2a');
      P(g, x0 + 2, tt + 3, 5, h - 4, vest.m); P(g, x0 + 2, tt + 3, 1, h - 4, vest.l);
      for (let r = tt + 3; r < tb - 1; r += 2) P(g, x0 + 4, r, 1, 1, '#f0e0c0');
      belt = false;
      break;
    }
    case 'band': {
      const top = v.look.top, tee = '#2e2e38';
      if (top === 'stripes') for (let r = 1; r < h - 1; r += 2) P(g, x0, tt + r, w, 1, r === 1 ? '#3a3a46' : '#24242c');
      if (top === 'flannel') {
        for (let r = 0; r < h - 1; r++) for (let c = 0; c < w; c++) if ((c + 1) % 3 === 0 || (r + 1) % 3 === 0) P(g, x0 + c, tt + r, 1, 1, mixHex(shirt.d, '#1a1010', 0.5));
        P(g, x0 + 3, tt, 3, h - 1, tee); P(g, x0 + 3, tt, 1, h - 1, '#44444f');
      }
      if (top === 'print') { P(g, x0 + 3, tt + 2, 3, 2, '#e8e8e8'); P(g, x0 + 3, tt + 4, 1, 1, '#e8e8e8'); P(g, x0 + 5, tt + 4, 1, 1, '#e8e8e8'); P(g, x0 + 4, tt + 3, 1, 1, tee); }
      if (top === 'tee') { P(g, x0 + 2, tt + 3, 5, 2, '#f0e050'); P(g, x0 + 3, tt + 3, 1, 1, '#2a2a30'); P(g, x0 + 5, tt + 4, 1, 1, '#2a2a30'); }
      P(g, x0, tb - 1, w, 1, '#1a1a20');
      for (let c = 1; c < w; c += 2) P(g, x0 + c, tb - 1, 1, 1, '#c8ccd8');
      belt = false;
      break;
    }
    case 'mail':
      P(g, x0 + 6, tt + 2, 2, 2, '#e8c050'); P(g, x0 + 3, tt, 3, 1, '#ffffff');
      break;
    case 'child':
      P(g, x0, tt + 3, w, 1, shirt.h);
      belt = false;
      break;
    default:
      if (v.look.outfit) belt = drawOutfit(g, v.look, x0, tt, tb, w, h, shirt, skin);
  }
  if (belt) { P(g, x0, tb - 1, w, 1, '#3a2418'); P(g, x0 + 5, tb - 1, 2, 1, '#e0b040'); }
}

export function drawSkirt(g, tb, pants, sit) {
  if (sit) {
    P(g, AX - 4, tb - 1, 12, 4, pants.m); P(g, AX - 4, tb - 1, 12, 1, pants.l); P(g, AX + 7, tb, 1, 3, pants.d);
    return;
  }
  P(g, AX - 5, tb - 1, 11, 2, pants.m);
  P(g, AX - 6, tb + 1, 13, 3, pants.m);
  P(g, AX - 6, tb + 1, 1, 3, pants.l);
  for (const x of [AX - 3, AX + 1, AX + 4]) P(g, x, tb + 1, 1, 3, pants.d);
  P(g, AX - 6, tb + 3, 13, 1, pants.d);
}

export function drawPack(g, tt) {
  const pk = ramp('#8a5a30'), br = ramp('#c84a3a');
  P(g, AX - 10, tt - 1, 7, 11, pk.m); P(g, AX - 10, tt - 1, 1, 11, pk.l); P(g, AX - 4, tt - 1, 1, 11, pk.d);
  P(g, AX - 10, tt, 7, 3, pk.d); P(g, AX - 8, tt + 2, 2, 2, '#e0c060');
  P(g, AX - 10, tt + 6, 7, 1, pk.o);
  P(g, AX - 11, tt - 5, 9, 4, br.m); P(g, AX - 11, tt - 5, 9, 1, br.l); P(g, AX - 11, tt - 2, 9, 1, br.d);
  P(g, AX - 11, tt - 5, 1, 4, br.h); P(g, AX - 3, tt - 5, 1, 4, br.d); P(g, AX - 8, tt - 5, 1, 4, '#4a2a18');
}

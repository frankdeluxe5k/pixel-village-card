// Outfits for event crews and visitors (drawn by drawOutfit).

// Event crew looks: each role builds a look from the guest RNG. `outfit` lists garment pieces drawn by
// drawOutfit, so a new role is mostly data. `face` overrides any of faceOf's traits.
export const CREW_LOOKS = {
  merchant: (p, rnd) => ({ shirt: '#ece0c4', pants: '#5a4a3a', vest: p(['#2f6a4a', '#7a2a3a', '#3a4a7a']), outfit: ['waistcoat', 'satchel'], hat: 'flatcap', style: 'short', beard: rnd() < 0.5 }),
  salesman: (p) => ({ shirt: '#7a5434', pants: '#6a4a2e', tie: p(['#b83030', '#2a5a9a', '#3a7a3a']), outfit: ['suit'], hat: 'bowler', style: 'short', face: { mouth: 'grin', glasses: false } }),
  artist: (p, rnd, i) => ({
    shirt: ['#e8b8c8', '#b8d8e8', '#e8e0a8'][i % 3], pants: p(['#3a4a6a', '#5a3a5a', '#4a4a3a']), outfit: ['smock'],
    hat: ['beret', 'beret2', null][i % 3], style: ['long', 'messy', 'swoop'][i % 3], beard: i === 1 && rnd() < 0.6,
  }),
  landscaper: (p, rnd) => ({ shirt: p(['#e8d8b0', '#c8d8e8', '#e8e8e0']), pants: '#3a6a3a', outfit: ['overalls'], hat: 'workcap', style: 'short', beard: rnd() < 0.3 }),
  ringmaster: () => ({ shirt: '#c03030', pants: '#2a2a34', outfit: ['tailcoat'], hat: 'tophat', style: 'short', face: { stache: true, mouth: 'grin' } }),
  fairfolk: (p, rnd, i) => ({ shirt: '#f4f0e6', pants: p(['#3a3a6a', '#4a3a2a']), stripe: ['#d03a3a', '#3a6ad0', '#2a8a5a'][i % 3], outfit: ['stripes', 'suspenders'], hat: i % 2 ? 'redcap' : null, style: p(['short', 'long', 'messy']) }),
};

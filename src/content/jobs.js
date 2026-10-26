// Resident jobs and their outfits.

export const JOBS = ['farmer', 'cook', 'woodcutter', 'carrier', 'bard', 'child', 'farmer', 'woodcutter', 'carrier', 'child'];

export const LOOKS = {
  skin: ['#f8d0a8', '#eab48a', '#c88a60', '#9a623e', '#6e442a'],
  hair: ['#3a2418', '#6a3a1c', '#c89038', '#26222e', '#a8381c', '#d8d0c8', '#e8c060'],
  // per-job outfit colours: [shirt, pants]
  outfit: {
    farmer: [['#ece2c8', '#4a72b8'], ['#e8d0b0', '#3a8a6a']],
    cook: [['#5a86c8', '#4a3a30'], ['#c86a4a', '#3a3a48']],
    woodcutter: [['#c43a2a', '#4a4036'], ['#3a7ac4', '#4a4036']],
    carrier: [['#e8a838', '#8a3a6a'], ['#58b0a0', '#6a3a8a']],
    bard: [['#3a9a5a', '#5a3a6a'], ['#9a4ac0', '#3a4a6a']],
    child: [['#e86a3a', '#3a5a9a'], ['#30a8a8', '#8a5a3a']],
  },
};

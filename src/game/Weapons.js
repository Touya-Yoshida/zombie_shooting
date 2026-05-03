import { CONFIG } from '../config.js';

export const WEAPONS = {
  pistol: { ...CONFIG.WEAPONS.PISTOL, key: 'pistol' },
  rifle: { ...CONFIG.WEAPONS.RIFLE, key: 'rifle' }
};

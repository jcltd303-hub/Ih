import { SKIN_PRICES } from '../../network/LoadoutManager';

export type ArmorySkinDef = {
  id: string;
  name: string;
  desc: string;
  badge: string;
  color: string;
  border: string;
};

export const ARMORY_SKINS: ArmorySkinDef[] = [
  {
    id: 'plasma_neon',
    name: 'Plasma Neon Railgun',
    desc: 'Dual magnetic accelerator rails • Cyan/magenta ion plume • Lightning arc charging',
    badge: '⚡ RAILGUN',
    color: '#00f0ff',
    border: 'rgba(0, 240, 255, 0.4)'
  },
  {
    id: 'abyssal_dread',
    name: 'Abyssal Dread Juggernaut',
    desc: 'Spiked iron fortress dome • Rotary Gatling shroud • Incandescent crimson rocket',
    badge: '🩸 GATLING',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.4)'
  },
  {
    id: 'cyber_gold',
    name: 'Cyber Gold Sunstone',
    desc: 'Antique bronze filigree • Faceted topaz gem lens • Searing solar lance ray',
    badge: '☀️ SOLAR',
    color: '#fbbf24',
    border: 'rgba(251, 191, 36, 0.4)'
  },
  {
    id: 'default',
    name: 'Tactical Navy Dual-Cannon',
    desc: 'Titanium naval armor • Twin plasma bores • Dual high-energy plasma bolts',
    badge: '⚓ NAVAL',
    color: '#60a5fa',
    border: 'rgba(96, 165, 250, 0.4)'
  }
];

export function skinUnlockLabel(skinId: string, unlocked: boolean, equipped: boolean): string {
  if (equipped) return '✓ EQUIPPED';
  if (unlocked) return 'EQUIP';
  const price = SKIN_PRICES[skinId] ?? 0;
  return `UNLOCK ${price} SC`;
}

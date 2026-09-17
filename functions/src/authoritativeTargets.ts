import { createHmac } from 'node:crypto';

export type AuthoritativeTarget = {
  targetId: string;
  fishType: 'small' | 'medium' | 'boss';
  maxHealth: number;
};

export type SessionStatus = 'active' | 'closed' | 'revealed';

export function getAuthoritativeTarget(serverSeed: string, targetId: string): AuthoritativeTarget {
  if (!serverSeed || !targetId) throw new Error('Missing authoritative target inputs.');
  const digest = createHmac('sha256', serverSeed).update(targetId).digest();
  const roll = digest.readUInt32BE(0) / 0x100000000;
  const fishType = roll < 0.70 ? 'small' : roll < 0.98 ? 'medium' : 'boss';
  return { targetId, fishType, maxHealth: fishType === 'boss' ? 28 : fishType === 'medium' ? 6 : 2 };
}

export function canAcceptShot(status: SessionStatus): boolean {
  return status === 'active';
}

export function canRevealSeed(status: SessionStatus): boolean {
  return status === 'closed' || status === 'revealed';
}

export function getEntitledSkinBonus(loadout: { skinBonus?: unknown } | undefined): number {
  const raw = Number(loadout?.skinBonus);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3) : 1;
}

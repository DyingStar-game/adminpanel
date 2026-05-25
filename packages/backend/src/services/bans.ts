/**
 * In-memory ban list for admin moderation (not persisted across restarts).
 */
import type { BanRecord } from '@dyingstar/shared';
import { randomUUID } from 'crypto';

const bans: BanRecord[] = [];

/**
 * Returns a copy of all active bans.
 * @returns Current ban records.
 */
export function listBans(): BanRecord[] {
  return [...bans];
}

/**
 * Adds a new ban with generated id and timestamp.
 * @param data - Ban fields excluding id and bannedAt.
 * @returns Created ban record.
 */
export function createBan(data: Omit<BanRecord, 'id' | 'bannedAt'>): BanRecord {
  const ban: BanRecord = {
    ...data,
    id: randomUUID(),
    bannedAt: new Date().toISOString(),
  };
  bans.push(ban);
  return ban;
}

/**
 * Removes a ban by id.
 * @param id - Ban id.
 * @returns True if a ban was removed.
 */
export function removeBan(id: string): boolean {
  const idx = bans.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  bans.splice(idx, 1);
  return true;
}

/**
 * Returns bans sorted by bannedAt descending (newest first).
 * @returns Ban history copy.
 */
export function getBanHistory(): BanRecord[] {
  return [...bans].sort((a, b) => b.bannedAt.localeCompare(a.bannedAt));
}

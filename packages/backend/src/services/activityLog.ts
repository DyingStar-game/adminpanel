/**
 * Ring buffer of recent admin actions for the activity log API.
 */
import type { ActivityLogEntry } from '@dyingstar/shared';
import { randomUUID } from 'crypto';

const MAX_ENTRIES = 200;
const entries: ActivityLogEntry[] = [];

/**
 * Prepends an activity entry and trims the log to {@link MAX_ENTRIES}.
 * @param action - Action type identifier.
 * @param actor - Who performed the action (default `admin`).
 * @param details - Optional human-readable detail.
 * @param serverId - Optional related server id.
 */
export function logActivity(
  action: string,
  actor = 'admin',
  details?: string,
  serverId?: string,
): void {
  entries.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    actor,
    details,
    serverId,
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

/**
 * Returns a copy of all activity log entries (newest first).
 * @returns Activity log entries.
 */
export function getActivityLog(): ActivityLogEntry[] {
  return [...entries];
}

/**
 * Clears all in-memory activity log entries.
 */
export function clearActivityLog(): void {
  entries.length = 0;
}

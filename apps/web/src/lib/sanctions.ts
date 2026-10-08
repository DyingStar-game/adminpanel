import type { Sanction, SanctionType } from '@dyingstar-admin/contracts/social';

const SEVERITY: SanctionType[] = ['warning', 'mute', 'suspension', 'ban'];

/** Sanctions in force at `now`: not lifted, not expired; the most severe first. */
export function activeSanctions(sanctions: Sanction[], now = Date.now()): Sanction[] {
  return sanctions
    .filter((s) => !s.revokedAt && (!s.expiresAt || Date.parse(s.expiresAt) > now))
    .sort((a, b) => SEVERITY.indexOf(b.type) - SEVERITY.indexOf(a.type));
}

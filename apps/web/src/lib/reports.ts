import type { EscalationLevel } from '@dyingstar-admin/contracts/social';

const LEVELS: EscalationLevel[] = ['moderator', 'admin', 'supervisor'];

/** The level a report escalates to, or null at the top (`social` refuses there). */
export function nextEscalation(level: EscalationLevel): EscalationLevel | null {
  return LEVELS[LEVELS.indexOf(level) + 1] ?? null;
}

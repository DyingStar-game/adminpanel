import { z } from 'zod';
import { zRole } from '@dyingstar-admin/contracts/npc';

/** Tabs of the NPCs section (ADR 0026). */
export const NPCS_TABS = ['roster', 'routines', 'activity', 'villages'] as const;
export type NpcsTab = (typeof NPCS_TABS)[number];

/** Tabs of an NPC's page. */
export const NPC_TABS = ['overview', 'routine', 'tasks', 'logs', 'events', 'config'] as const;
export type NpcTab = (typeof NPC_TABS)[number];

/** Rows of a roster page. */
export const NPC_PAGE_SIZE = 50;

const flag = z.enum(['true', 'false']).optional().catch(undefined);
const text = (max: number) => z.string().trim().max(max).optional().catch(undefined);

/**
 * NPCs section state carried by the URL (ADR 0024, 0026), so every view is shareable: the tab;
 * the roster's filters (village, role, enabled, connected, name or login) and page; the pattern
 * open in the routines editor (`new` for a new one); the event kind of the activity feed.
 */
export const NpcsSearchSchema = z.object({
  tab: z.enum(NPCS_TABS).catch('roster').default('roster'),
  q: text(64),
  village: text(16),
  role: zRole.optional().catch(undefined),
  enabled: flag,
  online: flag,
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pattern: z
    .string()
    .regex(/^[a-z0-9_]{1,64}$/)
    .optional()
    .catch(undefined),
  kind: text(64),
});
export type NpcsSearch = z.infer<typeof NpcsSearchSchema>;

/** An NPC's page state: its tab. */
export const NpcSearchSchema = z.object({
  tab: z.enum(NPC_TABS).catch('overview').default('overview'),
});
export type NpcSearch = z.infer<typeof NpcSearchSchema>;

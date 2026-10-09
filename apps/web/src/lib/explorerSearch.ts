import { z } from 'zod';
import type { Item } from '@dyingstar-admin/schemas';

/**
 * Explorer state carried by the URL, so every view is shareable (ADR 0010):
 * listed level (`parent`, `''` = roots), type filter, scope, page and selected item.
 */
export const ExplorerSearchSchema = z.object({
  parent: z.string().catch('').default(''),
  type: z.string().min(1).optional().catch(undefined),
  scope: z.enum(['level', 'type']).catch('level').default('level'),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  selected: z.string().min(1).optional().catch(undefined),
});

export type ExplorerSearch = z.infer<typeof ExplorerSearchSchema>;

/** Explorer state showing an item inside its own level. */
export const searchForItem = (item: Item): ExplorerSearch => ({
  parent: item.object_data.parent_id ?? '',
  type: item.object_type,
  scope: 'level',
  page: 1,
  selected: item.object_uuid,
});

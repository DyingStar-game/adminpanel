import { z } from 'zod';
import { DiscoveryStatusSchema } from '@dyingstar-admin/schemas';

/** The statuses the review page filters on: names to review first, then the decided ones. */
export const PLACE_NAME_STATUSES = ['pending', 'approved', 'refused'] as const;

/** Names to review page state carried by the URL (ADR 0032): status, kind of place, page. */
export const PlaceNamesSearchSchema = z.object({
  status: DiscoveryStatusSchema.extract(PLACE_NAME_STATUSES).catch('pending').default('pending'),
  kind: z.string().trim().min(1).max(64).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type PlaceNamesSearch = z.infer<typeof PlaceNamesSearchSchema>;

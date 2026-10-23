import { z } from 'zod';
import { zMissionCategory, zMissionKind, zMissionStatus } from '@dyingstar-admin/contracts/mission';

/** The categories `mission` accepts, offered as a filter (older rows may carry others). */
export const MISSION_CATEGORIES = zMissionCategory.options;

/** Rows per page of the mission catalogue (`mission` allows up to 100). */
export const MISSIONS_PAGE_SIZE = 20;

/** Missions page state carried by the URL (ADR 0024): status, category, origin, page. */
export const MissionsSearchSchema = z.object({
  status: zMissionStatus.optional().catch(undefined),
  category: zMissionCategory.optional().catch(undefined),
  kind: zMissionKind.optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type MissionsSearch = z.infer<typeof MissionsSearchSchema>;

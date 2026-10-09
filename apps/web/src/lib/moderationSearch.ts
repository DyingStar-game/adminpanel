import { z } from 'zod';
import { zEscalationLevel, zReportStatus } from '@dyingstar-admin/contracts/social';

/**
 * Moderation state carried by the URL (ADR 0024), so every view is shareable: tab, report
 * filters, page, the report opened, and whether ended sanctions are listed.
 */
export const ModerationSearchSchema = z.object({
  tab: z.enum(['overview', 'reports', 'sanctions']).catch('overview').default('overview'),
  status: zReportStatus.optional().catch(undefined),
  escalation: zEscalationLevel.optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  report: z.coerce.number().int().min(1).optional().catch(undefined),
  ended: z.boolean().catch(false).default(false),
});

export type ModerationSearch = z.infer<typeof ModerationSearchSchema>;

/** Rows per page of the moderation lists (`social` allows up to 100). */
export const MODERATION_PAGE_SIZE = 20;

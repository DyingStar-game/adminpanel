import { z } from 'zod';
import { zPoliticalEntityType } from '@dyingstar-admin/contracts/social';

const page = z.coerce.number().int().min(1).catch(1).default(1);

/** Organisations page state carried by the URL (ADR 0024): tab, name searched, level, page. */
export const OrganisationsSearchSchema = z.object({
  tab: z.enum(['corporations', 'politics']).catch('corporations').default('corporations'),
  q: z.string().max(64).catch('').default(''),
  /** Political level, on the political entities tab. */
  type: zPoliticalEntityType.optional().catch(undefined),
  page,
});
export type OrganisationsSearch = z.infer<typeof OrganisationsSearchSchema>;

/** One organisation's page: its members' page, and its subsidiaries' or children's page. */
export const OrganisationSearchSchema = z.object({ members: page, children: page });
export type OrganisationSearch = z.infer<typeof OrganisationSearchSchema>;

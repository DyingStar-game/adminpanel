import { z } from 'zod';
import { zProfileKind } from '@dyingstar-admin/contracts/social';

/** Players page state carried by the URL (ADR 0024): name searched, kind, page. */
export const PlayersSearchSchema = z.object({
  q: z.string().max(64).catch('').default(''),
  kind: zProfileKind.optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type PlayersSearch = z.infer<typeof PlayersSearchSchema>;

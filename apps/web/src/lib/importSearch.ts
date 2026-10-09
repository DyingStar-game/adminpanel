import { z } from 'zod';

/** Import page state carried by the URL: the level imported into by default (ADR 0019). */
export const ImportSearchSchema = z.object({
  parent: z.string().optional().catch(undefined),
});

export type ImportSearch = z.infer<typeof ImportSearchSchema>;

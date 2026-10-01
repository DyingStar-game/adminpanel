import { z } from 'zod';

/** Orbit view state carried by the URL: opened cluster, its page, inspected entity. */
export const OrbitSearchSchema = z.object({
  open: z.string().min(1).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  selected: z.string().min(1).optional().catch(undefined),
});

export type OrbitSearch = z.infer<typeof OrbitSearchSchema>;

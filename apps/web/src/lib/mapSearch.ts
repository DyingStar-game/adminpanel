import { z } from 'zod';

/** Map view state carried by the URL: the inspected item. */
export const MapSearchSchema = z.object({
  selected: z.string().min(1).optional().catch(undefined),
});

export type MapSearch = z.infer<typeof MapSearchSchema>;

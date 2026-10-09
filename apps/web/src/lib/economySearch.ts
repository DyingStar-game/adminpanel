import { z } from 'zod';

/** Periods offered on the economy dashboard, in days. */
export const ECONOMY_PERIODS = [7, 30, 90] as const;

/** Economy page state carried by the URL (ADR 0024): the dashboard's period. */
export const EconomySearchSchema = z.object({
  days: z.coerce
    .number()
    .refine((d) => (ECONOMY_PERIODS as readonly number[]).includes(d))
    .catch(30)
    .default(30),
});
export type EconomySearch = z.infer<typeof EconomySearchSchema>;

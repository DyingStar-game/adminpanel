import { z } from 'zod';

/** Response of the BFF `GET /health` endpoint. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

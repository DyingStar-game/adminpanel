import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Directory of the built SPA, served in production. Unset in development (Vite serves it). */
  STATIC_DIR: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parses and validates the process environment; throws with every invalid key listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

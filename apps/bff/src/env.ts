import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Directory of the built SPA, served in production. Unset in development (Vite serves it). */
  STATIC_DIR: z.string().min(1).optional(),
  /** JSON array of game servers, see `config/servers.ts`. */
  SERVERS: z.string().default('[]'),
  /** Timeout of every call to a persistence service. */
  PERSISTENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** Lifetime of a coalesced persistence GET, shared by concurrent viewers (ADR 0009). */
  READ_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(500),
  /** Where object type definitions are read from (ADR 0006). */
  DEFINITIONS_REPO: z.string().default('DyingStar-game/horizonserver'),
  DEFINITIONS_PATH: z.string().default('ds_genericprops/props'),
  DEFINITIONS_REF: z.string().default('develop'),
  DEFINITIONS_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  GITHUB_TOKEN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parses and validates the process environment; throws with every invalid key listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

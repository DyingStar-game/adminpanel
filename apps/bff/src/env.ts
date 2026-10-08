import { z } from 'zod';

/** An unset or empty variable is undefined. */
const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Directory of the built SPA, served in production. Unset in development (Vite serves it). */
  STATIC_DIR: z.string().min(1).optional(),
  /**
   * Environment this panel serves (`testing`, `production`…): one panel is deployed per
   * environment, with its Keycloak (ADR 0023). Every entry of `SERVERS` belongs to it.
   */
  ENVIRONMENT: z.string().min(1).default('testing'),
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
  /** Keycloak sign-in (ADR 0023): issuer as the browser sees it. Required, see `authEnv`. */
  OIDC_ISSUER: optionalString,
  /** Where the BFF reads the discovery document, when it reaches Keycloak by another name. */
  OIDC_DISCOVERY_URL: optionalString,
  OIDC_CLIENT_ID: optionalString,
  OIDC_CLIENT_SECRET: optionalString,
  /** Origin the browser uses, e.g. `https://admin-preprod…`; defaults to each request's origin. */
  PUBLIC_URL: optionalString,
  /** Idle lifetime of a BFF session. */
  SESSION_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(12 * 60 * 60 * 1000),
});

export type Env = z.infer<typeof EnvSchema>;

/** Keycloak settings, required to start the BFF: there is no unauthenticated mode (ADR 0023). */
export function authEnv(env: Env) {
  const missing = (['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'] as const).filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    throw new Error(`Missing Keycloak settings: ${missing.join(', ')} (see .env.sample)`);
  }
  return {
    issuer: env.OIDC_ISSUER as string,
    discoveryUrl: env.OIDC_DISCOVERY_URL,
    clientId: env.OIDC_CLIENT_ID as string,
    clientSecret: env.OIDC_CLIENT_SECRET as string,
    publicUrl: env.PUBLIC_URL?.replace(/\/$/, ''),
    sessionTtlMs: env.SESSION_TTL_MS,
  };
}

/** Parses and validates the process environment; throws with every invalid key listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

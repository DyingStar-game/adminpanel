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
   * environment, with its Keycloak and its game server (ADR 0023).
   */
  ENVIRONMENT: z.string().min(1).default('testing'),
  /** The game server of this environment, shown in the top bar (ADR 0024). */
  GAME_SERVER_NAME: z.string().min(1).default('Game server'),
  /**
   * The game services of this environment (ADR 0024), internal URLs never sent to the browser
   * (ADR 0011). Unset, the service is hidden. `persistence` without `/items`, `social` without
   * `/api`.
   */
  PERSISTENCE_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  SOCIAL_URL: optionalString,
  /**
   * Service account of the panel for `social`'s internal API (ADR 0023 › Social — management).
   * Without its secret, organisation management is off; reading and moderation keep working.
   */
  SVC_ADMIN_CLIENT_ID: z.string().min(1).default('svc-admin'),
  SVC_ADMIN_CLIENT_SECRET: optionalString,
  /** Timeout of every call to a game service other than persistence. */
  SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
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
  // Replaced by the panel's own settings (ADR 0024): refuse it rather than lose persistence.
  if (source.SERVERS) {
    throw new Error(
      'SERVERS is no longer read: set GAME_SERVER_NAME and PERSISTENCE_URL instead (its ' +
        '`name` and `persistenceUrl`), then remove SERVERS (see .env.sample)',
    );
  }
  return EnvSchema.parse(source);
}

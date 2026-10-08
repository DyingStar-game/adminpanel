import { z } from 'zod';
import type { PublicServer } from '@dyingstar-admin/schemas';

/** Full server configuration, internal to the BFF: never sent to the browser. */
export const ServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Defaults to the panel's environment; any other value is refused (`parseServers`). */
  environment: z.string().min(1).optional(),
  persistenceUrl: z.url(),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema> & { environment: string };

const ServersSchema = z
  .array(ServerConfigSchema)
  .refine((servers) => new Set(servers.map((s) => s.id)).size === servers.length, {
    message: 'Server ids must be unique',
  });

/**
 * Parses the `SERVERS` env value (JSON array); throws a readable error when invalid. One panel is
 * deployed per environment, with that environment's Keycloak (ADR 0023): every server must
 * belong to `environment`, the panel's own.
 */
export function parseServers(raw: string, environment: string): ServerConfig[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('SERVERS must be a JSON array of servers');
  }
  const result = ServersSchema.safeParse(json);
  if (!result.success) throw new Error(`Invalid SERVERS: ${z.prettifyError(result.error)}`);
  const servers = result.data.map((server) => ({
    ...server,
    environment: server.environment ?? environment,
  }));
  const foreign = servers.filter((server) => server.environment !== environment);
  if (foreign.length > 0) {
    throw new Error(
      `Invalid SERVERS: ${foreign.map((s) => `${s.id} (${s.environment})`).join(', ')} not in ` +
        `this panel's environment ${environment}: deploy one panel per environment (ADR 0023)`,
    );
  }
  return servers;
}

export function toPublicServer({ id, name, environment }: ServerConfig): PublicServer {
  return { id, name, environment };
}

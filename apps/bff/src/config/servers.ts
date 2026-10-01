import { z } from 'zod';
import type { PublicServer } from '@dyingstar-admin/schemas';

/** Full server configuration, internal to the BFF: never sent to the browser. */
export const ServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  environment: z.string().min(1).default('testing'),
  persistenceUrl: z.url(),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

const ServersSchema = z
  .array(ServerConfigSchema)
  .refine((servers) => new Set(servers.map((s) => s.id)).size === servers.length, {
    message: 'Server ids must be unique',
  });

/** Parses the `SERVERS` env value (JSON array); throws a readable error when invalid. */
export function parseServers(raw: string): ServerConfig[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('SERVERS must be a JSON array of servers');
  }
  const result = ServersSchema.safeParse(json);
  if (!result.success) throw new Error(`Invalid SERVERS: ${z.prettifyError(result.error)}`);
  return result.data;
}

export function toPublicServer({ id, name, environment }: ServerConfig): PublicServer {
  return { id, name, environment };
}

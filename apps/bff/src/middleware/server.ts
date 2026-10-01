import { createMiddleware } from 'hono/factory';
import { ErrorCode, SERVER_HEADER } from '@dyingstar-admin/schemas';
import type { ServerConfig } from '../config/servers';
import { ApiError } from '../lib/errors';
import type { DefinitionsService } from '../services/definitions';
import type { ItemsService } from '../services/items';

export interface ServerContext {
  Variables: { server: ServerConfig; items: ItemsService; definitions: DefinitionsService };
}

/** Resolves the target game server from the `X-Server-Id` header. */
export const requireServer = (
  registry: Map<string, { server: ServerConfig; items: ItemsService }>,
  definitions: DefinitionsService,
) =>
  createMiddleware<ServerContext>(async (c, next) => {
    const id = c.req.header(SERVER_HEADER);
    if (!id) throw new ApiError(400, ErrorCode.serverRequired, `Missing ${SERVER_HEADER} header`);
    const entry = registry.get(id);
    if (!entry) throw new ApiError(404, ErrorCode.unknownServer, `Unknown server ${id}`);
    c.set('server', entry.server);
    c.set('items', entry.items);
    c.set('definitions', definitions);
    await next();
  });

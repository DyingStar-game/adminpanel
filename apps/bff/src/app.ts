import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { ErrorCode, type HealthResponse } from '@dyingstar-admin/schemas';
import { toPublicServer, type ServerConfig } from './config/servers';
import { createPersistenceClient } from './clients/persistence';
import { ApiError } from './lib/errors';
import { requireServer } from './middleware/server';
import { bodiesRoutes } from './routes/bodies';
import { itemsRoutes } from './routes/items';
import type { DefinitionsService } from './services/definitions';
import { createItemsService } from './services/items';

export const VERSION = '0.1.0';

export interface AppOptions {
  servers?: ServerConfig[];
  definitions: DefinitionsService;
  persistenceTimeoutMs?: number;
  readCacheTtlMs?: number;
  /** When set, the built SPA is served from this directory with an `index.html` fallback. */
  staticDir?: string | undefined;
}

/** Builds the BFF application. Kept separate from the server so tests can call `app.request()`. */
export function createApp({
  servers = [],
  definitions,
  persistenceTimeoutMs = 5000,
  readCacheTtlMs = 500,
  staticDir,
}: AppOptions) {
  const registry = new Map(
    servers.map((server) => [
      server.id,
      {
        server,
        items: createItemsService({
          client: createPersistenceClient({
            baseUrl: server.persistenceUrl,
            timeoutMs: persistenceTimeoutMs,
          }),
          definitions,
          readCacheTtlMs,
        }),
      },
    ]),
  );

  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json(error.toBody(), error.status);
    console.error(error);
    return c.json({ error: ErrorCode.internal, message: 'Unexpected error' }, 500);
  });

  app.get('/health', (c) => c.json<HealthResponse>({ status: 'ok', version: VERSION }));

  const api = new Hono()
    .get('/servers', (c) => c.json({ servers: servers.map(toPublicServer) }))
    .get('/definitions', async (c) => c.json(await definitions.list()))
    .get('/definitions/:type', async (c) => {
      const definition = await definitions.get(c.req.param('type'));
      if (!definition) {
        throw new ApiError(404, ErrorCode.notFound, `Unknown object type ${c.req.param('type')}`);
      }
      return c.json(definition);
    });
  api.use('/items/*', requireServer(registry, definitions));
  api.use('/items', requireServer(registry, definitions));
  api.route('/items', itemsRoutes);
  api.use('/bodies/*', requireServer(registry, definitions));
  api.route('/bodies', bodiesRoutes);
  app.route('/api', api);
  // Registered after the API routes and before the SPA fallback, so unknown API paths never
  // return index.html.
  app.all('/api/*', (c) =>
    c.json({ error: ErrorCode.notFound, message: 'Unknown API route' }, 404),
  );

  if (staticDir) {
    app.use('/*', serveStatic({ root: staticDir }));
    app.get('/*', serveStatic({ root: staticDir, path: 'index.html' }));
  }

  return app;
}

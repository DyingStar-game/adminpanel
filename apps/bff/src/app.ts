import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  ALL_PERMISSIONS,
  ErrorCode,
  type HealthResponse,
  type MeResponse,
  type PanelResponse,
} from '@dyingstar-admin/schemas';
import {
  requirePermission,
  requirePersistencePermission,
  type Auth,
  type SessionContext,
} from './auth/auth';
import type { SocialClient } from './clients/social';
import { createPersistenceClient } from './clients/persistence';
import { ApiError } from './lib/errors';
import { withPersistence } from './middleware/persistence';
import { bodiesRoutes } from './routes/bodies';
import { itemsRoutes } from './routes/items';
import { socialRoutes } from './routes/social';
import type { DefinitionsService } from './services/definitions';
import { createItemsService } from './services/items';

export const VERSION = '0.1.0';

/** `/api/me` when the BFF runs without authentication. */
const NO_AUTH_ME: MeResponse = {
  user: null,
  roles: [],
  permissions: ALL_PERMISSIONS,
  access: true,
};

export interface AppOptions {
  /**
   * Keycloak sign-in (ADR 0023). `false` runs without authentication: tests only, `index.ts`
   * always passes one.
   */
  auth: Auth | false;
  /** Environment this panel serves, with its Keycloak and its game server (ADR 0023). */
  environment?: string;
  /** The game server of this environment, shown in the top bar. */
  gameServerName?: string;
  /**
   * Persistence of this game server (ADR 0024); unset, the item routes answer 404 and the SPA
   * hides persistence.
   */
  persistenceUrl?: string | undefined;
  /** `social` of this environment (ADR 0024); unset, its routes answer 404 and the SPA hides it. */
  social?: SocialClient | undefined;
  definitions: DefinitionsService;
  persistenceTimeoutMs?: number;
  readCacheTtlMs?: number;
  /** When set, the built SPA is served from this directory with an `index.html` fallback. */
  staticDir?: string | undefined;
}

/** Builds the BFF application. Kept separate from the server so tests can call `app.request()`. */
export function createApp({
  auth,
  environment = 'testing',
  gameServerName = 'Game server',
  persistenceUrl,
  social,
  definitions,
  persistenceTimeoutMs = 5000,
  readCacheTtlMs = 500,
  staticDir,
}: AppOptions) {
  const items =
    persistenceUrl &&
    createItemsService({
      client: createPersistenceClient({ baseUrl: persistenceUrl, timeoutMs: persistenceTimeoutMs }),
      definitions,
      readCacheTtlMs,
    });

  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json(error.toBody(), error.status);
    console.error(error);
    return c.json({ error: ErrorCode.internal, message: 'Unexpected error' }, 500);
  });

  app.get('/health', (c) => c.json<HealthResponse>({ status: 'ok', version: VERSION }));

  if (auth) {
    app.route('/auth', auth.routes);
    app.use('/api/*', auth.guard);
  }

  const api = new Hono<SessionContext>()
    .get('/me', (c) => c.json<MeResponse>(auth ? auth.me(c.var.session) : NO_AUTH_ME))
    .get('/panel', (c) =>
      c.json<PanelResponse>({
        environment,
        gameServerName,
        // Game services this panel manages (ADR 0024): the SPA shows their modules.
        services: [
          ...(items ? ['persistence'] : []),
          ...(social ? ['social'] : []),
          // Organisation management, through `svc-admin` (ADR 0023 › Social — management).
          ...(social?.manages ? ['social-management'] : []),
        ],
      }),
    )
    .get('/definitions', async (c) => c.json(await definitions.list()))
    .get('/definitions/:type', async (c) => {
      const definition = await definitions.get(c.req.param('type'));
      if (!definition) {
        throw new ApiError(404, ErrorCode.notFound, `Unknown object type ${c.req.param('type')}`);
      }
      return c.json(definition);
    });
  if (items) {
    const persistence = withPersistence(items, definitions);
    api.use('/items/*', requirePersistencePermission, persistence);
    api.use('/items', requirePersistencePermission, persistence);
    api.route('/items', itemsRoutes);
    api.use('/bodies/*', requirePersistencePermission, persistence);
    api.route('/bodies', bodiesRoutes);
  }
  if (social) {
    api.use('/social/*', requirePermission('social.moderate'));
    api.route('/social', socialRoutes(social));
  }
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

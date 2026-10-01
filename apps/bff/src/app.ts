import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { HealthResponse } from '@dyingstar-admin/schemas';

export const VERSION = '0.1.0';

export interface AppOptions {
  /** When set, the built SPA is served from this directory with an `index.html` fallback. */
  staticDir?: string | undefined;
}

/** Builds the BFF application. Kept separate from the server so tests can call `app.request()`. */
export function createApp({ staticDir }: AppOptions = {}) {
  const app = new Hono();

  app.get('/health', (c) => c.json<HealthResponse>({ status: 'ok', version: VERSION }));

  const api = new Hono();
  app.route('/api', api);
  // Registered after the API routes and before the SPA fallback, so unknown API paths never
  // return index.html.
  app.all('/api/*', (c) => c.json({ error: 'NOT_FOUND', message: 'Unknown API route' }, 404));

  if (staticDir) {
    app.use('/*', serveStatic({ root: staticDir }));
    app.get('/*', serveStatic({ root: staticDir, path: 'index.html' }));
  }

  return app;
}

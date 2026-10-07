import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createDataset, createPersistenceMock, PERSISTENCE_URL } from '@dyingstar-admin/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { createApp, type AppOptions } from '../app';
import { createDefinitionsService } from '../services/definitions';

export const SERVER_ID = 'universe-testing';

/** Shared MSW server for BFF tests; handlers are registered per test through `buildApp`. */
export const mswServer = setupServer();

const def = (properties: string[]) => ({
  channels: [{ zone: 0, distance: 100, frequency: 1, properties }],
});

/** Minimal GitHub contents API serving a few `*_def.json` files and one unrelated file. */
export const githubDefinitionsHandlers = [
  http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
    HttpResponse.json(
      ['planet', 'spawnbuilding', 'vehicle', 'vehicle_component', 'player', 'star']
        .map((type) => ({
          name: `${type}_def.json`,
          type: 'file',
          download_url: `https://raw.test/${type}_def.json`,
        }))
        .concat([{ name: 'README.md', type: 'file', download_url: 'https://raw.test/README.md' }]),
    ),
  ),
  http.get('https://raw.test/:file', ({ params }) =>
    HttpResponse.json(
      def(['position', 'rotation', 'parent_id', 'scenename', `${String(params.file)}_prop`]),
    ),
  ),
];

/** Builds an app wired to a fresh persistence mock; returns both. */
export function buildApp(
  options: { dataset?: Item[] } & Partial<Omit<AppOptions, 'definitions'>> = {},
) {
  const persistence = createPersistenceMock(options.dataset ?? createDataset());
  mswServer.use(...persistence.handlers, ...githubDefinitionsHandlers);
  const app = createApp({
    servers: [
      {
        id: SERVER_ID,
        name: 'Universe Testing',
        environment: 'testing',
        persistenceUrl: PERSISTENCE_URL,
      },
    ],
    definitions: createDefinitionsService({
      repo: 'DyingStar-game/horizonserver',
      path: 'ds_genericprops/props',
      ref: 'develop',
      ttlMs: 60_000,
    }),
    readCacheTtlMs: 0,
    ...options,
  });

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'X-Server-Id': SERVER_ID, 'Content-Type': 'application/json', ...init.headers },
    });

  return { app, persistence, request };
}

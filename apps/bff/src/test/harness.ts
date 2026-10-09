import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createDataset,
  createPersistenceMock,
  createEconomieMock,
  createSocialMock,
  ECONOMIE_URL,
  PERSISTENCE_URL,
  SOCIAL_URL,
  type SocialDataset,
} from '@dyingstar-admin/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { createApp, type AppOptions } from '../app';
import type { AuditEntry } from '../lib/audit';
import { createEconomieClient } from '../clients/economie';
import { createSocialClient } from '../clients/social';
import { createDefinitionsService } from '../services/definitions';

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

/**
 * Builds an app wired to fresh persistence, `social` and `economie` mocks; returns them, with
 * the record of writes to the game services.
 */
export function buildApp(
  options: { dataset?: Item[]; socialData?: SocialDataset } & Partial<
    Omit<AppOptions, 'definitions'>
  > = {},
) {
  const persistence = createPersistenceMock(options.dataset ?? createDataset());
  const social = createSocialMock(options.socialData);
  const economie = createEconomieMock();
  const audited: AuditEntry[] = [];
  mswServer.use(
    ...persistence.handlers,
    ...social.handlers,
    ...economie.handlers,
    ...githubDefinitionsHandlers,
  );
  const app = createApp({
    auth: false,
    gameServerName: 'Universe Testing',
    persistenceUrl: PERSISTENCE_URL,
    definitions: createDefinitionsService({
      repo: 'DyingStar-game/horizonserver',
      path: 'ds_genericprops/props',
      ref: 'develop',
      ttlMs: 60_000,
    }),
    readCacheTtlMs: 0,
    // `svc-admin` configured: organisation management on (ADR 0023 › Social — management).
    social: createSocialClient({
      baseUrl: SOCIAL_URL,
      timeoutMs: 1000,
      serviceToken: () => Promise.resolve('svc-admin-token'),
    }),
    economie: createEconomieClient({
      baseUrl: ECONOMIE_URL,
      timeoutMs: 1000,
      serviceToken: () => Promise.resolve('svc-admin-token'),
    }),
    audit: (entry) => audited.push(entry),
    ...options,
  });

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });

  return { app, persistence, social, economie, audited, request };
}

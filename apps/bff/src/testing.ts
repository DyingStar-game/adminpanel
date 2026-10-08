import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import {
  ObjectDefinitionSchema,
  type DefinitionsResponse,
  type Item,
  type ObjectDefinition,
} from '@dyingstar-admin/schemas';
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
import { createApp } from './app';
import { createEconomieClient } from './clients/economie';
import { createSocialClient } from './clients/social';
import fallback from './definitions/fallback.json';
import type { DefinitionsService } from './services/definitions';

/** Definitions service serving a fixed list (the bundled snapshot by default). */
export function createStaticDefinitions(
  definitions: ObjectDefinition[] = z.array(ObjectDefinitionSchema).parse(fallback.definitions),
): DefinitionsService {
  const response: DefinitionsResponse = { definitions, source: 'fallback' };
  return {
    list: async () => response,
    get: async (type: string) => definitions.find((d) => d.type === type) ?? null,
  };
}

/**
 * The real BFF running in-process behind MSW, on top of the persistence mock. Frontend tests
 * use it so they exercise the actual API contract instead of hand-written stubs.
 */
export function createInProcessBff({
  dataset = createDataset(),
  socialData,
}: { dataset?: Item[]; socialData?: SocialDataset } = {}) {
  const persistence = createPersistenceMock(dataset);
  const social = createSocialMock(socialData);
  const economie = createEconomieMock();
  const app = createApp({
    auth: false,
    gameServerName: 'Universe Testing',
    persistenceUrl: PERSISTENCE_URL,
    definitions: createStaticDefinitions(),
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
  });
  const forward = async ({ request }: { request: Request }) => {
    const res = await app.fetch(request);
    return new HttpResponse(res.body, { status: res.status, headers: res.headers });
  };

  return {
    persistence,
    social,
    economie,
    handlers: [
      ...persistence.handlers,
      ...social.handlers,
      ...economie.handlers,
      http.all('*/api/*', forward),
      http.get('*/health', forward),
    ],
  };
}

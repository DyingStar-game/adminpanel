import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import {
  ObjectDefinitionSchema,
  type DefinitionsResponse,
  type Item,
  type ObjectDefinition,
} from '@dyingstar-admin/schemas';
import { createDataset, createPersistenceMock, PERSISTENCE_URL } from '@dyingstar-admin/testing';
import { createApp } from './app';
import fallback from './definitions/fallback.json';
import type { DefinitionsService } from './services/definitions';

export const TEST_SERVER_ID = 'universe-testing';

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
export function createInProcessBff({ dataset = createDataset() }: { dataset?: Item[] } = {}) {
  const persistence = createPersistenceMock(dataset);
  const app = createApp({
    servers: [
      {
        id: TEST_SERVER_ID,
        name: 'Universe Testing',
        environment: 'testing',
        persistenceUrl: PERSISTENCE_URL,
      },
    ],
    definitions: createStaticDefinitions(),
    readCacheTtlMs: 0,
  });
  const forward = async ({ request }: { request: Request }) => {
    const res = await app.fetch(request);
    return new HttpResponse(res.body, { status: res.status, headers: res.headers });
  };

  return {
    persistence,
    handlers: [
      ...persistence.handlers,
      http.all('*/api/*', forward),
      http.get('*/health', forward),
    ],
  };
}

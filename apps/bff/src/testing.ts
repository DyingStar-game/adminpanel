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
  createInventoryMock,
  createMissionMock,
  createSocialMock,
  createUniversesimulatorMock,
  createNpcMock,
  ECONOMIE_URL,
  NPC_URL,
  INVENTORY_URL,
  MISSION_URL,
  PERSISTENCE_URL,
  SOCIAL_URL,
  UNIVERSESIMULATOR_URL,
  type SocialDataset,
} from '@dyingstar-admin/testing';
import { createApp } from './app';
import { createEconomieClient } from './clients/economie';
import { createNpcClient } from './clients/npc';
import { createUniversesimulatorClient } from './clients/universesimulator';
import { createInventoryClient } from './clients/inventory';
import { createMissionClient } from './clients/mission';
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
  const universesimulator = createUniversesimulatorMock();
  const npc = createNpcMock();
  const mission = createMissionMock();
  const inventory = createInventoryMock();
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
    universesimulator: createUniversesimulatorClient({
      baseUrl: UNIVERSESIMULATOR_URL,
      timeoutMs: 1000,
    }),
    npc: createNpcClient({ baseUrl: NPC_URL, timeoutMs: 1000 }),
    mission: createMissionClient({
      baseUrl: MISSION_URL,
      timeoutMs: 1000,
      serviceToken: () => Promise.resolve('svc-admin-token'),
    }),
    inventory: createInventoryClient({
      baseUrl: INVENTORY_URL,
      timeoutMs: 1000,
      serviceToken: () => Promise.resolve('svc-admin-token'),
    }),
    // The record of writes stays out of the test output.
    audit: () => undefined,
  });
  const forward = async ({ request }: { request: Request }) => {
    const res = await app.fetch(request);
    return new HttpResponse(res.body, { status: res.status, headers: res.headers });
  };

  return {
    persistence,
    social,
    economie,
    universesimulator,
    npc,
    mission,
    inventory,
    handlers: [
      ...persistence.handlers,
      ...social.handlers,
      ...economie.handlers,
      ...universesimulator.handlers,
      ...npc.handlers,
      ...mission.handlers,
      ...inventory.handlers,
      http.all('*/api/*', forward),
      http.get('*/health', forward),
    ],
  };
}

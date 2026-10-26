import { http, HttpResponse } from 'msw';
import type { Poi, PoiView } from '@dyingstar-admin/contracts/inventory';

/** Base URL used by tests for the mocked `inventory` service (ADR 0026). */
export const INVENTORY_URL = 'http://inventory.test';

/** POI ids of the fixtures, the places of the mission fixtures' objectives. */
export const poiIds = {
  /** New Haven's foundry, where the ore is delivered. */
  foundryBay: '0b1a7e1e-0000-4000-8000-0000000000d1',
  /** Where the drill parts are loaded. */
  depot: '0b1a7e1e-0000-4000-8000-0000000000d2',
  /** Where they are taken. */
  drillSite: '0b1a7e1e-0000-4000-8000-0000000000d3',
  /** The survey's crater, far from New Haven. */
  craterRim: '0b1a7e1e-0000-4000-8000-0000000000d4',
  /** A station in orbit, in open space. */
  relayStation: '0b1a7e1e-0000-4000-8000-0000000000d5',
  /** An objective's POI `inventory` does not hold. */
  missing: '0b1a7e1e-0000-4000-8000-0000000000df',
} as const;

/** The system owner of the game's POIs. */
const SYSTEM_OWNER = '5e5e5e5e-0000-4000-8000-000000000001';
const CREATED = '2026-10-10T08:00:00.000Z';

/** A POI row with `inventory`'s column defaults (`db/schema/pois.ts`). */
const poi = (fields: Partial<Poi> & Pick<Poi, 'id' | 'name' | 'x' | 'y' | 'z'>): Poi => ({
  ownerType: 'system',
  ownerId: SYSTEM_OWNER,
  description: null,
  system: 'tarsis',
  scene: 'tarsis_3',
  parentId: null,
  radiusM: null,
  visibility: 'public',
  metadata: null,
  createdBy: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  ...fields,
});

/**
 * POIs on SandBox (Tarsis III), metres from its centre about 4 km above its wiki radius, as the
 * game's ground stands (`CLAUDE.md` › Domain facts), and one in open space.
 */
export function createPois(): Poi[] {
  return [
    poi({
      id: poiIds.foundryBay,
      name: 'Foundry loading bay',
      scene: 'tarsis_3/new-haven',
      x: -3_828_872.1,
      y: 2_444_118.3,
      z: 4_451_474.4,
      radiusM: 40,
    }),
    poi({ id: poiIds.depot, name: 'Vance depot', x: -3_874_453.7, y: 2_474_828.3, z: 4_394_705.1 }),
    poi({
      id: poiIds.drillSite,
      name: 'Drill site 7',
      x: -3_787_869.0,
      y: 2_361_899.4,
      z: 4_530_240.5,
      radiusM: 120,
    }),
    poi({
      id: poiIds.craterRim,
      name: 'Crater rim',
      x: 4_372_129.0,
      y: 1_656_808.7,
      z: -4_311_504.8,
    }),
    poi({
      id: poiIds.relayStation,
      name: 'Relay station',
      scene: 'space',
      x: 12_000_000,
      y: 0,
      z: 3_000_000,
    }),
  ];
}

export interface InventoryMock {
  handlers: ReturnType<typeof http.get>[];
  pois: Poi[];
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * MSW handlers reproducing the part of `inventory` the panel uses, from its code
 * (`routes/internal.routes.ts`, `services/pois.service.ts`): one POI with its shares, 404
 * `NOT_FOUND` for an unknown one, 400 for an id that is not a UUID. Tokens are recorded, not
 * checked.
 */
export function createInventoryMock(
  pois: Poi[] = createPois(),
  baseUrl: string = INVENTORY_URL,
): InventoryMock {
  const tokens: (string | null)[] = [];
  const handlers = [
    http.get(`${baseUrl}/api/internal/pois/:poiId`, ({ request, params }) => {
      tokens.push(request.headers.get('authorization'));
      const id = String(params.poiId);
      if (!UUID.test(id)) {
        return HttpResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Invalid poiId', status: 400 },
          { status: 400 },
        );
      }
      const found = pois.find((p) => p.id === id);
      if (!found) {
        return HttpResponse.json(
          { error: 'NOT_FOUND', message: 'POI not found', status: 404 },
          { status: 404 },
        );
      }
      return HttpResponse.json<PoiView>({ ...found, shares: [] });
    }),
  ];
  return { handlers, pois, tokens };
}

import { http, HttpResponse } from 'msw';
import { zUpdatePoi, type Poi, type PoiView } from '@dyingstar-admin/contracts/inventory';

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
  /** The private POI the game gave the discoverer of a cave (ADR 0032). */
  caveEcho: '0b1a7e1e-0000-4000-8000-0000000000e1',
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

/**
 * The POI the game server creates for the discoverer of a cave (`server/discoveries.gd`):
 * private, owned by the player (griefer42 of the social fixtures), named "Uncharted cave" then
 * after the proposed name, its `metadata` pointing at the discovery (ADR 0032). Kept out of
 * `createPois` (the missions' places); the mock holds it.
 */
export const createDiscovererPoi = (): Poi =>
  poi({
    id: poiIds.caveEcho,
    ownerType: 'player',
    ownerId: '5b1d3c1e-0000-4000-8000-0000000000b2',
    name: "L'Antre des Échos",
    visibility: 'private',
    x: -3_801_220.4,
    y: 2_410_877.9,
    z: 4_489_315.6,
    metadata: {
      kind: 'cave',
      discovery_uuid: 'd15c0e1f-7a2b-5c3d-9e4f-000000000d01',
      place_uuid: 'a3c1e5f0-1d2b-5c3d-8e4f-000000000c01',
      place_id: 'tarsis_3_cave_017',
      uncharted: true,
    },
  });

export interface InventoryMock {
  handlers: ReturnType<typeof http.get>[];
  pois: Poi[];
  /** Writes received (POI edits), newest last: `METHOD path` and body. */
  writes: { call: string; body: unknown }[];
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (message: string) =>
  HttpResponse.json({ error: 'VALIDATION_ERROR', message, status: 400 }, { status: 400 });
const notFound = () =>
  HttpResponse.json({ error: 'NOT_FOUND', message: 'POI not found', status: 404 }, { status: 404 });

/**
 * MSW handlers reproducing the part of `inventory` the panel uses, from its code
 * (`routes/internal.routes.ts`, `services/pois.service.ts`): one POI with its shares, a POI's
 * edit (`updatePoiBody`, `metadata` replaced whole), 404 `NOT_FOUND` for an unknown one, 400 for
 * an id that is not a UUID or an invalid edit. Tokens are recorded, not checked.
 */
export function createInventoryMock(
  pois: Poi[] = [...createPois(), createDiscovererPoi()],
  baseUrl: string = INVENTORY_URL,
): InventoryMock {
  const tokens: (string | null)[] = [];
  const writes: { call: string; body: unknown }[] = [];
  const handlers = [
    http.get(`${baseUrl}/api/internal/pois/:poiId`, ({ request, params }) => {
      tokens.push(request.headers.get('authorization'));
      const id = String(params.poiId);
      if (!UUID.test(id)) return invalid('Invalid poiId');
      const found = pois.find((p) => p.id === id);
      if (!found) return notFound();
      return HttpResponse.json<PoiView>({ ...found, shares: [] });
    }),
    http.patch(`${baseUrl}/api/internal/pois/:poiId`, async ({ request, params }) => {
      tokens.push(request.headers.get('authorization'));
      const id = String(params.poiId);
      const body: unknown = await request.json();
      writes.push({ call: `PATCH /internal/pois/${id}`, body });
      if (!UUID.test(id)) return invalid('Invalid poiId');
      const patch = zUpdatePoi.safeParse(body);
      if (!patch.success) return invalid('Invalid body');
      const found = pois.find((p) => p.id === id);
      if (!found) return notFound();
      const { name, description, visibility, metadata } = patch.data;
      Object.assign(found, {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
        updatedAt: new Date().toISOString(),
      });
      return HttpResponse.json<Poi>(found);
    }),
  ];
  return { handlers, pois, tokens, writes };
}

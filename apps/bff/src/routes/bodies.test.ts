import { describe, expect, it } from 'vitest';
import { createDataset, ids } from '@dyingstar-admin/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { MAX_MAP_POINTS } from '../services/items';
import { buildApp } from '../test/harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();

describe('GET /api/bodies/:uuid/map', () => {
  it('maps the body children and the players housed in them', async () => {
    const res = await buildApp().request(`/api/bodies/${ids.planet}/map`);

    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.body).toMatchObject({ object_uuid: ids.planet, name: 'SandBox' });
    const byUuid = new Map(body.points.map((p: { object_uuid: string }) => [p.object_uuid, p]));
    // The moon has no position: not on the map. The wheels belong to the vehicle: left out.
    expect([...byUuid.keys()].sort()).toEqual(
      [ids.spawnbuilding, ids.vehicle, ids.rock, ids.player].sort(),
    );
    expect(byUuid.get(ids.player)).toMatchObject({
      object_type: 'player',
      name: 'ddurieux',
      via: ids.spawnbuilding,
    });
    expect(body.referenceRadius).toBeGreaterThan(6_000_000);
  });

  it('requires a server and answers 404 for an unknown body', async () => {
    const { app, request } = buildApp();

    expect((await app.request(`/api/bodies/${ids.planet}/map`)).status).toBe(400);
    expect((await request('/api/bodies/unknown/map')).status).toBe(404);
  });

  it('refuses a map larger than the limit', async () => {
    const rocks: Item[] = Array.from({ length: MAX_MAP_POINTS + 1 }, (_, i) => ({
      object_type: 'miningrock',
      object_uuid: `rock-${i}`,
      object_data: { parent_id: ids.planet, position: { x: 0, y: 0, z: 6_361_633 } },
    }));
    const res = await buildApp({ dataset: [...createDataset(), ...rocks] }).request(
      `/api/bodies/${ids.planet}/map`,
    );

    expect(res.status).toBe(400);
    expect(await read(res)).toMatchObject({ error: 'MAP_TOO_LARGE' });
  });
});

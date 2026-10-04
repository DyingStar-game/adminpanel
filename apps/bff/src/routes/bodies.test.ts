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
    // The moon has no position: not on the map. The components belong to the vehicle: left
    // out. Every type on the body is drawn, the rock too (hidden by the web app by default).
    expect([...byUuid.keys()].sort()).toEqual(
      [ids.spawnbuilding, ids.vehicle, ids.player, ids.rock].sort(),
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

  it('omits a shown type too numerous for the limit instead of failing', async () => {
    // A crowd of vehicles on the planet, more than the limit.
    const crowd: Item[] = Array.from({ length: MAX_MAP_POINTS + 1 }, (_, i) => ({
      object_type: 'vehicle',
      object_uuid: `crowd-${i}`,
      object_data: { parent_id: ids.planet, position: { x: 0, y: 0, z: 6_361_633 } },
    }));
    const { request } = buildApp({ dataset: [...createDataset(), ...crowd] });
    const res = await request(`/api/bodies/${ids.planet}/map`);

    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.omitted).toEqual(['vehicle']);
    // Counted, not drawn; the other types are there.
    expect(body.counts).toContainEqual({ object_type: 'vehicle', total: MAX_MAP_POINTS + 2 });
    expect(body.points.some((p: { object_type: string }) => p.object_type === 'vehicle')).toBe(
      false,
    );
    expect(
      body.points.some((p: { object_uuid: string }) => p.object_uuid === ids.spawnbuilding),
    ).toBe(true);
  });

  it('counts the hidden types without loading them, except the included item', async () => {
    const { request } = buildApp();
    const hidden = await read(
      await request(`/api/bodies/${ids.planet}/map?hide=vehicle,player,miningrock`),
    );

    expect(hidden.omitted).toEqual([]);
    expect(hidden.points.map((p: { object_uuid: string }) => p.object_uuid)).toEqual([
      ids.spawnbuilding,
    ]);
    expect(hidden.counts).toEqual(
      expect.arrayContaining([
        { object_type: 'vehicle', total: 1 },
        { object_type: 'player', total: 1 },
      ]),
    );

    // The selected vehicle stays on the map although its type is hidden.
    const selected = await read(
      await request(
        `/api/bodies/${ids.planet}/map?hide=vehicle,player,miningrock&include=${ids.vehicle}`,
      ),
    );
    expect(selected.points.map((p: { object_uuid: string }) => p.object_uuid).sort()).toEqual(
      [ids.spawnbuilding, ids.vehicle].sort(),
    );
  });

  it('keeps players on the map with their buildings hidden', async () => {
    const body = await read(
      await buildApp().request(
        `/api/bodies/${ids.planet}/map?hide=spawnbuilding,vehicle,miningrock`,
      ),
    );
    expect(body.points.map((p: { object_uuid: string }) => p.object_uuid)).toEqual([ids.player]);
    expect(body.points[0]).toMatchObject({ via: ids.spawnbuilding });
  });

  it('keeps every point in place whatever the shown types', async () => {
    const { request } = buildApp();
    const vehicleAt = async (query: string) => {
      const body = await read(await request(`/api/bodies/${ids.planet}/map${query}`));
      const point = body.points.find((p: { object_uuid: string }) => p.object_uuid === ids.vehicle);
      return { x: point.x, y: point.y };
    };

    const first = await vehicleAt('');
    // Fewer loaded items moved the projection centre, and every point with it.
    expect(await vehicleAt(`?hide=spawnbuilding,player`)).toEqual(first);
  });

  it('counts every type, players where they are housed', async () => {
    const body = await read(await buildApp().request(`/api/bodies/${ids.planet}/map`));
    expect(body.omitted).toEqual([]);
    expect(body.counts).toEqual(
      expect.arrayContaining([
        { object_type: 'vehicle', total: 1 },
        { object_type: 'spawnbuilding', total: 1 },
        { object_type: 'player', total: 1 },
      ]),
    );
  });
});

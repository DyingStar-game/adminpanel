import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zBulkNpcsResponse,
  zCancelNpcTaskResponse,
  zCreateNpcTaskResponse,
  zCreateNpcsResponse,
  zCreatePatternResponse,
  zGetActivityActionsResponse,
  zGetNpcEventsResponse,
  zGetNpcLogsResponse,
  zGetNpcResponse,
  zGetPatternResponse,
  zGetScheduleLegendResponse,
  zGetSettingsResponse,
  zGetTaskKindsResponse,
  zImportSchedulesResponse,
  zListEventsResponse,
  zListNpcTasksResponse,
  zListNpcsResponse,
  zListPatternsResponse,
  zListVillagesResponse,
  zPatchNpcResponse,
  zPutActivityActionsResponse,
  zPutSettingsResponse,
  zSetVillageWorkplaceResponse,
  zSpawnNpcResponse,
  zUpdatePatternResponse,
} from '@dyingstar-admin/contracts/npc';
import { createNpcMock, npcIds as ids, NPC_MANUAL_ACTIONS, NPC_URL } from './npcMock';

const mock = createNpcMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const admin = (path: string) => `${NPC_URL}/api/admin${path}`;
const read = async (path: string) => (await fetch(admin(path))).json();
const send = (method: string, path: string, body?: unknown) =>
  fetch(admin(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const valid = async (res: Response, schema: z.ZodType, label: string) => {
  expect(schema.safeParse(await res.json()).error, label).toBeUndefined();
};

describe('npc mock (ADR 0026)', () => {
  it('answers as the contract says', async () => {
    const checks: [string, z.ZodType][] = [
      ['/settings', zGetSettingsResponse],
      ['/npcs', zListNpcsResponse],
      ['/npcs?online=true', zListNpcsResponse],
      ...Object.values(ids)
        .filter((id) => id.startsWith('c0ffee'))
        .map((id): [string, z.ZodType] => [`/npcs/${id}`, zGetNpcResponse]),
      [`/npcs/${ids.alain}/logs`, zGetNpcLogsResponse],
      [`/npcs/${ids.alain}/events`, zGetNpcEventsResponse],
      ['/events', zListEventsResponse],
      [`/npcs/${ids.camille}/tasks`, zListNpcTasksResponse],
      ['/task-kinds', zGetTaskKindsResponse],
      ['/schedule/patterns', zListPatternsResponse],
      ['/schedule/patterns/magasinier_1', zGetPatternResponse],
      ['/schedule/activity-actions', zGetActivityActionsResponse],
      ['/schedule/legend', zGetScheduleLegendResponse],
      ['/villages', zListVillagesResponse],
    ];
    for (const [path, schema] of checks) {
      expect(schema.safeParse(await read(path)).error, path).toBeUndefined();
    }
  });

  it('answers writes as the contract says', async () => {
    await valid(
      await send('PUT', '/settings', { npcsEnabled: true }),
      zPutSettingsResponse,
      'settings',
    );
    await valid(await send('POST', '/npcs', { count: 2 }), zCreateNpcsResponse, 'create');
    await valid(
      await send('POST', '/npcs/bulk', { action: 'despawn', count: 1 }),
      zBulkNpcsResponse,
      'bulk',
    );
    await valid(await send('POST', `/npcs/${ids.denis}/spawn`), zSpawnNpcResponse, 'spawn');
    await valid(
      await send('PATCH', `/npcs/${ids.denis}`, { lastName: 'Faure-Martin', notes: 'test' }),
      zPatchNpcResponse,
      'patch',
    );
    const task = await send('POST', `/npcs/${ids.alain}/tasks`, {
      kind: 'run_action',
      params: { action: NPC_MANUAL_ACTIONS[0], duration_s: 60 },
    });
    expect(task.status).toBe(201);
    const { task: created } = (await task.clone().json()) as { task: { id: number } };
    await valid(task, zCreateNpcTaskResponse, 'task');
    await valid(
      await send('DELETE', `/npcs/${ids.alain}/tasks/${created.id}`),
      zCancelNpcTaskResponse,
      'cancel',
    );
    await valid(
      await send('POST', '/schedule/patterns', { name: 'n1', days: ['TT..'] }),
      zCreatePatternResponse,
      'create pattern',
    );
    await valid(
      await send('PUT', '/schedule/patterns/n1', { days: ['T...'], description: 'x' }),
      zUpdatePatternResponse,
      'update pattern',
    );
    await valid(
      await send('PUT', '/schedule/activity-actions', { off: ['go_home', 'take_a_walk'] }),
      zPutActivityActionsResponse,
      'mapping',
    );
    await valid(await send('POST', '/schedule/import', {}), zImportSchedulesResponse, 'import');
    await valid(
      await send('PUT', '/villages/M0013/workplace', { warehouseId: ids.m0013Depot }),
      zSetVillageWorkplaceResponse,
      'workplace',
    );
  });

  it('follows the rules of the service', async () => {
    const own = createNpcMock();
    server.resetHandlers(...own.handlers);
    try {
      // A role set by hand locks it; a storekeeper needs a village and a slot.
      const custom = await send('PATCH', `/npcs/${ids.denis}`, { role: 'custom' });
      expect(await custom.json()).toMatchObject({ npc: { role: 'custom', roleLocked: true } });
      expect((await send('PATCH', `/npcs/${ids.denis}`, { role: 'storekeeper' })).status).toBe(400);
      expect((await send('PATCH', `/npcs/${ids.denis}`, { storekeeperSlot: 2 })).status).toBe(400);
      expect((await send('PATCH', `/npcs/${ids.denis}`, { schedulePattern: 'nope' })).status).toBe(
        400,
      );
      // Despawn by count: the most recent enabled non-storekeeper first.
      expect(
        await (await send('POST', '/npcs/bulk', { action: 'despawn', count: 1 })).json(),
      ).toEqual({ affected: [ids.camille], errors: [] });
      // The switch off stops every NPC.
      await send('PUT', '/settings', { npcsEnabled: false });
      expect(own.data.npcs.every((n) => !n.live.running)).toBe(true);
      // Log lines after `since`, at a minimum level.
      expect(await (await fetch(admin(`/npcs/${ids.alain}/logs?level=warn`))).json()).toMatchObject(
        { items: [{ level: 'WARN' }], lastSeq: 4 },
      );
      expect(await (await fetch(admin(`/npcs/${ids.alain}/logs?since=4`))).json()).toEqual({
        items: [],
        lastSeq: 4,
      });
      // A pattern in use cannot be deleted.
      expect((await send('DELETE', '/schedule/patterns/magasinier_2')).status).toBe(409);
    } finally {
      server.resetHandlers(...mock.handlers);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp } from '../test/harness';

const json = (method: string, body?: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('npc routes (ADR 0031)', () => {
  it('lists npc among the services when configured, and has no routes otherwise', async () => {
    const res = await buildApp().request('/api/panel');
    expect(((await res.json()) as { services: string[] }).services).toContain('npc');

    const without = buildApp({ npc: undefined });
    const panel = await without.request('/api/panel');
    expect(((await panel.json()) as { services: string[] }).services).not.toContain('npc');
    expect((await without.request('/api/npc/settings')).status).toBe(404);
  });

  it('reads the roster, an NPC, its tasks, logs and events, schedules and villages', async () => {
    const { request, npc } = buildApp();
    const get = async (path: string) => {
      const res = await request(`/api/npc${path}`);
      expect(res.status, path).toBe(200);
      return (await res.json()) as Record<string, unknown> & { items: unknown[] };
    };

    expect(await get('/settings')).toMatchObject({
      settings: { npcsEnabled: true },
      counts: { total: 5, enabled: 3, running: 3, connected: 2 },
    });
    expect(await get('/npcs')).toMatchObject({ total: 5 });
    expect((await get('/npcs?village=M0012&role=storekeeper')).items).toHaveLength(2);
    expect(await get('/npcs?enabled=false')).toMatchObject({ total: 2 });
    // `total` counts the matches before `online`.
    expect(await get('/npcs?online=true&limit=10&offset=0')).toMatchObject({
      total: 5,
      items: [{ id: ids.alain }, { id: ids.camille }],
    });
    expect((await get('/npcs?q=deloin')).items).toHaveLength(1);
    // The manual task running is an int64: sent as a number.
    expect(await get(`/npcs/${ids.camille}`)).toMatchObject({
      npc: { live: { currentAction: { source: 'manual', taskId: 3 } } },
      routine: { pattern: 'magasinier_1', day: 7, hour: 6, activity: 'work' },
      tasks: [{ id: 4, status: 'pending' }, { id: 3, status: 'running' }, {}, {}],
    });
    expect((await get(`/npcs/${ids.camille}/tasks`)).items).toHaveLength(4);
    expect(await get(`/npcs/${ids.alain}/logs?since=2&level=info`)).toMatchObject({
      items: [{ seq: 3 }, { seq: 4, level: 'WARN' }],
      lastSeq: 4,
    });
    expect((await get(`/npcs/${ids.alain}/events?kind=connected`)).items).toHaveLength(1);
    expect((await get('/events?limit=2')).items).toMatchObject([{ id: 12 }, { id: 11 }]);
    expect((await get('/events?before=3&limit=10')).items).toMatchObject([{ id: 2 }, { id: 1 }]);
    expect(await get('/task-kinds')).toMatchObject({ kinds: [{}, {}, {}] });
    expect((await get('/schedule/patterns')).items).toHaveLength(2);
    expect(await get('/schedule/patterns/magasinier_2')).toMatchObject({
      pattern: { days: [{}, {}, {}, {}, {}] },
    });
    expect(await get('/schedule/activity-actions')).toMatchObject({
      items: { meal: ['go_to_meal'] },
    });
    expect(await get('/schedule/legend')).toMatchObject({ hoursPerDay: 25 });
    expect(await get('/villages')).toMatchObject({
      planet: 'tarsis_3',
      mining: [{ name: 'M0012', npcs: 3, storekeepers: 2, workplace: { source: 'usim' } }, {}],
    });
    expect(npc.tokens).toHaveLength(18);
  });

  it('refuses invalid input before calling the npc service', async () => {
    const { request, npc } = buildApp();
    const status = async (path: string, init: RequestInit = {}) =>
      (await request(`/api/npc${path}`, init)).status;

    expect(await status('/npcs?role=pilot')).toBe(400);
    expect(await status('/npcs?limit=5000')).toBe(400);
    expect(await status('/npcs?enabled=maybe')).toBe(400);
    expect(await status('/npcs/not-a-uuid')).toBe(400);
    expect(await status(`/npcs/${ids.alain}/logs?level=loud`)).toBe(400);
    expect(await status('/events?limit=0')).toBe(400);
    expect(await status('/schedule/patterns/Bad-Name')).toBe(400);
    expect(await status('/settings', json('PUT', { npcsEnabled: 'yes' }))).toBe(400);
    expect(await status('/npcs', json('POST', { count: 51 }))).toBe(400);
    expect(await status('/npcs', json('POST', { count: 2, firstName: 'Ann' }))).toBe(400);
    expect(await status('/npcs', json('POST', { role: 'storekeeper' }))).toBe(400);
    expect(await status('/npcs/bulk', json('POST', { action: 'spawn' }))).toBe(400);
    expect(
      await status('/npcs/bulk', json('POST', { action: 'spawn', count: 2, ids: [ids.denis] })),
    ).toBe(400);
    expect(await status('/npcs/bulk', json('POST', { action: 'delete', ids: [] }))).toBe(400);
    expect(await status(`/npcs/${ids.denis}`, json('PATCH', {}))).toBe(400);
    expect(await status(`/npcs/${ids.denis}`, json('PATCH', { password: 'x' }))).toBe(400);
    expect(await status(`/npcs/${ids.denis}`, json('PATCH', { storekeeperSlot: 6 }))).toBe(400);
    expect(
      await status(`/npcs/${ids.denis}/tasks`, json('POST', { kind: 'wait', params: {} })),
    ).toBe(400);
    expect(
      await status(
        `/npcs/${ids.denis}/tasks`,
        json('POST', { kind: 'wait', params: { seconds: 3601 } }),
      ),
    ).toBe(400);
    expect(
      await status(
        `/npcs/${ids.denis}/tasks`,
        json('POST', { kind: 'go_to_position', params: { position: { x: 1, y: 2 } } }),
      ),
    ).toBe(400);
    expect(await status(`/npcs/${ids.denis}/tasks/abc`, { method: 'DELETE' })).toBe(400);
    expect(
      await status('/schedule/patterns', json('POST', { days: ['TTT'] })), // no name
    ).toBe(400);
    expect(
      await status('/schedule/patterns', json('POST', { name: 'night', days: ['TTT', 'TT'] })),
    ).toBe(400);
    expect(await status('/schedule/patterns', json('POST', { name: 'night', days: ['TTX'] }))).toBe(
      400,
    );
    expect(
      await status('/schedule/patterns/night', json('PUT', { name: 'other', days: ['TTT'] })),
    ).toBe(400);
    expect(await status('/schedule/activity-actions', json('PUT', {}))).toBe(400);
    expect(await status('/schedule/activity-actions', json('PUT', { sleep: ['go_home'] }))).toBe(
      400,
    );
    expect(await status('/schedule/import', json('POST', { mode: 'replace' }))).toBe(400);
    expect(await status('/villages/M0012/workplace', json('PUT', { warehouseId: 'x' }))).toBe(400);
    expect(npc.tokens).toHaveLength(0);
  });

  it('switches NPCs, creates, spawns and removes them, recording each write', async () => {
    const { request, npc, audited } = buildApp();

    const off = await request('/api/npc/settings', json('PUT', { npcsEnabled: false }));
    expect(await off.json()).toMatchObject({
      settings: { npcsEnabled: false },
      counts: { running: 0, connected: 0 },
    });
    const created = await request(
      '/api/npc/npcs',
      json('POST', { count: 2, role: 'villager', enabled: false }),
    );
    expect(created.status).toBe(201);
    const { created: rows } = (await created.json()) as { created: { id: string }[] };
    expect(rows).toHaveLength(2);
    const spawned = await request(
      '/api/npc/npcs/bulk',
      json('POST', { action: 'spawn', count: 1 }),
    );
    // The oldest disabled NPC first.
    expect(await spawned.json()).toEqual({ affected: [ids.denis], errors: [] });
    const one = await request(`/api/npc/npcs/${ids.elise}/spawn`, { method: 'POST' });
    expect(await one.json()).toMatchObject({ npc: { enabled: true } });
    const deleted = await request(
      '/api/npc/npcs/bulk',
      json('POST', { action: 'delete', ids: rows.map((r) => r.id) }),
    );
    expect(await deleted.json()).toMatchObject({ affected: rows.map((r) => r.id) });
    expect((await request(`/api/npc/npcs/${ids.denis}`, { method: 'DELETE' })).status).toBe(204);
    const gone = await request(`/api/npc/npcs/${ids.denis}`);
    expect(gone.status).toBe(404);

    expect(npc.writes.map((w) => w.call)).toEqual([
      'PUT /settings',
      'POST /npcs',
      'POST /npcs/bulk',
      `POST /npcs/${ids.elise}/spawn`,
      'POST /npcs/bulk',
      `DELETE /npcs/${ids.denis}`,
    ]);
    expect(audited.map((a) => [a.service, a.method, a.path, a.status])).toEqual([
      ['npc', 'PUT', '/api/npc/settings', 200],
      ['npc', 'POST', '/api/npc/npcs', 201],
      ['npc', 'POST', '/api/npc/npcs/bulk', 200],
      ['npc', 'POST', `/api/npc/npcs/${ids.elise}/spawn`, 200],
      ['npc', 'POST', '/api/npc/npcs/bulk', 200],
      ['npc', 'DELETE', `/api/npc/npcs/${ids.denis}`, 204],
    ]);
  });

  it('edits an NPC, passing on the refusals of the service', async () => {
    const { request } = buildApp();

    const edited = await request(
      `/api/npc/npcs/${ids.denis}`,
      json('PATCH', {
        firstName: 'Dany',
        role: 'custom',
        actionProfile: ['take_a_walk', 'go_sell_object'],
        schedulePattern: 'magasinier_2',
        home: { uuid: ids.m0012Depot, planet: 'tarsis_3', position: { x: 1, y: 2, z: 3 } },
        actionConfig: { take_a_walk: { radius_m: 20 } },
      }),
    );
    expect(await edited.json()).toMatchObject({
      npc: { displayName: 'Dany Faure', role: 'custom', roleLocked: true },
    });
    const cleared = await request(
      `/api/npc/npcs/${ids.denis}`,
      json('PATCH', { schedulePattern: null, home: null }),
    );
    expect(await cleared.json()).toMatchObject({ npc: { schedulePattern: null, home: null } });
    const refused = await request(
      `/api/npc/npcs/${ids.denis}`,
      json('PATCH', { role: 'storekeeper' }),
    );
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({
      error: 'UPSTREAM_REJECTED',
      message: 'a storekeeper needs villageCode and storekeeperSlot',
    });
    const taken = await request(
      `/api/npc/npcs/${ids.denis}`,
      json('PATCH', { firstName: 'Alain', lastName: 'Deloin' }),
    );
    expect(taken.status).toBe(409);
    expect((await request(`/api/npc/npcs/${ids.denis}/reassign`, { method: 'POST' })).status).toBe(
      200,
    );
    expect(
      (await request(`/api/npc/npcs/${ids.denis}/reset-credentials`, { method: 'POST' })).status,
    ).toBe(204);
  });

  it('queues and cancels manual tasks, refusing to cancel a finished one', async () => {
    const { request, npc } = buildApp();

    const queued = await request(
      `/api/npc/npcs/${ids.alain}/tasks`,
      json('POST', {
        kind: 'go_to_position',
        params: { position: { x: 1, y: 0, z: 2 }, uuid: ids.m0012Depot, hold_s: 30 },
        forceOnline: true,
      }),
    );
    expect(queued.status).toBe(201);
    const { task } = (await queued.json()) as { task: { id: number } };
    expect(task).toMatchObject({ id: 5, status: 'pending', forceOnline: true });
    const cancelled = await request(`/api/npc/npcs/${ids.alain}/tasks/${task.id}`, {
      method: 'DELETE',
    });
    expect(await cancelled.json()).toMatchObject({ task: { id: 5, status: 'cancelled' } });
    const again = await request(`/api/npc/npcs/${ids.alain}/tasks/${task.id}`, {
      method: 'DELETE',
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ message: 'task 5 is not open' });
    // A task of another NPC is not found.
    const foreign = await request(`/api/npc/npcs/${ids.alain}/tasks/3`, { method: 'DELETE' });
    expect(foreign.status).toBe(404);
    const unknown = await request(
      `/api/npc/npcs/${ids.alain}/tasks`,
      json('POST', { kind: 'run_action', params: { action: 'go_sell_object' } }),
    );
    expect(unknown.status).toBe(400);
    expect(npc.writes.map((w) => w.call)).toEqual([
      `POST /npcs/${ids.alain}/tasks`,
      `DELETE /npcs/${ids.alain}/tasks/5`,
      `DELETE /npcs/${ids.alain}/tasks/5`,
      `DELETE /npcs/${ids.alain}/tasks/3`,
      `POST /npcs/${ids.alain}/tasks`,
    ]);
  });

  it('edits shift patterns, the activity mapping and workplaces, and imports schedules', async () => {
    const { request } = buildApp();
    const days = ['TTTTTaaratTTTTTaar.......', '.........................'];

    const created = await request(
      '/api/npc/schedule/patterns',
      json('POST', { name: 'night', description: 'Night crew', days }),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ pattern: { name: 'night', source: 'panel' } });
    const exists = await request(
      '/api/npc/schedule/patterns',
      json('POST', { name: 'night', days }),
    );
    expect(exists.status).toBe(409);
    const updated = await request(
      '/api/npc/schedule/patterns/night',
      json('PUT', { days: [days[1]] }),
    );
    expect(await updated.json()).toMatchObject({ pattern: { days: [days[1]] } });
    const used = await request('/api/npc/schedule/patterns/magasinier_1', { method: 'DELETE' });
    expect(used.status).toBe(409);
    expect(await used.json()).toMatchObject({
      message: "pattern 'magasinier_1' is used by 2 NPC(s)",
    });
    expect((await request('/api/npc/schedule/patterns/night', { method: 'DELETE' })).status).toBe(
      204,
    );

    const mapping = await request(
      '/api/npc/schedule/activity-actions',
      json('PUT', { meal: ['go_to_meal', 'detect_player_and_greet'] }),
    );
    expect(await mapping.json()).toMatchObject({
      items: { meal: ['go_to_meal', 'detect_player_and_greet'], off: ['go_home'] },
    });
    const badAction = await request(
      '/api/npc/schedule/activity-actions',
      json('PUT', { meal: ['fly'] }),
    );
    expect(badAction.status).toBe(400);

    const imported = await request(
      '/api/npc/schedule/import',
      json('POST', {
        mode: 'missing',
        yaml: 'schedules:\n  magasinier_1:\n    days:\n      - "T"\n  early:\n    days:\n      - "TTTT...."\n  Bad:\n    days:\n      - "T"\n',
      }),
    );
    expect(await imported.json()).toEqual({
      report: {
        created: ['early'],
        updated: [],
        skipped: ['magasinier_1'],
        errors: ["pattern name 'Bad' must match [a-z0-9_]{1,64}"],
      },
    });
    const shipped = await request('/api/npc/schedule/import', json('POST', { mode: 'overwrite' }));
    expect(await shipped.json()).toMatchObject({
      report: { updated: ['magasinier_1', 'magasinier_2'] },
    });

    const set = await request(
      '/api/npc/villages/M0013/workplace',
      json('PUT', { warehouseId: ids.m0013Depot, warehouseCode: 'M0013-D1' }),
    );
    expect(await set.json()).toMatchObject({
      workplace: { villageCode: 'M0013', source: 'manual' },
    });
    expect((await request('/api/npc/villages/M0013/workplace', { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await request('/api/npc/villages/M0013/workplace', { method: 'DELETE' })).status).toBe(
      404,
    );
  });

  it('sends the person token, opens reads to moderators and writes to admin and supervisor', async () => {
    const as = async (realmRoles: string[]) => {
      const ctx = setup(fakeProvider(() => tokens({ realmRoles, clientRoles: {} })));
      const { cookie } = await signIn(ctx);
      const send = async (method: string, path: string, body?: unknown) =>
        (
          await ctx.call(`/api/npc${path}`, {
            method,
            cookie,
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        ).status;
      return {
        statuses: {
          roster: await send('GET', '/npcs'),
          logs: await send('GET', `/npcs/${ids.alain}/logs`),
          switch: await send('PUT', '/settings', { npcsEnabled: false }),
          spawn: await send('POST', `/npcs/${ids.denis}/spawn`),
          task: await send('POST', `/npcs/${ids.alain}/tasks`, {
            kind: 'wait',
            params: { seconds: 10 },
          }),
        },
        tokens: ctx.npc.tokens,
        writes: ctx.npc.writes.length,
        audited: ctx.audited.filter((a) => a.service === 'npc').map((a) => a.status),
      };
    };

    const moderator = await as(['moderator']);
    expect(moderator.statuses).toEqual({
      roster: 200,
      logs: 200,
      switch: 403,
      spawn: 403,
      task: 403,
    });
    // The person's own token, never svc-admin; refused writes never reach the service.
    expect(moderator.tokens).toEqual(['Bearer access', 'Bearer access']);
    expect(moderator.writes).toBe(0);
    expect(moderator.audited).toEqual([403, 403, 403]);
    expect((await as(['admin'])).statuses).toEqual({
      roster: 200,
      logs: 200,
      switch: 200,
      spawn: 200,
      task: 201,
    });
    expect((await as(['supervisor'])).statuses).toMatchObject({ switch: 200 });
    // Without a moderation role the section stays closed (here, a persistence account).
    const ctx = setup(
      fakeProvider(() => tokens({ clientRoles: { 'dyingstar-admin': ['persistence:write'] } })),
    );
    const { cookie } = await signIn(ctx);
    expect((await ctx.call('/api/npc/npcs', { cookie })).status).toBe(403);
    expect(ctx.npc.tokens).toHaveLength(0);
  });
});

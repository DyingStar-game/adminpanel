import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { zMissionCatalogue, zMissionDetailAsServed } from '@dyingstar-admin/contracts/mission';
import {
  createMissionMock,
  MISSION_URL,
  missionGroupId,
  missionIds,
  missionNpcId,
} from './missionMock';

const mock = createMissionMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const read = (path: string) =>
  fetch(`${MISSION_URL}/api${path}`, { headers: { Authorization: 'Bearer token' } });

describe('mission mock (ADR 0013)', () => {
  it('answers as the contract says, as served by its code', async () => {
    const page = await (await read('/internal/missions')).json();
    expect(zMissionCatalogue.safeParse(page).error).toBeUndefined();
    expect(mock.tokens).toEqual(['Bearer token']);
  });

  it('lists every status newest first, filtered and paged', async () => {
    const all = zMissionCatalogue.parse(await (await read('/internal/missions')).json());
    expect(all.total).toBe(6);
    expect(all.missions[0]?.id).toBe(missionIds.delivery);
    expect(all.missions.map((m) => m.status)).toContain('cancelled');

    const page = zMissionCatalogue.parse(
      await (await read('/internal/missions?status=available&limit=1&offset=0')).json(),
    );
    expect(page).toMatchObject({ total: 3, limit: 1, offset: 0 });
    expect(page.missions).toHaveLength(1);
    expect((await read('/internal/missions?limit=101')).status).toBe(400);
    expect((await read('/internal/missions?category=lost')).status).toBe(400);
    // PR #37 cut the categories to five: the old ones are refused as a filter.
    expect((await read('/internal/missions?category=trading')).status).toBe(400);
  });

  it("serves every mission's detail as its code does", async () => {
    for (const id of Object.values(missionIds)) {
      const detail = await (await read(`/internal/missions/${id}`)).json();
      expect(zMissionDetailAsServed.safeParse(detail).error).toBeUndefined();
    }
  });

  it('gives objectives in order, every assignment, names, group, chain and summary', async () => {
    const delivery = zMissionDetailAsServed.parse(
      await (await read(`/internal/missions/${missionIds.delivery}`)).json(),
    );
    expect(delivery.objectives.map((o) => o.isBonus)).toEqual([false, true]);
    expect(delivery.assignments.map((a) => a.status)).toEqual([
      'active',
      'partially_completed',
      'abandoned',
    ]);
    // `social` names the players, not the NPC.
    expect(Object.keys(delivery.players)).toHaveLength(2);
    expect(delivery.players[missionNpcId]).toBeUndefined();
    expect(delivery.chain).toEqual([
      { id: missionIds.scenario, title: 'The first survey', status: 'completed' },
    ]);
    // The bonus objective is left out of the progress: 6 of 10 t.
    expect(delivery.summary).toMatchObject({
      assignments: 3,
      active: 1,
      partial: 1,
      progressBp: 6000,
    });

    const grouped = zMissionDetailAsServed.parse(
      await (await read(`/internal/missions/${missionIds.grouped}`)).json(),
    );
    expect(grouped.group).toEqual({ id: missionGroupId, name: 'Relay strike team' });
  });

  it('answers 404 for an unknown mission and 400 for an id that is not a UUID', async () => {
    expect((await read('/internal/missions/3a55105e-0000-4000-8000-0000000000ff')).status).toBe(
      404,
    );
    expect((await read('/internal/missions/expire')).status).toBe(400);
  });
});

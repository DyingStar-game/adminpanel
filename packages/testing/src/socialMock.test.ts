import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zAdjustReputationResponse,
  zGetCommunityStatsResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetProfileResponse,
  zGetReportResponse,
  zListReportsResponse,
  zIssueSanctionResponse,
  zListSanctionsResponse,
  zRevokeSanctionResponse,
  zSearchProfilesResponse,
  zEscalateReportResponse,
  zGetMeResponse,
  zUpdateReportStatusResponse,
} from '@dyingstar-admin/contracts/social';
import { createSocialDataset, createSocialMock, SOCIAL_URL, socialIds } from './socialMock';

const mock = createSocialMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const get = async (path: string) => {
  const res = await fetch(
    `${SOCIAL_URL}/api${path.startsWith('/profiles') ? '' : '/admin'}${path}`,
  );
  return { status: res.status, body: (await res.json()) as unknown };
};

describe('social mock', () => {
  // The mock must answer what the pinned contract says, or the panel's tests would lie.
  it.each<[string, z.ZodType]>([
    ['/stats', zGetCommunityStatsResponse],
    ['/log', zGetModerationLogResponse],
    ['/reports', zListReportsResponse],
    ['/reports/1', zGetReportResponse],
    [`/players/${socialIds.griefer}`, zGetPlayerRecordResponse],
    ['/sanctions', zListSanctionsResponse],
    ['/profiles?search=gri', zSearchProfilesResponse],
    [`/profiles/${socialIds.griefer}`, zGetProfileResponse],
  ])('answers %s as the contract says', async (path, schema) => {
    const { status, body } = await get(path);
    expect(status).toBe(200);
    expect(schema.safeParse(body).error).toBeUndefined();
  });

  it('filters reports and pages them', async () => {
    const open = await get('/reports?status=open');
    expect(open.body).toMatchObject({ total: 1, items: [{ id: 1 }] });
    const target = await get(`/reports?targetPlayerId=${socialIds.griefer}&limit=1`);
    expect(target.body).toMatchObject({ total: 2, limit: 1, items: [{ id: 2 }] });
  });

  it('answers 404 with social error body', async () => {
    expect(await get('/reports/99')).toMatchObject({ status: 404, body: { error: 'NOT_FOUND' } });
  });

  it('searches profiles by name, sorted by name', async () => {
    const all = await get('/profiles');
    expect(
      (all.body as { items: { displayName: string }[] }).items.map((p) => p.displayName),
    ).toEqual(['ddurieux', 'dev-moderator', 'griefer42']);
    expect(await get('/profiles?search=GRIEF')).toMatchObject({ body: { total: 1 } });
  });

  it('sanctions, lifts and adjusts reputation as the contract says', async () => {
    const send = async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`${SOCIAL_URL}/api/admin${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: (await res.json()) as unknown };
    };

    const issued = await send('POST', `/players/${socialIds.reporter}/sanctions`, {
      type: 'mute',
      reason: 'Spam',
      durationHours: 2,
    });
    expect(issued.status).toBe(201);
    expect(zIssueSanctionResponse.safeParse(issued.body).error).toBeUndefined();

    const id = (issued.body as { id: number }).id;
    const lifted = await send('DELETE', `/sanctions/${id}`);
    expect(zRevokeSanctionResponse.safeParse(lifted.body).error).toBeUndefined();
    expect((await send('DELETE', `/sanctions/${id}`)).status).toBe(404);

    const adjusted = await send('POST', `/players/${socialIds.reporter}/reputation`, {
      delta: -5,
      reason: 'Spam',
    });
    expect(zAdjustReputationResponse.safeParse(adjusted.body).error).toBeUndefined();
    expect(adjusted.body).toMatchObject({ reputation: -2 });
  });

  it('moves reports through the workflow as social does', async () => {
    const send = async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`${SOCIAL_URL}/api/admin${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: (await res.json()) as unknown };
    };
    const griefer = () => mock.data.players.find((p) => p.playerId === socialIds.griefer);
    const before = griefer()?.reputation ?? 0;

    // Report 2 (reviewing, raised by the system, at the admin level).
    const escalated = await send('POST', '/reports/2/escalate');
    expect(zEscalateReportResponse.safeParse(escalated.body).error).toBeUndefined();
    expect(escalated.body).toMatchObject({ status: 'open', escalation: 'supervisor' });
    expect((await send('POST', '/reports/2/escalate')).status).toBe(403);

    const dismissed = await send('PATCH', '/reports/2', { status: 'dismissed', note: 'Bot' });
    expect(zUpdateReportStatusResponse.safeParse(dismissed.body).error).toBeUndefined();
    // No reporter, no refund: the system's reports cost nothing (`social` checks both ids).
    expect(griefer()?.reputation).toBe(before);
    expect((await send('PATCH', '/reports/2', { status: 'resolved' })).status).toBe(409);
    expect(mock.data.log.at(-1)).toMatchObject({
      action: 'report_dismissed',
      details: { reportId: 2, note: 'Bot' },
    });
  });

  it("creates the caller's profile on their first GET /api/me, as social does", async () => {
    const fresh = createSocialMock(
      { ...createSocialDataset(), players: [] },
      'http://fresh.social.test',
    );
    server.use(...fresh.handlers);
    const res = await fetch('http://fresh.social.test/api/me');
    expect(zGetMeResponse.safeParse(await res.json()).error).toBeUndefined();
    expect(fresh.data.players.map((p) => p.playerId)).toEqual([socialIds.moderator]);
  });
});

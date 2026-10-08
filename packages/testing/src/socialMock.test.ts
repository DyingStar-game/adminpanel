import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zGetCommunityStatsResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetReportResponse,
  zListReportsResponse,
  zListSanctionsResponse,
} from '@dyingstar-admin/contracts/social';
import { createSocialMock, SOCIAL_URL, socialIds } from './socialMock';

const mock = createSocialMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const get = async (path: string) => {
  const res = await fetch(`${SOCIAL_URL}/api/admin${path}`);
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
});

import { Hono } from 'hono';
import { z } from 'zod';
import {
  zGetModerationLogQuery,
  zGetPlayerRecordPath,
  zGetReportPath,
  zListReportsQuery,
  zListSanctionsQuery,
} from '@dyingstar-admin/contracts/social';
import type { SessionContext } from '../auth/auth';
import type { SocialClient } from '../clients/social';
import { validate } from '../lib/validate';

/**
 * Query strings carry text: whole numbers become numbers before the contract's schemas
 * (`limit`, `offset`, `id`), which expect integers.
 */
const fromQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (raw) =>
      Object.fromEntries(
        Object.entries(raw as Record<string, string>).map(([key, value]) => [
          key,
          /^\d+$/.test(value) ? Number(value) : value,
        ]),
      ),
    schema,
  );

/**
 * `social` moderation, reading (ADR 0024 step 1): curated routes over `/api/admin/*`, inputs
 * validated with the pinned contract, the signed-in user's token forwarded. `social` checks the
 * moderation role; the panel's `social.moderate` permission guards the mount point.
 */
export function socialRoutes(social: SocialClient) {
  // Without authentication (tests) there is no session, hence no token.
  const token = (session: SessionContext['Variables']['session'] | undefined) =>
    session?.tokens.accessToken;

  return new Hono<SessionContext>()
    .get('/stats', async (c) => c.json(await social.stats(token(c.var.session))))
    .get('/log', validate('query', fromQuery(zGetModerationLogQuery)), async (c) =>
      c.json(await social.log(token(c.var.session), c.req.valid('query'))),
    )
    .get('/reports', validate('query', fromQuery(zListReportsQuery)), async (c) =>
      c.json(await social.reports(token(c.var.session), c.req.valid('query'))),
    )
    .get('/reports/:id', validate('param', fromQuery(zGetReportPath)), async (c) =>
      c.json(await social.report(token(c.var.session), c.req.valid('param').id)),
    )
    .get('/players/:playerId', validate('param', zGetPlayerRecordPath), async (c) =>
      c.json(await social.player(token(c.var.session), c.req.valid('param').playerId)),
    )
    .get('/sanctions', validate('query', fromQuery(zListSanctionsQuery)), async (c) =>
      c.json(await social.sanctions(token(c.var.session), c.req.valid('query'))),
    );
}

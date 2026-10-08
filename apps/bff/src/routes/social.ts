import { Hono } from 'hono';
import { z } from 'zod';
import {
  zAdjustReputationBody,
  zEscalateReportPath,
  zGetModerationLogQuery,
  zGetPlayerRecordPath,
  zGetReportPath,
  zIssueSanctionBody,
  zListReportsQuery,
  zListSanctionsQuery,
  zRevokeSanctionPath,
  zSearchProfilesQuery,
  zUpdateReportStatusBody,
  zUpdateReportStatusPath,
} from '@dyingstar-admin/contracts/social';
import { requirePermission, type SessionContext } from '../auth/auth';
import { ApiError } from '../lib/errors';
import {
  ErrorCode,
  REPORT_LEVEL_PERMISSION,
  reportActions,
  type ReportAction,
} from '@dyingstar-admin/schemas';
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
 * `social`, reading (ADR 0024 step 1): curated routes over `/api/admin/*` and the profile
 * search, inputs
 * validated with the pinned contract, the signed-in user's token forwarded. `social` checks the
 * moderation role; the panel's `social.moderate` permission guards the mount point.
 */
export function socialRoutes(social: SocialClient) {
  // Without authentication (tests) there is no session, hence no token.
  const token = (session: SessionContext['Variables']['session'] | undefined) =>
    session?.tokens.accessToken;

  /**
   * The panel's report rules (ADR 0024 › Update 2026-10-08), which `social` does not check: a
   * report is claimed before being decided or escalated, and handled at its escalation level.
   * Reads the report first.
   */
  const requireReportAction = async (
    session: SessionContext['Variables']['session'] | undefined,
    id: number,
    action: ReportAction,
  ) => {
    const { status, escalation } = await social.report(token(session), id);
    if (!reportActions(status).includes(action)) {
      const message =
        status === 'open' ? `Report #${id} must be claimed first` : `Report #${id} is ${status}`;
      throw new ApiError(409, ErrorCode.editConflict, message);
    }
    if (session && !session.permissions.includes(REPORT_LEVEL_PERMISSION[escalation])) {
      throw new ApiError(
        403,
        ErrorCode.forbidden,
        `Report #${id} is at the ${escalation} level: it needs that role`,
      );
    }
  };

  return (
    new Hono<SessionContext>()
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
      .get('/players', validate('query', fromQuery(zSearchProfilesQuery)), async (c) =>
        c.json(await social.profiles(token(c.var.session), c.req.valid('query'))),
      )
      .get('/players/:playerId', validate('param', zGetPlayerRecordPath), async (c) =>
        c.json(await social.player(token(c.var.session), c.req.valid('param').playerId)),
      )
      .get('/players/:playerId/profile', validate('param', zGetPlayerRecordPath), async (c) =>
        c.json(await social.profile(token(c.var.session), c.req.valid('param').playerId)),
      )
      .get('/sanctions', validate('query', fromQuery(zListSanctionsQuery)), async (c) =>
        c.json(await social.sanctions(token(c.var.session), c.req.valid('query'))),
      )
      // Acting on players (ADR 0024 step 3). `social` checks every role itself; the panel refuses
      // early what it knows `social` would, so the user gets a clear answer.
      .post(
        '/players/:playerId/sanctions',
        validate('param', zGetPlayerRecordPath),
        validate('json', zIssueSanctionBody),
        async (c) => {
          const body = c.req.valid('json');
          const severe = body.type === 'suspension' || body.type === 'ban';
          if (
            severe &&
            c.var.session &&
            !c.var.session.permissions.includes('social.sanctionSevere')
          ) {
            throw new ApiError(403, ErrorCode.forbidden, `A ${body.type} needs the admin role`);
          }
          const sanction = await social.issueSanction(
            token(c.var.session),
            c.req.valid('param').playerId,
            body,
          );
          return c.json(sanction, 201);
        },
      )
      .delete('/sanctions/:id', validate('param', fromQuery(zRevokeSanctionPath)), async (c) =>
        c.json(await social.revokeSanction(token(c.var.session), c.req.valid('param').id)),
      )
      .post(
        '/players/:playerId/reputation',
        requirePermission('social.reputation'),
        validate('param', zGetPlayerRecordPath),
        validate('json', zAdjustReputationBody),
        async (c) =>
          c.json(
            await social.adjustReputation(
              token(c.var.session),
              c.req.valid('param').playerId,
              c.req.valid('json'),
            ),
          ),
      )
      // Report actions (ADR 0024 step 3): claimed first, at the report's level or above.
      .patch(
        '/reports/:id',
        validate('param', fromQuery(zUpdateReportStatusPath)),
        validate('json', zUpdateReportStatusBody),
        async (c) => {
          const { id } = c.req.valid('param');
          const body = c.req.valid('json');
          await requireReportAction(c.var.session, id, body.status);
          return c.json(await social.updateReportStatus(token(c.var.session), id, body));
        },
      )
      .post(
        '/reports/:id/escalate',
        validate('param', fromQuery(zEscalateReportPath)),
        async (c) => {
          const { id } = c.req.valid('param');
          await requireReportAction(c.var.session, id, 'escalate');
          return c.json(await social.escalateReport(token(c.var.session), id));
        },
      )
  );
}

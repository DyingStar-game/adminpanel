import { Hono } from 'hono';
import {
  zAdjustReputationBody,
  zEscalateReportPath,
  zGetCorporationPath,
  zInternalCreateCorporationBody,
  zInternalCreatePoliticalEntityBody,
  zInternalSetCorporationMemberRankBody,
  zInternalSetCorporationMemberRankPath,
  zInternalTransferCorporationCeoBody,
  zInternalUpdateCorporationBody,
  zInternalUpdatePoliticalEntityBody,
  zGetPoliticalEntityPath,
  zGetModerationLogQuery,
  zGetPlayerRecordPath,
  zGetReportPath,
  zIssueSanctionBody,
  zListCorporationMembersQuery,
  zListCorporationsQuery,
  zListPoliticalChildrenQuery,
  zListPoliticalEntitiesQuery,
  zListPoliticalMembersQuery,
  zListReportsQuery,
  zListSubsidiariesQuery,
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
import { fromQuery, validate } from '../lib/validate';

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
      // Organisations, reading (ADR 0024 step 2).
      .get('/corporations', validate('query', fromQuery(zListCorporationsQuery)), async (c) =>
        c.json(await social.corporations(token(c.var.session), c.req.valid('query'))),
      )
      .get('/corporations/:corporationId', validate('param', zGetCorporationPath), async (c) =>
        c.json(await social.corporation(token(c.var.session), c.req.valid('param').corporationId)),
      )
      .get(
        '/corporations/:corporationId/members',
        validate('param', zGetCorporationPath),
        validate('query', fromQuery(zListCorporationMembersQuery)),
        async (c) =>
          c.json(
            await social.corporationMembers(
              token(c.var.session),
              c.req.valid('param').corporationId,
              c.req.valid('query'),
            ),
          ),
      )
      .get(
        '/corporations/:corporationId/subsidiaries',
        validate('param', zGetCorporationPath),
        validate('query', fromQuery(zListSubsidiariesQuery)),
        async (c) =>
          c.json(
            await social.subsidiaries(
              token(c.var.session),
              c.req.valid('param').corporationId,
              c.req.valid('query'),
            ),
          ),
      )
      .get('/politics', validate('query', fromQuery(zListPoliticalEntitiesQuery)), async (c) =>
        c.json(await social.politics(token(c.var.session), c.req.valid('query'))),
      )
      .get('/politics/:entityId', validate('param', zGetPoliticalEntityPath), async (c) =>
        c.json(await social.politicalEntity(token(c.var.session), c.req.valid('param').entityId)),
      )
      .get(
        '/politics/:entityId/members',
        validate('param', zGetPoliticalEntityPath),
        validate('query', fromQuery(zListPoliticalMembersQuery)),
        async (c) =>
          c.json(
            await social.politicalMembers(
              token(c.var.session),
              c.req.valid('param').entityId,
              c.req.valid('query'),
            ),
          ),
      )
      .get(
        '/politics/:entityId/children',
        validate('param', zGetPoliticalEntityPath),
        validate('query', fromQuery(zListPoliticalChildrenQuery)),
        async (c) =>
          c.json(
            await social.politicalChildren(
              token(c.var.session),
              c.req.valid('param').entityId,
              c.req.valid('query'),
            ),
          ),
      )
      // Organisation management (ADR 0024 step N): `svc-admin` on `social`'s internal API, for
      // people holding the capability role of its README (ADR 0023 › Social — management).
      .post(
        '/corporations',
        requirePermission('social.corporationWrite'),
        validate('json', zInternalCreateCorporationBody),
        async (c) => c.json(await social.createCorporation(c.req.valid('json')), 201),
      )
      .patch(
        '/corporations/:corporationId',
        requirePermission('social.corporationWrite'),
        validate('param', zGetCorporationPath),
        validate('json', zInternalUpdateCorporationBody),
        async (c) =>
          c.json(
            await social.updateCorporation(c.req.valid('param').corporationId, c.req.valid('json')),
          ),
      )
      .delete(
        '/corporations/:corporationId',
        requirePermission('social.corporationWrite'),
        validate('param', zGetCorporationPath),
        async (c) => {
          await social.disbandCorporation(c.req.valid('param').corporationId);
          return c.body(null, 204);
        },
      )
      .post(
        '/corporations/:corporationId/transfer',
        requirePermission('social.corporationWrite'),
        validate('param', zGetCorporationPath),
        validate('json', zInternalTransferCorporationCeoBody),
        async (c) =>
          c.json(
            await social.transferCorporation(
              c.req.valid('param').corporationId,
              c.req.valid('json').playerId,
            ),
          ),
      )
      .patch(
        '/corporations/:corporationId/members/:playerId',
        requirePermission('social.corporationWrite'),
        validate('param', zInternalSetCorporationMemberRankPath),
        validate('json', zInternalSetCorporationMemberRankBody),
        async (c) => {
          const { corporationId, playerId } = c.req.valid('param');
          return c.json(
            await social.setMemberRank(corporationId, playerId, c.req.valid('json').rankId),
          );
        },
      )
      .delete(
        '/corporations/:corporationId/members/:playerId',
        requirePermission('social.corporationWrite'),
        validate('param', zInternalSetCorporationMemberRankPath),
        async (c) => {
          const { corporationId, playerId } = c.req.valid('param');
          await social.removeMember(corporationId, playerId);
          return c.body(null, 204);
        },
      )
      .post(
        '/politics',
        requirePermission('social.politicsWrite'),
        validate('json', zInternalCreatePoliticalEntityBody),
        async (c) => c.json(await social.createPoliticalEntity(c.req.valid('json')), 201),
      )
      .patch(
        '/politics/:entityId',
        requirePermission('social.politicsWrite'),
        validate('param', zGetPoliticalEntityPath),
        validate('json', zInternalUpdatePoliticalEntityBody),
        async (c) =>
          c.json(
            await social.updatePoliticalEntity(c.req.valid('param').entityId, c.req.valid('json')),
          ),
      )
      .delete(
        '/politics/:entityId',
        requirePermission('social.politicsWrite'),
        validate('param', zGetPoliticalEntityPath),
        async (c) => {
          await social.disbandPoliticalEntity(c.req.valid('param').entityId);
          return c.body(null, 204);
        },
      )
      .post(
        '/politics/:entityId/transfer',
        requirePermission('social.politicsWrite'),
        validate('param', zGetPoliticalEntityPath),
        validate('json', zInternalTransferCorporationCeoBody),
        async (c) =>
          c.json(
            await social.transferPoliticalEntity(
              c.req.valid('param').entityId,
              c.req.valid('json').playerId,
            ),
          ),
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

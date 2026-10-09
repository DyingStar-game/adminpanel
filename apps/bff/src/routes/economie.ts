import { Hono } from 'hono';
import { z } from 'zod';
import {
  zCorporationAffiliation,
  zCorporationSettingsChange,
  zGetApiAdminStatsQuery,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsQuery,
  zPanelMint,
  zPanelMovement,
  zPoliticalSettingsChange,
} from '@dyingstar-admin/contracts/economie';
import { movementPermission, type Permission } from '@dyingstar-admin/schemas';
import { requirePermission, type SessionContext } from '../auth/auth';
import type { EconomieClient, WalletHolder } from '../clients/economie';
import { fromQuery, jsonSafe, validate } from '../lib/validate';

const IdParams = z.object({ id: z.uuid() });

const HolderParams = z.object({
  holder: z.enum(['players', 'npcs', 'corporations', 'politics']),
  id: z.uuid(),
});

/** Who may read a wallet: the capability role of `economie`'s README (ADR 0023 › Economie). */
const walletPermission = (holder: WalletHolder): Permission =>
  holder === 'politics' ? 'economie.politicsRead' : 'economie.walletRead';

const MovementParams = HolderParams.extend({ direction: z.enum(['credit', 'debit']) });

/**
 * `economie` (ADR 0024 step O): its dashboard with the user's token; wallets, political and
 * corporation settings, tax assessments through its internal API as `svc-admin`, each for the
 * capability role of its README held by the person. Inputs validated with the contract, as
 * `economie`'s code reads it (`contracts/economie/code.ts`).
 */
export function economieRoutes(economie: EconomieClient) {
  const token = (session: SessionContext['Variables']['session'] | undefined) =>
    session?.tokens.accessToken;

  /** Checks the permission of the holder's kind, read from the path. */
  const requireWalletPermission = (c: { req: { param: (key: 'holder') => string } }) =>
    requirePermission(walletPermission(c.req.param('holder') as WalletHolder));

  return (
    new Hono<SessionContext>()
      .get(
        '/stats',
        requirePermission('economie.dashboard'),
        validate('query', fromQuery(zGetApiAdminStatsQuery)),
        async (c) => c.json(await economie.stats(token(c.var.session), c.req.valid('query'))),
      )
      .get(
        '/wallets/:holder/:id',
        (c, next) => requireWalletPermission(c)(c, next),
        validate('param', HolderParams),
        async (c) => {
          const { holder, id } = c.req.valid('param');
          return c.json(await economie.wallet(holder, id));
        },
      )
      .get(
        '/wallets/:holder/:id/transactions',
        (c, next) => requireWalletPermission(c)(c, next),
        validate('param', HolderParams),
        validate('query', fromQuery(zGetApiInternalPlayersByPlayerIdWalletTransactionsQuery)),
        async (c) => {
          const { holder, id } = c.req.valid('param');
          // Transaction ids are int64 in the contract.
          return c.json(jsonSafe(await economie.ledger(holder, id, c.req.valid('query'))));
        },
      )
      // Money movements (step O.3).
      .post(
        '/wallets/:holder/:id/:direction',
        validate('param', MovementParams),
        (c, next) => {
          const { holder, direction } = c.req.valid('param');
          return requirePermission(movementPermission(holder, direction))(c, next);
        },
        validate('json', zPanelMovement),
        async (c) => {
          const { holder, id, direction } = c.req.valid('param');
          // The ledger row's id is int64 in the contract.
          const result = await economie.move(holder, id, direction, c.req.valid('json'));
          return c.json(jsonSafe(result), 201);
        },
      )
      .post(
        '/politics/:id/mint',
        requirePermission('economie.moneyIssue'),
        validate('param', IdParams),
        validate('json', zPanelMint),
        async (c) =>
          c.json(jsonSafe(await economie.mint(c.req.valid('param').id, c.req.valid('json'))), 201),
      )
      .get(
        '/politics/:id/settings',
        requirePermission('economie.politicsRead'),
        validate('param', IdParams),
        async (c) => c.json(await economie.politicalSettings(c.req.valid('param').id)),
      )
      // Settings and assessments (step O.2).
      .put(
        '/politics/:id/settings',
        requirePermission('economie.politicsManage'),
        validate('param', IdParams),
        validate('json', zPoliticalSettingsChange),
        async (c) =>
          c.json(
            await economie.updatePoliticalSettings(c.req.valid('param').id, c.req.valid('json')),
          ),
      )
      .post(
        '/politics/:id/taxes/assess',
        requirePermission('economie.politicsManage'),
        validate('param', IdParams),
        async (c) => c.json(await economie.assessTaxes(c.req.valid('param').id)),
      )
      .get(
        '/corporations/:id/settings',
        requirePermission('economie.corporationRead'),
        validate('param', IdParams),
        async (c) => c.json(await economie.corporationSettings(c.req.valid('param').id)),
      )
      .put(
        '/corporations/:id/settings',
        requirePermission('economie.corporationManage'),
        validate('param', IdParams),
        validate('json', zCorporationSettingsChange),
        async (c) =>
          c.json(
            await economie.updateCorporationSettings(c.req.valid('param').id, c.req.valid('json')),
          ),
      )
      .put(
        '/corporations/:id/affiliation',
        requirePermission('economie.corporationManage'),
        validate('param', IdParams),
        validate('json', zCorporationAffiliation),
        async (c) =>
          c.json(
            await economie.setCorporationAffiliation(
              c.req.valid('param').id,
              c.req.valid('json').politicalEntityId,
            ),
          ),
      )
  );
}

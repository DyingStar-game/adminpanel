import { Hono } from 'hono';
import { z } from 'zod';
import {
  zGetApiAdminStatsQuery,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsQuery,
} from '@dyingstar-admin/contracts/economie';
import type { Permission } from '@dyingstar-admin/schemas';
import { requirePermission, type SessionContext } from '../auth/auth';
import type { EconomieClient, WalletHolder } from '../clients/economie';
import { fromQuery, jsonSafe, validate } from '../lib/validate';

const HolderParams = z.object({
  holder: z.enum(['players', 'npcs', 'corporations', 'politics']),
  id: z.uuid(),
});

/** Who may read a wallet: the capability role of `economie`'s README (ADR 0023 › Economie). */
const walletPermission = (holder: WalletHolder): Permission =>
  holder === 'politics' ? 'economie.politicsRead' : 'economie.walletRead';

/**
 * `economie`, reading (ADR 0024 step O): its dashboard with the user's token, wallets and
 * political settings through its internal API as `svc-admin`. Inputs validated with the contract.
 */
export function economieRoutes(economie: EconomieClient) {
  const token = (session: SessionContext['Variables']['session'] | undefined) =>
    session?.tokens.accessToken;

  /** Checks the permission of the holder's kind, read from the path. */
  const requireWalletPermission = (c: { req: { param: (key: 'holder') => string } }) =>
    requirePermission(walletPermission(c.req.param('holder') as WalletHolder));

  return new Hono<SessionContext>()
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
    .get(
      '/politics/:id/settings',
      requirePermission('economie.politicsRead'),
      validate('param', z.object({ id: z.uuid() })),
      async (c) => c.json(await economie.politicalSettings(c.req.valid('param').id)),
    );
}

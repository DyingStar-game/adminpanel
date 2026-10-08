import type { z } from 'zod';
import type { zTransaction } from '@dyingstar-admin/contracts/economie';

/** A movement as the SPA reads it: its `int64` id is a `bigint` (`z.coerce.bigint()`). */
export type Transaction = z.infer<typeof zTransaction>;

/** An amount of a currency, as `economie` keeps it (integer units), grouped by thousands. */
export const formatAmount = (amount: number, currency: string, locale: string) =>
  `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;

/** A tax rate kept in basis points (500 = 5 %). */
export const formatBps = (bps: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(
    bps / 10_000,
  );

/**
 * A movement seen from a holder: received (+), paid (−, with the tax its payer bore), or between
 * two of its own accounts.
 */
export function signedAmount(
  transaction: Pick<Transaction, 'fromAccountId' | 'toAccountId' | 'amount' | 'taxAmount'>,
  own: Set<string>,
): number {
  const paid = own.has(transaction.fromAccountId ?? '');
  const received = own.has(transaction.toAccountId ?? '');
  if (paid && !received) return -(transaction.amount + transaction.taxAmount);
  return transaction.amount;
}

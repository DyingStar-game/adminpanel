import { z } from 'zod';
import type { zTransaction } from '@dyingstar-admin/contracts/economie';
import type { PoliticalEntityType } from '@dyingstar-admin/contracts/social';

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

/**
 * A rate typed in percent, up to two decimals, `.` or `,` (`2,5` → 250 bps); `economie` keeps
 * whole basis points from 0 to 10,000.
 */
export const zPercentField = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/)
  .refine((text) => percentToBps(text) <= 10_000);

/** The basis points of a rate typed in percent (`zPercentField`). */
export const percentToBps = (text: string) =>
  Math.round(Number.parseFloat(text.trim().replace(',', '.')) * 100);

/** A rate in basis points, as typed back in the form (`250` → `2.5`). */
export const bpsToPercent = (bps: number) => String(bps / 100);

/** A whole amount of credits typed in a form, up to `economie`'s 10¹³. */
export const zAmountField = z
  .string()
  .trim()
  .regex(/^\d{1,14}$/)
  .refine((text) => Number(text) <= 10_000_000_000_000);

/**
 * Levels that may issue money: `economie`'s README reserves it to countries and federations
 * without checking it (the panel's rule, ADR 0023 › Economie).
 */
export const MINTING_LEVELS: readonly PoliticalEntityType[] = ['country', 'federation'];

/**
 * The idempotency key of a money movement sent by the panel (`economie`'s `externalId`, up to
 * 128 characters): drawn once per dialog, so a resend of the same form is recorded once.
 */
export const movementKey = () => `admin-panel:${crypto.randomUUID()}`;

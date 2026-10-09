import { z } from 'zod';
import type { zTransaction } from '@dyingstar-admin/contracts/economie';
import type { PoliticalEntityType } from '@dyingstar-admin/contracts/social';
import { i18n } from '@/i18n';

/** A movement as the SPA reads it: its `int64` id is a `bigint` (`z.coerce.bigint()`). */
export type Transaction = z.infer<typeof zTransaction>;

/**
 * An amount of a currency, as `economie` keeps it (integer units), grouped by thousands, the
 * currency named in the reader's language with its plural (`economy.currencies.*`: 1 credit,
 * 2 credits; 0 or 1 crédit in French). A currency the panel does not know keeps its code.
 */
export const formatAmount = (amount: number, currency: string, locale: string) =>
  `${new Intl.NumberFormat(locale).format(amount)} ${currencyName(currency, locale, amount)}`;

/** A currency's name in the reader's language, for `count` of it (plural by default). */
export const currencyName = (currency: string, locale: string, count = 2) =>
  i18n.t(`economy.currencies.${currency}` as never, {
    count: Math.abs(count),
    lng: locale,
    defaultValue: currency,
  });

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

/** Largest amount `economie` takes (`routes/schemas.ts`: 10¹³ units). */
export const MAX_AMOUNT = 10_000_000_000_000;

/** A whole amount of credits typed in a number field (`valueAsNumber`), 0 to 10¹³. */
export const zAmount = z.number().int().min(0).max(MAX_AMOUNT);

/**
 * A rate typed in percent in a number field, 0 to 100, two decimals at most (2.5 = 250 basis
 * points); `economie` keeps whole basis points from 0 to 10,000.
 */
export const zPercent = z
  .number()
  .min(0)
  .max(100)
  .refine((percent) => Math.abs(percent * 100 - Math.round(percent * 100)) < 1e-6);

/** The basis points of a rate in percent (`2.5` → 250). */
export const percentToBps = (percent: number) => Math.round(percent * 100);

/** A rate in basis points, in percent for the form (`250` → 2.5). */
export const bpsToPercent = (bps: number) => bps / 100;

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

/**
 * Why a movement was made, as `economie` keeps it: its `reference` (the reason the panel sends,
 * up to 128 characters), else a donation's or a transfer's `memo` in its details.
 */
export function ledgerNote(transaction: Pick<Transaction, 'reference' | 'details'>): string | null {
  const memo = transaction.details?.memo;
  return transaction.reference || (typeof memo === 'string' && memo) || null;
}

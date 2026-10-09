import { describe, expect, it } from 'vitest';
import { accountIds, createEconomieDataset } from '@dyingstar-admin/testing';
import {
  bpsToPercent,
  currencyName,
  formatAmount,
  formatBps,
  ledgerNote,
  movementKey,
  percentToBps,
  signedAmount,
  zAmount,
  zPercent,
} from './economy';

const [reward, salary, transfer] = createEconomieDataset().transactions;

describe('economy formats', () => {
  it('writes amounts and rates in the reader’s language', () => {
    expect(formatAmount(1250, 'credits', 'en')).toBe('1,250 credits');
    // Plural forms of the reader's language, the sign set aside.
    expect(formatAmount(1, 'credits', 'en')).toBe('1 credit');
    expect(formatAmount(-1, 'credits', 'en')).toBe('-1 credit');
    expect(formatAmount(0, 'credits', 'en')).toBe('0 credits');
    expect(formatAmount(1, 'credits', 'fr')).toBe('1 crédit');
    expect(formatAmount(0, 'credits', 'fr')).toBe('0 crédit');
    expect(formatAmount(2500, 'credits', 'fr')).toMatch(/^2\s?500 crédits$/);
    // A currency the panel does not know keeps its code.
    expect(formatAmount(3, 'gold', 'en')).toBe('3 gold');
    expect(currencyName('credits', 'fr')).toBe('crédits');
    expect(formatBps(500, 'en')).toBe('5%');
    expect(formatBps(250, 'fr')).toMatch(/^2,5\s?%$/);
  });

  it('signs a movement from the holder’s side, its tax on the payer', () => {
    if (!reward || !salary || !transfer) throw new Error('fixtures missing');
    const reporter = new Set<string>([accountIds.reporter]);
    const griefer = new Set<string>([accountIds.griefer]);
    expect(signedAmount(reward, reporter)).toBe(1000);
    expect(signedAmount(transfer, reporter)).toBe(150);
    expect(signedAmount(transfer, griefer)).toBe(-160);
    expect(signedAmount(salary, griefer)).toBe(200);
  });
});

describe('economy form fields', () => {
  it('reads rates in percent as basis points, within 0 to 100 %, two decimals at most', () => {
    expect(percentToBps(2.5)).toBe(250);
    expect(percentToBps(12.34)).toBe(1234);
    expect(percentToBps(0.07)).toBe(7);
    expect(bpsToPercent(250)).toBe(2.5);
    expect(zPercent.safeParse(100).success).toBe(true);
    expect(zPercent.safeParse(0.07).success).toBe(true);
    for (const wrong of [100.01, -1, 1.234, Number.NaN]) {
      expect(zPercent.safeParse(wrong).success, String(wrong)).toBe(false);
    }
  });

  it('takes whole amounts up to 10¹³, an empty field (NaN) being none', () => {
    expect(zAmount.safeParse(10_000_000_000_000).success).toBe(true);
    for (const wrong of [10_000_000_000_001, 1.5, -1, Number.NaN]) {
      expect(zAmount.safeParse(wrong).success, String(wrong)).toBe(false);
    }
  });
});

describe('movementKey', () => {
  it("draws a new idempotency key each time, within economie's 128 characters", () => {
    const key = movementKey();
    expect(key).toMatch(/^admin-panel:[0-9a-f-]{36}$/);
    expect(movementKey()).not.toBe(key);
  });
});

describe('ledgerNote', () => {
  it('reads the reason of a movement, else its memo', () => {
    expect(ledgerNote({ reference: 'Refund', details: { memo: 'x' } })).toBe('Refund');
    expect(ledgerNote({ reference: null, details: { memo: 'For the hangar' } })).toBe(
      'For the hangar',
    );
    expect(ledgerNote({ reference: null, details: { taxTo: 'system' } })).toBeNull();
  });
});

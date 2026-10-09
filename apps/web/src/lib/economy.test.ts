import { describe, expect, it } from 'vitest';
import { accountIds, createEconomieDataset } from '@dyingstar-admin/testing';
import {
  bpsToPercent,
  formatAmount,
  formatBps,
  percentToBps,
  signedAmount,
  zAmountField,
  zPercentField,
} from './economy';

const [reward, salary, transfer] = createEconomieDataset().transactions;

describe('economy formats', () => {
  it('writes amounts and rates in the reader’s language', () => {
    expect(formatAmount(1250, 'credits', 'en')).toBe('1,250 credits');
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
  it('reads rates typed in percent as basis points, within 0 to 100 %', () => {
    expect(percentToBps('2,5')).toBe(250);
    expect(percentToBps('12.34')).toBe(1234);
    expect(bpsToPercent(250)).toBe('2.5');
    expect(zPercentField.safeParse('100').success).toBe(true);
    for (const wrong of ['100.01', '-1', '1.234', 'abc', '']) {
      expect(zPercentField.safeParse(wrong).success, wrong).toBe(false);
    }
  });

  it('takes whole amounts up to 10¹³', () => {
    expect(zAmountField.safeParse('10000000000000').success).toBe(true);
    expect(zAmountField.safeParse('10000000000001').success).toBe(false);
    expect(zAmountField.safeParse('1.5').success).toBe(false);
  });
});

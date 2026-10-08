import { describe, expect, it } from 'vitest';
import { accountIds, createEconomieDataset } from '@dyingstar-admin/testing';
import { formatAmount, formatBps, signedAmount } from './economy';

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

import { describe, expect, it } from 'vitest';
import { EconomySearchSchema } from './economySearch';

describe('economy search params', () => {
  it('shows the last 30 days by default, and keeps an offered period only', () => {
    expect(EconomySearchSchema.parse({})).toEqual({ days: 30 });
    expect(EconomySearchSchema.parse({ days: '7' })).toEqual({ days: 7 });
    expect(EconomySearchSchema.parse({ days: '12' })).toEqual({ days: 30 });
  });
});

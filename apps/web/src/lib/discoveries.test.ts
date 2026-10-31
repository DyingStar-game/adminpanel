import { describe, expect, it } from 'vitest';
import { isoOfUnix, planetLabel } from './discoveries';

describe('discovery helpers (ADR 0032)', () => {
  it("names a planet the wiki knows, and keeps another one's key", () => {
    expect(planetLabel('tarsis_3')).toBe('Tarsis III (Sandbox)');
    expect(planetLabel('tarsis_3_1')).toBe('Tarsis III.M1 (Korax)');
    expect(planetLabel('tarsis_9')).toBe('tarsis_9');
  });

  it('reads unix seconds, 0 being not yet', () => {
    expect(isoOfUnix(1_793_260_800)).toBe('2026-10-29T08:00:00.000Z');
    expect(isoOfUnix(0)).toBeNull();
  });
});

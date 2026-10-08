import { describe, expect, it } from 'vitest';
import type { Sanction } from '@dyingstar-admin/contracts/social';
import { activeSanctions } from './sanctions';

const sanction = (id: number, type: Sanction['type'], extra: Partial<Sanction> = {}): Sanction => ({
  id,
  playerId: '5b1d3c1e-0000-4000-8000-0000000000b2',
  type,
  reason: 'test',
  automatic: false,
  issuedBy: null,
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  createdAt: '2026-10-08T10:00:00.000Z',
  ...extra,
});

describe('activeSanctions', () => {
  it('keeps those in force, the most severe first', () => {
    const now = Date.parse('2026-10-08T12:00:00.000Z');
    const result = activeSanctions(
      [
        sanction(1, 'warning'),
        sanction(2, 'mute', { expiresAt: '2026-10-09T10:00:00.000Z' }),
        sanction(3, 'ban', { revokedAt: '2026-10-08T11:00:00.000Z' }),
        sanction(4, 'suspension', { expiresAt: '2026-10-08T11:00:00.000Z' }),
      ],
      now,
    );
    expect(result.map((s) => s.id)).toEqual([2, 1]);
  });
});

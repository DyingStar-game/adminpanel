import { describe, expect, it } from 'vitest';
import { NpcSearchSchema, NpcsSearchSchema } from './npcSearch';

describe('NPCs URL state (ADR 0026)', () => {
  it('opens on the roster, first page', () => {
    expect(NpcsSearchSchema.parse({})).toEqual({ tab: 'roster', page: 1 });
  });

  it('keeps valid filters and drops invalid ones', () => {
    expect(
      NpcsSearchSchema.parse({
        tab: 'routines',
        role: 'storekeeper',
        enabled: 'true',
        online: 'yes',
        page: '3',
        pattern: 'magasinier_1',
      }),
    ).toEqual({
      tab: 'routines',
      role: 'storekeeper',
      enabled: 'true',
      page: 3,
      pattern: 'magasinier_1',
    });
    expect(
      NpcsSearchSchema.parse({ tab: 'nope', role: 'pilot', page: 0, pattern: 'Bad Name' }),
    ).toEqual({ tab: 'roster', page: 1 });
  });

  it("opens an NPC's page on its overview", () => {
    expect(NpcSearchSchema.parse({})).toEqual({ tab: 'overview' });
    expect(NpcSearchSchema.parse({ tab: 'logs' })).toEqual({ tab: 'logs' });
  });
});

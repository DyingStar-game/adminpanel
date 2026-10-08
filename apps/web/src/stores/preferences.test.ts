import { describe, expect, it } from 'vitest';
import { usePreferences } from './preferences';

describe('preferences', () => {
  it('forgets the game server a viewer had picked: one per panel now (ADR 0024)', async () => {
    const { migrate, version } = usePreferences.persist.getOptions();
    expect(version).toBe(1);
    const migrated = await migrate?.(
      { locale: 'fr', serverId: 'universe-testing', live: false },
      0,
    );
    expect(migrated).toEqual({ locale: 'fr', live: false });
  });
});

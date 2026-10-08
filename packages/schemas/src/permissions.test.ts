import { describe, expect, it } from 'vitest';
import { Permission, permissionsOf } from './permissions';

describe('permissionsOf (interim matrix, ADR 0023)', () => {
  it('opens nothing to a player', () => {
    expect(permissionsOf(['player'])).toEqual([]);
  });

  it('lets persistence:read browse and run checks, not write', () => {
    expect(permissionsOf(['persistence:read'])).toEqual([
      Permission.persistenceRead,
      Permission.persistenceCheck,
    ]);
  });

  it('lets persistence:write and persistence:delete do everything on persistence', () => {
    for (const role of ['persistence:write', 'persistence:delete']) {
      expect(permissionsOf([role])).toEqual(Object.values(Permission));
    }
  });

  it('opens nothing of persistence to the moderation roles alone', () => {
    for (const role of ['moderator', 'admin', 'supervisor']) {
      expect(permissionsOf([role])).toEqual([]);
    }
    // With a persistence role, that role decides.
    expect(permissionsOf(['moderator', 'persistence:read'])).toEqual(
      permissionsOf(['persistence:read']),
    );
  });
});

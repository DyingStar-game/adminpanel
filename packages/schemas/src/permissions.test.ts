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
      expect(permissionsOf([role])).toEqual([
        Permission.persistenceRead,
        Permission.persistenceCheck,
        Permission.persistenceWrite,
        Permission.persistenceDelete,
      ]);
    }
  });

  it('opens nothing of persistence to the moderation roles alone', () => {
    for (const role of ['moderator', 'admin', 'supervisor']) {
      expect(permissionsOf([role]).filter((p) => p.startsWith('persistence.'))).toEqual([]);
    }
    // With a persistence role, that role decides persistence.
    const persistence = (roles: string[]) =>
      permissionsOf(roles).filter((p) => p.startsWith('persistence.'));
    expect(persistence(['moderator', 'persistence:read'])).toEqual(
      persistence(['persistence:read']),
    );
  });

  it("mirrors social's moderation roles (ADR 0024)", () => {
    expect(permissionsOf(['moderator'])).toEqual([Permission.socialModerate]);
    for (const role of ['admin', 'supervisor']) {
      expect(permissionsOf([role])).toEqual([
        Permission.socialModerate,
        Permission.socialSanctionSevere,
        Permission.socialReputation,
      ]);
    }
  });
});

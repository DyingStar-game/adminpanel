/**
 * What a signed-in user may do in the panel, derived from their Keycloak roles (ADR 0023). The
 * BFF enforces it on every route; the SPA only hides what the user may not do.
 */
export const Permission = {
  persistenceRead: 'persistence.read',
  persistenceCheck: 'persistence.check',
  persistenceWrite: 'persistence.write',
  persistenceDelete: 'persistence.delete',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Roles granting each permission (realm roles, or client roles of the panel's client).
 *
 * **Interim, while the panel is in test** (maintainer, 2026-10-08): the draft matrix of ADR 0023
 * with its undecided cells (🟡) allowed. Only the `persistence:*` roles open persistence: the
 * moderation roles (`moderator`, `admin`, `supervisor`) add nothing to it.
 */
export const PERMISSION_ROLES: Record<Permission, readonly string[]> = {
  [Permission.persistenceRead]: ['persistence:read', 'persistence:write', 'persistence:delete'],
  [Permission.persistenceCheck]: ['persistence:read', 'persistence:write', 'persistence:delete'],
  [Permission.persistenceWrite]: ['persistence:write', 'persistence:delete'],
  [Permission.persistenceDelete]: ['persistence:write', 'persistence:delete'],
};

export const ALL_PERMISSIONS = Object.values(Permission);

/** Permissions held through `roles`; none means the panel stays closed. */
export const permissionsOf = (roles: readonly string[]): Permission[] =>
  ALL_PERMISSIONS.filter((permission) =>
    PERMISSION_ROLES[permission].some((role) => roles.includes(role)),
  );

import { createContext, useContext } from 'react';
import { ALL_PERMISSIONS, type Permission } from '@dyingstar-admin/schemas';

/**
 * Permissions of the signed-in user, provided by the session gate (ADR 0023). Without a gate
 * (component tests) everything is allowed; the BFF enforces them anyway.
 */
export const PermissionsContext = createContext<readonly string[]>(ALL_PERMISSIONS);

/** Whether the user may do it; the SPA hides what they may not (the BFF refuses it). */
export function useCan() {
  const permissions = useContext(PermissionsContext);
  return (permission: Permission) => permissions.includes(permission);
}

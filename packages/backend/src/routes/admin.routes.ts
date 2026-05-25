/**
 * Keycloak user admin routes (`/api/admin`, requires server context).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import * as keycloak from '../services/keycloak.js';
import { logActivity } from '../services/activityLog.js';
import { requireServer } from '../middleware/serverContext.js';

/** Router for realm user listing and account updates. */
export const adminRoutes: IRouter = Router();

/** GET /users — List users for the server's Keycloak realm. */
adminRoutes.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const users = await keycloak.listUsers(server.services.keycloakRealm);
    res.json({ users, keycloakConfigured: keycloak.isKeycloakConfigured() });
  } catch (e) {
    next(e);
  }
});

/** GET /users/:id — Get one user by id. */
adminRoutes.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const user = await keycloak.getUser(server.services.keycloakRealm, req.params.id);
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (e) {
    next(e);
  }
});

/** PUT /users/:id/roles — Replace role names on a user. */
adminRoutes.put('/users/:id/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const { roles } = req.body as { roles: string[] };
    const user = await keycloak.updateUserRoles(server.services.keycloakRealm, req.params.id, roles);
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    logActivity('user_roles_updated', 'admin', user.username, server.id);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

/** PUT /users/:id/enabled — Enable or disable a user account. */
adminRoutes.put('/users/:id/enabled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const { enabled } = req.body as { enabled: boolean };
    const user = await keycloak.setUserEnabled(server.services.keycloakRealm, req.params.id, enabled);
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    logActivity(enabled ? 'user_enabled' : 'user_disabled', 'admin', user.username, server.id);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

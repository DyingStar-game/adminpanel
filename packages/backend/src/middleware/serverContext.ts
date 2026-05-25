/**
 * Middleware that binds the active game server to each protected API request.
 */
import type { Request, Response, NextFunction } from 'express';
import { getServerById } from '../config/servers.js';

/**
 * Requires `X-Server-Id` and attaches the matching {@link ServerConfig} to `req.server`.
 * @param req - Express request.
 * @param res - Express response.
 * @param next - Next middleware.
 */
export function serverContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const serverId = req.header('X-Server-Id');
  if (!serverId) {
    res.status(400).json({ error: 'MISSING_SERVER', message: 'Header X-Server-Id is required' });
    return;
  }
  const server = getServerById(serverId);
  if (!server) {
    res.status(404).json({ error: 'SERVER_NOT_FOUND', message: `Server ${serverId} not found` });
    return;
  }
  req.server = server;
  next();
}

/**
 * Placeholder auth middleware (pass-through until Keycloak JWT validation is wired).
 * @param _req - Express request.
 * @param _res - Express response.
 * @param next - Next middleware.
 */
export function authMiddlewareStub(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * Returns the server bound on the request; throws if middleware did not run.
 * @param req - Express request with `server` set.
 * @returns Non-null server configuration.
 */
export function requireServer(req: Request): NonNullable<Request['server']> {
  if (!req.server) throw new Error('Server context missing');
  return req.server;
}

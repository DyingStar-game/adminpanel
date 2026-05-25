/**
 * Per-server utility routes (mounted on protected router at `/api`).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { testServerConnectivity } from '../services/status.service.js';
import { requireServer } from '../middleware/serverContext.js';

/** Router for server-scoped diagnostics. */
export const serverRoutes: IRouter = Router();

/** GET /connectivity — Ping persistence, auth, and websocket for `X-Server-Id`. */
serverRoutes.get('/connectivity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await testServerConnectivity(requireServer(req));
    res.json(result);
  } catch (e) {
    next(e);
  }
});

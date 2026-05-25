/**
 * Public API routes (no `X-Server-Id` required): health, servers, status, activity log, prop descriptors.
 */
import { Router, type IRouter } from 'express';
import { listPublicServers } from '../config/servers.js';
import { getGlobalStatus } from '../services/status.service.js';
import { getActivityLog, logActivity, clearActivityLog } from '../services/activityLog.js';
import { listPropDescriptors, getPropDescriptor } from '../services/propDescriptors.js';

/** Router mounted at `/api` for unauthenticated/public endpoints. */
export const publicRoutes: IRouter = Router();

/** GET /health — API liveness check. */
publicRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

/** GET /servers — List game servers (public fields only). */
publicRoutes.get('/servers', (_req, res) => {
  res.json(listPublicServers());
});

/** GET /status — Global dashboard status; optional `X-Server-Id` scopes item count. */
publicRoutes.get('/status', async (req, res, next) => {
  try {
    const serverId = req.header('X-Server-Id') ?? undefined;
    const status = await getGlobalStatus(serverId);
    res.json(status);
  } catch (e) {
    next(e);
  }
});

/** GET /activity-log — Recent admin activity entries. */
publicRoutes.get('/activity-log', (_req, res) => {
  res.json(getActivityLog());
});

/** POST /cache/clear — Clears in-memory activity log and logs the action. */
publicRoutes.post('/cache/clear', (_req, res) => {
  clearActivityLog();
  logActivity('cache_cleared', 'admin');
  res.json({ ok: true });
});

/** GET /prop-descriptors — Lists prop descriptor metadata from GitHub. */
publicRoutes.get('/prop-descriptors', async (_req, res, next) => {
  try {
    res.json(await listPropDescriptors());
  } catch (e) {
    next(e);
  }
});

/** GET /prop-descriptors/:type — Fetches JSON content for one prop type. */
publicRoutes.get('/prop-descriptors/:type', async (req, res, next) => {
  try {
    const content = await getPropDescriptor(req.params.type);
    if (!content) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Descriptor not found' });
      return;
    }
    res.json(content);
  } catch (e) {
    next(e);
  }
});

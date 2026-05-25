/**
 * Ban management routes (`/api/bans`, requires server context via parent router).
 */
import { Router, type IRouter } from 'express';
import * as bans from '../services/bans.js';
import { logActivity } from '../services/activityLog.js';

/** Router for listing, creating, and removing player bans. */
export const bansRoutes: IRouter = Router();

/** GET / — List all bans. */
bansRoutes.get('/', (_req, res) => {
  res.json(bans.listBans());
});

/** POST / — Create a ban from request body. */
bansRoutes.post('/', (req, res) => {
  const ban = bans.createBan(req.body);
  logActivity('user_banned', 'admin', ban.username);
  res.status(201).json(ban);
});

/** DELETE /:id — Remove a ban by id. */
bansRoutes.delete('/:id', (req, res) => {
  const ok = bans.removeBan(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Ban not found' });
    return;
  }
  logActivity('ban_lifted', 'admin', req.params.id);
  res.status(204).send();
});

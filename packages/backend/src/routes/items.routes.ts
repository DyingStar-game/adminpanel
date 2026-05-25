/**
 * Persistence item CRUD routes (`/api/items`, requires server context).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { CreateItemRequest, PutItemRequest } from '@dyingstar/shared';
import { requireServer } from '../middleware/serverContext.js';
import { itemsService } from '../services/items.service.js';
import { logActivity } from '../services/activityLog.js';

/** Router for paginated item list and single-item CRUD. */
export const itemsRoutes: IRouter = Router();

/** GET / — List items with query pagination and filters. */
itemsRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const data = await itemsService.list(server, {
      page: parseInt(String(req.query.page ?? '1'), 10),
      page_size: parseInt(String(req.query.page_size ?? '20'), 10),
      object_type: req.query.object_type as string | undefined,
      scenename: req.query.scenename as string | undefined,
      parent_id: req.query.parent_id as string | undefined,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/** POST / — Create an item (assigns UUID if missing). */
itemsRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const body = req.body as CreateItemRequest;
    if (!body.object_uuid) body.object_uuid = randomUUID();
    const item = await itemsService.create(server, body);
    logActivity('item_created', 'admin', body.object_type, server.id);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

/** GET /:uuid — Get one item by UUID. */
itemsRoutes.get('/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const item = await itemsService.get(server, req.params.uuid);
    if (!item) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
      return;
    }
    res.json(item);
  } catch (e) {
    next(e);
  }
});

/** PUT /:uuid — Update an item by UUID. */
itemsRoutes.put('/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const item = await itemsService.update(server, req.params.uuid, req.body as PutItemRequest);
    if (!item) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
      return;
    }
    logActivity('item_updated', 'admin', req.params.uuid, server.id);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

/** DELETE /:uuid — Delete an item by UUID. */
itemsRoutes.delete('/:uuid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = requireServer(req);
    const ok = await itemsService.delete(server, req.params.uuid);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
      return;
    }
    logActivity('item_deleted', 'admin', req.params.uuid, server.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

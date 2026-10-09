import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import type { PersistenceContext } from '../middleware/persistence';

const UuidParam = z.object({ uuid: z.string().min(1) });
/**
 * `hide`: types the viewer hides, counted but not loaded (comma-separated); `include`: one item
 * to load even if its type is hidden (the selected one).
 */
const MapQuery = z.object({ hide: z.string().optional(), include: z.string().optional() });

/** Celestial body routes (ADR 0018); the target server comes from `requireServer`. */
export const bodiesRoutes = new Hono<PersistenceContext>().get(
  '/:uuid/map',
  validate('param', UuidParam),
  validate('query', MapQuery),
  async (c) => {
    const query = c.req.valid('query');
    const hide = (query.hide ?? '').split(',').filter(Boolean);
    return c.json(await c.var.items.bodyMap(c.req.valid('param').uuid, hide, query.include));
  },
);

import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import type { ServerContext } from '../middleware/server';

const UuidParam = z.object({ uuid: z.string().min(1) });
/** `hide`: types the viewer hides, loaded last (comma-separated). */
const MapQuery = z.object({ hide: z.string().optional() });

/** Celestial body routes (ADR 0018); the target server comes from `requireServer`. */
export const bodiesRoutes = new Hono<ServerContext>().get(
  '/:uuid/map',
  validate('param', UuidParam),
  validate('query', MapQuery),
  async (c) => {
    const hide = (c.req.valid('query').hide ?? '').split(',').filter(Boolean);
    return c.json(await c.var.items.bodyMap(c.req.valid('param').uuid, hide));
  },
);

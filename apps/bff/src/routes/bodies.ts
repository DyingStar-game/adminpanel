import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import type { ServerContext } from '../middleware/server';

const UuidParam = z.object({ uuid: z.string().min(1) });

/** Celestial body routes (ADR 0018); the target server comes from `requireServer`. */
export const bodiesRoutes = new Hono<ServerContext>().get(
  '/:uuid/map',
  validate('param', UuidParam),
  async (c) => c.json(await c.var.items.bodyMap(c.req.valid('param').uuid)),
);

import { Hono } from 'hono';
import { z } from 'zod';
import {
  CreateItemRequestSchema,
  DuplicateRequestSchema,
  ExistsRequestSchema,
  ImportCheckRequestSchema,
  createListItemsQuerySchema,
  UpdateItemRequestSchema,
} from '@dyingstar-admin/schemas';
import { parseQuery, validate } from '../lib/validate';
import type { ServerContext } from '../middleware/server';

const UuidParam = z.object({ uuid: z.string().min(1) });

/** Item routes; the target server comes from `requireServer`. */
export const itemsRoutes = new Hono<ServerContext>()
  .get('/', async (c) => {
    // Allowed object types come from the definitions (ADR 0006).
    const types = (await c.var.definitions.list()).definitions.map((d) => d.type);
    return c.json(await c.var.items.list(parseQuery(c, createListItemsQuerySchema(types))));
  })
  // Declared before `/:uuid` so `scenes` is not read as an item UUID.
  .get('/scenes', async (c) => c.json({ scenes: await c.var.items.scenes() }))
  .post('/import/check', validate('json', ImportCheckRequestSchema), async (c) =>
    c.json(await c.var.items.importCheck(c.req.valid('json').items)),
  )
  .post('/exists', validate('json', ExistsRequestSchema), async (c) =>
    c.json({ existing: await c.var.items.exists(c.req.valid('json').uuids) }),
  )
  .post('/', validate('json', CreateItemRequestSchema), async (c) =>
    c.json(await c.var.items.create(c.req.valid('json')), 201),
  )
  .get('/:uuid', validate('param', UuidParam), async (c) =>
    c.json(await c.var.items.get(c.req.valid('param').uuid)),
  )
  .post(
    '/:uuid/duplicate',
    validate('param', UuidParam),
    validate('json', DuplicateRequestSchema),
    async (c) =>
      c.json(
        { created: await c.var.items.duplicate(c.req.valid('param').uuid, c.req.valid('json')) },
        201,
      ),
  )
  .get('/:uuid/ancestors', validate('param', UuidParam), async (c) =>
    c.json(await c.var.items.ancestors(c.req.valid('param').uuid)),
  )
  .get('/:uuid/children-counts', validate('param', UuidParam), async (c) =>
    c.json(await c.var.items.childrenCounts(c.req.valid('param').uuid)),
  )
  .put(
    '/:uuid',
    validate('param', UuidParam),
    validate('json', UpdateItemRequestSchema),
    async (c) => {
      const { object_type, ...edit } = c.req.valid('json');
      return c.json(await c.var.items.update(c.req.valid('param').uuid, object_type, edit));
    },
  )
  .delete('/:uuid', validate('param', UuidParam), async (c) => {
    await c.var.items.remove(c.req.valid('param').uuid);
    return c.body(null, 204);
  });

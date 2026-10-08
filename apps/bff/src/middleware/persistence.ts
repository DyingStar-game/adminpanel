import { createMiddleware } from 'hono/factory';
import type { DefinitionsService } from '../services/definitions';
import type { ItemsService } from '../services/items';

export interface PersistenceContext {
  Variables: { items: ItemsService; definitions: DefinitionsService };
}

/** Gives the item routes the persistence of this panel's game server (ADR 0024). */
export const withPersistence = (items: ItemsService, definitions: DefinitionsService) =>
  createMiddleware<PersistenceContext>(async (c, next) => {
    c.set('items', items);
    c.set('definitions', definitions);
    await next();
  });

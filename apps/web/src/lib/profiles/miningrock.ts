import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

/** Mining rocks: generic views; numerous and of little interest on the map (ADR 0018). */
export const miningrock: z.input<typeof TypeProfileSchema> = {
  type: 'miningrock',
  columns: [],
  headline: [],
  relations: [],
  childrenFirst: [],
  renderers: {},
  map: { hidden: true },
};

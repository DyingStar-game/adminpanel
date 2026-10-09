import { KNOWN_RELATIONS } from '@dyingstar-admin/schemas';
import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

/** Spawn buildings: their village and the players living in their apartments (ADR 0022). */
export const spawnbuilding: z.input<typeof TypeProfileSchema> = {
  type: 'spawnbuilding',
  columns: [],
  headline: [],
  relations: KNOWN_RELATIONS.spawnbuilding ?? [],
  childrenFirst: ['player'],
  renderers: {},
};

import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const star: z.input<typeof TypeProfileSchema> = {
  type: 'star',
  columns: [],
  // No key facts: the schematic's chips give the star's facts; its position (the origin) and
  // the samples' timestamp, engine data, stay in the properties.
  headline: [],
  relations: [],
  childrenFirst: [],
  renderers: {},
  // Single star: planets have no parent yet, they orbit it implicitly (ADR 0008).
  implicitChildren: { objectType: 'planet', parentId: '' },
};

import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const star: z.input<typeof TypeProfileSchema> = {
  type: 'star',
  columns: [],
  headline: [['position'], ['from_timestamp']],
  relations: [],
  childrenFirst: [],
  renderers: {},
  // Single star: planets have no parent yet, they orbit it implicitly (ADR 0008).
  implicitChildren: { objectType: 'planet', parentId: '' },
};

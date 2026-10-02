import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const planet: z.input<typeof TypeProfileSchema> = {
  type: 'planet',
  columns: ['@kind', 'soi', 'from_timestamp'],
  headline: [['soi'], ['positions'], ['from_timestamp']],
  relations: [],
  childrenFirst: ['spawnbuilding', 'vehicle', 'cargo_depot', 'miningzone', 'planet', 'miningrock'],
  renderers: { positions: 'orbitalSamples' },
  hidden: ['rotations'],
  moonWhenParentIs: 'planet',
  map: { body: true },
};

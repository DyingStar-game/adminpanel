import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const planet: z.input<typeof TypeProfileSchema> = {
  type: 'planet',
  columns: ['@kind', 'soi', 'from_timestamp'],
  // No key facts: the schematic's chips give the body's facts and its sphere of influence;
  // `positions` / `from_timestamp` (orbital samples for the engine) stay in the properties.
  headline: [],
  relations: [],
  childrenFirst: ['spawnbuilding', 'vehicle', 'cargo_depot', 'miningzone', 'planet', 'miningrock'],
  renderers: { positions: 'orbitalSamples' },
  hidden: ['rotations'],
  moonWhenParentIs: 'planet',
  map: { body: true },
};

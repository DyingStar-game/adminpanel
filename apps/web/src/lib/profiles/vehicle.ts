import { KNOWN_RELATIONS } from '@dyingstar-admin/schemas';
import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const vehicle: z.input<typeof TypeProfileSchema> = {
  type: 'vehicle',
  // Where the vehicle is and who is in it; engine / handbrake / odometer stay on the object page.
  columns: ['parent_id', 'pilot_uuid', 'speed', 'mass', 'cargo_mass'],
  headline: [
    ['speed'],
    ['engine'],
    ['handbrake'],
    ['limiter_on', 'limiter_kmh'],
    ['odometer_km'],
    ['mass', 'cargo_mass'],
  ],
  relations: KNOWN_RELATIONS.vehicle ?? [],
  childrenFirst: ['vehicle_component'],
  // A truck is several metres long: 2 m made duplicated vehicles collide.
  spawnDistance: 8,
  // Spawned at ground level, a duplicated vehicle got stuck in the ground.
  spawnHeight: 1,
  renderers: {
    doors: 'namedMap',
    seats: 'namedMap',
    components: 'namedMap',
    suspension: 'inlineList',
  },
};

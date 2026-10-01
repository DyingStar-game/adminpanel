import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const vehicle: z.input<typeof TypeProfileSchema> = {
  type: 'vehicle',
  columns: ['speed', 'engine', 'handbrake', 'odometer_km', 'pilot_uuid'],
  headline: [
    ['speed'],
    ['engine'],
    ['handbrake'],
    ['limiter_on', 'limiter_kmh'],
    ['odometer_km'],
    ['mass', 'cargo_mass'],
  ],
  relations: [
    { path: 'pilot_uuid', target: 'player', label: 'pilot' },
    { path: 'seats.*', target: 'player', label: 'seat' },
    { path: 'components.*', target: 'vehicle_component', label: 'component' },
  ],
  childrenFirst: ['vehicle_component'],
  renderers: {
    doors: 'namedMap',
    seats: 'namedMap',
    components: 'namedMap',
    suspension: 'inlineList',
  },
};

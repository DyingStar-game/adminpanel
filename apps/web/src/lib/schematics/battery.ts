import type { z } from 'zod';
import type { SchematicSchema } from './schema';

/**
 * Vehicle battery, any tier (`battery_t1`, …): one cell filled to its charge (`charge_j`)
 * against its tier capacity, in kWh like in game.
 */
export const battery: z.input<typeof SchematicSchema> = {
  id: 'battery',
  scenename: 'scenes/_universe/props/vehicles/battery_t*.tscn',
  title: 'battery',
  size: [12, 5],
  shapes: [
    { kind: 'battery', at: [0, 1], size: [11, 3], label: 'charge', value: { path: 'charge_j' } },
  ],
};

import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

/**
 * Storage areas: pads on the ground where crates are laid, named (`Storage_CentralYard`) and
 * sized in metres (`size` `{ x, y }`). `terrain_settled` is the game's ground fitting.
 */
export const storage_area: z.input<typeof TypeProfileSchema> = {
  type: 'storage_area',
  columns: ['size'],
  headline: [['name'], ['size']],
  relations: [],
  childrenFirst: [],
  renderers: { size: 'size' },
};

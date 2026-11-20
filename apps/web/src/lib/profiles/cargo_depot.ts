import type { z } from 'zod';
import { KNOWN_RELATIONS } from '@dyingstar-admin/schemas';
import type { TypeProfileSchema } from './schema';

/**
 * Cargo depots: the warehouse of a village (`poi_uuid`), all of them named `cargo_depot` in
 * persistence. A planet holds dozens side by side, so each is told from the others by its
 * village: `cargo_depot (M0001)`.
 */
export const cargo_depot: z.input<typeof TypeProfileSchema> = {
  type: 'cargo_depot',
  columns: [],
  headline: [['name']],
  relations: KNOWN_RELATIONS.cargo_depot ?? [],
  labelSuffix: 'poi_uuid',
  childrenFirst: [],
  renderers: {},
};

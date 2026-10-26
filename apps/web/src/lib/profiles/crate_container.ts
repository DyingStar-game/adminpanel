import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

/**
 * Crates (ADR 0029): what each holds and where it is, on the body, in a player's hands or in a
 * vehicle (`parent_id`). A mining depot packs one mineral into `content`; the crates laid by
 * the world have it empty.
 */
export const crate_container: z.input<typeof TypeProfileSchema> = {
  type: 'crate_container',
  columns: ['content', 'parent_id'],
  headline: [['content'], ['weight']],
  relations: [],
  childrenFirst: [],
  renderers: { content: 'goods' },
};

import type { ObjectiveSchematicInput } from './schema';

/** `owns_items`: own the quantity in `inventory`, a snapshot that can go down. */
export const ownsItems: ObjectiveSchematicInput = {
  kind: 'owns_items',
  good: { path: 'itemId' },
  progress: 'owned',
};

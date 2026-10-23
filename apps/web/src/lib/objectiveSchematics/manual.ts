import type { ObjectiveSchematicInput } from './schema';

/** `manual`: confirmed by the mission's issuer, nothing measured. */
export const manual: ObjectiveSchematicInput = {
  kind: 'manual',
  progress: 'confirmed',
};

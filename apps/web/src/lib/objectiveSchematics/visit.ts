import type { ObjectiveSchematicInput } from './schema';

/** `visit`: reach the POI; done at the first visit. */
export const visit: ObjectiveSchematicInput = {
  kind: 'visit',
  places: [{ path: 'zone', role: 'target' }],
  progress: 'reached',
};

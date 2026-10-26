import type { ObjectiveSchematicInput } from './schema';

/** `deliver_material`: be inside the POI carrying the goods; where they come from is not checked. */
export const deliverMaterial: ObjectiveSchematicInput = {
  kind: 'deliver_material',
  places: [{ path: 'zone', role: 'dropoff' }],
  good: { path: 'goodType' },
  pooled: { path: 'scope', value: 'all' },
  progress: 'quantity',
};

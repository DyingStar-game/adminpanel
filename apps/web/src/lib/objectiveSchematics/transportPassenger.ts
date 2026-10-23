import type { ObjectiveSchematicInput } from './schema';

/** `transport_passenger`: bring that player, seated but not driving, to the POI. */
export const transportPassenger: ObjectiveSchematicInput = {
  kind: 'transport_passenger',
  places: [{ path: 'zone', role: 'dropoff' }],
  player: { path: 'passengerId' },
  progress: 'reached',
};

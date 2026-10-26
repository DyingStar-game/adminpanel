import type { ObjectiveSchematicInput } from './schema';

/** `transport`: load at `source`, then deliver at `zone` (`state.pickedUpAt` once loaded). */
export const transport: ObjectiveSchematicInput = {
  kind: 'transport',
  places: [
    { path: 'source', role: 'pickup' },
    { path: 'zone', role: 'dropoff' },
  ],
  good: { path: 'goodType' },
  loaded: { path: 'pickedUpAt' },
  progress: 'quantity',
};

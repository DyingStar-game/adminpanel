import type { z } from 'zod';
import type { SchematicSchema } from './schema';

/**
 * Ground truck: cab with two seats, cargo bed, four component compartments (today four
 * `engine_t1` engines): FL / FR at the top of the bed, RL / RR at its bottom. `suspension` (one value per wheel) is left aside until its mapping
 * is known (ADR 0016).
 */
export const truck: z.input<typeof SchematicSchema> = {
  id: 'truck',
  scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
  title: 'truck',
  size: [12, 20],
  shapes: [
    { kind: 'body', at: [2, 1], size: [8, 7], label: 'cab' },
    {
      kind: 'cargo',
      at: [2, 9],
      size: [8, 10],
      label: 'bed',
      value: { path: 'cargo_mass', unit: 'kg' },
    },
  ],
  seats: [
    { at: [4.5, 4.5], path: 'seats.seat_driver', label: 'driver' },
    { at: [7.5, 4.5], path: 'seats.seat_passenger', label: 'passenger' },
  ],
  // Bed spans y 9 → 19: front and rear bays sit 3 units from its front and rear edges.
  bays: [
    { at: [0.6, 12], path: 'components.slot_fl', label: 'FL', hatch: 'doors.hatch_fl' },
    { at: [11.4, 12], path: 'components.slot_fr', label: 'FR', hatch: 'doors.hatch_fr' },
    { at: [0.6, 16], path: 'components.slot_rl', label: 'RL', hatch: 'doors.hatch_rl' },
    { at: [11.4, 16], path: 'components.slot_rr', label: 'RR', hatch: 'doors.hatch_rr' },
  ],
  doors: [
    { at: [2, 5.5], path: 'doors.front_l_door', label: 'leftDoor' },
    { at: [10, 5.5], path: 'doors.front_r_door', label: 'rightDoor' },
  ],
  readouts: [
    { kind: 'gauge', path: 'speed', label: 'speed', unit: 'km/h', max: 'limiter_kmh' },
    { kind: 'toggle', path: 'engine', label: 'engine' },
    { kind: 'toggle', path: 'handbrake', label: 'handbrake' },
    { kind: 'toggle', path: 'headlights', label: 'headlights' },
    { kind: 'value', path: 'mass', label: 'mass', unit: 'kg' },
  ],
};

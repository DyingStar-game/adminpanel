import type { z } from 'zod';
import type { SchematicSchema } from './schema';

/**
 * Ground truck: cab with two seats and two doors, cargo bed with four component compartments
 * reached through hatches on the bed's sides (FL / FR at its front, RL / RR at its rear), each
 * holding an engine or a battery. `suspension` (one value per wheel) is left aside (ADR 0016).
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
  // Bed spans x 2 → 10, y 9 → 19: compartments sit inside it, by its sides, their hatches on
  // its edges like the cab doors; the bed's label and load stay in the middle.
  bays: [
    {
      at: [3.5, 11.5],
      path: 'components.slot_fl',
      label: 'FL',
      hatch: { at: [2, 11.5], path: 'doors.hatch_fl' },
    },
    {
      at: [8.5, 11.5],
      path: 'components.slot_fr',
      label: 'FR',
      hatch: { at: [10, 11.5], path: 'doors.hatch_fr' },
    },
    {
      at: [3.5, 16.5],
      path: 'components.slot_rl',
      label: 'RL',
      hatch: { at: [2, 16.5], path: 'doors.hatch_rl' },
    },
    {
      at: [8.5, 16.5],
      path: 'components.slot_rr',
      label: 'RR',
      hatch: { at: [10, 16.5], path: 'doors.hatch_rr' },
    },
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
    { kind: 'energy', label: 'energy' },
  ],
};

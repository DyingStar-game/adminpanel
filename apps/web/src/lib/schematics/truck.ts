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
    { at: [4.5, 4.5], path: 'seats.SeatDriver', label: 'driver' },
    { at: [7.5, 4.5], path: 'seats.SeatPassenger', label: 'passenger' },
  ],
  bays: [
    { at: [0.6, 10.5], path: 'components.Slot_FL', label: 'FL' },
    { at: [11.4, 10.5], path: 'components.Slot_FR', label: 'FR' },
    { at: [0.6, 16], path: 'components.Slot_RL', label: 'RL' },
    { at: [11.4, 16], path: 'components.Slot_RR', label: 'RR' },
  ],
  doors: [
    { at: [2, 5.5], path: 'doors.Front_l_door', label: 'leftDoor' },
    { at: [10, 5.5], path: 'doors.Front_r_door', label: 'rightDoor' },
  ],
  readouts: [
    { kind: 'gauge', path: 'speed', label: 'speed', unit: 'km/h', max: 'limiter_kmh' },
    { kind: 'toggle', path: 'engine', label: 'engine' },
    { kind: 'toggle', path: 'handbrake', label: 'handbrake' },
    { kind: 'toggle', path: 'headlights', label: 'headlights' },
    { kind: 'value', path: 'mass', label: 'mass', unit: 'kg' },
  ],
};

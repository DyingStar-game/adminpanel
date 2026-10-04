import type { z } from 'zod';
import type { SchematicSchema } from './schema';

/**
 * Planets and moons of the Tarsis system, drawn from their facts on the project wiki
 * (`lib/bodies.ts`): the body, its day and gravity, its moons on their orbits.
 */
export const celestial: z.input<typeof SchematicSchema> = {
  id: 'celestial',
  scenename: 'scenes/systems/tarsis/tarsis_*.tscn',
  title: 'celestial',
  size: [14, 12],
  shapes: [{ kind: 'celestial', at: [0, 0], size: [14, 12], label: 'celestial' }],
};

/** The system's star, drawn the same way. */
export const star: z.input<typeof SchematicSchema> = {
  ...celestial,
  id: 'star',
  scenename: 'scenes/_universe/environment/space/star.tscn',
  size: [14, 9],
  shapes: [{ kind: 'celestial', at: [0, 0], size: [14, 9], label: 'celestial' }],
};

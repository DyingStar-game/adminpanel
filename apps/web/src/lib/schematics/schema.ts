import { z } from 'zod';

/** Grid point `[x, y]` of a schematic, in grid units (top view). */
const Point = z.tuple([z.number(), z.number()]);
/** Dotted path into `object_data`, e.g. `seats.seat_driver`. */
const Path = z.string().min(1);

/**
 * Declarative schematic of one model, matched on its `scenename` (ADR 0016). Data only: one
 * generic renderer draws every schematic.
 */
export const SchematicSchema = z.object({
  id: z.string().min(1),
  /** Exact `scenename`, or a pattern where `*` matches within one path segment. */
  scenename: z.string().min(1),
  /** Label key (see `schematic.labels.*`). */
  title: z.string().min(1),
  /** Grid size `[width, height]`. */
  size: Point,
  shapes: z.array(
    z.object({
      /**
       * `battery`: a cell drawn as a progress bar filled to `value` (a charge in joules) against
       * the capacity of the item's own tier (`battery_t1` → 180 MJ).
       */
      /**
       * `celestial`: a planet, moon or star drawn from its wiki facts (`lib/bodies.ts`, matched
       * on the item's scene): disc, rotation and day, radius and gravity, moons on their orbits.
       */
      kind: z.enum(['body', 'cargo', 'battery', 'celestial']),
      at: Point,
      size: Point,
      label: z.string(),
      /** Value drawn inside the shape (e.g. `cargo_mass` on the bed). */
      value: z.object({ path: Path, unit: z.string().optional() }).optional(),
    }),
  ),
  /** Seats: reference to the player sitting there, or `""` when empty. */
  seats: z.array(z.object({ at: Point, path: Path, label: z.string() })).default([]),
  /** Component compartments: reference to the installed component, or `""` when empty. */
  bays: z
    .array(
      z.object({
        at: Point,
        path: Path,
        label: z.string(),
        /**
         * Access hatch of the compartment, drawn like a door: `at` is the middle of its leaf on
         * the body's edge, `path` its boolean open state (e.g. `doors.hatch_fl`).
         */
        hatch: z.object({ at: Point, path: Path }).optional(),
      }),
    )
    .default([]),
  /**
   * Lights drawn on the body's edge (`at` is their middle), lit with a beam when `path` is
   * true (e.g. the truck's headlights at the front of the cab).
   */
  lights: z.array(z.object({ at: Point, path: Path, label: z.string() })).default([]),
  /** Doors: boolean open state; absent while the model is not in use. */
  doors: z.array(z.object({ at: Point, path: Path, label: z.string() })).default([]),
  readouts: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('gauge'),
          path: Path,
          label: z.string(),
          unit: z.string().optional(),
          /** Path of the maximum (e.g. `limiter_kmh` for `speed`). */
          max: Path.optional(),
        }),
        z.object({ kind: z.literal('toggle'), path: Path, label: z.string() }),
        /**
         * Energy of the batteries installed in the bays (charge against their tier capacity) and
         * the autonomy estimated from the installed engines.
         */
        z.object({ kind: z.literal('energy'), label: z.string() }),
        z.object({
          kind: z.literal('value'),
          path: Path,
          label: z.string(),
          unit: z.string().optional(),
        }),
      ]),
    )
    .default([]),
});

export type Schematic = z.infer<typeof SchematicSchema>;

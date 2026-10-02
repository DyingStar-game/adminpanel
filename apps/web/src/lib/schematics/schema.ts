import { z } from 'zod';

/** Grid point `[x, y]` of a schematic, in grid units (top view). */
const Point = z.tuple([z.number(), z.number()]);
/** Dotted path into `object_data`, e.g. `seats.SeatDriver`. */
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
      kind: z.enum(['body', 'cargo']),
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
  bays: z.array(z.object({ at: Point, path: Path, label: z.string() })).default([]),
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

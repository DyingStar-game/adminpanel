import { z } from 'zod';

/** A path in an objective's `params` (dots for nested keys). */
const Path = z.string().min(1);

/**
 * A declarative schematic of one objective kind of `mission` (ADR 0026), in a closed vocabulary
 * extended only when a kind needs it.
 */
export const ObjectiveSchematicSchema = z.object({
  /** The kind of `mission`'s registry (`kinds/objectives/`), exactly. */
  kind: z.string().min(1),
  /**
   * The objective's POIs (`{ kind: 'poi', poiId }` in its `params`), drawn in order and joined
   * by an arrow: where goods are loaded, where they are delivered, where to go.
   */
  places: z
    .array(z.object({ path: Path, role: z.enum(['pickup', 'dropoff', 'target']) }))
    .default([]),
  /** What is carried or owned (a `goodType`, an `itemId`), with the objective's quantity. */
  good: z.object({ path: Path }).optional(),
  /** A player to bring (a player id). */
  player: z.object({ path: Path }).optional(),
  /** A delivery pooled between every assignee inside the place: `params` at `path` is `value`. */
  pooled: z.object({ path: Path, value: z.string() }).optional(),
  /** A two-phase kind: the objective's `state` at `path` is set once the goods are loaded. */
  loaded: z.object({ path: Path }).optional(),
  /**
   * How its progress reads: a quantity against the target (kept at its highest), a place
   * reached (kept once done), a quantity owned (can go down), or the issuer's confirmation.
   */
  progress: z.enum(['quantity', 'reached', 'owned', 'confirmed']),
});

export type ObjectiveSchematic = z.infer<typeof ObjectiveSchematicSchema>;
export type ObjectiveSchematicInput = z.input<typeof ObjectiveSchematicSchema>;
export type PlaceRole = ObjectiveSchematic['places'][number]['role'];

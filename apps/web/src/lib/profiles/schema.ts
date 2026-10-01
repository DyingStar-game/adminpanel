import { z } from 'zod';

/** Special renderers a profile can assign to a property (generic renderer otherwise). */
export const RendererSchema = z.enum([
  /** Object keyed by name (doors, seats, components): one line per entry, always expanded. */
  'namedMap',
  /** Short array of scalars shown inline (e.g. suspension). */
  'inlineList',
  /** Angle in radians, also shown in degrees. */
  'angle',
  /** `positions[]` paired with `rotations[]`: table of orbital samples. */
  'orbitalSamples',
]);
export type Renderer = z.infer<typeof RendererSchema>;

/**
 * Type profile (ADR 0008): refines the generic rendering of one object type. Data only, so it
 * is validated and easy to maintain alongside the `*_def.json` definitions.
 */
export const TypeProfileSchema = z.object({
  type: z.string().min(1),
  /** Extra table columns. `@kind` is the planet / moon column. */
  columns: z.array(z.string()),
  /** Headline facts of the object page; several keys are shown together (e.g. limiter). */
  headline: z.array(z.array(z.string()).min(1)),
  /** Known references, `*` matching one path segment (e.g. `seats.*`). */
  relations: z.array(
    z.object({ path: z.string().min(1), target: z.string().min(1), label: z.string().min(1) }),
  ),
  /** Children types shown first (others follow alphabetically). */
  childrenFirst: z.array(z.string()),
  renderers: z.record(z.string(), RendererSchema),
  /** Keys hidden because another renderer already shows them (e.g. `rotations`). */
  hidden: z.array(z.string()).default([]),
  /** `planet`: a planet whose parent is a planet is a moon. */
  moonWhenParentIs: z.string().optional(),
  /** `star`: bodies linked implicitly (single star system, ADR 0008). */
  implicitChildren: z.object({ objectType: z.string(), parentId: z.literal('') }).optional(),
});
export type TypeProfile = z.infer<typeof TypeProfileSchema>;

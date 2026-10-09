import { z } from 'zod';

/**
 * Object type definitions from horizonserver `ds_genericprops/props/<type>_def.json` (ADR 0006).
 * The object type is the file name without the `_def.json` suffix.
 */
export const LodTierSchema = z.object({ distance: z.number(), frequency: z.number() });

export const ChannelSchema = z.object({
  zone: z.number().int().nonnegative(),
  distance: z.number(),
  frequency: z.number(),
  lod: z.array(LodTierSchema).optional(),
  properties: z.array(z.string()),
});
export type Channel = z.infer<typeof ChannelSchema>;

/** Raw content of a `*_def.json` file. */
export const DefinitionFileSchema = z.object({ channels: z.array(ChannelSchema) });

export const ObjectDefinitionSchema = DefinitionFileSchema.extend({ type: z.string().min(1) });
export type ObjectDefinition = z.infer<typeof ObjectDefinitionSchema>;

export const DefinitionsResponseSchema = z.object({
  definitions: z.array(ObjectDefinitionSchema),
  /** `github` when freshly read, `fallback` when GitHub was unreachable. */
  source: z.enum(['github', 'fallback']),
});
export type DefinitionsResponse = z.infer<typeof DefinitionsResponseSchema>;

export const DEFINITION_FILE_SUFFIX = '_def.json';

/** `vehicle_def.json` → `vehicle`; null for any other file name. */
export function typeFromDefinitionFile(fileName: string): string | null {
  if (!fileName.endsWith(DEFINITION_FILE_SUFFIX)) return null;
  const type = fileName.slice(0, -DEFINITION_FILE_SUFFIX.length);
  return type.length > 0 ? type : null;
}

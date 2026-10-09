import { z } from 'zod';
import { isValidParentId, parseRaw, type PropertyRowValue } from './propertyForm';

export const PROPERTY_KINDS = ['text', 'number', 'boolean', 'vec3', 'json'] as const;

/** Error codes of the properties form, translated under `editor.errors.*`. */
export type PropertyErrorCode = 'number' | 'vec3' | 'json' | 'parent' | 'key' | 'duplicate';

const RowSchema = z
  .object({ key: z.string(), kind: z.enum(PROPERTY_KINDS), raw: z.string() })
  .superRefine((row, ctx) => {
    if (!row.key.trim()) ctx.addIssue({ code: 'custom', path: ['key'], message: 'key' });
    const parsed = parseRaw(row.raw, row.kind);
    if (!parsed.ok) ctx.addIssue({ code: 'custom', path: ['raw'], message: parsed.error });
    else if (row.key === 'parent_id' && (row.kind !== 'text' || !isValidParentId(row.raw))) {
      ctx.addIssue({ code: 'custom', path: ['raw'], message: 'parent' });
    }
  });

export const PropertiesSchema = z.array(RowSchema).superRefine((rows, ctx) => {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    if (seen.has(row.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: 'duplicate' });
    seen.add(row.key);
  });
});

export interface PropertiesFormValues {
  properties: PropertyRowValue[];
}

export const EditFormSchema = z.object({ properties: PropertiesSchema });

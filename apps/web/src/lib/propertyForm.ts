import { dequal } from 'dequal';
import { UuidSchema, Vec3Schema } from '@dyingstar-admin/schemas';

/** Editor used for one property (ADR 0008): typed inputs for scalars and vectors, JSON else. */
export type PropertyKind = 'text' | 'number' | 'boolean' | 'vec3' | 'json';

/** One editable row of the properties editor: raw text, parsed on submit. */
export interface PropertyRowValue {
  key: string;
  kind: PropertyKind;
  /** `vec3` raw values are `x,y,z` (three numbers). */
  raw: string;
}

const isVec3 = (value: unknown) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 3 &&
  Vec3Schema.safeParse(value).success;

export function inferKind(value: unknown): PropertyKind {
  if (typeof value === 'string') return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (isVec3(value)) return 'vec3';
  return 'json';
}

export function toRaw(value: unknown, kind: PropertyKind): string {
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : '';
    case 'number':
      return typeof value === 'number' ? String(value) : '';
    case 'boolean':
      return value === true ? 'true' : 'false';
    case 'vec3': {
      const v = Vec3Schema.safeParse(value);
      return v.success ? `${v.data.x},${v.data.y},${v.data.z}` : '0,0,0';
    }
    case 'json':
      return value === undefined ? 'null' : JSON.stringify(value, null, 2);
  }
}

export type ParseResult =
  { ok: true; value: unknown } | { ok: false; error: 'number' | 'vec3' | 'json' };

export function parseRaw(raw: string, kind: PropertyKind): ParseResult {
  switch (kind) {
    case 'text':
      return { ok: true, value: raw };
    case 'number': {
      const n = Number(raw);
      return raw.trim() !== '' && Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, error: 'number' };
    }
    case 'boolean':
      return { ok: true, value: raw === 'true' };
    case 'vec3': {
      const parts = raw.split(',').map((p) => Number(p.trim()));
      return parts.length === 3 && parts.every((n) => Number.isFinite(n))
        ? { ok: true, value: { x: parts[0], y: parts[1], z: parts[2] } }
        : { ok: false, error: 'vec3' };
    }
    case 'json':
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch {
        return { ok: false, error: 'json' };
      }
  }
}

/** Editable rows from an item's data, keys in their stored order. */
export const rowsFromData = (data: Record<string, unknown>): PropertyRowValue[] =>
  Object.entries(data).map(([key, value]) => {
    const kind = inferKind(value);
    return { key, kind, raw: toRaw(value, kind) };
  });

/** Parses every row; `null` when one does not parse (the form reports which). */
export function dataFromRows(rows: PropertyRowValue[]): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    const parsed = parseRaw(row.raw, row.kind);
    if (!parsed.ok) return null;
    data[row.key] = parsed.value;
  }
  return data;
}

/** What the user changed compared to the version they started from (merge-on-save, ADR 0009). */
export function editDiff(
  base: Record<string, unknown>,
  edited: Record<string, unknown>,
): { changes: Record<string, unknown>; removed: string[] } {
  const changes = Object.fromEntries(
    Object.entries(edited).filter(([key, value]) => !(key in base) || !dequal(base[key], value)),
  );
  const removed = Object.keys(base).filter((key) => !(key in edited));
  return { changes, removed };
}

/** `parent_id` is either empty (root) or a UUID. */
export const isValidParentId = (value: string) =>
  value === '' || UuidSchema.safeParse(value).success;

/**
 * Raw `x,y,z` from pasted text: a copied vector (`{"x":1,"y":2,"z":3}`) or three numbers
 * separated by commas or spaces. Null when the text is not a whole vector.
 */
export function parseVectorText(text: string): string | null {
  const trimmed = text.trim();
  try {
    const parsed = Vec3Schema.safeParse(JSON.parse(trimmed));
    if (parsed.success) return `${parsed.data.x},${parsed.data.y},${parsed.data.z}`;
  } catch {
    // Not JSON: try a plain list of numbers below.
  }
  const parts = trimmed
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? parts.join(',') : null;
}

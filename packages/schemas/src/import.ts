import { z } from 'zod';
import { UuidSchema } from './common';
import { QuaternionSchema, Vec3Schema } from './persistence';

/** Largest import accepted at once (ADR 0019). */
export const IMPORT_MAX_ITEMS = 5000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** What a finding is about; labels are translated in the web app (`import.codes.*`). */
export const ImportCodeSchema = z.enum([
  // Blocking (format and conventions).
  'notObject',
  'typeMissing',
  'dataNotObject',
  'uuidMissing',
  'uuidMalformed',
  'unknownType',
  'uuidMismatch',
  'duplicateUuid',
  'parentInvalid',
  'parentSelf',
  'parentCycle',
  'badShape',
  'aliasNotFound',
  'aliasAmbiguous',
  // Information.
  'aliasResolved',
  // Warnings (coherence with the server's data).
  'typeMismatch',
  'undeclaredKey',
  'kindMismatch',
  'parentNotFound',
  'parentTypeUnusual',
  'refNotFound',
  'refWrongType',
  'sceneUnknown',
  'sceneOtherType',
  'positionMissing',
]);
export type ImportCode = z.infer<typeof ImportCodeSchema>;

export const ImportFindingSchema = z.object({
  code: ImportCodeSchema,
  severity: z.enum(['error', 'warning', 'info']),
  /** Path of the faulty value, e.g. `object_data.position.y`. */
  path: z.string().optional(),
  /** Values for the message (expected kind, other row index, referenced UUID…). */
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type ImportFinding = z.infer<typeof ImportFindingSchema>;

/**
 * `invalid`: blocking errors, not sent. `new`: unknown on the server. `conflict`: already on
 * the server (skip or overwrite, ADR 0004).
 */
export const ImportStatusSchema = z.enum(['invalid', 'new', 'conflict']);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const ImportRowSchema = z.object({
  /** Position in the input array. */
  index: z.number().int().nonnegative(),
  object_uuid: z.string().nullable(),
  object_type: z.string().nullable(),
  status: ImportStatusSchema,
  findings: z.array(ImportFindingSchema),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

/** `POST /api/items/import/check` (ADR 0019): read-only, never writes. */
export const ImportCheckRequestSchema = z.object({
  items: z.array(z.unknown()).max(IMPORT_MAX_ITEMS),
});
export const ImportCheckResponseSchema = z.object({
  rows: z.array(ImportRowSchema),
  /** The items as checked, parent aliases replaced by UUIDs: what is to be sent. */
  items: z.array(z.unknown()),
});
export type ImportCheckResponse = z.infer<typeof ImportCheckResponseSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const FiniteVec3 = Vec3Schema.refine((v) => [v.x, v.y, v.z].every(Number.isFinite));

/** Well-known keys and the shape they must have (ADR 0019). */
const SHAPES: Record<string, { schema: z.ZodType; expected: string }> = {
  position: { schema: FiniteVec3, expected: 'vec3' },
  rotation: { schema: FiniteVec3, expected: 'vec3' },
  positions: { schema: z.array(FiniteVec3), expected: 'vec3[]' },
  rotations: { schema: z.array(z.union([QuaternionSchema, FiniteVec3])), expected: 'quaternion[]' },
  scenename: { schema: z.string().nullable(), expected: 'string' },
  name: { schema: z.string(), expected: 'string' },
};

const error = (
  code: ImportCode,
  path?: string,
  params?: ImportFinding['params'],
): ImportFinding => ({
  code,
  severity: 'error',
  ...(path ? { path } : {}),
  ...(params ? { params } : {}),
});

/**
 * Format and convention checks of an import that need no server (ADR 0019): every row is
 * `invalid` when it has an error, `new` otherwise (the BFF refines `new` / `conflict` and adds
 * warnings). `knownTypes` empty means no restriction (ADR 0015).
 */
export function checkImportFormat(items: unknown[], knownTypes: readonly string[]): ImportRow[] {
  const rows: ImportRow[] = items.map((raw, index) => {
    const findings: ImportFinding[] = [];
    if (!isRecord(raw)) {
      return {
        index,
        object_uuid: null,
        object_type: null,
        status: 'invalid',
        findings: [error('notObject')],
      };
    }
    const type = typeof raw.object_type === 'string' && raw.object_type ? raw.object_type : null;
    const uuid = typeof raw.object_uuid === 'string' ? raw.object_uuid : null;
    if (!type) findings.push(error('typeMissing', 'object_type'));
    else if (knownTypes.length > 0 && !knownTypes.includes(type)) {
      findings.push(error('unknownType', 'object_type', { type }));
    }
    if (raw.object_uuid === undefined) findings.push(error('uuidMissing', 'object_uuid'));
    else if (!uuid || !UuidSchema.safeParse(uuid).success) {
      findings.push(error('uuidMalformed', 'object_uuid'));
    }

    const data = raw.object_data;
    if (!isRecord(data)) {
      findings.push(error('dataNotObject', 'object_data'));
    } else {
      if (data.uuid !== undefined && data.uuid !== uuid) {
        findings.push(error('uuidMismatch', 'object_data.uuid'));
      }
      // `object_data.type` is not always the object type (a village's kind, e.g. `mining`):
      // it is checked against the server's items, as a warning (BFF).
      const parent = data.parent_id;
      // An alias left unresolved is reported by the alias resolution, not twice.
      if (parent !== undefined && parent !== null && !isParentAlias(parent)) {
        if (
          typeof parent !== 'string' ||
          (parent !== '' && !UuidSchema.safeParse(parent).success)
        ) {
          findings.push(error('parentInvalid', 'object_data.parent_id'));
        } else if (parent === uuid) {
          findings.push(error('parentSelf', 'object_data.parent_id'));
        }
      }
      for (const [key, { schema, expected }] of Object.entries(SHAPES)) {
        if (data[key] !== undefined && !schema.safeParse(data[key]).success) {
          findings.push(error('badShape', `object_data.${key}`, { expected }));
        }
      }
    }
    return {
      index,
      object_uuid: uuid,
      object_type: type,
      status: findings.length > 0 ? 'invalid' : 'new',
      findings,
    };
  });

  // Duplicate UUIDs inside the input: every occurrence after the first is blocking.
  const firstIndex = new Map<string, number>();
  for (const row of rows) {
    if (!row.object_uuid) continue;
    const first = firstIndex.get(row.object_uuid);
    if (first === undefined) firstIndex.set(row.object_uuid, row.index);
    else {
      // `row`: 1-based number of the first occurrence, as shown to the user.
      row.findings.push(error('duplicateUuid', 'object_uuid', { row: first + 1 }));
      row.status = 'invalid';
    }
  }

  // Parent cycles inside the input (A → B → A).
  const parentOf = new Map<string, string>();
  items.forEach((raw, i) => {
    const uuid = rows[i]?.object_uuid;
    const data = isRecord(raw) ? raw.object_data : undefined;
    if (uuid && isRecord(data) && typeof data.parent_id === 'string' && data.parent_id) {
      parentOf.set(uuid, data.parent_id);
    }
  });
  for (const row of rows) {
    const uuid = row.object_uuid;
    // A self parent is already `parentSelf`.
    if (!uuid || !parentOf.has(uuid) || parentOf.get(uuid) === uuid) continue;
    let current = parentOf.get(uuid);
    for (let steps = 0; current && current !== uuid && steps < parentOf.size; steps++) {
      current = parentOf.get(current);
    }
    if (current === uuid) {
      row.findings.push(error('parentCycle', 'object_data.parent_id'));
      row.status = 'invalid';
    }
  }
  return rows;
}

/**
 * Business rule (ADR 0019): `parent_id` may name its parent instead of giving its UUID, as
 * `_<object_type>_<name>` (e.g. `_planet_SandBox`). Types contain `_` themselves
 * (`poi_village`): the longest known type matching the prefix wins.
 */
export const isParentAlias = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('_') && value.length > 1;

export function parseParentAlias(
  value: string,
  knownTypes: readonly string[],
): { type: string; name: string } | null {
  if (!isParentAlias(value)) return null;
  const body = value.slice(1);
  const type = [...knownTypes]
    .sort((a, b) => b.length - a.length)
    .find((t) => body.startsWith(`${t}_`) && body.length > t.length + 1);
  return type ? { type, name: body.slice(type.length + 1) } : null;
}

/** An item that an alias may designate: on the server or in the import. */
export interface AliasCandidate {
  object_uuid: string;
  object_type: string;
  name: unknown;
}

/**
 * Replaces parent aliases by the UUID of the only item of that type with that name, among the
 * server's items and the import's own. Returns the resolved items and, per row index, an info
 * (resolved) or an error (not found, ambiguous, unknown type).
 */
export function resolveParentAliases(
  items: unknown[],
  candidates: AliasCandidate[],
  knownTypes: readonly string[],
): { items: unknown[]; findings: Map<number, ImportFinding[]> } {
  const findings = new Map<number, ImportFinding[]>();
  const byKey = new Map<string, string[]>();
  const keyOf = (type: string, name: string) => JSON.stringify([type, name]);
  for (const c of candidates) {
    if (typeof c.name !== 'string' || !c.name) continue;
    const key = keyOf(c.object_type, c.name);
    const uuids = byKey.get(key) ?? [];
    if (!uuids.includes(c.object_uuid)) uuids.push(c.object_uuid);
    byKey.set(key, uuids);
  }
  const path = 'object_data.parent_id';
  const resolved = items.map((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.object_data)) return raw;
    const alias = raw.object_data.parent_id;
    if (!isParentAlias(alias)) return raw;
    const parsed = parseParentAlias(alias, knownTypes);
    const matches = parsed ? (byKey.get(keyOf(parsed.type, parsed.name)) ?? []) : [];
    const [uuid] = matches;
    if (parsed && matches.length === 1 && uuid) {
      findings.set(index, [
        { code: 'aliasResolved', severity: 'info', path, params: { alias, uuid } },
      ]);
      return { ...raw, object_data: { ...raw.object_data, parent_id: uuid } };
    }
    findings.set(index, [
      parsed && matches.length > 1
        ? error('aliasAmbiguous', path, { alias, count: matches.length })
        : error('aliasNotFound', path, { alias }),
    ]);
    return raw;
  });
  return { items: resolved, findings };
}

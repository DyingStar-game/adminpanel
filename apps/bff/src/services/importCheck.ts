import {
  KNOWN_RELATIONS,
  valuesAt,
  type ImportFinding,
  type ImportRow,
  type Item,
  type ObjectDefinition,
} from '@dyingstar-admin/schemas';

/** Kind of a JSON value, as compared between imported and existing items (ADR 0019). */
export type ValueKind =
  'null' | 'boolean' | 'number' | 'string' | 'vec3' | 'quaternion' | 'array' | 'object';

export function valueKind(value: unknown): ValueKind {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort().join(',');
    if (keys === 'x,y,z') return 'vec3';
    if (keys === 'w,x,y,z') return 'quaternion';
  }
  return 'object';
}

/** What existing items of one type look like. */
interface TypeStats {
  count: number;
  /** Kinds seen per key. */
  kinds: Map<string, Set<ValueKind>>;
  /** Types of their parents (`''` for roots). */
  parentTypes: Set<string>;
  withPosition: number;
  /** Items having `object_data.type`, and those where it repeats the object type. */
  typeKey: { present: number; repeats: number };
}

export interface ImportContext {
  /** Declared properties per type; a type without definition has no entry. */
  declared: Map<string, Set<string>>;
  /** Every item on the server: UUID → type. */
  existing: Map<string, string>;
  stats: Map<string, TypeStats>;
  /** Scene → types using it. */
  scenes: Map<string, Set<string>>;
  /** Items by type and name, to spot an object imported twice. */
  named: Map<string, Item[]>;
}

/** Two positions closer than this, in metres on each axis, are the same place. */
const SAME_PLACE_M = 0.001;

const namedKey = (type: string, name: string) => JSON.stringify([type, name]);

const samePlace = (a: unknown, b: unknown) => {
  const pa = a as { x?: unknown; y?: unknown; z?: unknown } | null;
  const pb = b as { x?: unknown; y?: unknown; z?: unknown } | null;
  return (['x', 'y', 'z'] as const).every(
    (axis) =>
      typeof pa?.[axis] === 'number' &&
      typeof pb?.[axis] === 'number' &&
      Math.abs(pa[axis] - pb[axis]) < SAME_PLACE_M,
  );
};

/** Same object at the same place: same type, name, parent and position (business rule). */
const sameSpawn = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  (a.parent_id ?? '') === (b.parent_id ?? '') && samePlace(a.position, b.position);

/** Keys repeated from the item itself, never in definitions. */
const IDENTITY_KEYS = new Set(['uuid', 'type']);
/** Share of existing items with a `position` above which a missing one is reported. */
const POSITION_USUAL = 0.9;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Builds the check context from every item on the server and the type definitions. */
export function buildImportContext(all: Item[], definitions: ObjectDefinition[]): ImportContext {
  const existing = new Map(all.map((item) => [item.object_uuid, item.object_type]));
  const stats = new Map<string, TypeStats>();
  const scenes = new Map<string, Set<string>>();
  for (const item of all) {
    const entry = stats.get(item.object_type) ?? {
      count: 0,
      kinds: new Map(),
      parentTypes: new Set(),
      withPosition: 0,
      typeKey: { present: 0, repeats: 0 },
    };
    entry.count += 1;
    for (const [key, value] of Object.entries(item.object_data)) {
      const kinds = entry.kinds.get(key) ?? new Set();
      kinds.add(valueKind(value));
      entry.kinds.set(key, kinds);
    }
    const parent = item.object_data.parent_id ?? '';
    const parentType = parent ? existing.get(parent) : '';
    if (parentType !== undefined) entry.parentTypes.add(parentType);
    if (item.object_data.position !== undefined) entry.withPosition += 1;
    if (item.object_data.type !== undefined) {
      entry.typeKey.present += 1;
      if (item.object_data.type === item.object_type) entry.typeKey.repeats += 1;
    }
    stats.set(item.object_type, entry);

    const scene = item.object_data.scenename;
    if (typeof scene === 'string' && scene) {
      const types = scenes.get(scene) ?? new Set();
      types.add(item.object_type);
      scenes.set(scene, types);
    }
  }
  const declared = new Map(
    definitions.map((d) => [d.type, new Set(d.channels.flatMap((c) => c.properties))]),
  );
  const named = new Map<string, Item[]>();
  for (const item of all) {
    const name = item.object_data.name;
    if (typeof name !== 'string' || !name) continue;
    const key = namedKey(item.object_type, name);
    named.set(key, [...(named.get(key) ?? []), item]);
  }
  return { declared, existing, stats, scenes, named };
}

const warning = (
  code: ImportFinding['code'],
  path: string,
  params?: ImportFinding['params'],
): ImportFinding => ({ code, severity: 'warning', path, ...(params ? { params } : {}) });

/**
 * Coherence checks of an import against the server's data (ADR 0019), on top of the format
 * checks: `new` / `conflict` from the exact UUID set, and non-blocking warnings. Invalid rows
 * are returned unchanged.
 */
export function checkImportCoherence(
  items: unknown[],
  rows: ImportRow[],
  context: ImportContext,
): ImportRow[] {
  // Types of the items of the input itself, for parents and references inside it.
  const inputTypes = new Map(
    rows.flatMap((row) =>
      row.object_uuid && row.object_type ? [[row.object_uuid, row.object_type] as const] : [],
    ),
  );
  const typeOf = (uuid: string) => context.existing.get(uuid) ?? inputTypes.get(uuid);

  // Items of the input already met, by type and name: the same object twice in one import.
  const seenInInput = new Map<string, { index: number; data: Record<string, unknown> }[]>();

  return rows.map((row) => {
    if (row.status === 'invalid' || !row.object_uuid || !row.object_type) return row;
    const raw = items[row.index];
    const data = isRecord(raw) && isRecord(raw.object_data) ? raw.object_data : {};
    const type = row.object_type;
    const stats = context.stats.get(type);
    const findings = [...row.findings];

    const declared = context.declared.get(type);
    for (const [key, value] of Object.entries(data)) {
      const path = `object_data.${key}`;
      if (declared && !declared.has(key) && !IDENTITY_KEYS.has(key)) {
        findings.push(warning('undeclaredKey', path));
      }
      const usual = stats?.kinds.get(key);
      const kind = valueKind(value);
      if (usual && !usual.has(kind)) {
        findings.push(
          warning('kindMismatch', path, { expected: [...usual].sort().join(' | '), actual: kind }),
        );
      }
    }

    // `type` repeats the object type on most types, but not everywhere (a village's kind):
    // reported only where every existing item repeats it.
    if (
      data.type !== undefined &&
      data.type !== type &&
      stats &&
      stats.typeKey.present > 0 &&
      stats.typeKey.repeats === stats.typeKey.present
    ) {
      findings.push(warning('typeMismatch', 'object_data.type', { expected: type }));
    }

    const parent = typeof data.parent_id === 'string' ? data.parent_id : '';
    if (parent) {
      const parentType = typeOf(parent);
      if (!parentType)
        findings.push(warning('parentNotFound', 'object_data.parent_id', { uuid: parent }));
      else if (stats && stats.parentTypes.size > 0 && !stats.parentTypes.has(parentType)) {
        findings.push(warning('parentTypeUnusual', 'object_data.parent_id', { parentType }));
      }
    } else if (stats && stats.parentTypes.size > 0 && !stats.parentTypes.has('')) {
      findings.push(warning('parentTypeUnusual', 'object_data.parent_id', { parentType: '' }));
    }

    for (const relation of KNOWN_RELATIONS[type] ?? []) {
      for (const { path, value } of valuesAt(data, relation.path)) {
        if (typeof value !== 'string' || !value) continue;
        const target = typeOf(value);
        if (!target) findings.push(warning('refNotFound', `object_data.${path}`, { uuid: value }));
        else if (target !== relation.target) {
          findings.push(
            warning('refWrongType', `object_data.${path}`, {
              expected: relation.target,
              actual: target,
            }),
          );
        }
      }
    }

    const scene = data.scenename;
    if (typeof scene === 'string' && scene) {
      const users = context.scenes.get(scene);
      if (!users) findings.push(warning('sceneUnknown', 'object_data.scenename'));
      else if (!users.has(type)) {
        findings.push(
          warning('sceneOtherType', 'object_data.scenename', {
            types: [...users].sort().join(', '),
          }),
        );
      }
    }

    if (
      data.position === undefined &&
      stats &&
      stats.count > 0 &&
      stats.withPosition / stats.count >= POSITION_USUAL
    ) {
      findings.push(warning('positionMissing', 'object_data.position'));
    }

    // An object imported twice (business rule): the same name is a warning, the same name at
    // the same place (parent and position) an error. The item itself (same UUID) does not count.
    const name = data.name;
    if (typeof name === 'string' && name) {
      const key = namedKey(type, name);
      const others = (context.named.get(key) ?? []).filter(
        (item) => item.object_uuid !== row.object_uuid,
      );
      const twin = others.find((item) => sameSpawn(item.object_data, data));
      const inInput = (seenInInput.get(key) ?? []).find((seen) => sameSpawn(seen.data, data));
      if (twin) {
        findings.push({
          code: 'duplicateSpawn',
          severity: 'error',
          path: 'object_data.position',
          params: { uuid: twin.object_uuid },
        });
      } else if (inInput) {
        findings.push({
          code: 'duplicateSpawnInImport',
          severity: 'error',
          path: 'object_data.position',
          params: { row: inInput.index + 1 },
        });
      } else if (others[0] && !context.existing.has(row.object_uuid)) {
        // Only new items: an existing one (same UUID) is already reported as a conflict.
        findings.push(
          warning('possibleDuplicate', 'object_data.name', {
            uuid: others[0].object_uuid,
            count: others.length,
          }),
        );
      }
      seenInInput.set(key, [...(seenInInput.get(key) ?? []), { index: row.index, data }]);
    }

    const blocking = findings.some((f) => f.severity === 'error');
    return {
      ...row,
      status: blocking ? 'invalid' : context.existing.has(row.object_uuid) ? 'conflict' : 'new',
      findings,
    };
  });
}

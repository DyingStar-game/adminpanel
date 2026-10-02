import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ITEMS,
  type ImportRow,
  type ObjectData,
} from '@dyingstar-admin/schemas';

/** Result of reading the import text (ADR 0019). */
export type ParsedImport =
  | { ok: true; items: unknown[] }
  | { ok: false; reason: 'empty' | 'tooLarge' | 'tooMany' | 'notArray'; limit?: number }
  | { ok: false; reason: 'syntax'; line: number; column: number; message: string };

/** Line and column (1-based) of an offset in a text. */
function position(text: string, offset: number) {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Reads pasted or dropped JSON: strict JSON (no comments, no trailing commas), an array of items
 * or a single item, within the import limits. Syntax errors give their line and column.
 */
export function parseImportText(text: string): ParsedImport {
  if (!text.trim()) return { ok: false, reason: 'empty' };
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) {
    return { ok: false, reason: 'tooLarge', limit: IMPORT_MAX_BYTES };
  }
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  const first = errors[0];
  if (first) {
    return {
      ok: false,
      reason: 'syntax',
      ...position(text, first.offset),
      message: printParseErrorCode(first.error),
    };
  }
  const items = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : null;
  if (!items) return { ok: false, reason: 'notArray' };
  if (items.length > IMPORT_MAX_ITEMS)
    return { ok: false, reason: 'tooMany', limit: IMPORT_MAX_ITEMS };
  return { ok: true, items };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export interface NormalizedImport {
  items: unknown[];
  /** Rows whose UUID was generated (none in the input). */
  generated: Set<number>;
  /** Rows that received the default parent. */
  parented: Set<number>;
}

/**
 * Fills what the user may leave out: a UUID (generated) and, when a default level is given,
 * the `parent_id` of items without one. Other values are left as they are, to be checked.
 */
export function normalizeImport(
  items: unknown[],
  { defaultParentId, newUuid }: { defaultParentId: string | null; newUuid: () => string },
): NormalizedImport {
  const generated = new Set<number>();
  const parented = new Set<number>();
  const normalized = items.map((raw, index) => {
    if (!isRecord(raw)) return raw;
    const item = { ...raw };
    if (item.object_uuid === undefined) {
      item.object_uuid = newUuid();
      generated.add(index);
    }
    if (
      defaultParentId !== null &&
      isRecord(item.object_data) &&
      item.object_data.parent_id === undefined
    ) {
      item.object_data = { ...item.object_data, parent_id: defaultParentId };
      parented.add(index);
    }
    return item;
  });
  return { items: normalized, generated, parented };
}

/** Counts per status, and rows with warnings. */
export function importSummary(rows: ImportRow[]) {
  return {
    invalid: rows.filter((r) => r.status === 'invalid').length,
    new: rows.filter((r) => r.status === 'new').length,
    conflict: rows.filter((r) => r.status === 'conflict').length,
    warnings: rows.filter((r) => r.findings.some((f) => f.severity === 'warning')).length,
  };
}

/**
 * Waves in which rows are sent (ADR 0004): an item whose parent is in the same send goes in a
 * later wave than that parent, so rows of one wave can be sent concurrently. Input order is kept
 * inside a wave; a parent cycle cannot reach this point (rows are invalid).
 */
export function sendWaves(items: unknown[], indices: number[]): number[][] {
  const uuidOf = (index: number) => {
    const item = items[index];
    return isRecord(item) && typeof item.object_uuid === 'string' ? item.object_uuid : null;
  };
  const parentOf = (index: number) => {
    const item = items[index];
    const data = isRecord(item) ? item.object_data : undefined;
    return isRecord(data) && typeof data.parent_id === 'string' ? data.parent_id : '';
  };
  const byUuid = new Map<string, number>();
  for (const index of indices) {
    const uuid = uuidOf(index);
    if (uuid) byUuid.set(uuid, index);
  }
  const depths = new Map<number, number>();
  const depthOf = (index: number, guard = 0): number => {
    const known = depths.get(index);
    if (known !== undefined) return known;
    const parent = byUuid.get(parentOf(index));
    const depth =
      parent !== undefined && parent !== index && guard < indices.length
        ? depthOf(parent, guard + 1) + 1
        : 0;
    depths.set(index, depth);
    return depth;
  };
  const waves: number[][] = [];
  for (const index of indices) (waves[depthOf(index)] ??= []).push(index);
  return waves.filter(Boolean);
}

/**
 * Body of the full replace of an existing item by an imported one, through the merge-on-save
 * route: every imported key is set, every other stored key removed, forced (ADR 0004).
 */
export function overwriteRequest(latest: ObjectData, objectType: string, data: ObjectData) {
  return {
    object_type: objectType,
    base: latest,
    changes: data,
    removed: Object.keys(latest).filter((key) => !(key in data)),
    force: true,
  };
}

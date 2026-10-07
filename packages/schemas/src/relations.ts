/**
 * Known references between items (ADR 0008, 0022): a path in `object_data` holding the UUID of
 * an item of another type, `*` matching one object key (`seats.seat_driver`) and `[]` one array
 * element (`apartments[0].player_uuid`). Shared by the type profiles (views) and the coherence
 * checks of the import and the forms (ADR 0019, 0022).
 */
export interface KnownRelation {
  path: string;
  target: string;
  label: string;
  /**
   * What the target says back (ADR 0022): `parent`, its `parent_id` is the item; `key`, this
   * property of the target is the reference's last key (`slot_id` = `slot_fl`); `ref`, this
   * property of the target is the item's UUID.
   */
  inverse?: { parent?: boolean; key?: string; ref?: string };
  /** A target is held in one place only: once in the item, by one item of the type. */
  exclusive?: boolean;
}

/** References found on the live data (2026-10-07, ADR 0022). */
export const KNOWN_RELATIONS: Record<string, KnownRelation[]> = {
  vehicle: [
    { path: 'pilot_uuid', target: 'player', label: 'pilot' },
    { path: 'seats.*', target: 'player', label: 'seat' },
    {
      path: 'components.*',
      target: 'vehicle_component',
      label: 'component',
      inverse: { parent: true, key: 'slot_id' },
      exclusive: true,
    },
  ],
  player: [{ path: 'spawn_appartment_id', target: 'spawnbuilding', label: 'spawn apartment' }],
  spawnbuilding: [
    { path: 'poi_uuid', target: 'poi_village', label: 'village' },
    {
      path: 'apartments[].player_uuid',
      target: 'player',
      label: 'tenant',
      inverse: { ref: 'spawn_appartment_id' },
      exclusive: true,
    },
  ],
  // The other side points back only 22 times out of 52: one-way.
  miningrock: [{ path: 'fractures[].side2_uuid', target: 'miningrock', label: 'fracture' }],
};

/** Segments of a path: `a.b[2].c` → `a`, `b`, `[2]`, `c`; a pattern's `[]` stays `[]`. */
const segments = (path: string) => path.match(/\[\d*\]|[^.[\]]+/g) ?? [];

/** Matches a reference path (`seats.seat_driver`) against a pattern (`seats.*`). */
export function matchesPath(pattern: string, path: string): boolean {
  const a = segments(pattern);
  const b = segments(path);
  return (
    a.length === b.length &&
    a.every((segment, i) => {
      const other = b[i] ?? '';
      if (segment === '[]') return /^\[\d+\]$/.test(other);
      if (segment === '*') return !other.startsWith('[');
      return segment === other;
    })
  );
}

/**
 * Values at a relation's pattern in `object_data`, with their concrete path: `seats.*` gives
 * one entry per seat, `apartments[].player_uuid` one per apartment (`apartments[0].player_uuid`).
 * Missing paths give nothing.
 */
export function valuesAt(
  data: Record<string, unknown>,
  pattern: string,
): { path: string; value: unknown }[] {
  let entries: { path: string; value: unknown }[] = [{ path: '', value: data }];
  for (const segment of segments(pattern)) {
    entries = entries.flatMap(({ path, value }) => {
      if (segment === '[]') {
        return Array.isArray(value)
          ? value.map((v, i) => ({ path: `${path}[${i}]`, value: v }))
          : [];
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const record = value as Record<string, unknown>;
      const keys = segment === '*' ? Object.keys(record) : segment in record ? [segment] : [];
      return keys.map((key) => ({ path: path ? `${path}.${key}` : key, value: record[key] }));
    });
  }
  return entries;
}

/** Last object key of a concrete path: `components.slot_fl` → `slot_fl`. */
export const lastKey = (path: string): string =>
  segments(path)
    .filter((s) => !s.startsWith('['))
    .at(-1) ?? path;

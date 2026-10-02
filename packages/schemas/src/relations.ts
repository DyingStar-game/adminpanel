/**
 * Known references between items (ADR 0008): a path in `object_data` holding the UUID of an
 * item of another type, `*` matching one path segment (`seats.SeatDriver`). Shared by the type
 * profiles (views) and the bulk import checks (ADR 0019).
 */
export interface KnownRelation {
  path: string;
  target: string;
  label: string;
}

export const KNOWN_RELATIONS: Record<string, KnownRelation[]> = {
  vehicle: [
    { path: 'pilot_uuid', target: 'player', label: 'pilot' },
    { path: 'seats.*', target: 'player', label: 'seat' },
    { path: 'components.*', target: 'vehicle_component', label: 'component' },
  ],
  player: [{ path: 'spawn_appartment_id', target: 'spawnbuilding', label: 'spawn apartment' }],
};

/** Matches a reference path (`seats.SeatDriver`) against a pattern (`seats.*`). */
export function matchesPath(pattern: string, path: string): boolean {
  const a = pattern.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((segment, i) => segment === '*' || segment === b[i]);
}

/**
 * Values at a relation's pattern in `object_data`, with their concrete path: `seats.*` gives
 * one entry per seat. Missing paths give nothing.
 */
export function valuesAt(
  data: Record<string, unknown>,
  pattern: string,
): { path: string; value: unknown }[] {
  let entries: { path: string; value: unknown }[] = [{ path: '', value: data }];
  for (const segment of pattern.split('.')) {
    entries = entries.flatMap(({ path, value }) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const record = value as Record<string, unknown>;
      const keys = segment === '*' ? Object.keys(record) : segment in record ? [segment] : [];
      return keys.map((key) => ({ path: path ? `${path}.${key}` : key, value: record[key] }));
    });
  }
  return entries;
}

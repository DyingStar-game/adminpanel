import type { EditConflict, ObjectData } from '@dyingstar-admin/schemas';
import { dequal } from 'dequal';

export interface EditRequest {
  base: ObjectData;
  changes: Record<string, unknown>;
  removed: string[];
  force: boolean;
}

/**
 * Applies a user's edit on top of the latest stored `object_data` (ADR 0009).
 * Only the keys the user touched are written; untouched keys keep the latest value, so
 * concurrent game saves are not reverted. A touched key whose stored value moved since
 * `base` is a conflict, unless `force` is set.
 */
export function mergeEdit(
  latest: ObjectData,
  { base, changes, removed, force }: EditRequest,
): { data: ObjectData; conflicts: EditConflict[] } {
  const data: ObjectData = { ...latest };
  const toRemove = new Set<string>();
  const conflicts: EditConflict[] = [];
  const touched = [
    ...Object.entries(changes).map(([key, mine]) => ({ key, mine, remove: false })),
    ...removed.map((key) => ({ key, mine: undefined, remove: true })),
  ];

  for (const { key, mine, remove } of touched) {
    const moved = !dequal(base[key], latest[key]);
    const alreadyThere = remove ? !(key in latest) : dequal(latest[key], mine);
    if (moved && !alreadyThere && !force) {
      conflicts.push({ key, base: base[key], latest: latest[key], mine });
      continue;
    }
    if (remove) toRemove.add(key);
    else data[key] = mine;
  }

  return {
    data: Object.fromEntries(Object.entries(data).filter(([key]) => !toRemove.has(key))),
    conflicts,
  };
}

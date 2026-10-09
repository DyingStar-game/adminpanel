import { useCallback, useMemo } from 'react';
import type { Item } from '@dyingstar-admin/schemas';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { itemLabel } from '@/lib/itemLabel';
import { profileFor, relationFor } from '@/lib/profiles';
import { collectUuids } from '@/lib/valueShape';
import { useRefResolver } from './useRefResolver';

export interface ItemRef {
  path: string;
  uuid: string;
  /** Profile label (pilot, seat, component…) when the path is a known relation. */
  label: string | null;
  /** Expected target type from the profile, to flag a reference to another type. */
  expectedType: string | null;
}

/** Parent and outgoing references of an item, resolved and labelled by its type profile. */
export function useItemRefs(item: Item) {
  const data = item.object_data;
  const parentId = data.parent_id || undefined;
  const profile = profileFor(item.object_type);

  const refs: ItemRef[] = useMemo(
    () =>
      Object.entries(data)
        .filter(([key]) => key !== 'parent_id')
        .flatMap(([key, value]) => collectUuids(value, key))
        .filter((ref) => ref.uuid !== item.object_uuid)
        .map((ref) => {
          const relation = relationFor(profile, ref.path);
          return { ...ref, label: relation?.label ?? null, expectedType: relation?.target ?? null };
        }),
    [data, item.object_uuid, profile],
  );

  const resolveOthers = useRefResolver(
    useMemo(() => [...refs.map((r) => r.uuid), ...(parentId ? [parentId] : [])], [refs, parentId]),
  );
  // `object_data.uuid` repeats the item's own UUID: no need to fetch it.
  const resolveRef = useCallback(
    (uuid: string): RefTarget =>
      uuid === item.object_uuid
        ? { status: 'found', label: itemLabel(item), objectType: item.object_type }
        : resolveOthers(uuid),
    [item, resolveOthers],
  );

  return {
    refs,
    parentId,
    parentTarget: parentId ? resolveRef(parentId) : null,
    resolveRef,
    profile,
  };
}

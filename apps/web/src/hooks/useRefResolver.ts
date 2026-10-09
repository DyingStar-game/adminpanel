import { useCallback, useMemo } from 'react';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { itemLabel } from '@/lib/itemLabel';
import { useItems } from './queries';

/** Resolves referenced UUIDs (one cached GET each) into link targets for `ValueView`. */
export function useRefResolver(uuids: string[]): (uuid: string) => RefTarget {
  const unique = useMemo(() => [...new Set(uuids)].sort(), [uuids]);
  const results = useItems(unique);

  const targets = useMemo(() => {
    const map = new Map<string, RefTarget>();
    unique.forEach((uuid, i) => {
      const result = results[i];
      if (!result || result.isPending) map.set(uuid, { status: 'loading' });
      else if (!result.data) map.set(uuid, { status: 'missing' });
      else {
        map.set(uuid, {
          status: 'found',
          label: itemLabel(result.data),
          objectType: result.data.object_type,
          parentId: result.data.object_data.parent_id,
          scenename: result.data.object_data.scenename,
          data: result.data.object_data,
        });
      }
    });
    return map;
  }, [unique, results]);

  return useCallback((uuid) => targets.get(uuid) ?? { status: 'loading' }, [targets]);
}

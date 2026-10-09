import { useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';
import { CHANGE_HIGHLIGHT_MS } from '@/lib/live';

/**
 * Keys whose value changed between two snapshots of the same thing, kept for a short while so
 * the UI can highlight them (ADR 0009). Switching `identity` (another item, another page)
 * resets the comparison: a new selection is not a change.
 */
export function useChangedKeys(
  snapshot: Record<string, unknown> | undefined,
  identity: string,
): ReadonlySet<string> {
  const previous = useRef<{ identity: string; snapshot: Record<string, unknown> } | null>(null);
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!snapshot) return;
    const before = previous.current;
    previous.current = { identity, snapshot };
    if (!before || before.identity !== identity) {
      setChanged(new Set());
      return;
    }
    const keys = new Set([...Object.keys(before.snapshot), ...Object.keys(snapshot)]);
    const diff = [...keys].filter((key) => !dequal(before.snapshot[key], snapshot[key]));
    if (diff.length === 0) return;
    setChanged(new Set(diff));
    const timer = setTimeout(() => setChanged(new Set()), CHANGE_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [snapshot, identity]);

  return changed;
}

/**
 * Rows of a list that appeared or changed since the previous refresh of the same list.
 * `idOf` must be stable (module-level function).
 */
export function useChangedRows<T>(
  rows: T[] | undefined,
  identity: string,
  idOf: (row: T) => string,
): ReadonlySet<string> {
  const snapshot = useMemo(
    () => (rows ? Object.fromEntries(rows.map((row) => [idOf(row), row])) : undefined),
    [rows, idOf],
  );
  return useChangedKeys(snapshot, identity);
}

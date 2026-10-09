import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CHANGE_HIGHLIGHT_MS } from '@/lib/live';
import { useChangedKeys, useChangedRows } from './useChanges';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useChangedKeys', () => {
  it('flags changed keys for a while, ignoring the first snapshot', () => {
    const { result, rerender } = renderHook(({ data, id }) => useChangedKeys(data, id), {
      initialProps: { data: { speed: 1, engine: true } as Record<string, unknown>, id: 'v1' },
    });
    expect(result.current.size).toBe(0);

    rerender({ data: { speed: 2, engine: true }, id: 'v1' });
    expect([...result.current]).toEqual(['speed']);

    act(() => vi.advanceTimersByTime(CHANGE_HIGHLIGHT_MS));
    expect(result.current.size).toBe(0);
  });

  it('compares nested values structurally and flags removed keys', () => {
    const { result, rerender } = renderHook(({ data }) => useChangedKeys(data, 'v1'), {
      initialProps: { data: { position: { x: 1, y: 2 }, horn: false } as Record<string, unknown> },
    });

    rerender({ data: { position: { y: 2, x: 1 } } });

    expect([...result.current]).toEqual(['horn']);
  });

  it('does not treat another item as a change', () => {
    const { result, rerender } = renderHook(({ data, id }) => useChangedKeys(data, id), {
      initialProps: { data: { speed: 1 } as Record<string, unknown>, id: 'v1' },
    });

    rerender({ data: { speed: 9 }, id: 'v2' });

    expect(result.current.size).toBe(0);
  });
});

const idOf = (row: { id: string }) => row.id;

describe('useChangedRows', () => {
  it('flags appeared and changed rows of the same list', () => {
    const { result, rerender } = renderHook(({ rows }) => useChangedRows(rows, 'page-1', idOf), {
      initialProps: {
        rows: [
          { id: 'a', v: 1 },
          { id: 'b', v: 1 },
        ],
      },
    });

    rerender({
      rows: [
        { id: 'a', v: 2 },
        { id: 'b', v: 1 },
        { id: 'c', v: 1 },
      ],
    });

    expect([...result.current].sort()).toEqual(['a', 'c']);
  });
});

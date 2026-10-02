import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import pLimit from 'p-limit';
import {
  ImportCheckResponseSchema,
  ItemSchema,
  type CreateItem,
  type ImportCheckResponse,
  type ObjectData,
} from '@dyingstar-admin/schemas';
import { apiGet, apiSend } from '@/lib/api';
import { overwriteRequest, sendWaves } from '@/lib/importInput';
import { usePreferences } from '@/stores/preferences';
import { useAfterWrite } from './mutations';

/** `POST /api/items/import/check`: statuses and findings, nothing written (ADR 0019). */
export function useImportCheck() {
  const serverId = usePreferences((s) => s.serverId);
  return useMutation({
    mutationFn: async (items: unknown[]) =>
      (await apiSend('POST', '/api/items/import/check', {
        serverId,
        body: { items },
        schema: ImportCheckResponseSchema,
      })) as ImportCheckResponse,
  });
}

export type ImportOutcome =
  { state: 'created' | 'overwritten' } | { state: 'failed'; message: string };

export interface ImportRunState {
  running: boolean;
  done: number;
  total: number;
  /** Outcome per input row index. */
  outcomes: Map<number, ImportOutcome>;
  cancelled: boolean;
}

/** Items sent at once inside a wave (ADR 0004: limited concurrency). */
const CONCURRENCY = 4;

const IDLE: ImportRunState = {
  running: false,
  done: 0,
  total: 0,
  outcomes: new Map(),
  cancelled: false,
};

/**
 * Sends checked rows one by one through the BFF (ADR 0004): creates (`POST`, 409 if taken) or
 * overwrites (full replace through `PUT`), parents in earlier waves than their children, a few
 * at a time, cancellable between items. Lists and counts refresh once at the end.
 */
export function useImportRun() {
  const serverId = usePreferences((s) => s.serverId);
  const afterWrite = useAfterWrite();
  const [state, setState] = useState<ImportRunState>(IDLE);
  const cancelRef = useRef(false);

  const run = useCallback(
    async (
      items: unknown[],
      plan: { index: number; overwrite: boolean }[],
      /** Outcomes of a previous run kept as they are (retrying failed rows). */
      previous: Map<number, ImportOutcome> = new Map(),
    ) => {
      cancelRef.current = false;
      const outcomes = new Map(previous);
      for (const { index } of plan) outcomes.delete(index);
      let done = 0;
      setState({ running: true, done: 0, total: plan.length, outcomes, cancelled: false });
      const overwrite = new Map(plan.map((p) => [p.index, p.overwrite]));
      const limit = pLimit(CONCURRENCY);

      const send = async (index: number) => {
        if (cancelRef.current) return;
        const item = items[index] as CreateItem;
        try {
          if (overwrite.get(index)) {
            const path = `/api/items/${encodeURIComponent(item.object_uuid)}`;
            const latest = await apiGet(path, ItemSchema, { serverId });
            await apiSend('PUT', path, {
              serverId,
              body: overwriteRequest(
                latest.object_data,
                item.object_type,
                item.object_data as ObjectData,
              ),
              schema: ItemSchema,
            });
            outcomes.set(index, { state: 'overwritten' });
          } else {
            await apiSend('POST', '/api/items', { serverId, body: item, schema: ItemSchema });
            outcomes.set(index, { state: 'created' });
          }
        } catch (error) {
          outcomes.set(index, {
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        done += 1;
        setState((s) => ({ ...s, done, outcomes: new Map(outcomes) }));
      };

      for (const wave of sendWaves(
        items,
        plan.map((p) => p.index),
      )) {
        if (cancelRef.current) break;
        await Promise.all(wave.map((index) => limit(() => send(index))));
      }
      await afterWrite();
      setState((s) => ({ ...s, running: false, cancelled: cancelRef.current }));
    },
    [serverId, afterWrite],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);
  const reset = useCallback(() => setState(IDLE), []);

  return { state, run, cancel, reset };
}

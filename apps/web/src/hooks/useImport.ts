import { useCallback } from 'react';
import pLimit from 'p-limit';
import {
  ImportCheckResponseSchema,
  ItemSchema,
  type CreateItem,
  type ImportCheckResponse,
  type ObjectData,
} from '@dyingstar-admin/schemas';
import { apiGet, apiSend } from '@/lib/api';
import { overwriteRequest, sendWaves, type NormalizedImport } from '@/lib/importInput';
import { useImportDraft, type ImportOutcome } from '@/stores/importDraft';
import { useAfterWrite } from './mutations';

export type { ImportOutcome, ImportRunState } from '@/stores/importDraft';

/**
 * `POST /api/items/import/check` (read-only, ADR 0019). The answer goes to the import draft,
 * unless the text changed meanwhile; it lands even if the user left the page.
 */
export function useImportCheck() {
  return useCallback(async (normalized: NormalizedImport) => {
    const draft = useImportDraft.getState();
    const started = draft.generation;
    draft.setChecking(true);
    try {
      const { rows, items } = (await apiSend('POST', '/api/items/import/check', {
        body: { items: normalized.items },
        schema: ImportCheckResponseSchema,
      })) as ImportCheckResponse;
      if (useImportDraft.getState().generation === started) {
        useImportDraft.getState().setChecked({ ...normalized, items, rows, fromServer: true });
      }
    } finally {
      if (useImportDraft.getState().generation === started) {
        useImportDraft.getState().setChecking(false);
      }
    }
  }, []);
}

/** Items sent at once inside a wave (ADR 0004: limited concurrency). */
const CONCURRENCY = 4;

/**
 * Sends checked rows one by one through the BFF (ADR 0004): creates (`POST`, 409 if taken) or
 * overwrites (full replace through `PUT`), parents in earlier waves than their children, a few
 * at a time, cancellable between items. Progress lives in the import draft, so the send goes on
 * while the user is on another page. Lists and counts refresh once at the end.
 */
export function useImportRun() {
  const afterWrite = useAfterWrite();

  const run = useCallback(
    async (
      items: unknown[],
      plan: { index: number; overwrite: boolean }[],
      /** Outcomes of a previous run kept as they are (retrying failed rows). */
      previous: Map<number, ImportOutcome> = new Map(),
    ) => {
      const draft = useImportDraft.getState();
      draft.requestCancel(false);
      const outcomes = new Map(previous);
      for (const { index } of plan) outcomes.delete(index);
      let done = 0;
      draft.setRun(() => ({
        running: true,
        done: 0,
        total: plan.length,
        outcomes: new Map(outcomes),
        cancelled: false,
      }));
      const overwrite = new Map(plan.map((p) => [p.index, p.overwrite]));
      const limit = pLimit(CONCURRENCY);
      const cancelled = () => useImportDraft.getState().cancelRequested;

      const send = async (index: number) => {
        if (cancelled()) return;
        const item = items[index] as CreateItem;
        try {
          if (overwrite.get(index)) {
            const path = `/api/items/${encodeURIComponent(item.object_uuid)}`;
            const latest = await apiGet(path, ItemSchema);
            await apiSend('PUT', path, {
              body: overwriteRequest(
                latest.object_data,
                item.object_type,
                item.object_data as ObjectData,
              ),
              schema: ItemSchema,
            });
            outcomes.set(index, { state: 'overwritten' });
          } else {
            await apiSend('POST', '/api/items', { body: item, schema: ItemSchema });
            outcomes.set(index, { state: 'created' });
          }
        } catch (error) {
          outcomes.set(index, {
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        done += 1;
        useImportDraft.getState().setRun((s) => ({ ...s, done, outcomes: new Map(outcomes) }));
      };

      for (const wave of sendWaves(
        items,
        plan.map((p) => p.index),
      )) {
        if (cancelled()) break;
        await Promise.all(wave.map((index) => limit(() => send(index))));
      }
      await afterWrite();
      useImportDraft.getState().setRun((s) => ({ ...s, running: false, cancelled: cancelled() }));
    },
    [afterWrite],
  );

  const cancel = useCallback(() => useImportDraft.getState().requestCancel(true), []);
  return { run, cancel };
}

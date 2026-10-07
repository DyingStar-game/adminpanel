import { useCallback, useState } from 'react';
import {
  ItemCheckResponseSchema,
  type ImportFinding,
  type ItemCheckRequest,
  type ItemCheckResponse,
} from '@dyingstar-admin/schemas';
import { apiSend } from '@/lib/api';
import { usePreferences } from '@/stores/preferences';

interface CheckState {
  /** The item as checked: a second submit of the same item saves despite warnings. */
  signature: string;
  findings: ImportFinding[];
  failed: boolean;
}

export type CheckVerdict = 'save' | 'blocked' | 'confirm';

/**
 * Coherence check of a create or edit form before saving (`POST /api/items/check`, ADR 0022).
 * `run` answers `save` when nothing is to report or the user submits the same item again after
 * warnings (save anyway), `blocked` on errors, `confirm` on warnings or when the check failed.
 */
export function useItemCheck() {
  const serverId = usePreferences((s) => s.serverId);
  const [state, setState] = useState<CheckState | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(
    async (request: ItemCheckRequest): Promise<CheckVerdict> => {
      const signature = JSON.stringify(request.item);
      const errors = state?.findings.some((f) => f.severity === 'error');
      if (state?.signature === signature && !errors) return 'save';
      setChecking(true);
      try {
        const { findings } = (await apiSend('POST', '/api/items/check', {
          serverId,
          body: request,
          schema: ItemCheckResponseSchema,
        })) as ItemCheckResponse;
        setState({ signature, findings, failed: false });
        if (findings.some((f) => f.severity === 'error')) return 'blocked';
        return findings.some((f) => f.severity === 'warning') ? 'confirm' : 'save';
      } catch {
        // The check only advises: when it is unavailable, a second submit saves without it.
        setState({ signature, findings: [], failed: true });
        return 'confirm';
      } finally {
        setChecking(false);
      }
    },
    [serverId, state],
  );

  /** Whether the next submit of `item` saves despite the findings shown. */
  const confirming = (item: ItemCheckRequest['item'] | null) =>
    !!state &&
    !!item &&
    state.signature === JSON.stringify(item) &&
    !state.findings.some((f) => f.severity === 'error') &&
    (state.failed || state.findings.some((f) => f.severity === 'warning'));

  return {
    findings: state?.findings ?? [],
    failed: state?.failed ?? false,
    checking,
    run,
    confirming,
  };
}

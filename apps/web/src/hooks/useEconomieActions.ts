import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zCorporationSettingsAsServed,
  zPostApiInternalPoliticsByEntityIdTaxesAssessResponse,
  zPutApiInternalPoliticsByEntityIdSettingsResponse,
  type CorporationSettingsChange,
  type PoliticalSettingsChange,
} from '@dyingstar-admin/contracts/economie';
import { apiSend } from '@/lib/api';

/** Settings, treasuries and the dashboard may all change after an action. */
function useAfterAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['economie'] });
}

const politicalPath = (id: string) => `/api/economie/politics/${encodeURIComponent(id)}`;
const corporationPath = (id: string) => `/api/economie/corporations/${encodeURIComponent(id)}`;

/** Changes a political entity's tax rates or minting policy (step O.2, through `svc-admin`). */
export function useUpdatePoliticalSettings(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PoliticalSettingsChange) =>
      apiSend('PUT', `${politicalPath(id)}/settings`, {
        body,
        schema: zPutApiInternalPoliticsByEntityIdSettingsResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Books the tax debts of a political entity's taxpayers; each run books new ones. */
export function useAssessTaxes(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: () =>
      apiSend('POST', `${politicalPath(id)}/taxes/assess`, {
        schema: zPostApiInternalPoliticsByEntityIdTaxesAssessResponse,
      }),
    onSuccess: afterAction,
  });
}

/**
 * Changes a corporation's settings, then its fiscal home: two routes in `economie`, each sent
 * only when something of it changed.
 */
export function useUpdateCorporationSettings(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: async ({
      settings,
      politicalEntityId,
    }: {
      settings?: CorporationSettingsChange | undefined;
      /** The new fiscal home; `null` detaches it, `undefined` leaves it. */
      politicalEntityId?: string | null | undefined;
    }) => {
      if (settings) {
        await apiSend('PUT', `${corporationPath(id)}/settings`, {
          body: settings,
          schema: zCorporationSettingsAsServed,
        });
      }
      if (politicalEntityId !== undefined) {
        await apiSend('PUT', `${corporationPath(id)}/affiliation`, {
          body: { politicalEntityId },
          schema: zCorporationSettingsAsServed,
        });
      }
    },
    // Even when the second call failed, the first one may have changed something.
    onSettled: afterAction,
  });
}

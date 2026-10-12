import { z } from 'zod';
import {
  zFlowInput,
  zGetStockHistoryQuery,
  zUpdateFlowBody,
  zVillagePolicy,
  zVillageUpdate,
  zWarehouseCapacityInput,
} from './generated/zod.gen';

/**
 * What the panel sends to `universesimulator`'s configuration writes (ADR 0025), stricter than
 * its OpenAPI where its code is (`src/routes/admin.rs`, read 2026-10-12): villages are the nodes
 * of the simulation (the service's ADR 0013), thresholds and flows are per village, capacities
 * per warehouse. Hand-written, kept apart from the generated files.
 */

/** Why a village policy is refused, by field (message codes the SPA translates). */
export const POLICY_ISSUES = {
  targetBelowThreshold: 'targetBelowThreshold',
} as const;
export type PolicyIssue = keyof typeof POLICY_ISSUES;

/** `upsert_policy`: `0 ≤ minThreshold ≤ targetLevel`, else 400. Empty when coherent. */
export function policyIssues(policy: {
  minThreshold: number;
  targetLevel: number;
}): { path: 'targetLevel'; issue: PolicyIssue }[] {
  return policy.targetLevel < policy.minThreshold
    ? [{ path: 'targetLevel', issue: 'targetBelowThreshold' }]
    : [];
}

/** A village policy as the panel upserts it (`PUT /api/admin/village-policies`). */
export const zPanelVillagePolicy = zVillagePolicy.strict().superRefine((policy, ctx) => {
  for (const { path, issue } of policyIssues(policy)) {
    ctx.addIssue({ code: 'custom', path: [path], message: POLICY_ISSUES[issue] });
  }
});
export type PanelVillagePolicy = z.infer<typeof zPanelVillagePolicy>;

/**
 * A warehouse's capacity for a resource (`PUT /api/admin/warehouse-capacities`): whole units
 * from 0, or `null` for no limit (`upsert_capacity`).
 */
export const zPanelWarehouseCapacity = zWarehouseCapacityInput
  .extend({ capacity: z.int().gte(0).nullable() })
  .strict();
export type PanelWarehouseCapacity = z.infer<typeof zPanelWarehouseCapacity>;

/**
 * A change of a village (`PUT /api/admin/villages/{id}`): its main warehouse (one of its own,
 * the service checks), or whether it is simulated; at least one.
 */
export const zPanelVillageUpdate = zVillageUpdate
  .strict()
  .refine((change) => Object.keys(change).length > 0, {
    message: 'At least one field is required',
  });
export type PanelVillageUpdate = z.infer<typeof zPanelVillageUpdate>;

/** A label as the panel sends it: trimmed, not empty. */
const zLabel = z.string().trim().min(1).max(128);

/** A new flow of a village (`POST /api/admin/flows`): units per game hour, negative to consume. */
export const zPanelFlow = zFlowInput.extend({ label: zLabel.optional() }).strict();
export type PanelFlow = z.infer<typeof zPanelFlow>;

/**
 * A change of a flow (`PUT /api/admin/flows/{id}`): its rate, its label (`null` clears it, as
 * `FlowUpdate` reads it), at least one.
 */
export const zPanelFlowChange = zUpdateFlowBody
  .extend({ label: zLabel.nullable().optional() })
  .strict()
  .refine((change) => Object.keys(change).length > 0, {
    message: 'At least one field is required',
  });
export type PanelFlowChange = z.infer<typeof zPanelFlowChange>;

/** `stock_history`: a village (the sum of its warehouses) or one warehouse, not neither. */
export const zPanelStockHistoryQuery = zGetStockHistoryQuery.refine(
  (query) => query.village !== undefined || query.warehouse !== undefined,
  { message: 'village or warehouse is required' },
);

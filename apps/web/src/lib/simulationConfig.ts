import { z } from 'zod';
import {
  policyIssues,
  type Flow,
  type PanelFlow,
  type PanelFlowChange,
  type PanelVillagePolicy,
  type PanelWarehouseCapacity,
  type VillagePolicy,
} from '@dyingstar-admin/contracts/universesimulator';

/**
 * The forms of the simulation's configuration (ADR 0025 › Configuration): a village's policies
 * and flows, a warehouse's capacities. Error messages are codes, translated under
 * `simulation.config.errors.*`; the coherence rule is the service's (`policyIssues`).
 */

/** Error codes of the configuration forms. */
export type ConfigError =
  'wholeNumber' | 'number' | 'required' | 'zeroRate' | 'labelTooLong' | 'targetBelowThreshold';

/** Largest stock level the panel sends (JavaScript's safe integers). */
const MAX_LEVEL = Number.MAX_SAFE_INTEGER;

const wholeNumber = z
  .number({ error: 'wholeNumber' })
  .int({ error: 'wholeNumber' })
  .min(0, { error: 'wholeNumber' })
  .max(MAX_LEVEL, { error: 'wholeNumber' });

/** A village policy's fields as typed: whole numbers, the target at least the threshold. */
export const PolicyFormSchema = z
  .object({ minThreshold: wholeNumber, targetLevel: wholeNumber })
  .superRefine((form, ctx) => {
    for (const { path, issue } of policyIssues(form)) {
      ctx.addIssue({ code: 'custom', path: [path], message: issue });
    }
  });
export type PolicyForm = z.infer<typeof PolicyFormSchema>;

/** The form's starting values: the policy's, or zeros for a new one. */
export const policyFormValues = (policy: VillagePolicy | null): PolicyForm => ({
  minThreshold: policy?.minThreshold ?? 0,
  targetLevel: policy?.targetLevel ?? 0,
});

export const policyToSend = (
  villageId: string,
  resourceId: string,
  form: PolicyForm,
): PanelVillagePolicy => ({ villageId, resourceId, ...form });

/** A warehouse capacity as typed: whole units, or empty (`NaN`) for no limit. */
export const CapacityFormSchema = z.object({ capacity: z.union([z.nan(), wholeNumber]) });
export type CapacityForm = z.infer<typeof CapacityFormSchema>;

export const capacityFormValues = (capacity: number | null | undefined): CapacityForm => ({
  capacity: capacity ?? Number.NaN,
});

/** The capacity to upsert: `null` (no limit) when left empty. */
export const capacityToSend = (
  warehouseId: string,
  resourceId: string,
  form: CapacityForm,
): PanelWarehouseCapacity => ({
  warehouseId,
  resourceId,
  capacity: Number.isNaN(form.capacity) ? null : form.capacity,
});

/** A flow's fields as typed: a rate that is not zero, an optional label. */
export const FlowFormSchema = z.object({
  resourceId: z.string().min(1, { error: 'required' }),
  ratePerHour: z.number({ error: 'number' }).refine((rate) => rate !== 0, { error: 'zeroRate' }),
  source: z.enum(['population', 'industry', 'manual']),
  label: z.string().max(128, { error: 'labelTooLong' }),
});
export type FlowForm = z.infer<typeof FlowFormSchema>;

export const flowFormValues = (flow: Flow | null): FlowForm => ({
  resourceId: flow?.resourceId ?? '',
  ratePerHour: flow?.ratePerHour ?? Number.NaN,
  source: flow?.source ?? 'manual',
  label: flow?.label ?? '',
});

/** A new flow of a village: the label only when one is typed. */
export const flowToCreate = (villageId: string, form: FlowForm): PanelFlow => ({
  villageId,
  resourceId: form.resourceId,
  ratePerHour: form.ratePerHour,
  source: form.source,
  ...(form.label.trim() ? { label: form.label.trim() } : {}),
});

/** What changed in a flow: its rate, its label (emptied: `null`, which clears it). */
export function flowChange(flow: Flow, form: FlowForm): PanelFlowChange {
  const change: PanelFlowChange = {};
  if (form.ratePerHour !== flow.ratePerHour) change.ratePerHour = form.ratePerHour;
  const label = form.label.trim();
  if (label !== (flow.label ?? '')) change.label = label || null;
  return change;
}

import { z } from 'zod';
import { zOrderStatus } from '@dyingstar-admin/contracts/universesimulator';
import { UuidSchema } from '@dyingstar-admin/schemas';

/** Tabs of the Simulation section (ADR 0025). */
export const SIMULATION_TABS = [
  'overview',
  'network',
  'stocks',
  'orders',
  'prices',
  'treasury',
] as const;
export type SimulationTab = (typeof SIMULATION_TABS)[number];

const optionalUuid = UuidSchema.optional().catch(undefined);

/**
 * Simulation state carried by the URL (ADR 0024, 0025), so every view is shareable: the tab, the
 * resource looked at (map colours, stocks, prices, history, order filter), the village picked
 * (map panel, stocks, order filter; villages are the simulation's nodes), the entity of the
 * stocks, the order status, and the body whose map frame places the villages.
 */
export const SimulationSearchSchema = z.object({
  tab: z.enum(SIMULATION_TABS).catch('overview').default('overview'),
  resource: optionalUuid,
  village: optionalUuid,
  entity: optionalUuid,
  status: zOrderStatus.optional().catch(undefined),
  body: optionalUuid,
});
export type SimulationSearch = z.infer<typeof SimulationSearchSchema>;

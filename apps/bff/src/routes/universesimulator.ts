import { Hono } from 'hono';
import {
  zCancelOrderPath,
  zDeleteFlowPath,
  zDeleteVillagePolicyPath,
  zDeleteWarehouseCapacityPath,
  zGetDashboardQuery,
  zGetIncomingQuery,
  zGetLocalPricesQuery,
  zGetNetworkQuery,
  zGetOrderPath,
  zGetPriceHistoryQuery,
  zGetVillagePath,
  zGetWarehousePath,
  zListEntitiesQuery,
  zListMintEventsQuery,
  zListOrdersQuery,
  zListPricesQuery,
  zListVillagePoliciesQuery,
  zListVillagesQuery,
  zListWarehouseCapacitiesQuery,
  zPanelFlow,
  zPanelFlowChange,
  zPanelStockHistoryQuery,
  zPanelVillagePolicy,
  zPanelVillageUpdate,
  zPanelWarehouseCapacity,
  zUpdateFlowPath,
  zUpdateVillagePath,
  type NetworkVillage,
} from '@dyingstar-admin/contracts/universesimulator';
import {
  latLonOf,
  UuidSchema,
  type SimulationMapPosition,
  type SimulationNetworkExtras,
} from '@dyingstar-admin/schemas';
import { requirePermission, type SessionContext } from '../auth/auth';
import type { UniversesimulatorClient } from '../clients/universesimulator';
import { ApiError } from '../lib/errors';
import { fromQuery, validate } from '../lib/validate';
import { projectOnFrame, type BodyFrame } from '../services/bodyMap';
import type { ItemsService } from '../services/items';

/** `?body=`: the persistence UUID of the planet whose map frame places the villages. */
const NetworkQuery = zGetNetworkQuery.extend({ body: UuidSchema.optional() });

type Placed = { id: string; x?: number | null; y?: number | null; z?: number | null };

/** One village or warehouse on the frame, or nothing without a cached position. */
const placeOn = (frame: BodyFrame, kind: SimulationMapPosition['kind'], p: Placed) => {
  if (p.x == null || p.y == null || p.z == null) return [];
  const at = projectOnFrame(frame, [p.x, p.y, p.z]);
  return at ? [{ id: p.id, kind, ...at }] : [];
};

/**
 * Places the villages and their warehouses on the planetary map of `body` (ADR 0018, 0025):
 * each one's cached persistence position (`x`, `y`, `z`, relative to the body centre like any
 * POI standing on it) goes through the body's map frame, so its marker lands where `/map/$uuid`
 * draws the object. Nothing is projected without a body, without persistence, or when the frame
 * cannot be had: the reason is given instead (`projectionIssue`), and the raw positions stay in
 * the network.
 */
async function locate(
  villages: NetworkVillage[],
  body: string | undefined,
  items: ItemsService | undefined,
): Promise<SimulationNetworkExtras> {
  const unprojected = (issue: NonNullable<SimulationNetworkExtras['projectionIssue']>) => ({
    projection: null,
    projectionIssue: issue,
    positions: [],
  });
  if (!body) return unprojected('noBody');
  if (!items) return unprojected('noPersistence');
  let located: Awaited<ReturnType<ItemsService['bodyFrame']>>;
  try {
    located = await items.bodyFrame(body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return unprojected('bodyNotFound');
    console.error('simulation network projection:', error);
    return unprojected('unreachable');
  }
  if (!located) return unprojected('noFrame');
  const { frame, body: item } = located;
  const center = latLonOf(frame.center);
  const name = item.object_data.name;
  return {
    projection: {
      body: {
        object_uuid: item.object_uuid,
        name: typeof name === 'string' && name ? name : null,
      },
      referenceRadius: Number(frame.referenceRadius.toFixed(1)),
      center: { lat: Number(center.lat.toFixed(6)), lon: Number(center.lon.toFixed(6)) },
    },
    projectionIssue: null,
    positions: villages.flatMap((v) => [
      ...placeOn(frame, 'village', v),
      ...v.warehouses.flatMap((w) => placeOn(frame, 'warehouse', w)),
    ]),
  };
}

/**
 * `universesimulator` (ADR 0025): its Admin API, always with the person's token, which it checks
 * itself (reads `moderator`+, writes `admin` or `supervisor`). The panel's `simulation.view`
 * opens the section (checked where it is mounted), `simulation.manage` its writes; inputs are
 * validated with the pinned contract (and `code.ts`) before any call.
 */
export function universesimulatorRoutes(
  simulation: UniversesimulatorClient,
  items: ItemsService | undefined,
) {
  const token = (session: SessionContext['Variables']['session'] | undefined) =>
    session?.tokens.accessToken;
  const manage = requirePermission('simulation.manage');

  return (
    new Hono<SessionContext>()
      .get('/dashboard', validate('query', fromQuery(zGetDashboardQuery)), async (c) =>
        c.json(await simulation.dashboard(token(c.var.session), c.req.valid('query'))),
      )
      .get('/network', validate('query', fromQuery(NetworkQuery)), async (c) => {
        const { body, ...query } = c.req.valid('query');
        const network = await simulation.network(token(c.var.session), query);
        return c.json({ ...network, ...(await locate(network.villages, body, items)) });
      })
      .get('/villages', validate('query', fromQuery(zListVillagesQuery)), async (c) =>
        c.json(await simulation.villages(token(c.var.session), c.req.valid('query'))),
      )
      .get('/villages/:id', validate('param', zGetVillagePath), async (c) =>
        c.json(await simulation.village(token(c.var.session), c.req.valid('param').id)),
      )
      .get('/warehouses/:id', validate('param', zGetWarehousePath), async (c) =>
        c.json(await simulation.warehouse(token(c.var.session), c.req.valid('param').id)),
      )
      .get('/orders', validate('query', fromQuery(zListOrdersQuery)), async (c) =>
        c.json(await simulation.orders(token(c.var.session), c.req.valid('query'))),
      )
      .get('/orders/:id', validate('param', zGetOrderPath), async (c) =>
        c.json(await simulation.order(token(c.var.session), c.req.valid('param').id)),
      )
      .get('/prices', validate('query', fromQuery(zListPricesQuery)), async (c) =>
        c.json(await simulation.prices(token(c.var.session), c.req.valid('query'))),
      )
      .get('/price-history', validate('query', fromQuery(zGetPriceHistoryQuery)), async (c) =>
        c.json(await simulation.priceHistory(token(c.var.session), c.req.valid('query'))),
      )
      .get('/local-prices', validate('query', fromQuery(zGetLocalPricesQuery)), async (c) =>
        c.json(await simulation.localPrices(token(c.var.session), c.req.valid('query'))),
      )
      .get('/stock-history', validate('query', fromQuery(zPanelStockHistoryQuery)), async (c) =>
        c.json(await simulation.stockHistory(token(c.var.session), c.req.valid('query'))),
      )
      .get('/incoming', validate('query', fromQuery(zGetIncomingQuery)), async (c) =>
        c.json(await simulation.incoming(token(c.var.session), c.req.valid('query'))),
      )
      .get('/mint-events', validate('query', fromQuery(zListMintEventsQuery)), async (c) =>
        c.json(await simulation.mintEvents(token(c.var.session), c.req.valid('query'))),
      )
      .get('/resources', async (c) => c.json(await simulation.resources(token(c.var.session))))
      .get('/entities', validate('query', fromQuery(zListEntitiesQuery)), async (c) =>
        c.json(await simulation.entities(token(c.var.session), c.req.valid('query'))),
      )
      .get('/simulation', async (c) => c.json(await simulation.simulation(token(c.var.session))))
      .get(
        '/village-policies',
        validate('query', fromQuery(zListVillagePoliciesQuery)),
        async (c) =>
          c.json(await simulation.villagePolicies(token(c.var.session), c.req.valid('query'))),
      )
      .get(
        '/warehouse-capacities',
        validate('query', fromQuery(zListWarehouseCapacitiesQuery)),
        async (c) =>
          c.json(await simulation.warehouseCapacities(token(c.var.session), c.req.valid('query'))),
      )
      // Writes: `admin` or `supervisor` (`simulation.manage`), recorded where mounted.
      .post('/simulation/tick', manage, async (c) =>
        c.json(await simulation.tick(token(c.var.session))),
      )
      .post('/simulation/pause', manage, async (c) =>
        c.json(await simulation.pause(token(c.var.session))),
      )
      .post('/simulation/resume', manage, async (c) =>
        c.json(await simulation.resume(token(c.var.session))),
      )
      .post('/orders/:id/cancel', manage, validate('param', zCancelOrderPath), async (c) => {
        await simulation.cancelOrder(token(c.var.session), c.req.valid('param').id);
        return c.body(null, 204);
      })
      // Configuration (ADR 0025 › Configuration): villages, their policies and flows,
      // warehouses' capacities.
      .put(
        '/villages/:id',
        manage,
        validate('param', zUpdateVillagePath),
        validate('json', zPanelVillageUpdate),
        async (c) =>
          c.json(
            await simulation.updateVillage(
              token(c.var.session),
              c.req.valid('param').id,
              c.req.valid('json'),
            ),
          ),
      )
      .put('/village-policies', manage, validate('json', zPanelVillagePolicy), async (c) =>
        c.json(await simulation.saveVillagePolicy(token(c.var.session), c.req.valid('json'))),
      )
      .delete(
        '/village-policies/:village/:resource',
        manage,
        validate('param', zDeleteVillagePolicyPath),
        async (c) => {
          const { village, resource } = c.req.valid('param');
          await simulation.deleteVillagePolicy(token(c.var.session), village, resource);
          return c.body(null, 204);
        },
      )
      .put('/warehouse-capacities', manage, validate('json', zPanelWarehouseCapacity), async (c) =>
        c.json(await simulation.saveWarehouseCapacity(token(c.var.session), c.req.valid('json'))),
      )
      .delete(
        '/warehouse-capacities/:warehouse/:resource',
        manage,
        validate('param', zDeleteWarehouseCapacityPath),
        async (c) => {
          const { warehouse, resource } = c.req.valid('param');
          await simulation.deleteWarehouseCapacity(token(c.var.session), warehouse, resource);
          return c.body(null, 204);
        },
      )
      .post('/flows', manage, validate('json', zPanelFlow), async (c) =>
        c.json(await simulation.createFlow(token(c.var.session), c.req.valid('json')), 201),
      )
      .put(
        '/flows/:id',
        manage,
        validate('param', zUpdateFlowPath),
        validate('json', zPanelFlowChange),
        async (c) =>
          c.json(
            await simulation.updateFlow(
              token(c.var.session),
              c.req.valid('param').id,
              c.req.valid('json'),
            ),
          ),
      )
      .delete('/flows/:id', manage, validate('param', zDeleteFlowPath), async (c) => {
        await simulation.deleteFlow(token(c.var.session), c.req.valid('param').id);
        return c.body(null, 204);
      })
  );
}

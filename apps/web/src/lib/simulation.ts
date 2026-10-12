import type { z } from 'zod';
import type { Entity, zNetwork } from '@dyingstar-admin/contracts/universesimulator';
import type { SimulationNetworkExtras } from '@dyingstar-admin/schemas';
import { ApiError } from './api';

/**
 * Pure helpers of the Simulation section (ADR 0025): stock health, the map's marks, number
 * formats and the geometry of the inline SVG charts.
 */

/** How a warehouse stands for a resource: nothing left, under its threshold, fine, or full. */
export type StockHealth = 'empty' | 'below' | 'ok' | 'full' | 'none';
export const STOCK_HEALTHS: readonly StockHealth[] = ['empty', 'below', 'ok', 'full', 'none'];

export interface StockLevel {
  quantity: number;
  available: number;
  minThreshold?: number | null | undefined;
  capacity?: number | null | undefined;
}

/**
 * Health of a stock: `empty` when nothing is available, `below` under the policy's threshold
 * (what triggers an order), `full` at capacity, `ok` otherwise; `none` when the warehouse does
 * not keep the resource.
 */
export function stockHealth(stock: StockLevel | undefined): StockHealth {
  if (!stock) return 'none';
  if (stock.available <= 0) return 'empty';
  if (stock.minThreshold != null && stock.available < stock.minThreshold) return 'below';
  if (stock.capacity != null && stock.quantity >= stock.capacity) return 'full';
  return 'ok';
}

/**
 * Status colours of the health (the panel's tokens: `--ds-danger`, amber, `--ds-ok`, a cool
 * blue, `--ds-fg-3`), as values: Leaflet writes them into SVG attributes, where CSS variables
 * do not apply. Always shown with their label (legend, panel), never alone.
 */
export const HEALTH_COLORS: Record<StockHealth, string> = {
  empty: '#ef4444',
  below: '#f59e0b',
  ok: '#22c55e',
  full: '#38bdf8',
  none: '#8a8aa0',
};

/** Line weight of a leg on the map: 2 px, up to 8 px for the largest quantity on screen. */
export const legWeight = (quantity: number, largest: number) =>
  largest > 0 ? 2 + 6 * Math.sqrt(Math.max(quantity, 0) / largest) : 2;

/** A signed rate per game hour (`+250/h`, `−30/h`). */
export function formatRate(perHour: number, locale: string): string {
  const value = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(perHour);
  return `${value}/h`;
}

/** Autonomy in game hours: hours under two days, days beyond. */
export function formatAutonomy(hours: number, locale: string): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return hours < 48 ? `${format.format(hours)} h` : `${format.format(hours / 24)} d`;
}

/** A quantity of units, grouped by thousands. */
export const formatQuantity = (value: number, locale: string) =>
  new Intl.NumberFormat(locale).format(value);

/** A unit price, two decimals at most. */
export const formatPrice = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);

/** The entity and every entity under it (a city and its communes). */
export function entityScope(entities: Entity[], id: string): Set<string> {
  const scope = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const entity of entities) {
      if (entity.parentId && scope.has(entity.parentId) && !scope.has(entity.id)) {
        scope.add(entity.id);
        grew = true;
      }
    }
  }
  return scope;
}

/** A point of a time series: epoch milliseconds, value. */
export interface SeriesPoint {
  t: number;
  v: number;
}

export interface ChartBox {
  width: number;
  height: number;
  /** Space kept for the labels: left (values), right, top, bottom (times). */
  padding: { left: number; right: number; top: number; bottom: number };
}

/**
 * Geometry of a line chart in SVG units: the scales (time on x, value on y from 0 or the lowest
 * value, up to the highest of the series and the reference lines, with a little headroom), the
 * line's path, and a few round value ticks. Pure, so it is tested without a DOM.
 */
export function lineChartGeometry(
  points: SeriesPoint[],
  references: number[],
  { width, height, padding }: ChartBox,
  { fromZero = true }: { fromZero?: boolean } = {},
) {
  const values = [...points.map((p) => p.v), ...references];
  const lowest = values.length ? Math.min(...values) : 0;
  const highest = values.length ? Math.max(...values) : 1;
  const yMin = fromZero ? Math.min(0, lowest) : lowest - (highest - lowest) * 0.1;
  const span = highest - yMin || Math.abs(highest) || 1;
  const yMax = highest + span * 0.08;
  const tMin = points.length ? Math.min(...points.map((p) => p.t)) : 0;
  const tMax = points.length ? Math.max(...points.map((p) => p.t)) : 1;
  const inner = {
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: height - padding.bottom,
  };
  const x = (t: number) =>
    tMax === tMin
      ? (inner.left + inner.right) / 2
      : inner.left + ((t - tMin) / (tMax - tMin)) * (inner.right - inner.left);
  const y = (v: number) => inner.bottom - ((v - yMin) / (yMax - yMin)) * (inner.bottom - inner.top);
  const round = (n: number) => Math.round(n * 10) / 10;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(x(p.t))} ${round(y(p.v))}`)
    .join(' ');
  return { x, y, path, inner, yMin, yMax, tMin, tMax, ticks: niceTicks(yMin, yMax, 4) };
}

/** About `count` round values between `min` and `max` (1-2-5 steps). */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

/** Message for a failed `universesimulator` read: its own role check (403), or unreachable. */
export const simulationErrorKey = (error: unknown) =>
  error instanceof ApiError && error.status === 403
    ? ('simulation.forbidden' as const)
    : ('simulation.unavailable' as const);

type Network = z.infer<typeof zNetwork> & SimulationNetworkExtras;

/** A point of the network map: `[north, east]` metres, Leaflet's `CRS.Simple` order. */
export type NetworkLatLng = [number, number];

/**
 * What the network map draws (ADR 0025), from the network placed on the body's frame: each
 * placed village (the simulation's nodes, the service's ADR 0013) with its health for
 * `resourceId` on its aggregated stock, its placed warehouses as secondary points, the routes
 * between two placed villages, and the active legs between them, weighted by quantity (mining
 * legs have no origin: listed in the village panel, not drawn). `unplaced` counts the villages
 * without a position.
 */
export function networkLayers(network: Network, resourceId: string | undefined) {
  const at = new Map<string, NetworkLatLng>(
    network.positions.filter((p) => p.kind === 'village').map((p) => [p.id, [p.y, p.x]]),
  );
  const depotAt = new Map<string, NetworkLatLng>(
    network.positions.filter((p) => p.kind === 'warehouse').map((p) => [p.id, [p.y, p.x]]),
  );
  const villages = network.villages.flatMap((v) => {
    const position = at.get(v.id);
    if (!position) return [];
    const stock = v.stocks.find((s) => s.resourceId === resourceId);
    return [{ id: v.id, name: v.name, at: position, health: stockHealth(stock), stock }];
  });
  const warehouses = network.villages.flatMap((v) =>
    v.warehouses.flatMap((w) => {
      const position = depotAt.get(w.id);
      return position
        ? [
            {
              id: w.id,
              name: w.name,
              villageId: v.id,
              main: v.mainWarehouseId === w.id,
              at: position,
            },
          ]
        : [];
    }),
  );
  const routes = network.routes.flatMap((r) => {
    const from = at.get(r.fromVillageId);
    const to = at.get(r.toVillageId);
    return from && to && r.active ? [{ ...r, from, to }] : [];
  });
  const drawn = network.activeLegs.filter(
    (l) => l.fromVillageId && at.has(l.fromVillageId) && at.has(l.toVillageId),
  );
  const largest = Math.max(0, ...drawn.map((l) => l.quantity));
  const legs = drawn.map((l) => ({
    ...l,
    from: at.get(l.fromVillageId ?? '') as NetworkLatLng,
    to: at.get(l.toVillageId) as NetworkLatLng,
    weight: legWeight(l.quantity, largest),
  }));
  return {
    villages,
    warehouses,
    routes,
    legs,
    unplaced: network.projection ? network.villages.length - villages.length : 0,
  };
}

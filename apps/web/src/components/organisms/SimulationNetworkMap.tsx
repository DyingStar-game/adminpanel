import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { MetricMap } from '@/components/molecules/MetricMap';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { StockHealthBadge } from '@/components/molecules/StockHealthBadge';
import { useCan } from '@/hooks/useCan';
import { usePanel } from '@/hooks/usePanel';
import { useItem } from '@/hooks/queries';
import {
  useSimulationNames,
  useSimulationNetwork,
  useSimulationResources,
} from '@/hooks/useSimulation';
import { escapeHtml, formatDistance, movementHeading } from '@/lib/bodyMap';
import {
  HEALTH_COLORS,
  networkLayers,
  simulationErrorKey,
  STOCK_HEALTHS,
  type NetworkLatLng,
  type StockHealth,
} from '@/lib/simulation';
import { VillagePanel } from './VillagePanel';

interface SimulationNetworkMapProps {
  /** Resource whose stock health colours the villages; the first one by default. */
  resource: string | undefined;
  /** Village opened in the side panel. */
  village: string | undefined;
  /** Planet whose map frame places the villages; by default their POIs' parent. */
  body: string | undefined;
  onResourceChange: (id: string) => void;
  onVillageChange: (id: string | undefined) => void;
}

const icons = new Map<string, L.DivIcon>();

/** Healths a village can show: its aggregated stock has no capacity, so never `full`. */
const MAP_HEALTHS = STOCK_HEALTHS.filter((health) => health !== 'full');

/** A warehouse of a village: a small grey square, filled for the main one. */
const depotIcons = {
  main: L.divIcon({
    className: '',
    iconSize: [8, 8],
    html: '<span data-depot="main" class="block size-full rounded-xs border border-background bg-fg-2"></span>',
  }),
  other: L.divIcon({
    className: '',
    iconSize: [8, 8],
    html: '<span data-depot class="block size-full rounded-xs border border-fg-2 bg-background"></span>',
  }),
};
const depotIcon = (main: boolean) => (main ? depotIcons.main : depotIcons.other);

/** A village marker: a disc of its health colour, its name above, a ring when selected. */
function villageIcon(name: string, health: StockHealth, selected: boolean): L.DivIcon {
  const key = `${name}|${health}|${selected}`;
  let icon = icons.get(key);
  if (!icon) {
    const size = selected ? 22 : 16;
    icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<span data-health="${health}"${selected ? ' data-selected' : ''} class="relative block size-full rounded-full border-2 border-background shadow-sm${
        selected ? ' ring-2 ring-foreground' : ''
      }" style="background:${HEALTH_COLORS[health]}"><span class="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-sm font-semibold leading-none text-foreground [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]">${escapeHtml(name)}</span></span>`,
    });
    icons.set(key, icon);
  }
  return icon;
}

/** Arrow head of a leg at its destination, pointing along it (the size stays on screen). */
function legHead(from: NetworkLatLng, to: NetworkLatLng, published: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [16, 16],
    html: `<svg viewBox="0 0 16 16" width="16" height="16" style="transform:rotate(${movementHeading(
      { from, to },
    )}deg) translateY(14px)"><path d="M8 1 L14 14 L8 10.5 L2 14 Z" fill="var(--ds-acc)" fill-opacity="${
      published ? 1 : 0.5
    }" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  });
}

/** Fits the view on the warehouses once, when they first arrive. */
function FitOnce({ points }: { points: NetworkLatLng[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: -2 });
  }, [map, points]);
  return null;
}

/**
 * The supply network on the planet's map (ADR 0025), in the frame of `/map/$uuid` (ADR 0018):
 * villages (the simulation's nodes, the service's ADR 0013; mining depots are not simulated) as
 * discs coloured by the health of their stock of a resource (all their warehouses summed), their
 * warehouses as small squares, routes between villages as grey lines, active legs as gold
 * arrows growing with the quantity carried (dimmer before they are on offer). A click on a
 * village opens its panel. The planet is read from persistence (the parent of the villages'
 * POIs) when this account may read it; otherwise the map says why nothing is placed.
 */
export function SimulationNetworkMap({
  resource,
  village,
  body,
  onResourceChange,
  onVillageChange,
}: SimulationNetworkMapProps) {
  const { t } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  const resources = useSimulationResources();
  const names = useSimulationNames();
  const shown = resource ?? resources.data?.items[0]?.id;

  // The planet: asked in the URL, or the parent of a village's POI in persistence.
  const unplaced = useSimulationNetwork(undefined);
  const readsPersistence = services.includes('persistence') && can('persistence.read');
  const firstPlaced = unplaced.data?.villages.find((v) => v.x != null)?.id;
  const poi = useItem(!body && readsPersistence ? firstPlaced : undefined);
  const bodyId = body ?? (poi.data?.object_data.parent_id || undefined);
  const network = useSimulationNetwork(bodyId);
  const data = bodyId ? network.data : unplaced.data;

  const layers = useMemo(() => (data ? networkLayers(data, shown) : null), [data, shown]);
  const placed = useMemo(() => layers?.villages.map((v) => v.at) ?? [], [layers]);
  const error = network.error ?? unplaced.error;

  if (error) return <ServiceNotice message={t(simulationErrorKey(error))} />;
  if (!data || !layers) return <p className="text-sm text-fg-3">…</p>;

  const resourceName = (id: string) => names.resources.get(id)?.name ?? id;
  const placeName = (id: string | null | undefined) =>
    id ? (names.villages.get(id) ?? id) : t('simulation.map.mine');
  const issue = data.projectionIssue ?? (bodyId ? null : 'noBody');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <OptionSelect<string>
          label={t('simulation.map.resource')}
          value={shown}
          options={(resources.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }))}
          onChange={onResourceChange}
          className="w-44"
        />
        <ul aria-label={t('simulation.map.legend')} className="flex flex-wrap gap-3">
          {MAP_HEALTHS.map((health) => (
            <li key={health}>
              <StockHealthBadge health={health} label={t(`simulation.health.${health}`)} />
            </li>
          ))}
        </ul>
        {data.projection && (
          <p className="text-xs text-fg-3">
            {t('simulation.map.onBody', {
              name: data.projection.body.name ?? data.projection.body.object_uuid,
            })}
            {layers.unplaced > 0 &&
              ` · ${t('simulation.map.unplaced', { count: layers.unplaced })}`}
          </p>
        )}
      </div>
      {issue && <ServiceNotice message={t(`simulation.map.${issue}`)} />}
      <div className="flex h-128 overflow-hidden rounded-lg border">
        <div
          className="relative min-w-0 flex-1"
          aria-label={t('simulation.map.label')}
          role="region"
        >
          <MetricMap gridCaption={(step, major) => t('simulation.map.grid', { step, major })}>
            {layers.routes.map((route) => (
              <Polyline
                key={route.id}
                positions={[route.from, route.to]}
                pathOptions={{ color: '#8a8aa0', weight: 2, opacity: 0.6 }}
              >
                <Tooltip sticky>
                  {t('simulation.map.route', {
                    from: placeName(route.fromVillageId),
                    to: placeName(route.toVillageId),
                    distance: formatDistance(route.distanceM),
                  })}
                </Tooltip>
              </Polyline>
            ))}
            {layers.legs.map((leg) => {
              const published = leg.status === 'published' || leg.status === 'held';
              const label = t('simulation.map.leg', {
                quantity: leg.quantity,
                resource: resourceName(leg.resourceId),
                from: placeName(leg.fromVillageId),
                to: placeName(leg.toVillageId),
                status: t(`simulation.orders.legStatuses.${leg.status}`),
              });
              return (
                <Polyline
                  key={leg.legId}
                  positions={[leg.from, leg.to]}
                  pathOptions={{
                    color: '#ffba08',
                    weight: leg.weight,
                    opacity: published ? 0.9 : 0.45,
                    ...(published ? {} : { dashArray: '8 6' }),
                  }}
                >
                  <Tooltip sticky>{label}</Tooltip>
                </Polyline>
              );
            })}
            {layers.legs.map((leg) => (
              <Marker
                key={`head-${leg.legId}`}
                position={leg.to}
                icon={legHead(
                  leg.from,
                  leg.to,
                  leg.status === 'published' || leg.status === 'held',
                )}
                interactive={false}
                keyboard={false}
              />
            ))}
            {/* Warehouses: small squares beside their village (the main one filled). */}
            {layers.warehouses.map((w) => (
              <Marker
                key={w.id}
                position={w.at}
                icon={depotIcon(w.main)}
                interactive={false}
                keyboard={false}
                title={t(w.main ? 'simulation.map.mainWarehouse' : 'simulation.map.warehouse', {
                  name: w.name,
                })}
              />
            ))}
            {layers.villages.map((v) => (
              <Marker
                key={v.id}
                position={v.at}
                icon={villageIcon(v.name, v.health, v.id === village)}
                zIndexOffset={v.id === village ? 1000 : 500}
                title={`${v.name} · ${t(`simulation.health.${v.health}`)}`}
                eventHandlers={{ click: () => onVillageChange(v.id) }}
              />
            ))}
            <FitOnce points={placed} />
          </MetricMap>
        </div>
        {village && <VillagePanel villageId={village} onClose={() => onVillageChange(undefined)} />}
      </div>
    </div>
  );
}

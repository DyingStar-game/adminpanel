/// <reference types="leaflet.markercluster" />
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Polyline,
  ScaleControl,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import type { MapPoint } from '@dyingstar-admin/schemas';
import {
  formatDistance,
  gridLines,
  gridStep,
  GRID_MAJOR_EVERY,
  markerShape,
  typeMixGradient,
  type MapLatLng,
} from '@/lib/bodyMap';
import { typeColor } from '@/lib/objectTypes';

/** Zoom levels of `CRS.Simple`: 1 m = 2^zoom px; from a whole region down to a few metres. */
const MIN_ZOOM = -14;
const MAX_ZOOM = 5;
/** From this zoom on (1 m ≈ 2 px), every point is drawn: a building's players split. */
const UNCLUSTER_ZOOM = 1;
const FLY_SECONDS = 1.2;

export interface MapFocus {
  uuid: string;
  /** Where to fly: the point's projected position. */
  at: MapLatLng;
  /** Changes on every request, so asking twice for the same point flies there again. */
  nonce: number;
}

interface BodyMapCanvasProps {
  points: MapPoint[];
  selected?: string | undefined;
  focus?: MapFocus | null;
  onSelect: (uuid: string) => void;
  /** Tooltip content of a point (label, type, altitude…). */
  describe: (point: MapPoint) => string;
  /** Types whose names are written above their markers. */
  named: ReadonlySet<string>;
  /** Name written above a point of a named type. */
  nameOf: (point: MapPoint) => string;
  labels: { cluster: (count: number) => string; grid: (step: string, major: string) => string };
}

const toLatLng = (point: MapPoint): MapLatLng => [point.y, point.x];

const icons = new Map<string, L.DivIcon>();
/** Type of each marker icon, read back by clusters to colour their ring. */
const iconTypes = new WeakMap<L.Icon | L.DivIcon, string>();

/** Names come from the game data: escaped before going into the icon's HTML. */
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/**
 * Coloured marker of a type (square for structures, round otherwise); selected points get a
 * ring, and a `name` is written above the marker. Cached: one icon per type, state and name.
 */
function markerIcon(objectType: string, selected: boolean, name: string | null): L.DivIcon {
  const key = `${objectType}|${selected}|${name ?? ''}`;
  let icon = icons.get(key);
  if (!icon) {
    const square = markerShape(objectType) === 'square';
    const size = (selected ? 16 : 10) + (square ? 2 : 0);
    const label = name
      ? `<span class="pointer-events-none absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium leading-none text-foreground [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background),0_0_2px_var(--background)]">${escapeHtml(name)}</span>`
      : '';
    icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<span data-type="${objectType}" class="relative block size-full ${square ? 'rounded-[2px]' : 'rounded-full'} border border-background shadow-sm${
        selected ? ' ring-2 ring-foreground' : ''
      }" style="background:${typeColor(objectType)}">${label}</span>`,
    });
    icons.set(key, icon);
    iconTypes.set(icon, objectType);
  }
  return icon;
}

/** Fits the view to the points once, when they first arrive. */
function FitOnce({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points.map(toLatLng)), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/** Flies to the focused point, close enough to split the cluster holding it. */
function FlyTo({ focus }: { focus: MapFocus | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    // Leaflet scales the duration with the zoom change (seconds from a region to metres).
    if (focus)
      map.flyTo(focus.at, Math.max(map.getZoom(), UNCLUSTER_ZOOM + 1), { duration: FLY_SECONDS });
  }, [map, focus]);
  return null;
}

/**
 * Metric grid following the zoom (ADR 0018): cells of a 1-2-5 step in metres, about 80 px on
 * screen, a thick line every 5 cells, and a caption with the current step.
 */
function MetricGrid({ caption }: { caption: (step: string, major: string) => string }) {
  const map = useMap();
  const measure = useCallback(() => {
    const bounds = map.getBounds().pad(0.25);
    // CRS.Simple: 1 unit (metre) = 2^zoom pixels.
    const step = gridStep(1 / 2 ** map.getZoom());
    return {
      step,
      ...gridLines(
        {
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        },
        step,
      ),
    };
  }, [map]);
  const [grid, setGrid] = useState(measure);
  useMapEvents({ moveend: () => setGrid(measure()), zoomend: () => setGrid(measure()) });

  return (
    <>
      <Polyline
        positions={grid.minor}
        interactive={false}
        pathOptions={{ weight: 1, className: 'stroke-line-strong [stroke-opacity:0.45]' }}
      />
      <Polyline
        positions={grid.major}
        interactive={false}
        pathOptions={{ weight: 1.5, className: 'stroke-fg-3 [stroke-opacity:0.6]' }}
      />
      <div className="pointer-events-none absolute right-2.5 bottom-7 z-[1000] rounded border bg-background/90 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
        {caption(formatDistance(grid.step), formatDistance(grid.step * GRID_MAJOR_EVERY))}
      </div>
    </>
  );
}

const Points = memo(function Points({
  points,
  selected,
  onSelect,
  describe,
  labels,
  named,
  nameOf,
}: Pick<
  BodyMapCanvasProps,
  'points' | 'selected' | 'onSelect' | 'describe' | 'labels' | 'named' | 'nameOf'
>) {
  const clusterIcon = useMemo(
    () => (cluster: L.MarkerCluster) => {
      const count = cluster.getChildCount();
      const size = count < 10 ? 26 : count < 100 ? 32 : 38;
      const types = cluster
        .getAllChildMarkers()
        .map((marker) => iconTypes.get(marker.options.icon as L.DivIcon) ?? 'unknown');
      // Coloured ring (share of each type) around the count.
      return L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span aria-label="${labels.cluster(count)}" class="block size-full rounded-full p-[3px] shadow-sm" style="background:${typeMixGradient(types)}"><span class="grid size-full place-items-center rounded-full bg-background font-mono text-[11px] font-semibold text-foreground">${count}</span></span>`,
      });
    },
    [labels],
  );
  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={36}
      disableClusteringAtZoom={UNCLUSTER_ZOOM}
      showCoverageOnHover={false}
      iconCreateFunction={clusterIcon}
    >
      {points.map((point) => (
        <Marker
          key={point.object_uuid}
          position={toLatLng(point)}
          icon={markerIcon(
            point.object_type,
            point.object_uuid === selected,
            named.has(point.object_type) ? nameOf(point) : null,
          )}
          zIndexOffset={point.object_uuid === selected ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(point.object_uuid) }}
          keyboard={false}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {describe(point)}
          </Tooltip>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
});

/**
 * 2D map of a celestial body (ADR 0018): Leaflet in its non-geographic mode, coordinates in
 * projected metres (azimuthal equidistant, computed by the BFF), points clustered by proximity.
 */
export function BodyMapCanvas({
  points,
  selected,
  focus,
  onSelect,
  describe,
  labels,
  named,
  nameOf,
}: BodyMapCanvasProps) {
  return (
    <MapContainer
      crs={L.CRS.Simple}
      center={[0, 0]}
      zoom={-10}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={90}
      attributionControl={false}
      className="size-full bg-surface-2! font-sans"
    >
      <MetricGrid caption={labels.grid} />
      <Points
        points={points}
        selected={selected}
        onSelect={onSelect}
        describe={describe}
        labels={labels}
        named={named}
        nameOf={nameOf}
      />
      <ScaleControl position="bottomright" imperial={false} />
      <FitOnce points={points} />
      <FlyTo focus={focus} />
    </MapContainer>
  );
}

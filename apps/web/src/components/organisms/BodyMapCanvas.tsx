/// <reference types="leaflet.markercluster" />
import { memo, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, ScaleControl, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import type { MapPoint } from '@dyingstar-admin/schemas';
import type { MapLatLng } from '@/lib/bodyMap';
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
  /** Latitude / longitude lines, projected like the points. */
  graticule: MapLatLng[][];
  selected?: string | undefined;
  focus?: MapFocus | null;
  onSelect: (uuid: string) => void;
  /** Tooltip content of a point (label, type, altitude…). */
  describe: (point: MapPoint) => string;
  labels: { cluster: (count: number) => string };
}

const toLatLng = (point: MapPoint): MapLatLng => [point.y, point.x];

const icons = new Map<string, L.DivIcon>();
/** Coloured dot of a type; selected points get a ring. Cached: one icon per type and state. */
function dotIcon(objectType: string, selected: boolean): L.DivIcon {
  const key = `${objectType}|${selected}`;
  let icon = icons.get(key);
  if (!icon) {
    const size = selected ? 16 : 10;
    icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<span data-type="${objectType}" class="block size-full rounded-full border border-background shadow-sm${
        selected ? ' ring-2 ring-foreground' : ''
      }" style="background:${typeColor(objectType)}"></span>`,
    });
    icons.set(key, icon);
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

const Points = memo(function Points({
  points,
  selected,
  onSelect,
  describe,
  labels,
}: Pick<BodyMapCanvasProps, 'points' | 'selected' | 'onSelect' | 'describe' | 'labels'>) {
  const clusterIcon = useMemo(
    () => (cluster: L.MarkerCluster) => {
      const count = cluster.getChildCount();
      const size = count < 10 ? 26 : count < 100 ? 32 : 38;
      return L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span aria-label="${labels.cluster(count)}" class="grid size-full place-items-center rounded-full border border-line-strong bg-background/90 font-mono text-[11px] font-semibold text-foreground shadow-sm">${count}</span>`,
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
          icon={dotIcon(point.object_type, point.object_uuid === selected)}
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
  graticule,
  selected,
  focus,
  onSelect,
  describe,
  labels,
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
      {graticule.map((line, i) => (
        <Polyline
          key={i}
          positions={line}
          interactive={false}
          pathOptions={{ weight: 1, className: 'stroke-line-strong [stroke-opacity:0.7]' }}
        />
      ))}
      <Points
        points={points}
        selected={selected}
        onSelect={onSelect}
        describe={describe}
        labels={labels}
      />
      <ScaleControl position="bottomright" imperial={false} />
      <FitOnce points={points} />
      <FlyTo focus={focus} />
    </MapContainer>
  );
}

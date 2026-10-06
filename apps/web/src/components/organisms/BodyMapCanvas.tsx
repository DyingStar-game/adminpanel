/// <reference types="leaflet.markercluster" />
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
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
  fitPoints,
  formatDistance,
  gridLines,
  gridStep,
  GRID_MAJOR_EVERY,
  markerShape,
  movementHeading,
  type Movement,
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
/** Arrow head tip (8 px from its centre) set back to the selected marker's edge (10 px). */
const HEAD_BACK_PX = 19;
/** Space kept between two names on the map. */
const NAME_GAP_PX = 4;

export interface MapFocus {
  uuid: string;
  /** Where to fly: the point's projected position. */
  at: MapLatLng;
  /** Changes on every request, so asking twice for the same point flies there again. */
  nonce: number;
  /** Zoom to fly to; by default close enough to split the cluster holding the point. */
  zoom?: number;
}

interface BodyMapCanvasProps {
  points: MapPoint[];
  selected?: string | undefined;
  focus?: MapFocus | null;
  onSelect: (uuid: string) => void;
  /** A click on the map background, away from any marker: clears the selection. */
  onDeselect?: (() => void) | undefined;
  /**
   * Right click on the map background: where (projected metres) and on screen (pixels from the
   * map's top-left corner), for a menu of actions at that place.
   */
  onContextMenu?: ((at: MapLatLng, screen: { x: number; y: number }) => void) | undefined;
  /** Right click on a marker: its item, and where on screen (for a menu of its actions). */
  onPointMenu?: ((uuid: string, screen: { x: number; y: number }) => void) | undefined;
  /** Any move or zoom of the view (closes a menu opened at a place). */
  onViewChange?: (() => void) | undefined;
  /** Tooltip content of a point (label, type, altitude…). */
  describe: (point: MapPoint) => string;
  /** Types whose names are written above their markers. */
  named: ReadonlySet<string>;
  /** Name written above a point of a named type. */
  nameOf: (point: MapPoint) => string;
  /** Last move of the selected item, drawn as an arrow. */
  /** Moves of the selected item since it was selected, drawn as a trail ending in an arrow. */
  movement?:
    { moves: Movement[]; color: string; label: (move: Movement) => string } | null | undefined;
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
    const size = (selected ? 20 : 14) + (square ? 2 : 0);
    const label = name
      ? `<span class="map-name pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-sm font-semibold leading-none text-foreground [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background),0_0_2px_var(--background)]">${escapeHtml(name)}</span>`
      : '';
    icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<span data-type="${objectType}"${selected ? ' data-selected' : ''} class="relative block size-full ${square ? 'rounded-xs' : 'rounded-full'} border border-background shadow-sm${
        selected ? ' ring-2 ring-foreground' : ''
      }" style="background:${typeColor(objectType)}">${label}</span>`,
    });
    icons.set(key, icon);
    iconTypes.set(icon, objectType);
  }
  return icon;
}

/** Arrow of the last move: a line from the previous position, a head at the new one. */
function MoveTrail({
  moves,
  color,
  label,
}: {
  moves: Movement[];
  color: string;
  label: (move: Movement) => string;
}) {
  const last = moves.at(-1);
  // The head keeps its size on screen: a marker rotated to the last heading, moved back so its
  // tip touches the selected marker instead of hiding under it.
  const head = useMemo(
    () =>
      last &&
      L.divIcon({
        className: '',
        iconSize: [18, 18],
        html: `<svg viewBox="0 0 18 18" width="18" height="18" style="transform:rotate(${movementHeading(
          last,
        )}deg) translateY(${HEAD_BACK_PX}px)"><path d="M9 1 L16 16 L9 12 L2 16 Z" fill="${color}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
      }),
    [last, color],
  );
  return (
    <>
      {/* Earlier moves fainter, the last one plain; each tells its distance and time. */}
      {moves.map((move, i) => (
        <Polyline
          key={`${move.at}-${i}`}
          positions={[move.from, move.to]}
          pathOptions={{
            color,
            weight: 3,
            opacity: move === last ? 0.9 : 0.45,
            dashArray: '8 6',
          }}
        >
          <Tooltip sticky>{label(move)}</Tooltip>
        </Polyline>
      ))}
      {moves.slice(0, -1).map((move, i) => (
        <CircleMarker
          key={`stop-${move.at}-${i}`}
          center={move.to}
          radius={3}
          interactive={false}
          pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.6, opacity: 0.6 }}
        />
      ))}
      {last && head && (
        <Marker position={last.to} icon={head} interactive={false} zIndexOffset={900} />
      )}
    </>
  );
}

/** Fits the view to the points once, when they first arrive. */
function FitOnce({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(fitPoints(points).map(toLatLng)), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/**
 * Clicks on the map background (markers and clusters do not pass theirs on to the map, and a
 * drag is not a click).
 */
function BackgroundClick({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

/** Right clicks on the map background, and view changes (markers keep their own clicks). */
function BackgroundMenu({
  onContextMenu,
  onViewChange,
}: Pick<BodyMapCanvasProps, 'onContextMenu' | 'onViewChange'>) {
  useMapEvents({
    contextmenu: (event) => {
      event.originalEvent.preventDefault();
      onContextMenu?.([event.latlng.lat, event.latlng.lng], {
        x: event.containerPoint.x,
        y: event.containerPoint.y,
      });
    },
    movestart: () => onViewChange?.(),
    zoomstart: () => onViewChange?.(),
  });
  return null;
}

/**
 * Hides the names that would overlap one already shown: the selected item's name first, then
 * the others in drawing order. Run after every move, zoom or change of the markers (clusters
 * splitting add and remove them), on the next frame once they are laid out.
 */
function DeclutterNames() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane('markerPane');
    if (!pane) return;
    let frame = 0;
    const run = () => {
      frame = 0;
      const names = [...pane.querySelectorAll<HTMLElement>('.map-name')];
      for (const name of names) name.style.visibility = '';
      const selectedFirst = [
        ...names.filter((n) => n.parentElement?.hasAttribute('data-selected')),
        ...names.filter((n) => !n.parentElement?.hasAttribute('data-selected')),
      ];
      const shown: DOMRect[] = [];
      for (const name of selectedFirst) {
        const box = name.getBoundingClientRect();
        const clash = shown.some(
          (other) =>
            box.left < other.right + NAME_GAP_PX &&
            other.left < box.right + NAME_GAP_PX &&
            box.top < other.bottom + NAME_GAP_PX &&
            other.top < box.bottom + NAME_GAP_PX,
        );
        if (clash) name.style.visibility = 'hidden';
        else shown.push(box);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(pane, { childList: true });
    map.on('moveend zoomend', schedule);
    schedule();
    return () => {
      observer.disconnect();
      map.off('moveend zoomend', schedule);
      cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

/** Flies to the focused point, close enough to split the cluster holding it. */
function FlyTo({ focus }: { focus: MapFocus | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    // Leaflet scales the duration with the zoom change (seconds from a region to metres).
    if (focus)
      map.flyTo(focus.at, focus.zoom ?? Math.max(map.getZoom(), UNCLUSTER_ZOOM + 1), {
        duration: FLY_SECONDS,
      });
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

  // Neutral grey (white at low opacity): the palette's lines lean towards blue. The colour is
  // given to Leaflet itself, not through a CSS class: without it Leaflet draws its default blue
  // whenever the class does not apply (e.g. while the dev server reloads the styles).
  return (
    <>
      <Polyline
        positions={grid.minor}
        interactive={false}
        pathOptions={{ weight: 1, color: '#ffffff', opacity: 0.1 }}
      />
      <Polyline
        positions={grid.major}
        interactive={false}
        pathOptions={{ weight: 1.5, color: '#ffffff', opacity: 0.22 }}
      />
      <div className="pointer-events-none absolute right-2.5 bottom-7 z-[1000] rounded border bg-background/90 px-1.5 py-0.5 font-mono text-2xs text-fg-2">
        {caption(formatDistance(grid.step), formatDistance(grid.step * GRID_MAJOR_EVERY))}
      </div>
    </>
  );
}

const Points = memo(function Points({
  points,
  selected,
  onSelect,
  onPointMenu,
  describe,
  labels,
  named,
  nameOf,
}: Pick<
  BodyMapCanvasProps,
  'points' | 'selected' | 'onSelect' | 'onPointMenu' | 'describe' | 'labels' | 'named' | 'nameOf'
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
        html: `<span aria-label="${labels.cluster(count)}" class="block size-full rounded-full p-0.75 shadow-sm" style="background:${typeMixGradient(types)}"><span class="grid size-full place-items-center rounded-full bg-background font-mono text-2xs font-semibold text-foreground">${count}</span></span>`,
      });
    },
    [labels],
  );
  return (
    <>
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={36}
        disableClusteringAtZoom={UNCLUSTER_ZOOM}
        showCoverageOnHover={false}
        iconCreateFunction={clusterIcon}
      >
        {points
          .filter((point) => point.object_uuid !== selected)
          .map((point) => (
            <PointMarker
              key={point.object_uuid}
              point={point}
              selected={false}
              onSelect={onSelect}
              onMenu={onPointMenu}
              describe={describe}
              name={named.has(point.object_type) ? nameOf(point) : null}
            />
          ))}
      </MarkerClusterGroup>
      {/* The selected item is never swallowed by a cluster. */}
      {points
        .filter((point) => point.object_uuid === selected)
        .map((point) => (
          <PointMarker
            key={point.object_uuid}
            point={point}
            selected
            onSelect={onSelect}
            onMenu={onPointMenu}
            describe={describe}
            name={named.has(point.object_type) ? nameOf(point) : null}
          />
        ))}
    </>
  );
});

function PointMarker({
  point,
  selected,
  onSelect,
  onMenu,
  describe,
  name,
}: {
  point: MapPoint;
  selected: boolean;
  onSelect: (uuid: string) => void;
  onMenu?: ((uuid: string, screen: { x: number; y: number }) => void) | undefined;
  describe: (point: MapPoint) => string;
  name: string | null;
}) {
  return (
    <Marker
      position={toLatLng(point)}
      icon={markerIcon(point.object_type, selected, name)}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        click: () => onSelect(point.object_uuid),
        contextmenu: (event) => {
          event.originalEvent.preventDefault();
          onMenu?.(point.object_uuid, { x: event.containerPoint.x, y: event.containerPoint.y });
        },
      }}
      keyboard={false}
    >
      <Tooltip direction="top" offset={[0, -6]}>
        {describe(point)}
      </Tooltip>
    </Marker>
  );
}

/**
 * 2D map of a celestial body (ADR 0018): Leaflet in its non-geographic mode, coordinates in
 * projected metres (azimuthal equidistant, computed by the BFF), points clustered by proximity.
 */
export function BodyMapCanvas({
  points,
  selected,
  focus,
  onSelect,
  onDeselect,
  onContextMenu,
  onPointMenu,
  onViewChange,
  describe,
  labels,
  named,
  nameOf,
  movement,
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
        onPointMenu={onPointMenu}
        describe={describe}
        labels={labels}
        named={named}
        nameOf={nameOf}
      />
      <ScaleControl position="bottomright" imperial={false} />
      <FitOnce points={points} />
      {movement && <MoveTrail {...movement} />}
      <FlyTo focus={focus} />
      <DeclutterNames />
      {onDeselect && <BackgroundClick onClick={onDeselect} />}
      <BackgroundMenu onContextMenu={onContextMenu} onViewChange={onViewChange} />
    </MapContainer>
  );
}

import { useCallback, useState, type ReactNode } from 'react';
import L from 'leaflet';
import { MapContainer, Polyline, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistance, gridLines, gridStep, GRID_MAJOR_EVERY } from '@/lib/bodyMap';
import { cn } from '@/lib/cn';

/** Zoom levels of `CRS.Simple`: 1 m = 2^zoom px; from a whole region down to a few metres. */
const MIN_ZOOM = -14;
const MAX_ZOOM = 5;

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

interface MetricMapProps {
  /** Caption of the grid: the cell's size and the thick lines' spacing. */
  gridCaption: (step: string, major: string) => string;
  className?: string;
  /** Layers drawn on the map (markers, lines, behaviours using `useMap`). */
  children?: ReactNode;
}

/**
 * Frame of the panel's 2D maps (ADR 0018): Leaflet in its non-geographic mode (`CRS.Simple`),
 * coordinates in projected metres east / north, the metric grid and a scale bar. The planetary
 * map and the simulation's network (ADR 0025) draw their layers in it.
 */
export function MetricMap({ gridCaption, className, children }: MetricMapProps) {
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
      className={cn('size-full bg-surface-2! font-sans', className)}
    >
      <MetricGrid caption={gridCaption} />
      <ScaleControl position="bottomright" imperial={false} />
      {children}
    </MapContainer>
  );
}

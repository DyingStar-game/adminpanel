import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Poi } from '@dyingstar-admin/contracts/inventory';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { directionOf } from '@dyingstar-admin/schemas';
import { Circle, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { MapLegend } from '@/components/molecules/MapLegend';
import { MetricMap } from '@/components/molecules/MetricMap';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { useMissionLandmarks } from '@/hooks/useMissionLandmarks';
import { escapeHtml, movementHeading, pointLabel } from '@/lib/bodyMap';
import { typeColor } from '@/lib/objectTypes';
import { shortId } from '@/lib/format';
import { objectiveView, type PlaceRole } from '@/lib/objectiveSchematics';
import {
  formatDistance,
  LANDMARK_TYPES,
  missionPlaces,
  ROLE_COLORS,
  type PlaceLatLng,
  type PlacesFrame,
} from '@/lib/places';

interface MissionPlacesMapProps {
  objectives: MissionObjective[];
  /** The POIs the objectives point at, from `inventory`; unset when they were not read. */
  places: Record<string, Poi | null> | undefined;
  /** The objective chosen: its places ringed, the others dimmed. */
  selected: string | undefined;
  onSelect: (objectiveId: string) => void;
}

const ROLES: PlaceRole[] = ['pickup', 'dropoff', 'target'];

/** A place: a disc of its role's colour, its name above, ringed when its objective is chosen. */
function placeIcon(name: string, role: PlaceRole, state: 'chosen' | 'other' | 'none') {
  const size = state === 'chosen' ? 20 : 16;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<span data-role="${role}" class="relative block size-full rounded-full border-2 border-background shadow-sm${
      state === 'chosen' ? ' ring-2 ring-foreground' : ''
    }" style="background:${ROLE_COLORS[role]};opacity:${state === 'other' ? 0.35 : 1}"><span class="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-sm font-semibold leading-none text-foreground [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]">${escapeHtml(name)}</span></span>`,
  });
}

/** Landmarks named by default: villages and cities, the names players know. */
const NAMED_BY_DEFAULT = ['poi_village', 'city'];
/** Below this zoom (1 px = 64 m) landmarks lose their names: they would pile up. */
const NAMES_MIN_ZOOM = -6;

/** Reports the map's zoom as it changes. */
function ZoomWatch({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

const landmarkIcons = new Map<string, L.DivIcon>();

/** A landmark: a small square of its type's colour, its name beside it when names are on. */
function landmarkIcon(objectType: string, name: string | null) {
  const key = `${objectType}|${name ?? ''}`;
  let icon = landmarkIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      iconSize: [9, 9],
      html: `<span class="relative block size-full rounded-xs border border-background" style="background:${typeColor(objectType)}">${
        name
          ? `<span class="pointer-events-none absolute top-1/2 left-full ml-1 -translate-y-1/2 whitespace-nowrap text-xs leading-none text-fg-2 [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]">${escapeHtml(name)}</span>`
          : ''
      }</span>`,
    });
    landmarkIcons.set(key, icon);
  }
  return icon;
}

/** Head of a route at its delivery place, pointing along it. */
function routeHead(from: PlaceLatLng, to: PlaceLatLng, opacity: number) {
  return L.divIcon({
    className: '',
    iconSize: [16, 16],
    html: `<svg viewBox="0 0 16 16" width="16" height="16" style="transform:rotate(${movementHeading(
      { from, to },
    )}deg) translateY(14px)"><path d="M8 1 L14 14 L8 10.5 L2 14 Z" fill="var(--ds-acc)" fill-opacity="${opacity}" stroke="var(--background)" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  });
}

/** Fits the view on the places of the body shown, each time it changes. */
function FitPlaces({ points, body }: { points: PlaceLatLng[]; body: string }) {
  const map = useMap();
  const shown = useRef<string | null>(null);
  // The legend beside the map appears with the landmarks: Leaflet must read its new size.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (shown.current === body || points.length === 0) return;
    shown.current = body;
    map.invalidateSize();
    // Not animated: a resize during the animation (the legend appearing) would leave it halfway.
    if (points.length === 1) map.setView(points[0] as PlaceLatLng, -1, { animate: false });
    else {
      map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 0, animate: false });
    }
  }, [map, points, body]);
  return null;
}

/**
 * A mission's places on a map (ADR 0027), drawn like the simulation's network: each POI of its
 * objectives as a disc coloured by its role with its name, its zone as a circle, a `transport`
 * as a line from where the goods are loaded to where they are delivered (dashed until loaded),
 * in a frame of the places themselves (true distances around them). A click on a place chooses
 * its objective; the chosen objective's places are ringed. Places elsewhere are listed.
 */
export function MissionPlacesMap({
  objectives,
  places: pois,
  selected,
  onSelect,
}: MissionPlacesMapProps) {
  const { t, i18n } = useTranslation();
  const views = useMemo(
    () => objectives.map((o) => ({ objective: o, view: objectiveView(o, pois) })),
    [objectives, pois],
  );
  const own = useMemo(() => missionPlaces(views), [views]);
  const [chosenBody, setChosenBody] = useState<string | undefined>(undefined);
  const model = (own.bodies.find((b) => b.model === chosenBody) ?? own.bodies[0])?.model;

  // The planet's landmarks, shown or hidden by type as on its map (ADR 0027 update).
  const [shownTypes, setShownTypes] = useState<string[]>([...LANDMARK_TYPES]);
  const [namedTypes, setNamedTypes] = useState<string[]>(NAMED_BY_DEFAULT);
  const [zoom, setZoom] = useState(0);
  const landmarks = useMissionLandmarks(model, shownTypes);
  const landmarksMap = landmarks.map.data;
  // On the planet map's frame once read, so the places land among its landmarks.
  const places = useMemo(() => {
    if (!model || !landmarksMap) return own;
    const frame: PlacesFrame = {
      center: directionOf(landmarksMap.center.lat, landmarksMap.center.lon),
      radius: landmarksMap.referenceRadius,
    };
    return missionPlaces(views, new Map([[model, frame]]));
  }, [own, views, model, landmarksMap]);
  const shown = places.bodies.find((b) => b.model === model);
  const legend = (landmarksMap?.counts ?? [])
    .filter((c) => LANDMARK_TYPES.includes(c.object_type) && c.total > 0)
    .map((c) => ({
      objectType: c.object_type,
      count: c.total,
      shown: shownTypes.includes(c.object_type),
      named: namedTypes.includes(c.object_type),
      shape: 'square' as const,
      omitted: landmarksMap?.omitted.includes(c.object_type),
    }))
    .sort((a, b) => b.count - a.count);
  const landmarkPoints = (landmarksMap?.points ?? []).filter(
    (p) => LANDMARK_TYPES.includes(p.object_type) && shownTypes.includes(p.object_type),
  );
  const toggle = (list: string[], type: string, on: boolean) =>
    on ? [...new Set([...list, type])] : list.filter((t) => t !== type);
  const points = useMemo(() => shown?.places.map((p) => p.at) ?? [], [shown]);
  const roleName = (role: PlaceRole) => t(`missions.objectivePlaces.${role}`);
  const bodyName = (b: (typeof places.bodies)[number]) =>
    b.body ? [b.body.designation, b.body.name].filter(Boolean).join(' — ') : b.model;

  if (!shown && places.undrawn.length === 0) return null;
  if (!pois) return <ServiceNotice message={t('missions.placesMap.unread')} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {places.bodies.length > 1 && shown && (
          <OptionSelect<string>
            label={t('missions.placesMap.body')}
            value={shown.model}
            options={places.bodies.map((b) => ({ value: b.model, label: bodyName(b) }))}
            onChange={setChosenBody}
            className="w-56"
          />
        )}
        <ul aria-label={t('missions.placesMap.legend')} className="flex flex-wrap gap-3 text-xs">
          {ROLES.map((role) => (
            <li key={role} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: ROLE_COLORS[role] }}
              />
              {roleName(role)}
            </li>
          ))}
        </ul>
        {shown && (
          <p className="text-xs text-fg-3">
            {t(landmarksMap ? 'missions.placesMap.onPlanetMap' : 'missions.placesMap.onBody', {
              name: bodyName(shown),
            })}
            {!landmarks.readable && ` · ${t('missions.placesMap.noLandmarks')}`}
          </p>
        )}
      </div>
      {shown && (
        <div className="flex h-112 overflow-hidden rounded-lg border">
          <div
            className="relative min-w-0 flex-1"
            role="region"
            aria-label={t('missions.placesMap.label')}
          >
            <MetricMap gridCaption={(step, major) => t('missions.placesMap.grid', { step, major })}>
              {landmarkPoints.map((p) => (
                <Marker
                  key={p.object_uuid}
                  position={[p.y, p.x]}
                  icon={landmarkIcon(
                    p.object_type,
                    zoom >= NAMES_MIN_ZOOM && namedTypes.includes(p.object_type)
                      ? pointLabel(p)
                      : null,
                  )}
                  interactive={false}
                  keyboard={false}
                  title={`${pointLabel(p)} · ${p.object_type}`}
                />
              ))}
              {shown.places.map((p) =>
                p.poi.radiusM ? (
                  <Circle
                    key={`zone-${p.poi.id}`}
                    center={p.at}
                    radius={p.poi.radiusM}
                    interactive={false}
                    pathOptions={{
                      color: ROLE_COLORS[p.uses[0]?.role ?? 'target'],
                      weight: 1,
                      opacity: 0.6,
                      fillOpacity: 0.08,
                    }}
                  />
                ) : null,
              )}
              {shown.routes.map((r) => {
                const dim = selected !== undefined && selected !== r.objectiveId;
                const opacity = dim ? 0.3 : r.loaded ? 0.9 : 0.6;
                return (
                  <Polyline
                    key={`route-${r.objectiveId}`}
                    positions={[r.from, r.to]}
                    pathOptions={{
                      color: '#ffba08',
                      weight: selected === r.objectiveId ? 4 : 3,
                      opacity,
                      ...(r.loaded ? {} : { dashArray: '8 6' }),
                    }}
                    eventHandlers={{ click: () => onSelect(r.objectiveId) }}
                  >
                    <Tooltip sticky>
                      {[
                        t(
                          r.loaded
                            ? 'missions.objectivePlaces.loaded'
                            : 'missions.objectivePlaces.toLoad',
                        ),
                        r.distance !== null
                          ? t('missions.objectivePlaces.distance', {
                              distance: formatDistance(r.distance, i18n.language),
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Tooltip>
                  </Polyline>
                );
              })}
              {shown.routes.map((r) => (
                <Marker
                  key={`head-${r.objectiveId}`}
                  position={r.to}
                  icon={routeHead(
                    r.from,
                    r.to,
                    selected !== undefined && selected !== r.objectiveId ? 0.3 : 1,
                  )}
                  interactive={false}
                  keyboard={false}
                />
              ))}
              {shown.places.map((p) => {
                const chosen = p.uses.some((u) => u.objectiveId === selected);
                const state = selected === undefined ? 'none' : chosen ? 'chosen' : 'other';
                const first = p.uses[0];
                return (
                  <Marker
                    key={p.poi.id}
                    position={p.at}
                    icon={placeIcon(p.poi.name, first?.role ?? 'target', state)}
                    zIndexOffset={chosen ? 1000 : 500}
                    title={[
                      p.poi.name,
                      ...p.uses.map((u) =>
                        t('missions.placesMap.use', {
                          step: u.step,
                          title: u.title,
                          role: roleName(u.role),
                        }),
                      ),
                    ].join(' · ')}
                    eventHandlers={{ click: () => first && onSelect(first.objectiveId) }}
                  />
                );
              })}
              <ZoomWatch onZoom={setZoom} />
              <FitPlaces
                points={points}
                body={`${shown.model}|${landmarksMap ? 'planet' : 'own'}`}
              />
            </MetricMap>
          </div>
          {legend.length > 0 && (
            <aside className="w-60 shrink-0 overflow-y-auto border-l p-3">
              <MapLegend
                entries={legend}
                onToggle={(type, on) => setShownTypes((list) => toggle(list, type, on))}
                onToggleNames={(type, on) => setNamedTypes((list) => toggle(list, type, on))}
                labels={{
                  title: t('missions.placesMap.landmarks'),
                  toggle: (type) => t('map.toggle', { type }),
                  names: (type) => t('map.names', { type }),
                  omitted: t('map.omitted'),
                }}
              />
            </aside>
          )}
        </div>
      )}
      {places.undrawn.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <h3 className="text-xs text-fg-3">{t('missions.placesMap.elsewhere')}</h3>
          <ul className="flex flex-col gap-0.5">
            {places.undrawn.map((p) => (
              <li key={p.poiId}>
                {p.poi
                  ? `${p.poi.name} · ${t('missions.objectivePlaces.space')}`
                  : `${t(p.poi === null ? 'missions.objectivePlaces.unknown' : 'missions.objectivePlaces.unread')} · ${shortId(p.poiId)}`}
                <span className="text-fg-3">
                  {' — '}
                  {p.uses
                    .map((u) =>
                      t('missions.placesMap.use', {
                        step: u.step,
                        title: u.title,
                        role: roleName(u.role),
                      }),
                    )
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

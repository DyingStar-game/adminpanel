import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Poi } from '@dyingstar-admin/contracts/inventory';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { Circle, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { MetricMap } from '@/components/molecules/MetricMap';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { escapeHtml, movementHeading } from '@/lib/bodyMap';
import { shortId } from '@/lib/format';
import { objectiveView, type PlaceRole } from '@/lib/objectiveSchematics';
import { formatDistance, missionPlaces, ROLE_COLORS, type PlaceLatLng } from '@/lib/places';

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
  useEffect(() => {
    if (shown.current === body || points.length === 0) return;
    shown.current = body;
    if (points.length === 1) map.setView(points[0] as PlaceLatLng, -1);
    else map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 0 });
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
  const places = useMemo(
    () => missionPlaces(objectives.map((o) => ({ objective: o, view: objectiveView(o, pois) }))),
    [objectives, pois],
  );
  const [chosenBody, setChosenBody] = useState<string | undefined>(undefined);
  const shown = places.bodies.find((b) => b.model === chosenBody) ?? places.bodies[0];
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
            {t('missions.placesMap.onBody', { name: bodyName(shown) })}
          </p>
        )}
      </div>
      {shown && (
        <div
          className="relative h-112 overflow-hidden rounded-lg border"
          role="region"
          aria-label={t('missions.placesMap.label')}
        >
          <MetricMap gridCaption={(step, major) => t('missions.placesMap.grid', { step, major })}>
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
            <FitPlaces points={points} body={shown.model} />
          </MetricMap>
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

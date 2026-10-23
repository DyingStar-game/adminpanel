import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinIcon } from 'lucide-react';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { formatAltitude, formatLatLon } from '@/lib/bodyMap';
import { shortId } from '@/lib/format';
import type { PlaceView } from '@/lib/objectiveSchematics';
import { formatDistance, placeFacts, surfaceDistance } from '@/lib/places';

interface ObjectiveRouteProps {
  places: PlaceView[];
  /** What travels along the route, e.g. `20 barrels of water_barrel`. */
  cargo?: string | undefined;
  /** For a two-phase kind, whether the goods are loaded; null otherwise. */
  loaded: boolean | null;
}

/** Width of one place's column in the drawing, in pixels. */
const COLUMN = 220;
const HEIGHT = 44;
const PIN_Y = 22;

/**
 * An objective's places (ADR 0026): pins joined by an arrow carrying the goods, a marker where
 * the goods are (at the pick-up until loaded, on the way after), then each place's name, body,
 * latitude / longitude and altitude as `inventory` gave them, or its id when it was not read.
 */
export function ObjectiveRoute({ places, cargo, loaded }: ObjectiveRouteProps) {
  const { t, i18n } = useTranslation();
  // One arrowhead per drawing: several objectives share the page.
  const arrow = `objective-arrow-${useId().replace(/:/g, '')}`;
  if (places.length === 0) return null;
  const width = COLUMN * places.length;
  const x = (i: number) => COLUMN * i + COLUMN / 2;
  const [first, last] = [places[0], places.at(-1)];
  const distance =
    places.length > 1 && first?.poi && last?.poi ? surfaceDistance(first.poi, last.poi) : null;

  return (
    <figure className="flex flex-col gap-2" aria-label={t('missions.objectiveDetail.route')}>
      {/* One place is a pin only: the drawing joins two or more. */}
      {places.length > 1 && (
        <div className="overflow-x-auto">
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block max-w-none"
            aria-hidden
          >
            <defs>
              <marker
                id={arrow}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--ds-fg-2)" />
              </marker>
            </defs>
            {places.slice(1).map((_, i) => (
              <g key={i}>
                <line
                  x1={x(i) + 12}
                  y1={PIN_Y}
                  x2={x(i + 1) - 14}
                  y2={PIN_Y}
                  stroke="var(--ds-fg-2)"
                  strokeWidth={1.5}
                  strokeDasharray={loaded ? undefined : '5 4'}
                  markerEnd={`url(#${arrow})`}
                />
                {cargo && (
                  <text
                    x={(x(i) + x(i + 1)) / 2}
                    y={PIN_Y - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--ds-fg-2)"
                  >
                    {cargo}
                  </text>
                )}
                {distance !== null && (
                  <text
                    x={(x(i) + x(i + 1)) / 2}
                    y={PIN_Y + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--ds-fg-3)"
                  >
                    {t('missions.objectivePlaces.distance', {
                      distance: formatDistance(distance, i18n.language),
                    })}
                  </text>
                )}
              </g>
            ))}
            {places.map((place, i) => (
              <circle
                key={`${place.role}:${i}`}
                cx={x(i)}
                cy={PIN_Y}
                r={8}
                fill={place.poi ? 'var(--ds-acc)' : 'var(--ds-bg)'}
                stroke={place.poi ? 'var(--ds-acc)' : 'var(--ds-fg-3)'}
                strokeWidth={1.5}
              />
            ))}
            {loaded !== null && places.length > 1 && (
              <rect
                x={(loaded ? (x(0) + x(1)) / 2 : x(0)) - 5}
                y={PIN_Y - 5}
                width={10}
                height={10}
                rx={2}
                fill="var(--ds-fg)"
              />
            )}
          </svg>
        </div>
      )}
      <ol
        className="grid gap-3 text-sm"
        style={{ gridTemplateColumns: `repeat(${places.length}, minmax(0, ${COLUMN}px))` }}
      >
        {places.map((place, i) => (
          <li key={`${place.role}:${i}`} className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs text-fg-3">
              <MapPinIcon aria-hidden size={12} />
              {t(`missions.objectivePlaces.${place.role}`)}
            </span>
            <PlaceDetails place={place} language={i18n.language} />
          </li>
        ))}
      </ol>
      {loaded !== null && (
        <p className="text-xs text-fg-3">
          {t(loaded ? 'missions.objectivePlaces.loaded' : 'missions.objectivePlaces.toLoad')}
        </p>
      )}
    </figure>
  );
}

/** One place: its name and where it stands, or why it is not known. */
function PlaceDetails({ place, language }: { place: PlaceView; language: string }) {
  const { t } = useTranslation();
  if (!place.poiId)
    return <span className="text-fg-3">{t('missions.objectivePlaces.somewhere')}</span>;
  const id = (
    <span className="flex items-center gap-1">
      <MonoText tone="subtle" title={place.poiId}>
        {shortId(place.poiId)}
      </MonoText>
      <CopyButton value={place.poiId} label={t('missions.objectivePlaces.copy')} />
    </span>
  );
  if (!place.poi) {
    return (
      <>
        <span className="text-fg-3">
          {place.poi === null
            ? t('missions.objectivePlaces.unknown')
            : t('missions.objectivePlaces.unread')}
        </span>
        {id}
      </>
    );
  }
  const facts = placeFacts(place.poi);
  const body = facts.body
    ? [facts.body.designation, facts.body.name].filter(Boolean).join(' — ')
    : facts.model;
  return (
    <>
      <span className="font-medium">{place.poi.name}</span>
      <span className="text-xs text-fg-2">{body ?? t('missions.objectivePlaces.space')}</span>
      {facts.latLon && (
        <MonoText tone="subtle">{formatLatLon(facts.latLon.lat, facts.latLon.lon)}</MonoText>
      )}
      {facts.altitude !== null && (
        <span className="text-xs text-fg-3">
          {t('missions.objectivePlaces.altitude', { altitude: formatAltitude(facts.altitude) })}
        </span>
      )}
      {place.poi.radiusM !== null && (
        <span className="text-xs text-fg-3">
          {t('missions.objectivePlaces.radius', {
            radius: formatDistance(place.poi.radiusM, language),
          })}
        </span>
      )}
      {id}
    </>
  );
}

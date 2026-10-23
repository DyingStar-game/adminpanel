import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatAltitude, formatLatLon } from '@/lib/bodyMap';
import type { PlaceView } from '@/lib/objectiveSchematics';
import { formatDistance, placeFacts, ROLE_COLORS, surfaceDistance } from '@/lib/places';
import { IdLabel } from './IdLabel';

interface ObjectivePlacesProps {
  places: PlaceView[];
  /** For a two-phase kind, whether the goods are loaded; null otherwise. */
  loaded: boolean | null;
}

/**
 * An objective's places in a column (ADR 0027; the map draws them): each one's role bubble and
 * name, the bubbles joined by a dotted line with the distance along the surface beside it, then
 * whether the goods are loaded. A place's name opens its details (body, latitude / longitude,
 * altitude, zone, id); a place `inventory` does not know, or did not give, shows its id.
 */
export function ObjectivePlaces({ places, loaded }: ObjectivePlacesProps) {
  const { t, i18n } = useTranslation();
  if (places.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <ol className="flex flex-col text-sm" aria-label={t('missions.objectiveDetail.places')}>
        {places.map((place, i) => {
          const next = places[i + 1];
          const distance = next?.poi && place.poi ? surfaceDistance(place.poi, next.poi) : null;
          return (
            <li key={`${place.role}:${i}`} className="flex gap-3">
              {/* The bubble, and the dotted line down to the next place. */}
              <span className="flex w-3 shrink-0 flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1 size-3 shrink-0 rounded-full border-2 border-background"
                  style={{ background: ROLE_COLORS[place.role] }}
                />
                {next && (
                  <span
                    aria-hidden
                    className="my-1 min-h-6 w-0 flex-1 border-l-2 border-dotted border-fg-3"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-16 shrink-0 text-xs text-fg-3">
                    {t(`missions.objectivePlaces.${place.role}`)}
                  </span>
                  <PlaceName place={place} language={i18n.language} />
                </span>
                {next && (
                  <span className="flex min-h-6 items-center text-xs text-fg-3">
                    {distance !== null &&
                      t('missions.objectivePlaces.distance', {
                        distance: formatDistance(distance, i18n.language),
                      })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {loaded !== null && (
        <p className="pl-6 text-xs text-fg-3">
          {t(loaded ? 'missions.objectivePlaces.loaded' : 'missions.objectivePlaces.toLoad')}
        </p>
      )}
    </div>
  );
}

/** A place's name, its details on a click; its id when it is not known. */
function PlaceName({ place, language }: { place: PlaceView; language: string }) {
  const { t } = useTranslation();
  if (!place.poiId) {
    return <span className="text-fg-3">{t('missions.objectivePlaces.somewhere')}</span>;
  }
  if (!place.poi) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-fg-3">
          {place.poi === null
            ? t('missions.objectivePlaces.unknown')
            : t('missions.objectivePlaces.unread')}
        </span>
        <IdLabel id={place.poiId} copyLabel={t('missions.objectivePlaces.copy')} />
      </span>
    );
  }
  const facts = placeFacts(place.poi);
  const body = facts.body
    ? [facts.body.designation, facts.body.name].filter(Boolean).join(' — ')
    : facts.model;
  return (
    <Popover>
      <PopoverTrigger
        className="truncate font-medium underline decoration-dotted underline-offset-4 hover:text-link"
        title={place.poi.id}
      >
        {place.poi.name}
      </PopoverTrigger>
      <PopoverContent align="start" className="gap-1 text-sm">
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
        <IdLabel id={place.poi.id} copyLabel={t('missions.objectivePlaces.copy')} />
      </PopoverContent>
    </Popover>
  );
}

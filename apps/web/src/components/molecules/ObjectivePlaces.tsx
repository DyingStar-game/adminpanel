import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { formatAltitude, formatLatLon } from '@/lib/bodyMap';
import { shortId } from '@/lib/format';
import type { PlaceView } from '@/lib/objectiveSchematics';
import { formatDistance, placeFacts, ROLE_COLORS, surfaceDistance } from '@/lib/places';

interface ObjectivePlacesProps {
  places: PlaceView[];
  /** For a two-phase kind, whether the goods are loaded; null otherwise. */
  loaded: boolean | null;
}

/**
 * An objective's places as text (ADR 0027; the map draws them): each one's role, name, body,
 * latitude / longitude, altitude and zone as `inventory` gave them, or its id when it was not
 * read; for a route, its distance along the surface and whether the goods are loaded.
 */
export function ObjectivePlaces({ places, loaded }: ObjectivePlacesProps) {
  const { t, i18n } = useTranslation();
  if (places.length === 0) return null;
  const [first, last] = [places[0], places.at(-1)];
  const distance =
    places.length > 1 && first?.poi && last?.poi ? surfaceDistance(first.poi, last.poi) : null;

  return (
    <div className="flex flex-col gap-2">
      <ol
        className="flex flex-wrap gap-x-8 gap-y-3 text-sm"
        aria-label={t('missions.objectiveDetail.places')}
      >
        {places.map((place, i) => (
          <li key={`${place.role}:${i}`} className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs text-fg-3">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: ROLE_COLORS[place.role] }}
              />
              {t(`missions.objectivePlaces.${place.role}`)}
            </span>
            <PlaceDetails place={place} language={i18n.language} />
          </li>
        ))}
      </ol>
      {(distance !== null || loaded !== null) && (
        <p className="text-xs text-fg-3">
          {[
            distance !== null
              ? t('missions.objectivePlaces.distance', {
                  distance: formatDistance(distance, i18n.language),
                })
              : null,
            loaded !== null
              ? t(loaded ? 'missions.objectivePlaces.loaded' : 'missions.objectivePlaces.toLoad')
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
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

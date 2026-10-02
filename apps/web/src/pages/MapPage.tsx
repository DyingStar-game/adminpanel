import { useCallback, useMemo, useState } from 'react';
import { CompassIcon, ExpandIcon, NetworkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorCode, type BodyMapResponse, type MapPoint } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { MapLegend } from '@/components/molecules/MapLegend';
import { MapSearch } from '@/components/molecules/MapSearch';
import { BodyMapCanvas, type MapFocus } from '@/components/organisms/BodyMapCanvas';
import { Inspector } from '@/components/organisms/Inspector';
import { OrbitLayout } from '@/components/templates/OrbitLayout';
import { Button } from '@/components/ui/button';
import { useBodyMap } from '@/hooks/useBodyMap';
import { ApiError } from '@/lib/api';
import {
  formatAltitude,
  formatDistance,
  formatLatLon,
  isShown,
  mapLegend,
  markerShape,
  pointLabel,
  searchPoints,
  trackMovement,
  type MovementTracker,
} from '@/lib/bodyMap';
import type { MapSearch as MapSearchState } from '@/lib/mapSearch';
import { typeColor } from '@/lib/objectTypes';
import { usePreferences } from '@/stores/preferences';

interface MapPageProps {
  uuid: string;
  search: MapSearchState;
  onSearchChange: (search: MapSearchState) => void;
  onOpenPage: (uuid: string) => void;
  onOpenInExplorer: (uuid: string) => void;
  onOpenOrbit: (uuid: string) => void;
}

/** Planetary map of a celestial body (ADR 0018), with the inspector on the right. */
export function MapPage(props: MapPageProps) {
  const { t } = useTranslation();
  const query = useBodyMap(props.uuid);

  if (query.isPending) return <Message>{t('inspector.loading')}</Message>;
  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.code === ErrorCode.mapTooLarge) {
      const details = (error.details ?? {}) as { size?: number; max?: number };
      return <Message>{t('map.tooLarge', { size: details.size, max: details.max })}</Message>;
    }
    if (error instanceof ApiError && error.status === 404) {
      return <Message>{t('inspector.notFound', { uuid: props.uuid })}</Message>;
    }
    return <Message>{t('map.error')}</Message>;
  }
  return <BodyMap {...props} map={query.data} updatedAt={query.dataUpdatedAt} />;
}

function BodyMap({
  map,
  search,
  onSearchChange,
  onOpenPage,
  onOpenInExplorer,
  onOpenOrbit,
  updatedAt,
}: MapPageProps & { map: BodyMapResponse; updatedAt: number }) {
  const { t } = useTranslation();
  const { mapHidden, setMapHidden, mapNamed, setMapNamed } = usePreferences();
  const named = useMemo(
    () => new Set(Object.keys(mapNamed).filter((type) => mapNamed[type])),
    [mapNamed],
  );
  // Arriving with an item selected ("show on map"): the map flies to it once fitted.
  const [focus, setFocus] = useState<MapFocus | null>(() => {
    const point = map.points.find((p) => p.object_uuid === search.selected);
    return point ? { uuid: point.object_uuid, nonce: 0, at: [point.y, point.x] } : null;
  });

  const byUuid = useMemo(
    () => new Map(map.points.map((point) => [point.object_uuid, point])),
    [map.points],
  );
  const legend = useMemo(() => mapLegend(map.points), [map.points]);
  const visible = useMemo(
    () =>
      map.points.filter(
        // A searched or selected item stays visible even when its type is hidden.
        (p) =>
          isShown(p.object_type, mapHidden) ||
          p.object_uuid === focus?.uuid ||
          p.object_uuid === search.selected,
      ),
    [map.points, mapHidden, focus?.uuid, search.selected],
  );

  // Last known position of the selected item (memory only): a new one draws the move. Derived
  // during render, as React recommends for state following props.
  const [tracker, setTracker] = useState<MovementTracker | null>(null);
  const nextTracker = trackMovement(
    tracker,
    search.selected ? byUuid.get(search.selected) : undefined,
    updatedAt,
  );
  if (nextTracker !== tracker) setTracker(nextTracker);
  const move = nextTracker?.movement;
  const selectedPoint = search.selected ? byUuid.get(search.selected) : undefined;
  const movement = useMemo(
    () =>
      move && selectedPoint
        ? {
            move,
            color: typeColor(selectedPoint.object_type),
            label: t('map.moved', {
              distance: formatDistance(move.distance),
              time: new Date(move.at).toLocaleTimeString(),
            }),
          }
        : null,
    [move, selectedPoint, t],
  );

  const select = useCallback(
    (uuid: string) => onSearchChange({ ...search, selected: uuid }),
    [onSearchChange, search],
  );
  const focusOn = (uuid: string) => {
    select(uuid);
    const point = byUuid.get(uuid);
    if (point) setFocus({ uuid, nonce: Date.now(), at: [point.y, point.x] });
  };
  const describe = useCallback(
    (point: MapPoint) => {
      const via = point.via ? byUuid.get(point.via) : undefined;
      return [
        pointLabel(point),
        point.object_type,
        via ? t('map.via', { label: pointLabel(via) }) : null,
        t('map.altitude', { value: formatAltitude(point.altitude) }),
        formatLatLon(point.lat, point.lon),
      ]
        .filter(Boolean)
        .join(' · ');
    },
    [byUuid, t],
  );
  const clusterLabels = useMemo(
    () => ({
      cluster: (count: number) => t('map.cluster', { count }),
      grid: (step: string, major: string) => t('map.grid', { step, major }),
    }),
    [t],
  );
  const name = map.body.name ?? map.body.object_type;

  return (
    <OrbitLayout
      labels={{ graph: t('map.canvas'), inspector: t('explorer.inspector') }}
      graph={
        map.points.length === 0 ? (
          <Message>{t('map.empty')}</Message>
        ) : (
          <BodyMapCanvas
            points={visible}
            selected={search.selected}
            focus={focus}
            onSelect={select}
            describe={describe}
            labels={clusterLabels}
            named={named}
            nameOf={pointLabel}
            movement={movement}
          />
        )
      }
      overlays={
        <>
          <div className="absolute top-3.5 left-14 z-[1000] flex w-80 max-w-[40%] flex-col gap-2">
            {/* Title on its own line (never cut), the count under it. */}
            <div className="flex flex-col gap-0.5 rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-2">
                <TypeDot objectType={map.body.object_type} shape="square" />
                <h1 className="text-sm font-semibold">{t('map.title', { name })}</h1>
              </div>
              <MonoText tone="subtle" className="text-2xs">
                {t('map.summary', { shown: visible.length, total: map.points.length })}
              </MonoText>
            </div>
            <MapSearch
              labels={{ field: t('map.search'), empty: t('map.noMatch') }}
              search={(q) =>
                searchPoints([...map.points, ...map.inOrbit], q).map((point) => ({
                  uuid: point.object_uuid,
                  label: pointLabel(point),
                  objectType: point.object_type,
                  hint: isShown(point.object_type, mapHidden) ? undefined : t('map.hidden'),
                }))
              }
              onPick={focusOn}
            />
          </div>
          <div className="absolute top-3.5 right-4 z-[1000] flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onOpenPage(map.body.object_uuid)}>
              <ExpandIcon />
              {t('inspector.open')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenOrbit(map.body.object_uuid)}>
              <NetworkIcon />
              {t('objectPage.orbit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenInExplorer(map.body.object_uuid)}
            >
              <CompassIcon />
              {t('objectPage.explorer')}
            </Button>
          </div>
          <div className="absolute bottom-3.5 left-4 z-[1000] flex max-h-[60%] w-60 flex-col gap-3 overflow-y-auto rounded-lg border bg-background px-3 py-2.5">
            <MapLegend
              entries={legend.map((entry) => ({
                ...entry,
                shown: isShown(entry.objectType, mapHidden),
                shape: markerShape(entry.objectType),
                named: named.has(entry.objectType),
              }))}
              onToggle={(type, shown) => setMapHidden(type, !shown)}
              onToggleNames={setMapNamed}
              labels={{
                title: t('map.types'),
                toggle: (type) => t('map.toggle', { type }),
                names: (type) => t('map.names', { type }),
              }}
            />
            {map.inOrbit.length > 0 && (
              <section aria-label={t('map.inOrbit')} className="flex flex-col gap-1">
                <span className="text-2xs font-medium text-fg-2">{t('map.inOrbit')}</span>
                {map.inOrbit.map((point) => (
                  <button
                    key={point.object_uuid}
                    type="button"
                    onClick={() => select(point.object_uuid)}
                    className="flex items-center gap-2 rounded px-1 text-left hover:bg-surface-2"
                  >
                    <TypeDot objectType={point.object_type} />
                    <span className="min-w-0 flex-1 truncate text-xs">{pointLabel(point)}</span>
                    <MonoText tone="subtle" className="text-2xs">
                      {formatAltitude(point.altitude)}
                    </MonoText>
                  </button>
                ))}
              </section>
            )}
            <p className="text-2xs text-fg-3">{t('map.assumption')}</p>
          </div>
        </>
      }
      inspector={
        <Inspector
          uuid={search.selected ?? map.body.object_uuid}
          onNavigate={focusOn}
          onOpen={onOpenPage}
          onOrbit={onOpenOrbit}
        />
      }
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid size-full flex-1 place-items-center text-sm text-fg-3">{children}</div>
  );
}

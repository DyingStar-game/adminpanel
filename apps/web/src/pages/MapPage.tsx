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
  formatLatLon,
  graticule,
  isShown,
  mapLegend,
  pointLabel,
  searchPoints,
} from '@/lib/bodyMap';
import type { MapSearch as MapSearchState } from '@/lib/mapSearch';
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
  return <BodyMap {...props} map={query.data} />;
}

function BodyMap({
  map,
  search,
  onSearchChange,
  onOpenPage,
  onOpenInExplorer,
  onOpenOrbit,
}: MapPageProps & { map: BodyMapResponse }) {
  const { t } = useTranslation();
  const { mapHidden, setMapHidden } = usePreferences();
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const byUuid = useMemo(
    () => new Map(map.points.map((point) => [point.object_uuid, point])),
    [map.points],
  );
  const legend = useMemo(() => mapLegend(map.points), [map.points]);
  const lines = useMemo(() => graticule(map).lines, [map]);
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
    () => ({ cluster: (count: number) => t('map.cluster', { count }) }),
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
            graticule={lines}
            selected={search.selected}
            focus={focus}
            onSelect={select}
            describe={describe}
            labels={clusterLabels}
          />
        )
      }
      overlays={
        <>
          <div className="absolute top-3.5 left-14 z-[1000] flex w-[380px] max-w-[60%] flex-col gap-2">
            <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
              <TypeDot objectType={map.body.object_type} shape="square" />
              <h1 className="truncate text-sm font-semibold">{t('map.title', { name })}</h1>
              <span className="flex-1" />
              <MonoText tone="subtle" className="shrink-0 text-[11px]">
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
          <div className="absolute bottom-3.5 left-4 z-[1000] flex max-h-[60%] w-[240px] flex-col gap-3 overflow-y-auto rounded-lg border bg-background px-3 py-2.5">
            <MapLegend
              entries={legend.map((entry) => ({
                ...entry,
                shown: isShown(entry.objectType, mapHidden),
              }))}
              onToggle={(type, shown) => setMapHidden(type, !shown)}
              labels={{ title: t('map.types'), toggle: (type) => t('map.toggle', { type }) }}
            />
            {map.inOrbit.length > 0 && (
              <section aria-label={t('map.inOrbit')} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-fg-2">{t('map.inOrbit')}</span>
                {map.inOrbit.map((point) => (
                  <button
                    key={point.object_uuid}
                    type="button"
                    onClick={() => select(point.object_uuid)}
                    className="flex items-center gap-2 rounded px-1 text-left hover:bg-surface-2"
                  >
                    <TypeDot objectType={point.object_type} />
                    <span className="min-w-0 flex-1 truncate text-xs">{pointLabel(point)}</span>
                    <MonoText tone="subtle" className="text-[11px]">
                      {formatAltitude(point.altitude)}
                    </MonoText>
                  </button>
                ))}
              </section>
            )}
            <p className="text-[10.5px] text-fg-3">{t('map.assumption')}</p>
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

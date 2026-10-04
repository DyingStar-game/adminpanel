import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CompassIcon,
  CopyIcon,
  ExpandIcon,
  MoveIcon,
  NetworkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  azimuthalEquidistantInverse,
  directionOf,
  ErrorCode,
  latLonOf,
  Vec3Schema,
  type Item,
  type BodyMapResponse,
  type MapPoint,
} from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { MapLegend } from '@/components/molecules/MapLegend';
import { MapSearch } from '@/components/molecules/MapSearch';
import { BodyMapCanvas, type MapFocus } from '@/components/organisms/BodyMapCanvas';
import { Inspector } from '@/components/organisms/Inspector';
import { OrbitLayout } from '@/components/templates/OrbitLayout';
import { Button } from '@/components/ui/button';
import { useBodyMap } from '@/hooks/useBodyMap';
import { useItemActions } from '@/stores/itemActions';
import { useItem } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  formatAltitude,
  formatDistance,
  formatLatLon,
  type MapLatLng,
  ARRIVAL_ZOOM,
  isShown,
  mapLegend,
  markerShape,
  pointLabel,
  searchPoints,
  trackMovement,
  type Movement,
  type MovementTracker,
} from '@/lib/bodyMap';
import type { MapSearch as MapSearchState } from '@/lib/mapSearch';
import { itemLabel } from '@/lib/itemLabel';
import { typeColor } from '@/lib/objectTypes';
import { moveOnBody, placeOnBody, spawnHeightFor, type ParentFrame } from '@/lib/spawn';
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
  // The inspector reads the selected item too: same query, shared.
  const selected = useItem(props.search.selected).data;
  const query = useBodyMap(props.uuid, selected);
  const [mountedAt] = useState(() => Date.now());

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
  return (
    <BodyMap
      {...props}
      map={query.data}
      updatedAt={query.dataUpdatedAt}
      // Data kept from an earlier visit or another set of types is shown at once, but is not
      // a position to draw a move from.
      fresh={!query.isPlaceholderData && query.dataUpdatedAt >= mountedAt}
    />
  );
}

function BodyMap({
  map,
  search,
  onSearchChange,
  onOpenPage,
  onOpenInExplorer,
  onOpenOrbit,
  updatedAt,
  fresh,
}: MapPageProps & { map: BodyMapResponse; updatedAt: number; fresh: boolean }) {
  const { t } = useTranslation();
  const { mapHidden, setMapHidden, mapNamed, setMapNamed } = usePreferences();
  const actions = useItemActions();
  // Shared with the inspector's query of the same item.
  const selectedItem = useItem(search.selected).data ?? null;
  const named = useMemo(
    () => new Set(Object.keys(mapNamed).filter((type) => mapNamed[type])),
    [mapNamed],
  );
  // Arriving with an item selected ("show on map"): the map flies to it once fitted, at the
  // 1 km grid.
  const [focus, setFocus] = useState<MapFocus | null>(() => {
    const point = map.points.find((p) => p.object_uuid === search.selected);
    return point
      ? { uuid: point.object_uuid, nonce: 0, at: [point.y, point.x], zoom: ARRIVAL_ZOOM }
      : null;
  });

  const byUuid = useMemo(
    () => new Map(map.points.map((point) => [point.object_uuid, point])),
    [map.points],
  );
  const legend = useMemo(() => mapLegend(map.counts), [map.counts]);
  const totalCount = legend.reduce((sum, entry) => sum + entry.count, 0);
  const visible = useMemo(
    () =>
      map.points.filter(
        // The selected item (searched or clicked) stays visible even when its type is hidden,
        // until it is deselected.
        (p) => isShown(p.object_type, mapHidden) || p.object_uuid === search.selected,
      ),
    [map.points, mapHidden, search.selected],
  );

  // Last known position of the selected item (memory only): a new one draws the move. Derived
  // during render, as React recommends for state following props.
  const [tracker, setTracker] = useState<MovementTracker | null>(null);
  const nextTracker = trackMovement(
    tracker,
    search.selected,
    search.selected && fresh ? byUuid.get(search.selected) : undefined,
    updatedAt,
    `${map.center.lat},${map.center.lon}`,
  );
  if (nextTracker !== tracker) setTracker(nextTracker);
  const moves = nextTracker?.moves;
  const selectedPoint = search.selected ? byUuid.get(search.selected) : undefined;
  const movement = useMemo(
    () =>
      moves && moves.length > 0 && selectedPoint
        ? {
            moves,
            color: typeColor(selectedPoint.object_type),
            label: (move: Movement) =>
              t('map.moved', {
                distance: formatDistance(move.distance),
                time: new Date(move.at).toLocaleTimeString(),
              }),
          }
        : null,
    [moves, selectedPoint, t],
  );

  const select = useCallback(
    (uuid: string) => onSearchChange({ ...search, selected: uuid }),
    [onSearchChange, search],
  );
  const deselect = useCallback(
    () => onSearchChange({ ...search, selected: undefined }),
    [onSearchChange, search],
  );

  // Menu opened by a right click on the map background, at that place.
  // A place (right click on the background) or an item (right click on its marker).
  const [menu, setMenu] = useState<
    | { kind: 'place'; at: MapLatLng; x: number; y: number }
    | { kind: 'item'; uuid: string; x: number; y: number }
    | null
  >(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenu(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  /**
   * Creates an item where the map was clicked: the direction from the projection, the height of
   * the closest item on the ground (the relief is unknown), standing upright.
   */
  /**
   * A place clicked on the map: its direction from the body centre (inverse projection), the
   * ground distance from the centre taken from the closest item (the relief is unknown; the
   * moved item itself left out), and a label.
   */
  const placeAt = ([north, east]: MapLatLng, exclude?: string) => {
    const inverse = azimuthalEquidistantInverse(
      directionOf(map.center.lat, map.center.lon),
      map.referenceRadius,
    );
    const direction = inverse(east, north);
    const closest = map.points
      .filter((p) => p.via === null && p.object_uuid !== exclude)
      .reduce<MapPoint | null>(
        (best, p) =>
          !best || Math.hypot(p.x - east, p.y - north) < Math.hypot(best.x - east, best.y - north)
            ? p
            : best,
        null,
      );
    const { lat, lon } = latLonOf(direction);
    return {
      direction,
      ground: map.referenceRadius + (closest?.altitude ?? 0),
      label: formatLatLon(lat, lon),
    };
  };
  /** Creates an item where the map was clicked, standing upright. */
  const addHere = (at: MapLatLng) => {
    setMenu(null);
    const { direction, ground, label } = placeAt(at);
    actions.create({
      parentId: map.body.object_uuid,
      place: {
        preset: placeOnBody(map.body.object_uuid, direction, ground + spawnHeightFor(undefined)),
        label,
      },
    });
  };
  // The selected item can be moved where the map is right-clicked: standing on the body, or
  // placed in an item that does (a player in its building, then taken out onto the body).
  const via = selectedItem ? byUuid.get(selectedItem.object_uuid)?.via : undefined;
  const parentItem = useItem(via ?? undefined).data ?? null;
  const parentFrame = parentItem ? frameOf(parentItem) : null;
  const movable =
    selectedItem &&
    (via === null
      ? selectedItem.object_data.parent_id === map.body.object_uuid
      : !!via && parentFrame !== null && selectedItem.object_data.parent_id === via)
      ? selectedItem
      : null;
  /** Opens the selected item's editor with its placement moved where the map was clicked. */
  const moveHere = (at: MapLatLng) => {
    setMenu(null);
    if (!movable) return;
    const { direction, ground, label } = placeAt(at, movable.object_uuid);
    actions.edit(movable.object_uuid, {
      preset: moveOnBody(
        movable,
        map.body.object_uuid,
        direction,
        ground + spawnHeightFor(movable.object_type),
        via ? (parentFrame ?? undefined) : undefined,
      ),
      label,
    });
  };
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
            onDeselect={() => {
              closeMenu();
              if (search.selected) deselect();
            }}
            onContextMenu={(at, { x, y }) => setMenu({ kind: 'place', at, x, y })}
            onPointMenu={(uuid, { x, y }) => {
              // The item becomes the selection too: the inspector shows what the menu acts on.
              select(uuid);
              setMenu({ kind: 'item', uuid, x, y });
            }}
            onViewChange={closeMenu}
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
          {menu && (
            <div
              role="menu"
              aria-label={
                menu.kind === 'place'
                  ? t('map.menu')
                  : (() => {
                      const point = byUuid.get(menu.uuid);
                      return point ? pointLabel(point) : menu.uuid;
                    })()
              }
              className="absolute z-[1100] flex min-w-44 flex-col rounded-md border bg-background p-1 text-sm shadow-lg"
              style={{ left: menu.x, top: menu.y }}
            >
              {menu.kind === 'place' ? (
                <>
                  <MenuItem
                    autoFocus
                    icon={<PlusIcon size={14} />}
                    onClick={() => addHere(menu.at)}
                  >
                    {t('map.addHere')}
                  </MenuItem>
                  {movable && (
                    <MenuItem icon={<MoveIcon size={14} />} onClick={() => moveHere(menu.at)}>
                      {t('map.moveHere', { label: itemLabel(movable) })}
                    </MenuItem>
                  )}
                </>
              ) : (
                <>
                  <MenuItem
                    autoFocus
                    icon={<ExpandIcon size={14} />}
                    onClick={() => {
                      closeMenu();
                      onOpenPage(menu.uuid);
                    }}
                  >
                    {t('inspector.open')}
                  </MenuItem>
                  <MenuItem
                    icon={<PencilIcon size={14} />}
                    onClick={() => {
                      closeMenu();
                      actions.edit(menu.uuid);
                    }}
                  >
                    {t('editor.edit')}
                  </MenuItem>
                  <MenuItem
                    icon={<CopyIcon size={14} />}
                    onClick={() => {
                      closeMenu();
                      actions.duplicate(menu.uuid);
                    }}
                  >
                    {t('duplicate.action')}
                  </MenuItem>
                  {/* Still confirmed: deleting applies live in the game. */}
                  <MenuItem
                    destructive
                    icon={<Trash2Icon size={14} />}
                    onClick={() => {
                      closeMenu();
                      actions.remove(menu.uuid);
                    }}
                  >
                    {t('editor.delete')}
                  </MenuItem>
                </>
              )}
            </div>
          )}
          <div className="absolute top-3.5 left-14 z-[1000] flex w-80 max-w-[40%] flex-col gap-2">
            {/* Title on its own line (never cut), the count under it. */}
            <div className="flex flex-col gap-0.5 rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-2">
                <TypeDot objectType={map.body.object_type} shape="square" />
                <h1 className="text-sm font-semibold">{t('map.title', { name })}</h1>
              </div>
              <MonoText tone="subtle" className="text-2xs">
                {t('map.summary', { shown: visible.length, total: totalCount })}
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
            {/* A new item on the body; next to the selected one, use its inspector's "+". */}
            <Button size="sm" onClick={() => actions.create({ parentId: map.body.object_uuid })}>
              <PlusIcon />
              {t('explorer.addItem')}
            </Button>
          </div>
          <div className="absolute bottom-3.5 left-4 z-[1000] flex max-h-[60%] w-60 flex-col gap-3 overflow-y-auto rounded-lg border bg-background px-3 py-2.5">
            <MapLegend
              entries={legend.map((entry) => ({
                ...entry,
                shown: isShown(entry.objectType, mapHidden),
                shape: markerShape(entry.objectType),
                named: named.has(entry.objectType),
                omitted: map.omitted.includes(entry.objectType),
              }))}
              onToggle={(type, shown) => setMapHidden(type, !shown)}
              onToggleNames={setMapNamed}
              labels={{
                title: t('map.types'),
                toggle: (type) => t('map.toggle', { type }),
                names: (type) => t('map.names', { type }),
                omitted: t('map.omitted'),
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

/** Position and rotation of an item, when it has both (the frame its children are placed in). */
function frameOf(item: Item): ParentFrame | null {
  const position = Vec3Schema.safeParse(item.object_data.position);
  const rotation = Vec3Schema.safeParse(item.object_data.rotation);
  return position.success && rotation.success
    ? { position: position.data, rotation: rotation.data }
    : null;
}

function MenuItem({
  icon,
  children,
  onClick,
  autoFocus,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  autoFocus?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      autoFocus={autoFocus}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none',
        destructive && 'text-destructive',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

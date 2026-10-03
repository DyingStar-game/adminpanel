import { useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CompassIcon, ExpandIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { CrumbTrail } from '@/components/molecules/CrumbTrail';
import { Inspector } from '@/components/organisms/Inspector';
import { OrbitGraph } from '@/components/organisms/OrbitGraph';
import { OrbitLayout } from '@/components/templates/OrbitLayout';
import { Button } from '@/components/ui/button';
import {
  useAncestors,
  useChildrenCounts,
  useItem,
  useItemsPages,
  usePrefetchItemsPage,
} from '@/hooks/queries';
import { useItemRefs } from '@/hooks/useItemRefs';
import { itemLabel, shortUuid } from '@/lib/itemLabel';
import { ORBIT, orbitLayout, type OrbitEntity } from '@/lib/orbitLayout';
import { pageOf, setClusterPage, toggleCluster, type OrbitSearch } from '@/lib/orbitSearch';
import { orderChildTypes, profileFor, relationFor, type TypeProfile } from '@/lib/profiles';

/**
 * Name of a reference on the graph: the profile label for a fixed path (`pilot_uuid` → pilot),
 * the slot name for a wildcard one (`seats.seat_driver` → seat_driver), else the raw path.
 */
function referenceRole(profile: TypeProfile | null, path: string): string {
  const relation = relationFor(profile, path);
  if (!relation) return path;
  return relation.path.includes('*') ? (path.split('.').at(-1) ?? path) : relation.label;
}

interface OrbitPageProps {
  uuid: string;
  search: OrbitSearch;
  onSearchChange: (search: OrbitSearch) => void;
  /** Re-centres the orbit on another entity. */
  onRecenter: (uuid: string, selected?: string) => void;
  onOpenPage: (uuid: string) => void;
  onOpenInExplorer: (item: Item) => void;
  /** Opens the map of a celestial body, optionally with an item selected on it (ADR 0018). */
  onOpenMap: (body: string, selected?: string) => void;
}

const toEntity = (item: Item): OrbitEntity => ({
  uuid: item.object_uuid,
  label: itemLabel(item),
  objectType: item.object_type,
});

/** Orbit view centred on one entity (ADR 0008): never a global map, always one entity. */
export function OrbitPage(props: OrbitPageProps) {
  const { t } = useTranslation();
  const query = useItem(props.uuid, { live: true });

  if (query.isPending) return <Message>{t('inspector.loading')}</Message>;
  if (query.isError) return <Message>{t('inspector.error')}</Message>;
  if (!query.data) return <Message>{t('inspector.notFound', { uuid: props.uuid })}</Message>;
  return <Orbit {...props} item={query.data} />;
}

function Orbit({
  item,
  search,
  onSearchChange,
  onRecenter,
  onOpenPage,
  onOpenInExplorer,
  onOpenMap,
}: OrbitPageProps & { item: Item }) {
  const { t } = useTranslation();
  const counts = useChildrenCounts(item.object_uuid, true, { live: true });
  const ancestors = useAncestors(item.object_uuid);
  const { refs, parentTarget, parentId, resolveRef } = useItemRefs(item);
  // Open clusters still present among the children, in the order they were opened.
  const openTypes = useMemo(
    () => search.open.filter((type) => counts.data?.byType.some((c) => c.object_type === type)),
    [search.open, counts.data],
  );
  const loaded = useItemsPages(
    openTypes.map((type) => ({
      filter: { parentId: item.object_uuid, objectType: type },
      page: pageOf(search, type),
    })),
    ORBIT.pageSize,
    { live: true },
  );
  const prefetch = usePrefetchItemsPage(ORBIT.pageSize);
  const totalOf = useCallback(
    (type: string) => counts.data?.byType.find((c) => c.object_type === type)?.total ?? 0,
    [counts.data],
  );

  const layout = useMemo(() => {
    const profile = profileFor(item.object_type);
    const byType = new Map((counts.data?.byType ?? []).map((c) => [c.object_type, c.total]));
    return orbitLayout({
      center: toEntity(item),
      parent:
        parentId && parentTarget?.status === 'found'
          ? { uuid: parentId, label: parentTarget.label, objectType: parentTarget.objectType }
          : null,
      clusters: orderChildTypes(profile, [...byType.keys()]).map((type) => ({
        objectType: type,
        total: byType.get(type) ?? 0,
      })),
      open: openTypes.flatMap((type, i) => {
        const data = loaded[i];
        // Still reading its children: open at once, the children follow.
        if (!data) return [{ objectType: type, items: [], hasMore: false, loading: true }];
        return [
          {
            objectType: type,
            // The cluster already names the type: unnamed children show their short UUID.
            items: data.items.map((child) => {
              const entity = toEntity(child);
              return entity.label.startsWith(`${child.object_type} `)
                ? { ...entity, label: shortUuid(child.object_uuid) }
                : entity;
            }),
            hasMore: pageOf(search, type) * ORBIT.pageSize < totalOf(type),
          },
        ];
      }),
      refs: refs.flatMap((ref) => {
        const target = resolveRef(ref.uuid);
        // A reference to one of the centre's children (e.g. a vehicle's components) is already
        // represented by its type cluster: not drawn twice. Dangling references stay visible.
        if (target.status === 'found' && target.parentId === item.object_uuid) return [];
        const role = referenceRole(profile, ref.path);
        return [
          target.status === 'found'
            ? {
                uuid: ref.uuid,
                path: ref.path,
                role,
                label: target.label,
                objectType: target.objectType,
              }
            : {
                uuid: ref.uuid,
                path: ref.path,
                role,
                label: shortUuid(ref.uuid),
                objectType: ref.expectedType ?? 'unknown',
                missing: target.status === 'missing',
              },
        ];
      }),
    });
  }, [
    item,
    counts.data,
    parentId,
    parentTarget,
    openTypes,
    loaded,
    search,
    totalOf,
    refs,
    resolveRef,
  ]);

  const crumbs = [
    ...(ancestors.data?.ancestors ?? []).map((a) => ({
      id: a.object_uuid,
      label: itemLabel(a),
      objectType: a.object_type,
    })),
    { id: item.object_uuid, label: itemLabel(item), objectType: item.object_type },
  ];
  /** Range shown in an open cluster: first and last child of its page. */
  const rangeOf = (type: string) => {
    const page = pageOf(search, type);
    return {
      from: (page - 1) * ORBIT.pageSize + 1,
      to: Math.min(page * ORBIT.pageSize, totalOf(type)),
      total: totalOf(type),
      page,
    };
  };
  const moreLabel = useCallback(
    (type: string) => {
      const page = search.pages[type] ?? 1;
      const total = counts.data?.byType.find((c) => c.object_type === type)?.total ?? 0;
      return t('orbit.more', { count: Math.max(total - page * ORBIT.pageSize, 0) });
    },
    [search.pages, counts.data, t],
  );
  const graphLabels = useMemo(() => ({ more: moreLabel }), [moreLabel]);

  return (
    <OrbitLayout
      labels={{ graph: t('orbit.graph'), inspector: t('explorer.inspector') }}
      graph={
        <OrbitGraph
          nodes={layout.nodes}
          edges={layout.edges}
          selectedId={search.selected}
          labels={graphLabels}
          onSelect={(uuid) => onSearchChange({ ...search, selected: uuid })}
          onRecenter={(uuid) => onRecenter(uuid, uuid)}
          onToggleCluster={(type) => onSearchChange(toggleCluster(search, type))}
          onMore={(type) => onSearchChange(setClusterPage(search, type, pageOf(search, type) + 1))}
          onClusterHover={(type) =>
            prefetch({ parentId: item.object_uuid, objectType: type }, pageOf(search, type))
          }
        />
      }
      overlays={
        <>
          <div className="absolute top-3.5 left-4 flex max-w-[70%] flex-col gap-1.5">
            <div className="rounded-md border bg-background px-2 py-1">
              <CrumbTrail crumbs={crumbs} onSelect={(uuid) => onRecenter(uuid)} />
            </div>
          </div>
          <div className="absolute top-3.5 right-4 flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onOpenPage(item.object_uuid)}>
              <ExpandIcon />
              {t('inspector.open')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenInExplorer(item)}>
              <CompassIcon />
              {t('objectPage.explorer')}
            </Button>
          </div>
          {openTypes.length > 0 && (
            <div className="absolute bottom-3.5 left-4 flex flex-col gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs">
              {openTypes.map((type) => {
                const range = rangeOf(type);
                return (
                  <div key={type} className="flex items-center gap-2">
                    <TypeDot objectType={type} />
                    <MonoText className="min-w-0 flex-1 truncate font-semibold">{type}</MonoText>
                    <span className="text-fg-2">
                      {t('pagination.range', {
                        from: range.from,
                        to: range.to,
                        total: range.total,
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      aria-label={`${t('pagination.previous')} · ${type}`}
                      disabled={range.page <= 1}
                      onClick={() => onSearchChange(setClusterPage(search, type, range.page - 1))}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      aria-label={`${t('pagination.next')} · ${type}`}
                      disabled={range.to >= range.total}
                      onClick={() => onSearchChange(setClusterPage(search, type, range.page + 1))}
                    >
                      <ChevronRightIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${t('orbit.close')} · ${type}`}
                      onClick={() => onSearchChange(toggleCluster(search, type))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                );
              })}
              {openTypes.length > 1 && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="self-start"
                  onClick={() => onSearchChange({ ...search, open: [], pages: {} })}
                >
                  {t('orbit.closeAll')}
                </Button>
              )}
            </div>
          )}
          <div className="absolute right-4 bottom-3.5 flex flex-col gap-1.5 rounded-lg border bg-background px-3 py-2.5 text-2xs text-fg-2">
            <div className="flex items-center gap-2">
              <span className="w-5.5 border-t-2 border-fg-3" />
              <MonoText className="text-2xs">parent_id</MonoText>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5.5 border-t-2 border-dashed border-fg-3" />
              {t('orbit.reference')}
            </div>
            <div className="text-fg-3">{t('orbit.hint')}</div>
          </div>
        </>
      }
      inspector={
        <Inspector
          uuid={search.selected ?? item.object_uuid}
          onNavigate={(uuid) => onSearchChange({ ...search, selected: uuid })}
          onOpen={onOpenPage}
          onMap={onOpenMap}
          onCenter={(uuid) => onRecenter(uuid, uuid)}
        />
      }
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid flex-1 place-items-center text-sm text-fg-3">{children}</div>;
}

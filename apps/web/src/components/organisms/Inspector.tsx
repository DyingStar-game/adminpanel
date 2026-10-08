import type { ReactNode } from 'react';
import {
  CirclePlusIcon,
  ExpandIcon,
  LocateFixedIcon,
  MapIcon,
  MapPinIcon,
  NetworkIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import { UpdatedAt } from '@/components/molecules/UpdatedAt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAncestors, useChildrenCounts, useDefinitions, useItem } from '@/hooks/queries';
import { useChangedKeys } from '@/hooks/useChanges';
import { useCan } from '@/hooks/useCan';
import { useItemRefs } from '@/hooks/useItemRefs';
import { hasMap, mapBodyOf } from '@/lib/bodyMap';
import { itemLabel } from '@/lib/itemLabel';
import { SPAWN_DISTANCE, SPAWN_HEIGHT, spawnNextTo } from '@/lib/spawn';
import { useItemActions } from '@/stores/itemActions';
import { PropertySections, SectionTitle } from './PropertySections';
import { RelationsList } from './RelationsList';

interface InspectorProps {
  uuid: string | undefined;
  onNavigate: (uuid: string) => void;
  /** Opens the full object page. */
  onOpen: (uuid: string) => void;
  /** Opens the orbit view centred on the item (omitted when already there). */
  onOrbit?: (uuid: string) => void;
  /**
   * Opens a planetary map (ADR 0018): a body's own map, or the map showing the item selected
   * ("show on map"), for items the map draws.
   */
  onMap?: (body: string, selected?: string) => void;
  /** Inside the orbit view: centres the graph on the item (mock-up 1a). */
  onCenter?: (uuid: string) => void;
}

/** Right panel: identity, relations, children summary and properties by channel. */
export function Inspector({ uuid, onNavigate, onOpen, onOrbit, onMap, onCenter }: InspectorProps) {
  const { t } = useTranslation();
  const query = useItem(uuid, { live: true });

  if (!uuid) return <Placeholder>{t('inspector.empty')}</Placeholder>;
  if (query.isPending) return <Placeholder>{t('inspector.loading')}</Placeholder>;
  if (query.isError) return <Placeholder>{t('inspector.error')}</Placeholder>;
  if (!query.data) return <Placeholder>{t('inspector.notFound', { uuid })}</Placeholder>;
  return (
    <ItemDetails
      item={query.data}
      updatedAt={query.dataUpdatedAt}
      onNavigate={onNavigate}
      onOpen={onOpen}
      onOrbit={onOrbit}
      onMap={onMap}
      onCenter={onCenter}
    />
  );
}

function ItemDetails({
  item,
  onNavigate,
  onOpen,
  onOrbit,
  onMap,
  onCenter,
  updatedAt,
}: { item: Item; updatedAt: number } & Omit<InspectorProps, 'uuid'>) {
  const { t } = useTranslation();
  const ancestors = useAncestors(onMap ? item.object_uuid : undefined);
  const mapBody = ancestors.data ? mapBodyOf(item, ancestors.data.ancestors) : null;
  const data = item.object_data;
  const definitions = useDefinitions();
  // undefined while loading, null when the type has no definition.
  const definition = definitions.data
    ? (definitions.data.definitions.find((d) => d.type === item.object_type) ?? null)
    : undefined;
  const counts = useChildrenCounts(item.object_uuid, true, { live: true });
  const { refs, parentId, parentTarget, resolveRef } = useItemRefs(item);
  const changed = useChangedKeys(data, item.object_uuid);
  const actions = useItemActions();
  const can = useCan();
  const spawn = spawnNextTo(item, SPAWN_DISTANCE, SPAWN_HEIGHT);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b px-4.5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeDot objectType={item.object_type} shape="square" />
          <span className="text-2xs text-fg-2">{item.object_type}</span>
          {!definition && definitions.isSuccess && (
            <Badge variant="outline" className="text-3xs">
              {t('inspector.unknownType')}
            </Badge>
          )}
          {parentTarget?.status === 'missing' && (
            <Badge variant="destructive" className="text-3xs">
              {t('inspector.orphan')}
            </Badge>
          )}
          <span className="flex-1" />
          {onCenter && (
            <Button variant="outline" size="xs" onClick={() => onCenter(item.object_uuid)}>
              <LocateFixedIcon />
              {t('orbit.center')}
            </Button>
          )}
          {onOrbit && (
            <Button variant="outline" size="xs" onClick={() => onOrbit(item.object_uuid)}>
              <NetworkIcon />
              {t('objectPage.orbit')}
            </Button>
          )}
          {onMap && mapBody && !hasMap(item.object_type) && (
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t('map.showOn')}
              title={t('map.showOn')}
              onClick={() => onMap(mapBody, item.object_uuid)}
            >
              <MapPinIcon />
            </Button>
          )}
          {onMap && hasMap(item.object_type) && (
            <Button variant="outline" size="xs" onClick={() => onMap(item.object_uuid)}>
              <MapIcon />
              {t('map.open')}
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={() => onOpen(item.object_uuid)}>
            <ExpandIcon />
            {t('inspector.open')}
          </Button>
          {spawn && can('persistence.write') && (
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t('editor.spawnNext')}
              title={t('editor.spawnNext')}
              onClick={() =>
                actions.create({
                  parentId: spawn.parentId,
                  spawn: { reference: item, preset: spawn, nearLabel: itemLabel(item) },
                })
              }
            >
              <CirclePlusIcon />
            </Button>
          )}
          {can('persistence.write') && (
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t('editor.edit')}
              title={t('editor.edit')}
              onClick={() => actions.edit(item.object_uuid)}
            >
              <PencilIcon />
            </Button>
          )}
          {can('persistence.delete') && (
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t('editor.delete')}
              title={t('editor.delete')}
              className="text-destructive"
              onClick={() => actions.remove(item.object_uuid)}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
        <h2 className="text-lg leading-tight font-semibold tracking-tight">{itemLabel(item)}</h2>
        <UpdatedAt at={updatedAt} />
        <MonoText tone="subtle" className="text-2xs leading-relaxed break-all">
          {item.object_uuid}
          <CopyButton value={item.object_uuid} className="ml-1 inline-grid align-middle" />
          {typeof data.scenename === 'string' && (
            <>
              <br />
              {data.scenename}
            </>
          )}
        </MonoText>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-5">
          <SectionTitle title={t('inspector.relations')} />
          <RelationsList
            parentId={parentId}
            parentTarget={parentTarget}
            refs={refs}
            resolveRef={resolveRef}
            onNavigate={onNavigate}
          />
          <PropertyRow name={t('inspector.children')}>
            <span className="text-xs leading-relaxed text-fg-2">
              {counts.isPending
                ? '…'
                : !counts.data || counts.data.total === 0
                  ? t('inspector.noChildren')
                  : counts.data.byType.map((c) => `${c.object_type} ${c.total}`).join(' · ')}
            </span>
          </PropertyRow>
          <PropertySections
            item={item}
            definition={definition}
            resolveRef={resolveRef}
            onNavigate={onNavigate}
            changed={changed}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-fg-3">
      {children}
    </div>
  );
}

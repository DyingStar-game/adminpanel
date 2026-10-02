import {
  CirclePlusIcon,
  CompassIcon,
  CopyIcon,
  MapIcon,
  NetworkIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { CrumbTrail } from '@/components/molecules/CrumbTrail';
import { RawJson } from '@/components/molecules/RawJson';
import { UpdatedAt } from '@/components/molecules/UpdatedAt';
import { ChildrenTabs } from '@/components/organisms/ChildrenTabs';
import { HeadlineFacts } from '@/components/organisms/HeadlineFacts';
import { PropertySections } from '@/components/organisms/PropertySections';
import { RelationsList } from '@/components/organisms/RelationsList';
import { SchematicCard } from '@/components/organisms/SchematicCard';
import { ObjectPageLayout } from '@/components/templates/ObjectPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAncestors, useDefinitions, useItem } from '@/hooks/queries';
import { useChangedKeys } from '@/hooks/useChanges';
import { useItemRefs } from '@/hooks/useItemRefs';
import { hasMap } from '@/lib/bodyMap';
import { itemLabel } from '@/lib/itemLabel';
import { schematicFor } from '@/lib/schematics';
import { SPAWN_DISTANCE, SPAWN_HEIGHT, spawnNextTo } from '@/lib/spawn';
import { useItemActions } from '@/stores/itemActions';

interface ObjectPageProps {
  uuid: string;
  /** Opens another item's page. */
  onNavigate: (uuid: string) => void;
  onOpenInExplorer: (item: Item) => void;
  onOpenOrbit: (uuid: string) => void;
  onOpenMap: (uuid: string) => void;
}

/** Full detail of one entity (mock-up 1c, ADR 0008). */
export function ObjectPage({
  uuid,
  onNavigate,
  onOpenInExplorer,
  onOpenOrbit,
  onOpenMap,
}: ObjectPageProps) {
  const { t } = useTranslation();
  const query = useItem(uuid, { live: true });

  if (query.isPending) return <Message>{t('inspector.loading')}</Message>;
  if (query.isError) return <Message>{t('inspector.error')}</Message>;
  if (!query.data) return <Message>{t('inspector.notFound', { uuid })}</Message>;
  return (
    <ObjectDetails
      item={query.data}
      updatedAt={query.dataUpdatedAt}
      onNavigate={onNavigate}
      onOpenInExplorer={onOpenInExplorer}
      onOpenOrbit={onOpenOrbit}
      onOpenMap={onOpenMap}
    />
  );
}

function ObjectDetails({
  item,
  onNavigate,
  onOpenInExplorer,
  onOpenOrbit,
  onOpenMap,
  updatedAt,
}: Omit<ObjectPageProps, 'uuid'> & { item: Item; updatedAt: number }) {
  const { t } = useTranslation();
  const definitions = useDefinitions();
  // undefined while loading, null when the type has no definition.
  const definition = definitions.data
    ? (definitions.data.definitions.find((d) => d.type === item.object_type) ?? null)
    : undefined;
  const ancestors = useAncestors(item.object_uuid);
  const { refs, parentId, parentTarget, resolveRef, profile } = useItemRefs(item);
  const changed = useChangedKeys(item.object_data, item.object_uuid);
  const actions = useItemActions();
  const schematic = schematicFor(item.object_data.scenename);
  const spawn = spawnNextTo(item, SPAWN_DISTANCE, SPAWN_HEIGHT);
  const isMoon =
    !!profile?.moonWhenParentIs &&
    parentTarget?.status === 'found' &&
    parentTarget.objectType === profile.moonWhenParentIs;

  const crumbs = [
    ...(ancestors.data?.ancestors ?? []).map((a) => ({
      id: a.object_uuid,
      label: itemLabel(a),
      objectType: a.object_type,
    })),
    { id: item.object_uuid, label: itemLabel(item), objectType: item.object_type },
  ];

  return (
    <ObjectPageLayout
      labels={{
        relations: t('inspector.relations'),
        children: t('inspector.children'),
        properties: t('objectPage.properties'),
        raw: t('objectPage.raw'),
        schematic: t('schematic.title'),
      }}
      schematic={
        schematic && (
          <SchematicCard
            schematic={schematic}
            data={item.object_data}
            resolveRef={resolveRef}
            onNavigate={onNavigate}
          />
        )
      }
      header={
        <header className="flex flex-col gap-3">
          <CrumbTrail crumbs={crumbs} onSelect={onNavigate} />
          <div className="flex flex-wrap items-center gap-3">
            <TypeDot objectType={item.object_type} shape="square" className="size-3" />
            <h1 className="text-2xl font-semibold tracking-tight">{itemLabel(item)}</h1>
            <MonoText tone="muted">{isMoon ? t('profile.moon') : item.object_type}</MonoText>
            {!definition && definitions.isSuccess && (
              <Badge variant="outline">{t('inspector.unknownType')}</Badge>
            )}
            {parentTarget?.status === 'missing' && (
              <Badge variant="destructive">{t('inspector.orphan')}</Badge>
            )}
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => onOpenInExplorer(item)}>
              <CompassIcon />
              {t('objectPage.explorer')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenOrbit(item.object_uuid)}>
              <NetworkIcon />
              {t('objectPage.orbit')}
            </Button>
            {hasMap(item.object_type) && (
              <Button variant="outline" size="sm" onClick={() => onOpenMap(item.object_uuid)}>
                <MapIcon />
                {t('map.open')}
              </Button>
            )}
            {spawn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.create({
                    parentId: spawn.parentId,
                    spawn: { reference: item, preset: spawn, nearLabel: itemLabel(item) },
                  })
                }
              >
                <CirclePlusIcon />
                {t('editor.spawnNext')}
              </Button>
            )}
            {/* Icon-only actions: the name stays in the accessible label and the tooltip. */}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t('duplicate.action')}
              title={t('duplicate.action')}
              onClick={() => actions.duplicate(item.object_uuid)}
            >
              <CopyIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t('editor.edit')}
              title={t('editor.edit')}
              onClick={() => actions.edit(item.object_uuid)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="text-destructive"
              aria-label={t('editor.delete')}
              title={t('editor.delete')}
              onClick={() => actions.remove(item.object_uuid)}
            >
              <Trash2Icon />
            </Button>
          </div>
          <MonoText tone="subtle" className="text-[11px] break-all">
            {item.object_uuid}
            <CopyButton value={item.object_uuid} className="ml-1 inline-grid align-middle" />
            {typeof item.object_data.scenename === 'string' && ` · ${item.object_data.scenename}`}
          </MonoText>
          <UpdatedAt at={updatedAt} />
        </header>
      }
      headline={
        <HeadlineFacts
          item={item}
          resolveRef={resolveRef}
          onNavigate={onNavigate}
          changed={changed}
        />
      }
      relations={
        <RelationsList
          parentId={parentId}
          parentTarget={parentTarget}
          refs={refs}
          resolveRef={resolveRef}
          onNavigate={onNavigate}
        />
      }
      properties={
        <PropertySections
          item={item}
          definition={definition}
          resolveRef={resolveRef}
          onNavigate={onNavigate}
          changed={changed}
        />
      }
      raw={<RawJson value={item} copyLabel={t('objectPage.copy')} />}
    >
      <ChildrenTabs
        item={item}
        onSelect={(child) => onNavigate(child.object_uuid)}
        onNavigate={onNavigate}
      />
    </ObjectPageLayout>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid flex-1 place-items-center text-sm text-fg-3">{children}</div>;
}

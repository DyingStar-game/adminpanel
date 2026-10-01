import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import { UuidLink, type RefTarget } from '@/components/molecules/UuidLink';
import { ValueView } from '@/components/molecules/ValueView';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChildrenCounts, useDefinitions, useItem } from '@/hooks/queries';
import { useRefResolver } from '@/hooks/useRefResolver';
import { groupByChannel } from '@/lib/channels';
import { formatDistance } from '@/lib/format';
import { itemLabel } from '@/lib/itemLabel';
import { collectUuids } from '@/lib/valueShape';

interface InspectorProps {
  uuid: string | undefined;
  onNavigate: (uuid: string) => void;
}

/** Right panel: identity, relations, children summary and properties by channel. */
export function Inspector({ uuid, onNavigate }: InspectorProps) {
  const { t } = useTranslation();
  const query = useItem(uuid);

  if (!uuid) return <Placeholder>{t('inspector.empty')}</Placeholder>;
  if (query.isPending) return <Placeholder>{t('inspector.loading')}</Placeholder>;
  if (query.isError) return <Placeholder>{t('inspector.error')}</Placeholder>;
  if (!query.data) return <Placeholder>{t('inspector.notFound', { uuid })}</Placeholder>;
  return <ItemDetails item={query.data} onNavigate={onNavigate} />;
}

function ItemDetails({ item, onNavigate }: { item: Item; onNavigate: (uuid: string) => void }) {
  const { t, i18n } = useTranslation();
  const data = item.object_data;
  const parentId = data.parent_id || undefined;
  const definitions = useDefinitions();
  const definition = definitions.data?.definitions.find((d) => d.type === item.object_type);
  const counts = useChildrenCounts(item.object_uuid);

  const refs = useMemo(
    () =>
      Object.entries(data)
        .filter(([key]) => key !== 'parent_id')
        .flatMap(([key, value]) => collectUuids(value, key))
        .filter((ref) => ref.uuid !== item.object_uuid),
    [data, item.object_uuid],
  );
  const resolveOthers = useRefResolver(
    useMemo(() => [...refs.map((r) => r.uuid), ...(parentId ? [parentId] : [])], [refs, parentId]),
  );
  // `object_data.uuid` repeats the item's own UUID: no need to fetch it.
  const resolveRef = (uuid: string): RefTarget =>
    uuid === item.object_uuid
      ? { status: 'found', label: itemLabel(item), objectType: item.object_type }
      : resolveOthers(uuid);
  const parentTarget = parentId ? resolveRef(parentId) : null;
  const sections = groupByChannel(data, definition);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b px-4.5 py-4">
        <div className="flex items-center gap-2">
          <TypeDot objectType={item.object_type} shape="square" />
          <MonoText tone="muted" className="text-[11px]">
            {item.object_type}
          </MonoText>
          {!definition && definitions.isSuccess && (
            <Badge variant="outline" className="text-[10px]">
              {t('inspector.unknownType')}
            </Badge>
          )}
          {parentTarget?.status === 'missing' && (
            <Badge variant="destructive" className="text-[10px]">
              {t('inspector.orphan')}
            </Badge>
          )}
        </div>
        <h2 className="text-lg leading-tight font-semibold tracking-tight">{itemLabel(item)}</h2>
        <MonoText tone="subtle" className="text-[11px] leading-relaxed break-all">
          {item.object_uuid}
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
          <PropertyRow name="parent_id">
            {parentId && parentTarget ? (
              <UuidLink
                uuid={parentId}
                target={parentTarget}
                onNavigate={onNavigate}
                missingLabel={t('value.brokenLink')}
              />
            ) : (
              <MonoText tone="subtle">{t('inspector.root')}</MonoText>
            )}
          </PropertyRow>
          {refs.map((ref) => (
            <PropertyRow key={ref.path} name={ref.path}>
              <UuidLink
                uuid={ref.uuid}
                target={resolveRef(ref.uuid)}
                onNavigate={onNavigate}
                missingLabel={t('value.brokenLink')}
              />
            </PropertyRow>
          ))}
          <PropertyRow name={t('inspector.children')}>
            <span className="text-xs leading-relaxed text-fg-2">
              {counts.isPending
                ? '…'
                : !counts.data || counts.data.total === 0
                  ? t('inspector.noChildren')
                  : counts.data.byType.map((c) => `${c.object_type} ${c.total}`).join(' · ')}
            </span>
          </PropertyRow>

          {sections.map((section) => (
            <div key={section.zone ?? 'undeclared'}>
              <SectionTitle
                title={
                  section.zone === null
                    ? t('inspector.undeclared')
                    : t('inspector.zone', { zone: section.zone })
                }
                meta={
                  section.zone === null
                    ? t('inspector.notReplicated')
                    : `${formatDistance(section.distance ?? 0, i18n.language)} · ${section.frequency} Hz`
                }
              />
              {section.keys.map((key) => (
                <PropertyRow key={key} name={key}>
                  <ValueView
                    value={data[key]}
                    name={key}
                    resolveRef={resolveRef}
                    onNavigate={onNavigate}
                  />
                </PropertyRow>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between px-4.5 pt-4.5 pb-1.5">
      <span className="text-[11px] font-medium tracking-[.06em] text-fg-3 uppercase">{title}</span>
      {meta && (
        <MonoText tone="subtle" className="text-[11px]">
          {meta}
        </MonoText>
      )}
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

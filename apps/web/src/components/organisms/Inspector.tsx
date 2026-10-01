import type { ReactNode } from 'react';
import { ExpandIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChildrenCounts, useDefinitions, useItem } from '@/hooks/queries';
import { useItemRefs } from '@/hooks/useItemRefs';
import { itemLabel } from '@/lib/itemLabel';
import { PropertySections, SectionTitle } from './PropertySections';
import { RelationsList } from './RelationsList';

interface InspectorProps {
  uuid: string | undefined;
  onNavigate: (uuid: string) => void;
  /** Opens the full object page. */
  onOpen: (uuid: string) => void;
}

/** Right panel: identity, relations, children summary and properties by channel. */
export function Inspector({ uuid, onNavigate, onOpen }: InspectorProps) {
  const { t } = useTranslation();
  const query = useItem(uuid);

  if (!uuid) return <Placeholder>{t('inspector.empty')}</Placeholder>;
  if (query.isPending) return <Placeholder>{t('inspector.loading')}</Placeholder>;
  if (query.isError) return <Placeholder>{t('inspector.error')}</Placeholder>;
  if (!query.data) return <Placeholder>{t('inspector.notFound', { uuid })}</Placeholder>;
  return <ItemDetails item={query.data} onNavigate={onNavigate} onOpen={onOpen} />;
}

function ItemDetails({ item, onNavigate, onOpen }: { item: Item } & Omit<InspectorProps, 'uuid'>) {
  const { t } = useTranslation();
  const data = item.object_data;
  const definitions = useDefinitions();
  const definition = definitions.data?.definitions.find((d) => d.type === item.object_type);
  const counts = useChildrenCounts(item.object_uuid);
  const { refs, parentId, parentTarget, resolveRef } = useItemRefs(item);

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
          <span className="flex-1" />
          <Button variant="outline" size="xs" onClick={() => onOpen(item.object_uuid)}>
            <ExpandIcon />
            {t('inspector.open')}
          </Button>
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

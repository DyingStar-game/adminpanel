import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChildrenCounts } from '@/hooks/queries';
import { orderChildTypes, profileFor } from '@/lib/profiles';
import { ItemsTable } from './ItemsTable';

interface ChildrenTabsProps {
  item: Item;
  onSelect: (item: Item) => void;
  onNavigate: (uuid: string) => void;
}

interface ChildTab {
  key: string;
  objectType: string;
  parentId: string;
  total: number | null;
  implicit: boolean;
}

/** Children of an item, one tab per type (profile order first), each tab paginated. */
export function ChildrenTabs({ item, onSelect, onNavigate }: ChildrenTabsProps) {
  const { t } = useTranslation();
  const counts = useChildrenCounts(item.object_uuid);
  const profile = profileFor(item.object_type);
  const [pages, setPages] = useState<Record<string, number>>({});

  const byType = new Map((counts.data?.byType ?? []).map((c) => [c.object_type, c.total]));
  const tabs: ChildTab[] = orderChildTypes(profile, [...byType.keys()]).map((type) => ({
    key: type,
    objectType: type,
    parentId: item.object_uuid,
    total: byType.get(type) ?? 0,
    implicit: false,
  }));
  const implicit = profile?.implicitChildren;
  if (implicit) {
    tabs.push({
      key: `implicit:${implicit.objectType}`,
      objectType: implicit.objectType,
      parentId: implicit.parentId,
      total: null,
      implicit: true,
    });
  }

  if (counts.isPending) return <MonoText tone="subtle">…</MonoText>;
  if (tabs.length === 0) return <p className="text-sm text-fg-3">{t('objectPage.noChildren')}</p>;

  return (
    <Tabs defaultValue={tabs[0]?.key}>
      <TabsList className="flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 font-mono text-xs">
            <TypeDot objectType={tab.objectType} />
            {tab.objectType}
            {tab.total !== null && <span className="text-fg-3">{tab.total}</span>}
            {tab.implicit && <span className="text-fg-3">· {t('objectPage.implicit')}</span>}
          </TabsTrigger>
        ))}
        {counts.data && counts.data.other > 0 && (
          <span className="px-2 text-xs text-fg-3">
            {t('tree.otherChildren', { count: counts.data.other })}
          </span>
        )}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="flex flex-col gap-2">
          {tab.implicit && <p className="text-xs text-fg-2">{t('objectPage.implicitHint')}</p>}
          <div className="h-[420px] overflow-hidden rounded-lg border bg-background">
            <ItemsTable
              embedded
              parentId={tab.parentId}
              objectType={tab.objectType}
              scope="level"
              page={pages[tab.key] ?? 1}
              selectedId={undefined}
              onPageChange={(page) => setPages((p) => ({ ...p, [tab.key]: page }))}
              onSelect={onSelect}
              onNavigate={onNavigate}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { HierarchyTree } from '@/components/organisms/HierarchyTree';
import { Inspector } from '@/components/organisms/Inspector';
import { ItemsTable } from '@/components/organisms/ItemsTable';
import { ExplorerLayout } from '@/components/templates/ExplorerLayout';
import { useGoToItem } from '@/hooks/useGoToItem';
import { searchForItem, type ExplorerSearch } from '@/lib/explorerSearch';
import { groupNodeId, useExplorerTree } from '@/stores/explorerTree';

interface ExplorerPageProps {
  search: ExplorerSearch;
  onSearchChange: (search: ExplorerSearch) => void;
  /** Opens the object page of an item. */
  onOpen: (uuid: string) => void;
  onOrbit: (uuid: string) => void;
  /** Opens the map of a celestial body, optionally with an item selected on it (ADR 0018). */
  onMap: (body: string, selected?: string) => void;
}

/** Explorer (mock-up 1b): lazy tree, paginated table of a level or type, inspector. */
export function ExplorerPage({
  search,
  onSearchChange,
  onOpen,
  onOrbit,
  onMap,
}: ExplorerPageProps) {
  const { t } = useTranslation();
  const goToItem = useGoToItem();
  const expand = useExplorerTree((s) => s.expand);

  /** Opens an item inside its level and reveals it in the tree. */
  const navigate = useCallback(
    async (uuid: string) => {
      if (uuid === '') return onSearchChange({ parent: '', scope: 'level', page: 1 });
      const item = await goToItem(uuid);
      if (!item) return void toast.error(t('explorer.notFound', { uuid }));
      const parent = item.object_data.parent_id;
      if (parent) expand([parent, groupNodeId(parent, item.object_type)]);
      onSearchChange(searchForItem(item));
    },
    [goToItem, onSearchChange, expand, t],
  );

  const select = (item: Item) => onSearchChange({ ...search, selected: item.object_uuid });

  return (
    <ExplorerLayout
      labels={{
        tree: t('tree.title'),
        table: t('explorer.items'),
        inspector: t('explorer.inspector'),
      }}
      tree={
        <HierarchyTree
          selectedId={search.selected}
          activeGroup={
            search.scope === 'level'
              ? { parentId: search.parent, objectType: search.type }
              : undefined
          }
          onSelectItem={select}
          onSelectGroup={({ parentId, objectType }) =>
            onSearchChange({
              parent: parentId,
              type: objectType,
              scope: 'level',
              page: 1,
              selected: search.selected,
            })
          }
        />
      }
      table={
        <ItemsTable
          parentId={search.parent}
          objectType={search.type}
          scope={search.scope}
          page={search.page}
          selectedId={search.selected}
          onPageChange={(page) => onSearchChange({ ...search, page })}
          onSelect={select}
          onNavigate={(uuid) => void navigate(uuid)}
          onFilterChange={({ objectType, scope }) =>
            onSearchChange({ ...search, type: objectType, scope, page: 1 })
          }
        />
      }
      inspector={
        <Inspector
          uuid={search.selected}
          onNavigate={(uuid) => void navigate(uuid)}
          onOpen={onOpen}
          onOrbit={onOrbit}
          onMap={onMap}
        />
      }
    />
  );
}

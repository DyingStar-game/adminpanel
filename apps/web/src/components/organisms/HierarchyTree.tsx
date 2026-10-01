import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useChildrenCounts, useItemsInfinite, type ListFilter } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { itemLabel } from '@/lib/itemLabel';
import { groupNodeId, useExplorerTree } from '@/stores/explorerTree';

/** Items per tree level page ("load more"), as in the mock-up (ADR 0005). */
export const TREE_PAGE_SIZE = 25;

export interface ActiveGroup {
  parentId: string;
  objectType: string | undefined;
}

interface HierarchyTreeProps {
  selectedId: string | undefined;
  activeGroup: ActiveGroup | undefined;
  onSelectItem: (item: Item) => void;
  onSelectGroup: (group: ActiveGroup) => void;
}

interface NodeProps extends HierarchyTreeProps {
  depth: number;
}

/**
 * Lazy hierarchy (`parent_id`): roots first, then, per expanded item, its children grouped by
 * type with counts, each group paginated. Nothing is loaded before it is expanded.
 */
export function HierarchyTree(props: HierarchyTreeProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-2">
      <div className="flex items-baseline justify-between px-3.5 pt-3.5 pb-2">
        <span className="text-[11px] font-medium tracking-[.06em] text-fg-3 uppercase">
          {t('tree.title')}
        </span>
        <MonoText tone="subtle" className="text-[11px]">
          parent_id
        </MonoText>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div role="tree" aria-label={t('tree.title')} className="pb-4">
          <ItemList filter={{ parentId: '' }} {...props} depth={0} />
        </div>
      </ScrollArea>
    </div>
  );
}

function ItemList({ filter, ...props }: NodeProps & { filter: ListFilter }) {
  const { t } = useTranslation();
  const query = useItemsInfinite(filter, TREE_PAGE_SIZE);
  if (query.isPending) return <LoadingRow depth={props.depth} />;
  if (query.isError) return <InfoRow depth={props.depth}>{t('tree.error')}</InfoRow>;
  const items = query.data.pages.flatMap((page) => page.items);
  const total = query.data.pages[0]?.total ?? 0;

  return (
    <>
      {items.map((item) => (
        <ItemNode key={item.object_uuid} item={item} {...props} />
      ))}
      {query.hasNextPage && (
        <Row depth={props.depth} onClick={() => void query.fetchNextPage()}>
          <span className="pl-4 text-xs text-link">
            {t('tree.loadMore', { shown: items.length, total })}
          </span>
        </Row>
      )}
    </>
  );
}

function ItemNode({ item, ...props }: NodeProps & { item: Item }) {
  const { t } = useTranslation();
  const expanded = useExplorerTree((s) => !!s.expanded[item.object_uuid]);
  const toggle = useExplorerTree((s) => s.toggle);
  const counts = useChildrenCounts(item.object_uuid, expanded);
  const selected = props.selectedId === item.object_uuid;

  return (
    <>
      <Row
        depth={props.depth}
        selected={selected}
        expanded={expanded}
        onClick={() => props.onSelectItem(item)}
        onToggle={() => toggle(item.object_uuid)}
        label={itemLabel(item)}
      >
        <TypeDot objectType={item.object_type} />
        <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', selected && 'font-medium')}>
          {itemLabel(item)}
        </span>
      </Row>
      {expanded &&
        (counts.isPending ? (
          <LoadingRow depth={props.depth + 1} />
        ) : counts.isError ? (
          <InfoRow depth={props.depth + 1}>{t('tree.error')}</InfoRow>
        ) : counts.data.total === 0 ? (
          <InfoRow depth={props.depth + 1}>{t('tree.noChildren')}</InfoRow>
        ) : (
          <>
            {counts.data.byType.map((group) => (
              <GroupNode
                key={group.object_type}
                parentId={item.object_uuid}
                objectType={group.object_type}
                total={group.total}
                {...props}
                depth={props.depth + 1}
              />
            ))}
            {counts.data.other > 0 && (
              <InfoRow depth={props.depth + 1}>
                {t('tree.otherChildren', { count: counts.data.other })}
              </InfoRow>
            )}
          </>
        ))}
    </>
  );
}

function GroupNode({
  parentId,
  objectType,
  total,
  ...props
}: NodeProps & { parentId: string; objectType: string; total: number }) {
  const id = groupNodeId(parentId, objectType);
  const expanded = useExplorerTree((s) => !!s.expanded[id]);
  const toggle = useExplorerTree((s) => s.toggle);
  const active =
    props.activeGroup?.parentId === parentId && props.activeGroup.objectType === objectType;

  return (
    <>
      <Row
        depth={props.depth}
        selected={active}
        expanded={expanded}
        onClick={() => props.onSelectGroup({ parentId, objectType })}
        onToggle={() => toggle(id)}
        label={objectType}
      >
        <TypeDot objectType={objectType} shape="square" className="opacity-80" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-2">{objectType}</span>
        <MonoText tone="subtle" className="text-[11px]">
          {total}
        </MonoText>
      </Row>
      {expanded && (
        <ItemList filter={{ parentId, objectType }} {...props} depth={props.depth + 1} />
      )}
    </>
  );
}

const indent = (depth: number) => ({ paddingLeft: 8 + depth * 14 });

function Row({
  depth,
  selected = false,
  expanded,
  onClick,
  onToggle,
  label,
  children,
}: {
  depth: number;
  selected?: boolean;
  expanded?: boolean;
  onClick: () => void;
  onToggle?: () => void;
  label?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={onToggle ? expanded : undefined}
      aria-label={label}
      tabIndex={-1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      style={indent(depth)}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 pr-3 hover:bg-surface-3',
        selected && 'bg-surface-3',
      )}
    >
      {onToggle ? (
        <button
          type="button"
          aria-label={expanded ? t('tree.collapse') : t('tree.expand')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid size-4 shrink-0 place-items-center text-fg-3"
        >
          <ChevronRightIcon
            className={cn('size-3 transition-transform', expanded && 'rotate-90')}
          />
        </button>
      ) : null}
      {children}
    </div>
  );
}

function InfoRow({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <div style={indent(depth)} className="flex h-7 items-center pl-6 text-xs text-fg-3">
      <span className="pl-5">{children}</span>
    </div>
  );
}

function LoadingRow({ depth }: { depth: number }) {
  return (
    <div style={indent(depth)} className="flex h-7 items-center pr-3">
      <Skeleton className="ml-5 h-3 w-32" />
    </div>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import type { Item } from '@dyingstar-admin/schemas';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { CrumbTrail, type Crumb } from '@/components/molecules/CrumbTrail';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { ProfileValue } from '@/components/molecules/ProfileValue';
import { ValueView } from '@/components/molecules/ValueView';
import { Button } from '@/components/ui/button';
import { useAncestors, useDefinitions, useItem, useItemsPage } from '@/hooks/queries';
import { useChangedRows } from '@/hooks/useChanges';
import { useRefResolver } from '@/hooks/useRefResolver';
import { cn } from '@/lib/cn';
import { itemLabel, shortUuid } from '@/lib/itemLabel';
import { profileFor, tableColumnsFor } from '@/lib/profiles';
import { collectUuids } from '@/lib/valueShape';

/** Rows per table page, as in the mock-up. */
export const TABLE_PAGE_SIZE = 50;
const ALL_TYPES = '__all__';
/** Profile column showing planet / moon (ADR 0008). */
const KIND_COLUMN = '@kind';

export type TableScope = 'level' | 'type';

export interface ItemsTableProps {
  /** Level whose children are listed (`''` = roots); ignored when `scope` is `type`. */
  parentId: string;
  objectType: string | undefined;
  /** `level`: children of `parentId`; `type`: every item of `objectType` (flat list). */
  scope: TableScope;
  page: number;
  selectedId: string | undefined;
  onPageChange: (page: number) => void;
  onSelect: (item: Item) => void;
  onNavigate: (uuid: string) => void;
  onFilterChange?: (filter: { objectType: string | undefined; scope: TableScope }) => void;
  /** Inside another page (object page tabs): no breadcrumb, type picker or scope switch. */
  embedded?: boolean;
}

/**
 * Values cells read from `table.options.meta` instead of closures, so columns stay stable
 * while references resolve or live data refreshes (otherwise every cell would remount).
 */
interface CellMeta {
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
  moonParentType: string | undefined;
}

const features = tableFeatures({ tableMeta: {} as CellMeta });
const metaOf = (table: { options: { meta?: CellMeta | undefined } }): CellMeta => {
  if (!table.options.meta) throw new Error('ItemsTable cells need their meta');
  return table.options.meta;
};
const uuidOf = (item: Item) => item.object_uuid;
const helper = createColumnHelper<typeof features, Item>();

/**
 * Position shown in tables, as Horizon computes it (ds_genericprops `get_position`): first
 * orbital sample when `positions[]` exists, else `position`.
 */
function displayPosition(item: Item): unknown {
  const { positions, position } = item.object_data;
  return Array.isArray(positions) && positions.length > 0 ? positions[0] : position;
}

/** `planet` profile rule: a planet whose parent is a planet is a moon. */
function celestialKind(
  item: Item,
  moonParentType: string | undefined,
  resolveRef: (uuid: string) => RefTarget,
): 'planet' | 'moon' {
  const parentId = item.object_data.parent_id;
  if (!parentId || !moonParentType) return 'planet';
  const parent = resolveRef(parentId);
  return parent.status === 'found' && parent.objectType === moonParentType ? 'moon' : 'planet';
}

/** Paginated table of one level or one type, with page-local filtering (mock-up 1b). */
export function ItemsTable(props: ItemsTableProps) {
  const { parentId, objectType, scope, page, selectedId, embedded = false } = props;
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const query = useItemsPage(
    scope === 'type' ? { objectType } : { parentId, objectType },
    page,
    TABLE_PAGE_SIZE,
    { live: true },
  );
  const definitions = useDefinitions();
  const extraKeys = tableColumnsFor(objectType);
  const moonParentType = profileFor(objectType)?.moonWhenParentIs;

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const needle = filter.trim().toLowerCase();
    return needle
      ? items.filter(
          (item) =>
            itemLabel(item).toLowerCase().includes(needle) || item.object_uuid.includes(needle),
        )
      : items;
  }, [query.data, filter]);
  // Rows that appeared or changed since the previous refresh of this page (ADR 0009).
  const changedRows = useChangedRows(
    query.data?.items,
    `${scope}|${parentId}|${objectType ?? ''}|${page}`,
    uuidOf,
  );

  const resolveRef = useRefResolver(
    useMemo(
      () => [
        ...rows
          .flatMap((item) => extraKeys.flatMap((key) => collectUuids(item.object_data[key])))
          .map((r) => r.uuid),
        // The planet / moon column needs each row's parent type.
        ...(moonParentType
          ? rows.map((item) => item.object_data.parent_id).filter((id): id is string => !!id)
          : []),
      ],
      [rows, extraKeys, moonParentType],
    ),
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: 'name',
          header: () => t('table.name'),
          cell: ({ row }) => (
            <span className="flex min-w-0 items-center gap-2 font-medium">
              {!objectType && <TypeDot objectType={row.original.object_type} />}
              <span className="truncate">{itemLabel(row.original)}</span>
            </span>
          ),
        }),
        helper.accessor('object_uuid', {
          header: 'object_uuid',
          cell: ({ getValue }) => (
            <span className="flex items-center gap-1">
              <MonoText tone="subtle">{shortUuid(getValue())}</MonoText>
              {/* Copies the full UUID; the column only shows its first characters. */}
              <CopyButton value={getValue()} />
            </span>
          ),
        }),
        ...extraKeys.map((key) =>
          helper.display({
            id: key,
            header: key === KIND_COLUMN ? t('table.kind') : key,
            cell: ({ row, table }) => {
              const meta = metaOf(table);
              return key === KIND_COLUMN ? (
                <MonoText tone="muted">
                  {t(
                    `profile.${celestialKind(row.original, meta.moonParentType, meta.resolveRef)}`,
                  )}
                </MonoText>
              ) : (
                <ProfileValue
                  compact
                  value={row.original.object_data[key]}
                  name={key}
                  data={row.original.object_data}
                  renderer={profileFor(objectType)?.renderers[key]}
                  resolveRef={meta.resolveRef}
                  onNavigate={meta.onNavigate}
                />
              );
            },
          }),
        ),
        helper.display({
          id: 'position',
          header: 'position',
          cell: ({ row, table }) => (
            <ValueView
              value={displayPosition(row.original)}
              name="position"
              resolveRef={metaOf(table).resolveRef}
              onNavigate={metaOf(table).onNavigate}
            />
          ),
        }),
      ]),
    [extraKeys, objectType, t],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    meta: { resolveRef, onNavigate: props.onNavigate, moonParentType },
  });
  const renderers = profileFor(objectType)?.renderers ?? {};
  // Named maps (e.g. seats) are listed inline: they need a wider column.
  const columnWidth = (key: string) =>
    renderers[key] === 'namedMap' ? 'minmax(200px,2fr)' : 'minmax(80px,1fr)';
  const grid = `minmax(160px,1.4fr) 92px ${extraKeys.map(columnWidth).join(' ')} minmax(140px,1.2fr)`;
  const total = query.data?.total ?? 0;
  const typeOptions = [
    { value: ALL_TYPES, label: t('table.allTypes') },
    ...(definitions.data?.definitions ?? []).map((d) => ({ value: d.type, label: d.type })),
  ];
  const onFilterChange = props.onFilterChange;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex flex-col gap-2.5 border-b px-5 pt-3.5 pb-3">
        {scope === 'level' && !embedded && (
          <LevelCrumbs parentId={parentId} onNavigate={props.onNavigate} />
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          {objectType ? <TypeDot objectType={objectType} className="size-2.5" /> : null}
          <span className="font-mono text-base font-semibold">
            {objectType ?? t('table.allTypes')}
          </span>
          <span className="text-xs text-fg-3">{t('table.count', { count: total })}</span>
          <span className="flex-1" />
          {!embedded && onFilterChange && (
            <OptionSelect
              label={t('table.type')}
              value={objectType ?? ALL_TYPES}
              options={typeOptions}
              onChange={(value) =>
                onFilterChange({
                  objectType: value === ALL_TYPES ? undefined : value,
                  scope: value === ALL_TYPES ? 'level' : scope,
                })
              }
              className="w-40 font-mono"
            />
          )}
          {objectType && !embedded && onFilterChange && (
            <div
              className="flex rounded-md border p-0.5"
              role="group"
              aria-label={t('table.scope')}
            >
              {(['level', 'type'] as const).map((value) => (
                <Button
                  key={value}
                  size="xs"
                  variant={scope === value ? 'secondary' : 'ghost'}
                  aria-pressed={scope === value}
                  onClick={() => onFilterChange({ objectType, scope: value })}
                >
                  {value === 'level'
                    ? t('table.scopeLevel')
                    : t('table.scopeType', { type: objectType })}
                </Button>
              ))}
            </div>
          )}
          <label className="flex h-7 w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-fg-3">
            <ListFilterIcon className="size-3.5" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('table.filterPage')}
              aria-label={t('table.filterPage')}
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
            />
          </label>
        </div>
      </div>

      <div
        role="row"
        className="grid h-8 shrink-0 items-center gap-3 border-b bg-surface-2 px-5 font-mono text-[11px] text-fg-3"
        style={{ gridTemplateColumns: grid }}
      >
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <span key={header.id} role="columnheader" className="truncate">
            <table.FlexRender header={header} />
          </span>
        ))}
      </div>

      <div
        className={cn('min-h-0 flex-1 overflow-auto', query.isPlaceholderData && 'opacity-60')}
        role="rowgroup"
      >
        {query.isError ? (
          <Empty>{t('table.error')}</Empty>
        ) : query.isPending ? (
          <Empty>{t('table.loading')}</Empty>
        ) : rows.length === 0 ? (
          <Empty>{filter ? t('table.noMatch') : t('table.empty')}</Empty>
        ) : (
          table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              role="row"
              aria-selected={row.original.object_uuid === selectedId}
              onClick={() => props.onSelect(row.original)}
              className={cn(
                'grid h-[34px] cursor-pointer items-center gap-3 border-b px-5 text-[12.5px] transition-colors duration-700 hover:bg-surface-3',
                row.original.object_uuid === selectedId && 'bg-link-bg',
                changedRows.has(row.original.object_uuid) && 'bg-flash',
              )}
              style={{ gridTemplateColumns: grid }}
            >
              {row.getAllCells().map((cell) => (
                <span key={cell.id} role="cell" className="min-w-0 truncate">
                  <table.FlexRender cell={cell} />
                </span>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex h-11 shrink-0 items-center border-t px-5">
        <div className="flex-1">
          <Pagination
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            total={total}
            onPageChange={props.onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

/** Breadcrumb of the listed level: roots, its ancestors, then the level itself. */
function LevelCrumbs({
  parentId,
  onNavigate,
}: {
  parentId: string;
  onNavigate: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const parent = useItem(parentId || undefined);
  const ancestors = useAncestors(parentId || undefined);
  const crumbs: Crumb[] = [
    { id: '', label: t('table.roots'), objectType: 'star' },
    ...(ancestors.data?.ancestors ?? []).map((a) => ({
      id: a.object_uuid,
      label: itemLabel(a),
      objectType: a.object_type,
    })),
    ...(parent.data
      ? [
          {
            id: parent.data.object_uuid,
            label: itemLabel(parent.data),
            objectType: parent.data.object_type,
          },
        ]
      : []),
  ];
  return <CrumbTrail crumbs={crumbs} onSelect={onNavigate} />;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-fg-3">{children}</div>;
}

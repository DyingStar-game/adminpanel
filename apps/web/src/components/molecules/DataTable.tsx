import { useMemo, type ReactNode } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty: string;
  /** Row picked (opened); the picked row is highlighted. */
  onPick?: (row: T) => void;
  picked?: (row: T) => boolean;
}

/** Each column's current renderer, read by the stable column definitions through the meta. */
interface DataTableMeta {
  cells: Record<string, (row: never) => ReactNode>;
  headers: Record<string, string>;
}
const features = tableFeatures({ tableMeta: {} as DataTableMeta });

/**
 * Plain table of records (players, moderation lists) on TanStack Table, like `ItemsTable`
 * (ADR 0014): header, rows, an empty line when there is none. Paging stays with the caller.
 */
export function DataTable<T extends object>({
  label,
  columns,
  rows,
  rowKey,
  empty,
  onPick,
  picked,
}: DataTableProps<T>) {
  // Definitions depend on the column keys only: `FlexRender` renders a cell function as a
  // component, so new functions at every render would remount every cell (as `ItemsTable`, the
  // renderers come through the table's meta).
  const keys = columns.map((column) => column.key).join('|');
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns(
      keys.split('|').map((key) =>
        helper.display({
          id: key,
          header: ({ table }) => table.options.meta?.headers[key],
          cell: ({ row, table }) =>
            (table.options.meta?.cells[key] as ((row: T) => ReactNode) | undefined)?.(row.original),
        }),
      ),
    );
  }, [keys]);
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => String(rowKey(row)),
    meta: {
      cells: Object.fromEntries(columns.map((c) => [c.key, c.cell])) as DataTableMeta['cells'],
      headers: Object.fromEntries(columns.map((c) => [c.key, c.header])),
    },
  });
  const classOf = (id: string) => columns.find((c) => c.key === id)?.className;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={label} className="w-full text-sm">
        <thead className="border-b bg-surface-2 text-left text-2xs tracking-wider text-fg-3 uppercase">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={cn('px-3 py-2 font-normal', classOf(header.column.id))}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-fg-3">
                {empty}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onPick ? () => onPick(row.original) : undefined}
                aria-selected={picked?.(row.original) || undefined}
                className={cn(
                  'border-b last:border-0',
                  onPick && 'cursor-pointer hover:bg-white/5',
                  picked?.(row.original) && 'bg-link-bg',
                )}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={cn('px-3 py-2 align-top', classOf(cell.column.id))}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import type { ReactNode } from 'react';
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

/** Plain table of records (moderation lists): header, rows, an empty line when there is none. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  empty,
  onPick,
  picked,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={label} className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-left text-xs text-fg-3">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-3 py-2 font-medium', column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-fg-3">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onPick ? () => onPick(row) : undefined}
                aria-selected={picked?.(row) || undefined}
                className={cn(
                  'border-b last:border-0',
                  onPick && 'cursor-pointer hover:bg-white/5',
                  picked?.(row) && 'bg-link-bg',
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-3 py-2 align-top', column.className)}>
                    {column.cell(row)}
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

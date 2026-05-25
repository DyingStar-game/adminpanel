import { cn } from '@/lib/cn';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/** Horizontally scrollable table wrapper. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  );
}

/** Table header row group with muted styling. */
export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'bg-ds-surface-elevated text-ds-muted text-xs uppercase tracking-wider',
        className,
      )}
      {...props}
    />
  );
}

/** Table body row with hover highlight. */
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-ds-border hover:bg-ds-surface-hover transition-all duration-150',
        className,
      )}
      {...props}
    />
  );
}

/** Header cell for column titles. */
export function TableHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 text-left font-medium', className)} {...props} />;
}

/** Standard data cell. */
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3', className)} {...props} />;
}

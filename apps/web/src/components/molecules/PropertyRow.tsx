import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PropertyRowProps {
  name: string;
  children: ReactNode;
  /** Briefly highlighted when the value changed on a live refresh (ADR 0009). */
  changed?: boolean;
  /** Extra marker next to the key, e.g. "not replicated". */
  hint?: ReactNode;
  /** Wider key column, for long reference paths. */
  wide?: boolean;
}

/** Key / value line of the inspector and object page. */
export function PropertyRow({
  name,
  children,
  changed = false,
  hint,
  wide = false,
}: PropertyRowProps) {
  return (
    <div
      data-changed={changed || undefined}
      className={cn(
        'grid min-h-7.5 items-center gap-2.5 px-4.5 transition-colors duration-700',
        wide ? 'grid-cols-[190px_minmax(0,1fr)]' : 'grid-cols-[120px_minmax(0,1fr)]',
        changed && 'bg-flash',
      )}
    >
      <span className="flex min-w-0 items-center gap-1 truncate font-mono text-xs text-fg-2">
        <span className="truncate" title={name}>
          {name}
        </span>
        {hint}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

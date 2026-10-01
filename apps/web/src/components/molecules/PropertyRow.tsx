import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PropertyRowProps {
  name: string;
  children: ReactNode;
  /** Briefly highlighted when the value changed on a live refresh (ADR 0009). */
  changed?: boolean;
  /** Extra marker next to the key, e.g. "not replicated". */
  hint?: ReactNode;
}

/** Key / value line of the inspector and object page. */
export function PropertyRow({ name, children, changed = false, hint }: PropertyRowProps) {
  return (
    <div
      data-changed={changed || undefined}
      className={cn(
        'grid min-h-[30px] grid-cols-[120px_minmax(0,1fr)] items-center gap-2.5 px-4.5 transition-colors duration-700',
        changed && 'bg-flash',
      )}
    >
      <span className="flex min-w-0 items-center gap-1 truncate font-mono text-[11.5px] text-fg-2">
        <span className="truncate">{name}</span>
        {hint}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

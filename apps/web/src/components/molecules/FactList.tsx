import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FactListProps {
  facts: [label: string, value: ReactNode][];
  /** Two pairs a row from small screens up (a leg of a supply order); one by default. */
  columns?: 1 | 2;
}

/** Label and value pairs in two columns (a player's identity, a mission's terms). */
export function FactList({ facts, columns = 1 }: FactListProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm',
        columns === 2 && 'sm:grid-cols-[auto_1fr_auto_1fr]',
      )}
    >
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-3">{label}</dt>
          <dd className="min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

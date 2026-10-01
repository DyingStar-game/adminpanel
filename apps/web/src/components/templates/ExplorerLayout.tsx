import type { ReactNode } from 'react';

interface ExplorerLayoutProps {
  tree: ReactNode;
  table: ReactNode;
  inspector: ReactNode;
  /** Accessible names of the three regions. */
  labels: { tree: string; table: string; inspector: string };
}

/** Three columns from the mock-up (1b): hierarchy, table, inspector. */
export function ExplorerLayout({ tree, table, inspector, labels }: ExplorerLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside aria-label={labels.tree} className="min-h-0 border-r">
        {tree}
      </aside>
      <section aria-label={labels.table} className="min-h-0 min-w-0">
        {table}
      </section>
      <aside aria-label={labels.inspector} className="min-h-0 border-l bg-background">
        {inspector}
      </aside>
    </div>
  );
}

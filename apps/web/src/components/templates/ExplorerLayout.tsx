import type { ReactNode } from 'react';

interface ExplorerLayoutProps {
  /** Page title and its actions, above the card. */
  heading: ReactNode;
  tree: ReactNode;
  table: ReactNode;
  inspector: ReactNode;
  /** Accessible names of the three regions. */
  labels: { tree: string; table: string; inspector: string };
}

/** Page title, then a card with three columns: hierarchy, table, inspector. */
export function ExplorerLayout({ heading, tree, table, inspector, labels }: ExplorerLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-6">
      {heading}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_clamp(400px,30vw,520px)] overflow-hidden rounded-xl border bg-surface-2">
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
    </div>
  );
}

import type { ReactNode } from 'react';

interface OrbitLayoutProps {
  graph: ReactNode;
  /** Panels floating over the graph (breadcrumb, cluster pager, legend). */
  overlays: ReactNode;
  inspector: ReactNode;
  labels: { graph: string; inspector: string };
}

/** Orbit view (mock-up 1a): dotted canvas with floating panels, inspector on the right. */
export function OrbitLayout({ graph, overlays, inspector, labels }: OrbitLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(400px,30vw,520px)]">
      <section aria-label={labels.graph} className="relative min-h-0 overflow-hidden bg-surface-2">
        {graph}
        {overlays}
      </section>
      <aside aria-label={labels.inspector} className="min-h-0 border-l bg-background">
        {inspector}
      </aside>
    </div>
  );
}

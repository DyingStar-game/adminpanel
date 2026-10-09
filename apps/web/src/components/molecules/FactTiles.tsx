import type { ReactNode } from 'react';

export interface Fact {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
}

/** Key figures as framed tiles (community stats, a player's reputation and playtime). */
export function FactTiles({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-1 rounded-lg border px-4 py-3">
          <dt className="text-xs text-fg-3">{fact.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{fact.value}</dd>
          {fact.hint && <dd className="text-xs text-fg-3">{fact.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

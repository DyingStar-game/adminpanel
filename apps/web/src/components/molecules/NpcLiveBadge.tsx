import { cn } from '@/lib/cn';
import type { LiveState } from '@/lib/npcs';

const DOT: Record<LiveState, string> = {
  connected: 'bg-green-500',
  running: 'bg-amber-400',
  stopped: 'bg-fg-3',
};

/**
 * Where an NPC is on the servers (ADR 0026): connected to Horizon, running but off shift, or
 * stopped; its colour always named. Pure.
 */
export function NpcLiveBadge({ state, label }: { state: LiveState; label: string }) {
  return (
    <span data-live={state} className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span aria-hidden className={cn('inline-block size-2 rounded-full', DOT[state])} />
      {label}
    </span>
  );
}

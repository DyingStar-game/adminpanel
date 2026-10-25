import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNpcEvents } from '@/hooks/useNpcs';
import { formatDateTime } from '@/lib/format';
import { npcErrorKey } from '@/lib/npcs';

const LEVEL_VARIANT = {
  debug: 'outline',
  info: 'secondary',
  warn: 'default',
  error: 'destructive',
} as const;

interface NpcEventsFeedProps {
  /** One NPC's events; every NPC's and the service-wide ones when null. */
  npcId: string | null;
  kind: string | undefined;
  onKindChange: (kind: string | undefined) => void;
  /** Opens an NPC named by an event (the global feed). */
  onOpenNpc?: ((id: string) => void) | undefined;
}

/**
 * Key events of the NPCs, newest first (ADR 0026): spawns, connections, role assignments,
 * actions and tasks, the switch and bulk actions; filtered by kind (`spawned`, `task_failed`…),
 * older ones loaded on demand. Polled with the lists.
 */
export function NpcEventsFeed({ npcId, kind, onKindChange, onOpenNpc }: NpcEventsFeedProps) {
  const { t, i18n } = useTranslation();
  const events = useNpcEvents(npcId, kind);
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label={t('npcs.events.kind')}
        placeholder={t('npcs.events.kindPlaceholder')}
        defaultValue={kind ?? ''}
        key={kind ?? ''}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onKindChange(event.currentTarget.value.trim() || undefined);
        }}
        onBlur={(event) => onKindChange(event.target.value.trim() || undefined)}
        className="h-7 w-60 text-xs"
      />
      {events.isError && <ServiceNotice message={t(npcErrorKey(events.error))} />}
      {events.data && items.length === 0 && (
        <p className="text-sm text-fg-3">{t('npcs.events.none')}</p>
      )}
      <ol aria-label={t('npcs.events.label')} className="flex flex-col divide-y rounded-lg border">
        {items.map((event) => (
          <li
            key={String(event.id)}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="w-36 shrink-0 text-xs text-fg-3 tabular-nums">
              {formatDateTime(event.ts, i18n.language)}
            </span>
            <Badge variant={LEVEL_VARIANT[event.level]}>{event.level}</Badge>
            <MonoText tone="muted">{event.kind}</MonoText>
            <span className="min-w-0 flex-1">{event.message}</span>
            {!npcId &&
              (event.npcId ? (
                onOpenNpc && (
                  <Button size="xs" variant="ghost" onClick={() => onOpenNpc(event.npcId ?? '')}>
                    {t('npcs.events.openNpc')}
                  </Button>
                )
              ) : (
                <Badge variant="outline">{t('npcs.events.service')}</Badge>
              ))}
            {event.data && Object.keys(event.data).length > 0 && (
              <MonoText tone="subtle" className="w-full truncate">
                {JSON.stringify(event.data)}
              </MonoText>
            )}
          </li>
        ))}
      </ol>
      {events.hasNextPage && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          {t('npcs.events.more')}
        </Button>
      )}
    </div>
  );
}

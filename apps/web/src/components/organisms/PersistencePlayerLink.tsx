import { useTranslation } from 'react-i18next';
import { ExpandIcon, MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAncestors, useItem } from '@/hooks/queries';
import { useCan } from '@/hooks/useCan';
import { mapBodyOf } from '@/lib/bodyMap';
import { itemLabel } from '@/lib/itemLabel';

interface PersistencePlayerLinkProps {
  /** The player's Keycloak id: also their `player` item's UUID in persistence (back team). */
  playerId: string;
  onOpenItem: (uuid: string) => void;
  onOpenMap: (body: string, selected: string) => void;
}

/**
 * The player in the game world: their `player` item in persistence, and the map it is drawn on
 * (same id as in `social`, ADR 0024). Hidden from accounts that may not read persistence.
 */
export function PersistencePlayerLink({
  playerId,
  onOpenItem,
  onOpenMap,
}: PersistencePlayerLinkProps) {
  const { t } = useTranslation();
  const canRead = useCan()('persistence.read');
  const item = useItem(canRead ? playerId : undefined);
  const found = item.data ?? null;
  const ancestors = useAncestors(found ? found.object_uuid : undefined);
  const body = found && ancestors.data ? mapBodyOf(found, ancestors.data.ancestors) : null;

  if (!canRead) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('moderation.player.world.title')}</h2>
      {item.isPending ? (
        <p className="text-sm text-fg-3">…</p>
      ) : found ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{itemLabel(found)}</span>
          <Button variant="outline" size="sm" onClick={() => onOpenItem(found.object_uuid)}>
            <ExpandIcon />
            {t('moderation.player.world.open')}
          </Button>
          {body && (
            <Button variant="outline" size="sm" onClick={() => onOpenMap(body, found.object_uuid)}>
              <MapPinIcon />
              {t('map.showOn')}
            </Button>
          )}
          <span className="w-full text-xs text-fg-3">{t('moderation.player.world.hint')}</span>
        </div>
      ) : (
        <p className="text-sm text-fg-3">{t('moderation.player.world.missing')}</p>
      )}
    </section>
  );
}

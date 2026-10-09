import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityPicker, type EntityOption } from '@/components/molecules/EntityPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TELEPORTABLE_TYPES, type TeleportableType } from '@/lib/bodyMap';

interface TeleportDialogProps {
  /** Where the item will go (latitude / longitude). */
  place: string;
  /** Candidates of each kind, on the body. */
  options: Record<TeleportableType, EntityOption[]>;
  onPick: (uuid: string) => void;
  onCancel: () => void;
}

/**
 * Picks what to teleport to a place of the map (ADR 0018): a player or a vehicle of the body,
 * searchable; the pick opens its editor at that place, like "Move … here".
 */
export function TeleportDialog({ place, options, onPick, onCancel }: TeleportDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<TeleportableType>('player');
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>{t('map.teleport.title', { place })}</DialogTitle>
          <DialogDescription>{t('map.teleport.body')}</DialogDescription>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(value) => setKind(value as TeleportableType)}>
          <TabsList>
            {TELEPORTABLE_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {t(`map.teleport.${type}`)} ({options[type].length})
              </TabsTrigger>
            ))}
          </TabsList>
          {TELEPORTABLE_TYPES.map((type) => (
            <TabsContent key={type} value={type}>
              <EntityPicker
                options={options[type]}
                value={null}
                onChange={onPick}
                labels={{
                  field: t(`map.teleport.search_${type}`),
                  empty: t('map.teleport.none'),
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

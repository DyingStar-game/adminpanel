import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityPicker } from '@/components/molecules/EntityPicker';
import { useSocialPlayers } from '@/hooks/useModeration';

interface ProfilePickerProps {
  value: string | null;
  onChange: (playerId: string) => void;
  /** Label of the field: the CEO, the head… */
  label: string;
}

/** A player or an NPC of `social`, searched by name on the server (ADR 0024). */
export function ProfilePicker({ value, onChange, label }: ProfilePickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const profiles = useSocialPlayers({ search }, 1);
  return (
    <EntityPicker
      options={(profiles.data?.items ?? []).map((p) => ({
        uuid: p.playerId,
        label: p.displayName,
        objectType: 'player',
        hint: p.entityType === 'npc' ? t('moderation.player.kind.npc') : undefined,
      }))}
      value={value}
      onChange={onChange}
      onQueryChange={setSearch}
      labels={{ field: label, empty: t('players.none') }}
    />
  );
}

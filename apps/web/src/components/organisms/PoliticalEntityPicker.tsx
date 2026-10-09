import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityPicker } from '@/components/molecules/EntityPicker';
import { usePoliticalEntities } from '@/hooks/useOrganisations';

interface PoliticalEntityPickerProps {
  value: string | null;
  /** The entity picked, with its name for the summary. */
  onChange: (entity: { id: string; name: string }) => void;
  label: string;
}

/** A political entity of `social`, of any level, searched by name on the server (ADR 0024). */
export function PoliticalEntityPicker({ value, onChange, label }: PoliticalEntityPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const entities = usePoliticalEntities(search, undefined, 1);
  const items = entities.data?.items ?? [];
  return (
    <EntityPicker
      options={items.map((e) => ({
        uuid: e.id,
        label: e.name,
        objectType: 'political',
        hint: t(`moderation.player.political.${e.type}`),
      }))}
      value={value}
      onChange={(id) => onChange({ id, name: items.find((e) => e.id === id)?.name ?? id })}
      onQueryChange={setSearch}
      labels={{ field: label, empty: t('economy.settings.noEntity') }}
    />
  );
}

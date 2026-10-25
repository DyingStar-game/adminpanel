import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MiningVillage } from '@dyingstar-admin/contracts/npc';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable, type Column } from '@/components/molecules/DataTable';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useNpcVillages } from '@/hooks/useNpcs';
import { formatDistance } from '@/lib/format';
import { npcErrorKey } from '@/lib/npcs';
import { WorkplaceDialog } from './WorkplaceDialog';

/**
 * The mining villages of the NPC service's world data (ADR 0026): their NPCs, storekeepers out
 * of the slots, the cargo depot the storekeepers work at (and where it was found: universe
 * simulation, world data, or set by hand) and the Factory their drivers go to. `npc.manage`
 * sets or clears a workplace by hand.
 */
export function NpcVillages({ onOpenVillage }: { onOpenVillage: (code: string) => void }) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const villages = useNpcVillages();
  const [editing, setEditing] = useState<MiningVillage | null>(null);

  if (villages.isError) return <ServiceNotice message={t(npcErrorKey(villages.error))} />;

  const columns: Column<MiningVillage>[] = [
    {
      key: 'name',
      header: t('npcs.fields.village'),
      cell: (v) => (
        <button
          type="button"
          className="text-link hover:underline"
          aria-label={t('npcs.villages.openRoster', { village: v.name })}
          onClick={() => onOpenVillage(v.name)}
        >
          {v.name}
        </button>
      ),
    },
    {
      key: 'npcs',
      header: t('npcs.villages.npcs'),
      className: 'text-right tabular-nums',
      cell: (v) => v.npcs,
    },
    {
      key: 'storekeepers',
      header: t('npcs.villages.storekeepers'),
      className: 'tabular-nums',
      cell: (v) => `${v.storekeepers}/${v.storekeeperSlots}`,
    },
    {
      key: 'workplace',
      header: t('npcs.villages.workplace'),
      cell: (v) =>
        v.workplace ? (
          <span className="flex items-center gap-1.5">
            <MonoText>{v.workplace.warehouseCode ?? v.workplace.warehouseId.slice(0, 8)}</MonoText>
            <Badge variant={v.workplace.source === 'manual' ? 'default' : 'outline'}>
              {t(`npcs.villages.sources.${v.workplace.source}`)}
            </Badge>
          </span>
        ) : (
          <span className="text-fg-3">{t('npcs.villages.noWorkplace')}</span>
        ),
    },
    {
      key: 'factory',
      header: t('npcs.villages.factory'),
      cell: (v) =>
        v.factory?.factory ? (
          <span>
            {v.factory.factory}
            {v.factory.road_cost_m != null && (
              <span className="text-xs text-fg-3">
                {' '}
                · {formatDistance(v.factory.road_cost_m, i18n.language)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-fg-3">{t('npcs.none')}</span>
        ),
    },
    ...(can('npc.manage')
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            cell: (v: MiningVillage) => (
              <Button
                size="xs"
                variant="outline"
                aria-label={t('npcs.villages.editWorkplace', { village: v.name })}
                onClick={() => setEditing(v)}
              >
                {t('npcs.villages.workplaceButton')}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {villages.data && (
        <p className="text-xs text-fg-3">
          {t('npcs.villages.lead', {
            planet: villages.data.planet,
            factories: villages.data.factories.map((f) => f.name).join(', ') || t('npcs.none'),
          })}
        </p>
      )}
      <DataTable
        label={t('npcs.villages.label')}
        columns={columns}
        rows={villages.data?.mining ?? []}
        rowKey={(v) => v.name}
        empty={villages.isPending ? t('npcs.loading') : t('npcs.villages.empty')}
      />
      {editing && (
        <WorkplaceDialog
          village={editing.name}
          workplace={editing.workplace}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

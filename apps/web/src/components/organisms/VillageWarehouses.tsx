import { useState } from 'react';
import { PencilIcon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  VillageWarehouse,
  WarehouseStock,
} from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { StockHealthBadge } from '@/components/molecules/StockHealthBadge';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useSimulationNames, useVillage } from '@/hooks/useSimulation';
import { useUpdateVillage } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity, stockHealth } from '@/lib/simulation';
import { WarehouseCapacityDialog } from './WarehouseCapacityDialog';

interface VillageWarehousesProps {
  village: { id: string; name: string };
}

/**
 * The warehouses of a village (its cargo depots, the service's ADR 0013), each with its own
 * stocks and capacities, the main one (where deliveries and production go) marked. For
 * `simulation.manage`: another warehouse can be made the main one, and each capacity edited,
 * both confirmed (ADR 0025 › Configuration).
 */
export function VillageWarehouses({ village }: VillageWarehousesProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const can = useCan();
  const detail = useVillage(village.id);
  const names = useSimulationNames();
  const update = useUpdateVillage();
  const [making, setMaking] = useState<VillageWarehouse | null>(null);
  const [editing, setEditing] = useState<{
    warehouse: VillageWarehouse;
    stock: WarehouseStock;
  } | null>(null);
  const manage = can('simulation.manage');
  const resourceOf = (id: string) => {
    const r = names.resources.get(id);
    return { id, name: r?.name ?? id, unit: r?.unit ?? '' };
  };
  const warehouses = detail.data?.warehouses ?? [];
  const number = 'text-right tabular-nums';

  const confirmMain = async (w: VillageWarehouse) => {
    setMaking(null);
    try {
      await update.mutateAsync({ id: village.id, change: { mainWarehouseId: w.warehouse.id } });
      toast.success(t('simulation.panel.madeMain', { warehouse: w.warehouse.name }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
    }
  };

  if (detail.data && warehouses.length === 0) {
    return <p className="text-sm text-fg-3">{t('simulation.panel.noWarehouse')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-3">{t('simulation.panel.mainHint')}</p>
      {warehouses.map((w) => {
        const title = t('simulation.panel.warehouseStocks', { warehouse: w.warehouse.name });
        return (
          <section
            key={w.warehouse.id}
            aria-label={w.warehouse.name}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                {w.warehouse.name}
                {w.main && <Badge>{t('simulation.panel.main')}</Badge>}
              </h4>
              {manage && !w.main && (
                <Button variant="outline" size="xs" onClick={() => setMaking(w)}>
                  <StarIcon aria-hidden />
                  {t('simulation.panel.makeMain')}
                </Button>
              )}
            </div>
            <DataTable<WarehouseStock>
              label={title}
              rows={w.stocks}
              rowKey={(s) => s.resourceId}
              empty={t('simulation.none')}
              columns={[
                {
                  key: 'resource',
                  header: t('simulation.columns.resource'),
                  cell: (s) => resourceOf(s.resourceId).name,
                },
                {
                  key: 'quantity',
                  header: t('simulation.columns.quantity'),
                  cell: (s) =>
                    `${formatQuantity(s.quantity, locale)} ${resourceOf(s.resourceId).unit}`,
                  className: number,
                },
                {
                  key: 'held',
                  header: t('simulation.columns.held'),
                  cell: (s) => formatQuantity(s.held, locale),
                  className: number,
                },
                {
                  key: 'capacity',
                  header: t('simulation.columns.capacity'),
                  cell: (s) =>
                    s.capacity != null
                      ? formatQuantity(s.capacity, locale)
                      : t('simulation.panel.unlimited'),
                  className: number,
                },
                {
                  key: 'health',
                  header: t('simulation.columns.health'),
                  cell: (s) => (
                    <StockHealthBadge
                      health={stockHealth(s)}
                      label={t(`simulation.health.${stockHealth(s)}`)}
                    />
                  ),
                },
                ...(manage
                  ? [
                      {
                        key: 'actions',
                        header: t('simulation.config.actions'),
                        cell: (s: WarehouseStock) => (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${t('simulation.config.editCapacity')} · ${resourceOf(s.resourceId).name}`}
                            title={t('simulation.config.editCapacity')}
                            onClick={() => setEditing({ warehouse: w, stock: s })}
                          >
                            <PencilIcon />
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </section>
        );
      })}
      {making && (
        <WriteConfirm
          open
          title={t('simulation.panel.makeMainTitle', {
            warehouse: making.warehouse.name,
            village: village.name,
          })}
          description={<p>{t('simulation.panel.makeMainText')}</p>}
          confirmLabel={t('simulation.panel.makeMain')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmMain(making)}
          onCancel={() => setMaking(null)}
        />
      )}
      {editing && (
        <WarehouseCapacityDialog
          warehouse={{ id: editing.warehouse.warehouse.id, name: editing.warehouse.warehouse.name }}
          resource={resourceOf(editing.stock.resourceId)}
          capacity={editing.stock.capacity}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

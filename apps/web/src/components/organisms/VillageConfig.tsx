import { useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Flow, VillagePolicy } from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { useSimulationResources, useVillage } from '@/hooks/useSimulation';
import { useDeleteFlow } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity, formatRate } from '@/lib/simulation';
import { FlowDialog } from './FlowDialog';
import { VillagePolicyActions } from './VillagePolicyActions';
import { VillagePolicyDialog } from './VillagePolicyDialog';

interface VillageConfigProps {
  village: { id: string; name: string };
}

/**
 * The configuration of a village that `simulation.manage` may change (ADR 0025 ›
 * Configuration; villages are the simulation's nodes, the service's ADR 0013): its thresholds
 * (edit, delete, add one for a resource without) and its production and consumption flows (edit
 * the rate and label, delete, add). Each write is confirmed; every view is refreshed after it.
 */
export function VillageConfig({ village }: VillageConfigProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const resources = useSimulationResources();
  const detail = useVillage(village.id);
  const removeFlow = useDeleteFlow();
  const [adding, setAdding] = useState<string | null>(null);
  const [flowOpen, setFlowOpen] = useState<Flow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Flow | null>(null);
  const catalogue = resources.data?.items ?? [];
  const resourceOf = (id: string) => {
    const r = catalogue.find((r) => r.id === id);
    return { id, name: r?.name ?? id, unit: r?.unit ?? '' };
  };
  const optional = (value: number | null | undefined) =>
    value != null ? formatQuantity(value, locale) : t('simulation.none');
  const kept = new Set((detail.data?.policies ?? []).map((p) => p.resourceId));
  const without = catalogue.filter((r) => !kept.has(r.id));
  const number = 'text-right tabular-nums';

  const confirmDelete = async (flow: Flow) => {
    setDeleting(null);
    try {
      await removeFlow.mutateAsync(flow.id);
      toast.success(
        t('simulation.config.flowDeleted', { resource: resourceOf(flow.resourceId).name }),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
    }
  };
  const heading = (text: string) => <h3 className="text-xs font-semibold text-fg-2">{text}</h3>;

  return (
    <>
      <section className="flex flex-col gap-2">
        {heading(t('simulation.config.policies'))}
        <DataTable<VillagePolicy>
          label={t('simulation.config.policies')}
          rows={detail.data?.policies ?? []}
          rowKey={(p) => p.resourceId}
          empty={detail.data ? t('simulation.config.noPolicy') : '…'}
          columns={[
            {
              key: 'resource',
              header: t('simulation.columns.resource'),
              cell: (p) => resourceOf(p.resourceId).name,
            },
            {
              key: 'threshold',
              header: t('simulation.columns.threshold'),
              cell: (p) => optional(p.minThreshold),
              className: number,
            },
            {
              key: 'target',
              header: t('simulation.columns.target'),
              cell: (p) => optional(p.targetLevel),
              className: number,
            },
            {
              key: 'actions',
              header: t('simulation.config.actions'),
              cell: (p) => (
                <VillagePolicyActions village={village} resource={resourceOf(p.resourceId)} />
              ),
            },
          ]}
        />
        {without.length > 0 && (
          <OptionSelect<string>
            label={t('simulation.config.addPolicyFor')}
            placeholder={t('simulation.config.addPolicyFor')}
            value={undefined}
            options={without.map((r) => ({ value: r.id, label: r.name }))}
            onChange={setAdding}
            className="w-56"
          />
        )}
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {heading(t('simulation.config.flows'))}
          <Button variant="outline" size="xs" onClick={() => setFlowOpen('new')}>
            <PlusIcon aria-hidden />
            {t('simulation.config.addFlow')}
          </Button>
        </div>
        <DataTable<Flow>
          label={t('simulation.panel.flows')}
          rows={detail.data?.flows ?? []}
          rowKey={(f) => f.id}
          empty={t('simulation.panel.noFlow')}
          columns={[
            {
              key: 'resource',
              header: t('simulation.columns.resource'),
              cell: (f) => resourceOf(f.resourceId).name,
            },
            {
              key: 'source',
              header: t('simulation.columns.source'),
              cell: (f) => f.label ?? t(`simulation.panel.sources.${f.source}`),
            },
            {
              key: 'rate',
              header: t('simulation.columns.rate'),
              cell: (f) => formatRate(f.ratePerHour, locale),
              className: number,
            },
            {
              key: 'actions',
              header: t('simulation.config.actions'),
              cell: (f) => {
                const name = resourceOf(f.resourceId).name;
                return (
                  <span className="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${t('simulation.config.editFlow')} · ${name}`}
                      title={t('simulation.config.editFlow')}
                      onClick={() => setFlowOpen(f)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${t('simulation.config.deleteFlow')} · ${name}`}
                      title={t('simulation.config.deleteFlow')}
                      onClick={() => setDeleting(f)}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                );
              },
            },
          ]}
        />
      </section>
      {adding && (
        <VillagePolicyDialog
          village={village}
          resource={resourceOf(adding)}
          policy={null}
          onClose={() => setAdding(null)}
        />
      )}
      {flowOpen && (
        <FlowDialog
          village={village}
          flow={flowOpen === 'new' ? null : flowOpen}
          resources={catalogue}
          onClose={() => setFlowOpen(null)}
        />
      )}
      {deleting && (
        <WriteConfirm
          open
          destructive
          title={t('simulation.config.deleteFlowTitle', {
            resource: resourceOf(deleting.resourceId).name,
          })}
          description={<p>{t('simulation.config.deleteFlowText')}</p>}
          confirmLabel={t('simulation.config.deleteFlow')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}

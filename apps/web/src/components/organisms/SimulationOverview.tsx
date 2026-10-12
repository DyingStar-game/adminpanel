import { useState } from 'react';
import { PauseIcon, PlayIcon, StepForwardIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Alert } from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  useSimulationDashboard,
  useSimulationNames,
  useSimulationState,
} from '@/hooks/useSimulation';
import { useForceTick, useSimulationRunning } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatAmount } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { formatAutonomy, formatQuantity, formatRate, simulationErrorKey } from '@/lib/simulation';

type Action = 'pause' | 'resume' | 'tick';

interface SimulationOverviewProps {
  /** Opens a village on the network map. */
  onOpenVillage: (id: string) => void;
}

/**
 * The simulation at a glance (ADR 0025): tick state, treasury, orders and missions, then the
 * villages below their threshold (on their stock, all their warehouses summed). Pause, resume
 * and force a tick for `simulation.manage` (`admin`, `supervisor`), each confirmed: they act on
 * the live game.
 */
export function SimulationOverview({ onOpenVillage }: SimulationOverviewProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const dashboard = useSimulationDashboard();
  const settings = useSimulationState();
  const names = useSimulationNames();
  const running = useSimulationRunning();
  const tick = useForceTick();
  const [asked, setAsked] = useState<Action | null>(null);
  const locale = i18n.language;
  const data = dashboard.data;

  if (dashboard.isError) return <ServiceNotice message={t(simulationErrorKey(dashboard.error))} />;
  if (!data) return <p className="text-sm text-fg-3">…</p>;

  const { simulation: state, treasury } = data;
  const amount = (value: number) => formatAmount(value, treasury.currency, locale);
  const refused = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));

  const run = async (action: Action) => {
    setAsked(null);
    try {
      if (action === 'tick') {
        const report = await tick.mutateAsync();
        toast.success(
          t('simulation.controls.ticked', {
            orders: report?.ordersCreated ?? 0,
            legs: report?.legsPublished ?? 0,
          }),
        );
      } else {
        await running.mutateAsync(action);
        toast.success(
          t(action === 'pause' ? 'simulation.controls.paused' : 'simulation.controls.resumed'),
        );
      }
    } catch (error) {
      refused(error);
    }
  };

  const confirmText = {
    pause: ['simulation.controls.pauseTitle', 'simulation.controls.pauseText'],
    resume: ['simulation.controls.resumeTitle', 'simulation.controls.resumeText'],
    tick: ['simulation.controls.tickTitle', 'simulation.controls.tickText'],
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-2">
          {t('simulation.federation', {
            name: data.federation.name,
            planet: data.federation.planetInternalName,
          })}
        </p>
        {can('simulation.manage') && (
          <div className="flex gap-2">
            {state.paused ? (
              <Button variant="outline" size="sm" onClick={() => setAsked('resume')}>
                <PlayIcon aria-hidden />
                {t('simulation.controls.resume')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAsked('pause')}>
                <PauseIcon aria-hidden />
                {t('simulation.controls.pause')}
              </Button>
            )}
            <Button size="sm" onClick={() => setAsked('tick')}>
              <StepForwardIcon aria-hidden />
              {t('simulation.controls.tick')}
            </Button>
          </div>
        )}
      </div>
      <FactTiles
        facts={[
          {
            label: t('simulation.tick.state'),
            value: t(state.paused ? 'simulation.tick.paused' : 'simulation.tick.running'),
            hint: settings.data
              ? t('simulation.tick.every', { count: settings.data.tickSeconds })
              : undefined,
          },
          {
            label: t('simulation.tick.last'),
            value: (
              <span className="text-base">
                {state.lastTickAt
                  ? formatDateTime(state.lastTickAt, locale)
                  : t('simulation.tick.never')}
              </span>
            ),
            hint:
              state.lastTickDurationMs != null
                ? t('simulation.tick.duration', { count: state.lastTickDurationMs })
                : undefined,
          },
          { label: t('simulation.tick.count'), value: formatQuantity(state.tickCount, locale) },
          {
            label: t('simulation.treasury.balance'),
            value:
              treasury.balance != null
                ? amount(treasury.balance)
                : t('simulation.treasury.unknown'),
            hint:
              treasury.balance != null
                ? t('simulation.treasury.floor', { amount: amount(treasury.floor) })
                : t('simulation.treasury.unknownHint'),
          },
          { label: t('simulation.treasury.minted24h'), value: amount(treasury.minted24h) },
          {
            label: t('simulation.treasury.escrowed'),
            value: amount(treasury.escrowed),
            hint: t('simulation.treasury.escrowedHint'),
          },
          { label: t('simulation.openOrders'), value: data.openOrders },
          { label: t('simulation.activeMissions'), value: data.activeMissions },
        ]}
      />
      {state.lastError && (
        <ServiceNotice message={t('simulation.tick.error', { message: state.lastError })} />
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('simulation.alerts')}</h2>
        <DataTable<Alert>
          label={t('simulation.alerts')}
          rows={data.alerts}
          rowKey={(a) => `${a.villageId}-${a.resourceId}`}
          empty={t('simulation.noAlert')}
          onPick={(a) => onOpenVillage(a.villageId)}
          columns={[
            {
              key: 'village',
              header: t('simulation.columns.village'),
              cell: (a) => names.villages.get(a.villageId) ?? a.villageId,
            },
            {
              key: 'resource',
              header: t('simulation.columns.resource'),
              cell: (a) => names.resources.get(a.resourceId)?.name ?? a.resourceId,
            },
            {
              key: 'available',
              header: t('simulation.columns.available'),
              cell: (a) => formatQuantity(a.available, locale),
              className: 'text-right tabular-nums',
            },
            {
              key: 'threshold',
              header: t('simulation.columns.threshold'),
              cell: (a) => formatQuantity(a.minThreshold, locale),
              className: 'text-right tabular-nums',
            },
            {
              key: 'netFlow',
              header: t('simulation.columns.netFlow'),
              cell: (a) => formatRate(a.netFlowPerHour, locale),
              className: 'text-right tabular-nums',
            },
            {
              key: 'autonomy',
              header: t('simulation.columns.autonomy'),
              cell: (a) =>
                a.autonomyHours != null
                  ? formatAutonomy(a.autonomyHours, locale)
                  : t('simulation.none'),
              className: 'text-right tabular-nums',
            },
          ]}
        />
      </section>
      {asked && (
        <WriteConfirm
          open
          title={t(confirmText[asked][0])}
          description={<p>{t(confirmText[asked][1])}</p>}
          confirmLabel={t(`simulation.controls.${asked}`)}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void run(asked)}
          onCancel={() => setAsked(null)}
        />
      )}
    </div>
  );
}

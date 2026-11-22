import { useState, type ChangeEvent } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  ImportReport,
  MineralSource,
  PanelWorldFile,
  TravelRoute,
} from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/useCan';
import {
  useMineralSources,
  useSimulationResources,
  useTravelRoutes,
  useVillages,
} from '@/hooks/useSimulation';
import { useDeleteRoute, useImportWorld } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity, simulationErrorKey } from '@/lib/simulation';
import { formatKm, parseWorldFile, type WorldFileIssue } from '@/lib/simulationWorld';
import { MineralSourceDialog } from './MineralSourceDialog';
import { RouteDialog } from './RouteDialog';

/**
 * The world of the simulation (ADR 0025 › The world): the routes between villages, which the
 * planner walks to order a transport (no route, no order), and the world file the service
 * imports and replays. Reading is for who sees the simulation; writing a route, deleting one and
 * importing a file for `simulation.manage`, each confirmed: they act on the live game.
 */
export function SimulationWorld() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const can = useCan();
  const manage = can('simulation.manage');
  const routes = useTravelRoutes();
  const villages = useVillages();
  const remove = useDeleteRoute();
  const importWorld = useImportWorld();
  const sources = useMineralSources();
  const resources = useSimulationResources();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MineralSource | null>(null);
  const [deleting, setDeleting] = useState<TravelRoute | null>(null);
  const [picked, setPicked] = useState<{ name: string; file: PanelWorldFile } | null>(null);
  const [issue, setIssue] = useState<WorldFileIssue | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const error = routes.error ?? villages.error ?? sources.error;
  if (error) return <ServiceNotice message={t(simulationErrorKey(error))} />;

  const names = villages.data?.items ?? [];
  const resourceOf = (id: string) => {
    const found = resources.data?.items.find((r) => r.id === id);
    return { name: found?.name ?? id.slice(0, 8), unit: found?.unit ?? '' };
  };
  const name = (id: string) => names.find((v) => v.id === id)?.name ?? id.slice(0, 8);
  const rows = [...(routes.data?.items ?? [])].sort((a, b) =>
    `${name(a.fromVillageId)} ${name(a.toVillageId)}`.localeCompare(
      `${name(b.fromVillageId)} ${name(b.toVillageId)}`,
    ),
  );
  const failed = (cause: unknown) =>
    toast.error(cause instanceof ApiError ? cause.message : t('simulation.unavailable'));

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setReport(null);
    if (!file) {
      setPicked(null);
      setIssue(null);
      return;
    }
    const read = parseWorldFile(await file.text());
    setPicked(read.ok ? { name: file.name, file: read.file } : null);
    setIssue(read.ok ? null : read.issue);
  };

  const confirmImport = async () => {
    setConfirmingImport(false);
    if (!picked) return;
    try {
      const done = await importWorld.mutateAsync(picked.file);
      setReport(done);
      toast.success(t('simulation.world.imported', { count: done?.villages ?? 0 }));
    } catch (cause) {
      failed(cause);
    }
  };

  const confirmDelete = async () => {
    const route = deleting;
    setDeleting(null);
    if (!route) return;
    try {
      await remove.mutateAsync(route.id);
      toast.success(t('simulation.world.routeDeleted'));
    } catch (cause) {
      failed(cause);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t('simulation.world.routes')}</h2>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <PlusIcon />
              {t('simulation.world.addRoute')}
            </Button>
          )}
        </div>
        <p className="text-sm text-fg-3">{t('simulation.world.routesLead')}</p>
        <DataTable<TravelRoute>
          label={t('simulation.world.routes')}
          rows={rows}
          rowKey={(route) => route.id}
          empty={routes.data ? t('simulation.world.noRoute') : '…'}
          columns={[
            {
              key: 'from',
              header: t('simulation.world.from'),
              cell: (r) => name(r.fromVillageId),
            },
            { key: 'to', header: t('simulation.world.to'), cell: (r) => name(r.toVillageId) },
            {
              key: 'distance',
              header: t('simulation.world.distance'),
              cell: (r) => t('simulation.world.km', { km: formatKm(r.distanceM, locale) }),
              className: 'text-right tabular-nums',
            },
            {
              key: 'origin',
              header: t('simulation.world.origin'),
              cell: (r) =>
                r.auto === false ? t('simulation.world.written') : t('simulation.world.automatic'),
            },
            ...(manage
              ? [
                  {
                    key: 'actions',
                    header: '',
                    cell: (r: TravelRoute) => (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('simulation.world.deleteRouteOf', {
                          from: name(r.fromVillageId),
                          to: name(r.toVillageId),
                        })}
                        title={t('simulation.world.deleteRoute')}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2Icon />
                      </Button>
                    ),
                    className: 'text-right',
                  },
                ]
              : []),
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('simulation.world.sources')}</h2>
        <p className="text-sm text-fg-3">{t('simulation.world.sourcesLead')}</p>
        <DataTable<MineralSource>
          label={t('simulation.world.sources')}
          rows={[...(sources.data?.items ?? [])].sort((a, b) =>
            name(a.villageId).localeCompare(name(b.villageId)),
          )}
          rowKey={(source) => source.id}
          empty={sources.data ? t('simulation.world.noSource') : '…'}
          columns={[
            {
              key: 'village',
              header: t('simulation.world.village'),
              cell: (m) => name(m.villageId),
            },
            {
              key: 'resource',
              header: t('simulation.world.resource'),
              cell: (m) => resourceOf(m.resourceId).name,
            },
            {
              key: 'max',
              header: t('simulation.world.maxPerMission'),
              cell: (m) =>
                `${formatQuantity(m.maxUnitsPerMission, locale)} ${resourceOf(m.resourceId).unit}`,
              className: 'text-right tabular-nums',
            },
            {
              key: 'remaining',
              header: t('simulation.world.remaining'),
              cell: (m) =>
                m.remainingUnits == null
                  ? t('simulation.world.noEnd')
                  : `${formatQuantity(m.remainingUnits, locale)} ${resourceOf(m.resourceId).unit}`,
              className: 'text-right tabular-nums',
            },
            ...(manage
              ? [
                  {
                    key: 'actions',
                    header: '',
                    cell: (m: MineralSource) => (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('simulation.world.editSourceOf', {
                          village: name(m.villageId),
                          resource: resourceOf(m.resourceId).name,
                        })}
                        title={t('simulation.world.editSource')}
                        onClick={() => setEditing(m)}
                      >
                        <PencilIcon />
                      </Button>
                    ),
                    className: 'text-right',
                  },
                ]
              : []),
          ]}
        />
      </section>

      {manage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('simulation.world.file')}</h2>
          <p className="text-sm text-fg-3">{t('simulation.world.fileLead')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept="application/json,.json"
              aria-label={t('simulation.world.pick')}
              className="w-80"
              onChange={(event) => void pick(event)}
            />
            <Button
              size="sm"
              disabled={!picked || importWorld.isPending}
              onClick={() => setConfirmingImport(true)}
            >
              <UploadIcon />
              {t('simulation.world.import')}
            </Button>
          </div>
          {issue && (
            <p role="alert" className="text-sm text-destructive">
              {t(`simulation.world.issues.${issue}`)}
            </p>
          )}
          {picked && (
            <p className="text-sm text-fg-2">
              {t('simulation.world.picked', {
                file: picked.name,
                federation: picked.file.federation.name,
                planet: picked.file.federation.planetInternalName,
              })}
            </p>
          )}
          {report && (
            <FactTiles
              facts={[
                { label: t('simulation.world.report.villages'), value: String(report.villages) },
                {
                  label: t('simulation.world.report.warehouses'),
                  value: String(report.warehouses),
                },
                {
                  label: t('simulation.world.report.routes'),
                  value: t('simulation.world.report.routesValue', {
                    created: report.routesCreated,
                    removed: report.routesRemoved ?? 0,
                  }),
                },
                {
                  label: t('simulation.world.report.profiles'),
                  value: t('simulation.world.report.profilesValue', {
                    policies: report.policiesCreated,
                    flows: report.flowsCreated,
                  }),
                },
              ]}
            />
          )}
          {report?.villages === 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t('simulation.world.noVillage')}
            </p>
          )}
        </section>
      )}

      {adding && <RouteDialog villages={names} onClose={() => setAdding(false)} />}
      {editing && (
        <MineralSourceDialog
          source={editing}
          village={name(editing.villageId)}
          resource={resourceOf(editing.resourceId)}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <WriteConfirm
          open
          destructive
          title={t('simulation.world.deleteRouteTitle', {
            from: name(deleting.fromVillageId),
            to: name(deleting.toVillageId),
          })}
          description={<p>{t('simulation.world.deleteRouteText')}</p>}
          confirmLabel={t('simulation.world.deleteRoute')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
      {confirmingImport && picked && (
        <WriteConfirm
          open
          title={t('simulation.world.importTitle', { federation: picked.file.federation.name })}
          description={<p>{t('simulation.world.importText')}</p>}
          confirmLabel={t('simulation.world.import')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmImport()}
          onCancel={() => setConfirmingImport(false)}
        />
      )}
    </div>
  );
}

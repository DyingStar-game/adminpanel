import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Pattern } from '@dyingstar-admin/contracts/npc';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable, type Column } from '@/components/molecules/DataTable';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useActivityActions, usePatterns, useScheduleLegend, useTaskKinds } from '@/hooks/useNpcs';
import { formatDateTime } from '@/lib/format';
import { npcErrorKey } from '@/lib/npcs';
import { ActivityActionsEditor } from './ActivityActionsEditor';
import { NpcPatternEditor } from './NpcPatternEditor';
import { ScheduleImportDialog } from './ScheduleImportDialog';

interface NpcRoutinesProps {
  /** The pattern open in the editor (URL state). */
  pattern: string | undefined;
  onPatternChange: (name: string | undefined) => void;
}

/**
 * The NPCs' shift schedules (ADR 0031): the patterns (grids of planetary hours per rota-day),
 * the one picked open in the grid editor (or a new one), the activity → actions mapping, and
 * the import of the service's `schedules.yaml`.
 */
export function NpcRoutines({ pattern, onPatternChange }: NpcRoutinesProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const patterns = usePatterns();
  const legend = useScheduleLegend();
  const mapping = useActivityActions();
  const kinds = useTaskKinds();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const picked = creating ? null : patterns.data?.items.find((p) => p.name === pattern);
  const hours = legend.data?.hoursPerDay ?? 25;

  if (patterns.isError) return <ServiceNotice message={t(npcErrorKey(patterns.error))} />;

  const columns: Column<Pattern>[] = [
    {
      key: 'name',
      header: t('npcs.patterns.name'),
      cell: (p) => <MonoText>{p.name}</MonoText>,
    },
    {
      key: 'description',
      header: t('npcs.patterns.description'),
      cell: (p) => p.description ?? <span className="text-fg-3">{t('npcs.none')}</span>,
    },
    {
      key: 'days',
      header: t('npcs.patterns.days'),
      className: 'text-right tabular-nums',
      cell: (p) => p.days.length,
    },
    {
      key: 'source',
      header: t('npcs.patterns.source'),
      cell: (p) => <Badge variant="outline">{t(`npcs.patterns.sources.${p.source}`)}</Badge>,
    },
    {
      key: 'updated',
      header: t('npcs.patterns.updated'),
      cell: (p) =>
        t('npcs.patterns.updatedBy', {
          date: formatDateTime(p.updatedAt, i18n.language),
          by: p.updatedBy ?? t('npcs.none'),
        }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold">{t('npcs.patterns.title')}</h3>
          {can('npc.manage') && (
            <>
              <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
                {t('npcs.import.open')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setCreating(true);
                  onPatternChange(undefined);
                }}
              >
                {t('npcs.patterns.new')}
              </Button>
            </>
          )}
        </div>
        <DataTable
          label={t('npcs.patterns.title')}
          columns={columns}
          rows={patterns.data?.items ?? []}
          rowKey={(p) => p.name}
          empty={patterns.isPending ? t('npcs.loading') : t('npcs.patterns.empty')}
          onPick={(p) => {
            setCreating(false);
            onPatternChange(p.name === pattern ? undefined : p.name);
          }}
          picked={(p) => !creating && p.name === pattern}
        />
      </div>
      {legend.data && (creating || picked) && (
        <NpcPatternEditor
          // A new editor per pattern: its form starts from that pattern.
          key={creating ? '+new' : picked?.name}
          pattern={picked ?? null}
          letters={legend.data.letters}
          hours={hours}
          onSaved={(name) => {
            setCreating(false);
            onPatternChange(name);
          }}
          onDeleted={() => onPatternChange(undefined)}
        />
      )}
      {mapping.data && kinds.data && (
        <ActivityActionsEditor
          key={JSON.stringify(mapping.data.items)}
          mapping={mapping.data.items}
          actions={kinds.data.actions}
        />
      )}
      {importing && <ScheduleImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

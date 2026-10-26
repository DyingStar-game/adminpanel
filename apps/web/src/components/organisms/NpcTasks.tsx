import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable, type Column } from '@/components/molecules/DataTable';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useCancelNpcTask } from '@/hooks/useNpcActions';
import { useNpcTasks } from '@/hooks/useNpcs';
import { formatDateTime } from '@/lib/format';
import { npcErrorKey, writeError, type NpcTask } from '@/lib/npcs';
import { NpcTaskDialog } from './NpcTaskDialog';

const OPEN: NpcTask['status'][] = ['pending', 'running'];
const STATUS_VARIANT = {
  pending: 'secondary',
  running: 'default',
  done: 'outline',
  failed: 'destructive',
  timeout: 'destructive',
  cancelled: 'outline',
} as const;

/**
 * An NPC's manual tasks (ADR 0031), open ones first: kind, parameters, status (and why it
 * failed), who gave it and when it ran. `npc.manage` gives it a new one or cancels an open one
 * (aborted when running), after confirmation.
 */
export function NpcTasks({ npc }: { npc: { id: string; displayName: string } }) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const tasks = useNpcTasks(npc.id);
  const cancel = useCancelNpcTask();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<NpcTask | null>(null);
  const date = (iso: string | null) => (iso ? formatDateTime(iso, i18n.language) : '—');

  const confirmCancel = async (task: NpcTask) => {
    setCancelling(null);
    try {
      await cancel.mutateAsync({ id: npc.id, taskId: task.id });
      toast.success(t('npcs.tasks.cancelled', { id: String(task.id) }));
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  const columns: Column<NpcTask>[] = [
    {
      key: 'id',
      header: '#',
      className: 'tabular-nums',
      cell: (task) => String(task.id),
    },
    {
      key: 'kind',
      header: t('npcs.tasks.kind'),
      cell: (task) => (
        <span className="flex flex-col gap-0.5">
          {t(`npcs.tasks.kinds.${task.kind}`)}
          <MonoText tone="subtle" className="break-all">
            {JSON.stringify(task.params)}
          </MonoText>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('npcs.tasks.status'),
      cell: (task) => (
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[task.status]}>
              {t(`npcs.tasks.statuses.${task.status}`)}
            </Badge>
            {task.forceOnline && <Badge variant="outline">{t('npcs.tasks.online')}</Badge>}
          </span>
          {task.error && <span className="text-xs text-destructive">{task.error}</span>}
        </span>
      ),
    },
    {
      key: 'created',
      header: t('npcs.tasks.created'),
      cell: (task) => `${date(task.createdAt)} · ${task.createdBy ?? t('npcs.none')}`,
    },
    {
      key: 'ran',
      header: t('npcs.tasks.ran'),
      cell: (task) => `${date(task.startedAt)} → ${date(task.finishedAt)}`,
    },
    ...(can('npc.manage')
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            cell: (task: NpcTask) =>
              OPEN.includes(task.status) && (
                <Button
                  size="xs"
                  variant="destructive"
                  aria-label={t('npcs.tasks.cancelOne', { id: String(task.id) })}
                  onClick={() => setCancelling(task)}
                >
                  {t('npcs.tasks.cancel')}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {can('npc.manage') && (
        <Button size="sm" className="self-start" onClick={() => setCreating(true)}>
          {t('npcs.tasks.new')}
        </Button>
      )}
      {tasks.isError ? (
        <ServiceNotice message={t(npcErrorKey(tasks.error))} />
      ) : (
        <DataTable
          label={t('npcs.tasks.label')}
          columns={columns}
          rows={tasks.data?.items ?? []}
          rowKey={(task) => String(task.id)}
          empty={tasks.isPending ? t('npcs.loading') : t('npcs.tasks.none')}
        />
      )}
      {creating && <NpcTaskDialog npc={npc} onClose={() => setCreating(false)} />}
      {cancelling && (
        <WriteConfirm
          open
          destructive
          title={t('npcs.tasks.cancelTitle', { id: String(cancelling.id) })}
          description={
            <p>
              {t(
                cancelling.status === 'running'
                  ? 'npcs.tasks.cancelRunning'
                  : 'npcs.tasks.cancelText',
              )}
            </p>
          }
          confirmLabel={t('npcs.tasks.cancel')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmCancel(cancelling)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}

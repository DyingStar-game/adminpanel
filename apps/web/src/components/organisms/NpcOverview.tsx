import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { NpcLiveBadge } from '@/components/molecules/NpcLiveBadge';
import { TypedConfirmDialog } from '@/components/molecules/TypedConfirmDialog';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  useDeleteNpc,
  useNpcToggle,
  useReassignNpc,
  useResetNpcCredentials,
} from '@/hooks/useNpcActions';
import { formatDateTime } from '@/lib/format';
import { actionName, isManualAction, liveState, writeError, type NpcDetail } from '@/lib/npcs';

interface NpcOverviewProps {
  detail: NpcDetail;
  /** After its deletion: back to the roster. */
  onDeleted: () => void;
}

type Confirming = 'reassign' | 'reset' | 'delete' | null;

/**
 * An NPC at a glance (ADR 0026): where it is on the servers, its FSM status and current action,
 * its role, village, slot and workplace, its Keycloak account, its dates. `npc.manage` spawns
 * or despawns it, sends it back to the automatic assignment, resets its password (both
 * confirmed) or deletes it (typed confirmation).
 */
export function NpcOverview({ detail, onDeleted }: NpcOverviewProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const toggle = useNpcToggle();
  const reassign = useReassignNpc();
  const reset = useResetNpcCredentials();
  const remove = useDeleteNpc();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const { npc, workplace, state } = detail;
  const live = liveState(npc.live);
  const date = (iso: string | null) => (iso ? formatDateTime(iso, i18n.language) : t('npcs.never'));
  const none = <span className="text-fg-3">{t('npcs.none')}</span>;

  const act = async (run: () => Promise<unknown>, done: string) => {
    setConfirming(null);
    try {
      await run();
      toast.success(done);
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };
  const deleteNpc = async () => {
    try {
      await remove.mutateAsync(npc.id);
      toast.success(t('npcs.detail.deleted', { name: npc.displayName }));
      onDeleted();
    } catch (error) {
      setConfirming(null);
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  const action = npc.live.currentAction;
  const facts: [string, ReactNode][] = [
    [
      t('npcs.fields.live'),
      <NpcLiveBadge key="live" state={live} label={t(`npcs.live.${live}`)} />,
    ],
    [
      t('npcs.detail.status'),
      (npc.live.status ?? state?.state?.status) ? (
        <MonoText>{npc.live.status ?? state?.state?.status}</MonoText>
      ) : (
        none
      ),
    ],
    [
      t('npcs.fields.currentAction'),
      action ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <MonoText>{actionName(action.name)}</MonoText>
          <Badge variant={isManualAction(action.name) ? 'default' : 'outline'}>
            {t(`npcs.detail.sources.${action.source}`)}
          </Badge>
          {action.taskId !== null && (
            <span className="text-xs text-fg-3">
              {t('npcs.detail.task', { id: String(action.taskId) })}
            </span>
          )}
          <span className="text-xs text-fg-3">
            {t('npcs.detail.since', { date: date(action.startedAt) })}
          </span>
        </span>
      ) : (
        none
      ),
    ],
    [
      t('npcs.fields.role'),
      <span key="role" className="flex items-center gap-1.5">
        {t(`npcs.roles.${npc.role}`)}
        {npc.roleLocked && <Badge variant="outline">{t('npcs.detail.locked')}</Badge>}
      </span>,
    ],
    [t('npcs.fields.village'), npc.villageCode ?? none],
    [t('npcs.fields.storekeeperSlot'), npc.storekeeperSlot ?? none],
    [
      t('npcs.villages.workplace'),
      workplace ? (
        <span className="flex items-center gap-1.5">
          <MonoText>{workplace.warehouseCode ?? workplace.warehouseId}</MonoText>
          <Badge variant="outline">{t(`npcs.villages.sources.${workplace.source}`)}</Badge>
        </span>
      ) : (
        none
      ),
    ],
    [t('npcs.fields.login'), <MonoText key="login">{npc.login}</MonoText>],
    [
      t('npcs.detail.keycloak'),
      npc.kcState === 'ready' ? (
        t('npcs.detail.kcReady')
      ) : (
        <span className="text-destructive">
          {t('npcs.detail.kcError', { error: npc.kcError ?? t('npcs.none') })}
        </span>
      ),
    ],
    [t('npcs.detail.runningSince'), date(npc.live.runningSince)],
    [t('npcs.fields.lastSeen'), date(npc.lastSeenAt)],
    [t('npcs.detail.firstSpawn'), date(npc.firstSpawnAt)],
    [
      t('npcs.detail.created'),
      t('npcs.detail.createdBy', {
        date: date(npc.createdAt),
        by: npc.createdBy ?? t('npcs.none'),
      }),
    ],
    [t('npcs.detail.updated'), date(npc.updatedAt)],
    [
      t('npcs.detail.position'),
      state?.position ? (
        <MonoText>
          {[state.position.x, state.position.y, state.position.z]
            .map((v) => v.toFixed(2))
            .join(', ')}
        </MonoText>
      ) : (
        none
      ),
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      {can('npc.manage') && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={toggle.isPending}
            onClick={() =>
              void act(
                () => toggle.mutateAsync({ id: npc.id, action: npc.enabled ? 'despawn' : 'spawn' }),
                t(npc.enabled ? 'npcs.roster.despawned' : 'npcs.roster.spawned', {
                  name: npc.displayName,
                }),
              )
            }
          >
            {t(npc.enabled ? 'npcs.actions.despawn' : 'npcs.actions.spawn')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming('reassign')}>
            {t('npcs.actions.reassign')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming('reset')}>
            {t('npcs.actions.resetCredentials')}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirming('delete')}>
            {t('npcs.actions.delete')}
          </Button>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-2xs tracking-wider text-fg-3 uppercase">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {confirming === 'reassign' && (
        <WriteConfirm
          open
          title={t('npcs.detail.reassignTitle', { name: npc.displayName })}
          description={<p>{t('npcs.detail.reassignText')}</p>}
          confirmLabel={t('npcs.actions.reassign')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() =>
            void act(() => reassign.mutateAsync(npc.id), t('npcs.detail.reassigned'))
          }
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'reset' && (
        <WriteConfirm
          open
          title={t('npcs.detail.resetTitle', { name: npc.displayName })}
          description={<p>{t('npcs.detail.resetText')}</p>}
          confirmLabel={t('npcs.actions.resetCredentials')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void act(() => reset.mutateAsync(npc.id), t('npcs.detail.reset'))}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'delete' && (
        <TypedConfirmDialog
          title={t('npcs.detail.deleteTitle', { name: npc.displayName })}
          description={<p>{t('npcs.detail.deleteText')}</p>}
          word={t('npcs.remove.word')}
          prompt={t('npcs.remove.typePrompt', { word: t('npcs.remove.word') })}
          confirmLabel={t('npcs.actions.delete')}
          cancelLabel={t('confirm.cancel')}
          pending={remove.isPending}
          onConfirm={() => void deleteNpc()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

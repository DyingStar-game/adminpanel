import { useTranslation } from 'react-i18next';
import type { MissionAssignment } from '@dyingstar-admin/contracts/mission';
import { DataTable } from '@/components/molecules/DataTable';
import { MissionReward } from '@/components/molecules/MissionReward';
import { Badge } from '@/components/ui/badge';
import { formatBps } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { EntityLink } from '@/components/molecules/EntityLink';

interface MissionAssignmentsTableProps {
  assignments: MissionAssignment[];
  /** Display names `social` gave, by player id. */
  players: Record<string, string>;
  /** Opens a player's sheet; unset, players are not links (the account may not see them). */
  onOpenPlayer?: ((id: string) => void) | undefined;
}

/**
 * Who took a mission, whatever the outcome: players and NPCs, their deadline, what they handed
 * in (in basis points of the required objectives) and the share they were paid.
 */
export function MissionAssignmentsTable({
  assignments,
  players,
  onOpenPlayer,
}: MissionAssignmentsTableProps) {
  const { t, i18n } = useTranslation();
  const date = (iso: string | null) =>
    iso ? formatDateTime(iso, i18n.language) : <span className="text-fg-3">—</span>;
  const assignee = (a: MissionAssignment) => {
    const name = players[a.playerId];
    if (a.holderType === 'npc') {
      return (
        <span className="flex items-center gap-2">
          <Badge variant="outline">{t('missions.detail.npc')}</Badge>
          <EntityLink id={a.playerId} label={name} />
        </span>
      );
    }
    return <EntityLink id={a.playerId} label={name} onOpen={onOpenPlayer} />;
  };

  return (
    <DataTable<MissionAssignment>
      label={t('missions.detail.assignments')}
      rows={assignments}
      rowKey={(a) => a.id}
      empty={t('moderation.none')}
      columns={[
        { key: 'assignee', header: t('missions.assignmentColumns.assignee'), cell: assignee },
        {
          key: 'status',
          header: t('missions.assignmentColumns.status'),
          cell: (a) => (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`missions.assignmentStatus.${a.status}`)}</Badge>
              {a.status === 'partially_completed' && (
                <span className="text-xs text-fg-3 tabular-nums">
                  {formatBps(a.completionRatio, i18n.language)}
                </span>
              )}
            </span>
          ),
        },
        {
          key: 'accepted',
          header: t('missions.assignmentColumns.accepted'),
          cell: (a) => date(a.acceptedAt),
          className: 'whitespace-nowrap',
        },
        {
          key: 'deadline',
          header: t('missions.assignmentColumns.deadline'),
          cell: (a) => date(a.deadlineAt),
          className: 'whitespace-nowrap',
        },
        {
          key: 'handedIn',
          header: t('missions.assignmentColumns.handedIn'),
          cell: (a) => date(a.completedAt),
          className: 'whitespace-nowrap',
        },
        {
          key: 'share',
          header: t('missions.assignmentColumns.share'),
          cell: (a) => <MissionReward rewards={a.rewardShares} compact />,
        },
        {
          key: 'paid',
          header: t('missions.assignmentColumns.paid'),
          cell: (a) =>
            a.rewardShares === null ? (
              <span className="text-fg-3">—</span>
            ) : a.rewardSettled ? (
              t('missions.detail.paid')
            ) : (
              <span className="text-fg-3">{t('missions.detail.unpaid')}</span>
            ),
        },
      ]}
    />
  );
}

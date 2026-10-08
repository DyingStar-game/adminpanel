import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import type { OrganisationMember } from '@/lib/organisations';

interface OrganisationMembersTableProps {
  members: OrganisationMember[];
  /** Header of the role column: rank or office. */
  roleHeader: string;
  onOpenPlayer: (id: string) => void;
  /** Management actions on a member (step N); no column without it. */
  actions?: ((member: OrganisationMember) => ReactNode) | undefined;
}

/** An organisation's members, highest rank or office first, each opening their sheet. */
export function OrganisationMembersTable({
  members,
  roleHeader,
  onOpenPlayer,
  actions,
}: OrganisationMembersTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<OrganisationMember>
      label={t('organisations.members')}
      rows={members}
      rowKey={(m) => m.playerId}
      empty={t('moderation.none')}
      onPick={(m) => onOpenPlayer(m.playerId)}
      columns={[
        { key: 'name', header: t('players.columns.name'), cell: (m) => m.displayName },
        {
          key: 'role',
          header: roleHeader,
          cell: (m) => (m.head ? <Badge variant="outline">{m.role}</Badge> : m.role),
        },
        {
          key: 'status',
          header: t('moderation.columns.status'),
          cell: (m) => t(`moderation.player.status.${m.status}`),
        },
        {
          key: 'joined',
          header: t('organisations.columns.joined'),
          cell: (m) => formatDateTime(m.joinedAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        ...(actions
          ? [
              {
                key: 'actions',
                header: t('moderation.columns.actions'),
                cell: (m: OrganisationMember) => actions(m) ?? <span className="text-fg-3">—</span>,
                className: 'text-right',
              },
            ]
          : []),
      ]}
    />
  );
}

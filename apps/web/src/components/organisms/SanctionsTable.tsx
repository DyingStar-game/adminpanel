import { useTranslation } from 'react-i18next';
import type { Sanction } from '@dyingstar-admin/contracts/social';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, shortId } from '@/lib/format';

interface SanctionsTableProps {
  sanctions: Sanction[];
  /** Hidden on a player's own sheet. */
  showPlayer?: boolean;
  onOpenPlayer: (id: string) => void;
}

/** Sanctions of `social`: type, reason, who issued it, expiry, lifting. */
export function SanctionsTable({
  sanctions,
  showPlayer = true,
  onOpenPlayer,
}: SanctionsTableProps) {
  const { t, i18n } = useTranslation();
  const date = (iso: string | null) => (iso ? formatDateTime(iso, i18n.language) : '—');
  return (
    <DataTable<Sanction>
      label={t('moderation.tabs.sanctions')}
      rows={sanctions}
      rowKey={(s) => s.id}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (s) => date(s.createdAt),
          className: 'whitespace-nowrap',
        },
        ...(showPlayer
          ? [
              {
                key: 'player',
                header: t('moderation.columns.player'),
                cell: (s: Sanction) => (
                  <Chip variant="link" title={s.playerId} onClick={() => onOpenPlayer(s.playerId)}>
                    <MonoText>{shortId(s.playerId)}</MonoText>
                  </Chip>
                ),
              },
            ]
          : []),
        {
          key: 'type',
          header: t('moderation.columns.type'),
          cell: (s) => (
            <Badge
              variant={s.type === 'ban' || s.type === 'suspension' ? 'destructive' : 'outline'}
            >
              {t(`moderation.sanctionType.${s.type}`)}
            </Badge>
          ),
        },
        {
          key: 'reason',
          header: t('moderation.columns.reason'),
          cell: (s) => (
            <>
              {s.reason}
              {s.automatic && (
                <span className="ml-1 text-xs text-fg-3">({t('moderation.automatic')})</span>
              )}
            </>
          ),
        },
        {
          key: 'expires',
          header: t('moderation.columns.expires'),
          cell: (s) => date(s.expiresAt),
          className: 'whitespace-nowrap',
        },
        {
          key: 'revoked',
          header: t('moderation.columns.revoked'),
          cell: (s) => date(s.revokedAt),
          className: 'whitespace-nowrap',
        },
      ]}
    />
  );
}

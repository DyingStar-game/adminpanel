import { useTranslation } from 'react-i18next';
import type { Sanction } from '@dyingstar-admin/contracts/social';
import { formatDateTime } from '@/lib/format';

/** The sanctions in force on a player, most severe first, as the sheet's first line. */
export function SanctionBanner({ sanctions }: { sanctions: Sanction[] }) {
  const { t, i18n } = useTranslation();
  if (sanctions.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
    >
      {sanctions.map((sanction) => (
        <p key={sanction.id}>
          <span className="font-semibold">{t(`moderation.sanctionType.${sanction.type}`)}</span>{' '}
          {sanction.expiresAt
            ? t('moderation.player.until', {
                date: formatDateTime(sanction.expiresAt, i18n.language),
              })
            : t('moderation.player.permanent')}{' '}
          — {sanction.reason}
        </p>
      ))}
    </div>
  );
}

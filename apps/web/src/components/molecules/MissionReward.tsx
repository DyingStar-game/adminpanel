import { useTranslation } from 'react-i18next';
import type { MissionAsServed } from '@dyingstar-admin/contracts/mission';
import { MonoText } from '@/components/atoms/MonoText';
import { formatAmount } from '@/lib/economy';

interface MissionRewardProps {
  rewards: MissionAsServed['rewards'];
  /** In a table: the credits and a count of the other components. */
  compact?: boolean;
}

/**
 * What a mission pays: its credits, each item with its quantity (`mission`'s goods ids), then the
 * standing it grants in a domain (held by `social`).
 */
export function MissionReward({ rewards, compact = false }: MissionRewardProps) {
  const { t, i18n } = useTranslation();
  const credits = rewards?.find((r) => r.type === 'credits') ?? null;
  const items = (rewards ?? []).filter((r) => r.type === 'item');
  const standings = (rewards ?? []).filter((r) => r.type === 'standing');
  if (!credits && items.length === 0 && standings.length === 0) {
    return <span className="text-fg-3">—</span>;
  }
  const amount = credits && formatAmount(credits.amount, credits.currency, i18n.language);
  if (compact) {
    const others = [
      ...(items.length > 0 ? [t('missions.items', { count: items.length })] : []),
      ...(standings.length > 0 ? [t('missions.standings', { count: standings.length })] : []),
    ];
    return (
      <span className="whitespace-nowrap">
        {amount}
        {others.length > 0 && (
          <span className="text-fg-3">
            {amount && ' + '}
            {others.join(' + ')}
          </span>
        )}
      </span>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {amount && <li>{amount}</li>}
      {items.map((item) => (
        <li key={item.itemId} className="flex items-center gap-2">
          <span className="tabular-nums">{item.quantity} ×</span>
          <MonoText>{item.itemId}</MonoText>
          {item.instanceId && <span className="text-xs text-fg-3">{t('missions.unique')}</span>}
        </li>
      ))}
      {standings.map((standing) => (
        <li key={standing.domain}>
          {t('missions.standingIn', {
            amount: new Intl.NumberFormat(i18n.language, { signDisplay: 'always' }).format(
              standing.amount,
            ),
            domain: t(`missions.categories.${standing.domain}`),
          })}
        </li>
      ))}
    </ul>
  );
}

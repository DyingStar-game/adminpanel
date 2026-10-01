import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';

/**
 * Time of the last successful refresh. Persistence reflects the game's last save, not the
 * instant game state (ADR 0009): the tooltip says so.
 */
export function UpdatedAt({ at }: { at: number }) {
  const { t, i18n } = useTranslation();
  if (!at) return null;
  return (
    <MonoText tone="subtle" className="text-[10.5px]" title={t('live.freshness')}>
      {t('live.updated', { time: new Date(at).toLocaleTimeString(i18n.language) })}
    </MonoText>
  );
}

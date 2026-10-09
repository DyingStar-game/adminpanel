import { useTranslation } from 'react-i18next';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { EconomyDashboard } from '@/components/organisms/EconomyDashboard';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { ECONOMY_PERIODS, type EconomySearch } from '@/lib/economySearch';

interface EconomyPageProps {
  search: EconomySearch;
  onSearchChange: (next: EconomySearch) => void;
  onOpenPlayer: (id: string) => void;
  onOpenCorporation: (id: string) => void;
}

/** `economie`'s dashboard over a period (ADR 0024 step O). */
export function EconomyPage({
  search,
  onSearchChange,
  onOpenPlayer,
  onOpenCorporation,
}: EconomyPageProps) {
  const { t } = useTranslation();
  return (
    <ServicePageLayout
      title={t('economy.title')}
      meta={<p className="text-sm text-fg-3">{t('economy.lead')}</p>}
      actions={
        <OptionSelect<string>
          label={t('economy.period')}
          value={String(search.days)}
          options={ECONOMY_PERIODS.map((d) => ({
            value: String(d),
            label: t('economy.lastDays', { count: d }),
          }))}
          onChange={(v) => onSearchChange({ days: Number(v) })}
          className="w-44"
        />
      }
    >
      <EconomyDashboard
        days={search.days}
        onOpenPlayer={onOpenPlayer}
        onOpenCorporation={onOpenCorporation}
      />
    </ServicePageLayout>
  );
}

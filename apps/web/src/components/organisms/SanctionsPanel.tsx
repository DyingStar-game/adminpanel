import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSanctions } from '@/hooks/useModeration';
import { MODERATION_PAGE_SIZE, type ModerationSearch } from '@/lib/moderationSearch';
import { moderationErrorKey } from './moderationLabels';
import { SanctionsTable } from './SanctionsTable';

interface SanctionsPanelProps {
  search: ModerationSearch;
  onSearchChange: (next: ModerationSearch) => void;
  onOpenPlayer: (id: string) => void;
}

/** Active sanctions, or every sanction (ADR 0024, reading). */
export function SanctionsPanel({ search, onSearchChange, onOpenPlayer }: SanctionsPanelProps) {
  const { t } = useTranslation();
  const sanctions = useSanctions({ ended: search.ended }, search.page);

  if (sanctions.isError) return <ServiceNotice message={t(moderationErrorKey(sanctions.error))} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="sanctions-ended"
          checked={search.ended}
          onCheckedChange={(ended) => onSearchChange({ ...search, ended, page: 1 })}
        />
        <Label htmlFor="sanctions-ended" className="text-sm">
          {t('moderation.filters.ended')}
        </Label>
      </div>
      <SanctionsTable sanctions={sanctions.data?.items ?? []} onOpenPlayer={onOpenPlayer} />
      {sanctions.data && (
        <Pagination
          page={search.page}
          pageSize={MODERATION_PAGE_SIZE}
          total={sanctions.data.total}
          onPageChange={(page) => onSearchChange({ ...search, page })}
        />
      )}
    </div>
  );
}

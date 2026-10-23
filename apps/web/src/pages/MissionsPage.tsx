import { useTranslation } from 'react-i18next';
import type { MissionKind, MissionStatus } from '@dyingstar-admin/contracts/mission';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { MissionsTable } from '@/components/organisms/MissionsTable';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { useMissions } from '@/hooks/useMissions';
import { missionErrorKey } from '@/lib/missionErrors';
import { MISSION_CATEGORIES, MISSIONS_PAGE_SIZE, type MissionsSearch } from '@/lib/missionsSearch';

const ALL = 'all';
const STATUSES: MissionStatus[] = ['available', 'active', 'completed', 'cancelled', 'expired'];
const KINDS: MissionKind[] = ['dynamic', 'scenario', 'player'];

const ALL_LABELS = {
  status: 'missions.allStatuses',
  category: 'missions.allCategories',
  kind: 'missions.allKinds',
} as const;

interface MissionsPageProps {
  search: MissionsSearch;
  onSearchChange: (next: MissionsSearch) => void;
  onOpenMission: (id: string) => void;
}

/** `mission`'s whole catalogue, every status, filtered and paged (ADR 0024 step O). */
export function MissionsPage({ search, onSearchChange, onOpenMission }: MissionsPageProps) {
  const { t } = useTranslation();
  const missions = useMissions(search);
  /** A filter's select: "all" clears it, any change goes back to the first page. */
  const filter = (
    key: 'status' | 'category' | 'kind',
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <OptionSelect<string>
      label={label}
      value={search[key] ?? ALL}
      options={[{ value: ALL, label: t(ALL_LABELS[key]) }, ...options]}
      onChange={(v) => onSearchChange({ ...search, [key]: v === ALL ? undefined : v, page: 1 })}
      className="w-44"
    />
  );

  return (
    <ServicePageLayout
      title={t('missions.title')}
      meta={<p className="text-sm text-fg-3">{t('missions.lead')}</p>}
    >
      <div className="flex flex-wrap items-center gap-3">
        {filter(
          'status',
          t('missions.columns.status'),
          STATUSES.map((v) => ({ value: v, label: t(`missions.status.${v}`) })),
        )}
        {filter(
          'category',
          t('missions.columns.category'),
          MISSION_CATEGORIES.map((v) => ({ value: v, label: t(`missions.categories.${v}`) })),
        )}
        {filter(
          'kind',
          t('missions.columns.kind'),
          KINDS.map((v) => ({ value: v, label: t(`missions.kinds.${v}`) })),
        )}
      </div>
      {missions.isError ? (
        <ServiceNotice message={t(missionErrorKey(missions.error))} />
      ) : (
        <div className="flex flex-col gap-4">
          <MissionsTable missions={missions.data?.missions ?? []} onOpen={onOpenMission} />
          {missions.data && (
            <Pagination
              page={search.page}
              pageSize={MISSIONS_PAGE_SIZE}
              total={missions.data.total}
              onPageChange={(page) => onSearchChange({ ...search, page })}
            />
          )}
        </div>
      )}
    </ServicePageLayout>
  );
}

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DISCOVERIES_PAGE_SIZE, type DiscoveryRow } from '@dyingstar-admin/schemas';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { DiscoveriesTable } from '@/components/organisms/DiscoveriesTable';
import { PlaceNameDecisionDialog } from '@/components/organisms/PlaceNameDecisionDialog';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { useCan } from '@/hooks/useCan';
import { useDiscoveries } from '@/hooks/useDiscoveries';
import { usePanel } from '@/hooks/usePanel';
import { useRefResolver } from '@/hooks/useRefResolver';
import { ApiError } from '@/lib/api';
import type { PlaceNameDecision } from '@/lib/discoveries';
import { PLACE_NAME_STATUSES, type PlaceNamesSearch } from '@/lib/placeNamesSearch';

const ALL = 'all';

interface PlaceNamesPageProps {
  search: PlaceNamesSearch;
  onSearchChange: (next: PlaceNamesSearch) => void;
  onOpenPlayer: (id: string) => void;
  /** Opens a persistence item's page (the place). */
  onOpenItem: (uuid: string) => void;
}

/**
 * Exploration › Names to review (ADR 0032): the names players proposed for the places they
 * discovered, every kind of place, approved or refused here, and the decided ones.
 */
export function PlaceNamesPage({
  search,
  onSearchChange,
  onOpenPlayer,
  onOpenItem,
}: PlaceNamesPageProps) {
  const { t } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  const discoveries = useDiscoveries(search);
  const rows = useMemo(() => discoveries.data?.discoveries ?? [], [discoveries.data]);
  const places = useMemo(
    () =>
      rows.map((d) => d.object_data.place_uuid || d.object_data.parent_id || '').filter(Boolean),
    [rows],
  );
  const resolvePlace = useRefResolver(places);
  const [deciding, setDeciding] = useState<{
    discovery: DiscoveryRow;
    decision: PlaceNameDecision;
  } | null>(null);
  // Deciding writes persistence and tells the discoverer (the BFF checks both).
  const decides = can('persistence.write') && can('social.notify');
  // Players have their sheet for who may read `social` (as the sidebar).
  const readsPlayers = services.includes('social') && can('social.moderate');
  // The kinds met, and the one filtered on even when none is left.
  const kinds = [
    ...new Set([...(discoveries.data?.kinds ?? []), ...(search.kind ? [search.kind] : [])]),
  ];
  const kindLabel = (kind: string) =>
    t(`exploration.names.kinds.${kind}` as never, { defaultValue: kind });

  return (
    <ServicePageLayout
      title={t('exploration.names.title')}
      meta={<p className="text-sm text-fg-3">{t('exploration.names.lead')}</p>}
    >
      <div className="flex flex-wrap items-center gap-3">
        <OptionSelect<string>
          label={t('exploration.names.statusFilter')}
          value={search.status}
          options={PLACE_NAME_STATUSES.map((v) => ({
            value: v,
            label: t(`exploration.names.status.${v}`),
          }))}
          onChange={(v) =>
            onSearchChange({ ...search, status: v as PlaceNamesSearch['status'], page: 1 })
          }
          className="w-44"
        />
        <OptionSelect<string>
          label={t('exploration.names.kindFilter')}
          value={search.kind ?? ALL}
          options={[
            { value: ALL, label: t('exploration.names.allKinds') },
            ...kinds.map((v) => ({ value: v, label: kindLabel(v) })),
          ]}
          onChange={(v) => onSearchChange({ ...search, kind: v === ALL ? undefined : v, page: 1 })}
          className="w-52"
        />
      </div>
      {discoveries.isError ? (
        <ServiceNotice
          message={t(
            discoveries.error instanceof ApiError && discoveries.error.status === 403
              ? 'session.noReadRight'
              : 'exploration.names.unavailable',
          )}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <DiscoveriesTable
            discoveries={rows}
            resolvePlace={resolvePlace}
            onOpenPlace={onOpenItem}
            onOpenPlayer={readsPlayers ? onOpenPlayer : undefined}
            onDecide={
              decides ? (discovery, decision) => setDeciding({ discovery, decision }) : undefined
            }
          />
          {discoveries.data && (
            <Pagination
              page={search.page}
              pageSize={DISCOVERIES_PAGE_SIZE}
              total={discoveries.data.total}
              onPageChange={(page) => onSearchChange({ ...search, page })}
            />
          )}
        </div>
      )}
      {deciding && (
        <PlaceNameDecisionDialog
          // A new dialog for each discovery: the form starts from its proposal.
          key={`${deciding.discovery.uuid}:${deciding.decision}`}
          discovery={deciding.discovery}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      )}
    </ServicePageLayout>
  );
}

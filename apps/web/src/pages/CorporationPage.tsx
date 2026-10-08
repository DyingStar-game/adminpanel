import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { FactTiles } from '@/components/molecules/FactTiles';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { CorporationsTable } from '@/components/organisms/CorporationsTable';
import { OrganisationMembersTable } from '@/components/organisms/OrganisationMembersTable';
import { OrganisationRolesTable } from '@/components/organisms/OrganisationRolesTable';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCorporation,
  useCorporationMembers,
  usePoliticalEntity,
  useSubsidiaries,
} from '@/hooks/useOrganisations';
import { ApiError } from '@/lib/api';
import { formatDateTime, shortId } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { corporationMembers, organisationRoles } from '@/lib/organisations';
import type { OrganisationSearch } from '@/lib/organisationsSearch';

interface CorporationPageProps {
  corporationId: string;
  search: OrganisationSearch;
  onSearchChange: (next: OrganisationSearch) => void;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenCorporation: (id: string) => void;
  onOpenPoliticalEntity: (id: string) => void;
}

/**
 * A corporation, read only (ADR 0024 step 2): its CEO, holding and political home, ranks,
 * members and subsidiaries. Its journal is for its members only: `social` refuses it to staff.
 */
export function CorporationPage({
  corporationId,
  search,
  onSearchChange,
  onBack,
  onOpenPlayer,
  onOpenCorporation,
  onOpenPoliticalEntity,
}: CorporationPageProps) {
  const { t, i18n } = useTranslation();
  const corporation = useCorporation(corporationId);
  const members = useCorporationMembers(corporationId, search.members);
  const subsidiaries = useSubsidiaries(corporationId, search.children);
  const home = usePoliticalEntity(corporation.data?.politicalEntityId ?? null);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeftIcon />
      {t('organisations.back')}
    </Button>
  );
  if (corporation.isError) {
    const missing = corporation.error instanceof ApiError && corporation.error.status === 404;
    return (
      <ServicePageLayout title={t('organisations.corporation')} actions={back}>
        <ServiceNotice
          message={
            missing
              ? t('organisations.notFound', { id: corporationId })
              : t(moderationErrorKey(corporation.error))
          }
        />
      </ServicePageLayout>
    );
  }
  const c = corporation.data;
  if (!c) return null;
  const ceo = c.members.find((m) => m.playerId === c.ceoId);

  return (
    <ServicePageLayout
      title={c.name}
      actions={back}
      meta={
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
          <Badge variant="outline">{t('organisations.corporation')}</Badge>
          <MonoText>{c.ticker}</MonoText>
          <Badge variant="outline">{t(`organisations.recruitment.${c.recruitment}`)}</Badge>
          {t('organisations.created', { date: formatDateTime(c.createdAt, i18n.language) })}
        </div>
      }
    >
      {c.description && <p className="text-sm whitespace-pre-wrap">{c.description}</p>}
      <FactTiles
        facts={[
          { label: t('organisations.columns.members'), value: c.memberCount },
          { label: t('organisations.subsidiaries'), value: c.subsidiaryCount },
          {
            label: t('organisations.ceo'),
            value: (
              <Chip variant="link" title={c.ceoId} onClick={() => onOpenPlayer(c.ceoId)}>
                {ceo?.displayName ?? shortId(c.ceoId)}
              </Chip>
            ),
          },
          {
            label: t('organisations.holding'),
            value: c.parent ? (
              <Chip variant="link" onClick={() => onOpenCorporation(c.parent?.id ?? '')}>
                {c.parent.name}
              </Chip>
            ) : (
              <span className="text-fg-3">—</span>
            ),
          },
        ]}
      />
      {c.politicalEntityId && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {t('organisations.politicalHome')}
          <Chip variant="link" onClick={() => onOpenPoliticalEntity(c.politicalEntityId ?? '')}>
            {home.data?.name ?? shortId(c.politicalEntityId)}
          </Chip>
        </p>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.ranks')}</h2>
        <OrganisationRolesTable
          roles={organisationRoles(c.ranks)}
          label={t('organisations.ranks')}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.members')}</h2>
        <OrganisationMembersTable
          members={corporationMembers(members.data?.items ?? [])}
          roleHeader={t('organisations.columns.rank')}
          onOpenPlayer={onOpenPlayer}
        />
        {members.data && (
          <Pagination
            page={search.members}
            pageSize={MODERATION_PAGE_SIZE}
            total={members.data.total}
            onPageChange={(page) => onSearchChange({ ...search, members: page })}
          />
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.subsidiaries')}</h2>
        <CorporationsTable
          corporations={subsidiaries.data?.items ?? []}
          label={t('organisations.subsidiaries')}
          onOpen={onOpenCorporation}
        />
        {subsidiaries.data && (
          <Pagination
            page={search.children}
            pageSize={MODERATION_PAGE_SIZE}
            total={subsidiaries.data.total}
            onPageChange={(page) => onSearchChange({ ...search, children: page })}
          />
        )}
      </section>
    </ServicePageLayout>
  );
}

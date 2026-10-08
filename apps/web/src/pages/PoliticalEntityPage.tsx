import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import { Chip } from '@/components/atoms/Chip';
import { FactTiles } from '@/components/molecules/FactTiles';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { OrganisationMembersTable } from '@/components/organisms/OrganisationMembersTable';
import { OrganisationRolesTable } from '@/components/organisms/OrganisationRolesTable';
import { PoliticalEntitiesTable } from '@/components/organisms/PoliticalEntitiesTable';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  usePoliticalChildren,
  usePoliticalEntity,
  usePoliticalMembers,
} from '@/hooks/useOrganisations';
import { ApiError } from '@/lib/api';
import { formatDateTime, shortId } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { organisationRoles, politicalMembers } from '@/lib/organisations';
import type { OrganisationSearch } from '@/lib/organisationsSearch';

interface PoliticalEntityPageProps {
  entityId: string;
  search: OrganisationSearch;
  onSearchChange: (next: OrganisationSearch) => void;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenPoliticalEntity: (id: string) => void;
}

/**
 * A political entity, read only (ADR 0024 step 2): its head and higher level, offices, members
 * and lower levels. Its journal is for its members only: `social` refuses it to staff.
 */
export function PoliticalEntityPage({
  entityId,
  search,
  onSearchChange,
  onBack,
  onOpenPlayer,
  onOpenPoliticalEntity,
}: PoliticalEntityPageProps) {
  const { t, i18n } = useTranslation();
  const entity = usePoliticalEntity(entityId);
  const members = usePoliticalMembers(entityId, search.members);
  const children = usePoliticalChildren(entityId, search.children);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeftIcon />
      {t('organisations.back')}
    </Button>
  );
  if (entity.isError) {
    const missing = entity.error instanceof ApiError && entity.error.status === 404;
    return (
      <ServicePageLayout title={t('organisations.politicalEntity')} actions={back}>
        <ServiceNotice
          message={
            missing
              ? t('organisations.notFound', { id: entityId })
              : t(moderationErrorKey(entity.error))
          }
        />
      </ServicePageLayout>
    );
  }
  const e = entity.data;
  if (!e) return null;
  const head = e.members.find((m) => m.playerId === e.headId);

  return (
    <ServicePageLayout
      title={e.name}
      actions={back}
      meta={
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
          <Badge variant="outline">{t(`moderation.player.political.${e.type}`)}</Badge>
          {t('organisations.created', { date: formatDateTime(e.createdAt, i18n.language) })}
        </div>
      }
    >
      {e.description && <p className="text-sm whitespace-pre-wrap">{e.description}</p>}
      <FactTiles
        facts={[
          { label: t('organisations.columns.members'), value: e.memberCount },
          { label: t('organisations.children'), value: e.childCount },
          {
            label: t('organisations.head'),
            value: e.headId ? (
              <Chip variant="link" title={e.headId} onClick={() => onOpenPlayer(e.headId ?? '')}>
                {head?.displayName ?? shortId(e.headId)}
              </Chip>
            ) : (
              <span className="text-fg-3">—</span>
            ),
          },
          {
            label: t('organisations.parent'),
            value: e.parent ? (
              <Chip variant="link" onClick={() => onOpenPoliticalEntity(e.parent?.id ?? '')}>
                {e.parent.name}
              </Chip>
            ) : (
              <span className="text-fg-3">{t('organisations.independent')}</span>
            ),
          },
        ]}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.offices')}</h2>
        <OrganisationRolesTable
          roles={organisationRoles(e.offices)}
          label={t('organisations.offices')}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.members')}</h2>
        <OrganisationMembersTable
          members={politicalMembers(members.data?.items ?? [])}
          roleHeader={t('organisations.columns.office')}
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
        <h2 className="text-sm font-semibold">{t('organisations.children')}</h2>
        <PoliticalEntitiesTable
          entities={children.data?.items ?? []}
          label={t('organisations.children')}
          onOpen={onOpenPoliticalEntity}
        />
        {children.data && (
          <Pagination
            page={search.children}
            pageSize={MODERATION_PAGE_SIZE}
            total={children.data.total}
            onPageChange={(page) => onSearchChange({ ...search, children: page })}
          />
        )}
      </section>
    </ServicePageLayout>
  );
}

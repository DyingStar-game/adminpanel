import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { FactTiles } from '@/components/molecules/FactTiles';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { CorporationDialog } from '@/components/organisms/CorporationDialog';
import { CorporationsTable } from '@/components/organisms/CorporationsTable';
import { DisbandOrganisationDialog } from '@/components/organisms/DisbandOrganisationDialog';
import { MemberRankDialog } from '@/components/organisms/MemberRankDialog';
import { OrganisationMembersTable } from '@/components/organisms/OrganisationMembersTable';
import { OrganisationRolesTable } from '@/components/organisms/OrganisationRolesTable';
import { RemoveMemberDialog } from '@/components/organisms/RemoveMemberDialog';
import { TransferOrganisationDialog } from '@/components/organisms/TransferOrganisationDialog';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  useCorporation,
  useCorporationMembers,
  usePoliticalEntity,
  useSubsidiaries,
} from '@/hooks/useOrganisations';
import { usePanel } from '@/hooks/usePanel';
import { ApiError } from '@/lib/api';
import { formatDateTime, shortId } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import {
  corporationMembers,
  organisationRoles,
  type OrganisationMember,
} from '@/lib/organisations';
import type { OrganisationSearch } from '@/lib/organisationsSearch';

interface CorporationPageProps {
  corporationId: string;
  search: OrganisationSearch;
  onSearchChange: (next: OrganisationSearch) => void;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenCorporation: (id: string) => void;
  onOpenPoliticalEntity: (id: string) => void;
  /** After disbanding it: back to the directory. */
  onDisbanded: () => void;
}

type Dialog =
  | { kind: 'edit' | 'transfer' | 'disband' }
  | { kind: 'rank' | 'remove'; member: OrganisationMember };

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
  onDisbanded,
}: CorporationPageProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  // Management through `svc-admin`, for the capability role of social's README (step N).
  const manages = services.includes('social-management') && can('social.corporationWrite');
  const [dialog, setDialog] = useState<Dialog | null>(null);
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
  const rows = corporationMembers(members.data?.items ?? []);
  const ranks = organisationRoles(c.ranks);
  /** A row button, not opening the member's sheet. */
  const act = (next: Dialog) => (event: MouseEvent) => {
    event.stopPropagation();
    setDialog(next);
  };

  return (
    <ServicePageLayout
      title={c.name}
      actions={
        <div className="flex flex-wrap gap-2">
          {manages && (
            <>
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'edit' })}>
                {t('organisations.manage.edit')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'transfer' })}>
                {t('organisations.manage.transfer')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'disband' })}>
                {t('organisations.manage.disband')}
              </Button>
            </>
          )}
          {back}
        </div>
      }
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
        <OrganisationRolesTable roles={ranks} label={t('organisations.ranks')} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('organisations.members')}</h2>
        <OrganisationMembersTable
          members={rows}
          roleHeader={t('organisations.columns.rank')}
          onOpenPlayer={onOpenPlayer}
          // The CEO's rank changes by transfer, and the CEO leaves only after one.
          actions={
            manages
              ? (m) =>
                  m.head ? null : (
                    <span className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={act({ kind: 'rank', member: m })}
                      >
                        {t('organisations.manage.rank')}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={act({ kind: 'remove', member: m })}
                      >
                        {t('organisations.manage.remove')}
                      </Button>
                    </span>
                  )
              : undefined
          }
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
      {dialog?.kind === 'edit' && (
        <CorporationDialog corporation={c} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'transfer' && (
        <TransferOrganisationDialog
          kind="corporation"
          organisation={c}
          candidates={rows.filter((m) => !m.head)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'disband' && (
        <DisbandOrganisationDialog
          kind="corporation"
          organisation={c}
          onClose={() => setDialog(null)}
          onDisbanded={onDisbanded}
        />
      )}
      {dialog?.kind === 'rank' && (
        <MemberRankDialog
          corporationId={c.id}
          member={dialog.member}
          ranks={ranks.filter((r) => !r.head)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveMemberDialog
          corporation={c}
          member={dialog.member}
          onClose={() => setDialog(null)}
        />
      )}
    </ServicePageLayout>
  );
}

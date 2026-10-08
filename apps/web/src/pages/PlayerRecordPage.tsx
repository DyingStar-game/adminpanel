import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, GavelIcon, TrendingUpIcon } from 'lucide-react';
import type { Sanction } from '@dyingstar-admin/contracts/social';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { FactTiles } from '@/components/molecules/FactTiles';
import { PlayerIdentity } from '@/components/molecules/PlayerIdentity';
import { PlayerOrganisations } from '@/components/molecules/PlayerOrganisations';
import { SanctionBanner } from '@/components/molecules/SanctionBanner';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { ActivityTable } from '@/components/organisms/ActivityTable';
import { LiftSanctionDialog } from '@/components/organisms/LiftSanctionDialog';
import { PersistencePlayerLink } from '@/components/organisms/PersistencePlayerLink';
import { PlayerReportsTable } from '@/components/organisms/PlayerReportsTable';
import { ReputationDialog } from '@/components/organisms/ReputationDialog';
import { ReputationHistoryTable } from '@/components/organisms/ReputationHistoryTable';
import { SanctionDialog } from '@/components/organisms/SanctionDialog';
import { SanctionsTable } from '@/components/organisms/SanctionsTable';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { usePlayerProfile, usePlayerRecord } from '@/hooks/useModeration';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { activeSanctions } from '@/lib/sanctions';

interface PlayerRecordPageProps {
  playerId: string;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenReport: (id: number) => void;
  /** The player's item in persistence, and the map showing it. */
  onOpenItem: (uuid: string) => void;
  onOpenMap: (body: string, selected: string) => void;
  /** The player's organisations (ADR 0024 step 2). */
  onOpenCorporation: (id: string) => void;
  onOpenPoliticalEntity: (id: string) => void;
}

type Dialog = { kind: 'sanction' } | { kind: 'reputation' } | { kind: 'lift'; sanction: Sanction };

/** A player's moderation sheet (ADR 0024): the template wired to the sheet's data and actions. */
export function PlayerRecordPage({
  playerId,
  onBack,
  onOpenPlayer,
  onOpenReport,
  onOpenItem,
  onOpenMap,
  onOpenCorporation,
  onOpenPoliticalEntity,
}: PlayerRecordPageProps) {
  const { t, i18n } = useTranslation();
  const record = usePlayerRecord(playerId);
  // Public profile (presence, organisations): the sheet stays readable without it.
  const profile = usePlayerProfile(playerId).data;
  const can = useCan();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeftIcon />
      {t('players.back')}
    </Button>
  );
  if (record.isError) {
    const missing = record.error instanceof ApiError && record.error.status === 404;
    return (
      <ServicePageLayout title={t('moderation.player.title')} actions={back}>
        <ServiceNotice
          message={
            missing
              ? t('moderation.player.notFound', { id: playerId })
              : t(moderationErrorKey(record.error))
          }
        />
      </ServicePageLayout>
    );
  }
  const player = record.data;
  if (!player) return null;
  // NPCs are excluded from sanctions and reputation by `social`.
  const actionable = player.entityType === 'player';

  return (
    <ServicePageLayout
      title={player.displayName}
      leading={
        player.avatarUrl && (
          <img
            src={player.avatarUrl}
            alt=""
            className="size-16 shrink-0 rounded-lg border object-cover"
          />
        )
      }
      meta={
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
          <Badge variant="outline">{t(`moderation.player.kind.${player.entityType}`)}</Badge>
          {profile && (
            <Badge variant={profile.status === 'offline' ? 'outline' : 'secondary'}>
              {t(`moderation.player.status.${profile.status}`)}
            </Badge>
          )}
          <MonoText tone="subtle">{player.playerId}</MonoText>
          <CopyButton value={player.playerId} />
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {actionable && can('social.moderate') && (
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'sanction' })}>
              <GavelIcon />
              {t('moderation.actions.sanction')}
            </Button>
          )}
          {actionable && can('social.reputation') && (
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'reputation' })}>
              <TrendingUpIcon />
              {t('moderation.actions.reputation')}
            </Button>
          )}
          {back}
        </div>
      }
    >
      <SanctionBanner sanctions={activeSanctions(player.sanctions)} />
      <FactTiles
        facts={[
          { label: t('moderation.player.reputation'), value: player.reputation },
          {
            label: t('moderation.player.playtime'),
            value: t('moderation.player.hours', {
              count: Math.round(player.playtimeSeconds / 3600),
            }),
          },
          {
            label: t('moderation.player.since'),
            value: formatDateTime(player.createdAt, i18n.language),
          },
        ]}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <PlayerIdentity player={player} />
        <PlayerOrganisations
          memberships={profile ?? null}
          onOpenCorporation={onOpenCorporation}
          onOpenPoliticalEntity={onOpenPoliticalEntity}
        />
      </div>
      {actionable && (
        <PersistencePlayerLink
          playerId={player.playerId}
          onOpenItem={onOpenItem}
          onOpenMap={onOpenMap}
        />
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.sanctions')}</h2>
        <SanctionsTable
          sanctions={player.sanctions}
          showPlayer={false}
          onOpenPlayer={onOpenPlayer}
          onLift={
            can('social.moderate') ? (sanction) => setDialog({ kind: 'lift', sanction }) : undefined
          }
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.reports')}</h2>
        <PlayerReportsTable reports={player.reports} onOpenReport={onOpenReport} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.reputationEvents')}</h2>
        <ReputationHistoryTable events={player.reputationEvents} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.activity')}</h2>
        <ActivityTable
          entries={player.activity}
          onOpenPlayer={onOpenPlayer}
          onOpenReport={onOpenReport}
        />
      </section>
      {dialog?.kind === 'sanction' && (
        <SanctionDialog
          playerId={player.playerId}
          playerName={player.displayName}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'reputation' && (
        <ReputationDialog
          playerId={player.playerId}
          playerName={player.displayName}
          reputation={player.reputation}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'lift' && (
        <LiftSanctionDialog
          sanction={dialog.sanction}
          playerName={player.displayName}
          onClose={() => setDialog(null)}
        />
      )}
    </ServicePageLayout>
  );
}

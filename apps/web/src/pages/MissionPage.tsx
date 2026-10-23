import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import { FactTiles } from '@/components/molecules/FactTiles';
import { MissionReward } from '@/components/molecules/MissionReward';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { MissionAssignmentsTable } from '@/components/organisms/MissionAssignmentsTable';
import { MissionObjectives } from '@/components/organisms/MissionObjectives';
import { MissionPlacesMap } from '@/components/organisms/MissionPlacesMap';
import { MissionSimulationOrigin } from '@/components/organisms/MissionSimulationOrigin';
import { MissionTerms, type MissionLinks } from '@/components/organisms/MissionTerms';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useMission } from '@/hooks/useMissions';
import { usePanel } from '@/hooks/usePanel';
import { ApiError } from '@/lib/api';
import { formatBps } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { missionErrorKey } from '@/lib/missionErrors';
import { IdLabel } from '@/components/molecules/IdLabel';

interface MissionPageProps extends Required<MissionLinks> {
  missionId: string;
  onBack: () => void;
  /** Opens the Simulation section's orders (a mission it published, ADR 0026). */
  onOpenSimulationOrders: (filters: { resource: string; village: string }) => void;
}

/**
 * A mission, read only, from `mission`'s internal detail (ADR 0023 › Mission): its terms, its
 * objectives and who took it, whatever its visibility in game.
 */
export function MissionPage({
  missionId,
  onBack,
  onOpenMission,
  onOpenPlayer,
  onOpenCorporation,
  onOpenPoliticalEntity,
  onOpenSimulationOrders,
}: MissionPageProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  // Players and organisations have their pages for who may read `social` (as the sidebar).
  const social = services.includes('social') && can('social.moderate');
  const detail = useMission(missionId);
  // The objective chosen on the map or its card (ADR 0027).
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeftIcon />
      {t('missions.back')}
    </Button>
  );
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <ServicePageLayout title={t('missions.title')} actions={back}>
        <ServiceNotice
          message={
            missing ? t('missions.notFound', { id: missionId }) : t(missionErrorKey(detail.error))
          }
        />
      </ServicePageLayout>
    );
  }
  const d = detail.data;
  if (!d) return null;
  const m = d.mission;
  const { summary } = d;

  return (
    <ServicePageLayout
      title={m.title}
      actions={back}
      meta={
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
          <Badge variant="outline">{t(`missions.status.${m.status}`)}</Badge>
          <Badge variant="outline">
            {t(`missions.categories.${m.category}` as never, { defaultValue: m.category })}
          </Badge>
          <Badge variant="outline">{t(`missions.kinds.${m.kind}`)}</Badge>
          {m.isEvent && <Badge variant="secondary">{t('missions.event')}</Badge>}
          <IdLabel id={m.id} full />
          {formatDateTime(m.createdAt, i18n.language)}
        </div>
      }
    >
      {m.description && <p className="text-sm whitespace-pre-wrap">{m.description}</p>}
      <FactTiles
        facts={[
          {
            label: t('missions.detail.progress'),
            value: formatBps(summary.progressBp, i18n.language),
            hint: t('missions.detail.progressHint'),
          },
          {
            label: t('missions.detail.takers'),
            value: summary.active,
            hint: t('missions.detail.takersHint', { count: m.maxAssignees }),
          },
          {
            label: t('missions.detail.handedIn'),
            value: summary.completed + summary.partial,
            hint:
              summary.partial > 0
                ? t('missions.detail.handedInHint', { count: summary.partial })
                : undefined,
          },
          {
            label: t('missions.detail.reward'),
            value: (
              <span className="text-base font-normal">
                <MissionReward rewards={m.rewards} />
              </span>
            ),
          },
        ]}
      />
      <MissionSimulationOrigin missionId={m.id} onOpenOrders={onOpenSimulationOrders} />
      <MissionTerms
        detail={d}
        onOpenMission={onOpenMission}
        onOpenPlayer={social ? onOpenPlayer : undefined}
        onOpenCorporation={social ? onOpenCorporation : undefined}
        onOpenPoliticalEntity={social ? onOpenPoliticalEntity : undefined}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('missions.placesMap.title')}</h2>
        <MissionPlacesMap
          objectives={d.objectives}
          places={d.places}
          selected={selected}
          onSelect={setSelected}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('missions.detail.objectives')}</h2>
        <MissionObjectives
          objectives={d.objectives}
          places={d.places}
          players={d.players}
          onOpenPlayer={social ? onOpenPlayer : undefined}
          selected={selected}
          onSelect={setSelected}
          taken={summary.active > 0}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('missions.detail.assignments')}</h2>
        <MissionAssignmentsTable
          assignments={d.assignments}
          players={d.players}
          onOpenPlayer={social ? onOpenPlayer : undefined}
        />
      </section>
    </ServicePageLayout>
  );
}

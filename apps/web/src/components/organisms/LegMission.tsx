import { useTranslation } from 'react-i18next';
import { EntityLink } from '@/components/molecules/EntityLink';
import { Badge } from '@/components/ui/badge';
import { useMission } from '@/hooks/useMissions';

interface LegMissionProps {
  missionId: string;
  /** Opens the mission's page. */
  onOpenMission?: ((missionId: string) => void) | undefined;
}

/**
 * The mission a published leg of a supply order is on offer as (ADR 0028): its title and status
 * from `mission`, a way to its page; its id alone until `mission` answers, or when it does not.
 */
export function LegMission({ missionId, onOpenMission }: LegMissionProps) {
  const { t } = useTranslation();
  const mission = useMission(missionId).data?.mission;
  return (
    <span className="inline-flex items-center gap-1.5">
      <EntityLink id={missionId} label={mission?.title} onOpen={onOpenMission} />
      {mission && <Badge variant="outline">{t(`missions.status.${mission.status}`)}</Badge>}
    </span>
  );
}

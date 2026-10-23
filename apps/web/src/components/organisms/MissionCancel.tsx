import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  isSimulationMission,
  type MissionAsServed,
  type MissionObjective,
} from '@dyingstar-admin/contracts/mission';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useCancelMission } from '@/hooks/useMissions';
import { usePanel } from '@/hooks/usePanel';
import { useMissionOrder } from '@/hooks/useSimulation';
import { useCancelOrder } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';

/** A mission still on offer or taken: the ones worth cancelling. */
const OPEN_MISSION: MissionAsServed['status'][] = ['available', 'active'];
/** `universesimulator`'s open orders (`db/orders.rs` › `OPEN_STATUSES`). */
const OPEN_ORDER = ['planned', 'in_progress'];

interface MissionCancelProps {
  mission: Pick<MissionAsServed, 'id' | 'status' | 'scriptId'>;
  objectives: readonly Pick<MissionObjective, 'payload'>[];
}

/**
 * Cancelling a mission from its page (ADR 0028), after confirmation. A mission of the simulation
 * is cancelled through its supply order (`simulation.manage`): cancelled alone, it would be
 * published again; without its order at hand, a note says so. Any other open mission is
 * cancelled in `mission` (`mission.write`), its escrow refunded.
 */
export function MissionCancel({ mission, objectives }: MissionCancelProps) {
  const { t } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  const simulation = isSimulationMission(mission);
  const open = OPEN_MISSION.includes(mission.status);
  const readsOrders = services.includes('universesimulator') && can('simulation.view');
  const found = useMissionOrder(mission.id, objectives, simulation && open && readsOrders);
  const cancelMission = useCancelMission();
  const cancelOrder = useCancelOrder();
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;
  const order = found && OPEN_ORDER.includes(found.order.status) ? found.order : undefined;
  if (simulation && !order) {
    return <span className="text-xs text-fg-3">{t('missions.cancel.throughOrder')}</span>;
  }
  if (simulation ? !can('simulation.manage') : !can('mission.write')) return null;

  const confirm = async () => {
    setConfirming(false);
    try {
      if (order) await cancelOrder.mutateAsync(order.id);
      else await cancelMission.mutateAsync(mission.id);
      toast.success(t(order ? 'missions.cancel.orderDone' : 'missions.cancel.done'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('missions.unavailable'));
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        disabled={cancelMission.isPending || cancelOrder.isPending}
        onClick={() => setConfirming(true)}
      >
        {t(order ? 'missions.cancel.orderAction' : 'missions.cancel.action')}
      </Button>
      {confirming && (
        <WriteConfirm
          open
          destructive
          title={t(order ? 'missions.cancel.orderTitle' : 'missions.cancel.title')}
          description={<p>{t(order ? 'missions.cancel.orderText' : 'missions.cancel.text')}</p>}
          confirmLabel={t(order ? 'missions.cancel.orderAction' : 'missions.cancel.action')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirm()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

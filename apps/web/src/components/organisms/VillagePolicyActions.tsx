import { useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { useVillage } from '@/hooks/useSimulation';
import { useDeleteVillagePolicy } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { VillagePolicyDialog } from './VillagePolicyDialog';

interface VillagePolicyActionsProps {
  village: { id: string; name: string };
  resource: { id: string; name: string; unit: string };
}

/**
 * The actions on one village's threshold for one resource (ADR 0025 › Configuration, for
 * `simulation.manage`): edit or delete it (deleting is confirmed), or add one when there is
 * none. Shown in the village panel and next to a village's history in the Stocks tab.
 */
export function VillagePolicyActions({ village, resource }: VillagePolicyActionsProps) {
  const { t } = useTranslation();
  const detail = useVillage(village.id);
  const remove = useDeleteVillagePolicy();
  const [open, setOpen] = useState<'edit' | 'delete' | null>(null);
  if (!detail.data) return null;
  const policy = detail.data.policies.find((p) => p.resourceId === resource.id) ?? null;

  const confirmDelete = async () => {
    setOpen(null);
    try {
      await remove.mutateAsync({ villageId: village.id, resourceId: resource.id });
      toast.success(t('simulation.config.policyDeleted', { resource: resource.name }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
    }
  };
  const label = policy ? t('simulation.config.editPolicy') : t('simulation.config.addPolicy');

  return (
    <span className="inline-flex gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`${label} · ${resource.name}`}
        title={label}
        onClick={() => setOpen('edit')}
      >
        {policy ? <PencilIcon /> : <PlusIcon />}
      </Button>
      {policy && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${t('simulation.config.deletePolicy')} · ${resource.name}`}
          title={t('simulation.config.deletePolicy')}
          onClick={() => setOpen('delete')}
        >
          <Trash2Icon />
        </Button>
      )}
      {open === 'edit' && (
        <VillagePolicyDialog
          village={village}
          resource={resource}
          policy={policy}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'delete' && (
        <WriteConfirm
          open
          destructive
          title={t('simulation.config.deletePolicyTitle', {
            resource: resource.name,
            village: village.name,
          })}
          description={<p>{t('simulation.config.deletePolicyText')}</p>}
          confirmLabel={t('simulation.config.deletePolicy')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setOpen(null)}
        />
      )}
    </span>
  );
}

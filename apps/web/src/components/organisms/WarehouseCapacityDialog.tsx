import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LabelledField } from '@/components/molecules/LabelledField';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { useSaveWarehouseCapacity } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity } from '@/lib/simulation';
import {
  CapacityFormSchema,
  capacityFormValues,
  capacityToSend,
  type CapacityForm,
  type ConfigError,
} from '@/lib/simulationConfig';

interface WarehouseCapacityDialogProps {
  warehouse: { id: string; name: string };
  resource: { id: string; name: string; unit: string };
  /** The warehouse's capacity for the resource; `null` or undefined: no limit. */
  capacity: number | null | undefined;
  onClose: () => void;
}

/**
 * Sets what one warehouse of a village can hold of a resource (ADR 0025 › Configuration;
 * capacities are per warehouse, the service's ADR 0013): whole units, or empty for no limit,
 * then the change to confirm.
 */
export function WarehouseCapacityDialog({
  warehouse,
  resource,
  capacity,
  onClose,
}: WarehouseCapacityDialogProps) {
  const { t, i18n } = useTranslation();
  const save = useSaveWarehouseCapacity();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<CapacityForm>({
    resolver: zodResolver(CapacityFormSchema),
    defaultValues: capacityFormValues(capacity),
    mode: 'onChange',
  });
  const value = (useWatch({ control: form.control }) as CapacityForm).capacity;
  const shown = (v: number | null | undefined) =>
    v == null || Number.isNaN(v)
      ? t('simulation.panel.unlimited')
      : `${formatQuantity(v, i18n.language)} ${resource.unit}`;
  const changed = !((capacity == null && Number.isNaN(value)) || capacity === value);
  const code = form.formState.errors.capacity?.message as ConfigError | undefined;

  const submit = form.handleSubmit(async (valid) => {
    try {
      await save.mutateAsync(capacityToSend(warehouse.id, resource.id, valid));
      toast.success(t('simulation.config.capacitySaved', { warehouse: warehouse.name }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('simulation.config.capacityTitle', {
        warehouse: warehouse.name,
        resource: resource.name,
      })}
      description={t('simulation.config.capacityHint')}
      confirming={confirming}
      summary={t('simulation.config.change', {
        label: t('simulation.config.capacity', { unit: resource.unit }),
        before: shown(capacity),
        after: shown(value),
      })}
      canContinue={form.formState.isValid && changed}
      pending={save.isPending}
      onContinue={() => setConfirming(true)}
      onBack={() => setConfirming(false)}
      onCancel={onClose}
      onSubmit={(event) => void submit(event)}
      labels={{
        cancel: t('confirm.cancel'),
        back: t('moderation.actions.back'),
        continue: t('moderation.actions.continue'),
        confirm: t('moderation.actions.confirm'),
      }}
    >
      <LabelledField
        id="warehouse-capacity"
        label={t('simulation.config.capacity', { unit: resource.unit })}
        hint={t('simulation.config.capacityFieldHint')}
        error={code ? t(`simulation.config.errors.${code}`) : undefined}
        className="w-48"
      >
        <Input
          id="warehouse-capacity"
          type="number"
          min={0}
          step={1}
          aria-invalid={!!code}
          aria-describedby="warehouse-capacity-message"
          {...form.register('capacity', { valueAsNumber: true })}
        />
      </LabelledField>
    </TwoStepDialog>
  );
}

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { MineralSource } from '@dyingstar-admin/contracts/universesimulator';
import { LabelledField } from '@/components/molecules/LabelledField';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { useSaveMineralSource } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity } from '@/lib/simulation';
import {
  SourceFormSchema,
  sourceFormValues,
  sourceToWrite,
  type SourceForm,
  type WorldError,
} from '@/lib/simulationWorld';

interface MineralSourceDialogProps {
  source: MineralSource;
  /** The village mining it and the resource mined, by name. */
  village: string;
  resource: { name: string; unit: string };
  onClose: () => void;
}

/**
 * Changes a village's mineral source (ADR 0025 › The world): the most one mining order asks for,
 * which is the size of the missions players are offered, and what is left to mine (empty: no
 * end). Then the change to confirm: the next orders follow it, the missions on offer do not.
 */
export function MineralSourceDialog({
  source,
  village,
  resource,
  onClose,
}: MineralSourceDialogProps) {
  const { t, i18n } = useTranslation();
  const save = useSaveMineralSource();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<SourceForm>({
    resolver: zodResolver(SourceFormSchema),
    defaultValues: sourceFormValues(source),
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as SourceForm;
  const errors = form.formState.errors;
  const message = (field: keyof SourceForm) => {
    const code = errors[field]?.message as WorldError | undefined;
    return code ? t(`simulation.world.errors.${code}`) : undefined;
  };
  const amount = (value: number | null | undefined) =>
    value == null || Number.isNaN(value)
      ? t('simulation.world.noEnd')
      : `${formatQuantity(value, i18n.language)} ${resource.unit}`;
  const next = form.formState.isValid ? sourceToWrite(source, values) : null;
  const changed =
    !!next &&
    (next.maxUnitsPerMission !== source.maxUnitsPerMission ||
      next.remainingUnits !== (source.remainingUnits ?? null));

  const submit = form.handleSubmit(async (valid) => {
    try {
      await save.mutateAsync(sourceToWrite(source, valid));
      toast.success(t('simulation.world.sourceSaved', { village, resource: resource.name }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('simulation.world.sourceTitle', { village, resource: resource.name })}
      description={t('simulation.world.sourceHint')}
      confirming={confirming}
      summary={
        <ul className="flex flex-col gap-1">
          <li>
            {t('simulation.config.change', {
              label: t('simulation.world.maxPerMission'),
              before: amount(source.maxUnitsPerMission),
              after: amount(next?.maxUnitsPerMission),
            })}
          </li>
          <li>
            {t('simulation.config.change', {
              label: t('simulation.world.remaining'),
              before: amount(source.remainingUnits),
              after: amount(next?.remainingUnits),
            })}
          </li>
        </ul>
      }
      canContinue={changed}
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
        id="source-max"
        label={t('simulation.world.maxPerMission')}
        hint={t('simulation.world.maxPerMissionHint', { unit: resource.unit })}
        error={message('maxUnitsPerMission')}
        className="w-56"
      >
        <Input
          id="source-max"
          type="number"
          step="1"
          aria-invalid={!!errors.maxUnitsPerMission}
          aria-describedby="source-max-message"
          {...form.register('maxUnitsPerMission', { valueAsNumber: true })}
        />
      </LabelledField>
      <LabelledField
        id="source-remaining"
        label={t('simulation.world.remaining')}
        hint={t('simulation.world.remainingHint')}
        error={message('remainingUnits')}
        className="w-56"
      >
        <Input
          id="source-remaining"
          type="number"
          step="1"
          aria-invalid={!!errors.remainingUnits}
          aria-describedby="source-remaining-message"
          {...form.register('remainingUnits', { valueAsNumber: true })}
        />
      </LabelledField>
    </TwoStepDialog>
  );
}

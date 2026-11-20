import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LabelledField } from '@/components/molecules/LabelledField';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { useSaveRoute } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import {
  EMPTY_ROUTE,
  RouteFormSchema,
  routeToWrite,
  type RouteForm,
  type WorldError,
} from '@/lib/simulationWorld';

interface RouteDialogProps {
  /** The villages a route may link, by name. */
  villages: { id: string; name: string }[];
  onClose: () => void;
}

/**
 * Writes a route between two villages (ADR 0025 › The world): two different villages and a
 * distance in kilometres, then the route to confirm. A route written here is no longer the
 * import's: it is never pruned, and replaces the automatic one between the same villages.
 */
export function RouteDialog({ villages, onClose }: RouteDialogProps) {
  const { t } = useTranslation();
  const save = useSaveRoute();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<RouteForm>({
    resolver: zodResolver(RouteFormSchema),
    defaultValues: EMPTY_ROUTE,
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as RouteForm;
  const errors = form.formState.errors;
  // The form reports an error on the field being changed only, and the schema's cross-field rule
  // waits for every field to be valid: the same village twice is told from the values themselves.
  const sameVillage = !!values.fromVillageId && values.fromVillageId === values.toVillageId;
  const message = (field: keyof RouteForm) => {
    const code: WorldError | undefined =
      field === 'toVillageId' && sameVillage
        ? 'sameVillage'
        : (errors[field]?.message as WorldError | undefined);
    return code ? t(`simulation.world.errors.${code}`) : undefined;
  };
  const name = (id: string) => villages.find((v) => v.id === id)?.name ?? id;
  const options = villages.map((v) => ({ value: v.id, label: v.name }));

  const submit = form.handleSubmit(async (valid) => {
    try {
      await save.mutateAsync(routeToWrite(valid));
      toast.success(
        t('simulation.world.routeSaved', {
          from: name(valid.fromVillageId),
          to: name(valid.toVillageId),
        }),
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('simulation.world.routeTitle')}
      description={t('simulation.world.routeHint')}
      confirming={confirming}
      summary={
        <p>
          {t('simulation.world.routeSummary', {
            from: name(values.fromVillageId),
            to: name(values.toVillageId),
            km: values.distanceKm,
          })}
        </p>
      }
      canContinue={form.formState.isValid}
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
      <div className="flex flex-wrap gap-3">
        <LabelledField
          id="route-from"
          label={t('simulation.world.from')}
          error={message('fromVillageId')}
        >
          <Controller
            control={form.control}
            name="fromVillageId"
            render={({ field }) => (
              <OptionSelect<string>
                size="default"
                label={t('simulation.world.from')}
                value={field.value || undefined}
                options={options}
                onChange={field.onChange}
                className="w-40"
              />
            )}
          />
        </LabelledField>
        <LabelledField
          id="route-to"
          label={t('simulation.world.to')}
          error={message('toVillageId')}
        >
          <Controller
            control={form.control}
            name="toVillageId"
            render={({ field }) => (
              <OptionSelect<string>
                size="default"
                label={t('simulation.world.to')}
                value={field.value || undefined}
                options={options}
                onChange={field.onChange}
                className="w-40"
              />
            )}
          />
        </LabelledField>
      </div>
      <LabelledField
        id="route-distance"
        label={t('simulation.world.distanceKm')}
        error={message('distanceKm')}
        className="w-48"
      >
        <Input
          id="route-distance"
          type="number"
          step="any"
          aria-invalid={!!errors.distanceKm}
          aria-describedby="route-distance-message"
          {...form.register('distanceKm', { valueAsNumber: true })}
        />
      </LabelledField>
    </TwoStepDialog>
  );
}

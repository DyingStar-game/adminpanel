import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Flow, Resource } from '@dyingstar-admin/contracts/universesimulator';
import { LabelledField } from '@/components/molecules/LabelledField';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { useCreateFlow, useUpdateFlow } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatRate } from '@/lib/simulation';
import {
  flowChange,
  FlowFormSchema,
  flowFormValues,
  flowToCreate,
  type ConfigError,
  type FlowForm,
} from '@/lib/simulationConfig';

const SOURCES = ['population', 'industry', 'manual'] as const;

interface FlowDialogProps {
  village: { id: string; name: string };
  /** The flow edited (its rate and label), or null to add one. */
  flow: Flow | null;
  /** Resources of the simulation: the choice of a new flow, the names. */
  resources: Resource[];
  onClose: () => void;
}

/**
 * Adds a production or consumption flow to a village, or changes a flow's rate and label (ADR
 * 0025 › Configuration): units per game hour, negative for a consumption, never 0; then the
 * change to confirm, since every tick applies it.
 */
export function FlowDialog({ village, flow, resources, onClose }: FlowDialogProps) {
  const { t, i18n } = useTranslation();
  const create = useCreateFlow();
  const update = useUpdateFlow();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<FlowForm>({
    resolver: zodResolver(FlowFormSchema),
    defaultValues: flowFormValues(flow),
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as FlowForm;
  const errors = form.formState.errors;
  const message = (field: keyof FlowForm) => {
    const code = errors[field]?.message as ConfigError | undefined;
    return code ? t(`simulation.config.errors.${code}`) : undefined;
  };
  const resourceName = (id: string) => resources.find((r) => r.id === id)?.name ?? id;
  const rate = (value: number) => formatRate(value, i18n.language);
  const sourceName = (source: FlowForm['source']) => t(`simulation.panel.sources.${source}`);

  const change = flow && form.formState.isValid ? flowChange(flow, values) : {};
  const lines = flow
    ? [
        change.ratePerHour !== undefined && {
          label: t('simulation.config.rate'),
          before: rate(flow.ratePerHour),
          after: rate(change.ratePerHour),
        },
        change.label !== undefined && {
          label: t('simulation.config.label'),
          before: flow.label ?? t('simulation.none'),
          after: change.label ?? t('simulation.none'),
        },
      ]
        .filter((line) => line !== false)
        .map((line) => t('simulation.config.change', line))
    : [
        t('simulation.config.newFlow', {
          resource: resourceName(values.resourceId),
          rate: rate(values.ratePerHour),
          source: sourceName(values.source),
        }),
      ];
  const pending = create.isPending || update.isPending;

  const submit = form.handleSubmit(async (valid) => {
    try {
      if (flow) await update.mutateAsync({ id: flow.id, change: flowChange(flow, valid) });
      else await create.mutateAsync(flowToCreate(village.id, valid));
      toast.success(t('simulation.config.flowSaved', { resource: resourceName(valid.resourceId) }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={
        flow
          ? t('simulation.config.flowTitleEdit', {
              resource: resourceName(flow.resourceId),
              village: village.name,
            })
          : t('simulation.config.flowTitleNew', { village: village.name })
      }
      description={t('simulation.config.flowHint')}
      confirming={confirming}
      summary={
        <ul className="flex flex-col gap-1">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      }
      canContinue={form.formState.isValid && (!flow || Object.keys(change).length > 0)}
      pending={pending}
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
      {!flow && (
        <div className="flex flex-wrap gap-3">
          <LabelledField
            id="flow-resource"
            label={t('simulation.config.resource')}
            error={message('resourceId')}
          >
            <Controller
              control={form.control}
              name="resourceId"
              render={({ field }) => (
                <OptionSelect<string>
                  size="default"
                  label={t('simulation.config.resource')}
                  value={field.value || undefined}
                  options={resources.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={field.onChange}
                  className="w-48"
                />
              )}
            />
          </LabelledField>
          <LabelledField id="flow-source" label={t('simulation.config.source')}>
            <Controller
              control={form.control}
              name="source"
              render={({ field }) => (
                <OptionSelect<FlowForm['source']>
                  size="default"
                  label={t('simulation.config.source')}
                  value={field.value}
                  options={SOURCES.map((s) => ({ value: s, label: sourceName(s) }))}
                  onChange={field.onChange}
                  className="w-40"
                />
              )}
            />
          </LabelledField>
        </div>
      )}
      <LabelledField
        id="flow-rate"
        label={t('simulation.config.rate')}
        error={message('ratePerHour')}
        className="w-48"
      >
        <Input
          id="flow-rate"
          type="number"
          step="any"
          aria-invalid={!!errors.ratePerHour}
          aria-describedby="flow-rate-message"
          {...form.register('ratePerHour', { valueAsNumber: true })}
        />
      </LabelledField>
      <LabelledField
        id="flow-label"
        label={t('simulation.config.label')}
        hint={t('simulation.config.labelHint')}
        error={message('label')}
      >
        <Input
          id="flow-label"
          aria-invalid={!!errors.label}
          aria-describedby="flow-label-message"
          {...form.register('label')}
        />
      </LabelledField>
    </TwoStepDialog>
  );
}

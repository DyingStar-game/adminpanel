import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { VillagePolicy } from '@dyingstar-admin/contracts/universesimulator';
import { LabelledField } from '@/components/molecules/LabelledField';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { useSaveVillagePolicy } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatQuantity } from '@/lib/simulation';
import {
  PolicyFormSchema,
  policyFormValues,
  policyToSend,
  type ConfigError,
  type PolicyForm,
} from '@/lib/simulationConfig';

interface VillagePolicyDialogProps {
  village: { id: string; name: string };
  resource: { id: string; name: string; unit: string };
  /** The policy edited, or null to add one. */
  policy: VillagePolicy | null;
  onClose: () => void;
}

const FIELDS = ['minThreshold', 'targetLevel'] as const;
const LABELS = {
  minThreshold: 'simulation.config.threshold',
  targetLevel: 'simulation.config.target',
} as const;

/**
 * Adds or edits the threshold and target level of a village for a resource (ADR 0025 ›
 * Configuration; on the village's stock, all its warehouses summed), checked as the service
 * does (`0 ≤ threshold ≤ target`), then the changes to confirm, since the live simulation
 * follows them.
 */
export function VillagePolicyDialog({
  village,
  resource,
  policy,
  onClose,
}: VillagePolicyDialogProps) {
  const { t, i18n } = useTranslation();
  const save = useSaveVillagePolicy();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<PolicyForm>({
    resolver: zodResolver(PolicyFormSchema),
    defaultValues: policyFormValues(policy),
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as PolicyForm;
  const errors = form.formState.errors;
  const level = (value: number) => `${formatQuantity(value, i18n.language)} ${resource.unit}`;
  const before = policyFormValues(policy);
  const lines = FIELDS.filter((field) => !policy || values[field] !== before[field]).map(
    (field) => ({
      label: t(LABELS[field], { unit: resource.unit }),
      before: policy ? level(before[field]) : t('simulation.none'),
      after: level(values[field]),
    }),
  );
  const message = (field: (typeof FIELDS)[number]) => {
    const code = errors[field]?.message as ConfigError | undefined;
    return code ? t(`simulation.config.errors.${code}`) : undefined;
  };

  const submit = form.handleSubmit(async (valid) => {
    try {
      await save.mutateAsync(policyToSend(village.id, resource.id, valid));
      toast.success(t('simulation.config.policySaved', { resource: resource.name }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('simulation.config.policyTitle', { resource: resource.name, village: village.name })}
      description={t('simulation.config.policyHint')}
      confirming={confirming}
      summary={
        <ul className="flex flex-col gap-1">
          {lines.map((line) => (
            <li key={line.label}>{t('simulation.config.change', line)}</li>
          ))}
        </ul>
      }
      canContinue={form.formState.isValid && lines.length > 0}
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
        {FIELDS.map((field) => (
          <LabelledField
            key={field}
            id={`policy-${field}`}
            label={t(LABELS[field], { unit: resource.unit })}
            error={message(field)}
            className="w-44"
          >
            <Input
              id={`policy-${field}`}
              type="number"
              min={0}
              step={1}
              aria-invalid={!!errors[field]}
              aria-describedby={`policy-${field}-message`}
              {...form.register(field, {
                valueAsNumber: true,
                // A threshold changed re-checks the target against it.
                deps: field === 'minThreshold' ? ['targetLevel'] : [],
              })}
            />
          </LabelledField>
        ))}
      </div>
    </TwoStepDialog>
  );
}

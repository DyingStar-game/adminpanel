import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type {
  PoliticalSettings,
  PoliticalSettingsChange,
} from '@dyingstar-admin/contracts/economie';
import type { PoliticalEntityType } from '@dyingstar-admin/contracts/social';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdatePoliticalSettings } from '@/hooks/useEconomieActions';
import { ApiError } from '@/lib/api';
import {
  bpsToPercent,
  formatAmount,
  formatBps,
  MINTING_LEVELS,
  percentToBps,
  zAmountField,
  zPercentField,
} from '@/lib/economy';

/** The form: rates in percent, the ceiling in credits (`economie`'s `politicalSettingsBody`). */
const PoliticalSettingsFormSchema = z.object({
  corporateTax: zPercentField,
  incomeTax: zPercentField,
  allowMinting: z.boolean(),
  mintCeiling: zAmountField,
});
type PoliticalSettingsForm = z.infer<typeof PoliticalSettingsFormSchema>;

interface PoliticalSettingsDialogProps {
  entity: { id: string; name: string; type: PoliticalEntityType };
  settings: PoliticalSettings;
  onClose: () => void;
}

/**
 * Changes a political entity's tax rates and minting policy in `economie` (ADR 0024 step O.2,
 * through `svc-admin`): the form, then the changes to confirm. Only the changed fields are sent.
 * Money issuing is offered to countries and federations only (`economie`'s README), or to turn it
 * off where it is on.
 */
export function PoliticalSettingsDialog({
  entity,
  settings,
  onClose,
}: PoliticalSettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const update = useUpdatePoliticalSettings(entity.id);
  const minting = MINTING_LEVELS.includes(entity.type) || settings.allowMinting;
  const form = useForm<PoliticalSettingsForm>({
    resolver: zodResolver(PoliticalSettingsFormSchema),
    defaultValues: {
      corporateTax: bpsToPercent(settings.corporateTaxBps),
      incomeTax: bpsToPercent(settings.incomeTaxBps),
      allowMinting: settings.allowMinting,
      mintCeiling: String(settings.mintCeiling),
    },
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as PoliticalSettingsForm;
  const [confirming, setConfirming] = useState(false);

  const change: PoliticalSettingsChange = {};
  if (form.formState.isValid) {
    const corporateTaxBps = percentToBps(values.corporateTax);
    const incomeTaxBps = percentToBps(values.incomeTax);
    const mintCeiling = Number(values.mintCeiling);
    if (corporateTaxBps !== settings.corporateTaxBps) change.corporateTaxBps = corporateTaxBps;
    if (incomeTaxBps !== settings.incomeTaxBps) change.incomeTaxBps = incomeTaxBps;
    if (minting && values.allowMinting !== settings.allowMinting) {
      change.allowMinting = values.allowMinting;
    }
    if (minting && mintCeiling !== settings.mintCeiling) change.mintCeiling = mintCeiling;
  }
  const rate = (bps: number) => formatBps(bps, i18n.language);
  const ceiling = (amount: number) =>
    amount > 0 ? formatAmount(amount, 'credits', i18n.language) : t('economy.settings.noLimit');
  const yesNo = (allowed: boolean) => t(allowed ? 'economy.allowed' : 'economy.notAllowed');
  const lines = [
    change.corporateTaxBps !== undefined && {
      label: t('economy.corporateTax'),
      before: rate(settings.corporateTaxBps),
      after: rate(change.corporateTaxBps),
    },
    change.incomeTaxBps !== undefined && {
      label: t('economy.incomeTax'),
      before: rate(settings.incomeTaxBps),
      after: rate(change.incomeTaxBps),
    },
    change.allowMinting !== undefined && {
      label: t('economy.minting'),
      before: yesNo(settings.allowMinting),
      after: yesNo(change.allowMinting),
    },
    change.mintCeiling !== undefined && {
      label: t('economy.settings.ceiling'),
      before: ceiling(settings.mintCeiling),
      after: ceiling(change.mintCeiling),
    },
  ].filter((line) => line !== false);

  const submit = form.handleSubmit(async () => {
    try {
      await update.mutateAsync(change);
      toast.success(t('economy.settings.saved', { name: entity.name }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('economy.settings.politicsTitle', { name: entity.name })}
      description={t('economy.settings.hint')}
      confirming={confirming}
      summary={
        <ul className="flex flex-col gap-1">
          {lines.map((line) => (
            <li key={line.label}>{t('economy.settings.change', line)}</li>
          ))}
        </ul>
      }
      canContinue={lines.length > 0}
      pending={update.isPending}
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
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="political-corporate-tax">
            {t('economy.settings.percent', { label: t('economy.corporateTax') })}
          </Label>
          <Input
            id="political-corporate-tax"
            inputMode="decimal"
            {...form.register('corporateTax')}
          />
        </div>
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="political-income-tax">
            {t('economy.settings.percent', { label: t('economy.incomeTax') })}
          </Label>
          <Input id="political-income-tax" inputMode="decimal" {...form.register('incomeTax')} />
        </div>
      </div>
      <p className="text-xs text-fg-3">{t('economy.settings.ratesHint')}</p>
      {minting ? (
        <>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="allowMinting"
              render={({ field }) => (
                <Switch
                  id="political-minting"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="political-minting" className="text-sm">
              {t('economy.settings.allowMinting')}
            </Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="political-mint-ceiling">{t('economy.settings.ceilingField')}</Label>
            <Input
              id="political-mint-ceiling"
              inputMode="numeric"
              className="w-56"
              {...form.register('mintCeiling')}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-fg-3">{t('economy.settings.mintingLevels')}</p>
      )}
    </TwoStepDialog>
  );
}

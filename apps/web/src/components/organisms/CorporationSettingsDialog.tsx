import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type {
  CorporationSettingsAsServed,
  CorporationSettingsChange,
} from '@dyingstar-admin/contracts/economie';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateCorporationSettings } from '@/hooks/useEconomieActions';
import { ApiError } from '@/lib/api';
import { bpsToPercent, formatBps, percentToBps, zPercentField } from '@/lib/economy';
import { PoliticalEntityPicker } from './PoliticalEntityPicker';

/** The form: the rate in percent (`economie`'s `corporationSettingsBody`), the fiscal home. */
const CorporationSettingsFormSchema = z.object({
  taxRate: zPercentField,
  allowDonations: z.boolean(),
  /** The political entity, or none. */
  home: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
type CorporationSettingsForm = z.infer<typeof CorporationSettingsFormSchema>;

interface CorporationSettingsDialogProps {
  corporation: { id: string; name: string };
  settings: CorporationSettingsAsServed;
  /** Name of the current fiscal home, when known. */
  homeName?: string | undefined;
  onClose: () => void;
}

/**
 * Changes a corporation's internal tax on donations, its donation policy and its fiscal home in
 * `economie` (ADR 0024 step O.2, through `svc-admin`): the form, then the changes to confirm.
 * The fiscal home decides which political entity's corporate tax applies to its treasury.
 */
export function CorporationSettingsDialog({
  corporation,
  settings,
  homeName,
  onClose,
}: CorporationSettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const update = useUpdateCorporationSettings(corporation.id);
  const form = useForm<CorporationSettingsForm>({
    resolver: zodResolver(CorporationSettingsFormSchema),
    defaultValues: {
      taxRate: bpsToPercent(settings.taxRateBps),
      allowDonations: settings.allowDonations,
      home: settings.politicalEntityId
        ? { id: settings.politicalEntityId, name: homeName ?? settings.politicalEntityId }
        : null,
    },
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as CorporationSettingsForm;
  const [confirming, setConfirming] = useState(false);

  const change: CorporationSettingsChange = {};
  let home: string | null | undefined;
  if (form.formState.isValid) {
    const taxRateBps = percentToBps(values.taxRate);
    if (taxRateBps !== settings.taxRateBps) change.taxRateBps = taxRateBps;
    if (values.allowDonations !== settings.allowDonations) {
      change.allowDonations = values.allowDonations;
    }
    const picked = values.home?.id ?? null;
    if (picked !== settings.politicalEntityId) home = picked;
  }
  const yesNo = (allowed: boolean) =>
    t(allowed ? 'economy.settings.donationsOn' : 'economy.settings.donationsOff');
  const homeLabel = (name: string | undefined) => name ?? t('economy.settings.noFiscalHome');
  const lines = [
    change.taxRateBps !== undefined && {
      label: t('economy.settings.donationTax'),
      before: formatBps(settings.taxRateBps, i18n.language),
      after: formatBps(change.taxRateBps, i18n.language),
    },
    change.allowDonations !== undefined && {
      label: t('economy.settings.donations'),
      before: yesNo(settings.allowDonations),
      after: yesNo(change.allowDonations),
    },
    home !== undefined && {
      label: t('economy.settings.fiscalHome'),
      before: homeLabel(
        settings.politicalEntityId ? (homeName ?? settings.politicalEntityId) : undefined,
      ),
      after: homeLabel(values.home?.name),
    },
  ].filter((line) => line !== false);

  const submit = form.handleSubmit(async () => {
    try {
      await update.mutateAsync({
        settings: Object.keys(change).length > 0 ? change : undefined,
        politicalEntityId: home,
      });
      toast.success(t('economy.settings.saved', { name: corporation.name }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('economy.settings.corporationTitle', { name: corporation.name })}
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
      <div className="flex w-56 flex-col gap-1.5">
        <Label htmlFor="corporation-donation-tax">
          {t('economy.settings.percent', { label: t('economy.settings.donationTax') })}
        </Label>
        <Input id="corporation-donation-tax" inputMode="decimal" {...form.register('taxRate')} />
      </div>
      <div className="flex items-center gap-2">
        <Controller
          control={form.control}
          name="allowDonations"
          render={({ field }) => (
            <Switch
              id="corporation-donations"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="corporation-donations" className="text-sm">
          {t('economy.settings.allowDonations')}
        </Label>
      </div>
      <Controller
        control={form.control}
        name="home"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>
                {t('economy.settings.fiscalHomeIs', { name: homeLabel(field.value?.name) })}
              </Label>
              {field.value && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  {t('economy.settings.detach')}
                </Button>
              )}
            </div>
            <PoliticalEntityPicker
              value={field.value?.id ?? null}
              onChange={field.onChange}
              label={t('economy.settings.searchEntity')}
            />
            <p className="text-xs text-fg-3">{t('economy.settings.fiscalHomeHint')}</p>
          </div>
        )}
      />
    </TwoStepDialog>
  );
}

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  zCorporationRecruitmentMode,
  type Corporation,
  type CorporationRecruitmentMode,
} from '@dyingstar-admin/contracts/social';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCorporation, useUpdateCorporation } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';
import { ProfilePicker } from './ProfilePicker';

const DESCRIPTION_MAX = 2000;
const RECRUITMENT: CorporationRecruitmentMode[] = ['open', 'apply', 'closed'];

/** The form, within the contract's limits (`InternalCreateCorporation`, `CorporationPatch`). */
const CorporationFormSchema = z.object({
  name: z.string().trim().min(3).max(48),
  ticker: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,5}$/),
  description: z.string().trim().max(DESCRIPTION_MAX),
  recruitment: zCorporationRecruitmentMode,
  /** Creation only: the CEO, a player or an NPC. */
  ceoId: z.string(),
});
type CorporationForm = z.infer<typeof CorporationFormSchema>;

interface CorporationDialogProps {
  /** The corporation to edit; none creates one. */
  corporation?: Corporation;
  onClose: () => void;
  /** After a creation: its id. */
  onCreated?: (id: string) => void;
}

/**
 * Creates a corporation with its CEO, or edits one (ADR 0024 step N): the form, then a summary
 * to confirm. `social` acts as the CEO, through `svc-admin`.
 */
export function CorporationDialog({ corporation, onClose, onCreated }: CorporationDialogProps) {
  const { t } = useTranslation();
  const create = useCreateCorporation();
  const update = useUpdateCorporation(corporation?.id ?? '');
  const editing = corporation !== undefined;
  const form = useForm<CorporationForm>({
    resolver: zodResolver(
      editing ? CorporationFormSchema : CorporationFormSchema.extend({ ceoId: z.uuid() }),
    ),
    defaultValues: {
      name: corporation?.name ?? '',
      ticker: corporation?.ticker ?? '',
      description: corporation?.description ?? '',
      recruitment: corporation?.recruitment ?? 'apply',
      ceoId: '',
    },
    mode: 'onChange',
  });
  const [name, ticker, recruitment] = useWatch({
    control: form.control,
    name: ['name', 'ticker', 'recruitment'],
  });
  const [confirming, setConfirming] = useState(false);

  const submit = form.handleSubmit(async ({ ceoId, description, ...values }) => {
    const body = { ...values, description: description || null };
    try {
      if (corporation) {
        await update.mutateAsync(body);
        toast.success(t('organisations.manage.saved', { name: values.name }));
      } else {
        const created = await create.mutateAsync({ ...body, ceoId });
        toast.success(t('organisations.manage.created', { name: values.name }));
        if (created) onCreated?.(created.id);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={
        corporation
          ? t('organisations.manage.editTitle', { name: corporation.name })
          : t('organisations.manage.createCorporation')
      }
      description={t('organisations.manage.hint')}
      confirming={confirming}
      summary={t('organisations.manage.corporationSummary', {
        name: name.trim(),
        ticker: ticker.trim().toUpperCase(),
        recruitment: t(`organisations.recruitment.${recruitment}`),
      })}
      canContinue={form.formState.isValid}
      pending={create.isPending || update.isPending}
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
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="corporation-name">{t('organisations.columns.name')}</Label>
          <Input id="corporation-name" maxLength={48} {...form.register('name')} />
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="corporation-ticker">{t('organisations.columns.ticker')}</Label>
          <Input id="corporation-ticker" maxLength={5} {...form.register('ticker')} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('organisations.columns.recruitment')}</Label>
        <Controller
          control={form.control}
          name="recruitment"
          render={({ field }) => (
            <OptionSelect<CorporationRecruitmentMode>
              size="default"
              label={t('organisations.columns.recruitment')}
              value={field.value}
              options={RECRUITMENT.map((r) => ({
                value: r,
                label: t(`organisations.recruitment.${r}`),
              }))}
              onChange={field.onChange}
              className="w-48"
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corporation-description">{t('organisations.manage.description')}</Label>
        <Textarea
          id="corporation-description"
          maxLength={DESCRIPTION_MAX}
          {...form.register('description')}
        />
      </div>
      {!editing && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('organisations.ceo')}</Label>
          <Controller
            control={form.control}
            name="ceoId"
            render={({ field }) => (
              <ProfilePicker
                value={field.value || null}
                onChange={field.onChange}
                label={t('organisations.manage.searchProfile')}
              />
            )}
          />
        </div>
      )}
    </TwoStepDialog>
  );
}

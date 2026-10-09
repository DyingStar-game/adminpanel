import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Label } from '@/components/ui/label';
import { useTransferCorporation, useTransferPoliticalEntity } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';

const TransferFormSchema = z.object({ playerId: z.uuid() });
type TransferForm = z.infer<typeof TransferFormSchema>;

interface TransferOrganisationDialogProps {
  kind: 'corporation' | 'politics';
  organisation: { id: string; name: string };
  /** Members who may take the lead: `social` transfers to a member only. */
  candidates: { playerId: string; displayName: string }[];
  onClose: () => void;
}

/** Gives a corporation's CEO or an entity's head office to one of its members (step N). */
export function TransferOrganisationDialog({
  kind,
  organisation,
  candidates,
  onClose,
}: TransferOrganisationDialogProps) {
  const { t } = useTranslation();
  const corporation = useTransferCorporation(organisation.id);
  const politics = useTransferPoliticalEntity(organisation.id);
  const transfer = kind === 'corporation' ? corporation : politics;
  const form = useForm<TransferForm>({
    resolver: zodResolver(TransferFormSchema),
    defaultValues: { playerId: '' },
    mode: 'onChange',
  });
  const playerId = useWatch({ control: form.control, name: 'playerId' });
  const [confirming, setConfirming] = useState(false);
  const chosen = candidates.find((c) => c.playerId === playerId)?.displayName ?? '';
  const role = t(kind === 'corporation' ? 'organisations.ceo' : 'organisations.head');

  const submit = form.handleSubmit(async (values) => {
    try {
      await transfer.mutateAsync(values.playerId);
      toast.success(t('organisations.manage.transferred', { name: chosen, role }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('organisations.manage.transferTitle', { name: organisation.name })}
      description={t(`organisations.manage.transferHint.${kind}`)}
      confirming={confirming}
      summary={t('organisations.manage.transferSummary', {
        name: chosen,
        role,
        organisation: organisation.name,
      })}
      canContinue={form.formState.isValid}
      pending={transfer.isPending}
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
      {candidates.length === 0 ? (
        <p className="text-sm text-fg-3">{t('organisations.manage.noCandidate')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>{t('organisations.manage.newLeader', { role })}</Label>
          <Controller
            control={form.control}
            name="playerId"
            render={({ field }) => (
              <OptionSelect<string>
                size="default"
                label={t('organisations.manage.newLeader', { role })}
                value={field.value}
                options={candidates.map((c) => ({ value: c.playerId, label: c.displayName }))}
                onChange={field.onChange}
                className="w-64"
              />
            )}
          />
        </div>
      )}
    </TwoStepDialog>
  );
}

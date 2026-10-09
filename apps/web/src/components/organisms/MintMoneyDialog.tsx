import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { PoliticalSettings } from '@dyingstar-admin/contracts/economie';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMintMoney } from '@/hooks/useEconomieActions';
import { ApiError } from '@/lib/api';
import { formatAmount, zAmountField } from '@/lib/economy';

const REASON_MAX = 128;

interface MintMoneyDialogProps {
  entity: { id: string; name: string };
  /** Its settings: whether it may issue money, and how much at once. */
  settings: PoliticalSettings;
  onClose: () => void;
}

/**
 * Issues money into a political treasury in `economie` (ADR 0024 step O.3, through
 * `svc-admin`): the amount and why, then a summary to confirm. `economie` allows it only where
 * the settings do, within their ceiling, and takes no idempotency key: the confirm button is
 * off while the call runs.
 */
export function MintMoneyDialog({ entity, settings, onClose }: MintMoneyDialogProps) {
  const { t, i18n } = useTranslation();
  const mint = useMintMoney(entity.id);
  const ceiling = settings.mintCeiling;
  const schema = useMemo(
    () =>
      z.object({
        amount: zAmountField.refine(
          (text) => Number(text) >= 1 && (ceiling === 0 || Number(text) <= ceiling),
        ),
        reason: z.string().trim().min(1).max(REASON_MAX),
      }),
    [ceiling],
  );
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', reason: '' },
    mode: 'onChange',
  });
  const [amount, reason] = useWatch({ control: form.control, name: ['amount', 'reason'] });
  const [confirming, setConfirming] = useState(false);
  const money = (n: number) => formatAmount(n, 'credits', i18n.language);

  const submit = form.handleSubmit(async (values) => {
    try {
      await mint.mutateAsync({ amount: Number(values.amount), reason: values.reason });
      toast.success(
        t('economy.mint.done', { amount: money(Number(values.amount)), name: entity.name }),
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('economy.mint.title', { name: entity.name })}
      description={t('economy.mint.hint')}
      confirming={confirming}
      summary={
        <div className="flex flex-col gap-1">
          <p>
            {t('economy.mint.summary', { amount: money(Number(amount) || 0), name: entity.name })}
          </p>
          <p>{t('economy.movement.reason', { reference: reason.trim() })}</p>
        </div>
      }
      canContinue={settings.allowMinting && form.formState.isValid}
      pending={mint.isPending}
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
      {settings.allowMinting ? (
        <>
          <div className="flex w-56 flex-col gap-1.5">
            <Label htmlFor="mint-amount">{t('economy.movement.amount')}</Label>
            <Input id="mint-amount" inputMode="numeric" {...form.register('amount')} />
          </div>
          <p className="text-xs text-fg-3">
            {ceiling > 0
              ? t('economy.mintCeiling', { amount: money(ceiling) })
              : t('economy.mint.noCeiling')}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mint-reason">{t('economy.movement.reference')}</Label>
            <Input id="mint-reason" maxLength={REASON_MAX} {...form.register('reason')} />
          </div>
        </>
      ) : (
        <p className="text-sm">{t('economy.mint.disabled')}</p>
      )}
    </TwoStepDialog>
  );
}

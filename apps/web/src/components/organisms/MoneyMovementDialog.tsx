import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  zInternalMovementType,
  type InternalMovementType,
} from '@dyingstar-admin/contracts/economie';
import type { WalletHolder } from '@dyingstar-admin/schemas';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMoveMoney } from '@/hooks/useEconomieActions';
import { ApiError } from '@/lib/api';
import { formatAmount, movementKey, zAmountField } from '@/lib/economy';

const REFERENCE_MAX = 128;

interface MoneyMovementDialogProps {
  holder: WalletHolder;
  /** The holder: its id, and its name for the summary. */
  target: { id: string; name: string };
  direction: 'credit' | 'debit';
  /** Its balance in credits now (0 without an account). */
  balance: number;
  onClose: () => void;
}

/**
 * Credits or debits a wallet in `economie` (ADR 0024 step O.3, through `svc-admin`): the amount,
 * the type of movement and why, then a summary to confirm. The `externalId` is drawn when the
 * dialog opens, so sending it twice records it once; a debit never goes below the balance.
 */
export function MoneyMovementDialog({
  holder,
  target,
  direction,
  balance,
  onClose,
}: MoneyMovementDialogProps) {
  const { t, i18n } = useTranslation();
  const move = useMoveMoney(holder, target.id, direction);
  const [externalId] = useState(movementKey);
  const schema = useMemo(
    () =>
      z.object({
        amount: zAmountField
          .refine((text) => Number(text) >= 1)
          .refine((text) => direction === 'credit' || Number(text) <= balance, {
            message: 'overdraft',
          }),
        type: zInternalMovementType,
        reference: z.string().trim().min(1).max(REFERENCE_MAX),
      }),
    [direction, balance],
  );
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      type: direction === 'credit' ? 'deposit' : 'withdrawal',
      reference: '',
    },
    mode: 'onChange',
  });
  const [amount, type, reference] = useWatch({
    control: form.control,
    name: ['amount', 'type', 'reference'],
  });
  const [confirming, setConfirming] = useState(false);
  const value = Number(amount) || 0;
  const money = (n: number) => formatAmount(n, 'credits', i18n.language);
  const overdraft = form.formState.errors.amount?.message === 'overdraft';

  const submit = form.handleSubmit(async (values) => {
    try {
      await move.mutateAsync({ ...values, amount: Number(values.amount), externalId });
      toast.success(
        t(`economy.movement.done.${direction}`, { amount: money(value), name: target.name }),
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t(`economy.movement.title.${direction}`, { name: target.name })}
      description={t('economy.movement.hint')}
      confirming={confirming}
      summary={
        <div className="flex flex-col gap-1">
          <p>
            {t(`economy.movement.summary.${direction}`, {
              amount: money(value),
              name: target.name,
              type: t(`economy.types.${type}`),
            })}
          </p>
          <p>{t('economy.movement.reason', { reference: reference.trim() })}</p>
          <p>
            {t('economy.movement.balanceAfter', {
              before: money(balance),
              after: money(direction === 'credit' ? balance + value : balance - value),
            })}
          </p>
        </div>
      }
      canContinue={form.formState.isValid}
      pending={move.isPending}
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
        <div className="flex w-48 flex-col gap-1.5">
          <Label htmlFor="movement-amount">{t('economy.movement.amount')}</Label>
          <Input id="movement-amount" inputMode="numeric" {...form.register('amount')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('economy.movement.type')}</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <OptionSelect<InternalMovementType>
                label={t('economy.movement.type')}
                value={field.value}
                options={zInternalMovementType.options.map((option) => ({
                  value: option,
                  label: t(`economy.types.${option}`),
                }))}
                onChange={field.onChange}
                className="w-48"
              />
            )}
          />
        </div>
      </div>
      <p className={overdraft ? 'text-xs text-destructive' : 'text-xs text-fg-3'}>
        {direction === 'debit'
          ? t('economy.movement.available', { balance: money(balance) })
          : t('economy.movement.current', { balance: money(balance) })}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="movement-reference">{t('economy.movement.reference')}</Label>
        <Input id="movement-reference" maxLength={REFERENCE_MAX} {...form.register('reference')} />
      </div>
    </TwoStepDialog>
  );
}

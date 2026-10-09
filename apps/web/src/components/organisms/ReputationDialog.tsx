import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdjustReputation } from '@/hooks/useModerationActions';
import { ApiError } from '@/lib/api';

const REASON_MAX = 128;

/** The form, within the contract's limits (`zAdjustReputationBody`: −100…100, reason ≤ 128). */
const ReputationFormSchema = z.object({
  delta: z
    .string()
    .trim()
    .regex(/^[+-]?\d+$/)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(-100)
        .max(100)
        .refine((value) => value !== 0),
    ),
  reason: z.string().trim().min(1).max(REASON_MAX),
});
type ReputationFormInput = z.input<typeof ReputationFormSchema>;
type ReputationForm = z.output<typeof ReputationFormSchema>;

interface ReputationDialogProps {
  playerId: string;
  playerName: string;
  reputation: number;
  onClose: () => void;
}

/** Adjusts a player's reputation by −100…100, with a reason, then confirms (`admin`+). */
export function ReputationDialog({
  playerId,
  playerName,
  reputation,
  onClose,
}: ReputationDialogProps) {
  const { t } = useTranslation();
  const adjust = useAdjustReputation();
  const form = useForm<ReputationFormInput, unknown, ReputationForm>({
    resolver: zodResolver(ReputationFormSchema),
    defaultValues: { delta: '', reason: '' },
    mode: 'onChange',
  });
  const [delta, reason] = useWatch({ control: form.control, name: ['delta', 'reason'] });
  const [confirming, setConfirming] = useState(false);
  const value = Number(delta);
  const signed = value > 0 ? `+${value}` : String(value);

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await adjust.mutateAsync({ playerId, ...values });
      toast.success(
        t('moderation.actions.reputationDone', {
          name: playerName,
          reputation: result?.reputation,
        }),
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-110">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {t('moderation.actions.reputationTitle', { name: playerName })}
            </DialogTitle>
            <DialogDescription>
              {t('moderation.actions.reputationHint', { reputation })}
            </DialogDescription>
          </DialogHeader>
          {confirming ? (
            <p role="alert" className="rounded-lg border px-3 py-2 text-sm">
              {t('moderation.actions.reputationConfirm', {
                name: playerName,
                delta: signed,
                from: reputation,
                to: reputation + value,
                reason: reason.trim(),
              })}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reputation-delta">{t('moderation.columns.delta')}</Label>
                <Input
                  id="reputation-delta"
                  type="number"
                  min={-100}
                  max={100}
                  step={1}
                  className="w-32"
                  {...form.register('delta')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reputation-reason">{t('moderation.columns.reason')}</Label>
                <Textarea
                  id="reputation-reason"
                  maxLength={REASON_MAX}
                  {...form.register('reason')}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={confirming ? () => setConfirming(false) : onClose}
            >
              {confirming ? t('moderation.actions.back') : t('confirm.cancel')}
            </Button>
            {confirming ? (
              <Button type="submit" disabled={adjust.isPending}>
                {t('moderation.actions.confirm')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={!form.formState.isValid}
                onClick={() => setConfirming(true)}
              >
                {t('moderation.actions.continue')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

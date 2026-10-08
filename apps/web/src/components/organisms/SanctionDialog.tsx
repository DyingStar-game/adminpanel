import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { zSanctionType, type SanctionType } from '@dyingstar-admin/contracts/social';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/useCan';
import { useIssueSanction } from '@/hooks/useModerationActions';
import { ApiError } from '@/lib/api';

/** Durations offered, in hours; `none` is no end. */
const DURATIONS = ['1', '24', '168', '720', 'none'] as const;
type Duration = (typeof DURATIONS)[number];
const REASON_MAX = 256;

/** The form, within the contract's limits (`zIssueSanctionBody`: reason ≤ 256, ≤ 8760 h). */
const SanctionFormSchema = z.object({
  type: zSanctionType,
  duration: z.enum(DURATIONS),
  reason: z.string().trim().min(1).max(REASON_MAX),
});
type SanctionForm = z.infer<typeof SanctionFormSchema>;

interface SanctionDialogProps {
  playerId: string;
  playerName: string;
  onClose: () => void;
}

/**
 * Sanctions a player, in two steps: the form, then a summary to confirm (ADR 0024 step 3).
 * Suspension and ban are offered to `admin` and above only; `social` checks it again.
 */
export function SanctionDialog({ playerId, playerName, onClose }: SanctionDialogProps) {
  const { t } = useTranslation();
  const can = useCan();
  const issue = useIssueSanction();
  const types: SanctionType[] = can('social.sanctionSevere')
    ? ['warning', 'mute', 'suspension', 'ban']
    : ['warning', 'mute'];
  const form = useForm<SanctionForm>({
    resolver: zodResolver(SanctionFormSchema),
    defaultValues: { type: 'warning', duration: 'none', reason: '' },
    mode: 'onChange',
  });
  const [type, duration, reason] = useWatch({
    control: form.control,
    name: ['type', 'duration', 'reason'],
  });
  const [confirming, setConfirming] = useState(false);
  const durationLabel = (d: Duration) => t(`moderation.actions.durations.${d}`);
  // `social` ends a warning at once: no duration to ask.
  const shownDuration = type === 'warning' ? t('moderation.oneOff') : durationLabel(duration);

  const submit = form.handleSubmit(async (values) => {
    try {
      await issue.mutateAsync({
        playerId,
        type: values.type,
        reason: values.reason,
        durationHours:
          values.type === 'warning' || values.duration === 'none' ? null : Number(values.duration),
      });
      toast.success(
        t('moderation.actions.sanctioned', {
          type: t(`moderation.sanctionType.${values.type}`),
          name: playerName,
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
      <DialogContent className="sm:max-w-120">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('moderation.actions.sanctionTitle', { name: playerName })}</DialogTitle>
            <DialogDescription>{t('moderation.actions.sanctionHint')}</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <p role="alert" className="rounded-lg border border-destructive/50 px-3 py-2 text-sm">
              {t('moderation.actions.sanctionConfirm', {
                type: t(`moderation.sanctionType.${type}`),
                name: playerName,
                duration: shownDuration,
                reason: reason.trim(),
              })}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{t('moderation.columns.type')}</Label>
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <OptionSelect<SanctionType>
                        label={t('moderation.columns.type')}
                        value={field.value}
                        options={types.map((v) => ({
                          value: v,
                          label: t(`moderation.sanctionType.${v}`),
                        }))}
                        onChange={field.onChange}
                        className="w-40"
                      />
                    )}
                  />
                </div>
                {type !== 'warning' && (
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('moderation.actions.duration')}</Label>
                    <Controller
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <OptionSelect<Duration>
                          label={t('moderation.actions.duration')}
                          value={field.value}
                          options={DURATIONS.map((d) => ({ value: d, label: durationLabel(d) }))}
                          onChange={field.onChange}
                          className="w-40"
                        />
                      )}
                    />
                  </div>
                )}
              </div>
              {type === 'warning' && (
                <p className="text-xs text-fg-3">{t('moderation.actions.warningHint')}</p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sanction-reason">{t('moderation.columns.reason')}</Label>
                <Textarea
                  id="sanction-reason"
                  maxLength={REASON_MAX}
                  {...form.register('reason')}
                />
                <span className="text-right text-xs text-fg-3">
                  {reason.length} / {REASON_MAX}
                </span>
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
              <Button
                type="submit"
                className="border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25"
                disabled={issue.isPending}
              >
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

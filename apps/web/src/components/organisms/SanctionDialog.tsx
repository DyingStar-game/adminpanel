import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { SanctionType } from '@dyingstar-admin/contracts/social';
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
  const [type, setType] = useState<SanctionType>('warning');
  const [duration, setDuration] = useState<Duration>('none');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const durationLabel = (d: Duration) => t(`moderation.actions.durations.${d}`);
  const valid = reason.trim().length > 0 && reason.length <= REASON_MAX;

  const submit = async () => {
    try {
      await issue.mutateAsync({
        playerId,
        type,
        reason: reason.trim(),
        durationHours: type === 'warning' || duration === 'none' ? null : Number(duration),
      });
      toast.success(
        t('moderation.actions.sanctioned', {
          type: t(`moderation.sanctionType.${type}`),
          name: playerName,
        }),
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>{t('moderation.actions.sanctionTitle', { name: playerName })}</DialogTitle>
          <DialogDescription>{t('moderation.actions.sanctionHint')}</DialogDescription>
        </DialogHeader>
        {confirming ? (
          <p role="alert" className="rounded-lg border border-destructive/50 px-3 py-2 text-sm">
            {t('moderation.actions.sanctionConfirm', {
              type: t(`moderation.sanctionType.${type}`),
              name: playerName,
              duration: type === 'warning' ? t('moderation.oneOff') : durationLabel(duration),
              reason: reason.trim(),
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('moderation.columns.type')}</Label>
                <OptionSelect<SanctionType>
                  label={t('moderation.columns.type')}
                  value={type}
                  options={types.map((v) => ({
                    value: v,
                    label: t(`moderation.sanctionType.${v}`),
                  }))}
                  onChange={setType}
                  className="w-40"
                />
              </div>
              {type !== 'warning' && (
                <div className="flex flex-col gap-1.5">
                  <Label>{t('moderation.actions.duration')}</Label>
                  <OptionSelect<Duration>
                    label={t('moderation.actions.duration')}
                    value={duration}
                    options={DURATIONS.map((d) => ({ value: d, label: durationLabel(d) }))}
                    onChange={setDuration}
                    className="w-40"
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
                value={reason}
                maxLength={REASON_MAX}
                onChange={(event) => setReason(event.target.value)}
              />
              <span className="text-right text-xs text-fg-3">
                {reason.length} / {REASON_MAX}
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? t('moderation.actions.back') : t('confirm.cancel')}
          </Button>
          {confirming ? (
            <Button
              className="border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25"
              disabled={issue.isPending}
              onClick={() => void submit()}
            >
              {t('moderation.actions.confirm')}
            </Button>
          ) : (
            <Button disabled={!valid} onClick={() => setConfirming(true)}>
              {t('moderation.actions.continue')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

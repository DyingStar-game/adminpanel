import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const value = Number(delta);
  const valid =
    delta.trim() !== '' &&
    Number.isInteger(value) &&
    value !== 0 &&
    Math.abs(value) <= 100 &&
    reason.trim().length > 0;
  const signed = value > 0 ? `+${value}` : String(value);

  const submit = async () => {
    try {
      const result = await adjust.mutateAsync({ playerId, delta: value, reason: reason.trim() });
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
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>{t('moderation.actions.reputationTitle', { name: playerName })}</DialogTitle>
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
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reputation-reason">{t('moderation.columns.reason')}</Label>
              <Textarea
                id="reputation-reason"
                value={reason}
                maxLength={REASON_MAX}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? t('moderation.actions.back') : t('confirm.cancel')}
          </Button>
          {confirming ? (
            <Button disabled={adjust.isPending} onClick={() => void submit()}>
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

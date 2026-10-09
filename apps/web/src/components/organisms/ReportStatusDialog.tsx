import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ReportView } from '@dyingstar-admin/contracts/social';
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
import { useUpdateReportStatus } from '@/hooks/useModerationActions';
import { ApiError } from '@/lib/api';

export type ReportMove = 'reviewing' | 'resolved' | 'dismissed';
const NOTE_MAX = 1000;

/** The form, within the contract's limit (`zUpdateReportStatusBody`: note ≤ 1000). */
const NoteFormSchema = z.object({ note: z.string().trim().max(NOTE_MAX) });
type NoteForm = z.infer<typeof NoteFormSchema>;

interface ReportStatusDialogProps {
  report: ReportView;
  status: ReportMove;
  onClose: () => void;
}

/**
 * Claims a report, accepts or dismisses it, with an optional note: the form, then a
 * summary to confirm (ADR 0024 step 3). Accepting and dismissing close it for good.
 */
export function ReportStatusDialog({ report, status, onClose }: ReportStatusDialogProps) {
  const { t } = useTranslation();
  const update = useUpdateReportStatus();
  const form = useForm<NoteForm>({
    resolver: zodResolver(NoteFormSchema),
    defaultValues: { note: '' },
    mode: 'onChange',
  });
  const note = useWatch({ control: form.control, name: 'note' });
  const [confirming, setConfirming] = useState(false);
  const name = report.targetName ?? report.targetPlayerId?.slice(0, 8) ?? '—';
  const statusLabel = t(`moderation.reportStatus.${status}`);
  // `social` changes reputation only for a player's report on a player.
  const reputationHint =
    status !== 'reviewing' && report.reporterId && report.targetPlayerId
      ? t(`moderation.report.reputation.${status}`, { name })
      : null;

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: report.id,
        status,
        ...(values.note ? { note: values.note } : {}),
      });
      toast.success(t('moderation.report.moved', { id: report.id, status: statusLabel }));
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
            <DialogTitle>
              {t(`moderation.report.moveTitle.${status}`, { id: report.id })}
            </DialogTitle>
            <DialogDescription>{t(`moderation.report.moveHint.${status}`)}</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <p role="alert" className="rounded-lg border border-destructive/50 px-3 py-2 text-sm">
              {t('moderation.report.moveConfirm', { id: report.id, name, status: statusLabel })}
              {note.trim() && ` “${note.trim()}”`}
              {reputationHint && ` ${reputationHint}`}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-note">{t('moderation.report.note')}</Label>
              <Textarea id="report-note" maxLength={NOTE_MAX} {...form.register('note')} />
              <span className="flex justify-between gap-2 text-xs text-fg-3">
                <span>{t('moderation.report.noteHint')}</span>
                <span>
                  {note.length} / {NOTE_MAX}
                </span>
              </span>
              {reputationHint && <p className="text-xs text-fg-3">{reputationHint}</p>}
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
                disabled={update.isPending}
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

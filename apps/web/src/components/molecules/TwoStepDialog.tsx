import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TwoStepDialogProps {
  title: string;
  description: string;
  /** Second step: the summary is shown instead of the fields. */
  confirming: boolean;
  summary: ReactNode;
  /** The fields of the first step. */
  children: ReactNode;
  canContinue: boolean;
  pending: boolean;
  onContinue: () => void;
  onBack: () => void;
  onCancel: () => void;
  /** Submit of the form, sent from the second step. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  labels: { cancel: string; back: string; continue: string; confirm: string };
}

/**
 * A write in two steps: the form, then a summary to confirm (the moderation actions' pattern,
 * ADR 0024). Pure: the organism holds the form and the call.
 */
export function TwoStepDialog({
  title,
  description,
  confirming,
  summary,
  children,
  canContinue,
  pending,
  onContinue,
  onBack,
  onCancel,
  onSubmit,
  labels,
}: TwoStepDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <div role="alert" className="rounded-lg border border-destructive/50 px-3 py-2 text-sm">
              {summary}
            </div>
          ) : (
            <div className="flex flex-col gap-4">{children}</div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={confirming ? onBack : onCancel}>
              {confirming ? labels.back : labels.cancel}
            </Button>
            {confirming ? (
              <Button
                type="submit"
                className="border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25"
                disabled={pending}
              >
                {labels.confirm}
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={!canContinue} onClick={onContinue}>
                {labels.continue}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

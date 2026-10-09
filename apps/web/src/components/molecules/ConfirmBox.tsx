import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmBoxProps {
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline destructive confirmation, as in the mock-up inspector. */
export function ConfirmBox({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmBoxProps) {
  return (
    <div
      role="alertdialog"
      className="flex flex-col gap-2 rounded-lg border border-destructive p-3"
    >
      <div className="text-xs leading-relaxed">{message}</div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

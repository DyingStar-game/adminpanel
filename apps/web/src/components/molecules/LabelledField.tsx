import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

interface LabelledFieldProps {
  /** Id of the control, tied to its label and its messages. */
  id: string;
  label: string;
  /** Shown under the control while there is no error. */
  hint?: string | undefined;
  /** The control's error, already translated; announced to screen readers. */
  error?: string | undefined;
  className?: string;
  /** The control, given `id` and `aria-describedby` by the caller. */
  children: ReactNode;
}

/** A form control with its label, and its error (or hint) under it. Pure. */
export function LabelledField({ id, label, hint, error, className, children }: LabelledFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <span id={`${id}-message`} role="alert" className="text-2xs text-destructive">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-message`} className="text-2xs text-fg-3">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

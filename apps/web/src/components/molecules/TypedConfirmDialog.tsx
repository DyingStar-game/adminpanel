import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TypedConfirmDialogProps {
  title: string;
  description: ReactNode;
  /** The word to type before the action is allowed (case-insensitive). */
  word: string;
  /** Label of the field, which names the word. */
  prompt: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation of an action that cannot be undone (deleting NPCs and their accounts): the
 * action is allowed once the given word is typed. Pure.
 */
export function TypedConfirmDialog({
  title,
  description,
  word,
  prompt,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === word.toLowerCase();
  return (
    <AlertDialog open onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2 text-sm">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typed-confirm">{prompt}</Label>
          <Input
            id="typed-confirm"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || pending}
            onClick={(event) => {
              // The caller closes the dialog once the action is done.
              event.preventDefault();
              onConfirm();
            }}
            className="border-destructive/40! bg-destructive/15! text-destructive! shadow-none! hover:bg-destructive/25!"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

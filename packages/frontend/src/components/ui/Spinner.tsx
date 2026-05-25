import { cn } from '@/lib/cn';

/** Circular loading indicator. */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-5 h-5 border-2 border-ds-border border-t-ds-accent rounded-full animate-spin',
        className,
      )}
    />
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse bg-ds-surface-elevated rounded-lg', className)}
    />
  );
}

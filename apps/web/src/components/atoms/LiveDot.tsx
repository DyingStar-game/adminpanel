import { cn } from '@/lib/cn';

/** Green when live refresh runs, grey when paused. */
export function LiveDot({ live, className }: { live: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-[7px] rounded-full',
        live ? 'bg-green-500' : 'bg-fg-3',
        className,
      )}
    />
  );
}

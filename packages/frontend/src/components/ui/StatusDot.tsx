import { cn } from '@/lib/cn';

type Status = 'online' | 'offline' | 'warning';

const colors: Record<Status, string> = {
  online: 'bg-ds-success',
  offline: 'bg-ds-muted',
  warning: 'bg-ds-warning',
};

/** Small colored dot indicating server or service status. */
export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', colors[status], className)}
      title={status}
    />
  );
}

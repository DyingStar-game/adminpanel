import { cn } from '@/lib/cn';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const styles: Record<Variant, string> = {
  default: 'bg-ds-muted/15 text-ds-muted border-ds-muted/30',
  success: 'bg-ds-success/15 text-ds-success border-ds-success/30',
  warning: 'bg-ds-warning/15 text-ds-warning border-ds-warning/30',
  danger: 'bg-ds-danger/15 text-ds-danger border-ds-danger/30',
  info: 'bg-ds-accent/15 text-ds-text border-ds-accent/30',
};

/** Small labeled pill for status or category display. */
export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

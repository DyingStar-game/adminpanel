import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

/** Surface card container with border and rounded corners. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-ds-surface border border-ds-border rounded-xl', className)}
      {...props}
    />
  );
}

/** Card section header with bottom border. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-ds-border', className)} {...props} />;
}

/** Card body padding wrapper. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

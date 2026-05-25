import { cn } from '@/lib/cn';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

/** Text input with admin panel focus styles. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 text-sm rounded-lg bg-ds-surface-elevated border border-ds-border',
        'placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-1 focus:ring-ds-accent/30 transition-all duration-150',
        className,
      )}
      {...props}
    />
  );
}

/** Multi-line text area with monospace-friendly styling. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full px-3 py-2 text-sm font-mono rounded-lg bg-ds-surface-elevated border border-ds-border min-h-[120px]',
        'placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-1 focus:ring-ds-accent/30 transition-all duration-150',
        className,
      )}
      {...props}
    />
  );
}

/** Native select with matching surface styles. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm rounded-lg bg-ds-surface-elevated border border-ds-border',
        'focus:border-ds-accent focus:outline-none focus:ring-1 focus:ring-ds-accent/30 transition-all duration-150',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Uppercase field label for forms. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block text-xs text-ds-muted mb-1.5 uppercase tracking-wider', className)}>
      {children}
    </label>
  );
}

import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[rgba(255,186,8,0.15)] border border-ds-accent text-ds-text hover:bg-[rgba(255,186,8,0.25)] hover:shadow-[0_0_12px_rgba(255,186,8,0.3)]',
  secondary: 'bg-ds-surface-elevated border border-ds-border text-gray-200 hover:bg-ds-surface-hover',
  ghost: 'bg-transparent text-ds-muted hover:bg-ds-surface-hover hover:text-gray-200',
  danger: 'bg-ds-danger/15 border border-ds-danger/40 text-ds-danger hover:bg-ds-danger/25',
};

/** Styled button with variant and size presets. */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

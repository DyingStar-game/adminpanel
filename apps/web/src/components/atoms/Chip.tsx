import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { ArrowRightIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const chipVariants = cva('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs', {
  variants: {
    variant: {
      data: 'bg-background',
      link: 'cursor-pointer border-link/40 bg-link-bg text-link transition-colors hover:border-link hover:bg-link/15 focus-visible:ring-2 focus-visible:ring-link focus-visible:outline-none',
    },
  },
  defaultVariants: { variant: 'data' },
});

type ChipProps =
  | ({ variant?: 'data' } & ComponentProps<'span'>)
  | ({ variant: 'link' } & ComponentProps<'button'>);

/**
 * Small framed value (a readout, a fact) — or, as `link`, a way to another page: link colour,
 * tinted background and a trailing arrow, so it does not read as one more value.
 */
export function Chip(props: ChipProps) {
  if (props.variant === 'link') {
    const { variant, className, children, ...rest } = props;
    return (
      <button type="button" className={cn(chipVariants({ variant }), className)} {...rest}>
        {children}
        <ArrowRightIcon aria-hidden size={12} />
      </button>
    );
  }
  const { variant, className, ...rest } = props;
  return <span className={cn(chipVariants({ variant }), className)} {...rest} />;
}

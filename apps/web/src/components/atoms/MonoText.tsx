import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'muted' | 'subtle';

const tones: Record<Tone, string> = {
  default: 'text-foreground',
  muted: 'text-fg-2',
  subtle: 'text-fg-3',
};

/** Monospaced text for identifiers, keys and raw values. */
export function MonoText({
  tone = 'default',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return <span className={cn('font-mono text-xs', tones[tone], className)} {...props} />;
}

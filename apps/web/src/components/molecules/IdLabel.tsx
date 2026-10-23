import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { cn } from '@/lib/cn';
import { shortId } from '@/lib/format';

interface IdLabelProps {
  id: string;
  /** The whole id instead of its first eight characters. */
  full?: boolean;
  tone?: 'default' | 'muted' | 'subtle';
  /** Accessible name of the copy button; defaults to "Copy UUID". */
  copyLabel?: string;
  className?: string;
}

/**
 * An identifier as the panel shows it everywhere: monospaced, short unless `full` (the whole id
 * in its title), with a button copying the whole id.
 */
export function IdLabel({ id, full = false, tone = 'subtle', copyLabel, className }: IdLabelProps) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <MonoText tone={tone} title={id} className="truncate">
        {full ? id : shortId(id)}
      </MonoText>
      <CopyButton value={id} {...(copyLabel ? { label: copyLabel } : {})} />
    </span>
  );
}

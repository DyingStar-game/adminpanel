import { cn } from '@/lib/cn';
import { typeColor } from '@/lib/objectTypes';

interface TypeDotProps {
  objectType: string;
  /** `round` in graphs and lists, `square` in headers (as in the mock-up). */
  shape?: 'round' | 'square';
  className?: string;
}

/** Coloured marker identifying an object type. */
export function TypeDot({ objectType, shape = 'round', className }: TypeDotProps) {
  return (
    <span
      aria-hidden
      data-type={objectType}
      className={cn(
        'inline-block size-2 shrink-0',
        shape === 'round' ? 'rounded-full' : 'rounded-[2px]',
        className,
      )}
      style={{ background: typeColor(objectType) }}
    />
  );
}

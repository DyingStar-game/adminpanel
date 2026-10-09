import { cva, type VariantProps } from 'class-variance-authority';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';

/**
 * Sizes: `sm` (compact) in the top bar and the filters, `default` in forms, the height and text
 * of an `Input` beside it.
 */
const optionSelectVariants = cva('', {
  variants: { size: { sm: 'h-7 text-xs', default: 'h-8 text-sm' } },
  defaultVariants: { size: 'sm' },
});

interface OptionSelectProps<T extends string> extends VariantProps<typeof optionSelectVariants> {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

/** Labelled select: compact in the top bar and filters, full size in forms (`size`). */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
  size,
}: OptionSelectProps<T>) {
  const item = size === 'default' ? 'text-sm' : 'text-xs';
  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange(v as T)}
      disabled={options.length === 0}
    >
      <SelectTrigger
        size={size === 'default' ? 'default' : 'sm'}
        aria-label={label}
        className={cn(optionSelectVariants({ size }), className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={item}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

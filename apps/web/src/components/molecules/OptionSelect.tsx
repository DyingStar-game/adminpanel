import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';

interface OptionSelectProps<T extends string> {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

/** Compact labelled select used in the top bar (game server, language). */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
}: OptionSelectProps<T>) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange(v as T)}
      disabled={options.length === 0}
    >
      <SelectTrigger size="sm" aria-label={label} className={cn('h-7 text-xs', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

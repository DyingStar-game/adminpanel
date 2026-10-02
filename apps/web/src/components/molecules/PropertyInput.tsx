import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { PropertyKind } from '@/lib/propertyForm';

interface PropertyInputProps {
  id: string;
  kind: PropertyKind;
  /** Raw text (`x,y,z` for vectors, JSON for complex values). */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  label: string;
}

/** Input matching a property's editor kind (ADR 0008). */
export function PropertyInput({
  id,
  kind,
  value,
  onChange,
  invalid = false,
  label,
}: PropertyInputProps) {
  const field = cn('h-7 font-mono text-xs', invalid && 'border-destructive');

  if (kind === 'boolean') {
    return (
      <Switch
        id={id}
        aria-label={label}
        checked={value === 'true'}
        onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
      />
    );
  }
  if (kind === 'vec3') {
    const parts = value.split(',');
    return (
      <div className="grid grid-cols-3 gap-1" role="group" aria-label={label}>
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <Input
            key={axis}
            id={i === 0 ? id : undefined}
            aria-label={`${label} ${axis}`}
            inputMode="decimal"
            className={field}
            value={parts[i] ?? ''}
            onChange={(e) => {
              const next = [0, 1, 2].map((j) => (j === i ? e.target.value : (parts[j] ?? '')));
              onChange(next.join(','));
            }}
          />
        ))}
      </div>
    );
  }
  if (kind === 'json') {
    return (
      <Textarea
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        spellCheck={false}
        className={cn('min-h-16 font-mono text-xs', invalid && 'border-destructive')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      id={id}
      aria-label={label}
      aria-invalid={invalid}
      inputMode={kind === 'number' ? 'decimal' : undefined}
      className={field}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

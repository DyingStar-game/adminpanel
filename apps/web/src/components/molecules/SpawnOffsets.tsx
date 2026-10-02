import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { offsetValid, type OffsetKey, type Offsets } from '@/lib/spawn';

interface SpawnOffsetsProps {
  id: string;
  /** Values shown: raw text typed by the user, else the defaults. */
  values: Offsets;
  raw: Partial<Record<OffsetKey, string>>;
  onChange: (key: OffsetKey, value: string) => void;
}

/** Distance and height fields used to place an item next to a reference (ADR 0017). */
export function SpawnOffsets({ id, values, raw, onChange }: SpawnOffsetsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['distance', 'height'] as const).map((key) => {
        const invalid = !offsetValid(values[key]);
        return (
          <div key={key} className="flex items-center gap-1.5">
            <Label htmlFor={`${id}-${key}`} className="text-2xs">
              {t(`duplicate.${key}`)}
            </Label>
            <Input
              id={`${id}-${key}`}
              inputMode="decimal"
              value={raw[key] ?? String(values[key])}
              onChange={(e) => onChange(key, e.target.value)}
              aria-invalid={invalid}
              className={cn('h-7 w-16 font-mono text-xs', invalid && 'border-destructive')}
            />
          </div>
        );
      })}
      <span className="text-2xs text-fg-3">{t('duplicate.distanceHint')}</span>
    </div>
  );
}

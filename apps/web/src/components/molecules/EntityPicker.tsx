import { useMemo, useState } from 'react';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/cn';

export interface EntityOption {
  uuid: string;
  label: string;
  objectType: string;
  /** Short note next to the label (e.g. "NPC"). */
  hint?: string | undefined;
}

interface EntityPickerProps {
  options: EntityOption[];
  value: string | null;
  onChange: (uuid: string) => void;
  labels: { field: string; empty: string };
  /** The caller searches itself (e.g. on the server): `options` are shown as given. */
  onQueryChange?: ((query: string) => void) | undefined;
}

const MAX_OPTIONS = 50;

/** Searchable list to pick one entity (e.g. the player to spawn next to). */
export function EntityPicker({
  options,
  value,
  onChange,
  labels,
  onQueryChange,
}: EntityPickerProps) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options
      .filter(
        (o) =>
          onQueryChange ||
          !needle ||
          o.label.toLowerCase().includes(needle) ||
          o.uuid.startsWith(needle),
      )
      .slice(0, MAX_OPTIONS);
  }, [options, query, onQueryChange]);

  return (
    <Command label={labels.field} shouldFilter={false} className="rounded-lg border">
      <CommandInput
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          onQueryChange?.(next);
        }}
        placeholder={labels.field}
      />
      <CommandList className="max-h-48">
        <CommandEmpty>{labels.empty}</CommandEmpty>
        {visible.map((option) => (
          <CommandItem
            key={option.uuid}
            value={option.uuid}
            onSelect={() => onChange(option.uuid)}
            aria-selected={option.uuid === value}
            className={cn('flex items-center gap-2', option.uuid === value && 'bg-link-bg')}
          >
            <TypeDot objectType={option.objectType} />
            <span className="min-w-0 flex-1 truncate text-xs">{option.label}</span>
            {option.hint && (
              <MonoText tone="subtle" className="text-3xs">
                {option.hint}
              </MonoText>
            )}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}

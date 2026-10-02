import { useMemo, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';

export interface SceneOption {
  scenename: string;
  /** Type of the items using it (`''` for scenes only declared by a schematic). */
  objectType: string;
  count: number;
}

interface SceneComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** A known scene was picked from the list (e.g. to fill an empty type). */
  onPick?: (option: SceneOption) => void;
  options: SceneOption[];
  /** Scenes of this type are listed first. */
  preferredType?: string | undefined;
  labels: {
    field: string;
    preferred: string;
    others: string;
    empty: string;
    count: (n: number) => string;
  };
}

/** Max options rendered at once: the list filters as the user types. */
const MAX_OPTIONS = 40;

/**
 * `scenename` field: free text, plus a filtered list of the scenes already in use (the
 * preferred type first). Typing "truck" finds `…/trucks/truck.tscn`.
 */
export function SceneCombobox({
  id,
  value,
  onChange,
  onPick,
  options,
  preferredType,
  labels,
}: SceneComboboxProps) {
  const [open, setOpen] = useState(false);
  const { preferred, others } = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const matching = options.filter((o) => !needle || o.scenename.toLowerCase().includes(needle));
    return {
      preferred: matching.filter((o) => o.objectType === preferredType).slice(0, MAX_OPTIONS),
      others: matching.filter((o) => o.objectType !== preferredType).slice(0, MAX_OPTIONS),
    };
  }, [options, value, preferredType]);

  const pick = (option: SceneOption) => {
    onChange(option.scenename);
    onPick?.(option);
    setOpen(false);
  };
  const item = (option: SceneOption) => (
    <CommandItem
      key={`${option.objectType}|${option.scenename}`}
      value={`${option.objectType}|${option.scenename}`}
      onSelect={() => pick(option)}
      className="flex items-center gap-2"
      title={option.scenename}
    >
      {option.objectType && <TypeDot objectType={option.objectType} />}
      {/* File name first (what people recognise), folder after, smaller. */}
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="shrink-0 font-mono text-xs font-medium">
          {option.scenename.split('/').at(-1)}
        </span>
        <span className="truncate font-mono text-2xs text-fg-3">
          {option.scenename.split('/').slice(0, -1).join('/')}
        </span>
      </span>
      {option.count > 0 && (
        <MonoText tone="subtle" className="shrink-0 text-3xs">
          {labels.count(option.count)}
        </MonoText>
      )}
    </CommandItem>
  );

  return (
    // cmdk labels its input through `label` (aria-labelledby), which wins over aria-label.
    <Command
      label={labels.field}
      shouldFilter={false}
      className="relative overflow-visible bg-transparent"
    >
      <CommandInput
        id={id}
        aria-label={labels.field}
        value={value}
        onValueChange={(next) => {
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="font-mono text-xs"
      />
      {open && (
        <CommandList
          // Keep the focus in the field: a blur on mousedown would close the list before the click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-0 left-0 z-50 mt-1 rounded-lg border bg-popover shadow-md"
        >
          <CommandEmpty>{labels.empty}</CommandEmpty>
          {preferred.length > 0 && (
            <CommandGroup heading={labels.preferred}>{preferred.map(item)}</CommandGroup>
          )}
          {others.length > 0 && (
            <CommandGroup heading={labels.others}>{others.map(item)}</CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  );
}

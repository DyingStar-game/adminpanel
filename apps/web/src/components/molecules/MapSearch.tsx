import { useState } from 'react';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface MapSearchResult {
  uuid: string;
  label: string;
  objectType: string;
  /** Short note next to the label (e.g. "hidden" when its type is hidden). */
  hint?: string | undefined;
}

interface MapSearchProps {
  /** Results for a query, already ranked. */
  search: (query: string) => MapSearchResult[];
  onPick: (uuid: string) => void;
  labels: { field: string; empty: string };
}

/** Search box of a map: results listed while typing, a pick centres the map on the item. */
export function MapSearch({ search, onPick, labels }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const results = query.trim() ? search(query) : [];

  return (
    <Command
      label={labels.field}
      shouldFilter={false}
      // One frame only, as wide as the panels around it: cmdk's padded wrapper and its inner
      // field frame are flattened onto the field itself.
      className="overflow-visible bg-transparent p-0 [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=input-group]]:h-9! [&_[data-slot=input-group]]:border-border! [&_[data-slot=input-group]]:bg-background!"
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder={labels.field} />
      {query.trim() && (
        <CommandList className="mt-1 max-h-56 rounded-lg border bg-background">
          <CommandEmpty>{labels.empty}</CommandEmpty>
          {results.map((result) => (
            <CommandItem
              key={result.uuid}
              value={result.uuid}
              onSelect={() => {
                setQuery('');
                onPick(result.uuid);
              }}
              className="flex items-center gap-2"
            >
              <TypeDot objectType={result.objectType} />
              <span className="min-w-0 flex-1 truncate text-xs">{result.label}</span>
              {result.hint && (
                <MonoText tone="subtle" className="text-3xs">
                  {result.hint}
                </MonoText>
              )}
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  );
}

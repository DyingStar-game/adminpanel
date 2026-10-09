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

export interface ItemSearchResult {
  uuid: string;
  label: string;
  objectType: string;
  /** Short note next to the label (its parent, "hidden" on a map…). */
  hint?: string | undefined;
}

interface ItemSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Results of the current query, already ranked. */
  results: ItemSearchResult[];
  /** Results are on their way (a search that takes time). */
  loading?: boolean;
  /** Matches in all, when more than the results listed. */
  total?: number | undefined;
  onPick: (uuid: string) => void;
  /** Enter with no result to pick (e.g. a full UUID typed before the results came). */
  onSubmit?: ((query: string) => void) | undefined;
  labels: {
    field: string;
    empty: string;
    loading?: string;
    more?: (shown: number, total: number) => string;
  };
  className?: string;
}

/**
 * Search box with its results listed under it while typing (a map's search, the top bar's):
 * a pick hands the item over; the list floats over what follows.
 */
export function ItemSearch({
  query,
  onQueryChange,
  results,
  loading = false,
  total,
  onPick,
  onSubmit,
  labels,
  className,
}: ItemSearchProps) {
  const open = query.trim() !== '';

  return (
    <Command
      label={labels.field}
      shouldFilter={false}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && results.length === 0 && query.trim()) {
          event.preventDefault();
          onSubmit?.(query.trim());
        }
      }}
      // One frame only: cmdk's padded wrapper and its inner field frame are flattened onto the
      // field itself.
      className={cn(
        'relative overflow-visible bg-transparent p-0 [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=input-group]]:h-9! [&_[data-slot=input-group]]:border-border! [&_[data-slot=input-group]]:bg-background!',
        className,
      )}
    >
      <CommandInput value={query} onValueChange={onQueryChange} placeholder={labels.field} />
      {open && (
        <CommandList className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 rounded-lg border bg-background shadow-lg">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-fg-3">{labels.loading}</div>
          ) : (
            <CommandEmpty>{labels.empty}</CommandEmpty>
          )}
          {results.map((result) => (
            <CommandItem
              key={result.uuid}
              value={result.uuid}
              onSelect={() => {
                onQueryChange('');
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
          {total !== undefined && total > results.length && labels.more && (
            <div className="border-t px-3 py-1.5 text-3xs text-fg-3">
              {labels.more(results.length, total)}
            </div>
          )}
        </CommandList>
      )}
    </Command>
  );
}

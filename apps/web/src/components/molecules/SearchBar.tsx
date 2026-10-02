import { useState, type FormEvent } from 'react';
import { SearchIcon } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  placeholder: string;
  /** Called with the trimmed query when the user presses Enter (ignored when empty). */
  onSubmit: (query: string) => void;
  className?: string;
}

/** Search field of the top bar: icon, input and an Enter hint. */
export function SearchBar({ placeholder, onSubmit, className }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        'flex h-7.5 w-85 max-w-full items-center gap-2 rounded-md border bg-surface-2 px-2.5 text-fg-3 focus-within:border-line-strong',
        className,
      )}
    >
      <SearchIcon className="size-3.5 shrink-0" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-fg-3"
      />
      <Kbd>↵</Kbd>
    </form>
  );
}

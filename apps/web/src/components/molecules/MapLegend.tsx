import { TagIcon } from 'lucide-react';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

export interface MapLegendEntry {
  objectType: string;
  count: number;
  shown: boolean;
  /** Marker shape on the map, repeated in the legend. */
  shape: 'round' | 'square';
  /** Names written above the markers. */
  named: boolean;
}

interface MapLegendProps {
  entries: MapLegendEntry[];
  onToggle: (objectType: string, shown: boolean) => void;
  onToggleNames: (objectType: string, named: boolean) => void;
  labels: {
    title: string;
    toggle: (objectType: string) => string;
    names: (objectType: string) => string;
  };
}

/** Types present on a map, with their counts, a show / hide switch and a names toggle each. */
export function MapLegend({ entries, onToggle, onToggleNames, labels }: MapLegendProps) {
  return (
    <section aria-label={labels.title} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-fg-2">{labels.title}</span>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.objectType} className="flex items-center gap-2">
            <TypeDot objectType={entry.objectType} shape={entry.shape} />
            <MonoText className="min-w-0 flex-1 truncate text-[11.5px]">
              {entry.objectType}
            </MonoText>
            <MonoText tone="subtle" className="text-[11px] tabular-nums">
              {entry.count}
            </MonoText>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-pressed={entry.named}
              aria-label={labels.names(entry.objectType)}
              title={labels.names(entry.objectType)}
              onClick={() => onToggleNames(entry.objectType, !entry.named)}
              className={cn(entry.named ? 'bg-link-bg text-link' : 'text-fg-3')}
            >
              <TagIcon />
            </Button>
            <Switch
              size="sm"
              checked={entry.shown}
              onCheckedChange={(shown) => onToggle(entry.objectType, shown)}
              aria-label={labels.toggle(entry.objectType)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

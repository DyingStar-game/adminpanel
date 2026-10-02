import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { Switch } from '@/components/ui/switch';

export interface MapLegendEntry {
  objectType: string;
  count: number;
  shown: boolean;
  /** Marker shape on the map, repeated in the legend. */
  shape: 'round' | 'square';
}

interface MapLegendProps {
  entries: MapLegendEntry[];
  onToggle: (objectType: string, shown: boolean) => void;
  labels: { title: string; toggle: (objectType: string) => string };
}

/** Types present on a map, with their counts and a show / hide switch each. */
export function MapLegend({ entries, onToggle, labels }: MapLegendProps) {
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

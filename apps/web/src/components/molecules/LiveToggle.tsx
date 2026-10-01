import { LiveDot } from '@/components/atoms/LiveDot';
import { Button } from '@/components/ui/button';

interface LiveToggleProps {
  live: boolean;
  onToggle: () => void;
  labels: { on: string; off: string; toggle: string };
}

/** Live refresh switch (ADR 0009). */
export function LiveToggle({ live, onToggle, labels }: LiveToggleProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={live}
      aria-label={labels.toggle}
      onClick={onToggle}
    >
      <LiveDot live={live} />
      {live ? labels.on : labels.off}
    </Button>
  );
}

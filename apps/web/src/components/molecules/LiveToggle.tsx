import { LiveDot } from '@/components/atoms/LiveDot';
import { Button } from '@/components/ui/button';

interface LiveToggleProps {
  live: boolean;
  onToggle: () => void;
  /** `hint` explains how fresh live data is (shown as tooltip). */
  labels: { on: string; off: string; toggle: string; hint: string };
}

/** Live refresh switch (ADR 0009). */
export function LiveToggle({ live, onToggle, labels }: LiveToggleProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={live}
      aria-label={labels.toggle}
      title={labels.hint}
      onClick={onToggle}
    >
      <LiveDot live={live} />
      {live ? labels.on : labels.off}
    </Button>
  );
}

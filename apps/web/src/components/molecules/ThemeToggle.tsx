import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  resolved: 'light' | 'dark';
  onToggle: () => void;
  label: string;
}

/** Light / dark switch: shows the moon in light mode, the sun in dark mode. */
export function ThemeToggle({ resolved, onToggle, label }: ThemeToggleProps) {
  return (
    <Button variant="outline" size="icon-sm" aria-label={label} title={label} onClick={onToggle}>
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

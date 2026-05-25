import { AlertTriangle } from 'lucide-react';

/** Warning banner for features that are still under development. */
export function WipBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border border-ds-warning/40 bg-ds-warning/10 text-ds-warning text-sm">
      <AlertTriangle size={16} strokeWidth={1.5} />
      <span>{message}</span>
    </div>
  );
}

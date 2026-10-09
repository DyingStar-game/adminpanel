import { CircleXIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImportFinding } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { cn } from '@/lib/cn';

interface FindingViewProps {
  finding: ImportFinding;
  /** Shows the faulty value's path (hidden when the finding sits under its property). */
  showPath?: boolean;
}

/** One finding of a coherence check (ADR 0019, 0022): icon by severity, message, path. */
export function FindingView({ finding, showPath = true }: FindingViewProps) {
  const { t } = useTranslation();
  const Icon = { error: CircleXIcon, warning: TriangleAlertIcon, info: InfoIcon }[finding.severity];
  return (
    <li className="flex items-start gap-1.5 text-xs">
      <Icon
        aria-label={t(`import.severity.${finding.severity}`)}
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          {
            error: 'text-destructive',
            warning: 'text-amber-600 dark:text-amber-400',
            info: 'text-link',
          }[finding.severity],
        )}
      />
      <span className="min-w-0 break-words">
        {t(`import.codes.${finding.code}`, {
          ...finding.params,
          // A missing parent where every existing item has one has its own message.
          ...(finding.params?.parentType === '' ? { context: 'root' } : {}),
        })}
        {showPath && finding.path && (
          <MonoText tone="subtle" className="ml-1.5 text-2xs">
            {finding.path}
          </MonoText>
        )}
      </span>
    </li>
  );
}

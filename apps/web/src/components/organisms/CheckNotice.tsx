import { useTranslation } from 'react-i18next';
import type { ImportFinding } from '@dyingstar-admin/schemas';
import { FindingView } from '@/components/molecules/FindingView';
import { cn } from '@/lib/cn';

interface CheckNoticeProps {
  /** Every finding of the last check; those without a property row are listed here. */
  findings: ImportFinding[];
  general: ImportFinding[];
  failed: boolean;
}

/** Outcome of a form's coherence check (ADR 0022), above its footer. Nothing when clean. */
export function CheckNotice({ findings, general, failed }: CheckNoticeProps) {
  const { t } = useTranslation();
  const errors = findings.some((f) => f.severity === 'error');
  const warnings = findings.some((f) => f.severity === 'warning');
  if (!failed && !errors && !warnings && general.length === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-1 border-t px-4 py-2 text-xs',
        errors ? 'bg-destructive/10' : warnings || failed ? 'bg-amber-500/10' : '',
      )}
    >
      {(errors || warnings || failed) && (
        <p className="font-medium">
          {t(
            errors ? 'editor.checkErrors' : failed ? 'editor.checkFailed' : 'editor.checkWarnings',
          )}
        </p>
      )}
      {general.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {general.map((finding, i) => (
            <FindingView key={i} finding={finding} />
          ))}
        </ul>
      )}
    </div>
  );
}

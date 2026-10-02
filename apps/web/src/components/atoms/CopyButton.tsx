import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/** How long the check mark replaces the copy icon. */
const COPIED_MS = 1200;

interface CopyButtonProps {
  value: string;
  /** Accessible name; defaults to "Copy UUID". */
  label?: string;
  className?: string;
}

/** Small icon button copying a value (e.g. a UUID) to the clipboard. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const name = label ?? t('copy.uuid');

  return (
    <button
      type="button"
      aria-label={name}
      title={copied ? t('copy.done') : name}
      onClick={(e) => {
        // Inside links and rows: copying must not navigate or select.
        e.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-foreground',
        className,
      )}
    >
      {copied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
    </button>
  );
}

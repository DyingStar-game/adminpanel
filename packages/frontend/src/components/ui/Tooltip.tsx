import { cn } from '@/lib/cn';
import { useState } from 'react';

/** Shows full text on hover above the child element. */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={cn(
            'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1',
            'text-xs font-mono whitespace-nowrap bg-ds-surface border border-ds-border rounded shadow-lg',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** Displays the first 8 characters of a UUID with the full value in a tooltip. */
export function TruncatedUuid({ uuid }: { uuid: string }) {
  const short = uuid.slice(0, 8) + '...';
  return (
    <Tooltip content={uuid}>
      <span className="font-mono text-xs text-ds-muted cursor-help">{short}</span>
    </Tooltip>
  );
}

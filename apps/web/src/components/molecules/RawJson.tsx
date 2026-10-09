import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RawJsonProps {
  value: unknown;
  copyLabel: string;
}

/** Pretty-printed JSON with a copy button. */
export function RawJson({ value, copyLabel }: RawJsonProps) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={copyLabel}
        className="absolute top-2 right-2"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <pre className="max-h-120 overflow-auto rounded-lg border bg-surface-2 p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

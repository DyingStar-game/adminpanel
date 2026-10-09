import { useState, type ReactNode } from 'react';
import { MonoText } from '@/components/atoms/MonoText';
import { Button } from '@/components/ui/button';
import { hasBBCode, parseBBCode, type BBCodeNode } from '@/lib/bbcode';
import { cn } from '@/lib/cn';

interface BBCodeTextProps {
  text: string;
  /** The button switching to the code typed, and back. */
  labels: { code: string; formatted: string };
  className?: string;
}

function render(nodes: BBCodeNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return node;
    // A block inside the paragraph: `<hr>` cannot sit in a `<p>`.
    if (node.tag === 'hr') {
      return <span key={i} role="separator" className="my-2 block border-t border-border" />;
    }
    const children = render(node.children);
    switch (node.tag) {
      case 'b':
        return <strong key={i}>{children}</strong>;
      case 'i':
        return <em key={i}>{children}</em>;
      case 'u':
        return (
          <span key={i} className="underline">
            {children}
          </span>
        );
      case 's':
        return <s key={i}>{children}</s>;
      case 'color':
        return (
          <span key={i} style={{ color: node.color }}>
            {children}
          </span>
        );
    }
  });
}

/**
 * A player's text as the game shows it, its BBCode interpreted (`lib/bbcode.ts`), with a switch
 * to the code typed: a colour can hide a text on the dark background, a moderator may need it.
 */
export function BBCodeText({ text, labels, className }: BBCodeTextProps) {
  const [code, setCode] = useState(false);
  const tagged = hasBBCode(text);
  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      {code ? (
        <MonoText className="text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</MonoText>
      ) : (
        <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
          {render(parseBBCode(text))}
        </p>
      )}
      {tagged && (
        <Button variant="ghost" size="xs" onClick={() => setCode(!code)} aria-pressed={code}>
          {code ? labels.formatted : labels.code}
        </Button>
      )}
    </div>
  );
}

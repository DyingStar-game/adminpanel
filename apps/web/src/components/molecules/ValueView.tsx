import { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { cn } from '@/lib/cn';
import { valueShape } from '@/lib/valueShape';
import { UuidLink, type RefTarget } from './UuidLink';

export interface ValueViewProps {
  value: unknown;
  /** Property name, used for key-based hints such as `*_timestamp`. */
  name?: string;
  /** Resolves a referenced UUID; provided by organisms, which own data fetching. */
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
}

const fixed = (n: number) => Number(n.toFixed(3)).toString();

/**
 * Generic renderer of a property value, driven by its shape (ADR 0008): vectors, quaternions,
 * booleans, timestamps, UUID references and collapsible nested JSON.
 */
export function ValueView({ value, name, resolveRef, onNavigate }: ValueViewProps) {
  const { t, i18n } = useTranslation();
  const shape = valueShape(value, name);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 });

  switch (shape.kind) {
    case 'null':
      return <MonoText tone="subtle">null</MonoText>;
    case 'empty':
      return <MonoText tone="subtle">"" · {t('value.empty')}</MonoText>;
    case 'boolean':
      return (
        <MonoText className={shape.value ? 'text-success' : 'text-fg-3'}>
          {String(shape.value)}
        </MonoText>
      );
    case 'number':
      return <MonoText>{number.format(shape.value)}</MonoText>;
    case 'timestamp':
      return (
        <MonoText title={String(shape.value)}>
          {new Date(shape.value * 1000).toLocaleString(i18n.language)}
        </MonoText>
      );
    case 'string':
      return (
        <MonoText title={shape.value} className="block truncate">
          {shape.value}
        </MonoText>
      );
    case 'uuid':
      return (
        <UuidLink
          uuid={shape.value}
          target={resolveRef(shape.value)}
          onNavigate={onNavigate}
          missingLabel={t('value.brokenLink')}
        />
      );
    case 'vec3':
      return (
        <span className="flex min-w-0 items-center gap-1">
          <MonoText className="block truncate" title="x, y, z">
            {fixed(shape.value.x)}, {fixed(shape.value.y)}, {fixed(shape.value.z)}
          </MonoText>
          {/* Exact values as JSON: pasted into a position field, it fills x, y and z. */}
          <CopyButton value={JSON.stringify(shape.value)} label={t('copy.value')} />
        </span>
      );
    case 'quaternion':
      return (
        <span className="flex min-w-0 items-center gap-1">
          <MonoText title="w, x, y, z">
            {fixed(shape.value.w)}, {fixed(shape.value.x)}, {fixed(shape.value.y)},{' '}
            {fixed(shape.value.z)}
          </MonoText>
          <CopyButton value={JSON.stringify(shape.value)} label={t('copy.value')} />
        </span>
      );
    case 'array':
    case 'object': {
      const entries =
        shape.kind === 'array'
          ? shape.value.map((v, i) => [String(i), v] as const)
          : Object.entries(shape.value);
      const summary =
        shape.kind === 'array'
          ? t('value.items', { count: entries.length })
          : t('value.keys', { count: entries.length });
      return (
        <Nested summary={entries.length === 0 ? (shape.kind === 'array' ? '[]' : '{}') : summary}>
          {entries.map(([key, child]) => (
            <div key={key} className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-2">
              <MonoText tone="subtle">{key}</MonoText>
              <ValueView value={child} name={key} resolveRef={resolveRef} onNavigate={onNavigate} />
            </div>
          ))}
        </Nested>
      );
    }
  }
}

function Nested({ summary, children }: { summary: string; children: React.ReactNode[] }) {
  const [open, setOpen] = useState(false);
  if (children.length === 0) return <MonoText tone="subtle">{summary}</MonoText>;
  return (
    <div className="flex min-w-0 flex-col gap-1 py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 self-start font-mono text-xs text-fg-2 hover:text-foreground"
      >
        <ChevronRightIcon className={cn('size-3 transition-transform', open && 'rotate-90')} />
        {summary}
      </button>
      {open && <div className="flex flex-col gap-1 border-l pl-2">{children}</div>}
    </div>
  );
}

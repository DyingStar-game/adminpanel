import { TypeDot } from '@/components/atoms/TypeDot';
import { cn } from '@/lib/cn';

/** What is known about the referenced item, resolved by the caller (organisms). */
export type RefTarget =
  | { status: 'loading' }
  | { status: 'missing' }
  | {
      status: 'found';
      label: string;
      objectType: string;
      parentId?: string | null | undefined;
      /** Model of the referenced item (schematics show it, ADR 0016). */
      scenename?: string | null | undefined;
    };

interface UuidLinkProps {
  uuid: string;
  target: RefTarget;
  onNavigate: (uuid: string) => void;
  missingLabel: string;
}

const short = (uuid: string) => uuid.slice(0, 8);

/** A UUID reference rendered as a link; dangling references are flagged, not hidden. */
export function UuidLink({ uuid, target, onNavigate, missingLabel }: UuidLinkProps) {
  if (target.status === 'missing') {
    return (
      <span
        title={uuid}
        className="font-mono text-xs text-destructive line-through decoration-dotted"
      >
        {short(uuid)} · {missingLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={uuid}
      onClick={() => onNavigate(uuid)}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate text-left font-mono text-xs text-link underline decoration-dotted underline-offset-[3px]',
        target.status === 'loading' && 'opacity-60',
      )}
    >
      {target.status === 'found' && <TypeDot objectType={target.objectType} className="size-1.5" />}
      {target.status === 'found' ? target.label : short(uuid)}
    </button>
  );
}

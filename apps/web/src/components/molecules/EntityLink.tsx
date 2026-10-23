import type { ReactNode } from 'react';
import { Chip } from '@/components/atoms/Chip';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { shortId } from '@/lib/format';

interface EntityLinkProps {
  /** The entity's id (a player, an organisation, a mission…), copied whole. */
  id: string;
  /** Its name, when known; its short id otherwise. */
  label?: ReactNode;
  /** Opens its page; unset, the name or id is shown as text (the account may not see it). */
  onOpen?: ((id: string) => void) | undefined;
  /** Accessible name of the copy button; defaults to "Copy UUID". */
  copyLabel?: string;
}

/**
 * A game service entity: a way to its page when it has one (link colour and arrow), its name or
 * short id, and beside it a button copying the whole id (as `UuidLink` does for persistence).
 */
export function EntityLink({ id, label, onOpen, copyLabel }: EntityLinkProps) {
  const text = label ?? <MonoText>{shortId(id)}</MonoText>;
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {onOpen ? (
        <Chip
          variant="link"
          title={id}
          onClick={(event) => {
            // Inside clickable rows: opening the entity must not open the row too.
            event.stopPropagation();
            onOpen(id);
          }}
        >
          {text}
        </Chip>
      ) : (
        <span title={id} className="min-w-0 truncate">
          {text}
        </span>
      )}
      <CopyButton value={id} {...(copyLabel ? { label: copyLabel } : {})} />
    </span>
  );
}

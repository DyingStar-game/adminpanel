import { EntityLink } from '@/components/molecules/EntityLink';
import { useHolderName, type HolderType } from '@/hooks/useHolderName';

interface HolderLinkProps {
  type: HolderType;
  id: string;
  /** Display names `mission` gave, by player id. */
  players?: Record<string, string> | undefined;
  /** Opens its page; unset, its name or id as text. */
  onOpen?: ((id: string) => void) | undefined;
}

/**
 * A player, corporation or political entity a mission refers to (its issuer, its escrow's payer):
 * its name when it can be found, its short id until then or otherwise.
 */
export function HolderLink({ type, id, players, onOpen }: HolderLinkProps) {
  const name = useHolderName(type, id);
  return <EntityLink id={id} label={type === 'player' ? players?.[id] : name} onOpen={onOpen} />;
}

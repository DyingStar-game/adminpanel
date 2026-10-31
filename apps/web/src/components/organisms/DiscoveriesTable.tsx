import { useTranslation } from 'react-i18next';
import type { DiscoveryRow } from '@dyingstar-admin/schemas';
import { DataTable, type Column } from '@/components/molecules/DataTable';
import { EntityLink } from '@/components/molecules/EntityLink';
import { UuidLink, type RefTarget } from '@/components/molecules/UuidLink';
import { Button } from '@/components/ui/button';
import { isoOfUnix, planetLabel, type PlaceNameDecision } from '@/lib/discoveries';
import { formatDateTime } from '@/lib/format';

interface DiscoveriesTableProps {
  discoveries: DiscoveryRow[];
  /** The place's item (link label, or missing). */
  resolvePlace: (uuid: string) => RefTarget;
  onOpenPlace: (uuid: string) => void;
  /** Opens a player's sheet; unset, discoverers are not links (the account may not see them). */
  onOpenPlayer?: ((id: string) => void) | undefined;
  /** Decides a name awaiting review; unset, no action (the account may not decide). */
  onDecide?: ((discovery: DiscoveryRow, decision: PlaceNameDecision) => void) | undefined;
}

/** The place a discovery names: its own item (`place_uuid`), else its parent. */
const placeOf = (d: DiscoveryRow) => d.object_data.place_uuid || d.object_data.parent_id || '';

/**
 * Discovered places and the names proposed for them (ADR 0032), any kind of place: the name (the
 * approved one once published, with the reason of a refusal), who discovered it, where, when, a
 * link to the place's item, and the decision for the names awaiting review.
 */
export function DiscoveriesTable({
  discoveries,
  resolvePlace,
  onOpenPlace,
  onOpenPlayer,
  onDecide,
}: DiscoveriesTableProps) {
  const { t, i18n } = useTranslation();
  const date = (seconds: number) => {
    const iso = isoOfUnix(seconds);
    return iso ? formatDateTime(iso, i18n.language) : <span className="text-fg-3">—</span>;
  };
  const decided = discoveries.some((d) => d.object_data.decided_at > 0);
  const pending = discoveries.some((d) => d.object_data.status === 'pending');

  const name = ({ object_data: d }: DiscoveryRow) => {
    if (d.status === 'approved') {
      return (
        <span className="flex flex-col">
          <span className="font-medium">{d.approved_name}</span>
          {d.proposed_name && d.proposed_name !== d.approved_name && (
            <span className="text-xs text-fg-3">
              {t('exploration.names.proposedAs', { name: d.proposed_name })}
            </span>
          )}
        </span>
      );
    }
    return (
      <span className="flex flex-col">
        <span className="font-medium">{d.proposed_name || '—'}</span>
        {d.status === 'refused' && d.refusal_reason && (
          <span className="text-xs text-fg-3">{d.refusal_reason}</span>
        )}
      </span>
    );
  };

  const columns: Column<DiscoveryRow>[] = [
    {
      key: 'kind',
      header: t('exploration.names.columns.kind'),
      // A kind of place the panel has no label for yet is shown as the game names it.
      cell: (d) =>
        t(`exploration.names.kinds.${d.object_data.place_kind}` as never, {
          defaultValue: d.object_data.place_kind || '—',
        }),
    },
    { key: 'name', header: t('exploration.names.columns.name'), cell: name },
    {
      key: 'discoverer',
      header: t('exploration.names.columns.discoverer'),
      cell: ({ object_data: d }) =>
        d.discoverer_id ? (
          <EntityLink
            id={d.discoverer_id}
            label={d.discoverer_name || undefined}
            onOpen={onOpenPlayer}
          />
        ) : (
          <span className="text-fg-3">{d.discoverer_name || '—'}</span>
        ),
    },
    {
      key: 'planet',
      header: t('exploration.names.columns.planet'),
      cell: (d) => planetLabel(d.object_data.planet_name),
    },
    {
      key: 'discovered',
      header: t('exploration.names.columns.discovered'),
      cell: (d) => date(d.object_data.discovered_at),
      className: 'whitespace-nowrap',
    },
    {
      key: 'proposed',
      header: t('exploration.names.columns.proposed'),
      cell: (d) => date(d.object_data.proposed_at),
      className: 'whitespace-nowrap',
    },
    ...(decided
      ? [
          {
            key: 'decided',
            header: t('exploration.names.columns.decided'),
            cell: (d: DiscoveryRow) => date(d.object_data.decided_at),
            className: 'whitespace-nowrap',
          },
        ]
      : []),
    {
      key: 'place',
      header: t('exploration.names.columns.place'),
      cell: (d) => {
        const place = placeOf(d);
        return place ? (
          <UuidLink
            uuid={place}
            target={resolvePlace(place)}
            onNavigate={onOpenPlace}
            missingLabel={t('exploration.names.missingPlace')}
          />
        ) : (
          <span className="text-fg-3">—</span>
        );
      },
    },
    ...(onDecide && pending
      ? [
          {
            key: 'actions',
            header: t('exploration.names.columns.actions'),
            cell: (d: DiscoveryRow) =>
              d.object_data.status === 'pending' && (
                <span className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onDecide(d, 'approve')}>
                    {t('exploration.names.approve')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDecide(d, 'refuse')}>
                    {t('exploration.names.refuse')}
                  </Button>
                </span>
              ),
            className: 'whitespace-nowrap',
          },
        ]
      : []),
  ];

  return (
    <DataTable<DiscoveryRow>
      label={t('exploration.names.title')}
      rows={discoveries}
      rowKey={(d) => d.uuid}
      empty={t('exploration.names.none')}
      columns={columns}
    />
  );
}

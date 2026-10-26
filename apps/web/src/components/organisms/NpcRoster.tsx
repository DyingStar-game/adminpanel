import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Role } from '@dyingstar-admin/contracts/npc';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable, type Column } from '@/components/molecules/DataTable';
import { NpcLiveBadge } from '@/components/molecules/NpcLiveBadge';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/useCan';
import { useNpcToggle } from '@/hooks/useNpcActions';
import { useNpcRoster, type RosterFilters } from '@/hooks/useNpcs';
import { formatDateTime } from '@/lib/format';
import { NPC_PAGE_SIZE } from '@/lib/npcSearch';
import {
  actionName,
  isManualAction,
  liveState,
  npcErrorKey,
  writeError,
  type Npc,
} from '@/lib/npcs';

const ALL = 'all';
const ROLES: Role[] = ['unassigned', 'storekeeper', 'villager', 'custom'];

export interface SelectedNpc {
  id: string;
  displayName: string;
}

interface NpcRosterProps {
  filters: RosterFilters;
  page: number;
  onFiltersChange: (next: RosterFilters) => void;
  onPageChange: (page: number) => void;
  /** Rows picked for a bulk action (kept across pages). */
  selected: SelectedNpc[];
  onSelectedChange: (next: SelectedNpc[]) => void;
  onOpenNpc: (id: string) => void;
}

/**
 * The roster of NPCs (ADR 0031), filtered by name or login, village, role, enabled and
 * connected, a page at a time: role (and storekeeper slot), village, live state, current action
 * (a manual task marked), last seen. Rows can be selected for a bulk spawn, despawn or
 * deletion; `npc.manage` spawns or despawns one from its row.
 */
export function NpcRoster({
  filters,
  page,
  onFiltersChange,
  onPageChange,
  selected,
  onSelectedChange,
  onOpenNpc,
}: NpcRosterProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const roster = useNpcRoster(filters, page);
  const toggle = useNpcToggle();
  // Typed text, sent once the user pauses; the URL changed elsewhere: show its value.
  const [text, setText] = useState(filters.q ?? '');
  const [shown, setShown] = useState(filters.q ?? '');
  if ((filters.q ?? '') !== shown) {
    setShown(filters.q ?? '');
    setText(filters.q ?? '');
  }
  useEffect(() => {
    if (text === (filters.q ?? '')) return;
    const timer = setTimeout(() => onFiltersChange({ ...filters, q: text || undefined }), 300);
    return () => clearTimeout(timer);
  }, [text, filters, onFiltersChange]);
  const rows = roster.data?.items ?? [];
  const isSelected = (id: string) => selected.some((s) => s.id === id);
  const pick = (npc: Npc, on: boolean) =>
    onSelectedChange(
      on
        ? [...selected, { id: npc.id, displayName: npc.displayName }]
        : selected.filter((s) => s.id !== npc.id),
    );
  const allOnPage = rows.length > 0 && rows.every((n) => isSelected(n.id));

  const quick = async (npc: Npc, action: 'spawn' | 'despawn') => {
    try {
      await toggle.mutateAsync({ id: npc.id, action });
      toast.success(t(`npcs.roster.${action}ed`, { name: npc.displayName }));
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  const select = (
    key: 'role' | 'enabled' | 'online',
    label: string,
    any: string,
    options: { value: string; label: string }[],
  ) => (
    <OptionSelect<string>
      label={label}
      value={filters[key] ?? ALL}
      options={[{ value: ALL, label: any }, ...options]}
      onChange={(v) => onFiltersChange({ ...filters, [key]: v === ALL ? undefined : v })}
      className="w-40"
    />
  );
  const yesNo = (yes: string, no: string) => [
    { value: 'true', label: yes },
    { value: 'false', label: no },
  ];

  const columns: Column<Npc>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-8',
      cell: (npc) => (
        <input
          type="checkbox"
          className="size-4 accent-(--color-link)"
          aria-label={t('npcs.roster.select', { name: npc.displayName })}
          checked={isSelected(npc.id)}
          onChange={(event) => pick(npc, event.target.checked)}
        />
      ),
    },
    {
      key: 'name',
      header: t('npcs.fields.name'),
      cell: (npc) => (
        <button
          type="button"
          className="text-left text-link hover:underline"
          onClick={() => onOpenNpc(npc.id)}
        >
          {npc.displayName}
        </button>
      ),
    },
    {
      key: 'login',
      header: t('npcs.fields.login'),
      cell: (npc) => <MonoText tone="muted">{npc.login}</MonoText>,
    },
    {
      key: 'role',
      header: t('npcs.fields.role'),
      cell: (npc) => (
        <span className="flex items-center gap-1.5">
          <Badge variant={npc.role === 'storekeeper' ? 'default' : 'secondary'}>
            {t(`npcs.roles.${npc.role}`)}
          </Badge>
          {npc.storekeeperSlot !== null && (
            <span className="text-xs text-fg-3">
              {t('npcs.roster.slot', { slot: npc.storekeeperSlot })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'village',
      header: t('npcs.fields.village'),
      cell: (npc) => npc.villageCode ?? <span className="text-fg-3">{t('npcs.none')}</span>,
    },
    {
      key: 'enabled',
      header: t('npcs.fields.enabled'),
      cell: (npc) => t(npc.enabled ? 'npcs.yes' : 'npcs.no'),
    },
    {
      key: 'live',
      header: t('npcs.fields.live'),
      cell: (npc) => {
        const state = liveState(npc.live);
        return <NpcLiveBadge state={state} label={t(`npcs.live.${state}`)} />;
      },
    },
    {
      key: 'action',
      header: t('npcs.fields.currentAction'),
      cell: (npc) => {
        const action = npc.live.currentAction;
        if (!action) return <span className="text-fg-3">{t('npcs.none')}</span>;
        return (
          <span className="flex items-center gap-1.5">
            <MonoText>{actionName(action.name)}</MonoText>
            {isManualAction(action.name) && (
              <Badge variant="outline">{t('npcs.roster.manual')}</Badge>
            )}
          </span>
        );
      },
    },
    {
      key: 'seen',
      header: t('npcs.fields.lastSeen'),
      cell: (npc) =>
        npc.lastSeenAt ? (
          formatDateTime(npc.lastSeenAt, i18n.language)
        ) : (
          <span className="text-fg-3">{t('npcs.never')}</span>
        ),
    },
    ...(can('npc.manage')
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            cell: (npc: Npc) => (
              <Button
                size="xs"
                variant="outline"
                disabled={toggle.isPending}
                aria-label={t(npc.enabled ? 'npcs.roster.despawnOne' : 'npcs.roster.spawnOne', {
                  name: npc.displayName,
                })}
                onClick={() => void quick(npc, npc.enabled ? 'despawn' : 'spawn')}
              >
                {t(npc.enabled ? 'npcs.actions.despawn' : 'npcs.actions.spawn')}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label={t('npcs.roster.search')}
          placeholder={t('npcs.roster.search')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-7 w-60 text-xs"
        />
        <Input
          aria-label={t('npcs.fields.village')}
          placeholder={t('npcs.roster.villagePlaceholder')}
          defaultValue={filters.village ?? ''}
          key={filters.village ?? ''}
          onBlur={(event) =>
            onFiltersChange({ ...filters, village: event.target.value.trim() || undefined })
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onFiltersChange({
                ...filters,
                village: event.currentTarget.value.trim() || undefined,
              });
            }
          }}
          className="h-7 w-28 text-xs"
        />
        {select(
          'role',
          t('npcs.fields.role'),
          t('npcs.roster.anyRole'),
          ROLES.map((r) => ({ value: r, label: t(`npcs.roles.${r}`) })),
        )}
        {select(
          'enabled',
          t('npcs.fields.enabled'),
          t('npcs.roster.anyEnabled'),
          yesNo(t('npcs.roster.enabledOnly'), t('npcs.roster.disabledOnly')),
        )}
        {select(
          'online',
          t('npcs.fields.live'),
          t('npcs.roster.anyOnline'),
          yesNo(t('npcs.live.connected'), t('npcs.roster.notConnected')),
        )}
        <label className="flex items-center gap-1.5 text-xs text-fg-3">
          <input
            type="checkbox"
            className="size-4 accent-(--color-link)"
            checked={allOnPage}
            disabled={rows.length === 0}
            onChange={(event) =>
              onSelectedChange(
                event.target.checked
                  ? [
                      ...selected,
                      ...rows
                        .filter((n) => !isSelected(n.id))
                        .map((n) => ({ id: n.id, displayName: n.displayName })),
                    ]
                  : selected.filter((s) => !rows.some((n) => n.id === s.id)),
              )
            }
          />
          {t('npcs.roster.selectPage')}
        </label>
        {selected.length > 0 && (
          <span className="flex items-center gap-2 text-xs text-fg-3">
            {t('npcs.roster.selected', { count: selected.length })}
            <Button size="xs" variant="ghost" onClick={() => onSelectedChange([])}>
              {t('npcs.roster.clearSelection')}
            </Button>
          </span>
        )}
      </div>
      {roster.isError ? (
        <ServiceNotice message={t(npcErrorKey(roster.error))} />
      ) : (
        <>
          <DataTable
            label={t('npcs.roster.label')}
            columns={columns}
            rows={rows}
            rowKey={(npc) => npc.id}
            empty={roster.isPending ? t('npcs.loading') : t('npcs.roster.empty')}
            picked={(npc) => isSelected(npc.id)}
          />
          {roster.data && (
            <Pagination
              page={page}
              pageSize={NPC_PAGE_SIZE}
              total={roster.data.total}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

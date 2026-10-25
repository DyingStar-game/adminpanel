import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NpcAddDialog } from '@/components/organisms/NpcAddDialog';
import { NpcEventsFeed } from '@/components/organisms/NpcEventsFeed';
import { NpcRemoveDialog } from '@/components/organisms/NpcRemoveDialog';
import { NpcRoster, type SelectedNpc } from '@/components/organisms/NpcRoster';
import { NpcRoutines } from '@/components/organisms/NpcRoutines';
import { NpcSwitchPanel } from '@/components/organisms/NpcSwitchPanel';
import { NpcVillages } from '@/components/organisms/NpcVillages';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan } from '@/hooks/useCan';
import { NPCS_TABS, type NpcsSearch } from '@/lib/npcSearch';

interface NpcsPageProps {
  search: NpcsSearch;
  onSearchChange: (next: NpcsSearch) => void;
  onOpenNpc: (id: string) => void;
}

/**
 * The `npc` service (ADR 0026): the global switch and counts, adding and removing NPCs, then
 * the roster, the shift schedules, the events and the mining villages, each a tab of the URL.
 * Only the tab on screen is mounted, so only its data is polled (ADR 0009).
 */
export function NpcsPage({ search, onSearchChange, onOpenNpc }: NpcsPageProps) {
  const { t } = useTranslation();
  const can = useCan();
  const [selected, setSelected] = useState<SelectedNpc[]>([]);
  const [dialog, setDialog] = useState<'add' | 'remove' | null>(null);
  const set = (next: Partial<NpcsSearch>) => onSearchChange({ ...search, ...next });

  return (
    <ServicePageLayout
      title={t('npcs.title')}
      meta={<p className="text-sm text-fg-3">{t('npcs.lead')}</p>}
      actions={
        can('npc.manage') && (
          <>
            <Button size="sm" onClick={() => setDialog('add')}>
              {t('npcs.add.open')}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDialog('remove')}>
              {selected.length
                ? t('npcs.remove.openSelected', { count: selected.length })
                : t('npcs.remove.open')}
            </Button>
          </>
        )
      }
    >
      <NpcSwitchPanel />
      <Tabs value={search.tab} onValueChange={(tab) => set({ tab: tab as NpcsSearch['tab'] })}>
        <TabsList>
          {NPCS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`npcs.tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="roster" className="pt-4">
          <NpcRoster
            filters={{
              q: search.q,
              village: search.village,
              role: search.role,
              enabled: search.enabled,
              online: search.online,
            }}
            page={search.page}
            onFiltersChange={(filters) => set({ ...filters, page: 1 })}
            onPageChange={(page) => set({ page })}
            selected={selected}
            onSelectedChange={setSelected}
            onOpenNpc={onOpenNpc}
          />
        </TabsContent>
        <TabsContent value="routines" className="pt-4">
          <NpcRoutines pattern={search.pattern} onPatternChange={(pattern) => set({ pattern })} />
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <NpcEventsFeed
            npcId={null}
            kind={search.kind}
            onKindChange={(kind) => set({ kind })}
            onOpenNpc={onOpenNpc}
          />
        </TabsContent>
        <TabsContent value="villages" className="pt-4">
          <NpcVillages
            onOpenVillage={(village) => onSearchChange({ tab: 'roster', village, page: 1 })}
          />
        </TabsContent>
      </Tabs>
      {dialog === 'add' && <NpcAddDialog onClose={() => setDialog(null)} />}
      {dialog === 'remove' && (
        <NpcRemoveDialog
          selected={selected}
          onClose={() => setDialog(null)}
          onDone={() => setSelected([])}
        />
      )}
    </ServicePageLayout>
  );
}

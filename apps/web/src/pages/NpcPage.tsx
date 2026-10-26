import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import { MonoText } from '@/components/atoms/MonoText';
import { NpcLiveBadge } from '@/components/molecules/NpcLiveBadge';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { NpcConfigForm } from '@/components/organisms/NpcConfigForm';
import { NpcEventsFeed } from '@/components/organisms/NpcEventsFeed';
import { NpcLogs } from '@/components/organisms/NpcLogs';
import { NpcOverview } from '@/components/organisms/NpcOverview';
import { NpcRoutineCard } from '@/components/organisms/NpcRoutineCard';
import { NpcTasks } from '@/components/organisms/NpcTasks';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNpc } from '@/hooks/useNpcs';
import { ApiError } from '@/lib/api';
import { liveState, npcErrorKey } from '@/lib/npcs';
import { NPC_TABS, type NpcSearch } from '@/lib/npcSearch';

interface NpcPageProps {
  npcId: string;
  search: NpcSearch;
  onSearchChange: (next: NpcSearch) => void;
  onBack: () => void;
  /** After its deletion: back to the roster. */
  onDeleted: () => void;
  /** Opens a pattern in the routines editor. */
  onEditPattern: (name: string) => void;
}

/**
 * An NPC (ADR 0031): its overview and actions, routine, manual tasks, log lines, events and
 * configuration, each a tab of the URL; polled every 3 s while on screen (ADR 0009).
 */
export function NpcPage({
  npcId,
  search,
  onSearchChange,
  onBack,
  onDeleted,
  onEditPattern,
}: NpcPageProps) {
  const { t } = useTranslation();
  const npc = useNpc(npcId);
  const [kind, setKind] = useState<string | undefined>(undefined);
  const detail = npc.data;
  const back = (
    <Button variant="ghost" size="icon-sm" aria-label={t('npcs.detail.back')} onClick={onBack}>
      <ArrowLeftIcon />
    </Button>
  );

  if (!detail) {
    return (
      <ServicePageLayout title={t('npcs.detail.title')} leading={back}>
        {npc.isError ? (
          <ServiceNotice
            message={
              npc.error instanceof ApiError && npc.error.status === 404
                ? t('npcs.detail.notFound')
                : t(npcErrorKey(npc.error))
            }
          />
        ) : (
          <p className="text-sm text-fg-3">{t('npcs.loading')}</p>
        )}
      </ServicePageLayout>
    );
  }
  const live = liveState(detail.npc.live);

  return (
    <ServicePageLayout
      title={detail.npc.displayName}
      leading={back}
      meta={
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <MonoText tone="muted">{detail.npc.login}</MonoText>
          <Badge variant="secondary">{t(`npcs.roles.${detail.npc.role}`)}</Badge>
          {detail.npc.villageCode && <Badge variant="outline">{detail.npc.villageCode}</Badge>}
          <NpcLiveBadge state={live} label={t(`npcs.live.${live}`)} />
          {!detail.npc.enabled && <Badge variant="outline">{t('npcs.detail.disabled')}</Badge>}
        </span>
      }
    >
      <Tabs
        value={search.tab}
        onValueChange={(tab) => onSearchChange({ tab: tab as NpcSearch['tab'] })}
      >
        <TabsList>
          {NPC_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`npcs.detail.tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <NpcOverview detail={detail} onDeleted={onDeleted} />
        </TabsContent>
        <TabsContent value="routine" className="pt-4">
          <NpcRoutineCard detail={detail} onEditPattern={onEditPattern} />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <NpcTasks npc={detail.npc} />
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <NpcLogs npcId={npcId} />
        </TabsContent>
        <TabsContent value="events" className="pt-4">
          <NpcEventsFeed npcId={npcId} kind={kind} onKindChange={setKind} />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          {/* Started from the NPC as read; a save resets it to the values saved. */}
          <NpcConfigForm key={npcId} npc={detail.npc} />
        </TabsContent>
      </Tabs>
    </ServicePageLayout>
  );
}

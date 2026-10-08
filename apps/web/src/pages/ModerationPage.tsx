import { useTranslation } from 'react-i18next';
import { PageHeading } from '@/components/molecules/PageHeading';
import { ModerationOverview } from '@/components/organisms/ModerationOverview';
import { ReportsPanel } from '@/components/organisms/ReportsPanel';
import { SanctionsPanel } from '@/components/organisms/SanctionsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ModerationSearch } from '@/lib/moderationSearch';

interface ModerationPageProps {
  search: ModerationSearch;
  onSearchChange: (next: ModerationSearch) => void;
  onOpenPlayer: (id: string) => void;
}

/** `social` moderation (ADR 0024): overview, report queue, sanctions. */
export function ModerationPage({ search, onSearchChange, onOpenPlayer }: ModerationPageProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
      <PageHeading title={t('moderation.title')}>
        <p className="text-sm text-fg-3">{t('moderation.lead')}</p>
      </PageHeading>
      <Tabs
        value={search.tab}
        onValueChange={(tab) =>
          onSearchChange({
            ...search,
            tab: tab as ModerationSearch['tab'],
            page: 1,
            report: undefined,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="overview">{t('moderation.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="reports">{t('moderation.tabs.reports')}</TabsTrigger>
          <TabsTrigger value="sanctions">{t('moderation.tabs.sanctions')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <ModerationOverview onOpenPlayer={onOpenPlayer} />
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <ReportsPanel
            search={search}
            onSearchChange={onSearchChange}
            onOpenPlayer={onOpenPlayer}
          />
        </TabsContent>
        <TabsContent value="sanctions" className="pt-4">
          <SanctionsPanel
            search={search}
            onSearchChange={onSearchChange}
            onOpenPlayer={onOpenPlayer}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

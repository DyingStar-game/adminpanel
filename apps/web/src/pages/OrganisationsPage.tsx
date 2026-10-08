import { useEffect, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PoliticalEntityType } from '@dyingstar-admin/contracts/social';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { CorporationDialog } from '@/components/organisms/CorporationDialog';
import { CorporationsTable } from '@/components/organisms/CorporationsTable';
import { PoliticalEntitiesTable } from '@/components/organisms/PoliticalEntitiesTable';
import { PoliticalEntityDialog } from '@/components/organisms/PoliticalEntityDialog';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan } from '@/hooks/useCan';
import { useCorporations, usePoliticalEntities } from '@/hooks/useOrganisations';
import { usePanel } from '@/hooks/usePanel';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import type { OrganisationsSearch } from '@/lib/organisationsSearch';

const ALL = 'all';
const LEVELS: PoliticalEntityType[] = [
  'commune',
  'agglomeration',
  'department',
  'region',
  'country',
  'federation',
];

interface OrganisationsPageProps {
  search: OrganisationsSearch;
  onSearchChange: (next: OrganisationsSearch) => void;
  onOpenCorporation: (id: string) => void;
  onOpenPoliticalEntity: (id: string) => void;
}

/** Corporations and political entities of `social`, searched by name (ADR 0024 step 2). */
export function OrganisationsPage({
  search,
  onSearchChange,
  onOpenCorporation,
  onOpenPoliticalEntity,
}: OrganisationsPageProps) {
  const { t } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  // Creating needs the capability role of the tab's kind (step N).
  const canCreate =
    services.includes('social-management') &&
    can(search.tab === 'corporations' ? 'social.corporationWrite' : 'social.politicsWrite');
  const [creating, setCreating] = useState(false);
  // Typed text, sent once the user pauses; the URL changing elsewhere shows its own.
  const [text, setText] = useState(search.q);
  const [shown, setShown] = useState(search.q);
  if (search.q !== shown) {
    setShown(search.q);
    setText(search.q);
  }
  useEffect(() => {
    if (text === search.q) return;
    const timer = setTimeout(() => onSearchChange({ ...search, q: text, page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [text, search, onSearchChange]);
  const corporations = useCorporations(search.q, search.page, search.tab === 'corporations');
  const politics = usePoliticalEntities(
    search.q,
    search.type,
    search.page,
    search.tab === 'politics',
  );
  const list = search.tab === 'corporations' ? corporations : politics;

  const pagination = list.data && (
    <Pagination
      page={search.page}
      pageSize={MODERATION_PAGE_SIZE}
      total={list.data.total}
      onPageChange={(page) => onSearchChange({ ...search, page })}
    />
  );

  return (
    <ServicePageLayout
      title={t('organisations.title')}
      meta={<p className="text-sm text-fg-3">{t('organisations.lead')}</p>}
      actions={
        canCreate && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <PlusIcon />
            {t(
              search.tab === 'corporations'
                ? 'organisations.manage.createCorporation'
                : 'organisations.manage.createPolitical',
            )}
          </Button>
        )
      }
    >
      <Tabs
        value={search.tab}
        onValueChange={(tab) =>
          onSearchChange({ ...search, tab: tab as OrganisationsSearch['tab'], page: 1 })
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="corporations">{t('organisations.tabs.corporations')}</TabsTrigger>
            <TabsTrigger value="politics">{t('organisations.tabs.politics')}</TabsTrigger>
          </TabsList>
          <Input
            aria-label={t('organisations.search')}
            placeholder={t('organisations.search')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-72"
          />
          {search.tab === 'politics' && (
            <OptionSelect<string>
              label={t('organisations.columns.level')}
              value={search.type ?? ALL}
              options={[
                { value: ALL, label: t('organisations.allLevels') },
                ...LEVELS.map((l) => ({ value: l, label: t(`moderation.player.political.${l}`) })),
              ]}
              onChange={(v) =>
                onSearchChange({
                  ...search,
                  type: v === ALL ? undefined : (v as PoliticalEntityType),
                  page: 1,
                })
              }
              className="w-44"
            />
          )}
        </div>
        {list.isError ? (
          <ServiceNotice message={t(moderationErrorKey(list.error))} />
        ) : (
          <>
            <TabsContent value="corporations" className="flex flex-col gap-4 pt-4">
              <CorporationsTable
                corporations={corporations.data?.items ?? []}
                onOpen={onOpenCorporation}
              />
              {pagination}
            </TabsContent>
            <TabsContent value="politics" className="flex flex-col gap-4 pt-4">
              <PoliticalEntitiesTable
                entities={politics.data?.items ?? []}
                onOpen={onOpenPoliticalEntity}
              />
              {pagination}
            </TabsContent>
          </>
        )}
      </Tabs>
      {creating &&
        (search.tab === 'corporations' ? (
          <CorporationDialog onClose={() => setCreating(false)} onCreated={onOpenCorporation} />
        ) : (
          <PoliticalEntityDialog
            onClose={() => setCreating(false)}
            onCreated={onOpenPoliticalEntity}
          />
        ))}
    </ServicePageLayout>
  );
}

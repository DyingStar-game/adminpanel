import { useTranslation } from 'react-i18next';
import { SimulationNetworkMap } from '@/components/organisms/SimulationNetworkMap';
import { SimulationOrders } from '@/components/organisms/SimulationOrders';
import { SimulationOverview } from '@/components/organisms/SimulationOverview';
import { SimulationPrices } from '@/components/organisms/SimulationPrices';
import { SimulationStocks } from '@/components/organisms/SimulationStocks';
import { SimulationTreasury } from '@/components/organisms/SimulationTreasury';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SIMULATION_TABS, type SimulationSearch } from '@/lib/simulationSearch';

interface SimulationPageProps {
  search: SimulationSearch;
  onSearchChange: (next: SimulationSearch) => void;
}

/**
 * `universesimulator` (ADR 0025): overview, network map, stocks, transits and missions, prices,
 * treasury, each a tab of the URL. Only the tab on screen is mounted, so only its data is polled
 * (ADR 0009).
 */
export function SimulationPage({ search, onSearchChange }: SimulationPageProps) {
  const { t } = useTranslation();
  const set = (next: Partial<SimulationSearch>) => onSearchChange({ ...search, ...next });
  return (
    <ServicePageLayout
      title={t('simulation.title')}
      meta={<p className="text-sm text-fg-3">{t('simulation.lead')}</p>}
    >
      <Tabs
        value={search.tab}
        onValueChange={(tab) => set({ tab: tab as SimulationSearch['tab'] })}
      >
        <TabsList>
          {SIMULATION_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`simulation.tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <SimulationOverview onOpenVillage={(village) => set({ tab: 'network', village })} />
        </TabsContent>
        <TabsContent value="network" className="pt-4">
          <SimulationNetworkMap
            resource={search.resource}
            village={search.village}
            body={search.body}
            onResourceChange={(resource) => set({ resource })}
            onVillageChange={(village) => set({ village })}
          />
        </TabsContent>
        <TabsContent value="stocks" className="pt-4">
          <SimulationStocks
            entity={search.entity}
            village={search.village}
            resource={search.resource}
            onEntityChange={(entity) => set({ entity })}
            onVillageChange={(village) => set({ village })}
            onResourceChange={(resource) => set({ resource })}
          />
        </TabsContent>
        <TabsContent value="orders" className="pt-4">
          <SimulationOrders
            filters={{
              status: search.status,
              resource: search.resource,
              village: search.village,
            }}
            onFiltersChange={(filters) => set(filters)}
          />
        </TabsContent>
        <TabsContent value="prices" className="pt-4">
          <SimulationPrices
            resource={search.resource}
            onResourceChange={(resource) => set({ resource })}
          />
        </TabsContent>
        <TabsContent value="treasury" className="pt-4">
          <SimulationTreasury />
        </TabsContent>
      </Tabs>
    </ServicePageLayout>
  );
}

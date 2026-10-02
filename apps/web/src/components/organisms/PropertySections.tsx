import { useTranslation } from 'react-i18next';
import type { Item, ObjectDefinition } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { ProfileValue } from '@/components/molecules/ProfileValue';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import { Skeleton } from '@/components/ui/skeleton';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { groupByChannel } from '@/lib/channels';
import { formatDistance } from '@/lib/format';
import { profileFor } from '@/lib/profiles';

interface PropertySectionsProps {
  item: Item;
  /** `undefined` while definitions load, `null` for a type without definition. */
  definition: ObjectDefinition | null | undefined;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
  /** Keys changed by the last live refresh (ADR 0009). */
  changed?: ReadonlySet<string>;
}

/** Properties grouped by replication channel, undeclared keys last (ADR 0006, 0008). */
export function PropertySections({
  item,
  definition,
  resolveRef,
  onNavigate,
  changed,
}: PropertySectionsProps) {
  const { t, i18n } = useTranslation();
  const profile = profileFor(item.object_type);
  const hidden = new Set(profile?.hidden ?? []);
  const data = item.object_data;

  // Wait for the definitions: grouping without them would move every key on arrival.
  if (definition === undefined) return <SectionsSkeleton />;

  return groupByChannel(data, definition).map((section) => {
    const keys = section.keys.filter((key) => !hidden.has(key));
    if (keys.length === 0) return null;
    return (
      <div key={section.zone ?? 'undeclared'}>
        <SectionTitle
          title={
            section.zone === null
              ? t('inspector.undeclared')
              : t('inspector.zone', { zone: section.zone })
          }
          meta={
            section.zone === null
              ? t('inspector.notReplicated')
              : `${formatDistance(section.distance ?? 0, i18n.language)} · ${section.frequency} Hz`
          }
        />
        {keys.map((key) => (
          <PropertyRow key={key} name={key} changed={changed?.has(key) ?? false}>
            <ProfileValue
              value={data[key]}
              name={key}
              data={data}
              renderer={profile?.renderers[key]}
              resolveRef={resolveRef}
              onNavigate={onNavigate}
            />
          </PropertyRow>
        ))}
      </div>
    );
  });
}

function SectionsSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4.5 pt-4.5">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function SectionTitle({ title, meta }: { title: string; meta?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between px-4.5 pt-4.5 pb-1.5">
      <span className="text-2xs font-medium tracking-[.06em] text-fg-3 uppercase">{title}</span>
      {meta && (
        <MonoText tone="subtle" className="text-2xs">
          {meta}
        </MonoText>
      )}
    </div>
  );
}
